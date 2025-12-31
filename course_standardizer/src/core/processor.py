import re
from rapidfuzz import process, fuzz
import threading
from concurrent.futures import ThreadPoolExecutor
import uuid
import pandas as pd
import functools
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

class DataProcessor:
    def __init__(self, config, database, logger):
        self.config = config
        self.db = database
        self.logger = logger
        self.standard_terms = []
        self.error_map = {}
        self.semantic_model = None
        self.semantic_enabled = False
        self.nlp = None
        self.lemmatizer = None
        self.match_cache = {}
        
        # Load resources
        self.load_resources()
        self.setup_semantic_matching()
        self.setup_lemmatizer()

    def load_resources(self):
        # Load standard terms from xlsx or txt
        self.standard_terms = []
        
        # Try multiple paths for standard_courses file
        import os
        from pathlib import Path
        
        search_paths = [
            Path("standard_courses.xlsx"),
            Path(__file__).parent.parent.parent / "standard_courses.xlsx",
            Path.home() / "Public" / "New" / "course_standardizer" / "standard_courses.xlsx",
            Path("standard_courses.txt"),
            Path.home() / "Public" / "New" / "standard_courses.txt",
        ]
        
        for path in search_paths:
            if path.exists():
                try:
                    if path.suffix == ".xlsx":
                        import pandas as pd
                        df = pd.read_excel(path)
                        # Use first column or known column name
                        col = df.columns[0] if len(df.columns) > 0 else None
                        for c in ['standard_courses', 'Course', 'COURSE', 'Name']:
                            if c in df.columns:
                                col = c
                                break
                        if col:
                            self.standard_terms = sorted([str(v).strip().upper() for v in df[col].dropna() if str(v).strip()])
                    else:
                        with open(path, "r", encoding="utf-8") as f:
                            self.standard_terms = sorted([l.strip().upper() for l in f if l.strip()])
                    self.logger.info(f"Loaded {len(self.standard_terms)} standard terms from {path.name}")
                    break
                except Exception as e:
                    self.logger.warning(f"Failed to load standards from {path}: {e}")
            
        # Load error map
        try:
            import pandas as pd
            df = pd.read_excel("errors_and_corrections.xlsx")
            self.error_map = {str(row[0]).upper().strip(): str(row[1]).upper().strip() for _, row in df.iterrows()}
        except Exception:
            self.error_map = {}

    def setup_semantic_matching(self):
        try:
            from sentence_transformers import SentenceTransformer
            self.semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
            self.semantic_enabled = True
        except ImportError:
            self.semantic_enabled = False
            self.logger.warning("sentence-transformers not installed. Semantic matching disabled.")

    def preprocess_string(self, text):
        """Enhanced preprocessing for real-world course name variations"""
        if not text:
            return ""
        
        text = str(text).upper().strip()
        
        # Step 1: Extract course code if present (e.g., "(DMED)" or "(NBDA)")
        # Store it separately and remove from text
        course_code = ""
        code_match = re.search(r'\(([A-Z0-9]+)\)', text)
        if code_match:
            course_code = code_match.group(1)
            text = re.sub(r'\([A-Z0-9]+\)', '', text)
        
        # Step 2: Handle NBEMS special cases
        # "(NBEMS)" or "(NBEMS- DIPLOMA)" → "DNB" or "DNB- DIPLOMA"
        text = re.sub(r'\(NBEMS\s*-?\s*DIPLOMA\)', 'DNB- DIPLOMA', text)
        text = re.sub(r'\(NBEMS\)', 'DNB', text)
        text = re.sub(r'NBEMS', 'DNB', text)
        
        # Step 3: Normalize spacing around hyphens and special chars
        text = re.sub(r'\s*-\s*', '- ', text)  # "DNB-DIPLOMA" → "DNB- DIPLOMA"
        text = re.sub(r'\s+', ' ', text)  # Multiple spaces → single space
        
        # Step 4: Handle bracketed content (if ignore_brackets is enabled)
        if self.config.get("ignore_brackets", False):
            text = re.sub(r'[\(\[\{].*?[\)\]\}]', '', text)
        
        # Step 5: Remove special characters but keep hyphens and spaces
        text = re.sub(r'[^A-Z0-9\s\-]', ' ', text)
        
        # Step 6: Clean up extra spaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Step 7: Normalize common variations
        # "E.N.T." → "ENT"
        text = text.replace('E N T', 'ENT')
        # DON'T remove "DIRECT 6 YEARS COURSE" - it's part of actual course names
        
        # Step 8: Apply lemmatization if enabled
        if self.config.get("use_lemmatization", False) and self.lemmatizer:
            text = self._apply_lemmatization(text)
        
        return text.strip()

    def apply_corrections(self, text):
        if not text:
            return text
        
        corrected = text
        for error, correction in self.error_map.items():
            # Only apply if exact match and not already corrected
            # Avoid duplicates like "DNB IN IN ORTHOPAEDICS"
            if error == corrected:
                # Validate the correction before applying
                if self.is_valid_correction(corrected, correction):
                    corrected = correction
                break
            # Also try partial match with word boundaries to avoid over-correction
            elif error in corrected and correction not in corrected:
                # Use word boundary to ensure we're matching whole terms
                import re
                pattern = r'\b' + re.escape(error) + r'\b'
                if re.search(pattern, corrected):
                    tentative = re.sub(pattern, correction, corrected)
                    # Validate before applying
                    if self.is_valid_correction(corrected, tentative):
                        corrected = tentative
        return corrected
    
    def is_valid_correction(self, original, corrected):
        """Validate that a correction doesn't create malformed results"""
        # Check for invalid patterns
        invalid_patterns = [
            r'DNB IN- DIPLOMA',  # DNB- DIPLOMA should not become DNB IN- DIPLOMA
            r'DNB IN DIPLOMA',   # DNB- DIPLOMA should not become DNB IN DIPLOMA
            r'IN IN ',           # Duplicate IN
            r'  ',               # Double spaces
        ]
        
        for pattern in invalid_patterns:
            if re.search(pattern, corrected):
                return False
        
        # Don't apply if it makes the result longer by more than 50%
        if len(corrected) > len(original) * 1.5:
            return False
        
        return True

    def enhanced_matching(self, text):
        """Advanced multi-stage matching pipeline"""
        
        # Stage 1: Exact match after normalization
        if text in self.standard_terms:
            return text, 100
        
        # Stage 2: Abbreviation expansion
        expanded_text = self.expand_abbreviations(text)
        if expanded_text in self.standard_terms:
            return expanded_text, 98
        
        # Stage 3: Token-based matching
        token_match, token_score = self.token_based_match(text)
        if token_score >= 95:
            return token_match, token_score
        
        # Stage 4: Enhanced fuzzy matching with medical term weighting
        fuzzy_match, fuzzy_score = self.weighted_fuzzy_match(text)
        
        # Stage 5: Semantic matching fallback
        if fuzzy_score < self.config.get("auto_threshold", 90) and self.semantic_enabled:
            # Simplified semantic match for now
            pass
            
        return fuzzy_match, fuzzy_score
    
    def expand_abbreviations(self, text):
        """Expand common medical course abbreviations"""
        # Medical degree abbreviations
        abbreviations = {
            r'\bM\.?D\.?\b': 'MD',
            r'\bM\.?S\.?\b': 'MS',
            r'\bD\.?M\.?\b': 'DM',
            r'\bM\.?CH\.?\b': 'MCH',
            r'\bD\.?N\.?B\.?\b': 'DNB',
            r'\bM\.?B\.?B\.?S\.?\b': 'MBBS',
            r'\bB\.?D\.?S\.?\b': 'BDS',
            r'\bM\.?D\.?S\.?\b': 'MDS',
            # Specialty abbreviations (based on real data patterns)
            r'\bGYNAE\b': 'GYNAECOLOGY',
            r'\bGYNECO\b': 'GYNAECOLOGY',
            r'\bOBSTET\b': 'OBSTETRICS',
            r'\bORTHO\b': 'ORTHOPAEDICS',
            r'\bORTHOPAED\b': 'ORTHOPAEDICS',
            r'\bPAED\b': 'PAEDIATRICS',
            r'\bPEDIATR\b': 'PAEDIATRICS',
            r'\bDERMA\b': 'DERMATOLOGY',
            r'\bDERMATO\b': 'DERMATOLOGY',
            r'\bANAES\b': 'ANAESTHESIA',
            r'\bANAESTE\b': 'ANAESTHESIA',
            r'\bRADIO\b': 'RADIOLOGY',
            r'\bPATHO\b': 'PATHOLOGY',
            r'\bPSYCH\b': 'PSYCHIATRY',
            r'\bNEURO\b': 'NEUROLOGY',
            r'\bCARDIO\b': 'CARDIOLOGY',
            r'\bONCO\b': 'ONCOLOGY',
            r'\bE\.?N\.?T\.?\b': 'ENT',
            r'\bOTORHINO\b': 'OTORHINOLARYNGOLOGY',
            r'\bORL\b': 'OTORHINOLARYNGOLOGY',
            r'\bOPHTHAL\b': 'OPHTHALMOLOGY',
            r'\bRADIOLO\b': 'RADIOLOGY',
            r'\bTUBERCULO\b': 'TUBERCULOSIS',
            r'\bRESPI\b': 'RESPIRATORY',
            r'\bGASTRO\b': 'GASTROENTEROLOGY',
            # Common pattern variations
            r'\bGEN\s+MED\b': 'GENERAL MEDICINE',
            r'\bGEN\s+SURG\b': 'GENERAL SURGERY',
            r'\bCARDIOVASC\b': 'CARDIOVASCULAR',
            r'\bTHORAC\b': 'THORACIC',
            # Additional real-world patterns
            r'\bPREVENT\b': 'PREVENTIVE',
            r'\bSOCIAL\s+MED\b': 'SOCIAL MEDICINE',
            r'\bINTERVENT\b': 'INTERVENTIONAL',
            r'\bHAEMATO\b': 'HAEMATOLOGY',
            r'\bEMANATOL\b': 'HAEMATOLOGY',
            r'\bIMMUNO\b': 'IMMUNOLOGY',
            r'\bTRANSFUS\b': 'TRANSFUSION',
            r'\bNUCLEAR\s+MED\b': 'NUCLEAR MEDICINE',
            r'\bPALLIAT\b': 'PALLIATIVE',
            r'\bGERIATR\b': 'GERIATRIC',
            r'\bEMERG\b': 'EMERGENCY',
            r'\bFORENS\b': 'FORENSIC',
            r'\bCOMMUNITY\s+MED\b': 'PREVENTIVE AND SOCIAL MEDICINE',
        }
        
        expanded = text
        for pattern, replacement in abbreviations.items():
            expanded = re.sub(pattern, replacement, expanded)
        
        return expanded
    
    def token_based_match(self, text):
        """Match based on significant tokens"""
        # Common words to ignore
        stop_words = {'IN', 'OF', 'AND', 'THE', 'WITH', 'FOR', 'TO'}
        
        # Extract tokens
        tokens = set(text.split()) - stop_words
        
        best_match = None
        best_score = 0
        
        for standard in self.standard_terms:
            standard_tokens = set(standard.split()) - stop_words
            
            # Calculate Jaccard similarity
            if standard_tokens:
                intersection = len(tokens & standard_tokens)
                union = len(tokens | standard_tokens)
                jaccard_score = (intersection / union) * 100
                
                # Bonus if degree prefix matches exactly
                text_prefix = text.split()[0] if text.split() else ""
                std_prefix = standard.split()[0] if standard.split() else ""
                if text_prefix == std_prefix and text_prefix in ['MD', 'MS', 'DNB', 'DM', 'MCH', 'MBBS']:
                    jaccard_score += 10
                
                if jaccard_score > best_score:
                    best_score = jaccard_score
                    best_match = standard
        
        return best_match, min(best_score, 100)
    
    def weighted_fuzzy_match(self, text):
        """Enhanced fuzzy matching with medical term awareness"""
        if not self.standard_terms:
            return None, 0
        
        # Use WRatio for better results
        fuzzy_match, fuzzy_score, _ = process.extractOne(
            text, self.standard_terms, scorer=fuzz.WRatio
        )
        
        # Apply bonus for matching degree type
        degree_prefixes = ['MD', 'MS', 'DNB', 'DM', 'MCH', 'MBBS', 'BDS', 'MDS']
        text_degree = text.split()[0] if text.split() else ""
        match_degree = fuzzy_match.split()[0] if fuzzy_match.split() else ""
        
        if text_degree == match_degree and text_degree in degree_prefixes:
            fuzzy_score = min(fuzzy_score + 5, 100)
        
        return fuzzy_match, fuzzy_score

    def classify_match(self, score):
        if score >= self.config.get("auto_threshold", 90):
            return "Auto-Matched"
        elif score >= self.config.get("possible_threshold", 70):
            return "Possible Match"
        else:
            return "Did Not Match"

    def process_data_async(self, progress_callback=None, completion_callback=None):
        def _process():
            conn = None
            total_rows = 0
            try:
                print("DEBUG: Starting process_data_async thread")
                # Create a dedicated connection for this thread
                # This ensures complete thread safety for the heavy processing operation
                import sqlite3
                conn = sqlite3.connect(self.db.db_path)
                cursor = conn.cursor()
                
                # Re-initialize tables on this connection to ensure they exist
                # We can't use self.db.init_tables() because that uses self.db.conn
                cursor.execute("DROP TABLE IF EXISTS processed_courses")
                
                # Reclaim schema from DatabaseManager logic (duplicated here for thread safety)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS processed_courses (
                        id TEXT PRIMARY KEY, 
                        file TEXT, 
                        original TEXT, 
                        suggested TEXT,
                        score INTEGER, 
                        status TEXT, 
                        final TEXT, 
                        source_table TEXT, 
                        source_id TEXT
                    )
                """)
                conn.commit()
                
                # Get tables and columns from metadata to ensure accuracy
                # This avoids guessing the column name again which might fail
                cursor.execute("SELECT table_name, course_column FROM processed_files")
                files_data = cursor.fetchall()  # List of (table_name, course_column) tuples
                
                # If metadata is empty (legacy or error), try fallback to scanning tables
                if not files_data:
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'file_%'")
                    tables = [row[0] for row in cursor.fetchall()]
                    files_data = [(t, None) for t in tables]
                
                cursor.close()
                
                total_rows = 0
                processed_rows = []
                
                # Need to read from the tables which might have been created by the main connection
                # SQLite handles file locking, so reading via separate connection is fine
                
                for table_name, metadata_col in files_data:
                    # Check if table exists (in case it was deleted manually)
                    # We can use the connection to check or just try reading
                    try:
                        # Use pandas with the LOCAL connection
                        df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
                    except Exception as e:
                        # Table might not exist
                        continue
                    
                    course_col = metadata_col
                    
                    # If we don't have metadata (fallback), try to detect
                    if not course_col:
                        possible_cols = ["COURSES", "COURSE", "COURSE_NAME", "SPECIALTY", "SUBJECT", "DISCIPLINE"]
                        upper_cols = {c.upper(): c for c in df.columns}
                        course_col = next((upper_cols[c] for c in possible_cols if c in upper_cols), None)
                    
                    if not course_col or course_col not in df.columns:
                        # Try case-insensitive match if exact match failed
                        if course_col:
                            upper_cols = {c.upper(): c for c in df.columns}
                            course_col = upper_cols.get(course_col.upper())
                            
                    if not course_col: 
                         continue
                    
                    for _, row in df.iterrows():
                        raw = str(row[course_col]).strip()
                        if not raw or raw.upper() in self.config.get("ignore_list", []):
                            continue
                            
                        processed = self.preprocess_string(raw)
                        corrected = self.apply_corrections(processed)
                        
                        if corrected in self.config.get("ignore_list", []):
                            continue
                            
                        match, score = self.enhanced_matching(corrected)
                        score = int(score or 0)
                        match = match or ""
                        status = self.classify_match(score)
                        final = match if status == "Auto-Matched" else ""
                        
                        processed_rows.append((
                            str(uuid.uuid4()), 
                            table_name, 
                            corrected, 
                            match, 
                            score, 
                            status, 
                            final, 
                            table_name, 
                            corrected
                        ))
                        
                        total_rows += 1
                        if progress_callback and total_rows % 10 == 0:
                            progress_callback(total_rows)
                
                cursor = conn.cursor()
                cursor.executemany("INSERT INTO processed_courses VALUES (?,?,?,?,?,?,?,?,?)", processed_rows)
                conn.commit()
                cursor.close()
                conn.close()
                
                if completion_callback:
                    if total_rows == 0:
                        completion_callback(True, "Processed 0 records. Please check file headers.")
                    else:
                        completion_callback(True, f"Processed {total_rows} records")
                    
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"DEBUG: Error in process_data_async: {e}")
                self.logger.error(f"Error in process_data_async: {e}")
                if completion_callback:
                    completion_callback(False, f"Error: {str(e)}")
            finally:
                if conn: conn.close()

        thread = threading.Thread(target=_process)
        thread.start()

    def save_standards(self, standards_list):
        """Save standard terms to file"""
        self.standard_terms = sorted(standards_list)
        try:
            with open("standard_courses.txt", "w", encoding="utf-8") as f:
                f.write("\n".join(self.standard_terms))
        except Exception as e:
            self.logger.error(f"Failed to save standards: {e}")

    def save_error_map(self, error_map_dict):
        """Save error map to Excel file"""
        self.error_map = error_map_dict
        try:
            import pandas as pd
            df = pd.DataFrame(list(self.error_map.items()), columns=['Error', 'Correction'])
            df.to_excel("errors_and_corrections.xlsx", index=False)
        except Exception as e:
            self.logger.error(f"Failed to save error map: {e}")

    def generate_quality_report(self):
        """Generate comprehensive quality report"""
        stats = self.db.get_stats()
        total = stats['total']
        
        if total == 0:
            return {'score': 0, 'metrics': [], 'recommendations': ["No data loaded"]}
        
        # Calculate metrics
        auto_rate = (stats['auto'] / total) * 100 if total > 0 else 0
        possible_rate = (stats['possible'] / total) * 100 if total > 0 else 0
        dnm_rate = (stats['dnm'] / total) * 100 if total > 0 else 0
        
        # Calculate average score
        avg_score = self.db.cursor.execute("SELECT AVG(score) FROM processed_courses").fetchone()[0] or 0
        
        # Completeness
        completed = self.db.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE final != ''").fetchone()[0]
        completeness = (completed / total) * 100 if total > 0 else 0
        
        # Overall quality score
        quality_score = int((auto_rate * 0.4) + (completeness * 0.3) + (avg_score * 0.3))
        
        metrics = [
            ("Total Records", str(total), "INFO"),
            ("Auto-Matched", f"{stats['auto']} ({auto_rate:.1f}%)", "✓" if auto_rate >= 60 else "⚠"),
            ("Possible Match", f"{stats['possible']} ({possible_rate:.1f}%)", "INFO"),
            ("Did Not Match", f"{stats['dnm']} ({dnm_rate:.1f}%)", "⚠" if dnm_rate > 20 else "✓"),
            ("Average Score", f"{avg_score:.1f}", "✓" if avg_score >= 80 else "⚠"),
            ("Completeness", f"{completeness:.1f}%", "✓" if completeness >= 80 else "⚠"),
        ]
        
        recommendations = []
        if auto_rate < 60:
            recommendations.append("Low auto-match rate. Review error map and add common corrections.")
        if dnm_rate > 20:
            recommendations.append("High 'Did Not Match' rate. Consider adding more standard terms.")
        if completeness < 80:
            recommendations.append("Many records lack final values. Review 'Possible Match' records.")
        if not recommendations:
            recommendations.append("Data quality looks good! Continue monitoring.")
        
        return {'score': quality_score, 'metrics': metrics, 'recommendations': recommendations}

    def check_conflicts(self):
        """Check for conflicting error map entries"""
        conflicts = {}
        correction_to_errors = {}
        
        for error, correction in self.error_map.items():
            if correction not in correction_to_errors:
                correction_to_errors[correction] = []
            correction_to_errors[correction].append(error)
        
        for correction, errors in correction_to_errors.items():
            if len(errors) > 1:
                conflicts[correction] = errors
        
        return conflicts

    def load_and_process_file(self, file_path):
        """Load and process a single file - used for batch processing"""
        import os
        
        # Similar to load_file logic but returns stats
        table_name = f"file_{uuid.uuid4().hex[:8]}"
        
        try:
            # Detect file type and load
            if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                df = pd.read_excel(file_path)
            elif file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                return {'success': False, 'error': 'Unsupported file type', 'records': 0}
            
            # Store in database (simplified - just the course column)
            # Find course column
            course_col = None
            for col in df.columns:
                col_upper = col.upper()
                if any(keyword in col_upper for keyword in ['COURSE', 'SUBJECT', 'SPECIALTY', 'DISCIPLINE']):
                    course_col = col
                    break
            
            if not course_col:
                return {'success': False, 'error': 'No course column found', 'records': 0}
            
            # Store file data
            df.to_sql(table_name, self.db.conn, if_exists='replace', index=False)
            
            # Store metadata
            self.db.cursor.execute("""
                INSERT INTO file_metadata (filename, table_name, upload_date, course_column)
                VALUES (?, ?, datetime('now'), ?)
            """, (os.path.basename(file_path), table_name, course_col))
            self.db.conn.commit()
            
            return {'success': True, 'records': len(df), 'table': table_name}
            
        except Exception as e:
            self.logger.error(f"Failed to load file {file_path}: {e}")
            return {'success': False, 'error': str(e), 'records': 0}

    def setup_lemmatizer(self):
        """Setup NLTK lemmatizer with auto-download"""
        try:
            import nltk
            # Check and download required resources
            resources = {
                'punkt_tab': 'tokenizers/punkt_tab', 
                'wordnet': 'corpora/wordnet'
            }
            
            for name, path in resources.items():
                try:
                    nltk.data.find(path)
                except LookupError:
                    self.logger.info(f"Downloading missing NLTK resource: {name}")
                    nltk.download(name, quiet=True)
            
            self.lemmatizer = WordNetLemmatizer()
        except Exception as e:
            self.logger.warning(f"Lemmatizer not available: {e}")

    def _apply_lemmatization(self, text):
        """Internal helper: Apply lemmatization to ALREADY PREPROCESSED text"""
        if not text or not self.lemmatizer:
            return text
        
        # Text is already clean from preprocess_string steps 1-7
        tokens = word_tokenize(text.lower())
        lemmatized = " ".join([self.lemmatizer.lemmatize(t) for t in tokens])
        return lemmatized.upper()

    @functools.lru_cache(maxsize=1000)
    def cached_match(self, text):
        """Cached version of enhanced_matching"""
        return self.enhanced_matching(text)

    def clear_cache(self):
        """Clear the matching cache"""
        self.cached_match.cache_clear()
        self.match_cache.clear()
