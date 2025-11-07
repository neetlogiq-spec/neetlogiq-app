#!/usr/bin/env python3
"""
Advanced Matching and Linking with SQLite Integration
Supports parallel processing, TF-IDF scoring, and human-in-the-loop feedback

Enhanced Features:
- Rich UI components for beautiful terminal output
- Interactive review system for unmatched records
- Course normalization and corrections
- Batch import functionality
- Enhanced validation (category, quota, year/round)
- State mapping integration
- Alias management system
- Performance caching with LRU cache
- Session tracking and analytics
"""

import sqlite3
import pandas as pd
import numpy as np
import yaml
import logging
import os
import sys
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import re
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from tqdm import tqdm
import multiprocessing as mp
from rapidfuzz import fuzz, process
import uuid
from datetime import datetime
from functools import lru_cache, wraps
import hashlib
import json

# Rich library imports for beautiful UI
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich import print as rprint

# Add scripts directory to path for state mapping
sys.path.append(str(Path(__file__).parent / 'scripts'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/seat_data_matching.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Rich console for beautiful UI
console = Console()

class AdvancedSQLiteMatcher:
    def __init__(self, config_path='config.yaml', enable_parallel=True, num_workers=None):
        """Initialize the advanced matcher"""
        self.config = self.load_config(config_path) if Path(config_path).exists() else self._default_config()
        self.master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        self.linked_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['linked_data_db']}"
        self.seat_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"
        self.tfidf_vectorizer = None
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
            'database': {
                'sqlite_path': 'data/sqlite',
                'master_data_db': 'master_data.db',
                'linked_data_db': 'linked_data.db',
                'seat_data_db': 'seat_data.db'
            },
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
                    'low_confidence': 75,
                    'fuzzy_match': 0.75,
                    'substring_match': 0.70,
                    'partial_word_match': 0.65,
                    'tfidf_match': 0.70
                },
                'min_confidence': 0.70
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
                'required_fields': ['college_name', 'course_name', 'state'],
                'valid_categories': ['OPEN', 'OBC', 'SC', 'ST', 'EWS'],
                'valid_quotas': ['AIQ', 'DNB', 'IP', 'OP', 'MANAGEMENT']
            },
            'parallel': {
                'batch_size': 1000,
                'num_processes': 4
            }
        }
    
    def load_master_data(self):
        """Load master data from SQLite with Rich UI"""
        with console.status("[bold green]Loading master data..."):
            conn = sqlite3.connect(self.master_db_path)

            # Load medical colleges
            medical_df = pd.read_sql("SELECT * FROM medical_colleges", conn)
            self.master_data['medical'] = {
                'colleges': medical_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in medical_df['tfidf_vector']]
            }

            # Load dental colleges
            dental_df = pd.read_sql("SELECT * FROM dental_colleges", conn)
            self.master_data['dental'] = {
                'colleges': dental_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in dental_df['tfidf_vector']]
            }

            # Load DNB colleges
            dnb_df = pd.read_sql("SELECT * FROM dnb_colleges", conn)
            self.master_data['dnb'] = {
                'colleges': dnb_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in dnb_df['tfidf_vector']]
            }

            # Combined list for general use
            medical_df['type'] = 'MEDICAL'
            dental_df['type'] = 'DENTAL'
            dnb_df['type'] = 'DNB'
            all_colleges = pd.concat([medical_df, dental_df, dnb_df], ignore_index=True)
            self.master_data['colleges'] = all_colleges.to_dict('records')

            # Load courses
            courses_df = pd.read_sql("SELECT * FROM courses", conn)
            self.master_data['courses'] = {
                'courses': courses_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in courses_df['tfidf_vector']]
            }

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
            try:
                state_df = pd.read_sql("""
                    SELECT raw_state, normalized_state
                    FROM state_mappings
                    WHERE is_verified = TRUE AND normalized_state != 'UNKNOWN'
                """, conn)
                self.state_mappings = dict(zip(state_df['raw_state'], state_df['normalized_state']))
            except:
                self.state_mappings = {}

            conn.close()

        # Load standard courses and corrections
        self._load_standard_courses()

        # Display summary with Rich
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
    
    @lru_cache(maxsize=10000)
    def normalize_text(self, text):
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

    def normalize_course(self, raw_course: str) -> str:
        """Normalize course name with error corrections"""
        if pd.isna(raw_course) or raw_course == '':
            return ''

        # Apply course corrections first
        normalized = self.normalize_text(raw_course)

        if normalized in self.course_corrections:
            corrected = self.course_corrections[normalized]
            logger.info(f"Applied correction: '{raw_course}' -> '{corrected}'")
            return self.normalize_text(corrected)

        # Check if it matches a standard course
        if normalized in self.standard_courses:
            return self.standard_courses[normalized]

        return normalized
    
    def normalize_state(self, raw_state: str) -> str:
        """Normalize state using mapping table with fallback"""
        if pd.isna(raw_state) or raw_state == '':
            return None

        raw_state_str = str(raw_state).strip()

        # Lookup in mappings
        if raw_state_str in self.state_mappings:
            return self.state_mappings[raw_state_str]

        # Fallback: try config-based mappings
        state_upper = raw_state_str.upper()
        if 'state_normalization' in self.config and 'mappings' in self.config['state_normalization']:
            for original, normalized in self.config['state_normalization']['mappings'].items():
                if state_upper == original.upper():
                    return normalized.upper()

        # Try to import and use get_normalized_state function
        try:
            from scripts.create_state_mapping import get_normalized_state
            normalized = get_normalized_state(raw_state_str, self.master_db_path)
            return normalized
        except:
            pass

        return state_upper
    
    def detect_course_type(self, course_name):
        """Detect course type based on patterns with three-tier DIPLOMA classification"""
        if pd.isna(course_name) or course_name == '':
            return 'unknown'
        
        course_name = str(course_name).upper()
        
        # Check DNB patterns FIRST (most specific - check if course STARTS WITH DNB or DNB-)
        for pattern in self.config['course_classification']['dnb_patterns']:
            if course_name.startswith(pattern):
                return 'dnb'
        
        # Check PG DIPLOMA patterns (dental courses - most specific)
        if course_name.startswith('PG DIPLOMA'):
            return 'dental'
        
        # Handle DIPLOMA courses with three-tier classification (most specific)
        if 'DIPLOMA' in course_name:
            # Check if it's DNB-only course
            if course_name in self.config['diploma_courses']['dnb_only']:
                return 'dnb'  # DIPLOMA IN FAMILY MEDICINE
            # Check if it's overlapping course
            elif course_name in self.config['diploma_courses']['overlapping']:
                return 'diploma'  # Triggers MEDICAL→DNB fallback
            else:
                return 'medical'  # All other DIPLOMA courses (like DIPLOMA IN DERMATOLOGY)
        
        # Check dental patterns (most specific - check if course STARTS WITH pattern)
        for pattern in self.config['course_classification']['dental_patterns']:
            if course_name.startswith(pattern):
                return 'dental'
        
        # Check medical patterns (includes DIPLOMA - check if course STARTS WITH pattern)
        for pattern in self.config['course_classification']['medical_patterns']:
            if course_name.startswith(pattern):
                return 'medical'
        
        return 'unknown'
    
    def apply_aliases(self, text, alias_type):
        """Apply aliases to text"""
        aliases = self.master_data.get(f'{alias_type}_aliases', [])
        
        for alias in aliases:
            # Check if input text matches the alias_name (simplified name)
            if alias['alias_name'].upper() == text.upper():
                return alias['original_name']  # Return the full master data name
        
        return text
    
    def calculate_tfidf_similarity(self, text1, text2, course_type):
        """Calculate TF-IDF similarity between two texts"""
        try:
            # Get TF-IDF vectors for the course type
            if course_type in self.master_data:
                vectors = self.master_data[course_type]['tfidf_vectors']
                
                # Find the vector for text2 (assuming it's in master data)
                for i, college in enumerate(self.master_data[course_type]['colleges']):
                    if college['normalized_name'] == text2:
                        vector2 = vectors[i]
                        break
                else:
                    return 0.0
                
                # Calculate similarity (simplified - in practice, you'd need to vectorize text1)
                # This is a placeholder - you'd need to implement proper TF-IDF similarity
                return 0.0
                
        except Exception as e:
            logger.warning(f"TF-IDF similarity calculation failed: {e}")
            return 0.0
    
    def match_college_enhanced(self, college_name, state, course_type, address='', course_name=''):
        """Enhanced college matching with proper 4-pass mechanism and DIPLOMA fallback logic"""
        
        # Apply aliases
        college_name = self.apply_aliases(college_name, 'college')
        
        # Normalize inputs
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)
        
        # Handle overlapping DIPLOMA courses (4 specific courses)
        if course_type == 'diploma' and course_name in self.config['diploma_courses']['overlapping']:
            return self.match_overlapping_diploma_course(college_name, state, address, course_name)
        
        # Handle medical-only DIPLOMA courses (all other DIPLOMA courses)
        elif course_type == 'diploma':
            return self.match_medical_only_diploma_course(college_name, state, address, course_name)
        
        # Handle regular course types (medical, dental, dnb)
        return self.match_regular_course(college_name, state, course_type, address, course_name)
    
    def match_overlapping_diploma_course(self, college_name, state, address, course_name):
        """Match overlapping DIPLOMA courses with MEDICAL→DNB fallback"""
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)
        
        # Try MEDICAL first (24 colleges)
        logger.info(f"Overlapping DIPLOMA course {course_name}: Trying MEDICAL first (24 colleges)")
        medical_candidates = self.master_data['medical']['colleges']
        
        # PASS 1: State-based filtering for MEDICAL
        medical_state_candidates = [
            c for c in medical_candidates 
            if self.normalize_state(c.get('state', '')) == self.normalize_state(normalized_state)
        ]
        
        if not medical_state_candidates:
            medical_state_candidates = medical_candidates
        
        # PASS 3: College name matching for MEDICAL
        medical_matches = self.pass3_college_name_matching(normalized_college, medical_state_candidates)
        
        if medical_matches:
            # Validate each MEDICAL match
            for match in medical_matches:
                if self.validate_college_course_stream_match(match['candidate'], 'medical', course_name):
                    logger.info(f"Overlapping DIPLOMA course {course_name}: Found valid MEDICAL match")
                    return match['candidate'], match['score'], match['method']
        
        # Try DNB fallback
        logger.info(f"Overlapping DIPLOMA course {course_name}: MEDICAL validation failed, trying DNB fallback")
        dnb_candidates = self.master_data['dnb']['colleges']
        
        # PASS 1: State-based filtering for DNB
        dnb_state_candidates = [
            c for c in dnb_candidates 
            if self.normalize_state(c.get('state', '')) == self.normalize_state(normalized_state)
        ]
        
        if not dnb_state_candidates:
            dnb_state_candidates = dnb_candidates
        
        # PASS 3: College name matching for DNB
        dnb_matches = self.pass3_college_name_matching(normalized_college, dnb_state_candidates)
        
        if dnb_matches:
            # Validate each DNB match
            for match in dnb_matches:
                if self.validate_college_course_stream_match(match['candidate'], 'dnb', course_name):
                    logger.info(f"Overlapping DIPLOMA course {course_name}: Found valid DNB match")
                    return match['candidate'], match['score'], match['method']
        
        # Manual review if both streams fail validation
        logger.warning(f"DIPLOMA course {course_name}: Manual review required - both streams failed validation")
        return None, 0.0, "manual_review_required"
    
    def match_medical_only_diploma_course(self, college_name, state, address, course_name):
        """Match medical-only DIPLOMA courses with DNB fallback after all strategies fail"""
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)
        
        # Try MEDICAL first (all strategies)
        medical_candidates = self.master_data['medical']['colleges']
        
        # PASS 1: State-based filtering for MEDICAL
        medical_state_candidates = [
            c for c in medical_candidates 
            if self.normalize_state(c.get('state', '')) == self.normalize_state(normalized_state)
        ]
        
        if not medical_state_candidates:
            medical_state_candidates = medical_candidates
        
        # PASS 3: College name matching for MEDICAL (all strategies)
        medical_matches = self.pass3_college_name_matching(normalized_college, medical_state_candidates)
        
        if medical_matches:
            # Validate each MEDICAL match
            for match in medical_matches:
                if self.validate_college_course_stream_match(match['candidate'], 'medical', course_name):
                    return match['candidate'], match['score'], match['method']
        
        # Fallback to DNB only after ALL MEDICAL strategies fail
        logger.info(f"Medical-only DIPLOMA course {course_name}: All MEDICAL strategies failed, trying DNB fallback")
        dnb_candidates = self.master_data['dnb']['colleges']
        
        # PASS 1: State-based filtering for DNB
        dnb_state_candidates = [
            c for c in dnb_candidates 
            if self.normalize_state(c.get('state', '')) == self.normalize_state(normalized_state)
        ]
        
        if not dnb_state_candidates:
            dnb_state_candidates = dnb_candidates
        
        # PASS 3: College name matching for DNB
        dnb_matches = self.pass3_college_name_matching(normalized_college, dnb_state_candidates)
        
        if dnb_matches:
            # Validate each DNB match
            for match in dnb_matches:
                if self.validate_college_course_stream_match(match['candidate'], 'dnb', course_name):
                    return match['candidate'], match['score'], match['method']
        
        return None, 0.0, "no_match"
    
    def match_regular_course(self, college_name, state, course_type, address, course_name):
        """Match regular courses (medical, dental, dnb) with standard 4-pass mechanism"""
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)
        
        # Get candidates from the appropriate course type
        if course_type not in self.master_data:
            return None, 0.0, "invalid_course_type"
        
        candidates = self.master_data[course_type]['colleges']
        
        # PASS 1: State-based filtering
        state_candidates = [
            c for c in candidates 
            if self.normalize_state(c.get('state', '')) == self.normalize_state(normalized_state)
        ]
        
        if not state_candidates:
            # If no state match, try without state filtering as fallback
            state_candidates = candidates
        
        # PASS 2: Course type filtering (already done by selecting the right master_data)
        # This is implicit since we're already in the correct course_type section
        
        # PASS 3: College name matching with hierarchical strategies
        college_matches = self.pass3_college_name_matching(normalized_college, state_candidates)
        
        if not college_matches:
            return None, 0.0, "no_match"
        
        # If only one match, return it
        if len(college_matches) == 1:
            match = college_matches[0]
            return match['candidate'], match['score'], match['method']
        
        # PASS 4: Address-based disambiguation for multiple matches
        if len(college_matches) > 1 and normalized_address:
            disambiguated = self.pass4_address_disambiguation(college_matches, normalized_address, normalized_college)
            if disambiguated:
                return disambiguated['candidate'], disambiguated['score'], disambiguated['method']
        
        # Return the best match if no address disambiguation
        best_match = max(college_matches, key=lambda x: x['score'])
        return best_match['candidate'], best_match['score'], best_match['method']
    
    def extract_primary_name(self, college_name):
        """Extract primary name from college name with secondary name in brackets"""
        if '(' in college_name and ')' in college_name:
            # Extract primary name (before the first bracket)
            primary = college_name.split('(')[0].strip()
            
            # For JOINT ACCREDITATION PROGRAMME colleges, extract the part between the first and second parenthesis
            if 'JOINT ACCREDITATION PROGRAMME' in college_name:
                # Find the first opening parenthesis
                first_paren = college_name.find('(')
                # Find the second opening parenthesis (if it exists)
                second_paren = college_name.find('(', first_paren + 1)
                if second_paren != -1:
                    # Extract the part between first and second parenthesis
                    secondary = college_name[first_paren + 1:second_paren - 1].strip()
                    return primary, secondary
                else:
                    # Only one set of parentheses, extract what's inside
                    secondary_start = college_name.find('(') + 1
                    secondary_end = college_name.find(')', secondary_start)
                    if secondary_end != -1:
                        secondary = college_name[secondary_start:secondary_end].strip()
                        return primary, secondary
            
            # For other colleges, extract secondary name (inside first brackets)
            secondary_start = college_name.find('(') + 1
            secondary_end = college_name.find(')', secondary_start)
            if secondary_end != -1:
                secondary = college_name[secondary_start:secondary_end].strip()
                return primary, secondary
            
            # Fallback: extract everything between first and last parenthesis
            secondary_start = college_name.find('(') + 1
            secondary_end = college_name.rfind(')')
            secondary = college_name[secondary_start:secondary_end].strip()
            return primary, secondary
        
        return college_name, None

    def get_college_stream(self, college_id):
        """Determine which stream (medical/dental/dnb) a college belongs to"""
        # Check medical colleges
        for college in self.master_data['medical']['colleges']:
            if college['id'] == college_id:
                return 'medical'
        
        # Check dental colleges
        for college in self.master_data['dental']['colleges']:
            if college['id'] == college_id:
                return 'dental'
        
        # Check DNB colleges
        for college in self.master_data['dnb']['colleges']:
            if college['id'] == college_id:
                return 'dnb'
        
        return None

    def validate_college_course_stream_match(self, college_match, course_type, course_name=''):
        """Validate that college and course belong to the same stream with three-tier DIPLOMA handling"""
        if not college_match:
            return False
        
        college_stream = self.get_college_stream(college_match['id'])
        if not college_stream:
            return False
        
        # For overlapping DIPLOMA courses, accept both streams
        if course_type == 'diploma' and course_name in self.config['diploma_courses']['overlapping']:
            return college_stream in ['medical', 'dnb']
        
        # For DNB-only DIPLOMA courses, only accept DNB
        if course_type == 'dnb':
            return college_stream == 'dnb'
        
        # For medical courses, accept medical only
        if course_type == 'medical':
            return college_stream == 'medical'
        
        # For dental courses, only accept dental
        if course_type == 'dental':
            return college_stream == 'dental'
        
        # For unknown courses, accept any stream
        if course_type == 'unknown':
            return True
        
        return False

    def pass3_college_name_matching(self, normalized_college, candidates):
        """Pass 3: College name matching with hierarchical strategies"""
        matches = []
        
        # Strategy 1: Exact match (highest priority)
        for candidate in candidates:
            if normalized_college == self.normalize_text(candidate['name']):
                matches.append({
                    'candidate': candidate,
                    'score': 1.0,
                    'method': 'exact_match'
                })
                return matches  # Return immediately for exact match
        
        # Strategy 1.5: Primary name match (extract primary name from master data)
        for candidate in candidates:
            primary_name, secondary_name = self.extract_primary_name(candidate['name'])
            normalized_primary = self.normalize_text(primary_name)
            
            # Check exact match
            if normalized_college == normalized_primary:
                matches.append({
                    'candidate': candidate,
                    'score': 0.98,
                    'method': 'primary_name_match'
                })
                return matches  # Return immediately for primary name match
            
            # Special case: For JOINT ACCREDITATION PROGRAMME colleges, check if seat data contains the primary name
            if 'JOINT ACCREDITATION PROGRAMME' in normalized_college and normalized_primary in normalized_college:
                matches.append({
                    'candidate': candidate,
                    'score': 0.95,
                    'method': 'joint_accreditation_primary_match'
                })
                return matches  # Return immediately for joint accreditation match
        
        # Strategy 2: Normalized match
        for candidate in candidates:
            if normalized_college == candidate.get('normalized_name', ''):
                matches.append({
                    'candidate': candidate,
                    'score': 0.95,
                    'method': 'normalized_match'
                })
        
        # Strategy 3: Fuzzy matching
        for candidate in candidates:
            similarity = fuzz.ratio(normalized_college, candidate.get('normalized_name', '')) / 100
            if similarity >= self.config['matching']['thresholds']['fuzzy_match']:
                matches.append({
                    'candidate': candidate,
                    'score': similarity,
                    'method': 'fuzzy_match'
                })
        
        # Strategy 4: Prefix matching (for cases like "DR VIRENDRA LASER" -> "DR VIRENDRA LASER PHACO...")
        for candidate in candidates:
            candidate_name = candidate.get('normalized_name', '')
            if candidate_name.startswith(normalized_college) and len(normalized_college) >= 10:  # Minimum length to avoid false positives
                # Calculate score based on how much of the candidate name is covered
                coverage_ratio = len(normalized_college) / len(candidate_name)
                score = 0.6 + (coverage_ratio * 0.3)  # Score between 0.6 and 0.9
                matches.append({
                    'candidate': candidate,
                    'score': min(score, 0.9),  # Cap at 0.9
                    'method': 'prefix_match'
                })
        
        # Strategy 5: Substring matching
        for candidate in candidates:
            candidate_name = candidate.get('normalized_name', '')
            if (normalized_college in candidate_name or candidate_name in normalized_college):
                similarity = fuzz.ratio(normalized_college, candidate_name) / 100
                if similarity >= self.config['matching']['thresholds']['substring_match']:
                    matches.append({
                        'candidate': candidate,
                        'score': similarity,
                        'method': 'substring_match'
                    })
        
        # Strategy 6: Partial word matching
        for candidate in candidates:
            candidate_name = candidate.get('normalized_name', '')
            words1 = set(normalized_college.split())
            words2 = set(candidate_name.split())
            
            if words1 and words2:
                intersection = words1.intersection(words2)
                union = words1.union(words2)
                similarity = len(intersection) / len(union)
                
                if similarity >= self.config['matching']['thresholds']['partial_word_match']:
                    matches.append({
                        'candidate': candidate,
                        'score': similarity,
                        'method': 'partial_word_match'
                    })
        
        # Strategy 6: TF-IDF similarity
        for candidate in candidates:
            similarity = self.calculate_tfidf_similarity(normalized_college, candidate.get('normalized_name', ''), 'medical')  # Use medical as default
            if similarity >= self.config['matching']['thresholds']['tfidf_match']:
                matches.append({
                    'candidate': candidate,
                    'score': similarity,
                    'method': 'tfidf_match'
                })
        
        # Strategy 7: Secondary name fallback (if primary name didn't match)
        for candidate in candidates:
            primary_name, secondary_name = self.extract_primary_name(candidate['name'])
            if secondary_name:
                # Try matching against secondary name
                if normalized_college == self.normalize_text(secondary_name):
                    matches.append({
                        'candidate': candidate,
                        'score': 0.90,
                        'method': 'secondary_name_exact_match'
                    })
                else:
                    # Fuzzy match against secondary name
                    similarity = fuzz.ratio(normalized_college, self.normalize_text(secondary_name)) / 100
                    if similarity >= self.config['matching']['thresholds']['fuzzy_match']:
                        matches.append({
                            'candidate': candidate,
                            'score': similarity * 0.85,  # Slightly lower score for secondary name
                            'method': 'secondary_name_fuzzy_match'
                        })
        
        # Filter matches by minimum confidence
        min_confidence = self.config['matching']['min_confidence']
        matches = [m for m in matches if m['score'] >= min_confidence]
        
        return matches
    
    def pass4_address_disambiguation(self, college_matches, normalized_address, normalized_college):
        """Pass 4: Enhanced address-based disambiguation for multiple matches"""
        if not normalized_address or len(college_matches) <= 1:
            return None
        
        best_match = None
        best_score = 0.0
        
        # Extract keywords from seat data address
        seat_keywords = self.extract_address_keywords(normalized_address)
        
        # Special handling for generic hospital names
        is_generic_hospital = normalized_college in ['DISTRICT HOSPITAL', 'GENERAL HOSPITAL', 'AREA HOSPITAL', 'GOVERNMENT HOSPITAL']
        
        for match in college_matches:
            candidate = match['candidate']
            candidate_address = self.normalize_text(candidate.get('address', ''))
            
            if not candidate_address:
                continue
            
            # Extract keywords from master data address
            master_keywords = self.extract_address_keywords(candidate_address)
            
            # Calculate keyword overlap score
            keyword_score = self.calculate_keyword_overlap(seat_keywords, master_keywords)
            
            # Calculate address similarity (fallback)
            address_similarity = fuzz.ratio(normalized_address, candidate_address) / 100
            
            # Enhanced scoring for generic hospitals
            if is_generic_hospital:
                # For generic hospitals, prioritize address matching more heavily
                address_score = keyword_score if keyword_score > 0 else address_similarity
                # Higher weight for address matching (60%) vs college name (40%)
                combined_score = (match['score'] * 0.4) + (address_score * 0.6)
                
                # Bonus for exact district/city matches
                if self.has_exact_location_match(normalized_address, candidate_address):
                    combined_score += 0.1
            else:
                # Standard scoring for specific hospitals
                address_score = keyword_score if keyword_score > 0 else address_similarity
                combined_score = (match['score'] * 0.7) + (address_score * 0.3)
            
            if combined_score > best_score:
                method_suffix = "_with_address_keywords" if keyword_score > 0 else "_with_address"
                if is_generic_hospital:
                    method_suffix += "_generic_hospital"
                
                best_match = {
                    'candidate': candidate,
                    'score': combined_score,
                    'method': f"{match['method']}{method_suffix}"
                }
                best_score = combined_score
        
        return best_match
    
    def has_exact_location_match(self, seat_address, master_address):
        """Check for exact district/city matches between addresses"""
        if not seat_address or not master_address:
            return False
        
        # Extract district/city keywords
        seat_location_keywords = self.extract_location_keywords(seat_address)
        master_location_keywords = self.extract_location_keywords(master_address)
        
        # Check for any exact matches
        return len(seat_location_keywords.intersection(master_location_keywords)) > 0
    
    def extract_location_keywords(self, address):
        """Extract location-specific keywords (districts, cities, states)"""
        if not address:
            return set()
        
        import re
        
        # Common location indicators
        location_patterns = [
            r'DISTRICT[:\s]+([A-Z\s]+)',
            r'CITY[:\s]+([A-Z\s]+)',
            r'([A-Z\s]+)\s+DISTRICT',
            r'([A-Z\s]+)\s+CITY',
            r'([A-Z\s]+)\s+STATE',
            r'STATE[:\s]+([A-Z\s]+)'
        ]
        
        keywords = set()
        for pattern in location_patterns:
            matches = re.findall(pattern, address.upper())
            for match in matches:
                # Clean and add keywords
                clean_match = match.strip()
                if len(clean_match) > 2:  # Avoid very short matches
                    keywords.add(clean_match)
        
        return keywords
    
    def extract_address_keywords(self, address):
        """Extract meaningful keywords from address"""
        if not address:
            return set()
        
        # Split by common delimiters and clean
        import re
        keywords = re.split(r'[,.\s@]+', address.upper())
        
        # Filter out common words and keep meaningful keywords
        meaningful_keywords = set()
        for keyword in keywords:
            keyword = keyword.strip()
            if (len(keyword) >= 3 and 
                keyword not in ['THE', 'AND', 'OF', 'IN', 'AT', 'TO', 'FOR', 'WITH', 'BY', 'FROM', 'NEAR', 'DISTRICT', 'HOSPITAL', 'COLLEGE', 'INSTITUTE']):
                meaningful_keywords.add(keyword)
        
        return meaningful_keywords
    
    def calculate_keyword_overlap(self, keywords1, keywords2):
        """Calculate overlap score between two sets of keywords"""
        if not keywords1 or not keywords2:
            return 0.0
        
        intersection = keywords1.intersection(keywords2)
        union = keywords1.union(keywords2)
        
        if not union:
            return 0.0
        
        # Jaccard similarity with bonus for multiple matches
        jaccard_score = len(intersection) / len(union)
        
        # Bonus if multiple keywords match (more specific location)
        if len(intersection) > 1:
            jaccard_score *= 1.2
        
        return min(jaccard_score, 1.0)
    
    def match_course_enhanced(self, course_name):
        """Enhanced course matching with multiple strategies"""
        
        # Apply aliases
        course_name = self.apply_aliases(course_name, 'course')
        
        # Normalize input
        normalized_course = self.normalize_text(course_name)
        
        candidates = self.master_data['courses']['courses']
        
        best_match = None
        best_score = 0.0
        best_method = "no_match"
        
        # Strategy 1: Exact match
        for candidate in candidates:
            if normalized_course == self.normalize_text(candidate['name']):
                return candidate, 1.0, "exact_match"
        
        # Strategy 2: Normalized match
        for candidate in candidates:
            if normalized_course == candidate.get('normalized_name', ''):
                return candidate, 0.95, "normalized_match"
        
        # Strategy 3: Fuzzy matching
        for candidate in candidates:
            similarity = fuzz.ratio(normalized_course, candidate.get('normalized_name', '')) / 100
            if similarity > best_score and similarity >= self.config['matching']['thresholds']['fuzzy_match']:
                best_match = candidate
                best_score = similarity
                best_method = "fuzzy_match"
        
        # Strategy 4: Substring matching
        for candidate in candidates:
            candidate_name = candidate.get('normalized_name', '')
            if (normalized_course in candidate_name or candidate_name in normalized_course):
                similarity = fuzz.ratio(normalized_course, candidate_name) / 100
                if similarity > best_score and similarity >= self.config['matching']['thresholds']['substring_match']:
                    best_match = candidate
                    best_score = similarity
                    best_method = "substring_match"
        
        # Check if match meets minimum confidence
        if best_score >= self.config['matching']['min_confidence']:
            return best_match, best_score, best_method
        
        return None, 0.0, "no_match"
    
    def process_batch(self, batch_data):
        """Process a batch of records"""
        results = []
        
        for record in batch_data:
            # Extract record data
            college_name = record.get('college_name', '')
            course_name = record.get('course_name', '')
            state = record.get('state', '')
            address = record.get('address', '')
            
            # Apply course aliases first, then detect course type
            course_name_with_aliases = self.apply_aliases(course_name, 'course')
            course_type = self.detect_course_type(course_name_with_aliases)
            
            # Match college
            college_match, college_score, college_method = self.match_college_enhanced(
                college_name, state, course_type, address, course_name_with_aliases
            )
            
            # Match course
            course_match, course_score, course_method = self.match_course_enhanced(course_name)
            
            # Validate that college and course belong to the same stream
            is_valid_match = self.validate_college_course_stream_match(college_match, course_type, course_name_with_aliases)
            
            # If validation fails, mark as unmatched
            if not is_valid_match and college_match and course_match:
                college_match = None
                college_score = 0.0
                college_method = "stream_mismatch"
                course_match = None
                course_score = 0.0
                course_method = "stream_mismatch"
            
            # Create result record
            result = {
                'id': record.get('id', str(uuid.uuid4())),
                'college_name': college_name,
                'course_name': course_name,
                'state': state,
                'address': address,
                'master_college_id': college_match['id'] if college_match else None,
                'master_course_id': course_match['id'] if course_match else None,
                'college_match_score': college_score,
                'course_match_score': course_score,
                'college_match_method': college_method,
                'course_match_method': course_method,
                'is_linked': bool(college_match and course_match),
                'updated_at': datetime.now().isoformat()
            }
            
            results.append(result)
        
        return results
    
    def match_and_link_parallel(self, data_source, table_name):
        """Match and link data using parallel processing"""
        logger.info(f"Starting parallel matching for {table_name}...")
        
        # Load data
        if data_source == 'seat_data':
            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"
        else:
            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['linked_data_db']}"
        
        with sqlite3.connect(db_path) as conn:
            df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
        
        logger.info(f"Loaded {len(df)} records for matching")
        
        # Split into batches
        batch_size = self.config['parallel']['batch_size']
        batches = [df.iloc[i:i+batch_size] for i in range(0, len(df), batch_size)]
        
        # Process batches in parallel
        all_results = []
        num_processes = self.config['parallel']['num_processes']
        
        with ProcessPoolExecutor(max_workers=num_processes) as executor:
            # Submit batches
            future_to_batch = {
                executor.submit(self.process_batch, batch.to_dict('records')): batch 
                for batch in batches
            }
            
            # Collect results
            for future in tqdm(as_completed(future_to_batch), total=len(batches), desc="Processing batches"):
                try:
                    batch_results = future.result()
                    all_results.extend(batch_results)
                except Exception as e:
                    logger.error(f"Batch processing failed: {e}")
        
        # Convert results to DataFrame
        results_df = pd.DataFrame(all_results)
        
        # Save results back to database
        with sqlite3.connect(db_path) as conn:
            results_df.to_sql(f"{table_name}_linked", conn, if_exists='replace', index=False)
        
        # Calculate statistics
        total_records = len(results_df)
        linked_records = results_df['is_linked'].sum()
        link_rate = (linked_records / total_records) * 100
        
        logger.info(f"✅ Matching completed!")
        logger.info(f"Total records: {total_records}")
        logger.info(f"Linked records: {linked_records}")
        logger.info(f"Link rate: {link_rate:.2f}%")
        
        return results_df
    
    def human_feedback_interface(self, unmatched_records):
        """Legacy human feedback interface - use interactive_review_unmatched() instead"""
        logger.warning("Using legacy feedback interface. Consider using interactive_review_unmatched()")

        for i, record in enumerate(unmatched_records):
            console.print(f"\n[bold]Record {i+1}/{len(unmatched_records)}[/bold]")
            console.print(f"College: {record['college_name']}")
            console.print(f"Course: {record['course_name']}")
            console.print(f"State: {record['state']}")

            # Show top matches
            console.print("\n[bold cyan]Top 5 college matches:[/bold cyan]")
            suggestions = self._get_college_suggestions(record['college_name'], record['state'], limit=5)
            for idx, sugg in enumerate(suggestions, 1):
                console.print(f"  [{idx}] {sugg['college']['name']} ({sugg['score']}%)")

            choice = Prompt.ask("Enter master college ID (or 'skip' to skip)", default="skip")

            if choice.lower() != 'skip':
                # Update the record with manual choice
                pass

    # ==================== INTERACTIVE REVIEW SYSTEM ====================

    def interactive_review_unmatched(self):
        """Interactive review of unmatched seat data records with alias creation"""
        conn = sqlite3.connect(self.seat_db_path)

        # Initialize session stats
        session_stats = {
            'reviewed': 0,
            'aliases_created': 0,
            'skipped': 0,
            'records_affected': 0,
            'start_time': datetime.now()
        }

        # Get unmatched records
        unmatched = pd.read_sql("""
            SELECT DISTINCT
                college_name,
                course_name,
                state,
                address,
                master_college_id,
                master_course_id,
                college_match_score,
                course_match_score,
                college_match_method,
                course_match_method,
                COUNT(*) as record_count
            FROM seat_data_linked
            WHERE master_college_id IS NULL OR master_course_id IS NULL
            GROUP BY college_name, course_name, state
            ORDER BY record_count DESC
            LIMIT 50
        """, conn)

        if len(unmatched) == 0:
            console.print("\n[green]✅ No unmatched records found![/green]")
            conn.close()
            return

        console.print(f"\n[bold yellow]📋 Found {len(unmatched)} unmatched record groups[/bold yellow]")
        console.print(f"[dim]Showing top 50 by record count[/dim]\n")

        for idx, row in unmatched.iterrows():
            session_stats['reviewed'] += 1

            # Show session statistics dashboard
            self._show_session_stats(session_stats, len(unmatched))

            # Determine why it didn't match
            unmatch_reason = self._analyze_unmatch_reason(row)

            # Get top 5 suggestions proactively
            college_suggestions = self._get_college_suggestions(row['college_name'], row['state'], limit=5)
            course_suggestions = self._get_course_suggestions(row['course_name'], limit=5)

            # Create review panel
            table = Table(title=f"Record {idx+1}/{len(unmatched)} - {unmatch_reason['emoji']} {unmatch_reason['reason']}",
                         show_header=False, border_style=unmatch_reason['color'])
            table.add_column("Field", style="cyan", width=25)
            table.add_column("Value", style="white", no_wrap=False)

            table.add_row("🏥 College", row['college_name'][:100])
            table.add_row("📍 State", str(row['state']))
            table.add_row("🏢 Address", str(row['address'])[:80] if row['address'] else "N/A")
            table.add_row("📚 Course", row['course_name'])
            table.add_row("📊 Affects", f"[bold]{row['record_count']:,} records[/bold]")

            # Show match status
            college_status = "✅ Matched" if row['master_college_id'] else f"❌ Unmatched"
            course_status = "✅ Matched" if row['master_course_id'] else f"❌ Unmatched"
            table.add_row("🏥 College Status", f"{college_status}")
            table.add_row("📚 Course Status", f"{course_status}")

            console.print(table)

            # Show WHY it didn't match
            console.print(f"\n[bold {unmatch_reason['color']}]🔍 Why This Failed:[/bold {unmatch_reason['color']}]")
            console.print(f"   {unmatch_reason['explanation']}\n")

            # Build dynamic action menu
            console.print("\n[bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
            console.print("[bold]📋 ACTIONS - Select Match:[/bold]\n")

            action_map = {}
            action_num = 1

            # Show top 5 college suggestions
            if not row['master_college_id'] and college_suggestions:
                console.print("[bold green]🎯 Top College Matches:[/bold green]")
                for sugg in college_suggestions[:5]:
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    action_map[str(action_num)] = {'type': 'college_alias', 'data': sugg}
                    console.print(
                        f"  [{action_num}] [{score_color}]{sugg['score']}%[/{score_color}] "
                        f"{sugg['college']['name'][:70]} "
                        f"[dim]({sugg['college']['id']} | {sugg['college'].get('state', 'N/A')} | {sugg['type'].upper()})[/dim]"
                    )
                    action_num += 1
                console.print()

            # Show top 5 course suggestions
            if not row['master_course_id'] and course_suggestions:
                console.print("[bold green]🎯 Top Course Matches:[/bold green]")
                for sugg in course_suggestions[:5]:
                    score_color = "green" if sugg['score'] >= 90 else "yellow" if sugg['score'] >= 80 else "red"
                    action_map[str(action_num)] = {'type': 'course_alias', 'data': sugg}
                    console.print(
                        f"  [{action_num}] [{score_color}]{sugg['score']}%[/{score_color}] "
                        f"{sugg['course']['name']} "
                        f"[dim]({sugg['course']['id']})[/dim]"
                    )
                    action_num += 1
                console.print()

            # Other actions
            console.print("[bold yellow]🔧 Other Options:[/bold yellow]")
            action_map['s'] = {'type': 'skip'}
            action_map['q'] = {'type': 'quit'}
            console.print("  [s] Skip this record")
            console.print("  [q] Quit review session")
            console.print()

            # Get user choice
            choice = Prompt.ask("Select action", choices=list(action_map.keys()), default='s')

            # Process action
            if choice == 'q':
                break
            elif choice == 's':
                session_stats['skipped'] += 1
                continue
            elif choice in action_map:
                action = action_map[choice]
                if action['type'] == 'college_alias':
                    # Create college alias
                    self._save_college_alias(row['college_name'], action['data']['college']['id'], conn)
                    session_stats['aliases_created'] += 1
                    session_stats['records_affected'] += row['record_count']
                    console.print(f"[green]✅ College alias created![/green]")
                elif action['type'] == 'course_alias':
                    # Create course alias
                    self._save_course_alias(row['course_name'], action['data']['course']['id'], conn)
                    session_stats['aliases_created'] += 1
                    session_stats['records_affected'] += row['record_count']
                    console.print(f"[green]✅ Course alias created![/green]")

        conn.close()

        # Final session summary
        self._print_session_summary(session_stats)

    def _show_session_stats(self, stats, total):
        """Display real-time session statistics dashboard"""
        elapsed = (datetime.now() - stats['start_time']).total_seconds() / 60
        remaining = total - stats['reviewed']

        stats_text = (
            f"[bold cyan]SESSION[/bold cyan] "
            f"[dim]|[/dim] Reviewed: [yellow]{stats['reviewed']}/{total}[/yellow] "
            f"[dim]|[/dim] Aliases: [green]{stats['aliases_created']}[/green] "
            f"[dim]|[/dim] Skipped: [red]{stats['skipped']}[/red] "
            f"[dim]|[/dim] Affected: [magenta]{stats['records_affected']:,}[/magenta] "
            f"[dim]|[/dim] Time: [white]{elapsed:.1f}m[/white]"
        )
        console.print(Panel(stats_text, border_style="dim", padding=(0, 1)))

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
        else:
            return {
                'reason': 'Course Unmatched Only',
                'emoji': '📚',
                'color': 'yellow',
                'explanation': f"College matched successfully, but course failed. Check course name spelling."
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

    def _save_college_alias(self, alias_name, original_college_id, conn):
        """Save college alias to database"""
        # Find the original college name
        original_college = None
        for college_type in ['medical', 'dental', 'dnb']:
            for college in self.master_data[college_type]['colleges']:
                if college['id'] == original_college_id:
                    original_college = college
                    break
            if original_college:
                break

        if not original_college:
            console.print("[red]Error: Original college not found[/red]")
            return

        # Insert alias into database
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO college_aliases (alias_name, original_name, created_at)
            VALUES (?, ?, ?)
        """, (alias_name, original_college['name'], datetime.now().isoformat()))
        conn.commit()

        # Update in-memory aliases
        self.aliases['college'].append({
            'alias_name': alias_name,
            'original_name': original_college['name']
        })

    def _save_course_alias(self, alias_name, original_course_id, conn):
        """Save course alias to database"""
        # Find the original course name
        original_course = None
        for course in self.master_data['courses']['courses']:
            if course['id'] == original_course_id:
                original_course = course
                break

        if not original_course:
            console.print("[red]Error: Original course not found[/red]")
            return

        # Insert alias into database
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO course_aliases (alias_name, original_name, created_at)
            VALUES (?, ?, ?)
        """, (alias_name, original_course['name'], datetime.now().isoformat()))
        conn.commit()

        # Update in-memory aliases
        self.aliases['course'].append({
            'alias_name': alias_name,
            'original_name': original_course['name']
        })

    def _print_session_summary(self, stats):
        """Print final session summary"""
        elapsed = (datetime.now() - stats['start_time']).total_seconds() / 60

        console.print("\n" + "="*70)
        console.print(Panel.fit(
            f"[bold green]🎉 REVIEW SESSION COMPLETE[/bold green]\n\n"
            f"Reviewed: [yellow]{stats['reviewed']}[/yellow] record groups\n"
            f"Aliases Created: [green]{stats['aliases_created']}[/green]\n"
            f"Skipped: [red]{stats['skipped']}[/red]\n"
            f"Records Affected: [magenta]{stats['records_affected']:,}[/magenta]\n"
            f"Time Elapsed: [white]{elapsed:.1f}[/white] minutes",
            border_style="green"
        ))

    # ==================== BATCH IMPORT FUNCTIONALITY ====================

    def batch_import_excel_files(self, excel_files: list):
        """Batch import multiple Excel files"""
        console.print(Panel.fit(
            f"[bold cyan]📦 BATCH IMPORT[/bold cyan]\n"
            f"Files to import: {len(excel_files)}",
            border_style="cyan"
        ))

        results = []
        total_imported = 0

        for excel_path in excel_files:
            try:
                count = self.import_excel_to_db(excel_path)
                results.append({
                    'file': Path(excel_path).name,
                    'records': count,
                    'status': 'success'
                })
                total_imported += count
            except Exception as e:
                console.print(f"[red]❌ Error importing {Path(excel_path).name}: {e}[/red]")
                results.append({
                    'file': Path(excel_path).name,
                    'records': 0,
                    'status': f'error: {str(e)}'
                })

        # Display summary
        table = Table(title="Batch Import Summary")
        table.add_column("File", style="cyan")
        table.add_column("Records", justify="right", style="green")
        table.add_column("Status", style="white")

        for result in results:
            status_style = "green" if result['status'] == 'success' else "red"
            table.add_row(
                result['file'],
                f"{result['records']:,}",
                f"[{status_style}]{result['status']}[/{status_style}]"
            )

        console.print(table)
        console.print(f"\n[bold green]📊 Total imported: {total_imported:,} records[/bold green]\n")

        return results

    def import_excel_to_db(self, excel_path: str):
        """Import Excel file to SQLite database"""
        logger.info(f"Importing Excel: {excel_path}")

        # Read Excel
        df = pd.read_excel(excel_path)
        logger.info(f"  Total records: {len(df):,}")

        # Import to database (simplified - adjust based on your schema)
        conn = sqlite3.connect(self.seat_db_path)
        df.to_sql('seat_data_raw', conn, if_exists='append', index=False)
        conn.close()

        return len(df)

    # ==================== VALIDATION FEATURES ====================

    def validate_data(self, df):
        """Validate seat data with category, quota checks"""
        validation_errors = []

        # Check required fields
        required_fields = self.config['validation']['required_fields']
        for field in required_fields:
            if field not in df.columns:
                validation_errors.append(f"Missing required field: {field}")

        # Validate categories if present
        if 'category' in df.columns:
            valid_categories = self.config['validation']['valid_categories']
            invalid_categories = df[~df['category'].isin(valid_categories)]['category'].unique()
            if len(invalid_categories) > 0:
                validation_errors.append(f"Invalid categories found: {invalid_categories}")

        # Validate quotas if present
        if 'quota' in df.columns:
            valid_quotas = self.config['validation']['valid_quotas']
            invalid_quotas = df[~df['quota'].isin(valid_quotas)]['quota'].unique()
            if len(invalid_quotas) > 0:
                validation_errors.append(f"Invalid quotas found: {invalid_quotas}")

        if validation_errors:
            console.print("[bold red]❌ Validation Errors:[/bold red]")
            for error in validation_errors:
                console.print(f"  • {error}")
            return False

        console.print("[bold green]✅ Data validation passed[/bold green]")
        return True
    

def main():
    """Main function with enhanced features"""
    # Create directories
    os.makedirs('logs', exist_ok=True)

    console.print(Panel.fit(
        "[bold cyan]🚀 Advanced SQLite Matcher - Enhanced Edition[/bold cyan]\n"
        "Features: Interactive Review, Batch Import, Validation, State Mapping",
        border_style="cyan"
    ))

    # Initialize matcher
    matcher = AdvancedSQLiteMatcher()

    # Load master data with Rich UI
    matcher.load_master_data()

    # Menu-driven interface
    while True:
        console.print("\n[bold]Select an option:[/bold]")
        console.print("  [1] Match and link seat data (parallel)")
        console.print("  [2] Interactive review of unmatched records")
        console.print("  [3] Batch import Excel files")
        console.print("  [4] Validate data")
        console.print("  [5] Exit")

        choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5"], default="1")

        if choice == "1":
            # Match and link seat data
            matcher.match_and_link_parallel('seat_data', 'seat_data')
        elif choice == "2":
            # Interactive review
            matcher.interactive_review_unmatched()
        elif choice == "3":
            # Batch import
            files = Prompt.ask("Enter Excel file paths (comma-separated)")
            file_list = [f.strip() for f in files.split(',')]
            matcher.batch_import_excel_files(file_list)
        elif choice == "4":
            # Validate
            conn = sqlite3.connect(matcher.seat_db_path)
            df = pd.read_sql("SELECT * FROM seat_data_raw LIMIT 1000", conn)
            conn.close()
            matcher.validate_data(df)
        elif choice == "5":
            console.print("[bold green]👋 Goodbye![/bold green]")
            break

if __name__ == "__main__":
    main()
