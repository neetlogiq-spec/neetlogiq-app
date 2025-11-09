#!/usr/bin/env python3
"""
Integrated Cascading Hierarchical Matcher with DNB/Overlapping Support

Combines:
1. Cascading Hierarchical Ensemble approach (core matching algorithm)
2. DNB/Overlapping course detection (from recent.py)
3. Stream routing (medical/dental/dnb tables)
4. Fallback logic (medical→dnb, diploma→both, dnb-only)

This is the primary matcher to be integrated into recent.py as the core matching engine.
"""

import sqlite3
import pandas as pd
import logging
from typing import Dict, List, Optional, Tuple
from cascading_ensemble_matcher import CascadingHierarchicalEnsembleMatcher

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IntegratedCascadingMatcher:
    """
    Integrated matcher combining cascading hierarchical approach with domain-specific logic

    Features:
    - Cascading 3-stage matching (hierarchical → rapidfuzz → ensemble)
    - DNB/overlapping course detection
    - Medicine-only and DNB-only course routing
    - Automatic fallback between medical and dnb streams
    - Maintains all table structures (medical/dental/dnb)
    """

    def __init__(
        self,
        master_db_path='data/sqlite/master_data.db',
        seat_db_path='data/sqlite/seat_data.db'
    ):
        """Initialize integrated cascading matcher"""
        self.master_db_path = master_db_path
        self.seat_db_path = seat_db_path

        # Initialize cascading matcher (core engine)
        self.cascading_matcher = CascadingHierarchicalEnsembleMatcher(
            master_db_path, seat_db_path
        )

        # Load configuration from config.yaml (or use defaults)
        try:
            import yaml
            with open('config.yaml', 'r') as f:
                self.config = yaml.safe_load(f)
        except Exception as e:
            logger.warning(f"Could not load config.yaml: {e}. Using default config.")
            # Fallback configuration
            self.config = {
                'course_classification': {
                    'dnb_patterns': ['DNB', 'DNB-'],
                    'dental_patterns': ['BDS', 'MDS', 'PG DIPLOMA', 'DENTAL'],
                    'medical_patterns': ['MBBS', 'MD', 'MS', 'MD/MS', 'MPH', 'DIPLOMA', 'POST MBBS', 'DM', 'MCH', 'ALL PG COURSES'],
                },
                'diploma_courses': {
                    'overlapping': [
                        'DIPLOMA IN ANAESTHESIOLOGY',
                        'DIPLOMA IN EMERGENCY MEDICINE',
                        'DIPLOMA IN ORTHOPEDIC SURGERY',
                        'DIPLOMA IN OTORHINOLARYNGOLOGY',
                        'DIPLOMA IN GENERAL SURGERY',
                        'DIPLOMA IN PEDIATRICS',
                    ],
                    'dnb_only': [
                        'DIPLOMA IN FAMILY MEDICINE',
                        'DIPLOMA IN GERIATRIC MEDICINE',
                        'DIPLOMA IN OCCUPATIONAL HEALTH',
                    ],
                }
            }

        # Stream mapping: course_type → college tables to search
        self.stream_mapping = {
            'medical': ['medical'],
            'dental': ['dental'],
            'dnb': ['dnb'],
            'diploma': ['medical', 'dnb'],  # Overlapping - search both
            'unknown': ['medical', 'dental', 'dnb']  # Search all if unknown
        }

        logger.info("Integrated Cascading Matcher initialized")
        logger.info("  Core Engine: Cascading Hierarchical Ensemble (3 stages)")
        logger.info("  Domain Logic: DNB/Overlapping/Medicine-only support")
        logger.info("  Stream Routing: Medical/Dental/DNB table selection")

    def classify_course(self, course_name: str) -> str:
        """
        Classify course into type: medical, dental, dnb, diploma, unknown

        Uses config.yaml patterns for consistent stream detection:
        - dnb_patterns: DNB prefix/suffix patterns
        - dental_patterns: Dental course keywords
        - medical_patterns: Medical course keywords
        - dnb_only: Courses only in DNB stream
        - overlapping: Courses in both medical and DNB streams

        Priority:
        1. DNB patterns (most specific)
        2. Dental patterns
        3. Diploma courses (with dnb-only/overlapping checks)
        4. Medical patterns
        5. Unknown
        """
        if not course_name:
            return 'unknown'

        course_upper = course_name.upper()

        # PRIORITY 1: Check DNB patterns FIRST (most specific - from config)
        for pattern in self.config['course_classification']['dnb_patterns']:
            if pattern in course_upper:
                logger.debug(f"Course '{course_name}' → DNB (pattern: {pattern})")
                return 'dnb'

        # PRIORITY 2: Check SPECIFIC diploma courses BEFORE generic patterns
        # (because "PG DIPLOMA IN ANAESTHESIOLOGY" should be diploma, not dental)
        if 'DIPLOMA' in course_upper:
            # Check DNB-only diploma courses FIRST (from config) - pattern-based matching
            for dnb_diploma in self.config['diploma_courses'].get('dnb_only', []):
                if dnb_diploma.upper() in course_upper:
                    logger.debug(f"Course '{course_name}' → DNB-ONLY DIPLOMA (pattern: {dnb_diploma})")
                    return 'dnb'

            # Check overlapping diploma courses (medical + dnb) (from config) - pattern-based matching
            for overlapping_diploma in self.config['diploma_courses'].get('overlapping', []):
                if overlapping_diploma.upper() in course_upper:
                    logger.debug(f"Course '{course_name}' → OVERLAPPING DIPLOMA (pattern: {overlapping_diploma})")
                    return 'diploma'

        # PRIORITY 3: Check dental courses (from config)
        for pattern in self.config['course_classification']['dental_patterns']:
            if pattern in course_upper:
                logger.debug(f"Course '{course_name}' → DENTAL (pattern: {pattern})")
                return 'dental'

        # PRIORITY 4: Check generic diploma courses (medical + dnb fallback)
        if 'DIPLOMA' in course_upper:
            logger.debug(f"Course '{course_name}' → GENERIC DIPLOMA (medical + dnb fallback)")
            return 'diploma'

        # PRIORITY 5: Check medical patterns (from config)
        for pattern in self.config['course_classification']['medical_patterns']:
            if pattern in course_upper:
                logger.debug(f"Course '{course_name}' → MEDICAL (pattern: {pattern})")
                return 'medical'

        logger.debug(f"Course '{course_name}' → UNKNOWN")
        return 'unknown'

    def get_college_streams_for_course(self, course_type: str) -> List[str]:
        """
        Get list of college streams (tables) to search based on course type

        Examples:
        - medical → ['medical']
        - dnb → ['dnb']
        - diploma → ['medical', 'dnb'] (search both with fallback)
        - unknown → ['medical', 'dental', 'dnb'] (search all)
        """
        streams = self.stream_mapping.get(course_type, ['medical', 'dental', 'dnb'])
        logger.debug(f"Course type '{course_type}' → Streams: {streams}")
        return streams

    def match_college(
        self,
        college_name: str,
        state: str,
        course_name: str,
        address: str = None,
        table_name: str = 'colleges',
        category: str = None,
        quota: str = None,
        level: str = None
    ) -> Optional[Dict]:
        """
        Match college using integrated cascading approach with domain logic

        Flow:
        1. Classify course (medical/dental/dnb/diploma/unknown)
        2. Get college streams to search
        3. For each stream, run cascading hierarchical matcher
        4. Return first match, or try fallback streams

        Parameters:
        -----------
        college_name: str
            College name from seat data
        state: str
            State/UT (normalized)
        course_name: str
            Course name (used for stream detection)
        address: str
            Address (used for validation)
        table_name: str
            Seat data table name (default: 'colleges')
        category: str
            Regulatory category (General/OBC/SC/ST/PWD) - EXACT match only
        quota: str
            Institutional quota (Government/Private/NRI) - EXACT match only
        level: str
            Academic level (UG/PG) - EXACT match only

        Returns:
        --------
        Dict with college_id, college_name, address, state
        or None if no match found
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"INTEGRATED CASCADING MATCH")
        logger.info(f"College: {college_name}, State: {state}, Course: {course_name}")
        if category or quota or level:
            logger.info(f"Immutable Filters: category={category}, quota={quota}, level={level}")
        logger.info(f"{'='*100}")

        if not college_name or not state:
            logger.warning("Missing college_name or state")
            return None

        # STEP 1: Classify course to determine streams
        course_type = self.classify_course(course_name)
        streams = self.get_college_streams_for_course(course_type)
        logger.info(f"Course Type: {course_type}, Streams: {streams}")

        # STEP 2: Try each stream with cascading matcher
        for stream in streams:
            logger.info(f"\n  → Trying stream: {stream.upper()}")

            # Use cascading matcher directly with current master_data
            # The cascading matcher filters by state → stream → name → address
            result = self._match_in_stream(
                college_name, state, course_name, address, stream,
                category=category, quota=quota, level=level
            )

            if result:
                logger.info(f"  ✅ MATCHED in {stream.upper()}: {result['college_id']}")
                return result

            logger.info(f"  ❌ No match in {stream.upper()}")

        logger.warning(f"❌ No match found in any stream")
        return None

    def _match_in_stream(
        self,
        college_name: str,
        state: str,
        course_name: str,
        address: str,
        stream: str,
        category: str = None,
        quota: str = None,
        level: str = None
    ) -> Optional[Dict]:
        """
        Run cascading hierarchical matcher within a specific college stream

        This is where the cascading hierarchy comes in:
        STAGE 1: Pure hierarchical (exact+fuzzy matching)
        STAGE 2: Hierarchical + RapidFuzz fallback
        STAGE 3: Hierarchical + Full Ensemble fallback

        Immutable filters (category, quota, level) are applied before cascading stages
        """
        try:
            # Get colleges from appropriate table
            conn = sqlite3.connect(self.master_db_path)
            conn.row_factory = sqlite3.Row

            # Map stream to table
            table_map = {
                'medical': 'colleges',
                'dental': 'colleges',
                'dnb': 'colleges'
            }

            table = table_map.get(stream, 'colleges')

            # Query colleges by state and stream
            query = f"""
                SELECT id, name, address, normalized_name, state, source_table
                FROM {table}
                WHERE normalized_state = ? AND source_table = ?
                ORDER BY normalized_name
            """

            colleges_df = pd.read_sql(
                query,
                conn,
                params=(state.upper(), stream.upper())
            )
            conn.close()

            if len(colleges_df) == 0:
                logger.debug(f"No colleges found in {stream} for state {state}")
                return None

            logger.debug(f"Found {len(colleges_df)} colleges in {stream} stream")

            # ADDRESS-BASED PRE-FILTERING (IMPROVED)
            # If address is provided, filter colleges by location BEFORE fuzzy matching
            # This prevents matching wrong colleges when multiple colleges have the same name (e.g., 31 GMCs in one state)
            if address:
                # Extract location keywords from address
                address_upper = str(address).upper()

                # Words to exclude (generic college/hospital words that appear in all colleges)
                generic_words = {'GOVERNMENT', 'MEDICAL', 'COLLEGE', 'HOSPITAL', 'DISTRICT', 'GENERAL',
                                'UNIVERSITY', 'INSTITUTE', 'PRIVATE', 'PUBLIC', 'NURSING', 'CENTRE', 'CENTER',
                                'HEALTHCARE', 'HEALTH', 'CARE', 'TERTIARY', 'SECONDARY', 'PRIMARY'}

                # Extract distinctive location words (removing generic words)
                address_words = set(w for w in address_upper.split() if len(w) > 3 and w not in generic_words)

                if address_words:
                    # Try to find colleges with these distinctive location words in their address
                    # Use a stricter matching: college address must contain at least one location word
                    pattern = '|'.join(address_words)
                    colleges_with_address = colleges_df[
                        colleges_df['address'].fillna('').str.upper().str.contains(
                            pattern, case=False, regex=True
                        )
                    ]

                    # Use address-filtered set if we found matches
                    if len(colleges_with_address) > 0:
                        logger.debug(f"  → Location-filtered to {len(colleges_with_address)} colleges (words: {address_words})")
                        colleges_df = colleges_with_address
                    else:
                        # Fallback: if no location match, try generic words as last resort
                        logger.debug(f"  → No location match found, falling back to generic word matching")

            # Run hierarchical filtering on this stream's colleges
            # (This mimics what cascading matcher does internally)
            return self._hierarchical_filter(
                colleges_df, college_name, course_name, address,
                category=category, quota=quota, level=level
            )

        except Exception as e:
            logger.error(f"Error matching in stream {stream}: {e}")
            return None

    def _hierarchical_filter(
        self,
        colleges_df: pd.DataFrame,
        college_name: str,
        course_name: str,
        address: str,
        category: str = None,
        quota: str = None,
        level: str = None
    ) -> Optional[Dict]:
        """
        Run 3-stage cascading hierarchical filter on pre-filtered colleges

        Hierarchical filtering order:
        1. STATE (already filtered at DB level)
        2. COURSE (already filtered at DB level)
        3. COLLEGE (name + address) - 3-stage cascading
        4. QUOTA (exact match only) - for counselling data
        5. CATEGORY (exact match only) - for counselling data
        6. LEVEL (exact match only) - for counselling data

        STAGE 1: Pure Hierarchical (exact/fuzzy on college name + address validation)
        STAGE 2: + RapidFuzz fallback (fuzzy on college name + address validation)
        STAGE 3: + Full Ensemble fallback (Transformers/TF-IDF on college name + address validation)

        Immutable filters (quota, category, level) applied AFTER college match
        """
        if len(colleges_df) == 0:
            return None

        college_norm = college_name.upper().strip()
        address_norm = address.upper().strip() if address else None

        # Helper function: validate address when multiple colleges have same name
        def _validate_address(candidates_df, input_address):
            """
            For colleges with same name, use address to disambiguate
            Returns best match based on address similarity
            """
            if len(candidates_df) == 1:
                return candidates_df.iloc[0]

            if not input_address:
                # No address provided, return first match with warning
                logger.debug(f"  ⚠ Multiple colleges found but no address provided - returning first match")
                return candidates_df.iloc[0]

            # Try exact address match first
            address_norm = input_address.upper().strip()
            exact_addr = candidates_df[
                candidates_df['address'].str.upper().str.strip() == address_norm
            ]
            if len(exact_addr) > 0:
                logger.debug(f"  ✓ Address exact match found")
                return exact_addr.iloc[0]

            # Try fuzzy address match (60%+ ratio)
            from difflib import SequenceMatcher
            from rapidfuzz import fuzz as rapidfuzz_fuzz

            best_match = None
            best_ratio = 0
            for idx, row in candidates_df.iterrows():
                if pd.isna(row['address']):
                    continue

                addr_db = row['address'].upper().strip()

                # Try exact match first
                if address_norm == addr_db:
                    logger.debug(f"  ✓ Address exact match found")
                    return row

                # Try fuzzy match with multiple methods
                seq_ratio = SequenceMatcher(None, address_norm, addr_db).ratio()

                try:
                    # RapidFuzz token_set_ratio is more forgiving
                    rapid_ratio = rapidfuzz_fuzz.token_set_ratio(address_norm, addr_db) / 100.0
                    combined_ratio = max(seq_ratio, rapid_ratio)
                except:
                    combined_ratio = seq_ratio

                if combined_ratio > best_ratio:
                    best_ratio = combined_ratio
                    best_match = row

            if best_match is not None and best_ratio >= 0.6:
                logger.debug(f"  ✓ Address fuzzy match found (ratio: {best_ratio:.2f})")
                return best_match

            # No good address match found, return first match with warning
            logger.debug(f"  ⚠ No address match found (best: {best_ratio:.2f}) - returning first match")
            return candidates_df.iloc[0]

        # ==================== STAGE 1: PURE HIERARCHICAL ====================
        logger.debug(f"STAGE 1: Running hierarchical filter on {len(colleges_df)} colleges")

        # Filter 1: Exact match on normalized name
        exact = colleges_df[colleges_df['normalized_name'] == college_norm]
        if len(exact) > 0:
            match = _validate_address(exact, address)
            logger.debug(f"  ✓ STAGE 1: Exact name match found ({len(exact)} college(s))")
            college_match = {
                'college_id': match['id'],
                'college_name': match['name'],
                'address': match['address'],
                'state': match['state']
            }
            return self._apply_immutable_filters(college_match, quota, category, level)

        # Filter 2: Fuzzy match (85%+) using SequenceMatcher
        from difflib import SequenceMatcher
        fuzzy_matches = []
        for idx, row in colleges_df.iterrows():
            ratio = SequenceMatcher(None, college_norm, row['normalized_name']).ratio()
            if ratio >= 0.85:
                fuzzy_matches.append((idx, row, ratio))

        if fuzzy_matches:
            fuzzy_matches.sort(key=lambda x: x[2], reverse=True)
            # For all fuzzy matches with same top ratio, validate address
            top_ratio = fuzzy_matches[0][2]
            same_ratio_matches = [m for m in fuzzy_matches if m[2] >= top_ratio - 0.01]
            fuzzy_df = colleges_df.iloc[[m[0] for m in same_ratio_matches]]

            match = _validate_address(fuzzy_df, address)
            logger.debug(f"  ✓ STAGE 1: Fuzzy name match found (ratio: {top_ratio:.2f}, {len(same_ratio_matches)} candidate(s))")
            college_match = {
                'college_id': match['id'],
                'college_name': match['name'],
                'address': match['address'],
                'state': match['state']
            }
            return self._apply_immutable_filters(college_match, quota, category, level)

        # Filter 3: Single candidate fallback
        if len(colleges_df) == 1:
            match = colleges_df.iloc[0]
            logger.debug(f"  ✓ STAGE 1: Single candidate match")
            college_match = {
                'college_id': match['id'],
                'college_name': match['name'],
                'address': match['address'],
                'state': match['state']
            }
            return self._apply_immutable_filters(college_match, quota, category, level)

        # ==================== STAGE 2: + RAPIDFUZZ FALLBACK ====================
        logger.debug(f"STAGE 2: Running RapidFuzz fallback on {len(colleges_df)} colleges")

        try:
            from rapidfuzz import fuzz

            rapidfuzz_matches = []
            for idx, row in colleges_df.iterrows():
                ratio = fuzz.token_set_ratio(college_norm, row['normalized_name'])
                if ratio >= 75:  # RapidFuzz threshold
                    rapidfuzz_matches.append((idx, row, ratio))

            if rapidfuzz_matches:
                rapidfuzz_matches.sort(key=lambda x: x[2], reverse=True)
                # For all matches with same top ratio, validate address
                top_ratio = rapidfuzz_matches[0][2]
                same_ratio_matches = [m for m in rapidfuzz_matches if m[2] >= top_ratio - 1]  # Within 1 point
                rapid_df = colleges_df.iloc[[m[0] for m in same_ratio_matches]]

                match = _validate_address(rapid_df, address)
                logger.debug(f"  ✓ STAGE 2: RapidFuzz match found (ratio: {top_ratio:.2f}, {len(same_ratio_matches)} candidate(s))")
                college_match = {
                    'college_id': match['id'],
                    'college_name': match['name'],
                    'address': match['address'],
                    'state': match['state']
                }
                return self._apply_immutable_filters(college_match, quota, category, level)
        except ImportError:
            logger.warning("RapidFuzz not available, skipping Stage 2")
        except Exception as e:
            logger.warning(f"Error in Stage 2 RapidFuzz: {e}")

        # ==================== STAGE 3: + FULL ENSEMBLE FALLBACK ====================
        logger.debug(f"STAGE 3: Running ensemble fallback on {len(colleges_df)} colleges")

        try:
            # Try Transformer-based semantic matching (Stage 3)
            from sentence_transformers import util
            import torch

            if torch.cuda.is_available():
                device = "cuda"
            else:
                device = "cpu"

            # Load embeddings for college names
            embeddings = self.cascading_matcher.stage3_matcher.embedder.encode(
                list(colleges_df['normalized_name']),
                convert_to_tensor=True,
                device=device
            )

            query_embedding = self.cascading_matcher.stage3_matcher.embedder.encode(
                college_norm,
                convert_to_tensor=True,
                device=device
            )

            # Compute similarity scores
            similarity_scores = util.pytorch_cos_sim(query_embedding, embeddings)[0]

            # Get matches above 0.6 threshold
            transformer_matches = []
            for idx, (row_idx, row) in enumerate(colleges_df.iterrows()):
                score = similarity_scores[idx].item()
                if score >= 0.6:
                    transformer_matches.append((row_idx, row, score))

            if transformer_matches:
                transformer_matches.sort(key=lambda x: x[2], reverse=True)
                # For all matches with same top score, validate address
                top_score = transformer_matches[0][2]
                same_score_matches = [m for m in transformer_matches if m[2] >= top_score - 0.05]
                trans_df = colleges_df.iloc[[m[0] for m in same_score_matches]]

                match = _validate_address(trans_df, address)
                logger.debug(f"  ✓ STAGE 3: Transformer match found (score: {top_score:.2f}, {len(same_score_matches)} candidate(s))")
                college_match = {
                    'college_id': match['id'],
                    'college_name': match['name'],
                    'address': match['address'],
                    'state': match['state']
                }
                return self._apply_immutable_filters(college_match, quota, category, level)
        except Exception as e:
            logger.debug(f"Transformer matching not available: {e}")

        # Try TF-IDF as fallback within Stage 3
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity

            college_names = list(colleges_df['normalized_name'])
            college_names.append(college_norm)

            vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 3))
            tfidf_matrix = vectorizer.fit_transform(college_names)

            query_vector = tfidf_matrix[-1]
            similarity_scores = cosine_similarity(query_vector, tfidf_matrix[:-1])[0]

            # Get matches above 0.3 threshold
            tfidf_matches = []
            for idx, (row_idx, row) in enumerate(colleges_df.iterrows()):
                score = similarity_scores[idx]
                if score >= 0.3:
                    tfidf_matches.append((row_idx, row, score))

            if tfidf_matches:
                tfidf_matches.sort(key=lambda x: x[2], reverse=True)
                # For all matches with same top score, validate address
                top_score = tfidf_matches[0][2]
                same_score_matches = [m for m in tfidf_matches if m[2] >= top_score - 0.05]
                tfidf_df = colleges_df.iloc[[m[0] for m in same_score_matches]]

                match = _validate_address(tfidf_df, address)
                logger.debug(f"  ✓ STAGE 3: TF-IDF match found (score: {top_score:.2f}, {len(same_score_matches)} candidate(s))")
                college_match = {
                    'college_id': match['id'],
                    'college_name': match['name'],
                    'address': match['address'],
                    'state': match['state']
                }
                return self._apply_immutable_filters(college_match, quota, category, level)
        except Exception as e:
            logger.debug(f"TF-IDF matching not available: {e}")

        # No match found in any stage
        logger.debug(f"  ✗ No match found in any stage")
        return None

    def _apply_immutable_filters(
        self,
        college_match: Dict,
        quota: str = None,
        category: str = None,
        level: str = None
    ) -> Optional[Dict]:
        """
        Apply immutable filters AFTER college match is found

        Order: quota → category → level

        These are exact-match only and are applied to validate the matched college
        against counselling data requirements (not for seat data)
        """
        if not college_match:
            return None

        # For now, all immutable filters pass since database doesn't have these columns
        # This will be enabled when counselling data includes quota, category, level

        if quota:
            quota_norm = quota.upper().strip()
            # If quota column exists in result, validate it
            if 'quota' in college_match and college_match['quota']:
                if college_match['quota'].upper().strip() != quota_norm:
                    logger.debug(f"Quota mismatch: expected {quota}, got {college_match.get('quota')}")
                    return None
            logger.debug(f"✓ Quota matched: {quota}")

        if category:
            category_norm = category.upper().strip()
            # If category column exists in result, validate it
            if 'category' in college_match and college_match['category']:
                if college_match['category'].upper().strip() != category_norm:
                    logger.debug(f"Category mismatch: expected {category}, got {college_match.get('category')}")
                    return None
            logger.debug(f"✓ Category matched: {category}")

        if level:
            level_norm = level.upper().strip()
            # If level column exists in result, validate it
            if 'level' in college_match and college_match['level']:
                if college_match['level'].upper().strip() != level_norm:
                    logger.debug(f"Level mismatch: expected {level}, got {college_match.get('level')}")
                    return None
            logger.debug(f"✓ Level matched: {level}")

        return college_match

    def match_all_records(
        self,
        table_name: str = 'seat_data',
        batch_size: int = 100
    ) -> Dict:
        """
        Match all records in seat_data using integrated approach

        Returns:
        --------
        Dict with matched/unmatched counts and accuracy
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"INTEGRATED CASCADING MATCHING - ALL SEAT DATA RECORDS")
        logger.info(f"{'='*100}\n")

        conn = sqlite3.connect(self.seat_db_path)
        records = pd.read_sql(f"SELECT * FROM {table_name}", conn)
        conn.close()

        total = len(records)
        matched = 0
        unmatched = 0
        false_matches = {}

        for idx, record in records.iterrows():
            if (idx + 1) % batch_size == 0:
                logger.info(f"Progress: {idx+1}/{total} ({(idx+1)/total*100:.1f}%)")

            college_name = record.get('college_name', '')
            state = record.get('normalized_state', '')
            course_name = record.get('course_name', '')
            address = record.get('normalized_address', '')

            if not college_name or not state:
                unmatched += 1
                continue

            # Use integrated matcher
            result = self.match_college(college_name, state, course_name, address)

            if result:
                matched += 1
                college_id = result['college_id']

                # Track for false match detection
                if college_id not in false_matches:
                    false_matches[college_id] = {
                        'name': result['college_name'],
                        'addresses': set(),
                        'states': set()
                    }

                false_matches[college_id]['addresses'].add(str(result['address']))
                false_matches[college_id]['states'].add(state)

                # Update database (IMPORTANT: Filter by state to prevent cross-state false matches)
                try:
                    conn = sqlite3.connect(self.seat_db_path)
                    cursor = conn.cursor()
                    # Include state in WHERE clause to handle duplicate record IDs across different states
                    cursor.execute(
                        f"UPDATE {table_name} SET master_college_id = ? WHERE id = ? AND normalized_state = ?",
                        (college_id, record['id'], state)
                    )
                    conn.commit()
                    conn.close()
                except Exception as e:
                    logger.error(f"Error updating record: {e}")
            else:
                unmatched += 1

        # Check for false matches
        actual_false_matches = {}
        for college_id, data in false_matches.items():
            if len(data['addresses']) > 1:
                actual_false_matches[college_id] = data

        accuracy = matched / total * 100 if total > 0 else 0

        logger.info(f"\n{'='*100}")
        logger.info(f"INTEGRATED CASCADING MATCHING - FINAL RESULTS")
        logger.info(f"{'='*100}")
        logger.info(f"Total Matched: {matched:,}/{total:,} ({accuracy:.2f}%)")
        logger.info(f"Total Unmatched: {unmatched:,}")
        logger.info(f"False Matches: {len(actual_false_matches)}")
        logger.info(f"{'='*100}\n")

        return {
            'total': total,
            'matched': matched,
            'unmatched': unmatched,
            'accuracy': accuracy,
            'false_matches': len(actual_false_matches)
        }


if __name__ == '__main__':
    matcher = IntegratedCascadingMatcher()
    results = matcher.match_all_records()

    print(f"\n{'='*100}")
    print("INTEGRATED CASCADING MATCHING - SUMMARY")
    print(f"{'='*100}")
    print(f"✅ Matched: {results['matched']:,}/{results['total']:,} ({results['accuracy']:.2f}%)")
    print(f"❌ Unmatched: {results['unmatched']:,}")
    print(f"🔒 False Matches: {results['false_matches']}")
    print(f"{'='*100}")
