#!/usr/bin/env python3
"""
Counselling Data Matching and Linking - Enhanced Interactive Version
Adapted from match_and_link_sqlite_seat_data.py

Features:
- 4-pass college matching algorithm with DIPLOMA fallback logic
- Course normalization using standard courses + error corrections
- State mapping integration
- CATEGORY & QUOTA validation
- Interactive review of unmatched records
- Alias creation and persistence
- Comprehensive reporting
- Duplicate detection (YEAR + ROUND)
"""

import sqlite3
import pandas as pd
import numpy as np
import logging
import os
import re
import sys
import json
import yaml
from pathlib import Path
from rapidfuzz import fuzz, process
from datetime import datetime
from tqdm import tqdm
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich import print as rprint
import pickle
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import multiprocessing as mp
from functools import lru_cache, wraps
import hashlib

# Add scripts directory to path for state mapping
sys.path.append(str(Path(__file__).parent / 'scripts'))
from create_state_mapping import get_normalized_state

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/counselling_matching.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Rich console for beautiful UI
console = Console()

class CounsellingDataMatcher:
    """
    Enhanced Counselling Data Matcher with Interactive Features

    Key features:
    1. 4-pass college matching with DIPLOMA fallback logic
    2. Course normalization using standard courses + error corrections
    3. Interactive review of unmatched records
    4. Alias creation and persistence
    5. Comprehensive validation and reporting
    """

    def __init__(self, config_path='config.yaml', enable_parallel=True, num_workers=None):
        self.config = self.load_config(config_path) if Path(config_path).exists() else self._default_config()
        self.master_db_path = "data/sqlite/master_data.db"
        self.counselling_db_path = "data/sqlite/counselling_data_partitioned.db"  # CHANGED: Use partitioned DB
        self.master_data = {}
        self.state_mappings = {}
        self.aliases = {'college': [], 'course': []}
        self.standard_courses = {}
        self.course_corrections = {}

        # Parallel processing settings
        self.enable_parallel = enable_parallel
        self.num_workers = num_workers or max(1, mp.cpu_count() - 1)

        # Cache for memoization
        self._normalization_cache = {}
        self._fuzzy_match_cache = {}

    def load_config(self, config_path):
        """Load configuration from YAML file"""
        with open(config_path, 'r') as file:
            return yaml.safe_load(file)

    def _default_config(self):
        """Default configuration if config.yaml not found"""
        return {
            'normalization': {
                'to_uppercase': True,
                'handle_hyphens_dots': True,
                'remove_special_chars': True,
                'normalize_whitespace': True
            },
            'matching': {
                'thresholds': {
                    'exact': 100,
                    'high_confidence': 90,
                    'medium_confidence': 80,
                    'low_confidence': 75
                }
            },
            'course_classification': {
                'medical_patterns': ['MD', 'MS', 'DM', 'MCH', 'DIPLOMA'],
                'dental_patterns': ['MDS', 'PG DIPLOMA'],
                'dnb_patterns': ['DNB', 'DNB-']
            },
            'diploma_courses': {
                'overlapping': [
                    'DIPLOMA IN ANAESTHESIOLOGY',
                    'DIPLOMA IN OBSTETRICS AND GYNAECOLOGY',
                    'DIPLOMA IN PAEDIATRICS',
                    'DIPLOMA IN OPHTHALMOLOGY'
                ],
                'dnb_only': ['DIPLOMA IN FAMILY MEDICINE']
            },
            'validation': {
                'required_fields': ['college_institute_raw', 'course_raw', 'year', 'round'],
                'valid_categories': ['OPEN', 'OBC', 'SC', 'ST', 'EWS'],
                'valid_quotas': ['AIQ', 'DNB', 'IP', 'OP', 'MANAGEMENT']
            }
        }

    def load_master_data(self):
        """Load master colleges, courses, aliases, and standard courses from database"""
        with console.status("[bold green]Loading master data..."):
            conn = sqlite3.connect(self.master_db_path)

            # Load all colleges (medical, dental, DNB) separately for 4-pass matching
            medical_df = pd.read_sql("SELECT * FROM medical_colleges", conn)
            dental_df = pd.read_sql("SELECT * FROM dental_colleges", conn)
            dnb_df = pd.read_sql("SELECT * FROM dnb_colleges", conn)

            self.master_data['medical'] = {'colleges': medical_df.to_dict('records')}
            self.master_data['dental'] = {'colleges': dental_df.to_dict('records')}
            self.master_data['dnb'] = {'colleges': dnb_df.to_dict('records')}

            # Combined list for general use
            medical_df['type'] = 'MEDICAL'
            dental_df['type'] = 'DENTAL'
            dnb_df['type'] = 'DNB'
            all_colleges = pd.concat([medical_df, dental_df, dnb_df], ignore_index=True)
            self.master_data['colleges'] = all_colleges.to_dict('records')

            # Load courses
            courses_df = pd.read_sql("SELECT * FROM courses", conn)
            self.master_data['courses'] = {'courses': courses_df.to_dict('records')}

            # Load states, quotas, categories
            states_df = pd.read_sql("SELECT * FROM states", conn)
            quotas_df = pd.read_sql("SELECT * FROM quotas", conn)
            categories_df = pd.read_sql("SELECT * FROM categories", conn)
            self.master_data['states'] = states_df.to_dict('records')
            self.master_data['quotas'] = quotas_df.to_dict('records')
            self.master_data['categories'] = categories_df.to_dict('records')

            # Load aliases
            try:
                college_aliases_df = pd.read_sql("SELECT * FROM college_aliases", conn)
                course_aliases_df = pd.read_sql("SELECT * FROM course_aliases", conn)
                self.aliases['college'] = college_aliases_df.to_dict('records')
                self.aliases['course'] = course_aliases_df.to_dict('records')
                console.print(f"✅ Loaded {len(self.aliases['college'])} college aliases")
                console.print(f"✅ Loaded {len(self.aliases['course'])} course aliases")
            except Exception as e:
                console.print(f"[yellow]⚠️  No aliases found: {e}[/yellow]")

            # Load state mappings
            state_df = pd.read_sql("""
                SELECT raw_state, normalized_state
                FROM state_mappings
                WHERE is_verified = TRUE AND normalized_state != 'UNKNOWN'
            """, conn)
            self.state_mappings = dict(zip(state_df['raw_state'], state_df['normalized_state']))

            conn.close()

        # Load standard courses from text file
        self._load_standard_courses()

        # Display summary
        console.print("\n[bold green]Master Data Loaded:[/bold green]")
        console.print(f"  • Medical Colleges: {len(medical_df):,}")
        console.print(f"  • Dental Colleges: {len(dental_df):,}")
        console.print(f"  • DNB Colleges: {len(dnb_df):,}")
        console.print(f"  • Courses: {len(courses_df):,}")
        console.print(f"  • States: {len(states_df):,}")
        console.print(f"  • Quotas: {len(quotas_df):,}")
        console.print(f"  • Categories: {len(categories_df):,}")
        console.print(f"  • State Mappings: {len(self.state_mappings):,}")

    def _load_standard_courses(self):
        """Load standard courses and corrections from text files"""
        # Load master_courses.txt (standard course names)
        master_courses_file = Path('master_courses.txt')
        if master_courses_file.exists():
            with open(master_courses_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Store normalized version as key
                        normalized = self.normalize_text(line)
                        self.standard_courses[normalized] = line
            console.print(f"  • Standard Courses: {len(self.standard_courses):,}")

        # Load seat_data_corrections_needed.txt (course error corrections)
        corrections_file = Path('seat_data_corrections_needed.txt')
        if corrections_file.exists():
            with open(corrections_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and '→' in line:
                        incorrect, correct = line.split('→', 1)
                        incorrect = incorrect.strip()
                        correct = correct.strip()
                        self.course_corrections[self.normalize_text(incorrect)] = correct
            console.print(f"  • Course Corrections: {len(self.course_corrections):,}")

    def preprocess_college_name(self, raw_college: str) -> str:
        """
        Extract clean college name from raw string with embedded address

        Input: "POST GRADUATE INSTITUTE..., DR RML HOSPITAL, CANNAUGHT PLACE, NEW DELHI"
        Output: "POST GRADUATE INSTITUTE OF MEDICAL EDUCATION AND RESEARCH"

        Strategy:
        1. Split by comma
        2. Take first part (usually the college name)
        3. If first part is very short (< 20 chars), combine with second part
        4. Normalize the result
        """
        if pd.isna(raw_college) or raw_college == '':
            return ''

        raw_college = str(raw_college).strip()

        # Split by comma
        parts = [p.strip() for p in raw_college.split(',')]

        # If first part is very short, it might be abbreviation
        # Combine with next part
        if len(parts) > 1 and len(parts[0]) < 20:
            college_name = f"{parts[0]} {parts[1]}"
        else:
            college_name = parts[0]

        # Normalize
        college_name = self.normalize_text(college_name)

        return college_name

    @lru_cache(maxsize=10000)
    def normalize_text(self, text: str) -> str:
        """Enhanced text normalization with config support and caching"""
        if pd.isna(text) or text == '':
            return ''

        text = str(text).strip()

        # Convert to uppercase
        if self.config['normalization']['to_uppercase']:
            text = text.upper()

        # Expand common abbreviations
        abbreviations = {
            'ESI': 'EMPLOYEES STATE INSURANCE',
            'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
            'GOVT': 'GOVERNMENT',
            'PG': 'POST GRADUATE',
            'HOSP': 'HOSPITAL',
            'SSH': 'SUPER SPECIALITY HOSPITAL',
            'SDH': 'SUB DISTRICT HOSPITAL',
            'MED': 'MEDICAL',
            'COLL': 'COLLEGE',
            'INST': 'INSTITUTE',
            'UNIV': 'UNIVERSITY',
        }

        for abbrev, expansion in abbreviations.items():
            text = re.sub(r'\b' + re.escape(abbrev) + r'\b', expansion, text)

        # Handle hyphens and dots
        if self.config['normalization']['handle_hyphens_dots']:
            text = re.sub(r'(?<!\s)-(?!\s)', ' - ', text)
            text = re.sub(r'(?<!\s)\.(?!\s)', ' . ', text)

        # Remove special characters
        if self.config['normalization']['remove_special_chars']:
            text = re.sub(r'[^\w\s,()]', '', text)

        # Normalize whitespace
        if self.config['normalization']['normalize_whitespace']:
            text = re.sub(r'\s+', ' ', text).strip()

        return text

    def detect_course_type(self, course_name):
        """Detect course type with three-tier DIPLOMA classification"""
        if pd.isna(course_name) or course_name == '':
            return 'unknown'

        course_name = str(course_name).upper()

        # Check DNB patterns FIRST (most specific)
        for pattern in self.config['course_classification']['dnb_patterns']:
            if course_name.startswith(pattern):
                return 'dnb'

        # Check PG DIPLOMA patterns (dental courses)
        if course_name.startswith('PG DIPLOMA'):
            return 'dental'

        # Handle DIPLOMA courses with three-tier classification
        if 'DIPLOMA' in course_name:
            # Check if it's DNB-only course
            if course_name in self.config['diploma_courses']['dnb_only']:
                return 'dnb'
            # Check if it's overlapping course
            elif course_name in self.config['diploma_courses']['overlapping']:
                return 'diploma'  # Triggers MEDICAL→DNB fallback
            else:
                return 'medical'  # All other DIPLOMA courses

        # Check dental patterns
        for pattern in self.config['course_classification']['dental_patterns']:
            if course_name.startswith(pattern):
                return 'dental'

        # Check medical patterns
        for pattern in self.config['course_classification']['medical_patterns']:
            if course_name.startswith(pattern):
                return 'medical'

        return 'unknown'

    def apply_aliases(self, text, alias_type):
        """Apply aliases to text"""
        aliases = self.aliases.get(alias_type, [])

        for alias in aliases:
            if alias['alias_name'].upper() == text.upper():
                return alias['original_name']

        return text

    def normalize_state(self, raw_state: str) -> str:
        """Normalize state using mapping table"""
        if pd.isna(raw_state) or raw_state == '':
            return None

        raw_state_str = str(raw_state).strip()

        # Lookup in mappings
        if raw_state_str in self.state_mappings:
            return self.state_mappings[raw_state_str]

        # Fallback: try to normalize using function
        normalized = get_normalized_state(raw_state_str, self.master_db_path)

        return normalized

    def match_college(self, record: dict) -> dict:
        """
        Enhanced 4-pass college matching with DIPLOMA fallback logic

        Pass 1: State-based filtering
        Pass 2: Course type detection & filtering
        Pass 3: College name matching (hierarchical strategies)
        Pass 4: Address-based disambiguation

        Returns dict with college_id, college_name, confidence, method, is_matched
        """
        raw_college = record['college_institute_raw']
        raw_state = record.get('state_raw', '')
        raw_course = record.get('course_raw', '')
        quota = record.get('quota', '')

        # Preprocess
        college_name = self.preprocess_college_name(raw_college)
        college_name = self.apply_aliases(college_name, 'college')
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_state(raw_state)
        normalized_course = self.normalize_text(raw_course)

        if not normalized_college:
            return self._no_match_result('Empty college name')

        # Detect course type
        course_type = self.detect_course_type(normalized_course)

        # Handle overlapping DIPLOMA courses (4 specific courses)
        if course_type == 'diploma' and normalized_course in [self.normalize_text(c) for c in self.config['diploma_courses']['overlapping']]:
            result = self._match_overlapping_diploma(normalized_college, normalized_state, raw_college, normalized_course)
            return self._format_match_result(result)

        # Handle regular courses
        result = self._match_regular_course(normalized_college, normalized_state, course_type, raw_college, normalized_course)
        return self._format_match_result(result)

    def _match_overlapping_diploma(self, college_name, state, address, course_name):
        """Match overlapping DIPLOMA courses with MEDICAL→DNB fallback"""
        # Try MEDICAL first
        medical_candidates = self._filter_by_state(self.master_data['medical']['colleges'], state)
        medical_match = self._pass3_college_name_matching(college_name, medical_candidates)

        if medical_match and self._validate_course_stream(medical_match['candidate'], 'medical', course_name):
            return medical_match

        # Try DNB fallback
        dnb_candidates = self._filter_by_state(self.master_data['dnb']['colleges'], state)
        dnb_match = self._pass3_college_name_matching(college_name, dnb_candidates)

        if dnb_match and self._validate_course_stream(dnb_match['candidate'], 'dnb', course_name):
            return dnb_match

        return None

    def _match_regular_course(self, college_name, state, course_type, address, course_name):
        """Match regular courses with standard 4-pass mechanism"""
        if course_type not in self.master_data:
            return None

        # PASS 1: State-based filtering
        candidates = self._filter_by_state(self.master_data[course_type]['colleges'], state)

        if not candidates:
            candidates = self.master_data[course_type]['colleges']

        # PASS 3: College name matching (returns all matches)
        matches = self._pass3_college_name_matching_all(college_name, candidates)

        if not matches:
            return None

        # Single match - return directly
        if len(matches) == 1:
            match = matches[0]
            if self._validate_course_stream(match['candidate'], course_type, course_name):
                return match
            return None

        # PASS 4: Address-based disambiguation for multiple matches
        if len(matches) > 1 and address:
            disambiguated = self._pass4_address_disambiguation(matches, address, college_name)
            if disambiguated and self._validate_course_stream(disambiguated['candidate'], course_type, course_name):
                return disambiguated

        # Return best match if no disambiguation
        best_match = max(matches, key=lambda x: x['score'])
        if self._validate_course_stream(best_match['candidate'], course_type, course_name):
            return best_match

        return None

    def _pass3_college_name_matching_all(self, college_name, candidates):
        """Return all matches (for address disambiguation)"""
        if not candidates:
            return []

        matches = []

        # Run all strategies and collect matches
        for candidate in candidates:
            # Exact match
            if college_name == self.normalize_text(candidate['name']):
                matches.append({'candidate': candidate, 'score': 100, 'method': 'exact_match'})
                continue

            # Primary name match
            primary_name, secondary_name = self.extract_primary_name(candidate['name'])
            normalized_primary = self.normalize_text(primary_name)

            if college_name == normalized_primary:
                matches.append({'candidate': candidate, 'score': 98, 'method': 'primary_name_match'})
                continue

            # Fuzzy match
            similarity = fuzz.ratio(college_name, self.normalize_text(candidate['name']))
            if similarity >= 75:
                matches.append({
                    'candidate': candidate,
                    'score': similarity,
                    'method': 'fuzzy_match'
                })

        return matches

    def _pass4_address_disambiguation(self, college_matches, normalized_address, normalized_college):
        """Enhanced address-based disambiguation for multiple matches"""
        if not normalized_address or len(college_matches) <= 1:
            return None

        best_match = None
        best_score = 0.0

        # Extract keywords from counselling data address
        seat_keywords = self._extract_address_keywords(normalized_address)

        # Check if generic hospital name
        is_generic_hospital = normalized_college in [
            'DISTRICT HOSPITAL', 'GENERAL HOSPITAL', 'AREA HOSPITAL',
            'GOVERNMENT HOSPITAL', 'CIVIL HOSPITAL'
        ]

        for match in college_matches:
            candidate = match['candidate']
            candidate_address = self.normalize_text(candidate.get('address', ''))

            if not candidate_address:
                continue

            # Extract keywords from master data address
            master_keywords = self._extract_address_keywords(candidate_address)

            # Calculate keyword overlap score
            keyword_score = self._calculate_keyword_overlap(seat_keywords, master_keywords)

            # Calculate address similarity (fallback)
            address_similarity = fuzz.ratio(normalized_address, candidate_address) / 100

            # Enhanced scoring for generic hospitals
            if is_generic_hospital:
                # Prioritize address matching more heavily
                address_score = keyword_score if keyword_score > 0 else address_similarity
                combined_score = (match['score'] / 100 * 0.4) + (address_score * 0.6)

                # Bonus for exact location match
                if self._has_exact_location_match(normalized_address, candidate_address):
                    combined_score += 0.1
            else:
                # Standard scoring
                address_score = keyword_score if keyword_score > 0 else address_similarity
                combined_score = (match['score'] / 100 * 0.7) + (address_score * 0.3)

            if combined_score > best_score:
                method_suffix = "_with_address_keywords" if keyword_score > 0 else "_with_address"
                if is_generic_hospital:
                    method_suffix += "_generic_hospital"

                best_match = {
                    'candidate': candidate,
                    'score': combined_score * 100,
                    'method': f"{match['method']}{method_suffix}"
                }
                best_score = combined_score

        return best_match

    def _extract_address_keywords(self, address):
        """Extract location-specific keywords from address"""
        if not address:
            return set()

        # Common location keywords
        location_indicators = [
            'DISTRICT', 'CITY', 'TALUK', 'TEHSIL', 'BLOCK', 'CIRCLE',
            'DIVISION', 'AREA', 'ZONE', 'SECTOR', 'REGION', 'NAGAR'
        ]

        keywords = set()
        words = address.split()

        for i, word in enumerate(words):
            if word in location_indicators and i + 1 < len(words):
                # Get next word as location name
                keywords.add(words[i + 1])
            elif len(word) > 3:  # Avoid small words
                keywords.add(word)

        return keywords

    def _calculate_keyword_overlap(self, keywords1, keywords2):
        """Calculate Jaccard similarity between keyword sets"""
        if not keywords1 or not keywords2:
            return 0.0

        intersection = keywords1.intersection(keywords2)
        union = keywords1.union(keywords2)

        return len(intersection) / len(union) if union else 0.0

    def _has_exact_location_match(self, address1, address2):
        """Check for exact district/city matches"""
        if not address1 or not address2:
            return False

        location_keywords1 = self._extract_location_keywords(address1)
        location_keywords2 = self._extract_location_keywords(address2)

        return len(location_keywords1.intersection(location_keywords2)) > 0

    def _extract_location_keywords(self, address):
        """Extract specific location keywords (districts, cities)"""
        if not address:
            return set()

        # Patterns that indicate a location
        location_patterns = [
            r'(\w+)\s+DISTRICT',
            r'(\w+)\s+CITY',
            r'(\w+)\s+TALUK',
            r'(\w+)\s+TEHSIL'
        ]

        keywords = set()
        for pattern in location_patterns:
            matches = re.findall(pattern, address)
            keywords.update(matches)

        return keywords

    def _filter_by_state(self, candidates, state):
        """Filter candidates by state"""
        if not state:
            return candidates

        filtered = [c for c in candidates if self.normalize_state(c.get('state', '')) == state]
        return filtered if filtered else candidates

    def extract_primary_name(self, college_name):
        """Extract primary name from college name with secondary name in brackets"""
        if '(' in college_name and ')' in college_name:
            primary = college_name.split('(')[0].strip()

            # For JOINT ACCREDITATION PROGRAMME colleges
            if 'JOINT ACCREDITATION PROGRAMME' in college_name:
                first_paren = college_name.find('(')
                second_paren = college_name.find('(', first_paren + 1)
                if second_paren != -1:
                    secondary = college_name[first_paren + 1:second_paren - 1].strip()
                    return primary, secondary

            # Extract secondary name (inside first brackets)
            secondary_start = college_name.find('(') + 1
            secondary_end = college_name.find(')', secondary_start)
            if secondary_end != -1:
                secondary = college_name[secondary_start:secondary_end].strip()
                return primary, secondary

        return college_name, None

    def _pass3_college_name_matching(self, college_name, candidates):
        """Advanced hierarchical college name matching with 7 strategies"""
        if not candidates:
            return None

        matches = []

        # Strategy 1: Exact match (highest priority - 100%)
        for candidate in candidates:
            if college_name == self.normalize_text(candidate['name']):
                return {'candidate': candidate, 'score': 100, 'method': 'exact_match'}

        # Strategy 1.5: Primary name match (98%)
        for candidate in candidates:
            primary_name, secondary_name = self.extract_primary_name(candidate['name'])
            normalized_primary = self.normalize_text(primary_name)

            if college_name == normalized_primary:
                return {'candidate': candidate, 'score': 98, 'method': 'primary_name_match'}

            # Special case: JOINT ACCREDITATION PROGRAMME
            if 'JOINT ACCREDITATION PROGRAMME' in college_name and normalized_primary in college_name:
                return {'candidate': candidate, 'score': 95, 'method': 'joint_accreditation_primary_match'}

        # Strategy 2: Fuzzy match (90%+)
        for candidate in candidates:
            similarity = fuzz.ratio(college_name, self.normalize_text(candidate['name']))
            if similarity >= self.config['matching']['thresholds']['high_confidence']:
                matches.append({
                    'candidate': candidate,
                    'score': similarity,
                    'method': 'fuzzy_high'
                })

        if matches:
            return max(matches, key=lambda x: x['score'])

        # Strategy 3: Prefix matching (for truncated names)
        for candidate in candidates:
            candidate_name = self.normalize_text(candidate['name'])
            if candidate_name.startswith(college_name) and len(college_name) >= 10:
                coverage_ratio = len(college_name) / len(candidate_name)
                score = min(60 + (coverage_ratio * 30), 90)  # 60-90%
                matches.append({
                    'candidate': candidate,
                    'score': score,
                    'method': 'prefix_match'
                })

        # Strategy 4: Substring matching
        for candidate in candidates:
            candidate_name = self.normalize_text(candidate['name'])
            if college_name in candidate_name or candidate_name in college_name:
                similarity = fuzz.ratio(college_name, candidate_name)
                if similarity >= 75:
                    matches.append({
                        'candidate': candidate,
                        'score': similarity,
                        'method': 'substring_match'
                    })

        # Strategy 5: Partial word matching (Jaccard similarity)
        for candidate in candidates:
            candidate_name = self.normalize_text(candidate['name'])
            words1 = set(college_name.split())
            words2 = set(candidate_name.split())

            if words1 and words2:
                intersection = words1.intersection(words2)
                union = words1.union(words2)
                similarity = len(intersection) / len(union) * 100

                if similarity >= 70:
                    matches.append({
                        'candidate': candidate,
                        'score': similarity,
                        'method': 'partial_word_match'
                    })

        # Strategy 6: Secondary name matching (for colleges with brackets)
        for candidate in candidates:
            primary_name, secondary_name = self.extract_primary_name(candidate['name'])
            if secondary_name:
                # Exact secondary match
                if college_name == self.normalize_text(secondary_name):
                    matches.append({
                        'candidate': candidate,
                        'score': 90,
                        'method': 'secondary_name_exact_match'
                    })
                else:
                    # Fuzzy secondary match
                    similarity = fuzz.ratio(college_name, self.normalize_text(secondary_name))
                    if similarity >= 85:
                        matches.append({
                            'candidate': candidate,
                            'score': similarity * 0.85,  # Lower score for secondary
                            'method': 'secondary_name_fuzzy_match'
                        })

        # Return best match above threshold
        if matches:
            best_match = max(matches, key=lambda x: x['score'])
            if best_match['score'] >= self.config['matching']['thresholds']['low_confidence']:
                if best_match['score'] < 85:
                    best_match['needs_review'] = True
                return best_match

        return None

    def _validate_course_stream(self, candidate, course_type, course_name):
        """Validate if college supports the course stream"""
        # This is a simplified validation - you can enhance based on your data structure
        return True

    def _format_match_result(self, result):
        """Format match result into standard dict"""
        if not result:
            return self._no_match_result('No match found')

        return {
            'college_id': result['candidate']['id'],
            'college_name': result['candidate']['name'],
            'confidence': result['score'] / 100.0,
            'method': result['method'],
            'is_matched': True,
            'needs_manual_review': result.get('needs_review', False)
        }

    def _verify_address_match(self, raw_college: str, master_address: str) -> bool:
        """Verify that addresses have common keywords"""
        if not master_address:
            return False

        raw_words = set(self.normalize_text(raw_college).split())
        master_words = set(self.normalize_text(master_address).split())

        # Check if at least 3 words overlap
        common_words = raw_words & master_words

        return len(common_words) >= 3

    def _no_match_result(self, reason: str) -> dict:
        """Return no-match result"""
        return {
            'college_id': None,
            'college_name': None,
            'confidence': 0.0,
            'method': None,
            'is_matched': False,
            'reason': reason
        }

    def match_course(self, raw_course: str) -> dict:
        """
        Enhanced course matching with normalization and error corrections

        Steps:
        1. Apply error corrections from seat_data_corrections_needed.txt
        2. Try exact match with standard courses
        3. Try fuzzy match with master courses
        4. Apply aliases if available

        Returns dict with course_id, course_name, confidence, method, is_matched
        """
        if pd.isna(raw_course) or raw_course == '':
            return self._no_match_course_result('Empty course name')

        # Apply aliases
        course_name = self.apply_aliases(raw_course, 'course')
        course_normalized = self.normalize_text(course_name)

        # Step 1: Apply error corrections
        if course_normalized in self.course_corrections:
            corrected = self.course_corrections[course_normalized]
            console.print(f"[yellow]📝 Corrected: {raw_course} → {corrected}[/yellow]")
            course_normalized = self.normalize_text(corrected)

        # Step 2: Try exact match with standard courses
        if course_normalized in self.standard_courses:
            standard_name = self.standard_courses[course_normalized]
            # Find in master courses
            for course in self.master_data['courses']['courses']:
                if self.normalize_text(course['name']) == course_normalized:
                    return {
                        'course_id': course['id'],
                        'course_name': course['name'],
                        'confidence': 1.0,
                        'method': 'exact_match_standard',
                        'is_matched': True
                    }

        # Step 3: Try exact match with master courses
        for course in self.master_data['courses']['courses']:
            master_normalized = self.normalize_text(course['name'])

            if course_normalized == master_normalized:
                return {
                    'course_id': course['id'],
                    'course_name': course['name'],
                    'confidence': 1.0,
                    'method': 'exact_match',
                    'is_matched': True
                }

        # Step 4: Try fuzzy match (high threshold - 95% for courses)
        match_result = process.extractOne(
            course_normalized,
            [self.normalize_text(c['name']) for c in self.master_data['courses']['courses']],
            scorer=fuzz.ratio
        )

        if match_result and match_result[1] >= 95:
            matched_course = self.master_data['courses']['courses'][match_result[2]]
            return {
                'course_id': matched_course['id'],
                'course_name': matched_course['name'],
                'confidence': match_result[1] / 100.0,
                'method': 'fuzzy_high',
                'is_matched': True
            }

        # Step 5: Medium confidence match (85-94%)
        if match_result and match_result[1] >= 85:
            matched_course = self.master_data['courses']['courses'][match_result[2]]
            return {
                'course_id': matched_course['id'],
                'course_name': matched_course['name'],
                'confidence': match_result[1] / 100.0,
                'method': 'fuzzy_medium',
                'is_matched': True,
                'needs_manual_review': True
            }

        return self._no_match_course_result(f'No match above 85% threshold. Best: {match_result[1] if match_result else 0}%')

    def _no_match_course_result(self, reason: str) -> dict:
        """Return no-match result for course"""
        return {
            'course_id': None,
            'course_name': None,
            'confidence': 0.0,
            'method': None,
            'is_matched': False,
            'reason': reason
        }

    def match_state(self, raw_state: str) -> dict:
        """
        Match state to master states table

        Returns dict with state_id, state_name, confidence, method, is_matched
        """
        if pd.isna(raw_state) or raw_state == '':
            return {'state_id': None, 'state_name': None, 'confidence': 0.0, 'method': None, 'is_matched': False}

        # Normalize state
        normalized_state = self.normalize_state(raw_state)

        if not normalized_state or normalized_state == 'UNKNOWN':
            return {'state_id': None, 'state_name': None, 'confidence': 0.0, 'method': 'no_match', 'is_matched': False}

        # Try exact match with normalized name
        for state in self.master_data.get('states', []):
            if self.normalize_text(state['normalized_name']) == self.normalize_text(normalized_state):
                return {
                    'state_id': state['id'],
                    'state_name': state['name'],
                    'confidence': 1.0,
                    'method': 'exact_match',
                    'is_matched': True
                }

        return {'state_id': None, 'state_name': None, 'confidence': 0.0, 'method': 'no_match', 'is_matched': False}

    def match_quota(self, raw_quota: str) -> dict:
        """
        Match quota to master quotas table

        Returns dict with quota_id, quota_name, confidence, method, is_matched
        """
        if pd.isna(raw_quota) or raw_quota == '':
            return {'quota_id': None, 'quota_name': None, 'confidence': 0.0, 'method': None, 'is_matched': False}

        quota_normalized = self.normalize_text(raw_quota)

        # Try exact match
        for quota in self.master_data.get('quotas', []):
            if self.normalize_text(quota['normalized_name']) == quota_normalized:
                return {
                    'quota_id': quota['id'],
                    'quota_name': quota['name'],
                    'confidence': 1.0,
                    'method': 'exact_match',
                    'is_matched': True
                }

        # Try partial match - prioritize starts-with matches
        # Example: "STATE" matches "STATE QUOTA", "ALL INDIA" matches "ALL INDIA QUOTA"
        best_match = None
        best_score = 0

        for quota in self.master_data.get('quotas', []):
            master_norm = self.normalize_text(quota['normalized_name'])

            # Exact match at start (highest priority) - "STATE" matches "STATE QUOTA"
            if master_norm.startswith(quota_normalized + ' '):
                score = 0.95
                if best_score < score:
                    best_match = quota
                    best_score = score

            # Exact match of full normalized name
            elif master_norm == quota_normalized:
                return {
                    'quota_id': quota['id'],
                    'quota_name': quota['name'],
                    'confidence': 1.0,
                    'method': 'exact_match',
                    'is_matched': True
                }

        # Return best partial match if found
        if best_match:
            return {
                'quota_id': best_match['id'],
                'quota_name': best_match['name'],
                'confidence': best_score,
                'method': 'partial_match',
                'is_matched': True
            }

        # Try fuzzy match (85%+) - lowered threshold
        quota_names = [self.normalize_text(q['normalized_name']) for q in self.master_data.get('quotas', [])]
        if quota_names:
            match_result = process.extractOne(quota_normalized, quota_names, scorer=fuzz.ratio)

            if match_result and match_result[1] >= 85:
                matched_quota = self.master_data['quotas'][match_result[2]]
                return {
                    'quota_id': matched_quota['id'],
                    'quota_name': matched_quota['name'],
                    'confidence': match_result[1] / 100.0,
                    'method': 'fuzzy_match',
                    'is_matched': True
                }

        return {'quota_id': None, 'quota_name': None, 'confidence': 0.0, 'method': 'no_match', 'is_matched': False}

    def match_category(self, raw_category: str) -> dict:
        """
        Match category to master categories table

        Returns dict with category_id, category_name, confidence, method, is_matched
        """
        if pd.isna(raw_category) or raw_category == '':
            return {'category_id': None, 'category_name': None, 'confidence': 0.0, 'method': None, 'is_matched': False}

        category_normalized = self.normalize_text(raw_category)

        # Try exact match
        for category in self.master_data.get('categories', []):
            if self.normalize_text(category['normalized_name']) == category_normalized:
                return {
                    'category_id': category['id'],
                    'category_name': category['name'],
                    'confidence': 1.0,
                    'method': 'exact_match',
                    'is_matched': True
                }

        # Try fuzzy match (90%+)
        category_names = [self.normalize_text(c['normalized_name']) for c in self.master_data.get('categories', [])]
        if category_names:
            match_result = process.extractOne(category_normalized, category_names, scorer=fuzz.ratio)

            if match_result and match_result[1] >= 90:
                matched_category = self.master_data['categories'][match_result[2]]
                return {
                    'category_id': matched_category['id'],
                    'category_name': matched_category['name'],
                    'confidence': match_result[1] / 100.0,
                    'method': 'fuzzy_match',
                    'is_matched': True
                }

        return {'category_id': None, 'category_name': None, 'confidence': 0.0, 'method': 'no_match', 'is_matched': False}

    def detect_partition_from_filename(self, excel_path: str) -> dict:
        """
        Auto-detect partition key from filename

        Examples:
        - AIQ-PG-2024.xlsx → {source: AIQ, level: PG, year: 2024, partition_key: AIQ-PG-2024}
        - KEA-DEN-2023.xlsx → {source: KEA, level: DEN, year: 2023, partition_key: KEA-DEN-2023}
        """
        filename = Path(excel_path).stem  # Remove .xlsx extension
        parts = filename.split('-')

        if len(parts) >= 3:
            source = parts[0].upper()
            level = parts[1].upper()
            year = int(parts[2])
            partition_key = f"{source}-{level}-{year}"

            return {
                'source': source,
                'level': level,
                'year': year,
                'partition_key': partition_key,
                'filename': Path(excel_path).name
            }
        else:
            raise ValueError(f"Filename '{filename}' doesn't match expected pattern: SOURCE-LEVEL-YEAR")

    def normalize_round(self, round_raw: str) -> int:
        """
        Normalize round to integer

        Examples:
        - AIQ_PG_R1 → 1
        - Round 2 → 2
        - R3 → 3
        """
        if pd.isna(round_raw):
            return 1  # Default to round 1

        round_str = str(round_raw).upper()

        # Extract number from string
        import re
        match = re.search(r'(\d+)', round_str)
        if match:
            return int(match.group(1))

        return 1  # Default

    def clear_sample_data(self):
        """Clear sample/test data from database"""
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()

        # Delete sample partition
        cursor.execute("DELETE FROM counselling_records WHERE partition_key LIKE 'SAMPLE%'")
        cursor.execute("DELETE FROM partition_metadata WHERE partition_key LIKE 'SAMPLE%'")

        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()

        if deleted_count > 0:
            console.print(f"[yellow]🗑️  Cleared {deleted_count} sample records[/yellow]")

    def import_excel_to_partitioned_db(self, excel_path: str, partition_info: dict = None):
        """
        Import Excel file to partitioned SQLite database

        Args:
            excel_path: Path to Excel file
            partition_info: Optional partition info (auto-detected if None)
        """
        # Auto-detect partition if not provided
        if partition_info is None:
            partition_info = self.detect_partition_from_filename(excel_path)

        partition_key = partition_info['partition_key']
        source = partition_info['source']
        level = partition_info['level']
        year = partition_info['year']

        console.print(f"\n[bold cyan]📥 Importing {partition_key}[/bold cyan]")
        console.print(f"   File: {partition_info['filename']}")

        # Read Excel
        df = pd.read_excel(excel_path)
        total_records = len(df)

        # Handle column name variations
        if 'COLLEGE_INSTITUTE' in df.columns:
            df = df.rename(columns={'COLLEGE_INSTITUTE': 'COLLEGE/INSTITUTE'})

        console.print(f"   Records: {total_records:,}")

        # Create database connection
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()

        # Check if partition already exists
        existing = cursor.execute(
            "SELECT total_records FROM partition_metadata WHERE partition_key = ?",
            (partition_key,)
        ).fetchone()

        if existing:
            console.print(f"   [yellow]⚠️  Partition exists with {existing[0]:,} records - will replace[/yellow]")
            # Delete existing records
            cursor.execute("DELETE FROM counselling_records WHERE partition_key = ?", (partition_key,))
            cursor.execute("DELETE FROM partition_metadata WHERE partition_key = ?", (partition_key,))

        # Prepare data for insertion
        records = []
        for idx, row in df.iterrows():
            # Generate unique ID (include row index to ensure uniqueness even for duplicates)
            rank = row['ALL_INDIA_RANK']
            round_raw = row['ROUND']
            round_norm = self.normalize_round(round_raw)

            # Use row index to ensure absolute uniqueness
            record_id = f"{partition_key}-{rank}-{round_norm}-{idx}"

            # Prepare record
            record = {
                'id': record_id,
                'all_india_rank': rank,
                'quota': row['QUOTA'],
                'college_institute_raw': row['COLLEGE/INSTITUTE'],
                'state_raw': row.get('STATE', ''),
                'course_raw': row['COURSE'],
                'category': row['CATEGORY'],
                'round_raw': round_raw,
                'year': row['YEAR'],
                'college_institute_normalized': self.preprocess_college_name(row['COLLEGE/INSTITUTE']),
                'state_normalized': self.normalize_state(row.get('STATE', '')),
                'course_normalized': self.normalize_text(row['COURSE']),
                'source_normalized': source,
                'level_normalized': level,
                'round_normalized': round_norm,
                'partition_key': partition_key,
                'is_matched': False,
                'needs_manual_review': False
            }

            records.append(record)

        # Batch insert
        df_insert = pd.DataFrame(records)
        df_insert.to_sql('counselling_records', conn, if_exists='append', index=False)

        # Update partition metadata
        cursor.execute("""
            INSERT INTO partition_metadata
            (partition_key, source, year, level, total_records, source_file)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (partition_key, source, year, level, total_records, partition_info['filename']))

        conn.commit()
        conn.close()

        console.print(f"   [green]✅ Imported {total_records:,} records to partition {partition_key}[/green]")

        return total_records

    def batch_import_files(self, excel_files: list):
        """
        Batch import multiple Excel files

        Args:
            excel_files: List of Excel file paths
        """
        console.print(Panel.fit(
            f"[bold cyan]📦 BATCH IMPORT[/bold cyan]\n"
            f"Files to import: {len(excel_files)}",
            border_style="cyan"
        ))

        results = []
        total_imported = 0

        for excel_path in excel_files:
            try:
                partition_info = self.detect_partition_from_filename(excel_path)
                count = self.import_excel_to_partitioned_db(excel_path, partition_info)
                results.append({
                    'file': Path(excel_path).name,
                    'partition': partition_info['partition_key'],
                    'records': count,
                    'status': 'success'
                })
                total_imported += count
            except Exception as e:
                console.print(f"[red]❌ Error importing {Path(excel_path).name}: {e}[/red]")
                results.append({
                    'file': Path(excel_path).name,
                    'partition': 'N/A',
                    'records': 0,
                    'status': f'error: {str(e)}'
                })

        # Display summary
        table = Table(title="Batch Import Summary")
        table.add_column("File", style="cyan")
        table.add_column("Partition", style="yellow")
        table.add_column("Records", justify="right", style="green")
        table.add_column("Status", style="white")

        for result in results:
            status_style = "green" if result['status'] == 'success' else "red"
            table.add_row(
                result['file'],
                result['partition'],
                f"{result['records']:,}",
                f"[{status_style}]{result['status']}[/{status_style}]"
            )

        console.print(table)
        console.print(f"\n[bold green]📊 Total imported: {total_imported:,} records across {len([r for r in results if r['status'] == 'success'])} partitions[/bold green]\n")

        return results

    def import_excel_to_db(self, excel_path: str):
        """
        Import Excel file to SQLite database
        Creates aiq_records table with proper schema
        """
        logger.info(f"Importing Excel: {excel_path}")

        # Read Excel
        df = pd.read_excel(excel_path)

        logger.info(f"  Total records: {len(df):,}")

        # Create database connection
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()

        # Create table (if not exists - schema from your existing AIQ_counselling_data.db)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS aiq_records (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,

                -- Raw data from Excel
                all_india_rank INTEGER NOT NULL,
                quota TEXT NOT NULL,
                college_institute_raw TEXT NOT NULL,
                state_raw TEXT,
                course_raw TEXT NOT NULL,
                category TEXT NOT NULL,
                round TEXT NOT NULL,
                year INTEGER NOT NULL,

                -- Normalized data
                college_institute_normalized TEXT,
                state_normalized TEXT,
                course_normalized TEXT,

                -- Linked master data IDs
                master_college_id TEXT,
                master_course_id TEXT,

                -- Match metadata
                college_match_score REAL,
                college_match_method TEXT,
                course_match_score REAL,
                course_match_method TEXT,

                -- Status flags
                is_matched BOOLEAN DEFAULT FALSE,
                needs_manual_review BOOLEAN DEFAULT FALSE,

                -- Audit
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                -- Foreign keys (will be validated later)
                FOREIGN KEY (master_college_id) REFERENCES colleges(id),
                FOREIGN KEY (master_course_id) REFERENCES courses(id)
            )
        """)

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_rank ON aiq_records(all_india_rank)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_year ON aiq_records(year)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_round ON aiq_records(round)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_quota ON aiq_records(quota)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_category ON aiq_records(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_college ON aiq_records(master_college_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_course ON aiq_records(master_course_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_matched ON aiq_records(is_matched)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aiq_records_review ON aiq_records(needs_manual_review)")

        conn.commit()

        # Insert records (raw data only, matching will be done separately)
        session_id = f"AIQ_{df['YEAR'].iloc[0]}"

        # Prepare data for insertion
        df_prepared = pd.DataFrame()
        df_prepared['id'] = df['ALL_INDIA_RANK'].astype(str) + '_' + df['ROUND'] + '_' + df['YEAR'].astype(str)
        df_prepared['session_id'] = session_id
        df_prepared['all_india_rank'] = df['ALL_INDIA_RANK']
        df_prepared['quota'] = df['QUOTA']
        df_prepared['college_institute_raw'] = df['COLLEGE/INSTITUTE']
        df_prepared['state_raw'] = df['STATE']
        df_prepared['course_raw'] = df['COURSE']
        df_prepared['category'] = df['CATEGORY']
        df_prepared['round'] = df['ROUND']
        df_prepared['year'] = df['YEAR']
        df_prepared['college_institute_normalized'] = df['COLLEGE/INSTITUTE'].apply(self.preprocess_college_name)
        df_prepared['state_normalized'] = df['STATE'].apply(self.normalize_state)
        df_prepared['course_normalized'] = df['COURSE'].apply(self.normalize_text)

        # Batch insert (replace if exists to avoid duplicates during re-runs)
        df_prepared.to_sql('aiq_records', conn, if_exists='replace', index=False)

        conn.close()

        logger.info(f"✅ Imported {len(df):,} records to database")

        return len(df)

    def run_matching_partitioned(self, partition_key: str = None):
        """
        Run matching algorithm on partitioned database

        Args:
            partition_key: Optional - match specific partition only. If None, matches all unmatched records.
        """
        logger.info("Running matching algorithm on partitioned database...")

        conn = sqlite3.connect(self.counselling_db_path)

        # Get unmatched records
        if partition_key:
            query = """
                SELECT * FROM counselling_records
                WHERE partition_key = ? AND (is_matched = FALSE OR is_matched IS NULL)
            """
            df = pd.read_sql(query, conn, params=(partition_key,))
            console.print(f"[cyan]🎯 Matching partition: {partition_key}[/cyan]")
        else:
            query = """
                SELECT * FROM counselling_records
                WHERE is_matched = FALSE OR is_matched IS NULL
            """
            df = pd.read_sql(query, conn)
            console.print("[cyan]🎯 Matching all unmatched records[/cyan]")

        logger.info(f"Processing {len(df):,} unmatched records")

        if len(df) == 0:
            console.print("[yellow]No unmatched records found[/yellow]")
            return {'total': 0, 'matched': 0, 'needs_review': 0, 'unmatched': 0}

        conn = sqlite3.connect(self.counselling_db_path)

        matched_count = 0
        needs_review_count = 0
        unmatched_count = 0

        # Process in batches with progress bar
        for idx, row in tqdm(df.iterrows(), total=len(df), desc="Matching"):
            # Match college
            college_match = self.match_college(row)

            # Match course
            course_match = self.match_course(row['course_raw'])

            # Match state, quota, category
            state_match = self.match_state(row.get('state_raw', ''))
            quota_match = self.match_quota(row.get('quota', ''))
            category_match = self.match_category(row.get('category', ''))

            # Determine overall status
            is_matched = college_match['is_matched'] and course_match['is_matched']
            needs_review = college_match.get('needs_manual_review', False) or course_match.get('needs_manual_review', False)

            # Update record
            conn.execute("""
                UPDATE counselling_records
                SET
                    master_college_id = ?,
                    master_course_id = ?,
                    master_state_id = ?,
                    master_quota_id = ?,
                    master_category_id = ?,
                    college_match_score = ?,
                    college_match_method = ?,
                    course_match_score = ?,
                    course_match_method = ?,
                    is_matched = ?,
                    needs_manual_review = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                college_match.get('college_id'),
                course_match.get('course_id'),
                state_match.get('state_id'),
                quota_match.get('quota_id'),
                category_match.get('category_id'),
                college_match.get('confidence'),
                college_match.get('method'),
                course_match.get('confidence'),
                course_match.get('method'),
                is_matched,
                needs_review,
                row['id']
            ))

            # Track statistics
            if is_matched:
                matched_count += 1
                if needs_review:
                    needs_review_count += 1
            else:
                unmatched_count += 1

        conn.commit()

        # Update partition metadata statistics
        if partition_key:
            conn.execute("""
                UPDATE partition_metadata
                SET
                    matched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND is_matched = TRUE),
                    unmatched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND (is_matched = FALSE OR is_matched IS NULL)),
                    needs_review_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND needs_manual_review = TRUE),
                    is_fully_matched = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND (is_matched = FALSE OR is_matched IS NULL)) = 0,
                    last_updated = CURRENT_TIMESTAMP
                WHERE partition_key = ?
            """, (partition_key, partition_key, partition_key, partition_key, partition_key))
        else:
            # Update all partitions
            conn.execute("""
                UPDATE partition_metadata
                SET
                    matched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND is_matched = TRUE),
                    unmatched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND (is_matched = FALSE OR is_matched IS NULL)),
                    needs_review_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND needs_manual_review = TRUE),
                    is_fully_matched = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND (is_matched = FALSE OR is_matched IS NULL)) = 0,
                    last_updated = CURRENT_TIMESTAMP
            """)

        conn.commit()
        conn.close()

        # Print statistics
        total = len(df)
        console.print("\n" + "="*60)
        console.print("[bold green]MATCHING RESULTS[/bold green]")
        console.print("="*60)
        console.print(f"Total processed:    {total:,}")
        console.print(f"Matched:            [green]{matched_count:,}[/green] ({matched_count/total*100:.1f}%)")
        console.print(f"  - Needs review:   [yellow]{needs_review_count:,}[/yellow] ({needs_review_count/total*100:.1f}%)")
        console.print(f"Unmatched:          [red]{unmatched_count:,}[/red] ({unmatched_count/total*100:.1f}%)")
        console.print("="*60 + "\n")

        return {
            'total': total,
            'matched': matched_count,
            'needs_review': needs_review_count,
            'unmatched': unmatched_count
        }

    def _match_batch(self, batch_records):
        """Process a batch of records for parallel processing"""
        results = []

        for record in batch_records:
            # Match college
            college_match = self.match_college(record)

            # Match course
            course_match = self.match_course(record['course_raw'])

            # Match state, quota, category
            state_match = self.match_state(record.get('state_raw', ''))
            quota_match = self.match_quota(record.get('quota', ''))
            category_match = self.match_category(record.get('category', ''))

            # Determine overall status
            is_matched = college_match['is_matched'] and course_match['is_matched']
            needs_review = college_match.get('needs_manual_review', False) or course_match.get('needs_manual_review', False)

            results.append({
                'id': record['id'],
                'master_college_id': college_match.get('college_id'),
                'master_course_id': course_match.get('course_id'),
                'master_state_id': state_match.get('state_id'),
                'master_quota_id': quota_match.get('quota_id'),
                'master_category_id': category_match.get('category_id'),
                'college_match_score': college_match.get('confidence'),
                'college_match_method': college_match.get('method'),
                'course_match_score': course_match.get('confidence'),
                'course_match_method': course_match.get('method'),
                'is_matched': is_matched,
                'needs_manual_review': needs_review
            })

        return results

    def run_matching_parallel_partitioned(self, partition_key: str = None, batch_size=1000):
        """
        Run matching algorithm with parallel processing for partitioned database
        Recommended for 5,000+ records

        Args:
            partition_key: Optional - match specific partition only
            batch_size: Records per batch (default: 1000)
        """
        console.print(f"\n[bold cyan]🚀 Running Parallel Matching ({self.num_workers} workers)[/bold cyan]")

        conn = sqlite3.connect(self.counselling_db_path)

        # Get unmatched records
        if partition_key:
            query = """
                SELECT * FROM counselling_records
                WHERE partition_key = ? AND (is_matched = FALSE OR is_matched IS NULL)
            """
            df = pd.read_sql(query, conn, params=(partition_key,))
            console.print(f"[cyan]🎯 Matching partition: {partition_key}[/cyan]")
        else:
            query = """
                SELECT * FROM counselling_records
                WHERE is_matched = FALSE OR is_matched IS NULL
            """
            df = pd.read_sql(query, conn)
            console.print("[cyan]🎯 Matching all unmatched records[/cyan]")

        total = len(df)
        console.print(f"Processing {total:,} unmatched records in batches of {batch_size}")

        if total == 0:
            console.print("[yellow]No unmatched records found[/yellow]")
            conn.close()
            return {'total': 0, 'matched': 0, 'needs_review': 0, 'unmatched': 0}

        # Split into batches
        batches = [df.iloc[i:i + batch_size].to_dict('records')
                  for i in range(0, len(df), batch_size)]

        console.print(f"Created {len(batches)} batches")

        all_results = []

        # Process batches in parallel with Rich progress bar
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=console
        ) as progress:
            task = progress.add_task(f"Matching records...", total=len(batches))

            with ThreadPoolExecutor(max_workers=self.num_workers) as executor:
                futures = {executor.submit(self._match_batch, batch): i
                          for i, batch in enumerate(batches)}

                for future in as_completed(futures):
                    batch_results = future.result()
                    all_results.extend(batch_results)
                    progress.update(task, advance=1)

        # Batch update database
        console.print("[cyan]Updating database...[/cyan]")

        for result in tqdm(all_results, desc="Writing to DB"):
            conn.execute("""
                UPDATE counselling_records
                SET
                    master_college_id = ?,
                    master_course_id = ?,
                    master_state_id = ?,
                    master_quota_id = ?,
                    master_category_id = ?,
                    college_match_score = ?,
                    college_match_method = ?,
                    course_match_score = ?,
                    course_match_method = ?,
                    is_matched = ?,
                    needs_manual_review = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                result['master_college_id'],
                result['master_course_id'],
                result.get('master_state_id'),
                result.get('master_quota_id'),
                result.get('master_category_id'),
                result['college_match_score'],
                result['college_match_method'],
                result['course_match_score'],
                result['course_match_method'],
                result['is_matched'],
                result['needs_manual_review'],
                result['id']
            ))

        conn.commit()

        # Update partition metadata statistics
        if partition_key:
            conn.execute("""
                UPDATE partition_metadata
                SET
                    matched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND is_matched = TRUE),
                    unmatched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND (is_matched = FALSE OR is_matched IS NULL)),
                    needs_review_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND needs_manual_review = TRUE),
                    is_fully_matched = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = ? AND (is_matched = FALSE OR is_matched IS NULL)) = 0,
                    last_updated = CURRENT_TIMESTAMP
                WHERE partition_key = ?
            """, (partition_key, partition_key, partition_key, partition_key, partition_key))
        else:
            # Update all partitions
            conn.execute("""
                UPDATE partition_metadata
                SET
                    matched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND is_matched = TRUE),
                    unmatched_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND (is_matched = FALSE OR is_matched IS NULL)),
                    needs_review_records = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND needs_manual_review = TRUE),
                    is_fully_matched = (SELECT COUNT(*) FROM counselling_records WHERE partition_key = partition_metadata.partition_key AND (is_matched = FALSE OR is_matched IS NULL)) = 0,
                    last_updated = CURRENT_TIMESTAMP
            """)

        conn.commit()
        conn.close()

        # Calculate statistics
        matched_count = sum(1 for r in all_results if r['is_matched'])
        needs_review_count = sum(1 for r in all_results if r['needs_manual_review'])
        unmatched_count = sum(1 for r in all_results if not r['is_matched'])

        # Print statistics with Rich
        console.print("\n" + "="*60)
        console.print("[bold green]MATCHING RESULTS (PARALLEL)[/bold green]")
        console.print("="*60)
        console.print(f"Total processed:    {total:,}")
        console.print(f"Matched:            [green]{matched_count:,}[/green] ({matched_count/total*100:.1f}%)")
        console.print(f"  - Needs review:   [yellow]{needs_review_count:,}[/yellow] ({needs_review_count/total*100:.1f}%)")
        console.print(f"Unmatched:          [red]{unmatched_count:,}[/red] ({unmatched_count/total*100:.1f}%)")
        console.print("="*60 + "\n")

        return {
            'total': total,
            'matched': matched_count,
            'needs_review': needs_review_count,
            'unmatched': unmatched_count
        }

    def interactive_review_unmatched_partitioned(self):
        """Interactive review of unmatched records with alias creation (partitioned DB)"""
        conn = sqlite3.connect(self.counselling_db_path)

        # Initialize session stats
        session_stats = {
            'reviewed': 0,
            'aliases_created': 0,
            'skipped': 0,
            'records_affected': 0,
            'start_time': datetime.now()
        }

        # Get unmatched records with additional context
        unmatched = pd.read_sql("""
            SELECT DISTINCT
                partition_key,
                college_institute_raw,
                college_institute_normalized,
                course_raw,
                course_normalized,
                state_raw,
                state_normalized,
                master_college_id,
                master_course_id,
                college_match_score,
                college_match_method,
                course_match_score,
                course_match_method,
                COUNT(*) as record_count
            FROM counselling_records
            WHERE master_college_id IS NULL OR master_course_id IS NULL
            GROUP BY partition_key, college_institute_raw, course_raw, state_raw
            ORDER BY record_count DESC
            LIMIT 50
        """, conn)

        if len(unmatched) == 0:
            console.print("\n[green]✅ No unmatched records found![/green]")
            conn.close()
            return

        console.print(f"\n[bold yellow]📋 Found {len(unmatched)} unmatched record groups[/bold yellow]")
        console.print(f"[dim]Showing top 50 by record count[/dim]\n")

        # FEATURE 1: Detect duplicates and offer bulk alias creation
        duplicates = self._detect_duplicate_groups(unmatched, conn)
        if duplicates and len(duplicates) > 0:
            if self._offer_bulk_alias_creation(duplicates, conn, session_stats):
                # Reload unmatched after bulk operations
                unmatched = pd.read_sql("""
                    SELECT DISTINCT
                        partition_key,
                        college_institute_raw,
                        college_institute_normalized,
                        course_raw,
                        course_normalized,
                        state_raw,
                        state_normalized,
                        master_college_id,
                        master_course_id,
                        college_match_score,
                        college_match_method,
                        course_match_score,
                        course_match_method,
                        COUNT(*) as record_count
                    FROM counselling_records
                    WHERE master_college_id IS NULL OR master_course_id IS NULL
                    GROUP BY partition_key, college_institute_raw, course_raw, state_raw
                    ORDER BY record_count DESC
                    LIMIT 50
                """, conn)

                if len(unmatched) == 0:
                    console.print("\n[green]✅ All records matched after bulk operations![/green]")
                    conn.close()
                    return

        for idx, row in unmatched.iterrows():
            session_stats['reviewed'] += 1

            # Show session statistics dashboard
            self._show_session_stats(session_stats, len(unmatched))

            # Check for cross-partition inconsistencies
            consistency_warning = self._check_cross_partition_consistency(row, conn)

            # Determine why it didn't match
            unmatch_reason = self._analyze_unmatch_reason(row)

            # Get top 5 suggestions proactively
            college_suggestions = self._get_college_suggestions(row['college_institute_raw'], row['state_raw'], limit=5)
            course_suggestions = self._get_course_suggestions(row['course_raw'], limit=5)

            # Show partial match highlight if suggestions available
            if college_suggestions:
                college_diff = self._highlight_partial_match(row['college_institute_raw'], college_suggestions[0]['college']['name'])
            if course_suggestions:
                course_diff = self._highlight_partial_match(row['course_raw'], course_suggestions[0]['course']['name'])

            # Create review panel
            table = Table(title=f"Record {idx+1}/{len(unmatched)} - {unmatch_reason['emoji']} {unmatch_reason['reason']}", show_header=False, border_style=unmatch_reason['color'])
            table.add_column("Field", style="cyan", width=25)
            table.add_column("Value", style="white", no_wrap=False)

            # Extract address from raw college name (everything after first comma)
            raw_parts = row['college_institute_raw'].split(',', 1)
            college_address = raw_parts[1].strip() if len(raw_parts) > 1 else "N/A"

            table.add_row("📍 Partition", row['partition_key'])
            table.add_row("🏥 College (Raw)", row['college_institute_raw'][:100])
            table.add_row("🏥 College (Normalized)", row['college_institute_normalized'][:100])
            table.add_row("📍 Address", college_address[:80])
            table.add_row("📚 Course (Raw)", row['course_raw'])
            table.add_row("📚 Course (Normalized)", row['course_normalized'])
            table.add_row("🗺️  State", f"{row['state_raw']} → {row['state_normalized']}")
            table.add_row("📊 Affects", f"[bold]{row['record_count']:,} records[/bold]")

            # Show match status
            college_status = "✅ Matched" if row['master_college_id'] else f"❌ Unmatched"
            course_status = "✅ Matched" if row['master_course_id'] else f"❌ Unmatched"
            table.add_row("🏥 College Status", f"{college_status}")
            table.add_row("📚 Course Status", f"{course_status}")

            console.print(table)

            # Show cross-partition consistency warning if any
            if consistency_warning:
                console.print(f"\n[bold red]⚠️  CONSISTENCY WARNING:[/bold red]")
                console.print(consistency_warning)
                console.print()

            # Show WHY it didn't match
            console.print(f"\n[bold {unmatch_reason['color']}]🔍 Why This Failed:[/bold {unmatch_reason['color']}]")
            console.print(f"   {unmatch_reason['explanation']}\n")

            # Show partial match diff for top suggestion
            if college_suggestions:
                console.print(f"[bold cyan]🔤 Partial Match Comparison (Top Suggestion):[/bold cyan]")
                console.print(college_diff)
                console.print()

            # FEATURE 2: Detect and suggest pattern-based fixes
            pattern = self._detect_pattern(row['college_institute_raw'])
            if pattern:
                console.print(f"[bold yellow]🎯 PATTERN DETECTED:[/bold yellow]")
                console.print(f"  Pattern: {pattern['pattern']}")
                console.print(f"  Suggested fix: '{pattern['suggestion']}'")
                console.print(f"  Would remove: '{pattern['removed']}'")
                console.print()

            # FEATURE 3: Preview affected records
            preview = self._preview_affected_records(row, conn)
            if preview and row['record_count'] >= 10:  # Only show for high-impact records
                console.print(preview)

            # Build dynamic action menu with suggestions as options
            console.print("\n[bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
            console.print("[bold]📋 ACTIONS - Select College Match:[/bold]\n")

            action_map = {}
            action_num = 1

            # Show top 5 college suggestions as direct actions
            if not row['master_college_id'] and college_suggestions:
                console.print("[bold green]🎯 Top College Matches (Select to create alias):[/bold green]")
                for i, sugg in enumerate(college_suggestions[:5]):
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    action_map[str(action_num)] = {
                        'type': 'college_alias',
                        'data': sugg
                    }
                    console.print(
                        f"  [{action_num}] [{score_color}]{sugg['score']}%[/{score_color}] "
                        f"{sugg['college']['name'][:70]} "
                        f"[dim]({sugg['college']['id']} | {sugg['college'].get('state', 'N/A')} | {sugg['type'].upper()})[/dim]"
                    )
                    action_num += 1
                console.print()

            # Show top 5 course suggestions as direct actions
            if not row['master_course_id'] and course_suggestions:
                console.print("[bold green]🎯 Top Course Matches (Select to create alias):[/bold green]")
                for i, sugg in enumerate(course_suggestions[:5]):
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    action_map[str(action_num)] = {
                        'type': 'course_alias',
                        'data': sugg
                    }
                    console.print(
                        f"  [{action_num}] [{score_color}]{sugg['score']}%[/{score_color}] "
                        f"{sugg['course']['name']} "
                        f"[dim]({sugg['course']['id']})[/dim]"
                    )
                    action_num += 1
                console.print()

            # Add other standard actions
            console.print("[bold yellow]🔧 Other Options:[/bold yellow]")

            action_map[str(action_num)] = {'type': 'manual_id', 'data': None}
            console.print(f"  [{action_num}] 🆔 Enter college/course ID manually")
            action_num += 1

            action_map[str(action_num)] = {'type': 'browse_all', 'data': None}
            console.print(f"  [{action_num}] 🔍 Browse all colleges/courses (top 20)")
            action_num += 1

            action_map[str(action_num)] = {'type': 'rerun_match', 'data': None}
            console.print(f"  [{action_num}] 🔄 Re-run matching with current aliases")
            action_num += 1

            action_map[str(action_num)] = {'type': 'skip', 'data': None}
            console.print(f"  [{action_num}] ⏭️  Skip this record")
            action_num += 1

            action_map[str(action_num)] = {'type': 'skip_all', 'data': None}
            console.print(f"  [{action_num}] ⏭️  Skip all remaining")
            action_num += 1

            action_map[str(action_num)] = {'type': 'manual_review', 'data': None}
            console.print(f"  [{action_num}] ⚠️  Mark as manual review needed")
            action_num += 1

            action_map[str(action_num)] = {'type': 'export', 'data': None}
            console.print(f"  [{action_num}] 💾 Export unmatched to CSV")
            action_num += 1

            action_map[str(action_num)] = {'type': 'batch_csv', 'data': None}
            console.print(f"  [{action_num}] 📝 Generate batch review CSV template")
            action_num += 1

            console.print("[bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")

            # Get valid choices
            valid_choices = list(action_map.keys())

            # Accept direct ID input or menu choice
            console.print("\n[dim]💡 Tip: Type a college/course ID directly (e.g., MED0123, DEN0045) or choose an option number[/dim]")
            action = Prompt.ask(
                "[bold]Choose action or enter ID[/bold]",
                default=valid_choices[-4]  # Default to "skip"
            )

            # Check if input is a direct ID (starts with MED, DEN, DNB, or CRS)
            if action.upper().startswith(('MED', 'DEN', 'DNB', 'CRS')) and len(action) >= 6:
                # Direct ID entry
                college_id = action.upper()

                # Determine if it's college or course ID
                if college_id.startswith('CRS'):
                    # Course ID
                    found = False
                    for course in self.master_data['courses']['courses']:
                        if course['id'] == college_id:
                            if Confirm.ask(f"Create course alias: '{row['course_raw']}' → {course['name']} ({college_id})?", default=True):
                                self._save_alias('course', row['course_raw'], course['id'], course['name'])
                                console.print(f"[green]✅ Course alias created[/green]")
                                session_stats['aliases_created'] += 1
                                session_stats['records_affected'] += row['record_count']
                            found = True
                            break
                    if not found:
                        console.print(f"[red]❌ Course ID '{college_id}' not found[/red]")
                else:
                    # College ID
                    found = False
                    target_name = None
                    for college_type in ['medical', 'dental', 'dnb']:
                        for college in self.master_data[college_type]['colleges']:
                            if college['id'] == college_id:
                                target_name = college['name']
                                found = True
                                break
                        if found:
                            break

                    if found:
                        if Confirm.ask(f"Create college alias: '{row['college_institute_raw'][:50]}...' → {target_name} ({college_id})?", default=True):
                            preprocessed_name = self.preprocess_college_name(row['college_institute_raw'])
                            self._save_alias('college', preprocessed_name, college_id, target_name)
                            console.print(f"[green]✅ College alias created[/green]")
                            session_stats['aliases_created'] += 1
                            session_stats['records_affected'] += row['record_count']
                    else:
                        console.print(f"[red]❌ College ID '{college_id}' not found[/red]")

                continue  # Go to next record

            # Otherwise, handle as menu choice
            if action not in action_map:
                console.print(f"[red]Invalid choice: {action}[/red]")
                continue

            selected_action = action_map[action]

            if selected_action['type'] == 'college_alias':
                # Direct college alias from suggestion
                sugg = selected_action['data']
                # FIXED: Use preprocessed name for alias, not raw
                preprocessed_name = self.preprocess_college_name(row['college_institute_raw'])
                self._save_alias('college', preprocessed_name, sugg['college']['id'], sugg['college']['name'])
                console.print(f"[green]✅ College alias created: {row['college_institute_raw'][:60]}... → {sugg['college']['name']} ({sugg['college']['id']})[/green]")
                session_stats['aliases_created'] += 1
                session_stats['records_affected'] += row['record_count']

            elif selected_action['type'] == 'course_alias':
                # Direct course alias from suggestion
                sugg = selected_action['data']
                self._save_alias('course', row['course_raw'], sugg['course']['id'], sugg['course']['name'])
                console.print(f"[green]✅ Course alias created: {row['course_raw']} → {sugg['course']['name']} ({sugg['course']['id']})[/green]")
                session_stats['aliases_created'] += 1
                session_stats['records_affected'] += row['record_count']

            elif selected_action['type'] == 'manual_id':
                # Manual ID entry
                aliases_before = session_stats['aliases_created']
                self._create_alias_by_id(row, conn, session_stats)
                if session_stats['aliases_created'] > aliases_before:
                    session_stats['records_affected'] += row['record_count']

            elif selected_action['type'] == 'browse_all':
                # Browse all options
                aliases_before = session_stats['aliases_created']
                if not row['master_college_id']:
                    self._create_college_alias(row['college_institute_raw'], row['state_raw'], session_stats)
                if not row['master_course_id']:
                    self._create_course_alias(row['course_raw'], session_stats)
                if session_stats['aliases_created'] > aliases_before:
                    session_stats['records_affected'] += row['record_count']

            elif selected_action['type'] == 'rerun_match':
                # Re-run matching with current aliases
                console.print("\n[bold cyan]🔄 Re-running matching...[/bold cyan]")

                # Apply all aliases first
                updated_count = self.apply_all_aliases_to_records()

                # Re-run matching for remaining unmatched
                if updated_count > 0 or Confirm.ask("No records updated by aliases. Still re-run matching?", default=True):
                    console.print("[cyan]Running matching algorithm...[/cyan]")
                    results = self.run_matching_partitioned()
                    console.print(f"\n[green]✅ Matching complete![/green]")
                    console.print(f"  Newly matched: {results.get('matched', 0):,}")
                    console.print(f"  Still unmatched: {results.get('unmatched', 0):,}\n")

                # Reload unmatched data
                console.print("[cyan]Reloading unmatched records...[/cyan]")
                return 'reload'  # Signal to reload the unmatched list

            elif selected_action['type'] == 'skip':
                session_stats['skipped'] += 1
                continue

            elif selected_action['type'] == 'skip_all':
                break

            elif selected_action['type'] == 'manual_review':
                # Mark for manual review
                conn.execute("""
                    UPDATE counselling_records
                    SET needs_manual_review = TRUE
                    WHERE college_institute_raw = ? AND course_raw = ?
                """, (row['college_institute_raw'], row['course_raw']))
                conn.commit()
                console.print("[yellow]✓ Marked for manual review[/yellow]")

            elif selected_action['type'] == 'export':
                # Export unmatched
                export_file = f"unmatched_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                unmatched.to_csv(export_file, index=False)
                console.print(f"[green]✓ Exported to {export_file}[/green]")
                break

            elif selected_action['type'] == 'batch_csv':
                # Generate batch review template
                self._generate_batch_template(unmatched, conn)
                if Confirm.ask("\nImport completed batch CSV?", default=False):
                    self._import_batch_aliases(conn, session_stats)
                break

        conn.close()
        console.print("\n[green]✅ Interactive review complete[/green]")

    def _detect_duplicate_groups(self, unmatched, conn):
        """Detect groups of similar college names (likely duplicates/variations)"""
        from rapidfuzz import fuzz

        duplicates = []
        processed = set()

        for idx, row in unmatched.iterrows():
            if idx in processed:
                continue

            college_norm = row['college_institute_normalized']
            group = [{'index': idx, 'row': row, 'similarity': 100}]

            # Find similar colleges in remaining records
            for idx2, row2 in unmatched.iterrows():
                if idx2 <= idx or idx2 in processed:
                    continue

                college2_norm = row2['college_institute_normalized']
                similarity = fuzz.ratio(college_norm, college2_norm)

                # Group if very similar (90%+)
                if similarity >= 90:
                    group.append({'index': idx2, 'row': row2, 'similarity': similarity})
                    processed.add(idx2)

            # If we found a group (2+ variations)
            if len(group) >= 2:
                total_records = sum(item['row']['record_count'] for item in group)
                duplicates.append({
                    'group': group,
                    'total_records': total_records,
                    'variations': len(group)
                })

            processed.add(idx)

        # Sort by total records (highest impact first)
        duplicates.sort(key=lambda x: x['total_records'], reverse=True)

        return duplicates[:10]  # Top 10 duplicate groups

    def _offer_bulk_alias_creation(self, duplicates, conn, session_stats):
        """Offer to create aliases for duplicate groups in bulk"""
        console.print(Panel.fit(
            f"[bold green]🔄 DUPLICATE DETECTION[/bold green]\n"
            f"Found {len(duplicates)} groups of similar college names\n"
            f"These are likely spelling variations of the same college",
            border_style="green"
        ))

        total_affected = sum(d['total_records'] for d in duplicates)
        console.print(f"\n[bold]Total records that could be fixed: {total_affected:,}[/bold]\n")

        # Show top 5 duplicate groups
        for i, dup_group in enumerate(duplicates[:5], 1):
            # Get suggestions for this group first to determine likely type
            suggestions = self._get_college_suggestions(
                dup_group['group'][0]['row']['college_institute_raw'],
                dup_group['group'][0]['row']['state_raw'],
                limit=5
            )

            # Determine most likely college type from top suggestion
            likely_type = suggestions[0]['type'].upper() if suggestions else 'UNKNOWN'

            table = Table(title=f"Duplicate Group {i} - {dup_group['total_records']:,} records affected - Likely Type: [bold]{likely_type}[/bold]")
            table.add_column("Variation", style="cyan", no_wrap=False)
            table.add_column("Address/Location", style="dim white", no_wrap=False)
            table.add_column("Sample Courses", style="magenta", no_wrap=False)
            table.add_column("Records", justify="right", style="yellow")
            table.add_column("Similarity", justify="right", style="green")

            for item in dup_group['group']:
                # Extract address from raw college name
                raw_parts = item['row']['college_institute_raw'].split(',', 1)
                college_address = raw_parts[1].strip()[:40] if len(raw_parts) > 1 else "N/A"

                # Get sample courses for this college variation (prioritize distinct types)
                sample_courses = conn.execute("""
                    SELECT DISTINCT course_raw
                    FROM counselling_records
                    WHERE college_institute_normalized = ?
                    ORDER BY course_raw
                    LIMIT 2
                """, (item['row']['college_institute_normalized'],)).fetchall()

                # Format courses - truncate each to fit
                if sample_courses:
                    courses_list = [c[0][:25] for c in sample_courses]
                    total_courses = conn.execute("""
                        SELECT COUNT(DISTINCT course_raw)
                        FROM counselling_records
                        WHERE college_institute_normalized = ?
                    """, (item['row']['college_institute_normalized'],)).fetchone()[0]

                    if total_courses > 2:
                        courses_str = ", ".join(courses_list) + f" +{total_courses-2} more"
                    else:
                        courses_str = ", ".join(courses_list)
                else:
                    courses_str = "N/A"

                table.add_row(
                    item['row']['college_institute_normalized'][:40],
                    college_address,
                    courses_str[:40] + "..." if len(courses_str) > 40 else courses_str,
                    f"{item['row']['record_count']:,}",
                    f"{item['similarity']}%"
                )

            console.print(table)

            # Check if this group has courses from multiple streams (medical/dental/dnb)
            all_courses = conn.execute("""
                SELECT DISTINCT course_normalized
                FROM counselling_records
                WHERE college_institute_normalized = ?
            """, (dup_group['group'][0]['row']['college_institute_normalized'],)).fetchall()

            all_courses_list = [c[0] for c in all_courses]

            # Detect if courses span multiple streams
            has_medical = any('MBBS' in c.upper() or 'MD' in c.upper() or 'MS' in c.upper() for c in all_courses_list)
            has_dental = any('BDS' in c.upper() or 'MDS' in c.upper() for c in all_courses_list)
            has_dnb = any('DNB' in c.upper() or 'DIPLOMA' in c.upper() for c in all_courses_list)

            stream_count = sum([has_medical, has_dental, has_dnb])

            if stream_count > 1:
                streams = []
                if has_medical: streams.append("MEDICAL")
                if has_dental: streams.append("DENTAL")
                if has_dnb: streams.append("DNB")

                console.print(f"\n[bold yellow]⚠️  WARNING: This college has courses from multiple streams: {', '.join(streams)}[/bold yellow]")
                console.print(f"[yellow]   You may need to create separate aliases for different course types.[/yellow]\n")

            # Show detailed suggestions with full formatting
            if suggestions:
                console.print("\n[bold green]🎯 Top College Matches (Select to create alias for ALL variations):[/bold green]")
                for j, sugg in enumerate(suggestions[:5], 1):
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    console.print(
                        f"  [{j}] [{score_color}]{sugg['score']}%[/{score_color}] "
                        f"{sugg['college']['name']} "
                        f"[dim]({sugg['college']['id']} | {sugg['college'].get('state', 'N/A')} | {sugg['type'].upper()})[/dim]"
                    )

                console.print("\n[bold yellow]🔧 Other Options:[/bold yellow]")
                console.print(f"  [6] 🆔 Enter college ID manually")
                console.print(f"  [7] 🔍 Browse all colleges (top 20)")
                console.print(f"  [8] 🔄 Re-run matching with current aliases")
                console.print(f"  [9] ⏭️  Skip this group")
                console.print(f"  [0] ⏭️  Skip all remaining groups")
                console.print()

            # Ask what to do with more options
            console.print("\n[dim]💡 Tip: Type a college ID directly (e.g., MED0123) to create aliases for ALL variations[/dim]")
            action = Prompt.ask(
                f"[bold]Choose action or enter college ID[/bold]",
                default="9"
            )

            # Check if input is a direct college ID
            if action.upper().startswith(('MED', 'DEN', 'DNB')) and len(action) >= 6:
                college_id = action.upper()

                # Find college by ID
                found = False
                target_name = None
                for college_type in ['medical', 'dental', 'dnb']:
                    for college in self.master_data[college_type]['colleges']:
                        if college['id'] == college_id:
                            target_name = college['name']
                            found = True
                            break
                    if found:
                        break

                if found:
                    console.print(f"[green]Found: {target_name} ({college_id})[/green]")
                    if Confirm.ask(f"Create aliases for all {len(dup_group['group'])} variations?", default=True):
                        created_count = 0
                        for item in dup_group['group']:
                            preprocessed_name = self.preprocess_college_name(item['row']['college_institute_raw'])
                            self._save_alias('college', preprocessed_name, college_id, target_name)
                            created_count += 1

                        console.print(f"[green]✅ Created {created_count} aliases → {target_name} ({college_id})[/green]")
                        session_stats['aliases_created'] += created_count
                        session_stats['records_affected'] += dup_group['total_records']
                else:
                    console.print(f"[red]❌ College ID '{college_id}' not found[/red]")

                console.print()
                continue  # Go to next group

            if action in ["1", "2", "3", "4", "5"]:
                # Create aliases for all variations in group
                sugg = suggestions[int(action) - 1]
                created_count = 0

                for item in dup_group['group']:
                    # FIXED: Use preprocessed name for alias, not raw
                    preprocessed_name = self.preprocess_college_name(item['row']['college_institute_raw'])
                    self._save_alias(
                        'college',
                        preprocessed_name,
                        sugg['college']['id'],
                        sugg['college']['name']
                    )
                    created_count += 1

                console.print(
                    f"[green]✅ Created {created_count} aliases for all variations "
                    f"→ {sugg['college']['name']} ({sugg['college']['id']})[/green]"
                )

                session_stats['aliases_created'] += created_count
                session_stats['records_affected'] += dup_group['total_records']

            elif action == "6":
                # Manual ID entry for this group
                console.print("\n[bold cyan]🆔 Enter College ID Manually[/bold cyan]")
                college_id = Prompt.ask("Enter college ID (e.g., MED0001)", default="")

                if college_id:
                    # Find college by ID
                    found = False
                    target_name = None
                    for college_type in ['medical', 'dental', 'dnb']:
                        for college in self.master_data[college_type]['colleges']:
                            if college['id'] == college_id:
                                target_name = college['name']
                                found = True
                                break
                        if found:
                            break

                    if found:
                        console.print(f"[green]Found: {target_name} ({college_id})[/green]")
                        if Confirm.ask("Create aliases for all variations?", default=True):
                            created_count = 0
                            for item in dup_group['group']:
                                # FIXED: Use preprocessed name for alias, not raw
                                preprocessed_name = self.preprocess_college_name(item['row']['college_institute_raw'])
                                self._save_alias('college', preprocessed_name, college_id, target_name)
                                created_count += 1

                            console.print(f"[green]✅ Created {created_count} aliases → {target_name} ({college_id})[/green]")
                            session_stats['aliases_created'] += created_count
                            session_stats['records_affected'] += dup_group['total_records']
                    else:
                        console.print(f"[red]❌ College ID '{college_id}' not found[/red]")

            elif action == "7":
                # Browse all colleges
                console.print("\n[bold]Searching for matches...[/bold]")
                all_suggestions = self._get_college_suggestions(
                    dup_group['group'][0]['row']['college_institute_raw'],
                    dup_group['group'][0]['row']['state_raw'],
                    limit=20
                )

                table = Table(title="Top 20 College Matches")
                table.add_column("#", style="cyan", width=3)
                table.add_column("ID", style="magenta", width=10)
                table.add_column("College Name", style="white", no_wrap=False)
                table.add_column("State", style="yellow", width=15)
                table.add_column("Type", style="blue", width=8)
                table.add_column("Score", style="green", width=6)

                for j, sugg in enumerate(all_suggestions[:20], 1):
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    table.add_row(
                        str(j),
                        sugg['college']['id'],
                        sugg['college']['name'][:50],
                        sugg['college'].get('state', 'N/A')[:15],
                        sugg['type'].upper(),
                        f"[{score_color}]{sugg['score']:.0f}%[/{score_color}]"
                    )

                console.print(table)

                choice = Prompt.ask("\nSelect match (1-20) or 0 to skip", default="0")
                if choice != "0" and choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(all_suggestions):
                        selected = all_suggestions[idx]
                        created_count = 0
                        for item in dup_group['group']:
                            # FIXED: Use preprocessed name for alias, not raw
                            preprocessed_name = self.preprocess_college_name(item['row']['college_institute_raw'])
                            self._save_alias('college', preprocessed_name,
                                           selected['college']['id'], selected['college']['name'])
                            created_count += 1

                        console.print(f"[green]✅ Created {created_count} aliases → {selected['college']['name']} ({selected['college']['id']})[/green]")
                        session_stats['aliases_created'] += created_count
                        session_stats['records_affected'] += dup_group['total_records']

            elif action == "8":
                # Re-run matching
                console.print("\n[bold cyan]🔄 Re-running matching...[/bold cyan]")

                # Apply all aliases first
                updated_count = self.apply_all_aliases_to_records()

                # Re-run matching for remaining unmatched
                if updated_count > 0 or Confirm.ask("No records updated by aliases. Still re-run matching?", default=True):
                    console.print("[cyan]Running matching algorithm...[/cyan]")
                    results = self.run_matching_partitioned()
                    console.print(f"\n[green]✅ Matching complete![/green]")
                    console.print(f"  Newly matched: {results.get('matched', 0):,}")
                    console.print(f"  Still unmatched: {results.get('unmatched', 0):,}\n")

                # Exit and let user restart if needed
                if Confirm.ask("Continue reviewing duplicates?", default=True):
                    console.print("[yellow]Note: Duplicate list not updated. Restart to see updated list.[/yellow]")
                else:
                    break

            elif action == "9":
                # Skip this group
                pass

            elif action == "0":
                # Skip all remaining
                break

            console.print()

        if len(duplicates) > 5:
            console.print(f"[dim]+ {len(duplicates) - 5} more duplicate groups...[/dim]\n")

        return session_stats['aliases_created'] > 0

    def _detect_pattern(self, text):
        """Detect common patterns like duplicate text with addresses"""
        # Pattern: "COLLEGE, CITY, COLLEGE, CITY, STATE"
        parts = [p.strip() for p in text.split(',')]

        if len(parts) >= 3:
            # Check if first part repeats
            for i in range(1, len(parts)):
                if parts[0].lower() in parts[i].lower() or parts[i].lower() in parts[0].lower():
                    return {
                        'pattern': 'duplicate_name',
                        'suggestion': parts[0],  # Use first occurrence
                        'removed': ', '.join(parts[i:])
                    }

        return None

    def _preview_affected_records(self, row, conn):
        """Preview records that will be affected by creating this alias"""
        # Get sample records
        samples = pd.read_sql("""
            SELECT all_india_rank, round_raw, year, partition_key
            FROM counselling_records
            WHERE college_institute_raw = ? AND course_raw = ?
            LIMIT 5
        """, conn, params=(row['college_institute_raw'], row['course_raw']))

        if len(samples) == 0:
            return None

        preview_text = f"[bold cyan]👁️  Preview - {row['record_count']:,} records will be affected:[/bold cyan]\n"

        for _, sample in samples.iterrows():
            preview_text += f"  • Rank {sample['all_india_rank']}, {sample['round_raw']}, {sample['year']}, {sample['partition_key']}\n"

        if row['record_count'] > 5:
            preview_text += f"  [dim]... and {row['record_count'] - 5} more records[/dim]\n"

        return preview_text

    def _generate_batch_template(self, unmatched, conn):
        """Generate CSV template for batch review"""
        template_file = f"batch_review_template_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        # Prepare data with suggestions
        template_data = []
        for _, row in unmatched.iterrows():
            # Get top 3 suggestions
            suggestions = self._get_college_suggestions(row['college_institute_raw'], row['state_raw'], limit=3)

            sugg_ids = []
            sugg_names = []
            sugg_scores = []

            for sugg in suggestions[:3]:
                sugg_ids.append(sugg['college']['id'])
                sugg_names.append(sugg['college']['name'])
                sugg_scores.append(str(sugg['score']))

            # Pad to 3 suggestions
            while len(sugg_ids) < 3:
                sugg_ids.append('')
                sugg_names.append('')
                sugg_scores.append('')

            template_data.append({
                'college_raw': row['college_institute_raw'],
                'state': row['state_raw'],
                'records_affected': row['record_count'],
                'suggested_id_1': sugg_ids[0],
                'suggested_name_1': sugg_names[0],
                'score_1': sugg_scores[0],
                'suggested_id_2': sugg_ids[1],
                'suggested_name_2': sugg_names[1],
                'score_2': sugg_scores[2],
                'suggested_id_3': sugg_ids[2],
                'suggested_name_3': sugg_names[2],
                'score_3': sugg_scores[2],
                'action': '',  # approve1, approve2, approve3, skip, or enter custom ID
                'custom_id': '',  # If action is a custom ID
                'notes': ''
            })

        df_template = pd.DataFrame(template_data)
        df_template.to_csv(template_file, index=False)

        console.print(Panel.fit(
            f"[bold green]📝 BATCH REVIEW TEMPLATE GENERATED[/bold green]\n\n"
            f"File: {template_file}\n"
            f"Records: {len(template_data)}\n\n"
            f"[bold]Instructions:[/bold]\n"
            f"1. Open the CSV file in Excel/Google Sheets\n"
            f"2. Review each row and fill the 'action' column:\n"
            f"   - 'approve1' = Use suggested_id_1\n"
            f"   - 'approve2' = Use suggested_id_2\n"
            f"   - 'approve3' = Use suggested_id_3\n"
            f"   - 'MED0123' = Use custom ID (enter in custom_id column)\n"
            f"   - 'skip' = Skip this record\n"
            f"3. Save the file\n"
            f"4. Re-run interactive review and choose import option",
            border_style="green"
        ))

        return template_file

    def _import_batch_aliases(self, conn, session_stats):
        """Import aliases from completed batch CSV"""
        import glob

        # Find most recent batch file
        batch_files = sorted(glob.glob("batch_review_template_*.csv"), reverse=True)

        if not batch_files:
            console.print("[red]No batch review files found[/red]")
            return

        batch_file = batch_files[0]
        if len(batch_files) > 1:
            console.print(f"\n[bold]Found {len(batch_files)} batch files:[/bold]")
            for i, f in enumerate(batch_files[:5], 1):
                console.print(f"  [{i}] {f}")

            choice = Prompt.ask("Select file", choices=[str(i) for i in range(1, min(6, len(batch_files)+1))], default="1")
            batch_file = batch_files[int(choice) - 1]

        console.print(f"\n[cyan]Importing from: {batch_file}[/cyan]\n")

        # Read batch file
        df_batch = pd.read_csv(batch_file)

        imported = 0
        skipped = 0

        for _, row in df_batch.iterrows():
            action = str(row['action']).strip().lower()

            if action == 'skip' or not action:
                skipped += 1
                continue

            # Determine which ID to use
            target_id = None
            target_name = None

            if action == 'approve1' and row['suggested_id_1']:
                target_id = row['suggested_id_1']
                target_name = row['suggested_name_1']
            elif action == 'approve2' and row['suggested_id_2']:
                target_id = row['suggested_id_2']
                target_name = row['suggested_name_2']
            elif action == 'approve3' and row['suggested_id_3']:
                target_id = row['suggested_id_3']
                target_name = row['suggested_name_3']
            elif row['custom_id']:
                # Custom ID provided
                target_id = row['custom_id']
                # Look up name from master data
                found = False
                for college_type in ['medical', 'dental', 'dnb']:
                    for college in self.master_data[college_type]['colleges']:
                        if college['id'] == target_id:
                            target_name = college['name']
                            found = True
                            break
                    if found:
                        break

                if not found:
                    console.print(f"[red]Warning: Custom ID {target_id} not found, skipping[/red]")
                    skipped += 1
                    continue

            if target_id and target_name:
                # Create alias
                # FIXED: Use preprocessed name for alias, not raw
                preprocessed_name = self.preprocess_college_name(row['college_raw'])
                self._save_alias('college', preprocessed_name, target_id, target_name)
                imported += 1
                session_stats['aliases_created'] += 1
                session_stats['records_affected'] += row['records_affected']
                console.print(f"[green]✓[/green] {row['college_raw'][:50]}... → {target_id}")

        console.print(f"\n[bold green]✅ Batch import complete![/bold green]")
        console.print(f"  Imported: {imported}")
        console.print(f"  Skipped: {skipped}")

    def _show_session_stats(self, stats, total):
        """Display real-time session statistics dashboard"""
        elapsed = (datetime.now() - stats['start_time']).total_seconds() / 60
        remaining = total - stats['reviewed']

        # Calculate estimated match rate improvement
        est_match_improvement = (stats['records_affected'] / 128602) * 100 if stats['records_affected'] > 0 else 0

        # Create compact stats panel
        stats_text = (
            f"[bold cyan]SESSION[/bold cyan] "
            f"[dim]|[/dim] Reviewed: [yellow]{stats['reviewed']}/{total}[/yellow] "
            f"[dim]|[/dim] Aliases: [green]{stats['aliases_created']}[/green] "
            f"[dim]|[/dim] Skipped: [red]{stats['skipped']}[/red] "
            f"[dim]|[/dim] Affected: [magenta]{stats['records_affected']:,}[/magenta] "
            f"[dim]|[/dim] Est.Δ: [blue]+{est_match_improvement:.2f}%[/blue] "
            f"[dim]|[/dim] Time: [white]{elapsed:.1f}m[/white]"
        )
        console.print(Panel(stats_text, border_style="dim", padding=(0, 1)))

    def _check_cross_partition_consistency(self, row, conn):
        """Check if similar college names are matched differently across partitions"""
        # Find similar college names in other partitions that ARE matched
        similar_matched = pd.read_sql("""
            SELECT DISTINCT
                partition_key,
                college_institute_raw,
                master_college_id,
                college_match_score
            FROM counselling_records
            WHERE master_college_id IS NOT NULL
                AND partition_key != ?
                AND (
                    college_institute_normalized LIKE ?
                    OR college_institute_normalized LIKE ?
                )
            LIMIT 5
        """, conn, params=(
            row['partition_key'],
            f"%{row['college_institute_normalized'][:30]}%",
            f"%{row['college_institute_normalized'][-30:]}%"
        ))

        if len(similar_matched) > 0:
            # Check if they're matched to different IDs
            unique_ids = similar_matched['master_college_id'].nunique()
            if unique_ids > 1:
                warning = "[yellow]Similar colleges matched differently across partitions:[/yellow]\n"
                for _, match in similar_matched.iterrows():
                    warning += f"  • {match['partition_key']}: '{match['college_institute_raw'][:50]}...' → {match['master_college_id']}\n"
                warning += f"\n  [bold]Suggestion:[/bold] These may be the same college with spelling variations."
                return warning
            elif unique_ids == 1:
                # Consistent match found - suggest using same ID
                suggested_id = similar_matched.iloc[0]['master_college_id']
                suggested_partition = similar_matched.iloc[0]['partition_key']
                return (
                    f"[green]Similar college found in {suggested_partition}:[/green]\n"
                    f"  '{similar_matched.iloc[0]['college_institute_raw'][:60]}...' → [bold]{suggested_id}[/bold]\n"
                    f"  [dim]Consider using same ID for consistency[/dim]"
                )

        return None

    def _highlight_partial_match(self, raw_text, suggested_text):
        """Highlight differences between raw and suggested text"""
        from difflib import SequenceMatcher

        # Normalize for comparison
        raw_norm = self.normalize_text(raw_text)
        sug_norm = self.normalize_text(suggested_text)

        # Find matching blocks
        matcher = SequenceMatcher(None, raw_norm, sug_norm)

        # Build visual diff
        diff_text = f"  [dim]Raw:[/dim]       {raw_text[:80]}\n"
        diff_text += f"  [dim]Suggested:[/dim] {suggested_text[:80]}\n"

        # Calculate and show difference summary
        ratio = matcher.ratio() * 100

        # Find what's different
        differences = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                differences.append(f"Changed: '{raw_norm[i1:i2]}' → '{sug_norm[j1:j2]}'")
            elif tag == 'delete':
                differences.append(f"Removed: '{raw_norm[i1:i2]}'")
            elif tag == 'insert':
                differences.append(f"Added: '{sug_norm[j1:j2]}'")

        if differences:
            diff_text += f"  [yellow]Differences:[/yellow] {', '.join(differences[:3])}\n"
        else:
            diff_text += f"  [green]✓ Exact match after normalization[/green]\n"

        diff_text += f"  [blue]Similarity: {ratio:.1f}%[/blue]"

        return diff_text

    def _analyze_unmatch_reason(self, row):
        """Analyze why a record didn't match and return explanation"""
        college_unmatched = not row['master_college_id']
        course_unmatched = not row['master_course_id']

        if college_unmatched and course_unmatched:
            if row['college_match_score'] and row['college_match_score'] < 75:
                return {
                    'reason': 'Low Similarity - College Name',
                    'emoji': '🔍',
                    'color': 'yellow',
                    'explanation': f"Best match score was {row['college_match_score']:.1f}% (threshold: 75%). College name likely has typos, abbreviations, or extra text."
                }
            else:
                return {
                    'reason': 'College Not Found',
                    'emoji': '❓',
                    'color': 'red',
                    'explanation': "No similar college found in master data. This college may be missing from the database."
                }
        elif college_unmatched:
            return {
                'reason': 'College Unmatched Only',
                'emoji': '🏥',
                'color': 'yellow',
                'explanation': f"Course matched successfully, but college failed. Try checking spelling or state."
            }
        elif course_unmatched:
            return {
                'reason': 'Course Unmatched Only',
                'emoji': '📚',
                'color': 'yellow',
                'explanation': f"College matched successfully, but course failed. Course may be missing from master data."
            }
        else:
            return {
                'reason': 'Unknown',
                'emoji': '🤔',
                'color': 'white',
                'explanation': "Record marked as unmatched but both college and course seem matched. Check data integrity."
            }

    def _get_college_suggestions(self, raw_college, state, limit=5):
        """Get top N college suggestions"""
        all_similar = []
        normalized = self.normalize_text(raw_college)

        for college_type in ['medical', 'dental', 'dnb']:
            candidates = self.master_data[college_type]['colleges']
            matches = process.extract(
                normalized,
                [self.normalize_text(c['name']) for c in candidates],
                scorer=fuzz.ratio,
                limit=limit
            )
            for match in matches:
                all_similar.append({
                    'college': candidates[match[2]],
                    'score': match[1],
                    'type': college_type
                })

        # Sort by score
        all_similar.sort(key=lambda x: x['score'], reverse=True)
        return all_similar[:limit]

    def _get_course_suggestions(self, raw_course, limit=5):
        """Get top N course suggestions"""
        candidates = self.master_data['courses']['courses']
        normalized = self.normalize_text(raw_course)

        matches = process.extract(
            normalized,
            [self.normalize_text(c['name']) for c in candidates],
            scorer=fuzz.ratio,
            limit=limit
        )

        suggestions = []
        for match in matches:
            course = candidates[match[2]]
            suggestions.append({
                'course': course,
                'score': match[1]
            })

        return suggestions

    def _quick_match_from_suggestions(self, row, college_suggestions, course_suggestions, conn):
        """Quick match by selecting from top 5 suggestions"""
        if not row['master_college_id'] and college_suggestions:
            console.print("\n[bold]Select College Match:[/bold]")
            for i, sugg in enumerate(college_suggestions[:5], 1):
                console.print(f"  [{i}] {sugg['college']['name']} ({sugg['score']}%)")
            console.print(f"  [0] Skip")

            choice = Prompt.ask("Select", default="0")
            if choice != "0" and choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(college_suggestions):
                    selected = college_suggestions[idx]['college']
                    # FIXED: Use preprocessed name for alias, not raw
                    preprocessed_name = self.preprocess_college_name(row['college_institute_raw'])
                    self._save_alias('college', preprocessed_name, selected['id'], selected['name'])
                    console.print(f"[green]✅ College alias created[/green]")

        if not row['master_course_id'] and course_suggestions:
            console.print("\n[bold]Select Course Match:[/bold]")
            for i, sugg in enumerate(course_suggestions[:5], 1):
                console.print(f"  [{i}] {sugg['course']['name']} ({sugg['score']}%)")
            console.print(f"  [0] Skip")

            choice = Prompt.ask("Select", default="0")
            if choice != "0" and choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(course_suggestions):
                    selected = course_suggestions[idx]['course']
                    self._save_alias('course', row['course_raw'], selected['id'], selected['name'])
                    console.print(f"[green]✅ Course alias created[/green]")

    def _create_alias_by_id(self, row, conn, session_stats=None):
        """Create alias by entering ID manually"""
        console.print("\n[bold cyan]🆔 Create Alias by ID[/bold cyan]")

        # Ask which type
        if not row['master_college_id']:
            console.print("\n[bold]College is unmatched.[/bold]")
            college_id = Prompt.ask("Enter college ID (e.g., MED0001, DEN0001, DNB0001) or 'skip'", default="skip")

            if college_id.lower() != "skip":
                # Validate and find college
                found = False
                for college_type in ['medical', 'dental', 'dnb']:
                    for college in self.master_data[college_type]['colleges']:
                        if college['id'] == college_id:
                            console.print(f"[green]Found: {college['name']} ({college_id})[/green]")
                            confirm = Confirm.ask(f"Create alias for '{row['college_institute_raw'][:60]}...'?", default=True)
                            if confirm:
                                # FIXED: Use preprocessed name for alias, not raw
                                preprocessed_name = self.preprocess_college_name(row['college_institute_raw'])
                                self._save_alias('college', preprocessed_name, college['id'], college['name'])
                                console.print(f"[green]✅ College alias created[/green]")
                                if session_stats:
                                    session_stats['aliases_created'] += 1
                            found = True
                            break
                    if found:
                        break

                if not found:
                    console.print(f"[red]❌ College ID '{college_id}' not found in master data[/red]")

        if not row['master_course_id']:
            console.print("\n[bold]Course is unmatched.[/bold]")
            course_id = Prompt.ask("Enter course ID (e.g., CRS0001) or 'skip'", default="skip")

            if course_id.lower() != "skip":
                # Validate and find course
                found = False
                for course in self.master_data['courses']['courses']:
                    if course['id'] == course_id:
                        console.print(f"[green]Found: {course['name']} ({course_id})[/green]")
                        confirm = Confirm.ask(f"Create alias for '{row['course_raw']}'?", default=True)
                        if confirm:
                            self._save_alias('course', row['course_raw'], course['id'], course['name'])
                            console.print(f"[green]✅ Course alias created[/green]")
                            if session_stats:
                                session_stats['aliases_created'] += 1
                        found = True
                        break

                if not found:
                    console.print(f"[red]❌ Course ID '{course_id}' not found in master data[/red]")

    def _create_college_alias(self, raw_college, state=None, session_stats=None):
        """Interactive college alias creation"""
        # Show similar colleges
        console.print(f"\n[bold]Creating alias for:[/bold] {raw_college}")

        # Get top 20 similar colleges from each type
        all_similar = []
        for college_type in ['medical', 'dental', 'dnb']:
            candidates = self.master_data[college_type]['colleges']
            matches = process.extract(
                self.normalize_text(raw_college),
                [self.normalize_text(c['name']) for c in candidates],
                scorer=fuzz.ratio,
                limit=10
            )
            for match in matches:
                all_similar.append({
                    'college': candidates[match[2]],
                    'score': match[1],
                    'type': college_type
                })

        # Sort by score
        all_similar.sort(key=lambda x: x['score'], reverse=True)

        # Display top 20 with IDs
        table = Table(title="Similar Colleges (Top 20)")
        table.add_column("#", style="cyan", width=3)
        table.add_column("ID", style="magenta", width=10)
        table.add_column("College Name", style="white", no_wrap=False)
        table.add_column("State", style="yellow", width=15)
        table.add_column("Type", style="blue", width=8)
        table.add_column("Score", style="green", width=6)

        for i, match in enumerate(all_similar[:20]):
            score_color = "green" if match['score'] >= 90 else "yellow" if match['score'] >= 80 else "red"
            table.add_row(
                str(i+1),
                match['college']['id'],
                match['college']['name'][:60],
                match['college'].get('state', 'N/A')[:15],
                match['type'].upper(),
                f"[{score_color}]{match['score']}%[/{score_color}]"
            )

        console.print(table)

        choice = Prompt.ask("\nSelect match (1-20) or 0 to skip", default="0")

        if choice != "0" and choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(all_similar):
                selected = all_similar[idx]['college']
                # Save alias
                # FIXED: Use preprocessed name for alias, not raw
                preprocessed_name = self.preprocess_college_name(raw_college)
                self._save_alias('college', preprocessed_name, selected['id'], selected['name'])
                console.print(f"[green]✅ Alias created: {raw_college[:60]}... → {selected['name']} ({selected['id']})[/green]")
                if session_stats:
                    session_stats['aliases_created'] += 1

    def _create_course_alias(self, raw_course, session_stats=None):
        """Interactive course alias creation"""
        console.print(f"\n[bold]Creating alias for:[/bold] {raw_course}")

        # Get top 20 similar courses
        candidates = self.master_data['courses']['courses']
        matches = process.extract(
            self.normalize_text(raw_course),
            [self.normalize_text(c['name']) for c in candidates],
            scorer=fuzz.ratio,
            limit=20
        )

        # Display matches with IDs
        table = Table(title="Similar Courses (Top 20)")
        table.add_column("#", style="cyan", width=3)
        table.add_column("ID", style="magenta", width=10)
        table.add_column("Course Name", style="white", no_wrap=False)
        table.add_column("Score", style="green", width=6)

        for i, match in enumerate(matches):
            course = candidates[match[2]]
            score_color = "green" if match[1] >= 90 else "yellow" if match[1] >= 80 else "red"
            table.add_row(
                str(i+1),
                course['id'],
                course['name'],
                f"[{score_color}]{match[1]}%[/{score_color}]"
            )

        console.print(table)

        choice = Prompt.ask("\nSelect match (1-20) or 0 to skip", default="0")

        if choice != "0" and choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(matches):
                selected = candidates[matches[idx][2]]
                # Save alias
                self._save_alias('course', raw_course, selected['id'], selected['name'])
                console.print(f"[green]✅ Alias created: {raw_course} → {selected['name']} ({selected['id']})[/green]")
                if session_stats:
                    session_stats['aliases_created'] += 1

    def generate_unmatched_report(self, output_file: str = 'unmatched_counselling_report.txt'):
        """Generate comprehensive report of unmatched records"""
        conn = sqlite3.connect(self.counselling_db_path)

        # Get unmatched colleges
        unmatched_colleges = pd.read_sql("""
            SELECT DISTINCT
                college_institute_raw,
                state_raw,
                college_institute_normalized,
                state_normalized,
                COUNT(*) as record_count
            FROM aiq_records
            WHERE master_college_id IS NULL
            GROUP BY college_institute_raw, state_raw
            ORDER BY record_count DESC, state_normalized, college_institute_raw
        """, conn)

        # Get unmatched courses
        unmatched_courses = pd.read_sql("""
            SELECT DISTINCT
                course_raw,
                course_normalized,
                COUNT(*) as record_count
            FROM aiq_records
            WHERE master_course_id IS NULL
            GROUP BY course_raw
            ORDER BY record_count DESC
        """, conn)

        conn.close()

        # Write report
        with open(output_file, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("UNMATCHED COUNSELLING DATA REPORT\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"SUMMARY\n")
            f.write(f"-------\n")
            f.write(f"Unmatched Colleges: {len(unmatched_colleges)}\n")
            f.write(f"Unmatched Courses: {len(unmatched_courses)}\n\n")
            f.write("=" * 80 + "\n")
            f.write("UNMATCHED COLLEGES\n")
            f.write("=" * 80 + "\n\n")

            for idx, row in unmatched_colleges.iterrows():
                f.write(f"{idx+1}. {row['college_institute_raw']}\n")
                f.write(f"   State: {row['state_raw']} → {row['state_normalized']}\n")
                f.write(f"   Normalized: {row['college_institute_normalized']}\n")
                f.write(f"   Affects {row['record_count']} records\n\n")

            f.write("\n" + "=" * 80 + "\n")
            f.write("UNMATCHED COURSES\n")
            f.write("=" * 80 + "\n\n")

            for idx, row in unmatched_courses.iterrows():
                f.write(f"{idx+1}. {row['course_raw']}\n")
                f.write(f"   Normalized: {row['course_normalized']}\n")
                f.write(f"   Affects {row['record_count']} records\n\n")

        console.print(f"\n[green]✅ Unmatched report saved:[/green] {output_file}")
        console.print(f"   • Unmatched colleges: {len(unmatched_colleges)}")
        console.print(f"   • Unmatched courses: {len(unmatched_courses)}")

        return output_file

    def _save_alias(self, alias_type, alias_name, master_id, master_name):
        """Save alias to database and in-memory cache"""
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()

        # Create alias tables if they don't exist
        if alias_type == 'college':
            # Check if record already exists
            existing = cursor.execute("""
                SELECT id FROM college_aliases WHERE alias_name = ? AND college_id = ?
            """, (alias_name, master_id)).fetchone()

            if existing:
                console.print(f"[yellow]ℹ️  Alias already exists[/yellow]")
                conn.commit()
                conn.close()
                return

            cursor.execute("""
                INSERT INTO college_aliases (alias_name, original_name, college_id, confidence)
                VALUES (?, ?, ?, ?)
            """, (alias_name, master_name, master_id, 100.0))
            self.aliases['college'].append({
                'alias_name': alias_name,
                'original_name': master_name,
                'college_id': master_id
            })
        else:  # course
            # Check if record already exists
            existing = cursor.execute("""
                SELECT id FROM course_aliases WHERE alias_name = ? AND course_id = ?
            """, (alias_name, master_id)).fetchone()

            if existing:
                console.print(f"[yellow]ℹ️  Alias already exists[/yellow]")
                conn.commit()
                conn.close()
                return

            cursor.execute("""
                INSERT INTO course_aliases (alias_name, original_name, course_id, confidence)
                VALUES (?, ?, ?, ?)
            """, (alias_name, master_name, master_id, 100.0))
            self.aliases['course'].append({
                'alias_name': alias_name,
                'original_name': master_name,
                'course_id': master_id
            })

        conn.commit()
        conn.close()

    def apply_all_aliases_to_records(self):
        """Apply all existing aliases to update counselling records (run after interactive review)"""
        console.print("\n[bold cyan]📋 Applying ALL aliases to counselling records...[/bold cyan]")
        console.print("[dim]Note: This applies all aliases in the database, not just from current session[/dim]\n")

        # Connect to both databases
        master_conn = sqlite3.connect(self.master_db_path)
        counsel_conn = sqlite3.connect(self.counselling_db_path)

        # Get all college aliases
        college_aliases_df = pd.read_sql("SELECT alias_name, college_id FROM college_aliases", master_conn)
        course_aliases_df = pd.read_sql("SELECT alias_name, course_id FROM course_aliases", master_conn)

        console.print(f"[cyan]Found {len(college_aliases_df)} college aliases and {len(course_aliases_df)} course aliases[/cyan]")

        total_college_updated = 0
        total_course_updated = 0

        # Apply college aliases
        for _, row in college_aliases_df.iterrows():
            cursor = counsel_conn.execute("""
                UPDATE counselling_records
                SET master_college_id = ?,
                    college_match_score = 100.0,
                    college_match_method = 'alias_exact'
                WHERE college_institute_normalized = ?
                AND master_college_id IS NULL
            """, (row['college_id'], row['alias_name']))

            total_college_updated += cursor.rowcount

        # Apply course aliases
        for _, row in course_aliases_df.iterrows():
            cursor = counsel_conn.execute("""
                UPDATE counselling_records
                SET master_course_id = ?,
                    course_match_score = 100.0,
                    course_match_method = 'alias_exact'
                WHERE course_normalized = ?
                AND master_course_id IS NULL
            """, (row['course_id'], row['alias_name']))

            total_course_updated += cursor.rowcount

        counsel_conn.commit()
        master_conn.close()
        counsel_conn.close()

        console.print(f"[green]✅ Updated {total_college_updated:,} college records[/green]")
        console.print(f"[green]✅ Updated {total_course_updated:,} course records[/green]")

        return total_college_updated + total_course_updated

    def validate_data(self):
        """Validate counselling data for duplicates and required fields"""
        console.print("\n[bold cyan]🔍 Validating Data...[/bold cyan]")
        conn = sqlite3.connect(self.counselling_db_path)

        # Check for duplicates (YEAR + ROUND + RANK)
        duplicates = pd.read_sql("""
            SELECT year, round, all_india_rank, COUNT(*) as count
            FROM aiq_records
            GROUP BY year, round, all_india_rank
            HAVING count > 1
        """, conn)

        if len(duplicates) > 0:
            console.print(f"[yellow]⚠️  Found {len(duplicates)} duplicate records (YEAR + ROUND + RANK)[/yellow]")
        else:
            console.print("[green]✅ No duplicates found[/green]")

        # Check required fields
        for field in self.config['validation']['required_fields']:
            null_count = pd.read_sql(f"""
                SELECT COUNT(*) as count
                FROM aiq_records
                WHERE {field} IS NULL OR {field} = ''
            """, conn).iloc[0]['count']

            if null_count > 0:
                console.print(f"[yellow]⚠️  {field}: {null_count} records with missing data[/yellow]")

        # Validate categories and quotas
        invalid_categories = pd.read_sql(f"""
            SELECT DISTINCT category
            FROM aiq_records
            WHERE category NOT IN ({','.join(['?' for _ in self.config['validation']['valid_categories']])})
        """, conn, params=self.config['validation']['valid_categories'])

        if len(invalid_categories) > 0:
            console.print(f"[yellow]⚠️  Invalid categories found: {', '.join(invalid_categories['category'].tolist())}[/yellow]")

        conn.close()

def main():
    """Enhanced interactive main function for partitioned database"""

    console.print(Panel.fit(
        "[bold cyan]COUNSELLING DATA MATCHING PIPELINE - PARTITIONED DATABASE[/bold cyan]\n"
        "[dim]Enhanced with 4-pass matching, partition support, and batch import[/dim]",
        border_style="cyan"
    ))

    # Initialize matcher
    matcher = CounsellingDataMatcher()

    # Step 1: Load master data
    console.print("\n[bold]Step 1:[/bold] Loading master data...")
    matcher.load_master_data()

    # Step 2: Clear sample data
    console.print("\n[bold]Step 2:[/bold] Clearing sample data...")
    matcher.clear_sample_data()

    # Step 3: Batch import from directory
    console.print("\n[bold]Step 3:[/bold] Batch import Excel files")

    # Look for files in specified directory
    import glob
    cutoff_dir = "/Users/kashyapanand/Desktop/EXPORT/cutoffs/"
    excel_files = glob.glob(cutoff_dir + '*.xlsx')

    if not excel_files:
        console.print("[red]❌ No Excel files found in {cutoff_dir}[/red]")
        return

    console.print(f"\n[bold]Found {len(excel_files)} files:[/bold]")
    for f in excel_files:
        console.print(f"  • {Path(f).name}")

    if not Confirm.ask(f"\n[bold]Import all {len(excel_files)} files?[/bold]", default=True):
        console.print("[yellow]Import cancelled[/yellow]")
        return

    # Step 4: Batch import
    import_results = matcher.batch_import_files(excel_files)
    total_imported = sum(r['records'] for r in import_results if r['status'] == 'success')

    if total_imported == 0:
        console.print("[red]❌ No records imported. Exiting.[/red]")
        return

    # Step 5: Run matching (auto-select parallel for large datasets)
    console.print(f"\n[bold]Step 4:[/bold] Running matching algorithm...")

    # Auto-detect if parallel processing should be used
    use_parallel = total_imported >= 5000 and matcher.enable_parallel

    if use_parallel:
        console.print(f"[cyan]💡 Large dataset detected ({total_imported:,} records)[/cyan]")
        console.print(f"[cyan]💡 Using parallel processing with {matcher.num_workers} workers[/cyan]")

    if use_parallel:
        results = matcher.run_matching_parallel_partitioned()
    else:
        results = matcher.run_matching_partitioned()

    # Step 6: Show partition statistics
    console.print(f"\n[bold]Step 5:[/bold] Partition Statistics")
    conn = sqlite3.connect(matcher.counselling_db_path)
    partition_stats = pd.read_sql("SELECT * FROM available_partitions", conn)
    conn.close()

    table = Table(title="Partition Statistics")
    table.add_column("Partition", style="cyan")
    table.add_column("Total", justify="right", style="white")
    table.add_column("Matched", justify="right", style="green")
    table.add_column("Unmatched", justify="right", style="red")
    table.add_column("Review", justify="right", style="yellow")
    table.add_column("Match %", justify="right", style="blue")

    for _, row in partition_stats.iterrows():
        table.add_row(
            row['partition_key'],
            f"{row['total_records']:,}",
            f"{row['matched_records']:,}",
            f"{row['unmatched_records']:,}",
            f"{row['needs_review_records']:,}",
            f"{row['match_percentage']:.1f}%"
        )

    console.print(table)

    # Step 7: Interactive review
    if Confirm.ask("\n[bold]Do you want to interactively review unmatched records?[/bold]", default=True):
        matcher.interactive_review_unmatched_partitioned()

        # Re-run matching with new aliases
        if Confirm.ask("\n[bold]Re-run matching with new aliases?[/bold]", default=True):
            # First, apply all aliases to update existing records
            updated_count = matcher.apply_all_aliases_to_records()

            # Then re-run matching for any remaining unmatched records
            if updated_count > 0:
                console.print("\n[bold cyan]Re-running matching for remaining records...[/bold cyan]")
                if use_parallel:
                    results = matcher.run_matching_parallel_partitioned()
                else:
                    results = matcher.run_matching_partitioned()

    # Final summary
    console.print(Panel.fit(
        f"[bold green]✅ PIPELINE COMPLETE[/bold green]\n\n"
        f"[bold]Import Summary:[/bold]\n"
        f"  • Files imported: {len([r for r in import_results if r['status'] == 'success'])}\n"
        f"  • Total records: {total_imported:,}\n\n"
        f"[bold]Matching Results:[/bold]\n"
        f"  • Matched: {results['matched']:,} ({results['matched']/results['total']*100:.1f}%)\n"
        f"  • Needs review: {results['needs_review']:,}\n"
        f"  • Unmatched: {results['unmatched']:,}\n\n"
        f"[bold]Database:[/bold]\n"
        f"  • {matcher.counselling_db_path}",
        border_style="green"
    ))

    # Next steps
    console.print("\n[bold cyan]Next Steps:[/bold cyan]")
    console.print("  1. Review partition statistics above")
    console.print("  2. Check unmatched records and create aliases")
    console.print("  3. Query partitioned database for analysis")
    console.print("  4. Export matched data if needed\n")

if __name__ == "__main__":
    # Create necessary directories
    Path("logs").mkdir(exist_ok=True)
    Path("data/sqlite").mkdir(parents=True, exist_ok=True)

    main()
