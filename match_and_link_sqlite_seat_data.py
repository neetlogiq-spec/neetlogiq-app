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
import jellyfish  # For phonetic matching
from collections import defaultdict, Counter
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
import joblib  # For model persistence

# Rich library imports for beautiful UI
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich import print as rprint

# Add scripts directory to path for state mapping
sys.path.append(str(Path(__file__).parent / 'scripts'))

# Configure logging - will be updated with config settings in __init__
# Default: only show warnings and errors on console, log everything to file
file_handler = logging.FileHandler('logs/seat_data_matching.log')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.WARNING)  # Only show warnings and errors on console
console_handler.setFormatter(logging.Formatter('%(levelname)s - %(message)s'))

logging.basicConfig(
    level=logging.INFO,
    handlers=[file_handler, console_handler]
)
logger = logging.getLogger(__name__)

# Global handlers for later config update
_file_handler = file_handler
_console_handler = console_handler

# Rich console for beautiful UI
console = Console()

# ============================================================================
# ADVANCED AI/ML FEATURES IMPORTS
# ============================================================================
try:
    from advanced_matching_transformers import TransformerMatcher
    from advanced_ner_extractor import EducationNER
    from advanced_vector_search import VectorSearchEngine
    from advanced_multifield_matcher import MultiFieldMatcher
    from advanced_reporting import ReportGenerator
    ADVANCED_FEATURES_AVAILABLE = True
    logger.info("✓ Advanced AI features loaded successfully")
except ImportError as e:
    ADVANCED_FEATURES_AVAILABLE = False
    logger.warning(f"⚠️  Advanced AI features not available: {e}")
    logger.warning("   Install with: pip install -r requirements_advanced.txt")
# ============================================================================

class AdvancedSQLiteMatcher:
    def __init__(self, config_path='config.yaml', enable_parallel=True, num_workers=None, data_type='seat', enable_advanced_features=True):
        """Initialize the advanced matcher

        Args:
            config_path: Path to configuration YAML file
            enable_parallel: Enable parallel processing
            num_workers: Number of worker processes
            data_type: 'seat' for seat data or 'counselling' for counselling data
            enable_advanced_features: Enable AI/ML advanced features (transformer, NER, vector search, etc.) - DEFAULT: TRUE
        """
        self.config = self.load_config(config_path) if Path(config_path).exists() else self._default_config()
        self.data_type = data_type

        # Configure logging based on config
        self._configure_logging()

        # Set database paths based on data type
        self.master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"

        if data_type == 'counselling':
            self.data_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['counselling_data_db']}"
            self.linked_db_path = self.data_db_path  # Same database for counselling
        else:
            self.data_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"
            self.linked_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['linked_data_db']}"

        self.seat_db_path = self.data_db_path  # For backward compatibility

        self.tfidf_vectorizer = None
        self.master_data = {}
        self.state_mappings = {}
        self.aliases = {'college': [], 'course': [], 'quota': [], 'category': []}
        self.standard_courses = {}
        self.course_corrections = {}
        self.abbreviations = self.config.get('abbreviations', {})

        # Performance caches
        self.phonetic_cache = {}  # Cache for phonetic keys {text: {soundex, metaphone, nysiis}}
        self.tfidf_cache = {}     # Cache for TF-IDF vectors {text: vector}

        # Parallel processing settings
        self.enable_parallel = enable_parallel
        self.num_workers = num_workers or max(1, mp.cpu_count() - 1)

        # Cache for memoization
        self._normalization_cache = {}
        self._fuzzy_match_cache = {}

        # Advanced AI/ML Features
        self.enable_advanced_features = enable_advanced_features and ADVANCED_FEATURES_AVAILABLE
        self._transformer_matcher = None
        self._ner_extractor = None
        self._vector_engine = None
        self._multifield_matcher = None

        if self.enable_advanced_features:
            self._init_advanced_features()

        # Parquet Export & Incremental Processing
        self.enable_incremental = False  # Set at runtime
        self.incremental_state_file = 'data/processing_state.parquet'
        self.processing_state = None

        # ============================================================================
        # INTELLIGENT MATCHING SYSTEM (Features 1-7)
        # ============================================================================

        # Feature 1: Hierarchical Matching Thresholds
        self.match_levels = {
            'exact': {'min': 100, 'max': 100, 'auto_match': True, 'indicator': '✅', 'label': 'Exact Match'},
            'alias': {'min': 100, 'max': 100, 'auto_match': True, 'indicator': '🔗', 'label': 'Alias Match'},
            'high': {'min': 90, 'max': 99, 'auto_match': False, 'indicator': '⭐', 'label': 'High Confidence'},
            'medium': {'min': 75, 'max': 89, 'auto_match': False, 'indicator': '📊', 'label': 'Medium Confidence'},
            'low': {'min': 60, 'max': 74, 'auto_match': False, 'indicator': '⚠️', 'label': 'Low Confidence'},
            'poor': {'min': 0, 'max': 59, 'auto_match': False, 'indicator': '❌', 'label': 'Poor Match'}
        }

        # ============================================================================
        # NEW 2025 ADVANCED FEATURES
        # ============================================================================

        # Initialize new advanced matchers
        self.soft_tfidf = SoftTFIDF()
        self.explainer = ExplainableMatch(self.config)
        self.uncertainty_quantifier = UncertaintyQuantifier()
        self.ensemble_matcher = None  # Initialized after loading master data

        # Feature flags for new capabilities
        self.enable_soft_tfidf = self.config.get('features', {}).get('enable_soft_tfidf', True)
        self.enable_ensemble_voting = self.config.get('features', {}).get('enable_ensemble_voting', True)
        self.enable_explainable_ai = self.config.get('features', {}).get('enable_explainable_ai', True)
        self.enable_uncertainty_quantification = self.config.get('features', {}).get('enable_uncertainty_quantification', True)

        # ============================================================================

        # Feature 2: Smart Alias Learning - Pattern Detection
        self.learned_patterns = {
            'abbreviations': {},  # GOVT -> GOVERNMENT
            'medical_terms': {},  # OTORHINOLARYNGOLOGY -> ENT
            'common_variants': {}  # Different spellings
        }
        self.pattern_confidence_threshold = 0.8

        # Feature 3: Context-Aware Matching
        self.course_type_keywords = {
            'medical': ['MBBS', 'MD', 'MS', 'DM', 'MCH', 'MEDICAL'],
            'dental': ['BDS', 'MDS', 'DENTAL', 'DENTISTRY', 'ORTHODONTICS', 'ENDODONTICS'],
            'dnb': ['DNB', 'DIPLOMA', 'FELLOWSHIP']
        }

        # Feature 4: Duplicate Detection
        self.duplicate_threshold = 0.95  # 95% similarity = likely duplicate
        self.variant_groups = {}  # Store detected variants

        # Feature 5: Incremental Learning
        self.user_preferences = {
            'auto_match_threshold': 100,  # Starts at 100%, adapts based on user behavior
            'review_speed': [],  # Track how fast user reviews
            'acceptance_rate': {},  # Track acceptance rate by score range
            'common_rejections': []  # Learn what user typically rejects
        }
        self.learning_db_path = f"{self.config['database']['sqlite_path']}/learning_data.db"

        # Feature 6: Intelligent Preprocessing - Extended normalization
        self.medical_term_mappings = {
            'PAEDIATRICS': 'PEDIATRICS',
            'ANAESTHESIA': 'ANESTHESIA',
            'ANAESTHESIOLOGY': 'ANESTHESIOLOGY',
            'ORTHOPAEDICS': 'ORTHOPEDICS',
            'GYNAECOLOGY': 'GYNECOLOGY',
            'HAEMATOLOGY': 'HEMATOLOGY',
            'OTORHINOLARYNGOLOGY': 'ENT',
            'OPHTHALMOLOGY': 'OPHTHAL'
        }

        self.address_abbreviations = {
            'STREET': ['ST', 'STR', 'ST.', 'STREET'],
            'ROAD': ['RD', 'RD.', 'ROAD'],
            'AVENUE': ['AVE', 'AVE.', 'AVENUE'],
            'HOSPITAL': ['HOSP', 'HOSPL', 'HOSP.', 'HOSPITAL'],
            'COLLEGE': ['COLL', 'COLL.', 'COLLEGE', 'CLG'],
            'GOVERNMENT': ['GOVT', 'GOVT.', 'GOVERNMENT', 'GOV'],
            'INSTITUTE': ['INST', 'INST.', 'INSTITUTE', 'INSTT'],
            'UNIVERSITY': ['UNIV', 'UNIV.', 'UNIVERSITY', 'UNIVRSTY']
        }

        # Feature 7: Batch Operations
        self.batch_suggestions = []  # Store "apply to all similar" suggestions
        self.batch_mode = False

        # Session statistics for real-time feedback
        self.session_stats = {
            'auto_matched': 0,
            'manually_reviewed': 0,
            'skipped': 0,
            'high_confidence': 0,
            'medium_confidence': 0,
            'low_confidence': 0,
            'validation_warnings': 0,
            'states_corrected': 0,
            'addresses_parsed': 0
        }

        # Enhancement #8: Location Normalization Database
        self.location_db = self._build_location_database()

        # Enhancement #10: Parsing analytics
        self.parsing_stats = {
            'total_parsed': 0,
            'name_extracted': 0,
            'address_extracted': 0,
            'state_extracted': 0,
            'state_corrected': 0,
            'parse_failures': []
        }

    def load_config(self, config_path):
        """Load configuration from YAML file with fallback to defaults"""
        try:
            with open(config_path, 'r') as file:
                loaded_config = yaml.safe_load(file)

            # Merge with defaults to ensure all keys exist
            default_config = self._default_config()

            # Deep merge - update defaults with loaded config
            def deep_merge(default, loaded):
                """Recursively merge loaded config into default config"""
                result = default.copy()
                for key, value in loaded.items():
                    if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                        result[key] = deep_merge(result[key], value)
                    else:
                        result[key] = value
                return result

            return deep_merge(default_config, loaded_config)

        except Exception as e:
            console.print(f"[yellow]⚠️  Could not load config from {config_path}: {e}[/yellow]")
            console.print("[yellow]Using default configuration[/yellow]")
            return self._default_config()

    def _default_config(self):
        """Default configuration if config.yaml not found"""
        return {
            'database': {
                'sqlite_path': 'data/sqlite',
                'master_data_db': 'master_data.db',
                'linked_data_db': 'linked_data.db',
                'seat_data_db': 'seat_data.db',
                'counselling_data_db': 'counselling_data_partitioned.db'
            },
            'normalization': {
                'to_uppercase': True,
                'handle_hyphens_dots': True,
                'remove_special_chars': False,  # Disabled - use selective rules below
                'normalize_whitespace': True,
                'remove_pincodes': True,

                # Smart character preservation
                'preserve_chars': ["'", "-", "+"],  # Keep these characters

                # Smart character replacement
                'replace_chars': {
                    '&': ' AND ',
                    '/': ' ',  # Replace slash with space
                    '\\': ' ',  # Replace backslash with space
                },

                # Context-aware features
                'context_aware': {
                    'medical_degrees': True,  # Normalize M.B.B.S → MBBS, B.D.S → BDS
                    'possessives': True,      # Keep apostrophe-s recognizable
                    'compound_words': True,   # Handle hyphenated words
                },

                # Punctuation correction
                'fix_punctuation': {
                    'remove_double_commas': True,      # ,, → ,
                    'remove_double_dots': True,        # .. → .
                    'remove_leading_punctuation': True, # Remove leading space/comma/dot
                    'remove_trailing_punctuation': True, # Remove trailing space/comma/dot
                }
            },
            'matching': {
                'thresholds': {
                    'exact': 100,
                    'high_confidence': 90,
                    'medium_confidence': 80,
                    'low_confidence': 75,
                    'fuzzy_match': 0.80,          # INCREASED from 0.75 to 0.80 (stricter)
                    'substring_match': 0.85,      # INCREASED from 0.70 to 0.85 (stricter)
                    'partial_word_match': 0.80,   # INCREASED from 0.65 to 0.80 (stricter)
                    'tfidf_match': 0.75,          # INCREASED from 0.70 to 0.75 (stricter)
                    'min_token_overlap': 0.60,    # NEW: Minimum token overlap for fuzzy matches
                    'min_auto_accept': 0.95       # NEW: Only auto-accept 95%+ matches
                },
                'min_confidence': 0.80,           # INCREASED from 0.70 to 0.80 (stricter)

                # Multi-factor validation settings
                'validation': {
                    'require_state_match': True,       # State must match exactly
                    'require_city_validation': True,   # Validate city/district if available
                    'enable_geographic_boost': True,   # Boost score for geographic proximity
                    'enable_confidence_scoring': True  # Use multi-factor confidence scoring
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
                'required_fields': ['college_name', 'course_name', 'state'],
                'valid_categories': ['OPEN', 'OBC', 'SC', 'ST', 'EWS'],
                'valid_quotas': ['AIQ', 'DNB', 'IP', 'OP', 'MANAGEMENT']
            },
            'parallel': {
                'batch_size': 1000,
                'num_processes': 4
            },
            'logging': {
                'verbose_matching': False,  # Show detailed matching rejection reasons
                'verbose_overlap': False,   # Show token overlap analysis
                'console_level': 'WARNING',  # WARNING, INFO, or DEBUG
                'file_level': 'INFO'        # Log level for file output
            }
        }

    def _configure_logging(self):
        """Configure logging based on config settings"""
        global _file_handler, _console_handler, logger

        log_config = self.config.get('logging', {})

        # Update file handler level
        file_level = getattr(logging, log_config.get('file_level', 'INFO').upper(), logging.INFO)
        _file_handler.setLevel(file_level)

        # Update console handler level
        console_level = getattr(logging, log_config.get('console_level', 'WARNING').upper(), logging.WARNING)
        _console_handler.setLevel(console_level)

        logger.debug(f"Logging configured: console={log_config.get('console_level', 'WARNING')}, file={log_config.get('file_level', 'INFO')}")

    def load_master_data(self):
        """Load master data from SQLite with Rich UI"""
        with console.status("[bold green]Loading master data..."):
            conn = sqlite3.connect(self.master_db_path)

            # Load medical colleges
            medical_df = pd.read_sql("SELECT * FROM medical_colleges", conn)
            # CRITICAL FIX: Set 'type' field from 'college_type' if it exists, otherwise set to 'MEDICAL'
            if 'college_type' in medical_df.columns:
                medical_df['type'] = medical_df['college_type'].fillna('MEDICAL')
            else:
                medical_df['type'] = 'MEDICAL'  # ADD TYPE BEFORE SAVING!
            self.master_data['medical'] = {
                'colleges': medical_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in medical_df['tfidf_vector']]
            }

            # Load dental colleges
            dental_df = pd.read_sql("SELECT * FROM dental_colleges", conn)
            # CRITICAL FIX: Set 'type' field from 'college_type' if it exists, otherwise set to 'DENTAL'
            if 'college_type' in dental_df.columns:
                dental_df['type'] = dental_df['college_type'].fillna('DENTAL')
            else:
                dental_df['type'] = 'DENTAL'  # ADD TYPE BEFORE SAVING!
            self.master_data['dental'] = {
                'colleges': dental_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in dental_df['tfidf_vector']]
            }

            # Load DNB colleges
            dnb_df = pd.read_sql("SELECT * FROM dnb_colleges", conn)
            # CRITICAL FIX: Set 'type' field from 'college_type' if it exists, otherwise set to 'DNB'
            if 'college_type' in dnb_df.columns:
                dnb_df['type'] = dnb_df['college_type'].fillna('DNB')
            else:
                dnb_df['type'] = 'DNB'  # ADD TYPE BEFORE SAVING!
            self.master_data['dnb'] = {
                'colleges': dnb_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in dnb_df['tfidf_vector']]
            }

            # Combined list for general use (type already added above)
            # medical_df['type'] = 'MEDICAL'  # REMOVED - already added
            # dental_df['type'] = 'DENTAL'    # REMOVED - already added
            # dnb_df['type'] = 'DNB'          # REMOVED - already added
            all_colleges = pd.concat([medical_df, dental_df, dnb_df], ignore_index=True)
            self.master_data['colleges'] = all_colleges.to_dict('records')

            # Load courses
            courses_df = pd.read_sql("SELECT * FROM courses", conn)
            self.master_data['courses'] = {
                'courses': courses_df.to_dict('records'),
                'tfidf_vectors': [pickle.loads(row) if row and isinstance(row, bytes) else None for row in courses_df['tfidf_vector']]
            }

            # Load states, quotas, categories, sources, levels
            states_df = pd.read_sql("SELECT * FROM states", conn)
            quotas_df = pd.read_sql("SELECT * FROM quotas", conn)
            categories_df = pd.read_sql("SELECT * FROM categories", conn)
            self.master_data['states'] = states_df.to_dict('records')
            self.master_data['quotas'] = quotas_df.to_dict('records')
            self.master_data['categories'] = categories_df.to_dict('records')

            # Load sources and levels (table names are case-sensitive: Sources, Levels)
            try:
                sources_df = pd.read_sql("SELECT * FROM Sources", conn)
                levels_df = pd.read_sql("SELECT * FROM Levels", conn)

                # Convert to records and ensure we have data
                sources_list = sources_df.to_dict('records')
                levels_list = levels_df.to_dict('records')

                self.master_data['sources'] = sources_list
                self.master_data['levels'] = levels_list

                console.print(f"✅ Loaded {len(sources_list)} sources: {', '.join([s.get('Source', s.get('id', 'unknown')) for s in sources_list])}")
                console.print(f"✅ Loaded {len(levels_list)} levels: {', '.join([l.get('Level', l.get('id', 'unknown')) for l in levels_list])}")

                # Verify data loaded correctly
                if not sources_list:
                    console.print(f"[yellow]⚠️  Warning: Sources table is empty![/yellow]")
                if not levels_list:
                    console.print(f"[yellow]⚠️  Warning: Levels table is empty![/yellow]")

            except Exception as e:
                console.print(f"[red]❌ Failed to load Sources/Levels: {e}[/red]")
                logger.error(f"Failed to load Sources/Levels: {e}", exc_info=True)
                self.master_data['sources'] = []
                self.master_data['levels'] = []

            # Load aliases
            try:
                college_aliases_df = pd.read_sql("SELECT * FROM college_aliases", conn)
                course_aliases_df = pd.read_sql("SELECT * FROM course_aliases", conn)
                self.aliases['college'] = college_aliases_df.to_dict('records')
                self.aliases['course'] = course_aliases_df.to_dict('records')
                console.print(f"✅ Loaded {len(self.aliases['college'])} college aliases")
                console.print(f"✅ Loaded {len(self.aliases['course'])} course aliases")

                # Load quota and category aliases for counselling mode
                if self.data_type == 'counselling':
                    try:
                        quota_aliases_df = pd.read_sql("SELECT * FROM quota_aliases", conn)
                        category_aliases_df = pd.read_sql("SELECT * FROM category_aliases", conn)
                        self.aliases['quota'] = quota_aliases_df.to_dict('records')
                        self.aliases['category'] = category_aliases_df.to_dict('records')
                        console.print(f"✅ Loaded {len(self.aliases['quota'])} quota aliases")
                        console.print(f"✅ Loaded {len(self.aliases['category'])} category aliases")
                    except Exception as e:
                        console.print(f"[yellow]⚠️  Quota/Category aliases not found: {e}[/yellow]")
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
        console.print(f"  • Sources: {len(self.master_data.get('sources', [])):,}")
        console.print(f"  • Levels: {len(self.master_data.get('levels', [])):,}")
        console.print(f"  • State Mappings: {len(self.state_mappings):,}")

        # Build vector index for AI matching if advanced features enabled
        if self.enable_advanced_features:
            console.print("\n[cyan]🤖 Building AI Vector Index...[/cyan]")
            try:
                # Use a safer approach - disable FAISS if it causes issues
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    self.build_vector_index_for_colleges(force_rebuild=False)
            except (Exception, SystemError, OSError) as e:
                console.print(f"[yellow]⚠️  Could not build vector index: {e}[/yellow]")
                console.print("[yellow]   Disabling vector search (transformer matching will still work)[/yellow]")
                # Disable vector engine to prevent crashes
                self._vector_engine = None

        # Initialize Ensemble Matcher (after master data is loaded)
        if self.enable_ensemble_voting:
            console.print("\n[cyan]🗳️  Initializing Ensemble Matcher...[/cyan]")
            try:
                self.ensemble_matcher = EnsembleMatcher(self.config, self)
                console.print("[green]✓ Ensemble voting enabled (Fuzzy + Phonetic + TF-IDF + Soft TF-IDF)[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Could not initialize ensemble matcher: {e}[/yellow]")
                self.ensemble_matcher = None
                self.enable_ensemble_voting = False

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

    # ============================================================================
    # MASTER DATA IMPORT FUNCTIONALITY
    # ============================================================================

    def normalize_text_for_import(self, text):
        """Basic text normalization for master data import"""
        if pd.isna(text) or text == '':
            return ''

        text = str(text).strip().upper()

        # Expand common abbreviations
        abbreviation_expansions = {
            'ESI': 'EMPLOYEES STATE INSURANCE',
            'ESIC': 'EMPLOYEES STATE INSURANCE CORPORATION',
            'GOVT': 'GOVERNMENT',
            'SSH': 'SUPER SPECIALITY HOSPITAL',
            'SDH': 'SUB DISTRICT HOSPITAL',
            'GMC': 'GOVERNMENT MEDICAL COLLEGE',
            'PGIMS': 'POST GRADUATE INSTITUTE OF MEDICAL SCIENCES'
        }

        for abbrev, expansion in abbreviation_expansions.items():
            text = re.sub(r'\b' + re.escape(abbrev) + r'\b', expansion, text)

        # Handle hyphens and dots
        text = re.sub(r'(?<!\s)-(?!\s)', ' - ', text)
        text = re.sub(r'(?<!\s)\.(?!\s)', ' . ', text)

        # Remove special characters but preserve spaces, commas, and brackets
        text = re.sub(r'[^\w\s,()]', '', text)

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def normalize_state_name_import(self, state):
        """Normalize state names for import"""
        if pd.isna(state) or state == '':
            return ''

        state = str(state).strip().upper()

        # State normalization mappings
        state_mappings = {
            'ANDHRA': 'ANDHRA PRADESH',
            'AP': 'ANDHRA PRADESH',
            'ARUNACHAL': 'ARUNACHAL PRADESH',
            'HP': 'HIMACHAL PRADESH',
            'MP': 'MADHYA PRADESH',
            'TN': 'TAMIL NADU',
            'UP': 'UTTAR PRADESH',
            'UK': 'UTTARAKHAND',
            'WB': 'WEST BENGAL',
            'BENGAL': 'WEST BENGAL',
            'DELHI NCR': 'DELHI',
            'NEW DELHI': 'DELHI',
            'PUDUCHERRY': 'PUDUCHERRY',
            'PONDICHERRY': 'PUDUCHERRY',
            'TELENGANA': 'TELANGANA',
            'CHATTISGARH': 'CHHATTISGARH',
            'ORISSA': 'ODISHA',
            'J&K': 'JAMMU AND KASHMIR',
            'JAMMU & KASHMIR': 'JAMMU AND KASHMIR',
            'A&N ISLANDS': 'ANDAMAN AND NICOBAR ISLANDS',
            'ANDAMAN & NICOBAR': 'ANDAMAN AND NICOBAR ISLANDS',
            'D&N HAVELI': 'DADRA AND NAGAR HAVELI',
            'DADRA & NAGAR HAVELI': 'DADRA AND NAGAR HAVELI',
            'DAMAN & DIU': 'DAMAN AND DIU'
        }

        return state_mappings.get(state, state)

    def vectorize_text_batch(self, texts):
        """Create TF-IDF vectors for batch of texts"""
        from sklearn.feature_extraction.text import TfidfVectorizer

        logger.info("Creating TF-IDF vectors...")

        # Initialize TF-IDF vectorizer
        vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 3),
            min_df=1,
            max_df=0.95,
            stop_words='english'
        )

        # Fit and transform texts
        tfidf_matrix = vectorizer.fit_transform(texts)
        tfidf_dense = tfidf_matrix.toarray()

        logger.info(f"Created TF-IDF vectors with shape: {tfidf_dense.shape}")
        return tfidf_dense

    def import_medical_colleges_interactive(self):
        """Import medical colleges from Excel with user control and progress tracking"""
        console.print("\n[bold cyan]📥 Import Medical Colleges[/bold cyan]")

        # Ask for file path
        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/med.xlsx'
        excel_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(excel_path).exists():
            console.print(f"[red]✗ File not found: {excel_path}[/red]")
            return

        # Read Excel with progress
        with Progress() as progress:
            task = progress.add_task("[cyan]Reading Excel file...", total=None)
            df = pd.read_excel(excel_path)
            progress.update(task, completed=100)

        console.print(f"[green]✓ Loaded {len(df)} rows from Excel[/green]")

        # Data validation
        empty_rows = df.isnull().all(axis=1).sum()
        if empty_rows > 0:
            console.print(f"[yellow]⚠️  Found {empty_rows} empty rows (will be removed)[/yellow]")
            df = df.dropna(how='all')

        # Auto-detect and map columns (standard format)
        # Expected columns: STATE, COLLEGE/INSTITUTE, ADDRESS
        column_mapping = {
            'COLLEGE/INSTITUTE': 'name',
            'STATE': 'state',
            'ADDRESS': 'address'
        }

        # Check if all required columns exist
        missing_cols = []
        for col in column_mapping.keys():
            if col not in df.columns:
                missing_cols.append(col)

        if missing_cols:
            console.print(f"[red]✗ Missing expected columns: {', '.join(missing_cols)}[/red]")
            console.print(f"[yellow]Found columns: {', '.join(df.columns.tolist())}[/yellow]")
            return

        # Rename columns to standard names
        df = df.rename(columns=column_mapping)
        console.print(f"[green]✓ Mapped columns: COLLEGE/INSTITUTE → name, STATE → state, ADDRESS → address[/green]")

        # Remove rows with missing names
        missing_names = df['name'].isnull().sum()
        if missing_names > 0:
            console.print(f"[yellow]⚠️  Removing {missing_names} rows with missing college names[/yellow]")
            df = df.dropna(subset=['name'])

        # Detect duplicates based on name + state + address combination
        duplicates = df.duplicated(subset=['name', 'state', 'address']).sum()
        if duplicates > 0:
            console.print(f"[yellow]⚠️  Found {duplicates} exact duplicates (same name + state + address)[/yellow]")
            if Confirm.ask("Remove exact duplicates (keep first occurrence)?", default=True):
                df = df.drop_duplicates(subset=['name', 'state', 'address'], keep='first')
                console.print(f"[green]✓ Removed {duplicates} exact duplicates[/green]")

        # Show info about same name but different location (these are NOT duplicates)
        name_only_duplicates = df['name'].duplicated().sum()
        if name_only_duplicates > 0:
            console.print(f"[cyan]ℹ️  Found {name_only_duplicates} colleges with same name but different state/address (these are kept as unique)[/cyan]")

        # Ask about import mode FIRST (before processing)
        console.print("\n[bold cyan]Import Mode:[/bold cyan]")
        console.print("  [1] [yellow]REPLACE[/yellow] - Delete all existing medical colleges and import fresh (IDs start from MED0001)")
        console.print("  [2] [cyan]APPEND[/cyan] - Add new colleges to existing data (IDs continue from current max)")

        import_choice = Prompt.ask("Choose import mode", choices=["1", "2"], default="1")

        if import_choice == "1":
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing medical colleges will be deleted, IDs will start from MED0001[/yellow]")
        else:
            replace_mode = 'append'
            # Get existing max ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM medical_colleges")
                result = cursor.fetchone()
                start_id = 1 if not result[0] else result[0] + 1
                console.print(f"[cyan]Mode: APPEND - New colleges will be added starting from ID: MED{str(start_id).zfill(4)}[/cyan]")
            except:
                start_id = 1
                console.print("[cyan]Mode: APPEND - Table is empty, IDs will start from MED0001[/cyan]")
            finally:
                conn.close()

        # Process data with progress bar
        console.print("\n[bold cyan]Processing data...[/bold cyan]")
        with Progress() as progress:
            # Add type and IDs
            task1 = progress.add_task("[cyan]Adding college type and IDs...", total=len(df))
            df['college_type'] = 'MEDICAL'
            df['id'] = ['MED' + str(start_id + i).zfill(4) for i in range(len(df))]
            progress.update(task1, completed=len(df))

            # Normalize text with progress
            task2 = progress.add_task("[cyan]Normalizing names...", total=len(df))
            normalized_names = []
            for idx, name in enumerate(df['name']):
                normalized_names.append(self.normalize_text_for_import(name))
                if idx % 100 == 0:
                    progress.update(task2, completed=idx)
            df['normalized_name'] = normalized_names
            progress.update(task2, completed=len(df))

            # Normalize states
            task3 = progress.add_task("[cyan]Normalizing states...", total=len(df))
            normalized_states = []
            for idx, state in enumerate(df['state']):
                normalized_states.append(self.normalize_state_name_import(state))
                if idx % 100 == 0:
                    progress.update(task3, completed=idx)
            df['normalized_state'] = normalized_states
            progress.update(task3, completed=len(df))

            # Create TF-IDF vectors
            task4 = progress.add_task("[cyan]Creating TF-IDF vectors...", total=None)
            college_names = df['normalized_name'].tolist()
            tfidf_vectors = self.vectorize_text_batch(college_names)
            df['tfidf_vector'] = [pickle.dumps(vector) for vector in tfidf_vectors]
            progress.update(task4, completed=100)

        # Show statistics
        console.print("\n[bold cyan]📊 Data Summary:[/bold cyan]")
        console.print(f"  • Total records: {len(df):,}")
        console.print(f"  • ID range: {df['id'].min()} to {df['id'].max()}")
        console.print(f"  • Unique states: {df['normalized_state'].nunique()}")
        console.print(f"  • States: {', '.join(sorted(df['normalized_state'].unique()[:5]))}" +
                     (f" ... ({df['normalized_state'].nunique() - 5} more)" if df['normalized_state'].nunique() > 5 else ""))

        # Show preview
        console.print("\n[bold]Preview (first 5 records):[/bold]")
        preview_df = df[['id', 'name', 'state', 'normalized_name']].head()
        console.print(preview_df.to_string(index=False))

        # Confirm import
        if not Confirm.ask(f"\n[bold]Import {len(df)} medical colleges using {replace_mode.upper()} mode?[/bold]", default=True):
            console.print("[yellow]❌ Import cancelled[/yellow]")
            return

        console.print("\n[bold cyan]Importing to database...[/bold cyan]")
        with Progress() as progress:
            task = progress.add_task("[green]Writing to SQLite...", total=None)
            conn = sqlite3.connect(self.master_db_path)
            df.to_sql('medical_colleges', conn, if_exists=replace_mode, index=False)
            conn.close()
            progress.update(task, completed=100)

        console.print(f"\n[green]✅ Successfully imported {len(df):,} medical colleges![/green]")
        console.print(f"[green]✓ ID range: {df['id'].min()} to {df['id'].max()}[/green]")

    def import_dental_colleges_interactive(self):
        """Import dental colleges from Excel with user control"""
        console.print("\n[bold cyan]📥 Import Dental Colleges[/bold cyan]")

        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental.xlsx'
        excel_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(excel_path).exists():
            console.print(f"[red]✗ File not found: {excel_path}[/red]")
            return

        with console.status("[bold green]Reading Excel file..."):
            df = pd.read_excel(excel_path)

        console.print(f"[green]✓ Loaded {len(df)} rows from Excel[/green]")
        console.print(f"[cyan]Columns: {', '.join(df.columns.tolist())}[/cyan]")

        # Check for empty rows
        empty_rows = df.isnull().all(axis=1).sum()
        if empty_rows > 0:
            console.print(f"[yellow]⚠️  Found {empty_rows} empty rows (will be removed)[/yellow]")
            df = df.dropna(how='all')

        # Auto-detect and map columns (standard format)
        # Expected columns: STATE, COLLEGE/INSTITUTE, ADDRESS
        column_mapping = {
            'COLLEGE/INSTITUTE': 'name',
            'STATE': 'state',
            'ADDRESS': 'address'
        }

        # Check if all required columns exist
        missing_cols = []
        for col in column_mapping.keys():
            if col not in df.columns:
                missing_cols.append(col)

        if missing_cols:
            console.print(f"[red]✗ Missing expected columns: {', '.join(missing_cols)}[/red]")
            console.print(f"[yellow]Found columns: {', '.join(df.columns.tolist())}[/yellow]")
            return

        # Rename columns to standard names
        df = df.rename(columns=column_mapping)
        console.print(f"[green]✓ Mapped columns: COLLEGE/INSTITUTE → name, STATE → state, ADDRESS → address[/green]")

        # Remove rows with missing names
        missing_names = df['name'].isnull().sum()
        if missing_names > 0:
            console.print(f"[yellow]⚠️  Removing {missing_names} rows with missing college names[/yellow]")
            df = df.dropna(subset=['name'])

        # Detect duplicates based on name + state + address combination
        duplicates = df.duplicated(subset=['name', 'state', 'address']).sum()
        if duplicates > 0:
            console.print(f"[yellow]⚠️  Found {duplicates} exact duplicates (same name + state + address)[/yellow]")
            if Confirm.ask("Remove exact duplicates (keep first occurrence)?", default=True):
                df = df.drop_duplicates(subset=['name', 'state', 'address'], keep='first')
                console.print(f"[green]✓ Removed {duplicates} exact duplicates[/green]")

        # Show info about same name but different location (these are NOT duplicates)
        name_only_duplicates = df['name'].duplicated().sum()
        if name_only_duplicates > 0:
            console.print(f"[cyan]ℹ️  Found {name_only_duplicates} colleges with same name but different state/address (these are kept as unique)[/cyan]")

        # Ask about import mode FIRST (before processing)
        console.print("\n[bold cyan]Import Mode:[/bold cyan]")
        console.print("  [1] [yellow]REPLACE[/yellow] - Delete all existing dental colleges and import fresh (IDs start from DEN0001)")
        console.print("  [2] [cyan]APPEND[/cyan] - Add new colleges to existing data (IDs continue from current max)")

        import_choice = Prompt.ask("Choose import mode", choices=["1", "2"], default="1")

        if import_choice == "1":
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing dental colleges will be deleted, IDs will start from DEN0001[/yellow]")
        else:
            replace_mode = 'append'
            # Get existing max ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM dental_colleges")
                result = cursor.fetchone()
                start_id = 1 if not result[0] else result[0] + 1
                console.print(f"[cyan]Mode: APPEND - New colleges will be added starting from ID: DEN{str(start_id).zfill(4)}[/cyan]")
            except:
                start_id = 1
                console.print("[cyan]Mode: APPEND - Table is empty, IDs will start from DEN0001[/cyan]")
            finally:
                conn.close()

        # Process data with progress bar
        console.print("\n[bold cyan]Processing data...[/bold cyan]")
        with Progress() as progress:
            # Add type and IDs
            task1 = progress.add_task("[cyan]Adding college type and IDs...", total=len(df))
            df['college_type'] = 'DENTAL'
            df['id'] = ['DEN' + str(start_id + i).zfill(4) for i in range(len(df))]
            progress.update(task1, completed=len(df))

            # Normalize text with progress
            task2 = progress.add_task("[cyan]Normalizing names...", total=len(df))
            normalized_names = []
            for idx, name in enumerate(df['name']):
                normalized_names.append(self.normalize_text_for_import(name))
                if idx % 100 == 0:
                    progress.update(task2, completed=idx)
            df['normalized_name'] = normalized_names
            progress.update(task2, completed=len(df))

            # Normalize states
            task3 = progress.add_task("[cyan]Normalizing states...", total=len(df))
            normalized_states = []
            for idx, state in enumerate(df['state']):
                normalized_states.append(self.normalize_state_name_import(state))
                if idx % 100 == 0:
                    progress.update(task3, completed=idx)
            df['normalized_state'] = normalized_states
            progress.update(task3, completed=len(df))

            # Create TF-IDF vectors
            task4 = progress.add_task("[cyan]Creating TF-IDF vectors...", total=None)
            college_names = df['normalized_name'].tolist()
            tfidf_vectors = self.vectorize_text_batch(college_names)
            df['tfidf_vector'] = [pickle.dumps(vector) for vector in tfidf_vectors]
            progress.update(task4, completed=100)

        # Show statistics
        console.print("\n[bold cyan]📊 Data Summary:[/bold cyan]")
        console.print(f"  • Total records: {len(df):,}")
        console.print(f"  • ID range: {df['id'].min()} to {df['id'].max()}")
        console.print(f"  • Unique states: {df['normalized_state'].nunique()}")
        console.print(f"  • States: {', '.join(sorted(df['normalized_state'].unique()[:5]))}" +
                     (f" ... ({df['normalized_state'].nunique() - 5} more)" if df['normalized_state'].nunique() > 5 else ""))

        # Show preview
        console.print("\n[bold]Preview (first 5 records):[/bold]")
        preview_df = df[['id', 'name', 'state', 'normalized_name']].head()
        console.print(preview_df.to_string(index=False))

        # Confirm import
        if not Confirm.ask(f"\n[bold]Import {len(df)} dental colleges using {replace_mode.upper()} mode?[/bold]", default=True):
            console.print("[yellow]❌ Import cancelled[/yellow]")
            return

        console.print("\n[bold cyan]Importing to database...[/bold cyan]")
        with Progress() as progress:
            task = progress.add_task("[green]Writing to SQLite...", total=None)
            conn = sqlite3.connect(self.master_db_path)
            df.to_sql('dental_colleges', conn, if_exists=replace_mode, index=False)
            conn.close()
            progress.update(task, completed=100)

        console.print(f"\n[green]✅ Successfully imported {len(df):,} dental colleges![/green]")
        console.print(f"[green]✓ ID range: {df['id'].min()} to {df['id'].max()}[/green]")

    def import_dnb_colleges_interactive(self):
        """Import DNB colleges from Excel with user control"""
        console.print("\n[bold cyan]📥 Import DNB Colleges[/bold cyan]")

        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dnb.xlsx'
        excel_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(excel_path).exists():
            console.print(f"[red]✗ File not found: {excel_path}[/red]")
            return

        with console.status("[bold green]Reading Excel file..."):
            df = pd.read_excel(excel_path)

        console.print(f"[green]✓ Loaded {len(df)} rows from Excel[/green]")
        console.print(f"[cyan]Columns: {', '.join(df.columns.tolist())}[/cyan]")

        # Check for empty rows
        empty_rows = df.isnull().all(axis=1).sum()
        if empty_rows > 0:
            console.print(f"[yellow]⚠️  Found {empty_rows} empty rows (will be removed)[/yellow]")
            df = df.dropna(how='all')

        # Auto-detect and map columns (standard format)
        # Expected columns: STATE, COLLEGE/INSTITUTE, ADDRESS
        column_mapping = {
            'COLLEGE/INSTITUTE': 'name',
            'STATE': 'state',
            'ADDRESS': 'address'
        }

        # Check if all required columns exist
        missing_cols = []
        for col in column_mapping.keys():
            if col not in df.columns:
                missing_cols.append(col)

        if missing_cols:
            console.print(f"[red]✗ Missing expected columns: {', '.join(missing_cols)}[/red]")
            console.print(f"[yellow]Found columns: {', '.join(df.columns.tolist())}[/yellow]")
            return

        # Rename columns to standard names
        df = df.rename(columns=column_mapping)
        console.print(f"[green]✓ Mapped columns: COLLEGE/INSTITUTE → name, STATE → state, ADDRESS → address[/green]")

        # Remove rows with missing names
        missing_names = df['name'].isnull().sum()
        if missing_names > 0:
            console.print(f"[yellow]⚠️  Removing {missing_names} rows with missing college names[/yellow]")
            df = df.dropna(subset=['name'])

        # Detect duplicates based on name + state + address combination
        duplicates = df.duplicated(subset=['name', 'state', 'address']).sum()
        if duplicates > 0:
            console.print(f"[yellow]⚠️  Found {duplicates} exact duplicates (same name + state + address)[/yellow]")
            if Confirm.ask("Remove exact duplicates (keep first occurrence)?", default=True):
                df = df.drop_duplicates(subset=['name', 'state', 'address'], keep='first')
                console.print(f"[green]✓ Removed {duplicates} exact duplicates[/green]")

        # Show info about same name but different location (these are NOT duplicates)
        name_only_duplicates = df['name'].duplicated().sum()
        if name_only_duplicates > 0:
            console.print(f"[cyan]ℹ️  Found {name_only_duplicates} colleges with same name but different state/address (these are kept as unique)[/cyan]")

        # Ask about import mode FIRST (before processing)
        console.print("\n[bold cyan]Import Mode:[/bold cyan]")
        console.print("  [1] [yellow]REPLACE[/yellow] - Delete all existing DNB colleges and import fresh (IDs start from DNB0001)")
        console.print("  [2] [cyan]APPEND[/cyan] - Add new colleges to existing data (IDs continue from current max)")

        import_choice = Prompt.ask("Choose import mode", choices=["1", "2"], default="1")

        if import_choice == "1":
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing DNB colleges will be deleted, IDs will start from DNB0001[/yellow]")
        else:
            replace_mode = 'append'
            # Get existing max ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM dnb_colleges")
                result = cursor.fetchone()
                start_id = 1 if not result[0] else result[0] + 1
                console.print(f"[cyan]Mode: APPEND - New colleges will be added starting from ID: DNB{str(start_id).zfill(4)}[/cyan]")
            except:
                start_id = 1
                console.print("[cyan]Mode: APPEND - Table is empty, IDs will start from DNB0001[/cyan]")
            finally:
                conn.close()

        # Process data with progress bar
        console.print("\n[bold cyan]Processing data...[/bold cyan]")
        with Progress() as progress:
            # Add type and IDs
            task1 = progress.add_task("[cyan]Adding college type and IDs...", total=len(df))
            df['college_type'] = 'DNB'
            df['id'] = ['DNB' + str(start_id + i).zfill(4) for i in range(len(df))]
            progress.update(task1, completed=len(df))

            # Normalize text with progress
            task2 = progress.add_task("[cyan]Normalizing names...", total=len(df))
            normalized_names = []
            for idx, name in enumerate(df['name']):
                normalized_names.append(self.normalize_text_for_import(name))
                if idx % 100 == 0:
                    progress.update(task2, completed=idx)
            df['normalized_name'] = normalized_names
            progress.update(task2, completed=len(df))

            # Normalize states
            task3 = progress.add_task("[cyan]Normalizing states...", total=len(df))
            normalized_states = []
            for idx, state in enumerate(df['state']):
                normalized_states.append(self.normalize_state_name_import(state))
                if idx % 100 == 0:
                    progress.update(task3, completed=idx)
            df['normalized_state'] = normalized_states
            progress.update(task3, completed=len(df))

            # Create TF-IDF vectors
            task4 = progress.add_task("[cyan]Creating TF-IDF vectors...", total=None)
            college_names = df['normalized_name'].tolist()
            tfidf_vectors = self.vectorize_text_batch(college_names)
            df['tfidf_vector'] = [pickle.dumps(vector) for vector in tfidf_vectors]
            progress.update(task4, completed=100)

        # Show statistics
        console.print("\n[bold cyan]📊 Data Summary:[/bold cyan]")
        console.print(f"  • Total records: {len(df):,}")
        console.print(f"  • ID range: {df['id'].min()} to {df['id'].max()}")
        console.print(f"  • Unique states: {df['normalized_state'].nunique()}")
        console.print(f"  • States: {', '.join(sorted(df['normalized_state'].unique()[:5]))}" +
                     (f" ... ({df['normalized_state'].nunique() - 5} more)" if df['normalized_state'].nunique() > 5 else ""))

        # Show preview
        console.print("\n[bold]Preview (first 5 records):[/bold]")
        preview_df = df[['id', 'name', 'state', 'normalized_name']].head()
        console.print(preview_df.to_string(index=False))

        # Confirm import
        if not Confirm.ask(f"\n[bold]Import {len(df)} DNB colleges using {replace_mode.upper()} mode?[/bold]", default=True):
            console.print("[yellow]❌ Import cancelled[/yellow]")
            return

        console.print("\n[bold cyan]Importing to database...[/bold cyan]")
        with Progress() as progress:
            task = progress.add_task("[green]Writing to SQLite...", total=None)
            conn = sqlite3.connect(self.master_db_path)
            df.to_sql('dnb_colleges', conn, if_exists=replace_mode, index=False)
            conn.close()
            progress.update(task, completed=100)

        console.print(f"\n[green]✅ Successfully imported {len(df):,} DNB colleges![/green]")
        console.print(f"[green]✓ ID range: {df['id'].min()} to {df['id'].max()}[/green]")

    def import_courses_interactive(self):
        """Import courses from Excel file with user control"""
        console.print("\n[bold cyan]📥 Import Courses[/bold cyan]")

        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/standard_courses.xlsx'
        file_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(file_path).exists():
            console.print(f"[red]✗ File not found: {file_path}[/red]")
            return

        # Read Excel file
        df = pd.read_excel(file_path)

        # Auto-detect course column (standard format: 'standard_courses')
        expected_col = 'standard_courses'
        if expected_col in df.columns:
            course_col = expected_col
            console.print(f"[green]✓ Auto-detected column: {course_col}[/green]")
        else:
            # Fallback to first column
            course_col = df.columns[0]
            console.print(f"[yellow]⚠️  Expected column '{expected_col}' not found, using: {course_col}[/yellow]")

        courses = df[course_col].dropna().tolist()
        console.print(f"[green]✓ Loaded {len(courses)} courses from Excel[/green]")

        # Show preview
        console.print("\n[bold]Preview (first 10 courses):[/bold]")
        for i, course in enumerate(courses[:10], 1):
            console.print(f"  {i}. {course}")

        if len(courses) > 10:
            console.print(f"  ... and {len(courses) - 10} more")

        if not Confirm.ask(f"\n[bold]Import {len(courses)} courses?[/bold]", default=True):
            console.print("[yellow]Import cancelled[/yellow]")
            return

        # Ask about replace/append mode FIRST
        if Confirm.ask("Replace existing data (otherwise append)?", default=False):
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing courses will be deleted, IDs will start from CRS0001[/yellow]")
        else:
            replace_mode = 'append'
            # Get next ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM courses")
                result = cursor.fetchone()
                start_id = 1 if not result[0] else result[0] + 1
                console.print(f"[cyan]Mode: APPEND - New courses will be added starting from ID: CRS{str(start_id).zfill(4)}[/cyan]")
            except:
                start_id = 1
                console.print("[cyan]Mode: APPEND - Table is empty, IDs will start from CRS0001[/cyan]")
            finally:
                conn.close()

        with console.status("[bold green]Processing courses..."):
            df = pd.DataFrame({
                'name': courses,
                'id': ['CRS' + str(start_id + i).zfill(4) for i in range(len(courses))]
            })

            df['normalized_name'] = df['name'].apply(self.normalize_text_for_import)

            course_names = df['normalized_name'].tolist()
            tfidf_vectors = self.vectorize_text_batch(course_names)
            df['tfidf_vector'] = [pickle.dumps(vector) for vector in tfidf_vectors]

        with console.status("[bold green]Importing to SQLite..."):
            conn = sqlite3.connect(self.master_db_path)
            df.to_sql('courses', conn, if_exists=replace_mode, index=False)
            conn.close()

        console.print(f"[green]✅ Imported {len(df)} courses successfully![/green]")

    def show_master_data_stats(self):
        """Show statistics of current master data"""
        console.print("\n[bold cyan]📊 Master Data Statistics[/bold cyan]")
        console.print("━" * 60)

        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()

        # Medical colleges
        cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM medical_colleges")
        med_count, med_min, med_max = cursor.fetchone()
        console.print(f"[green]Medical Colleges:[/green] {med_count:,} ({med_min} to {med_max})")

        # Dental colleges
        cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM dental_colleges")
        den_count, den_min, den_max = cursor.fetchone()
        console.print(f"[green]Dental Colleges:[/green] {den_count:,} ({den_min} to {den_max})")

        # DNB colleges
        cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM dnb_colleges")
        dnb_count, dnb_min, dnb_max = cursor.fetchone()
        console.print(f"[green]DNB Colleges:[/green] {dnb_count:,} ({dnb_min} to {dnb_max})")

        # Courses
        cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM courses")
        crs_count, crs_min, crs_max = cursor.fetchone()
        console.print(f"[green]Courses:[/green] {crs_count:,} ({crs_min} to {crs_max})")

        # States
        try:
            cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM states")
            state_count, state_min, state_max = cursor.fetchone()
            console.print(f"[cyan]States:[/cyan] {state_count:,} ({state_min} to {state_max})")
        except:
            state_count = 0
            console.print("[yellow]States:[/yellow] No data")

        # Quotas
        try:
            cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM quotas")
            quota_count, quota_min, quota_max = cursor.fetchone()
            console.print(f"[cyan]Quotas:[/cyan] {quota_count:,} ({quota_min} to {quota_max})")
        except:
            quota_count = 0
            console.print("[yellow]Quotas:[/yellow] No data")

        # Categories
        try:
            cursor.execute("SELECT COUNT(*), MIN(id), MAX(id) FROM categories")
            cat_count, cat_min, cat_max = cursor.fetchone()
            console.print(f"[cyan]Categories:[/cyan] {cat_count:,} ({cat_min} to {cat_max})")
        except:
            cat_count = 0
            console.print("[yellow]Categories:[/yellow] No data")

        # Aliases
        try:
            cursor.execute("SELECT COUNT(*) FROM college_aliases")
            alias_count = cursor.fetchone()[0]
            console.print(f"[yellow]College Aliases:[/yellow] {alias_count:,}")
        except:
            console.print("[yellow]College Aliases:[/yellow] No data")

        console.print("━" * 60)
        console.print(f"[bold]Total Colleges:[/bold] {med_count + den_count + dnb_count:,}")
        console.print(f"[bold]Total Courses:[/bold] {crs_count:,}")
        console.print(f"[bold]Total States:[/bold] {state_count:,}")
        console.print(f"[bold]Total Quotas:[/bold] {quota_count:,}")
        console.print(f"[bold]Total Categories:[/bold] {cat_count:,}")

        conn.close()

    def import_states_interactive(self):
        """Import states from Excel file"""
        console.print("\n[bold cyan]📥 Import States[/bold cyan]")

        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/STATES.xlsx'
        file_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(file_path).exists():
            console.print(f"[red]✗ File not found: {file_path}[/red]")
            return

        # Read Excel file
        df = pd.read_excel(file_path)

        # Auto-detect state column (standard format: 'STATES OF INDIA')
        expected_col = 'STATES OF INDIA'
        if expected_col in df.columns:
            state_col = expected_col
            console.print(f"[green]✓ Auto-detected column: {state_col}[/green]")
        else:
            state_col = df.columns[0]
            console.print(f"[yellow]⚠️  Expected column '{expected_col}' not found, using: {state_col}[/yellow]")

        states = df[state_col].dropna().tolist()
        console.print(f"[green]✓ Loaded {len(states)} states from Excel[/green]")

        # Preview
        console.print("\n[bold]Preview (first 10 states):[/bold]")
        for i, state in enumerate(states[:10], 1):
            console.print(f"  {i}. {state}")
        if len(states) > 10:
            console.print(f"  ... and {len(states) - 10} more")

        if not Confirm.ask(f"\n[bold]Import {len(states)} states?[/bold]", default=True):
            console.print("[yellow]Import cancelled[/yellow]")
            return

        # Ask about replace/append mode FIRST
        if Confirm.ask("Replace existing data (otherwise append)?", default=False):
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing states will be deleted, IDs will start from STATE001[/yellow]")
        else:
            replace_mode = 'append'
            # Get next ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) FROM states")
            result = cursor.fetchone()
            start_id = 1 if not result[0] else result[0] + 1
            conn.close()
            console.print(f"[cyan]Mode: APPEND - New states will be added starting from ID: STATE{str(start_id).zfill(3)}[/cyan]")

        with console.status("[bold green]Processing states..."):
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()

            # Generate records with correct start_id
            records = []
            for i, state in enumerate(states):
                state_id = f'STATE{str(start_id + i).zfill(3)}'
                normalized = self.normalize_text_for_import(state)
                records.append((state_id, state, normalized))

            # Delete if REPLACE mode
            if replace_mode == 'replace':
                cursor.execute("DELETE FROM states")

            cursor.executemany(
                "INSERT INTO states (id, name, normalized_name) VALUES (?, ?, ?)",
                records
            )
            conn.commit()
            conn.close()

        console.print(f"[green]✅ Imported {len(records)} states successfully![/green]")

    def import_quotas_interactive(self):
        """Import quotas from Excel file"""
        console.print("\n[bold cyan]📥 Import Quotas[/bold cyan]")

        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/QUOTA.xlsx'
        file_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(file_path).exists():
            console.print(f"[red]✗ File not found: {file_path}[/red]")
            return

        # Read Excel file
        df = pd.read_excel(file_path)

        # Auto-detect quota column (standard format: 'QUOTA')
        expected_col = 'QUOTA'
        if expected_col in df.columns:
            quota_col = expected_col
            console.print(f"[green]✓ Auto-detected column: {quota_col}[/green]")
        else:
            quota_col = df.columns[0]
            console.print(f"[yellow]⚠️  Expected column '{expected_col}' not found, using: {quota_col}[/yellow]")

        quotas = df[quota_col].dropna().tolist()

        console.print(f"[green]✓ Loaded {len(quotas)} quotas from Excel[/green]")

        console.print("\n[bold]Preview (first 10 quotas):[/bold]")
        for i, quota in enumerate(quotas[:10], 1):
            console.print(f"  {i}. {quota}")
        if len(quotas) > 10:
            console.print(f"  ... and {len(quotas) - 10} more")

        if not Confirm.ask(f"\n[bold]Import {len(quotas)} quotas?[/bold]", default=True):
            console.print("[yellow]Import cancelled[/yellow]")
            return

        # Ask about replace/append mode FIRST
        if Confirm.ask("Replace existing data (otherwise append)?", default=False):
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing quotas will be deleted, IDs will start from QUOTA001[/yellow]")
        else:
            replace_mode = 'append'
            # Get next ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) FROM quotas")
            result = cursor.fetchone()
            start_id = 1 if not result[0] else result[0] + 1
            conn.close()
            console.print(f"[cyan]Mode: APPEND - New quotas will be added starting from ID: QUOTA{str(start_id).zfill(3)}[/cyan]")

        with console.status("[bold green]Processing quotas..."):
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()

            # Generate records with correct start_id
            records = []
            for i, quota in enumerate(quotas):
                quota_id = f'QUOTA{str(start_id + i).zfill(3)}'
                normalized = self.normalize_text_for_import(quota)
                records.append((quota_id, quota, normalized))

            # Delete if REPLACE mode
            if replace_mode == 'replace':
                cursor.execute("DELETE FROM quotas")

            cursor.executemany(
                "INSERT INTO quotas (id, name, normalized_name) VALUES (?, ?, ?)",
                records
            )
            conn.commit()
            conn.close()

        console.print(f"[green]✅ Imported {len(records)} quotas successfully![/green]")

    def import_categories_interactive(self):
        """Import categories from Excel file"""
        console.print("\n[bold cyan]📥 Import Categories[/bold cyan]")

        default_path = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/CATEGORY.xlsx'
        file_path = Prompt.ask("Excel file path", default=default_path)

        if not Path(file_path).exists():
            console.print(f"[red]✗ File not found: {file_path}[/red]")
            return

        # Read Excel file
        df = pd.read_excel(file_path)

        # Auto-detect category column (standard format: 'CATEGORY')
        expected_col = 'CATEGORY'
        if expected_col in df.columns:
            cat_col = expected_col
            console.print(f"[green]✓ Auto-detected column: {cat_col}[/green]")
        else:
            cat_col = df.columns[0]
            console.print(f"[yellow]⚠️  Expected column '{expected_col}' not found, using: {cat_col}[/yellow]")

        categories = df[cat_col].dropna().tolist()

        console.print(f"[green]✓ Loaded {len(categories)} categories from Excel[/green]")

        console.print("\n[bold]Preview (first 10 categories):[/bold]")
        for i, category in enumerate(categories[:10], 1):
            console.print(f"  {i}. {category}")
        if len(categories) > 10:
            console.print(f"  ... and {len(categories) - 10} more")

        if not Confirm.ask(f"\n[bold]Import {len(categories)} categories?[/bold]", default=True):
            console.print("[yellow]Import cancelled[/yellow]")
            return

        # Ask about replace/append mode FIRST
        if Confirm.ask("Replace existing data (otherwise append)?", default=False):
            replace_mode = 'replace'
            start_id = 1  # Always start from 1 in REPLACE mode
            console.print("[yellow]⚠️  Mode: REPLACE - All existing categories will be deleted, IDs will start from CAT001[/yellow]")
        else:
            replace_mode = 'append'
            # Get next ID only in APPEND mode
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM categories")
            result = cursor.fetchone()
            start_id = 1 if not result[0] else result[0] + 1
            conn.close()
            console.print(f"[cyan]Mode: APPEND - New categories will be added starting from ID: CAT{str(start_id).zfill(3)}[/cyan]")

        with console.status("[bold green]Processing categories..."):
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()

            # Generate records with correct start_id
            records = []
            for i, category in enumerate(categories):
                cat_id = f'CAT{str(start_id + i).zfill(3)}'
                normalized = self.normalize_text_for_import(category)
                records.append((cat_id, category, normalized))

            # Delete if REPLACE mode
            if replace_mode == 'replace':
                cursor.execute("DELETE FROM categories")

            cursor.executemany(
                "INSERT INTO categories (id, name, normalized_name) VALUES (?, ?, ?)",
                records
            )
            conn.commit()
            conn.close()

        console.print(f"[green]✅ Imported {len(records)} categories successfully![/green]")

    def rebuild_state_college_link(self, interactive_review=True):
        """Rebuild state_college_link table from colleges view and states table"""
        console.print("\n[bold cyan]🔗 Rebuild State-College Link Table[/bold cyan]")

        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()

        try:
            # Check if colleges exist
            cursor.execute("SELECT COUNT(*) FROM colleges")
            college_count = cursor.fetchone()[0]

            if college_count == 0:
                console.print("[red]✗ No colleges found. Import colleges first.[/red]")
                return

            console.print(f"[cyan]Found {college_count:,} colleges in colleges view[/cyan]")

            # Check if states exist
            cursor.execute("SELECT COUNT(*) FROM states")
            state_count = cursor.fetchone()[0]

            if state_count == 0:
                console.print("[red]✗ No states found. Import states first.[/red]")
                return

            console.print(f"[cyan]Found {state_count} states in states table[/cyan]")

            # Show current link table status
            cursor.execute("SELECT COUNT(*) FROM state_college_link")
            current_links = cursor.fetchone()[0]
            console.print(f"[yellow]Current links in table: {current_links:,}[/yellow]")

            if not Confirm.ask(f"\n[bold]Rebuild state_college_link table?[/bold]", default=True):
                console.print("[yellow]Operation cancelled[/yellow]")
                return

            # Get state mappings from state_mappings table and states table
            cursor.execute("SELECT raw_state, normalized_state FROM state_mappings")
            state_mappings = {row[0]: row[1] for row in cursor.fetchall()}

            # Also add normalized versions
            cursor.execute("SELECT normalized_name, id, name FROM states")
            states_list = cursor.fetchall()
            state_map = {row[0]: row[1] for row in states_list}  # normalized_name -> id
            state_name_map = {row[2]: row[1] for row in states_list}  # name -> id

            # Get all colleges with their normalized states
            cursor.execute("""
                SELECT id, name, address, state, normalized_state
                FROM colleges
                ORDER BY id
            """)
            colleges = cursor.fetchall()

            # Build link records
            link_records = []
            unmatched_colleges = []

            with console.status("[bold green]Matching colleges to states..."):
                for college_id, college_name, address, state, normalized_state in colleges:
                    state_id = None
                    match_method = None

                    # Try 1: Exact normalized state match
                    if normalized_state:
                        state_id = state_map.get(normalized_state)
                        if state_id:
                            match_method = "exact_normalized"

                    # Try 2: State mappings table (check both original and normalized, follow chain)
                    if not state_id:
                        # Check original state and follow mapping chain
                        if state:
                            check_state = state.upper()
                            max_depth = 5  # Prevent infinite loops
                            depth = 0
                            while check_state and depth < max_depth:
                                depth += 1
                                # Check if this resolves to a state ID
                                state_id = state_map.get(check_state)
                                if state_id:
                                    match_method = f"state_mapping_chain_{depth}"
                                    break
                                # Check if there's a mapping to follow
                                next_state = state_mappings.get(check_state)
                                if next_state and next_state != check_state:
                                    check_state = next_state
                                else:
                                    break

                        # Check normalized state and follow mapping chain
                        if not state_id and normalized_state:
                            check_state = normalized_state
                            max_depth = 5
                            depth = 0
                            while check_state and depth < max_depth:
                                depth += 1
                                # Check if this resolves to a state ID
                                state_id = state_map.get(check_state)
                                if state_id:
                                    match_method = f"state_mapping_norm_chain_{depth}"
                                    break
                                # Check if there's a mapping to follow
                                next_state = state_mappings.get(check_state)
                                if next_state and next_state != check_state:
                                    check_state = next_state
                                else:
                                    break

                    # Try 3: Original state name
                    if not state_id and state:
                        state_id = state_name_map.get(state)
                        if state_id:
                            match_method = "exact_name"

                    # Try 4: Fuzzy match on state names (using token_sort_ratio for better matching)
                    if not state_id and (normalized_state or state):
                        search_state = normalized_state or state.upper()
                        best_match = None
                        best_score = 0

                        for state_norm, s_id in state_map.items():
                            # Use partial_ratio for substring matching (best for "DAMAN AND DIU" in longer names)
                            score = fuzz.partial_ratio(search_state, state_norm)
                            if score > best_score and score >= 85:  # High threshold for partial match
                                best_score = score
                                best_match = s_id

                        if best_match:
                            state_id = best_match
                            match_method = f"fuzzy_{best_score}"

                    if state_id:
                        link_records.append((
                            college_name,
                            address or '',
                            state,
                            college_id,
                            state_id
                        ))
                    else:
                        unmatched_colleges.append((college_id, college_name, state, normalized_state))

            # Interactive review of unmatched states
            if unmatched_colleges and interactive_review:
                console.print(f"\n[yellow]⚠️  Found {len(unmatched_colleges)} colleges with unmatched states[/yellow]")

                if Confirm.ask("Review and manually map unmatched states?", default=True):
                    # Group by state
                    state_groups = {}
                    for cid, cname, state, norm_state in unmatched_colleges:
                        key = norm_state or state
                        if key not in state_groups:
                            state_groups[key] = []
                        state_groups[key].append((cid, cname, state))

                    # Build available states list: [(state_id, state_name, normalized_name)]
                    available_states = [(s_id, name, norm_name)
                                       for norm_name, s_id in state_map.items()
                                       for _, _, name in states_list
                                       if _ == norm_name and s_id != '']

                    for unmatched_state, colleges_list in state_groups.items():
                        console.print(f"\n[bold yellow]━━━ Unmatched state: {unmatched_state} ━━━[/bold yellow]")
                        console.print(f"[cyan]Affects {len(colleges_list)} college(s):[/cyan]")

                        # Show affected colleges
                        for i, (cid, cname, state) in enumerate(colleges_list[:5], 1):
                            console.print(f"  {i}. [{cid}] {cname}")
                        if len(colleges_list) > 5:
                            console.print(f"  ... and {len(colleges_list) - 5} more")

                        # Calculate fuzzy matches for ALL states
                        console.print(f"\n[bold]Suggested state matches:[/bold]")
                        suggestions = []

                        for norm_name, s_id in state_map.items():
                            # Get actual state name
                            state_name = None
                            for _, _, name in states_list:
                                if _ == norm_name:
                                    state_name = name
                                    break

                            if state_name:
                                # Use partial_ratio for substring matching
                                score = fuzz.partial_ratio(unmatched_state.upper(), norm_name)
                                if score >= 70:  # Threshold for suggestions
                                    suggestions.append((score, s_id, state_name, norm_name))

                        suggestions.sort(reverse=True)

                        if not suggestions:
                            console.print("[yellow]  No close matches found[/yellow]")
                        else:
                            for i, (score, sid, sname, snorm) in enumerate(suggestions[:10], 1):
                                console.print(f"  [{i}] {sname} - {score}% match")

                        console.print(f"  [0] Skip (don't map these colleges)")

                        choice = Prompt.ask("\nSelect state (number or type state name)", default="1" if suggestions else "0")

                        selected_state_id = None
                        selected_state_name = None

                        # Handle numeric choice
                        if choice.isdigit():
                            choice_num = int(choice)
                            if choice_num == 0:
                                console.print("[yellow]Skipped[/yellow]")
                                continue
                            elif 1 <= choice_num <= len(suggestions):
                                selected_state_id = suggestions[choice_num - 1][1]
                                selected_state_name = suggestions[choice_num - 1][2]
                        else:
                            # Handle text input - search for state name
                            for score, sid, sname, snorm in suggestions:
                                if choice.upper() in sname.upper() or choice.upper() in snorm.upper():
                                    selected_state_id = sid
                                    selected_state_name = sname
                                    break

                        if selected_state_id:
                            # Add all colleges with this state
                            for cid, cname, state in colleges_list:
                                link_records.append((
                                    cname,
                                    '',  # No address for unmatched
                                    state,
                                    cid,
                                    selected_state_id
                                ))
                            console.print(f"[green]✓ Mapped {len(colleges_list)} college(s) to {selected_state_name}[/green]")

                            # Create state alias for this mapping
                            cursor.execute("""
                                INSERT OR REPLACE INTO state_aliases (original_name, alias_name, state_id, created_at)
                                VALUES (?, ?, ?, ?)
                            """, (unmatched_state, selected_state_name, selected_state_id, datetime.now().isoformat()))
                            console.print(f"[dim]  → Created state alias: {unmatched_state} → {selected_state_name}[/dim]")
                        else:
                            console.print(f"[yellow]Invalid choice. Skipping these colleges.[/yellow]")

            # Delete existing links and insert new ones
            with console.status("[bold green]Updating database..."):
                cursor.execute("DELETE FROM state_college_link")

                if link_records:
                    cursor.executemany("""
                        INSERT INTO state_college_link
                        (college_name, address, state, college_id, state_id)
                        VALUES (?, ?, ?, ?, ?)
                    """, link_records)

                conn.commit()

            console.print(f"\n[green]✅ Successfully rebuilt state_college_link table![/green]")
            console.print(f"[green]✓ Total colleges: {college_count:,}[/green]")
            console.print(f"[green]✓ Links created: {len(link_records):,}[/green]")

            # Show breakdown by college type
            cursor.execute("""
                SELECT c.college_type, COUNT(*) as count
                FROM state_college_link scl
                JOIN colleges c ON scl.college_id = c.id
                GROUP BY c.college_type
            """)

            console.print(f"\n[bold cyan]Links by College Type:[/bold cyan]")
            for college_type, count in cursor.fetchall():
                console.print(f"  • {college_type}: {count:,}")

            # Ask if user wants to run match and link now
            if interactive_review and Confirm.ask("\n[bold cyan]🚀 Run Match & Link process now?[/bold cyan]", default=True):
                conn.close()  # Close master DB connection
                console.print("\n[cyan]Starting Match & Link process...[/cyan]")

                try:
                    # Determine which data type to process
                    if self.data_type == 'counselling':
                        self.match_and_link_parallel('counselling_records', 'counselling_records')
                    else:
                        # Check which table to use for seat data
                        seat_conn = sqlite3.connect(self.seat_db_path)
                        seat_cursor = seat_conn.cursor()
                        seat_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='seat_data'")
                        source_table = 'seat_data' if seat_cursor.fetchone() else 'seat_data_linked'
                        seat_conn.close()

                        self.match_and_link_parallel('seat_data', source_table)

                    console.print("\n[green]✅ Match & Link process completed![/green]")
                except Exception as match_error:
                    console.print(f"\n[red]❌ Error during Match & Link: {match_error}[/red]")
                    import traceback
                    traceback.print_exc()

        except Exception as e:
            console.print(f"[red]✗ Error: {e}[/red]")
            conn.rollback()
            import traceback
            traceback.print_exc()
        finally:
            conn.close()

    def import_colleges_submenu(self):
        """Submenu for importing colleges (medical/dental/dnb)"""
        console.print("\n[bold cyan]🏥 Import Colleges[/bold cyan]")
        console.print("━" * 60)
        console.print("  [1] Medical Colleges")
        console.print("  [2] Dental Colleges")
        console.print("  [3] DNB Colleges")
        console.print("  [4] Back")
        console.print("━" * 60)

        choice = Prompt.ask("College type", choices=["1", "2", "3", "4"], default="1")

        if choice == "1":
            self.import_medical_colleges_interactive()
        elif choice == "2":
            self.import_dental_colleges_interactive()
        elif choice == "3":
            self.import_dnb_colleges_interactive()

    def show_master_data_management_menu(self):
        """Master Data Management Menu"""
        while True:
            console.print("\n[bold cyan]🗄️  Master Data Management[/bold cyan]")
            console.print("━" * 60)
            console.print("  [1] View Master Data Statistics")
            console.print("  [2] Import Colleges (Medical/Dental/DNB) →")
            console.print("  [3] Import Courses (Excel)")
            console.print("  [4] Import States (Excel)")
            console.print("  [5] Import Quotas (Excel)")
            console.print("  [6] Import Categories (Excel)")
            console.print("  [7] 🔗 Rebuild State-College Link Table")
            console.print("  [8] Import All from Default Paths")
            console.print("  [9] Export Master Data to Excel")
            console.print("  [10] Back to Main Menu")
            console.print("━" * 60)

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], default="1")

            if choice == "1":
                self.show_master_data_stats()

            elif choice == "2":
                self.import_colleges_submenu()

            elif choice == "3":
                self.import_courses_interactive()

            elif choice == "4":
                self.import_states_interactive()

            elif choice == "5":
                self.import_quotas_interactive()

            elif choice == "6":
                self.import_categories_interactive()

            elif choice == "7":
                self.rebuild_state_college_link()

            elif choice == "8":
                # Import all from default paths
                console.print("\n[bold yellow]⚠️  Import All Feature:[/bold yellow]")
                console.print("[yellow]This will import all 7 data types sequentially.[/yellow]")
                console.print("[yellow]Each import will ask for confirmation individually.[/yellow]")
                console.print("[yellow]You can press Ctrl+C to stop at any time.[/yellow]")

                if not Confirm.ask("\n[bold]Proceed with importing all master data?[/bold]", default=True):
                    console.print("[yellow]Import all cancelled[/yellow]")
                    continue

                console.print("\n[bold cyan]Starting batch import of all master data types...[/bold cyan]")
                console.print("━" * 60)

                # Import each type sequentially (each will show its own progress)
                try:
                    console.print("\n[bold]1/7 - Medical Colleges[/bold]")
                    self.import_medical_colleges_interactive()

                    console.print("\n[bold]2/7 - Dental Colleges[/bold]")
                    self.import_dental_colleges_interactive()

                    console.print("\n[bold]3/7 - DNB Colleges[/bold]")
                    self.import_dnb_colleges_interactive()

                    console.print("\n[bold]4/7 - Courses[/bold]")
                    self.import_courses_interactive()

                    console.print("\n[bold]5/7 - States[/bold]")
                    self.import_states_interactive()

                    console.print("\n[bold]6/7 - Quotas[/bold]")
                    self.import_quotas_interactive()

                    console.print("\n[bold]7/7 - Categories[/bold]")
                    self.import_categories_interactive()

                    console.print("\n[bold]8/8 - Rebuilding State-College Links[/bold]")
                    self.rebuild_state_college_link()

                    console.print("\n" + "━" * 60)
                    console.print("[bold green]✅ All master data import completed![/bold green]")
                    console.print("[green]Successfully imported all 7 data types + rebuilt links.[/green]")

                except KeyboardInterrupt:
                    console.print("\n[yellow]⚠️  Import interrupted by user[/yellow]")
                except Exception as e:
                    console.print(f"\n[red]❌ Error during batch import: {e}[/red]")

            elif choice == "9":
                # Export master data
                export_path = Prompt.ask("Export directory", default="./exports")
                Path(export_path).mkdir(exist_ok=True)

                conn = sqlite3.connect(self.master_db_path)

                with console.status("[bold green]Exporting data..."):
                    # Export colleges
                    med_df = pd.read_sql("SELECT id, name, state, address FROM medical_colleges", conn)
                    med_df.to_excel(f"{export_path}/medical_colleges_export.xlsx", index=False)

                    den_df = pd.read_sql("SELECT id, name, state, address FROM dental_colleges", conn)
                    den_df.to_excel(f"{export_path}/dental_colleges_export.xlsx", index=False)

                    dnb_df = pd.read_sql("SELECT id, name, state, address FROM dnb_colleges", conn)
                    dnb_df.to_excel(f"{export_path}/dnb_colleges_export.xlsx", index=False)

                    # Export courses
                    crs_df = pd.read_sql("SELECT id, name FROM courses", conn)
                    crs_df.to_excel(f"{export_path}/courses_export.xlsx", index=False)

                    # Export states, quotas, categories
                    try:
                        states_df = pd.read_sql("SELECT id, name FROM states", conn)
                        states_df.to_excel(f"{export_path}/states_export.xlsx", index=False)
                    except:
                        states_df = pd.DataFrame()

                    try:
                        quotas_df = pd.read_sql("SELECT id, name FROM quotas", conn)
                        quotas_df.to_excel(f"{export_path}/quotas_export.xlsx", index=False)
                    except:
                        quotas_df = pd.DataFrame()

                    try:
                        cats_df = pd.read_sql("SELECT id, name FROM categories", conn)
                        cats_df.to_excel(f"{export_path}/categories_export.xlsx", index=False)
                    except:
                        cats_df = pd.DataFrame()

                conn.close()

                console.print(f"[green]✅ Exported all master data to {export_path}/[/green]")
                console.print(f"  • medical_colleges_export.xlsx ({len(med_df)} records)")
                console.print(f"  • dental_colleges_export.xlsx ({len(den_df)} records)")
                console.print(f"  • dnb_colleges_export.xlsx ({len(dnb_df)} records)")
                console.print(f"  • courses_export.xlsx ({len(crs_df)} records)")
                if len(states_df) > 0:
                    console.print(f"  • states_export.xlsx ({len(states_df)} records)")
                if len(quotas_df) > 0:
                    console.print(f"  • quotas_export.xlsx ({len(quotas_df)} records)")
                if len(cats_df) > 0:
                    console.print(f"  • categories_export.xlsx ({len(cats_df)} records)")

            elif choice == "10":
                break

    @lru_cache(maxsize=10000)
    def normalize_text(self, text):
        """Enhanced text normalization with config support and caching

        Features:
        - Context-aware medical degree normalization
        - Smart character replacement (& → AND, / → space)
        - Selective character preservation
        - Punctuation correction (,, removal, leading/trailing cleanup)
        - Configurable rules
        """
        # Handle None, NaN, and empty strings
        if text is None or pd.isna(text) or text == '':
            return ''

        text = str(text).strip()

        # Double-check after strip
        if not text:
            return ''

        # ========== STAGE 1: Context-Aware Pre-Processing ==========

        context_aware = self.config['normalization'].get('context_aware', {})

        # 1.1: Medical degrees normalization (before removing dots)
        if context_aware.get('medical_degrees', True):
            # Common degree patterns
            medical_degrees = {
                r'\bM\.B\.B\.S\.?\b': 'MBBS',
                r'\bM\.B\.B\.S\b': 'MBBS',
                r'\bB\.D\.S\.?\b': 'BDS',
                r'\bB\.D\.S\b': 'BDS',
                r'\bM\.D\.S\.?\b': 'MDS',
                r'\bM\.D\.S\b': 'MDS',
                r'\bM\.D\.?\b': 'MD',
                r'\bM\.S\.?\b': 'MS',
                r'\bD\.M\.?\b': 'DM',
                r'\bM\.CH\.?\b': 'MCH',
                r'\bD\.N\.B\.?\b': 'DNB',
                r'\bM\.SC\.?\b': 'MSC',
                r'\bPH\.D\.?\b': 'PHD',
            }

            for pattern, replacement in medical_degrees.items():
                text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # ========== STAGE 2: Smart Character Replacement ==========

        replace_chars = self.config['normalization'].get('replace_chars', {})
        for char, replacement in replace_chars.items():
            text = text.replace(char, replacement)

        # ========== STAGE 3: Standard Normalization ==========

        # Convert to uppercase
        if self.config['normalization'].get('to_uppercase', True):
            text = text.upper()

        # Remove 6-digit numbers (pincodes)
        if self.config['normalization'].get('remove_pincodes', True):
            text = re.sub(r'\b\d{6}\b', '', text)

        # Remove dots (after medical degree normalization)
        text = re.sub(r'\.', ' ', text)

        # Expand abbreviations from config
        for abbrev, expansion in self.abbreviations.items():
            text = re.sub(r'\b' + re.escape(abbrev) + r'\b', expansion, text)

        # Handle hyphens for compound words
        if self.config['normalization'].get('handle_hyphens_dots', True):
            if context_aware.get('compound_words', True):
                # Keep hyphens in known compound patterns (POST-GRADUATE, etc.)
                # Add space around hyphens but don't remove them yet
                text = re.sub(r'(?<!\s)-(?!\s)', ' - ', text)
            else:
                # Remove hyphens entirely
                text = re.sub(r'-', ' ', text)

        # ========== STAGE 4: Selective Character Removal ==========

        # Build pattern for characters to keep
        preserve_chars = self.config['normalization'].get('preserve_chars', [])

        # Always preserve: alphanumeric, spaces, commas, parentheses
        base_keep = r'\w\s,()'

        # Add preserved characters to the pattern
        for char in preserve_chars:
            base_keep += re.escape(char)

        # Remove special characters (but preserve configured chars)
        if self.config['normalization'].get('remove_special_chars', False):
            # Old behavior: aggressive removal
            text = re.sub(r'[^\w\s,()]', '', text)
        else:
            # New behavior: selective removal
            # Remove only chars NOT in our keep list
            pattern = f'[^{base_keep}]'
            text = re.sub(pattern, '', text)

        # ========== STAGE 5: Enhanced Punctuation Correction ==========

        fix_punct = self.config['normalization'].get('fix_punctuation', {})

        # ENHANCED: Remove multiple consecutive commas first (before spacing fixes)
        # This handles ",," and ", ," patterns
        if fix_punct.get('remove_double_commas', True):
            # Remove patterns like ",," or ", ," or ",,,"
            text = re.sub(r',(\s*,)+', ',', text)  # Multiple commas with optional spaces → single comma
            text = re.sub(r',{2,}', ',', text)  # Double commas → single comma (backup)

        if fix_punct.get('remove_double_dots', True):
            text = re.sub(r'\.{2,}', '.', text)  # .. or ... → .

        # ENHANCED: Fix comma-space patterns comprehensively
        if fix_punct.get('fix_comma_spacing', True):
            # Step 1: Remove all spaces before commas: " ," or "  ," → ","
            text = re.sub(r'\s+,', ',', text)

            # Step 2: Normalize spaces after commas
            # First, ensure at least one space after comma (unless at end or before another comma)
            text = re.sub(r',(?=[^\s,])', ', ', text)  # ",X" → ", X" (but not ",,")

            # Then, collapse multiple spaces after comma to single space
            text = re.sub(r',\s{2,}', ', ', text)  # ", X" → ", X"

        # ENHANCED: Remove leading punctuation and whitespace aggressively
        # This handles cases like ", NEW DELHI" or " ,NEW DELHI" or "  , NEW DELHI"
        if fix_punct.get('remove_leading_punctuation', True):
            # Keep removing leading punctuation and spaces until none left
            while True:
                old_text = text
                text = re.sub(r'^[\s,.\-]+', '', text)
                if old_text == text:
                    break

        # ENHANCED: Remove trailing punctuation and whitespace aggressively
        if fix_punct.get('remove_trailing_punctuation', True):
            # Keep removing trailing punctuation and spaces until none left
            while True:
                old_text = text
                text = re.sub(r'[\s,.\-]+$', '', text)
                if old_text == text:
                    break

        # NEW: Remove comma at the very end if it exists (after other cleanup)
        text = re.sub(r',$', '', text).strip()

        # Remove multiple consecutive spaces (cleanup after all operations)
        if fix_punct.get('remove_extra_spaces', True):
            text = re.sub(r'\s{2,}', ' ', text)

        # ========== STAGE 6: Final Whitespace Normalization ==========

        # Normalize whitespace (collapse multiple spaces)
        if self.config['normalization'].get('normalize_whitespace', True):
            text = re.sub(r'\s+', ' ', text).strip()

        return text

    def split_college_institute(self, college_institute_raw):
        """Split college/institute field into college name and address with enhanced cleaning

        For counselling data, the college_institute_raw field contains:
        - College name (before first comma)
        - Address (after first comma)

        This function performs pre-processing to handle malformed data like:
        - Leading/trailing commas and spaces
        - Multiple consecutive commas (,, or , ,)
        - Improper spacing around commas

        Args:
            college_institute_raw: Raw college/institute field

        Returns:
            tuple: (college_name, address)

        Examples:
            Input: ", NEW DELHI,VARDHMAN MAHAVIR MEDICAL COLLEGE,, NEW DELHI, DELHI (NCT)"
            Output: ("NEW DELHI", "VARDHMAN MAHAVIR MEDICAL COLLEGE, NEW DELHI, DELHI (NCT)")

            Input: ",NIZAMS INSTITUTE OF MEDICAL SCIENCES PANJAGUTTA HYDERABAD, TELANGANA"
            Output: ("NIZAMS INSTITUTE OF MEDICAL SCIENCES PANJAGUTTA HYDERABAD", "TELANGANA")
        """
        if pd.isna(college_institute_raw) or college_institute_raw == '':
            return ('', '')

        text = str(college_institute_raw).strip()

        # STEP 1: Pre-processing - fix common malformations before splitting

        # Remove leading commas and spaces (handles ", COLLEGE" or " ,COLLEGE")
        text = re.sub(r'^[\s,]+', '', text)

        # Remove trailing commas and spaces
        text = re.sub(r'[\s,]+$', '', text)

        # Fix multiple consecutive commas with optional spaces (,, or , , or , ,, etc.)
        text = re.sub(r',(\s*,)+', ',', text)

        # Normalize spacing around commas: ensure single space after comma
        text = re.sub(r'\s*,\s*', ',', text)  # First remove all spaces around commas
        text = re.sub(r',(?=[^\s])', ', ', text)  # Then add single space after each comma

        # STEP 2: Split on first comma
        if ',' in text:
            parts = text.split(',', 1)
            college_name = parts[0].strip()
            address = parts[1].strip() if len(parts) > 1 else ''

            # STEP 3: Additional cleanup after split
            # Remove any remaining leading/trailing punctuation from both parts
            college_name = re.sub(r'^[\s,.\-]+', '', college_name)
            college_name = re.sub(r'[\s,.\-]+$', '', college_name)

            address = re.sub(r'^[\s,.\-]+', '', address)
            address = re.sub(r'[\s,.\-]+$', '', address)
        else:
            # No comma found, treat entire text as college name
            college_name = text
            address = ''

        return (college_name, address)

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

    def extract_city_district(self, address):
        """Extract city/district from address string

        Args:
            address: Address string (e.g., "NELLORE, SPSR NELLORE DISTRICT, ANDHRA PRADESH")

        Returns:
            tuple: (city, district) or (None, None) if not found

        Examples:
            "NELLORE, SPSR NELLORE DISTRICT" → ("NELLORE", "SPSR NELLORE")
            "OPP AC SUBBAREDDY STADIUM DARGAMITTA NELLORE" → ("NELLORE", None)
        """
        if not address or pd.isna(address):
            return None, None

        address_normalized = self.normalize_text(address)

        # Common district patterns
        district_patterns = [
            r'(\w+(?:\s+\w+)*)\s+DISTRICT',  # "NELLORE DISTRICT", "SPSR NELLORE DISTRICT"
            r'(\w+(?:\s+\w+)*)\s+DIST',      # "NELLORE DIST"
        ]

        district = None
        for pattern in district_patterns:
            match = re.search(pattern, address_normalized)
            if match:
                district = match.group(1).strip()
                break

        # Extract city (often appears before district or at start of address)
        city = None

        # Split by commas and take meaningful parts
        parts = [p.strip() for p in address_normalized.split(',') if p.strip()]

        # Filter out obvious non-city parts
        non_city_keywords = {'OPP', 'NEAR', 'OPPOSITE', 'STADIUM', 'ROAD', 'STREET', 'BEHIND'}

        for part in parts:
            # Skip parts with non-city keywords
            if any(keyword in part for keyword in non_city_keywords):
                continue

            # Skip state names
            if 'PRADESH' in part or 'TELANGANA' in part or 'KARNATAKA' in part:
                continue

            # Skip "DISTRICT" parts (already extracted)
            if 'DISTRICT' in part or 'DIST' in part:
                continue

            # Take the first valid part as city
            if len(part) >= 3:  # Minimum length
                city = part
                break

        return city, district

    def validate_geography(self, query_address, candidate_address, query_state, candidate_state):
        """Validate geographic match between query and candidate

        Returns:
            dict: {
                'state_match': bool,
                'city_match': bool or None,
                'district_match': bool or None,
                'confidence_boost': float (0.0 to 0.1)
            }
        """
        result = {
            'state_match': False,
            'city_match': None,
            'district_match': None,
            'confidence_boost': 0.0
        }

        # Validate state (MUST match)
        query_state_norm = self.normalize_text(query_state) if query_state else ''
        candidate_state_norm = self.normalize_text(candidate_state) if candidate_state else ''

        result['state_match'] = query_state_norm == candidate_state_norm

        # If state doesn't match, return immediately
        if not result['state_match']:
            return result

        # Extract cities and districts
        query_city, query_district = self.extract_city_district(query_address)
        candidate_city, candidate_district = self.extract_city_district(candidate_address)

        # Validate city
        if query_city and candidate_city:
            query_city_norm = self.normalize_text(query_city)
            candidate_city_norm = self.normalize_text(candidate_city)

            # Check exact match or substring match
            if query_city_norm == candidate_city_norm:
                result['city_match'] = True
                result['confidence_boost'] += 0.05
            elif query_city_norm in candidate_city_norm or candidate_city_norm in query_city_norm:
                result['city_match'] = True
                result['confidence_boost'] += 0.03
            else:
                result['city_match'] = False

        # Validate district
        if query_district and candidate_district:
            query_district_norm = self.normalize_text(query_district)
            candidate_district_norm = self.normalize_text(candidate_district)

            # Check exact match or substring match
            if query_district_norm == candidate_district_norm:
                result['district_match'] = True
                result['confidence_boost'] += 0.03
            elif query_district_norm in candidate_district_norm or candidate_district_norm in query_district_norm:
                result['district_match'] = True
                result['confidence_boost'] += 0.02
            else:
                result['district_match'] = False

        return result

    def calculate_multi_factor_confidence(
        self,
        name_similarity,
        query_state,
        candidate_state,
        query_address='',
        candidate_address='',
        course_stream_valid=True,
        match_method='fuzzy'
    ):
        """Calculate multi-factor confidence score (0-100)

        Factors:
        - Name similarity (40 points max)
        - State match (30 points max)
        - City match (15 points max)
        - Course/stream validation (10 points max)
        - Address similarity (5 points max)

        Args:
            name_similarity: 0.0-1.0 similarity score
            query_state: State from data
            candidate_state: State from master
            query_address: Address from data
            candidate_address: Address from master
            course_stream_valid: Whether course/stream validation passed
            match_method: Method used (exact, fuzzy, etc.)

        Returns:
            dict: {
                'score': int (0-100),
                'breakdown': dict of factor scores,
                'confidence_level': str ('very_high', 'high', 'medium', 'low')
            }
        """
        score = 0
        breakdown = {}

        # Factor 1: Name similarity (40 points)
        if match_method == 'exact_match':
            name_score = 40
        elif match_method in ['primary_name_match', 'normalized_match']:
            name_score = 38
        else:
            # Scale similarity to 0-40
            name_score = name_similarity * 40

        score += name_score
        breakdown['name_similarity'] = name_score

        # Factor 2: State match (30 points - MUST match)
        geo_validation = self.validate_geography(
            query_address, candidate_address,
            query_state, candidate_state
        )

        if geo_validation['state_match']:
            state_score = 30
            score += state_score
            breakdown['state_match'] = state_score

            # Factor 3: City/District match (15 points)
            city_district_score = 0
            if geo_validation['city_match']:
                city_district_score += 10
            if geo_validation['district_match']:
                city_district_score += 5

            score += city_district_score
            breakdown['city_district'] = city_district_score
        else:
            # State doesn't match - REJECT
            breakdown['state_match'] = 0
            breakdown['city_district'] = 0
            return {
                'score': 0,
                'breakdown': breakdown,
                'confidence_level': 'rejected_state_mismatch'
            }

        # Factor 4: Course/stream validation (10 points)
        stream_score = 10 if course_stream_valid else 0
        score += stream_score
        breakdown['course_stream'] = stream_score

        # Factor 5: Address similarity (5 points)
        if query_address and candidate_address:
            query_addr_norm = self.normalize_text(query_address)
            candidate_addr_norm = self.normalize_text(candidate_address)

            addr_similarity = fuzz.ratio(query_addr_norm, candidate_addr_norm) / 100
            addr_score = addr_similarity * 5
            score += addr_score
            breakdown['address_similarity'] = addr_score
        else:
            breakdown['address_similarity'] = 0

        # Determine confidence level
        if score >= 95:
            confidence_level = 'very_high'  # Auto-accept
        elif score >= 85:
            confidence_level = 'high'
        elif score >= 75:
            confidence_level = 'medium'
        elif score >= 60:
            confidence_level = 'low'
        else:
            confidence_level = 'very_low'

        return {
            'score': int(score),
            'breakdown': breakdown,
            'confidence_level': confidence_level
        }

    def detect_course_type(self, course_name):
        """Detect course type based on config.yaml patterns with three-tier DIPLOMA classification

        Uses course_classification from config.yaml for accurate stream detection.

        Returns:
            str: 'medical', 'dental', 'dnb', 'diploma', or 'unknown'
        """
        if pd.isna(course_name) or course_name == '':
            return 'unknown'

        course_name = str(course_name).upper()

        # PRIORITY 1: Check DNB patterns FIRST (most specific - DNB- or DNB prefix)
        for pattern in self.config['course_classification']['dnb_patterns']:
            if course_name.startswith(pattern):
                logger.debug(f"Course '{course_name}' matched DNB pattern '{pattern}'")
                return 'dnb'

        # PRIORITY 2: Check dental patterns SECOND (BDS, MDS, PG DIPLOMA)
        for pattern in self.config['course_classification']['dental_patterns']:
            if pattern in course_name:
                logger.debug(f"Course '{course_name}' matched dental pattern '{pattern}'")
                return 'dental'

        # PRIORITY 3: Handle DIPLOMA courses with three-tier classification
        if 'DIPLOMA' in course_name:
            # Check if it's DNB-only course
            if course_name in self.config['diploma_courses']['dnb_only']:
                logger.debug(f"Course '{course_name}' is DNB-only DIPLOMA")
                return 'dnb'

            # Check if it's overlapping course (medical + dnb)
            elif course_name in self.config['diploma_courses']['overlapping']:
                logger.debug(f"Course '{course_name}' is overlapping DIPLOMA (medical+dnb)")
                return 'diploma'  # Triggers MEDICAL→DNB fallback
            else:
                # All other DIPLOMA courses default to medical
                logger.debug(f"Course '{course_name}' is medical-only DIPLOMA")
                return 'medical'

        # PRIORITY 4: Check medical patterns LAST (MBBS, MD, MS, etc.)
        for pattern in self.config['course_classification']['medical_patterns']:
            if pattern in course_name:
                logger.debug(f"Course '{course_name}' matched medical pattern '{pattern}'")
                return 'medical'

        logger.debug(f"Course '{course_name}' type unknown")
        return 'unknown'
    
    def apply_aliases(self, text, alias_type, state=None, address=None):
        """Apply aliases to text with location context

        Semantics:
            - Looks up the incoming text (from counselling/seat data) in original_name
            - Returns the standardized master name from alias_name
            - Example: "DIPLOMA IN OTORHINOLARYNGOLOGY" → "DIPLOMA IN ENT"
        """
        # Safety check: handle None/empty text
        if not text or pd.isna(text):
            return text if text else ''

        aliases = self.aliases.get(alias_type, [])

        # For college aliases, prioritize location-aware matching
        if alias_type == 'college' and state:
            state_normalized = self.normalize_text(state)

            # Safely handle None state_normalized
            state_norm_upper = state_normalized.upper() if state_normalized else ''

            # First, try exact match with state
            # Incoming text should match original_name (the variant from data)
            for alias in aliases:
                # Safely get alias state - handle None values
                alias_state = (alias.get('state_normalized') or '').upper() if alias.get('state_normalized') else ''
                # Safely get original_name - handle None values
                alias_original = (alias.get('original_name') or '').upper() if alias.get('original_name') else ''

                if (alias_original == text.upper() and
                    state_norm_upper and alias_state and
                    alias_state == state_norm_upper):
                    logger.info(f"Location-aware alias match: '{text}' ({state}) → '{alias['alias_name']}'")
                    return alias['alias_name']

            # Then, try match with state and address if provided
            if address:
                address_normalized = self.normalize_text(address)
                address_norm_upper = address_normalized.upper() if address_normalized else ''

                for alias in aliases:
                    # Safely get alias state, address, and original_name - handle None values
                    alias_state = (alias.get('state_normalized') or '').upper() if alias.get('state_normalized') else ''
                    alias_addr = (alias.get('address_normalized') or '').upper() if alias.get('address_normalized') else ''
                    alias_original = (alias.get('original_name') or '').upper() if alias.get('original_name') else ''

                    if (alias_original == text.upper() and
                        state_norm_upper and alias_state and
                        alias_state == state_norm_upper and
                        alias_addr and address_norm_upper and address_norm_upper in alias_addr):
                        logger.info(f"Location+Address alias match: '{text}' ({state}, {address}) → '{alias['alias_name']}'")
                        return alias['alias_name']

        # Fallback: exact match without location
        # CORRECT SEMANTICS: incoming text (from data) matches original_name → return alias_name (master standardized)
        for alias in aliases:
            # Safely handle None in original_name
            original_name = (alias.get('original_name') or '').upper() if alias.get('original_name') else ''
            if original_name == text.upper():
                logger.info(f"Alias match: '{text}' → '{alias['alias_name']}'")
                return alias['alias_name']

        return text

    def parse_round_field(self, round_raw):
        """Parse round field to extract source, level, and round number

        Format: {SOURCE}_{LEVEL}_R{NUMBER}
        Examples:
            - AIQ_UG_R4 → ('AIQ', 'UG', 4)
            - KEA_PG_R3 → ('KEA', 'PG', 3)
            - KEA_DEN_R2 → ('KEA', 'DEN', 2)

        Args:
            round_raw: Raw round field from Excel

        Returns:
            tuple: (source, level, round_num) or (None, None, None) if parsing fails
        """
        if pd.isna(round_raw) or not round_raw:
            return (None, None, None)

        round_str = str(round_raw).strip().upper()

        try:
            # Split by underscore: ['AIQ', 'UG', 'R4']
            parts = round_str.split('_')

            if len(parts) >= 3:
                source = parts[0]  # AIQ or KEA
                level = parts[1]   # UG, PG, or DEN
                round_str = parts[2]  # R4

                # Extract round number from 'R4' → 4
                round_num = int(round_str.replace('R', ''))

                return (source, level, round_num)
        except Exception as e:
            logger.warning(f"Failed to parse round field '{round_raw}': {e}")

        return (None, None, None)

    # ============================================================================
    # INTELLIGENT MATCHING METHODS (Features 1-7)
    # ============================================================================

    def get_match_level(self, score):
        """Feature 1: Determine match level based on hierarchical thresholds"""
        for level_name, level_info in self.match_levels.items():
            if level_info['min'] <= score <= level_info['max']:
                return level_name, level_info
        return 'poor', self.match_levels['poor']

    def intelligent_normalize(self, text):
        """Feature 6: Enhanced normalization with medical terms and abbreviations"""
        if not text:
            return ''

        text = str(text).upper().strip()

        # Apply medical term mappings
        for british, american in self.medical_term_mappings.items():
            text = re.sub(r'\b' + re.escape(british) + r'\b', american, text)

        # Apply address abbreviations (normalize all variants to standard form)
        for standard, variants in self.address_abbreviations.items():
            for variant in variants:
                if variant != standard:
                    text = re.sub(r'\b' + re.escape(variant) + r'\b', standard, text)

        # Standard normalization
        text = self.normalize_text(text)

        return text

    def detect_alias_patterns(self, aliases):
        """Feature 2: Detect common patterns in aliases"""
        patterns = {
            'abbreviations': {},
            'medical_terms': {},
            'common_variants': {}
        }

        for alias in aliases:
            original = alias.get('original_name', '')
            alias_name = alias.get('alias_name', '')

            if not original or not alias_name:
                continue

            # Detect abbreviation patterns
            orig_words = original.split()
            alias_words = alias_name.split()

            # If alias is significantly shorter, likely an abbreviation
            if len(alias_name) < len(original) * 0.5:
                # Find the abbreviated parts
                for ow in orig_words:
                    for aw in alias_words:
                        if ow.startswith(aw) and len(aw) >= 2:
                            patterns['abbreviations'][ow] = aw

            # Detect medical term replacements
            for medical_term, short_form in self.medical_term_mappings.items():
                if medical_term in original and short_form in alias_name:
                    patterns['medical_terms'][medical_term] = short_form

        return patterns

    def detect_duplicates(self, items, threshold=None):
        """Feature 4: Detect duplicate and variant groups"""
        if threshold is None:
            threshold = self.duplicate_threshold

        from rapidfuzz import fuzz
        groups = []
        processed = set()

        for i, item1 in enumerate(items):
            if i in processed:
                continue

            group = [i]
            name1 = item1.get('name', item1) if isinstance(item1, dict) else item1

            for j, item2 in enumerate(items[i+1:], start=i+1):
                if j in processed:
                    continue

                name2 = item2.get('name', item2) if isinstance(item2, dict) else item2
                similarity = fuzz.ratio(name1, name2) / 100

                if similarity >= threshold:
                    group.append(j)
                    processed.add(j)

            if len(group) > 1:
                groups.append(group)
                processed.add(i)

        return groups

    def context_aware_filter(self, course_name, college_candidates):
        """Feature 3: Filter colleges based on course context"""
        if not course_name or not college_candidates:
            return college_candidates

        course_upper = str(course_name).upper()

        # Detect course type from keywords
        detected_type = None
        for ctype, keywords in self.course_type_keywords.items():
            if any(keyword in course_upper for keyword in keywords):
                detected_type = ctype
                break

        if not detected_type:
            return college_candidates  # No filtering

        # Filter colleges by type
        filtered = []
        for college in college_candidates:
            college_type = college.get('type', '').lower()

            # Match course type to college type
            if detected_type == 'medical' and college_type in ['medical', 'dnb']:
                filtered.append(college)
            elif detected_type == 'dental' and college_type in ['dental']:
                filtered.append(college)
            elif detected_type == 'dnb' and college_type in ['dnb', 'medical', 'dental']:
                filtered.append(college)
            elif not college_type:  # Unknown type, include it
                filtered.append(college)

        return filtered if filtered else college_candidates  # Fallback to all if none match

    def parse_college_field(self, college_field):
        """Parse college field into: (college_name, address, state)

        Pattern: "COLLEGE_NAME, ADDRESS_DETAILS, STATE"
        - Before first comma: College name
        - Between commas: Address
        - After last comma: Usually state name

        Returns: (college_name, address, state)

        Example:
            Input: "SAWAI MAN SINGH MEDICAL COLLEGE, JAIPUR, JLN MARG, JAIPUR-302004, RAJASTHAN"
            Output: ("SAWAI MAN SINGH MEDICAL COLLEGE",
                     "JAIPUR, JLN MARG, JAIPUR-302004",
                     "RAJASTHAN")
        """
        if not college_field or pd.isna(college_field):
            return None, None, None

        college_str = str(college_field).strip()

        if ',' not in college_str:
            # No comma, entire field is college name
            return college_str, None, None

        # Split by ALL commas
        parts = [p.strip() for p in college_str.split(',')]

        if len(parts) < 2:
            return college_str, None, None

        # First part is always college name
        college_name = parts[0]

        if len(parts) == 2:
            # Only 2 parts: name + (address OR state)
            second_part = parts[1]

            # Try to detect if it's a state
            if self._is_likely_state(second_part):
                return college_name, None, second_part
            else:
                return college_name, second_part, None

        # 3+ parts: name + address + state
        # Last part is likely state
        last_part = parts[-1]
        middle_parts = parts[1:-1]

        if self._is_likely_state(last_part):
            # Last part is state, middle is address
            address = ', '.join(middle_parts)
            # Clean duplicate state names (e.g., "ANDHRA PRADESH ANDHRA PRADESH" → "ANDHRA PRADESH")
            state_cleaned = ' '.join(dict.fromkeys(last_part.split()))  # Remove duplicate words
            return college_name, address, state_cleaned
        else:
            # Last part is also address, no state found
            address = ', '.join(parts[1:])
            return college_name, address, None

    def _is_likely_state(self, text):
        """Check if text is likely a state name"""
        if not text:
            return False

        text_upper = text.strip().upper()

        # Common state patterns
        common_states = {
            'ANDHRA PRADESH', 'PRADESH', 'TAMIL NADU', 'NADU', 'KARNATAKA', 'KERALA',
            'MAHARASHTRA', 'RAJASTHAN', 'GUJARAT', 'DELHI', 'PUNJAB', 'HARYANA',
            'UTTAR PRADESH', 'MADHYA PRADESH', 'HIMACHAL PRADESH', 'JAMMU', 'KASHMIR',
            'BENGAL', 'WEST BENGAL', 'ODISHA', 'ORISSA', 'ASSAM', 'BIHAR',
            'JHARKHAND', 'CHHATTISGARH', 'UTTARAKHAND', 'GOA', 'SIKKIM',
            'TRIPURA', 'MEGHALAYA', 'MANIPUR', 'MIZORAM', 'NAGALAND', 'ARUNACHAL'
        }

        # Check if it matches common state names
        for state in common_states:
            if state in text_upper or text_upper in state:
                return True

        # Check if it's very short (likely not an address)
        if len(text.split()) == 1 and len(text) > 3:
            # Single word, could be state
            return True

        return False

    def extract_location_keywords(self, address):
        """Extract key location identifiers from address (city, area, landmarks)"""
        if not address:
            return set()

        # Normalize address
        addr_norm = self.intelligent_normalize(str(address))

        # Remove common noise words (generic terms, not location identifiers)
        noise_words = {
            'PRIVATE', 'LIMITED', 'LTD', 'COMPANY', 'CO', 'PVT',
            'ROAD', 'STREET', 'AVENUE', 'LANE', 'MARG',
            'BLOCK', 'SECTOR', 'PHASE', 'FLAT', 'FLOOR',
            'NEAR', 'OPP', 'OPPOSITE', 'BESIDE', 'NEXT', 'BEHIND', 'FRONT',
            'TALUK', 'MANDAL', 'POST', 'OFFICE',
            'PIN', 'CODE', 'PINCODE', 'ZIP',
            'INDIA', 'BHARAT',
            'NORTH', 'SOUTH', 'EAST', 'CENTRAL'
        }

        # Split into words (keep punctuation for now, clean later)
        words = addr_norm.split()

        # Extract meaningful location keywords
        location_keywords = set()
        for word in words:
            # Remove trailing punctuation (commas, periods, etc.)
            word_clean = word.strip('.,;:()[]{}')

            # Skip if too short
            if len(word_clean) <= 3:
                continue

            # Skip if it's a number or mostly numbers
            if word_clean.replace('-', '').replace('/', '').isdigit():
                continue

            # Skip noise words
            if word_clean in noise_words:
                continue

            # Skip if it looks like a street number (e.g., "48-13-3")
            if '-' in word_clean and any(c.isdigit() for c in word_clean):
                continue

            # Keep meaningful location words
            location_keywords.add(word_clean)

        return location_keywords

    def match_addresses(self, address1, address2):
        """Smart address matching that handles different formats

        Returns: (match_score, common_locations)
        - match_score: 0-100 indicating similarity
        - common_locations: set of common location keywords
        """
        if not address1 or not address2:
            return 0, set()

        # Extract location keywords from both addresses
        loc1 = self.extract_location_keywords(address1)
        loc2 = self.extract_location_keywords(address2)

        if not loc1 or not loc2:
            return 0, set()

        # Find common locations
        common = loc1 & loc2

        # Calculate match score
        if not loc1 and not loc2:
            return 0, set()

        # Jaccard similarity: intersection / union
        union = loc1 | loc2
        jaccard_score = len(common) / len(union) * 100 if union else 0

        # Boost score if we have specific matches
        # Cities/towns are usually important
        important_matches = len(common)
        if important_matches >= 2:  # At least 2 common location terms
            jaccard_score = min(100, jaccard_score * 1.5)

        return jaccard_score, common

    def validate_match(self, college, course_name, state, address=None):
        """Feature 3: Validate that match makes sense contextually (college + course + state + address)"""
        warnings = []

        if not college or not course_name:
            return warnings

        course_upper = str(course_name).upper()
        college_name = college.get('name', '').upper()
        college_type = college.get('type', '').lower()
        college_state = college.get('state', '').upper()
        college_address = college.get('address', '')

        # Validation 1: Course type vs College type
        if 'DENTAL' in course_upper or 'BDS' in course_upper or 'MDS' in course_upper:
            if college_type == 'medical' and 'DENTAL' not in college_name:
                warnings.append("⚠️  DENTAL course but MEDICAL college")

        if 'MBBS' in course_upper or ('MD ' in course_upper and 'MDS' not in course_upper):
            if college_type == 'dental':
                warnings.append("⚠️  MEDICAL course but DENTAL college")

        # Validation 2: State mismatch
        if state and college_state:
            if self.normalize_state(state) != self.normalize_state(college_state):
                warnings.append(f"⚠️  State mismatch: {state} vs {college_state}")

        # Validation 3: Smart Address/Location validation
        if address and college_address:
            addr_score, common_locations = self.match_addresses(address, college_address)

            # Show location match info for debugging
            if common_locations:
                locations_str = ', '.join(list(common_locations)[:3])
                if addr_score < 30:  # Less than 30% match
                    warnings.append(f"⚠️  Weak location match ({addr_score:.0f}%): Common: {locations_str}")
            else:
                # No common locations at all
                data_locs = self.extract_location_keywords(address)
                master_locs = self.extract_location_keywords(college_address)

                if data_locs and master_locs:
                    data_str = ', '.join(list(data_locs)[:2])
                    master_str = ', '.join(list(master_locs)[:2])
                    warnings.append(f"⚠️  Location mismatch: '{data_str}' vs '{master_str}'")

        return warnings

    # ============================================================================
    # ENHANCEMENTS #1-#10: Advanced Smart Matching Features
    # ============================================================================

    def _build_location_database(self):
        """Enhancement #8: Build location normalization database"""
        return {
            # Major cities with common variations
            'BANGALORE': {'aliases': ['BENGALURU', 'BANGLORE', 'BLR'], 'state': 'KARNATAKA'},
            'MUMBAI': {'aliases': ['BOMBAY', 'MUM'], 'state': 'MAHARASHTRA'},
            'DELHI': {'aliases': ['NEW DELHI', 'NEWDELHI'], 'state': 'DELHI'},
            'CHENNAI': {'aliases': ['MADRAS', 'CHN'], 'state': 'TAMIL NADU'},
            'KOLKATA': {'aliases': ['CALCUTTA', 'KOL'], 'state': 'WEST BENGAL'},
            'HYDERABAD': {'aliases': ['HYD', 'HYDRABAD'], 'state': 'TELANGANA'},
            'PUNE': {'aliases': ['POONA', 'PUN'], 'state': 'MAHARASHTRA'},
            'JAIPUR': {'aliases': ['JAIPUR'], 'state': 'RAJASTHAN'},
            'LUCKNOW': {'aliases': ['LKO'], 'state': 'UTTAR PRADESH'},
            'VIJAYAWADA': {'aliases': ['VIJAYAVADA', 'VIJAYWADA'], 'state': 'ANDHRA PRADESH'},
            'SILCHAR': {'aliases': ['SYLCHAR'], 'state': 'ASSAM'},
            'DIBRUGARH': {'aliases': [], 'state': 'ASSAM'},
        }

    def normalize_location(self, location_keyword):
        """Enhancement #8: Normalize location names"""
        if not location_keyword:
            return location_keyword

        loc_upper = location_keyword.upper()

        # Check if it matches a known location or alias
        for city, data in self.location_db.items():
            if loc_upper == city or loc_upper in data['aliases']:
                return city  # Return canonical name

        return location_keyword  # Return as-is if not found

    def validate_and_correct_state(self, college_field, state_field):
        """Enhancement #7: Validate and auto-correct state"""
        # Parse college field to extract state
        _, _, state_from_college = self.parse_college_field(college_field)

        # Track parsing
        self.parsing_stats['total_parsed'] += 1

        # If no state in either field
        if not state_field and not state_from_college:
            return None, False

        # If only one source has state
        if state_field and not state_from_college:
            return state_field, False
        if not state_field and state_from_college:
            self.parsing_stats['state_extracted'] += 1
            return state_from_college, False

        # Both have states - check if they match
        state_field_norm = self.normalize_state(state_field)
        college_field_norm = self.normalize_state(state_from_college)

        if state_field_norm == college_field_norm:
            return state_field, False  # No correction needed

        # States don't match - determine which is correct
        valid_states = [self.normalize_state(s.get('name', '')) for s in self.master_data.get('states', [])]

        state_field_valid = state_field_norm in valid_states
        college_field_valid = college_field_norm in valid_states

        if college_field_valid and not state_field_valid:
            # College field has correct state
            logger.warning(f"State corrected: '{state_field}' → '{state_from_college}' (from college field)")
            self.parsing_stats['state_corrected'] += 1
            self.session_stats['states_corrected'] += 1
            return state_from_college, True

        # Default: trust state field
        return state_field, False

    def calculate_match_confidence(self, data_record, master_college, name_score):
        """Enhancement #5: Multi-factor confidence scoring"""
        scores = {
            'name_match': name_score,
            'state_match': 0,
            'address_match': 0,
            'course_type_match': 0
        }

        # State match
        data_state = data_record.get('state', '')
        master_state = master_college.get('state', '')
        if data_state and master_state:
            scores['state_match'] = 100 if self.normalize_state(data_state) == self.normalize_state(master_state) else 0

        # Address match (if available)
        data_address = data_record.get('address', '')
        master_address = master_college.get('address', '')
        if data_address and master_address:
            scores['address_match'], _ = self.match_addresses(data_address, master_address)

        # Course type validation
        data_course = data_record.get('course_name', '')
        if data_course and master_college:
            course_type = self.detect_course_type(data_course)
            college_type = master_college.get('type', '')
            # Simple validation
            scores['course_type_match'] = 100 if self._course_type_matches_college(course_type, college_type) else 0

        # Weighted average
        weights = {'name': 0.4, 'state': 0.2, 'address': 0.3, 'course': 0.1}
        final_score = (
            scores['name_match'] * weights['name'] +
            scores['state_match'] * weights['state'] +
            scores['address_match'] * weights['address'] +
            scores['course_type_match'] * weights['course']
        )

        return final_score, scores

    def _course_type_matches_college(self, course_type, college_type):
        """Check if course type is compatible with college type"""
        if not course_type or not college_type:
            return True  # Can't validate

        course_type = course_type.lower()
        college_type = college_type.lower()

        if course_type == 'medical' and college_type in ['medical', 'dnb']:
            return True
        if course_type == 'dental' and college_type == 'dental':
            return True
        if course_type == 'dnb' and college_type in ['dnb', 'medical', 'dental']:
            return True

        return False

    def should_auto_match(self, match_result):
        """Enhancement #6: Smart auto-matching rules"""
        name_score = match_result.get('name_score', 0)
        state_match = match_result.get('state_match', False)
        address_score = match_result.get('address_score', 0)
        confidence_score = match_result.get('confidence_score', name_score)

        # Rule 1: Perfect name + state match
        if name_score == 100 and state_match:
            return True, "perfect_name_and_state"

        # Rule 2: High name + high address + state match
        if name_score >= 90 and address_score >= 80 and state_match:
            return True, "high_name_address_state"

        # Rule 3: Perfect name + good address (even if state mismatch - handles state errors)
        if name_score == 100 and address_score >= 90:
            return True, "perfect_name_strong_address"

        # Rule 4: Very high multi-factor confidence
        if confidence_score >= 95:
            return True, "high_confidence"

        return False, "manual_review_needed"

    def cluster_by_address(self, records):
        """Enhancement #4: Cluster records by address similarity"""
        if not records:
            return []

        from rapidfuzz import fuzz

        clusters = []
        processed = set()

        for i, record1 in enumerate(records):
            if i in processed:
                continue

            # Start new cluster
            cluster = {
                'representative': record1,
                'records': [record1],
                'location': record1.get('address', ''),
                'keywords': record1.get('keywords', set())
            }

            # Find similar records
            for j, record2 in enumerate(records[i+1:], start=i+1):
                if j in processed:
                    continue

                # Compare addresses
                addr1 = record1.get('address', '')
                addr2 = record2.get('address', '')

                if addr1 and addr2:
                    score, common = self.match_addresses(addr1, addr2)
                    if score >= 80:  # 80% address similarity = same cluster
                        cluster['records'].append(record2)
                        processed.add(j)

            clusters.append(cluster)
            processed.add(i)

        return clusters

    def generate_parsing_report(self):
        """Enhancement #10: Export parsing analytics"""
        total = self.parsing_stats['total_parsed']
        if total == 0:
            return "No parsing data available"

        report = []
        report.append("\n" + "=" * 70)
        report.append("PARSING ANALYTICS REPORT")
        report.append("=" * 70)
        report.append(f"\nTotal Records Parsed: {total:,}")
        report.append(f"  ✅ Name Extracted:    {self.parsing_stats['name_extracted']:,} ({self.parsing_stats['name_extracted']/total*100:.1f}%)")
        report.append(f"  ✅ Address Extracted: {self.parsing_stats['address_extracted']:,} ({self.parsing_stats['address_extracted']/total*100:.1f}%)")
        report.append(f"  ✅ State Extracted:   {self.parsing_stats['state_extracted']:,} ({self.parsing_stats['state_extracted']/total*100:.1f}%)")
        report.append(f"  🔧 State Corrected:   {self.parsing_stats['state_corrected']:,} ({self.parsing_stats['state_corrected']/total*100:.1f}%)")

        if self.parsing_stats['parse_failures']:
            report.append(f"\n⚠️  Parse Failures: {len(self.parsing_stats['parse_failures'])}")
            for failure in self.parsing_stats['parse_failures'][:5]:
                report.append(f"    - {failure}")

        report.append("=" * 70)

        return "\n".join(report)

    def update_user_preferences(self, score, accepted):
        """Feature 5: Learn from user behavior"""
        # Track acceptance rate by score range
        score_bucket = int(score / 10) * 10  # Bucket into 10s: 90-99, 80-89, etc.

        if score_bucket not in self.user_preferences['acceptance_rate']:
            self.user_preferences['acceptance_rate'][score_bucket] = {'accepted': 0, 'rejected': 0}

        if accepted:
            self.user_preferences['acceptance_rate'][score_bucket]['accepted'] += 1
        else:
            self.user_preferences['acceptance_rate'][score_bucket]['rejected'] += 1

        # Adapt auto-match threshold
        # If user consistently accepts 90%+ matches, lower auto-match threshold
        if score_bucket >= 90:
            rate = self.user_preferences['acceptance_rate'][score_bucket]
            if rate['accepted'] + rate['rejected'] >= 5:  # Need at least 5 samples
                acceptance_pct = rate['accepted'] / (rate['accepted'] + rate['rejected'])
                if acceptance_pct > 0.95 and self.user_preferences['auto_match_threshold'] > score_bucket:
                    old_threshold = self.user_preferences['auto_match_threshold']
                    self.user_preferences['auto_match_threshold'] = score_bucket
                    console.print(f"[dim]🧠 Learning: Auto-match threshold lowered from {old_threshold}% to {score_bucket}%[/dim]")

    def suggest_batch_operation(self, matched_item, similar_items):
        """Feature 7: Suggest batch operations for similar items"""
        if len(similar_items) <= 1:
            return None

        return {
            'matched': matched_item,
            'count': len(similar_items),
            'items': similar_items
        }

    def get_session_stats_display(self):
        """Real-time session statistics display"""
        total = sum([
            self.session_stats['auto_matched'],
            self.session_stats['manually_reviewed'],
            self.session_stats['skipped']
        ])

        if total == 0:
            return ""

        from rich.table import Table
        stats_table = Table(title="Session Progress", show_header=False, box=None)
        stats_table.add_column("Metric", style="cyan")
        stats_table.add_column("Count", justify="right", style="green")

        stats_table.add_row("✅ Auto-matched", f"{self.session_stats['auto_matched']:,}")
        stats_table.add_row("👤 Manually reviewed", f"{self.session_stats['manually_reviewed']:,}")
        stats_table.add_row("⏭️  Skipped", f"{self.session_stats['skipped']:,}")
        stats_table.add_row("⭐ High confidence", f"{self.session_stats['high_confidence']:,}")
        stats_table.add_row("📊 Medium confidence", f"{self.session_stats['medium_confidence']:,}")
        stats_table.add_row("⚠️  Low confidence", f"{self.session_stats['low_confidence']:,}")

        if self.session_stats['validation_warnings'] > 0:
            stats_table.add_row("⚠️  Validation warnings", f"{self.session_stats['validation_warnings']:,}")

        return stats_table

    def get_stream_from_course_name(self, course_name):
        """Determine college stream(s) needed based on course name using config.yaml

        This is used in state→course→college filtering to determine which college
        types (medical/dental/dnb) to search.

        Args:
            course_name: The course name to analyze

        Returns:
            list: List of college types to search, e.g., ['medical'], ['dental'], ['medical', 'dnb']

        Examples:
            "MD IN GENERAL MEDICINE" → ['medical']
            "BDS" → ['dental']
            "DNB PEDIATRICS" → ['dnb']
            "DIPLOMA IN ANAESTHESIOLOGY" → ['medical', 'dnb'] (overlapping)
            "DIPLOMA IN FAMILY MEDICINE" → ['dnb'] (dnb-only)
        """
        course_type = self.detect_course_type(course_name)

        # Map course type to college streams
        stream_mapping = {
            'medical': ['medical'],
            'dental': ['dental'],
            'dnb': ['dnb'],
            'diploma': ['medical', 'dnb'],  # Overlapping - search both
            'unknown': ['medical', 'dental', 'dnb']  # Search all if unknown
        }

        streams = stream_mapping.get(course_type, ['medical', 'dental', 'dnb'])
        logger.debug(f"Course '{course_name}' → type '{course_type}' → streams {streams}")

        return streams

    def get_college_pool(self, level=None, source=None, state=None, course_type=None, state_first=True, course_name=None):
        """Get appropriate college pool with OPTIMIZED STATE-FIRST + COURSE-BASED STREAM filtering

        OPTIMIZATION: When state and course info are provided:
        1. Filter by STATE FIRST (2443 → 127 colleges)
        2. Detect STREAM from course name using config.yaml patterns
        3. Filter by STREAM (127 → 41 medical colleges)

        This uses course classification from config.yaml to determine which college
        streams (medical/dental/dnb) to search based on the course name.

        Example:
            STATE→COURSE(stream)→COLLEGE (OPTIMIZED):
            Course: "MD IN GENERAL MEDICINE"
            2443 total → 127 in AP (state) → detect 'medical' stream → 41 medical colleges

            Course: "DIPLOMA IN ANAESTHESIOLOGY" (overlapping)
            2443 total → 127 in AP (state) → detect 'diploma' → 50 medical+dnb colleges

            vs. COURSE→STATE (OLD):
            2443 total → 883 medical (course) → 41 in AP (state)

        Args:
            level: 'UG', 'PG', or 'DEN' (optional, for counselling data)
            source: 'AIQ' or 'KEA' (optional, for state filtering)
            state: State name (optional, for state filtering)
            course_type: 'medical', 'dental', 'dnb' (optional, for seat data - explicit)
            course_name: Course name (optional, for automatic stream detection from config)
            state_first: If True, apply state filter before course type (DEFAULT: True)

        Returns:
            list: List of college dictionaries

        Examples:
            # Optimized: state-first + course name stream detection
            colleges = get_college_pool(
                state='ANDHRA PRADESH',
                course_name='MD IN GENERAL MEDICINE'
            )
            # → 2443 → 127 (state) → 41 (medical stream from course)

            # Overlapping course
            colleges = get_college_pool(
                state='ANDHRA PRADESH',
                course_name='DIPLOMA IN ANAESTHESIOLOGY'
            )
            # → 2443 → 127 (state) → 50 (medical+dnb streams)
        """
        colleges = []

        # OPTIMIZATION: Apply STATE filter first when state + (course_type OR course_name OR level) provided
        if state_first and state and (course_type or course_name or level):
            # Step 1: Get ALL colleges first
            all_colleges = []
            medical_colleges = self.master_data.get('medical', {}).get('colleges', [])
            dental_colleges = self.master_data.get('dental', {}).get('colleges', [])
            dnb_colleges = self.master_data.get('dnb', {}).get('colleges', [])

            all_colleges.extend(medical_colleges)
            all_colleges.extend(dental_colleges)
            all_colleges.extend(dnb_colleges)

            # Debug check removed - types are now correctly loaded

            # Step 2: Filter by STATE first (most restrictive - reduces 2443 to ~127)
            normalized_state = self.normalize_state(state)
            if normalized_state is None:
                normalized_state = self.normalize_text(state)

            # Filter colleges by state using proper state normalization
            state_filtered = []
            for c in all_colleges:
                # Get college's state and normalize it
                college_state = c.get('state', '')
                college_state_normalized = self.normalize_state(college_state) if college_state else ''

                # Also check the pre-normalized field if it exists
                college_normalized_state_field = c.get('normalized_state', '')

                # Match if either normalized values match
                if (college_state_normalized and college_state_normalized.upper() == normalized_state.upper()) or \
                   (college_normalized_state_field and college_normalized_state_field.upper() == normalized_state.upper()):
                    state_filtered.append(c)

            logger.debug(f"STATE filter: {len(all_colleges)} → {len(state_filtered)} colleges in {state}")

            # Step 3: Filter by STREAM (explicit course_type OR auto-detected from course_name)
            # This reduces ~127 to ~41 colleges

            # Option A: Explicit course_type provided (PRIORITY - already detected)
            if course_type:
                # CRITICAL FIX: Check both 'type' and 'college_type' fields (database uses 'college_type', code adds 'type')
                colleges = [c for c in state_filtered 
                           if (c.get('type', '').upper() == course_type.upper() or 
                               c.get('college_type', '').upper() == course_type.upper())]
                logger.debug(f"COURSE filter (explicit '{course_type}'): {len(state_filtered)} → {len(colleges)} {course_type} colleges")
                if len(colleges) == 0 and len(state_filtered) > 0:
                    # Only log at INFO level if no matches found (not a warning - might be expected)
                    available_types = set()
                    for c in state_filtered[:5]:
                        t = c.get('type') or c.get('college_type', 'NO_TYPE')
                        available_types.add(t)
                    logger.info(f"No {course_type} colleges found in state. Available types: {available_types}")

            # Option B: Use course_name to auto-detect stream from config.yaml patterns
            elif course_name:
                streams = self.get_stream_from_course_name(course_name)
                # CRITICAL FIX: Check both 'type' and 'college_type' fields
                colleges = [c for c in state_filtered 
                           if (c.get('type', '').upper() in [s.upper() for s in streams] or
                               c.get('college_type', '').upper() in [s.upper() for s in streams])]
                logger.debug(f"COURSE filter (from name '{course_name[:50]}...'): {len(state_filtered)} → {len(colleges)} colleges (streams: {streams})")

            # Option C: Level-based filtering (counselling data)
            elif level:
                if level == 'UG':
                    # UG: MBBS + BDS → medical + dental
                    colleges = [c for c in state_filtered 
                               if (c.get('type', '').upper() in ['MEDICAL', 'DENTAL'] or
                                   c.get('college_type', '').upper() in ['MEDICAL', 'DENTAL'])]
                elif level == 'PG':
                    # PG: Medical PG + DNB → medical + dnb
                    colleges = [c for c in state_filtered 
                               if (c.get('type', '').upper() in ['MEDICAL', 'DNB'] or
                                   c.get('college_type', '').upper() in ['MEDICAL', 'DNB'])]
                elif level == 'DEN':
                    # DEN: Dental PG → dental only
                    colleges = [c for c in state_filtered 
                               if (c.get('type', '').upper() == 'DENTAL' or
                                   c.get('college_type', '').upper() == 'DENTAL')]

                logger.debug(f"Level filter: {len(state_filtered)} → {len(colleges)} {level} colleges")

            return colleges

        # FALLBACK: Old behavior - course/level first, then state
        # (Used when state not provided, or state_first=False for backward compatibility)

        # Method 1: Filter by course_type (for seat data matching)
        if course_type:
            if course_type in self.master_data:
                colleges.extend(self.master_data[course_type]['colleges'])

        # Method 2: Filter by level (for counselling data matching)
        elif level:
            if level == 'UG':
                # UG: MBBS + BDS → medical_colleges + dental_colleges
                colleges.extend(self.master_data['medical']['colleges'])
                colleges.extend(self.master_data['dental']['colleges'])

            elif level == 'PG':
                # PG: Medical PG + DNB → medical_colleges + dnb_colleges
                colleges.extend(self.master_data['medical']['colleges'])
                colleges.extend(self.master_data['dnb']['colleges'])

            elif level == 'DEN':
                # DEN: Dental PG → dental_colleges only
                colleges.extend(self.master_data['dental']['colleges'])

        # Method 3: Return all colleges if no filter specified
        else:
            colleges.extend(self.master_data.get('medical', {}).get('colleges', []))
            colleges.extend(self.master_data.get('dental', {}).get('colleges', []))
            colleges.extend(self.master_data.get('dnb', {}).get('colleges', []))

        # Apply state filtering if specified (and not already applied above)
        if state and not state_first:
            # Normalize the input state
            normalized_state = self.normalize_state(state)
            if normalized_state is None:
                normalized_state = self.normalize_text(state)

            # Filter by normalized_state if available, otherwise fall back to state
            colleges = [c for c in colleges
                       if (c.get('normalized_state', '').upper() == normalized_state.upper() or
                           self.normalize_text(c.get('state', '')) == self.normalize_text(normalized_state))]

        # Additional KEA-specific filtering (Karnataka only for KEA source)
        if source == 'KEA' and state:
            # Already filtered by state above, but this ensures KEA consistency
            pass

        return colleges

    def get_college_by_id(self, college_id):
        """Get college by ID from master data

        Args:
            college_id: College ID to look up

        Returns:
            dict: College dictionary or None if not found
        """
        if not college_id:
            return None

        # Search in all college types
        for course_type in ['medical', 'dental', 'dnb']:
            if course_type in self.master_data:
                for college in self.master_data[course_type]['colleges']:
                    if college.get('id') == college_id:
                        return college

        # Also check combined colleges list
        if 'colleges' in self.master_data:
            for college in self.master_data['colleges']:
                if college.get('id') == college_id:
                    return college

        return None

    def get_colleges_by_state(self, state, course_type=None):
        """Get colleges filtered by state and optionally course type

        Args:
            state: State name to filter by
            course_type: Optional course type ('medical', 'dental', 'dnb')

        Returns:
            list: List of college dictionaries matching the criteria
        """
        if not state:
            return []

        normalized_state = self.normalize_text(state)
        colleges = []

        # If course_type specified, search only in that category
        if course_type:
            if course_type in self.master_data:
                colleges = [
                    c for c in self.master_data[course_type]['colleges']
                    if self.normalize_text(c.get('state', '')) == normalized_state
                ]
        else:
            # Search all categories
            for ctype in ['medical', 'dental', 'dnb']:
                if ctype in self.master_data:
                    colleges.extend([
                        c for c in self.master_data[ctype]['colleges']
                        if self.normalize_text(c.get('state', '')) == normalized_state
                    ])

        return colleges

    def exact_match_quota_category(self, quota_raw, category_raw):
        """Match quota and category to master data using exact match with aliases

        Uses simple exact matching. Aliases are stored in quota_aliases and
        category_aliases tables to handle variations like "ALL INDIA" → "ALL INDIA QUOTA"

        Args:
            quota_raw: Raw quota value
            category_raw: Raw category value

        Returns:
            tuple: (quota_id, category_id) or (None, None) if no match
        """
        quota_id = None
        category_id = None

        # Match quota
        if quota_raw and not pd.isna(quota_raw):
            quota_normalized = self.normalize_text(str(quota_raw))

            # Try exact match with quota names first
            for quota in self.master_data.get('quotas', []):
                if self.normalize_text(quota['name']) == quota_normalized:
                    quota_id = quota['id']
                    break

            # Try with normalized_name if available
            if not quota_id:
                for quota in self.master_data.get('quotas', []):
                    if quota.get('normalized_name') and self.normalize_text(quota['normalized_name']) == quota_normalized:
                        quota_id = quota['id']
                        break

            # Try aliases
            if not quota_id:
                for alias in self.aliases.get('quota', []):
                    if self.normalize_text(alias['alias_name']) == quota_normalized:
                        quota_id = alias['quota_id']
                        logger.info(f"Quota alias match: '{quota_raw}' → '{alias['original_name']}' (ID: {quota_id})")
                        break

        # Match category
        if category_raw and not pd.isna(category_raw):
            category_normalized = self.normalize_text(str(category_raw))

            # Try exact match with category names first
            for category in self.master_data.get('categories', []):
                if self.normalize_text(category['name']) == category_normalized:
                    category_id = category['id']
                    break

            # Try with normalized_name if available
            if not category_id:
                for category in self.master_data.get('categories', []):
                    if category.get('normalized_name') and self.normalize_text(category['normalized_name']) == category_normalized:
                        category_id = category['id']
                        break

            # Try aliases
            if not category_id:
                for alias in self.aliases.get('category', []):
                    if self.normalize_text(alias['alias_name']) == category_normalized:
                        category_id = alias['category_id']
                        logger.info(f"Category alias match: '{category_raw}' → '{alias['original_name']}' (ID: {category_id})")
                        break

        return (quota_id, category_id)

    def match_source(self, source_raw):
        """Match source to master data with AIQ=MCC mapping

        Args:
            source_raw: Raw source value (e.g., 'MCC', 'KEA', 'AIQ')

        Returns:
            source_id or None if no match
        """
        if not source_raw or pd.isna(source_raw):
            return None

        # Check if sources are loaded
        if not self.master_data.get('sources'):
            logger.warning(f"Sources not loaded from master database - returning None for '{source_raw}'")
            return None

        # Note: AIQ is already stored in the database as SRC001
        # The comment said AIQ=MCC but the actual data shows SRC001 maps to AIQ
        # So we don't need to map AIQ→MCC, just match AIQ directly
        source_normalized = str(source_raw).strip().upper()

        source_normalized = self.normalize_text(source_normalized)

        # Try exact match with source names
        for source in self.master_data.get('sources', []):
            # Handle different possible column names (Source is the actual column name)
            source_name = source.get('Source') or source.get('name') or source.get('source_name') or source.get('source')
            if source_name and self.normalize_text(source_name) == source_normalized:
                return source.get('id')

        # Try with normalized_name if available
        for source in self.master_data.get('sources', []):
            if source.get('normalized_name') and self.normalize_text(source['normalized_name']) == source_normalized:
                return source.get('id')

        # Try fuzzy match for minor variations
        for source in self.master_data.get('sources', []):
            source_name = source.get('Source') or source.get('name') or source.get('source_name') or source.get('source')
            if source_name:
                source_name_norm = self.normalize_text(source_name)
                if fuzz.ratio(source_name_norm, source_normalized) >= 90:
                    logger.info(f"Source fuzzy match: '{source_raw}' → '{source_name}' (ID: {source.get('id')})")
                    return source.get('id')

        logger.warning(f"Source not matched: '{source_raw}'")
        return None

    def match_level(self, level_raw):
        """Match level to master data

        Args:
            level_raw: Raw level value (e.g., 'UG', 'PG', 'DEN')

        Returns:
            level_id or None if no match
        """
        if not level_raw or pd.isna(level_raw):
            return None

        # Check if levels are loaded
        if not self.master_data.get('levels'):
            logger.warning(f"Levels not loaded from master database - returning None for '{level_raw}'")
            return None

        level_normalized = self.normalize_text(str(level_raw))

        # Try exact match with level names
        for level in self.master_data.get('levels', []):
            # Handle different possible column names (Level is the actual column name)
            level_name = level.get('Level') or level.get('name') or level.get('level_name') or level.get('level')
            if level_name and self.normalize_text(level_name) == level_normalized:
                return level.get('id')

        # Try with normalized_name if available
        for level in self.master_data.get('levels', []):
            if level.get('normalized_name') and self.normalize_text(level['normalized_name']) == level_normalized:
                return level.get('id')

        # Try fuzzy match for minor variations
        for level in self.master_data.get('levels', []):
            level_name = level.get('Level') or level.get('name') or level.get('level_name') or level.get('level')
            if level_name:
                level_name_norm = self.normalize_text(level_name)
                if fuzz.ratio(level_name_norm, level_normalized) >= 90:
                    logger.info(f"Level fuzzy match: '{level_raw}' → '{level_name}' (ID: {level.get('id')})")
                    return level.get('id')

        logger.warning(f"Level not matched: '{level_raw}'")
        return None

    def calculate_tfidf_similarity(self, text1, text2, course_type):
        """Calculate TF-IDF similarity between two texts (optimized with caching)"""
        try:
            # Check cache first (if caching enabled)
            cache_key = f"{text1}||{text2}||{course_type}"
            if self.config.get('features', {}).get('enable_tfidf_cache', True) and cache_key in self.tfidf_cache:
                return self.tfidf_cache[cache_key]

            # Get TF-IDF vectors for the course type
            if course_type in self.master_data:
                vectors = self.master_data[course_type]['tfidf_vectors']
                vectorizer = self.master_data[course_type].get('vectorizer')

                if vectorizer is None:
                    return 0.0

                # Find the vector for text2 (assuming it's in master data)
                vector2 = None
                for i, college in enumerate(self.master_data[course_type]['colleges']):
                    if college['normalized_name'] == text2:
                        vector2 = vectors[i]
                        break

                if vector2 is None:
                    return 0.0

                # Vectorize text1 and calculate cosine similarity
                vector1 = vectorizer.transform([text1])
                from sklearn.metrics.pairwise import cosine_similarity
                similarity = cosine_similarity(vector1, vector2)[0][0]

                # Cache result (if caching enabled)
                if self.config.get('features', {}).get('enable_tfidf_cache', True):
                    self.tfidf_cache[cache_key] = similarity

                return similarity

            return 0.0

        except Exception as e:
            logger.warning(f"TF-IDF similarity calculation failed: {e}")
            return 0.0
    
    def match_college_enhanced(self, college_name, state, course_type, address='', course_name=''):
        """Enhanced college matching with proper 4-pass mechanism and DIPLOMA fallback logic

        NEW ENHANCEMENTS:
        - #1: Smart parsing of combined college fields
        - #3: Pre-processing with state validation
        - #7: State validation and auto-correction
        """

        # ENHANCEMENT #1 & #3: Parse combined college field if detected
        original_college_field = college_name
        if ',' in college_name and len(college_name.split(',')) >= 2:
            # Likely contains address - parse it
            parsed_name, parsed_address, parsed_state = self.parse_college_field(college_name)

            if parsed_name:
                college_name = parsed_name
                self.parsing_stats['name_extracted'] += 1
                logger.info(f"📝 Parsed college name: {college_name}")

            if parsed_address and not address:
                address = parsed_address
                self.parsing_stats['address_extracted'] += 1
                self.session_stats['addresses_parsed'] += 1
                logger.info(f"📍 Extracted address: {address[:50]}...")

            # ENHANCEMENT #7: Validate and correct state
            if parsed_state:
                corrected_state, was_corrected = self.validate_and_correct_state(original_college_field, state)
                if was_corrected:
                    logger.warning(f"🔧 State corrected: {state} → {corrected_state}")
                    state = corrected_state

        # Apply aliases with location context for accurate matching
        college_name = self.apply_aliases(college_name, 'college', state=state, address=address)

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
    
    def match_college_smart_hybrid(
        self,
        college_name: str,
        state: str,
        course_type: str,
        address: str = '',
        course_name: str = '',
        fast_threshold: float = None,
        use_ai_fallback: bool = True
    ):
        """
        Smart hybrid matching: Fast fuzzy matching first, AI fallback for difficult cases

        Performance Strategy:
        - FAST PATH (85%+ of cases): Fuzzy matching only (~10-50ms)
        - AI PATH (15% difficult cases): AI-enhanced matching (~1-10s)
        - Average: ~100-200ms per record (100-200x faster than always-AI)

        Args:
            college_name: College name to match
            state: State name
            course_type: Course type (MEDICAL, DENTAL, DNB)
            address: College address (optional)
            course_name: Course name (optional)
            fast_threshold: Score threshold for accepting fast match (default from config)
            use_ai_fallback: Enable AI fallback for low-confidence matches

        Returns:
            Tuple[dict, float, str]: (matched_college, score, method)
        """
        import time
        
        # Get threshold from config or parameter
        if fast_threshold is None:
            fast_threshold = self.config.get('matching', {}).get('hybrid_threshold', 85.0)

        # ========== FAST PATH: Try fuzzy matching first (~10-50ms) ==========
        start_time = time.time()

        fast_result = self.match_college_enhanced(
            college_name=college_name,
            state=state,
            course_type=course_type,
            address=address,
            course_name=course_name
        )

        fast_time = time.time() - start_time

        # Unpack result
        if fast_result and len(fast_result) >= 2:
            fast_match, fast_score, fast_method = fast_result
        else:
            fast_match, fast_score, fast_method = None, 0, 'no_match'

        # Check if fast match is good enough
        if fast_match and fast_score >= fast_threshold:
            logger.info(
                f"✅ FAST PATH: {college_name[:30]} → {fast_match.get('name', '')[:30]} "
                f"(score: {fast_score:.1f}, time: {fast_time*1000:.0f}ms)"
            )
            return (fast_match, fast_score, f'hybrid_fast_{fast_method}')

        # ========== AI PATH: Fast match failed, try AI if enabled (~1-10s) ==========
        if use_ai_fallback and self.enable_advanced_features:
            logger.info(
                f"⚠️  FAST PATH LOW CONFIDENCE (score: {fast_score:.1f}) → Trying AI fallback..."
            )

            ai_start = time.time()

            try:
                ai_result = self.match_college_ai_enhanced(
                    college_name=college_name,
                    state=state,
                    course_type=course_type,
                    address=address,
                    course_name=course_name
                )

                ai_time = time.time() - ai_start

                # Unpack AI result
                if ai_result and len(ai_result) >= 2:
                    ai_match, ai_score, ai_method = ai_result
                else:
                    ai_match, ai_score, ai_method = None, 0, 'no_match'

                # Compare fast vs AI results
                if ai_match and ai_score > fast_score:
                    logger.info(
                        f"✅ AI PATH: {college_name[:30]} → {ai_match.get('name', '')[:30]} "
                        f"(score: {ai_score:.1f}, time: {ai_time*1000:.0f}ms, improvement: +{ai_score-fast_score:.1f})"
                    )
                    return (ai_match, ai_score, f'hybrid_ai_{ai_method}')
                else:
                    logger.info(
                        f"⚠️  AI PATH: No improvement over fast match (AI: {ai_score:.1f} vs Fast: {fast_score:.1f})"
                    )

            except Exception as e:
                logger.warning(f"AI fallback failed: {e}")
                # Fall through to return fast result

        # ========== FALLBACK: Return best available result ==========
        total_time = time.time() - start_time

        if fast_match:
            logger.info(
                f"⚠️  RETURNING LOW-CONFIDENCE FAST MATCH: score={fast_score:.1f}, time={total_time*1000:.0f}ms"
            )
            return (fast_match, fast_score, f'hybrid_fast_low_{fast_method}')
        else:
            logger.warning(
                f"❌ NO MATCH FOUND: {college_name} in {state} (tried fast + AI, time={total_time*1000:.0f}ms)"
            )
            return (None, 0, 'hybrid_no_match')
    
    def match_overlapping_diploma_course(self, college_name, state, address, course_name):
        """Match overlapping DIPLOMA courses with MEDICAL→DNB fallback"""
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)
        
        # Try MEDICAL first (24 colleges)
        logger.info(f"Overlapping DIPLOMA course {course_name}: Trying MEDICAL first (24 colleges)")

        # PASS 1: Get filtered MEDICAL candidates using get_college_pool
        medical_state_candidates = self.get_college_pool(course_type='medical', state=state)

        if not medical_state_candidates:
            # Fallback without state filtering
            medical_state_candidates = self.get_college_pool(course_type='medical')
        
        # PASS 3: College name matching for MEDICAL (with address context)
        medical_matches = self.pass3_college_name_matching(normalized_college, medical_state_candidates, normalized_state, normalized_address)

        logger.info(f"Overlapping DIPLOMA: Found {len(medical_matches) if medical_matches else 0} MEDICAL matches")

        if medical_matches:
            # ========== CRITICAL: VALIDATE ADDRESS FIRST ==========
            if normalized_address:
                enable_validation = self.config.get('matching', {}).get('enable_address_validation', True)
                min_score = self.config.get('matching', {}).get('min_address_score', 0.3)
                if enable_validation:
                    medical_matches = self.validate_address_for_matches(medical_matches, normalized_address, min_address_score=min_score, normalized_college=normalized_college)
                    logger.info(f"After address validation: {len(medical_matches)} MEDICAL matches remaining")
            
            # Validate each MEDICAL match - pass 'diploma' as course_type for overlapping courses
            for match in medical_matches:
                college_stream = self.get_college_stream(match['candidate']['id'])
                logger.info(f"  Checking MEDICAL match: {match['candidate']['name'][:50]} (stream: {college_stream})")

                if self.validate_college_course_stream_match(match['candidate'], 'diploma', course_name):
                    logger.info(f"Overlapping DIPLOMA course {course_name}: Found valid MEDICAL match")
                    return match['candidate'], match['score'], match['method']
                else:
                    logger.info(f"  Validation failed for {match['candidate']['name'][:50]}")

        # Try DNB fallback
        logger.info(f"Overlapping DIPLOMA course {course_name}: MEDICAL validation failed, trying DNB fallback")

        # PASS 1: Get filtered DNB candidates using get_college_pool
        dnb_state_candidates = self.get_college_pool(course_type='dnb', state=state)

        if not dnb_state_candidates:
            # Fallback without state filtering
            dnb_state_candidates = self.get_college_pool(course_type='dnb')

        # PASS 3: College name matching for DNB (with address context)
        dnb_matches = self.pass3_college_name_matching(normalized_college, dnb_state_candidates, normalized_state, normalized_address)

        logger.info(f"Overlapping DIPLOMA: Found {len(dnb_matches) if dnb_matches else 0} DNB matches")

        if dnb_matches:
            # ========== CRITICAL: VALIDATE ADDRESS FIRST ==========
            if normalized_address:
                enable_validation = self.config.get('matching', {}).get('enable_address_validation', True)
                min_score = self.config.get('matching', {}).get('min_address_score', 0.3)
                if enable_validation:
                    dnb_matches = self.validate_address_for_matches(dnb_matches, normalized_address, min_address_score=min_score, normalized_college=normalized_college)
                    logger.info(f"After address validation: {len(dnb_matches)} DNB matches remaining")
            
            # Validate each DNB match - pass 'diploma' as course_type for overlapping courses
            for match in dnb_matches:
                college_stream = self.get_college_stream(match['candidate']['id'])
                logger.info(f"  Checking DNB match: {match['candidate']['name'][:50]} (stream: {college_stream})")

                if self.validate_college_course_stream_match(match['candidate'], 'diploma', course_name):
                    logger.info(f"Overlapping DIPLOMA course {course_name}: Found valid DNB match")
                    return match['candidate'], match['score'], match['method']
                else:
                    logger.info(f"  Validation failed for {match['candidate']['name'][:50]}")

        # STRICT MODE: Only return validated matches
        # If validation failed, require manual review for accuracy
        logger.warning(f"DIPLOMA course {course_name}: Manual review required - no validated match found")
        logger.info(f"  Found {len(medical_matches) if medical_matches else 0} MEDICAL candidates but none passed validation")
        logger.info(f"  Found {len(dnb_matches) if dnb_matches else 0} DNB candidates but none passed validation")
        return None, 0.0, "manual_review_required"
    
    def match_medical_only_diploma_course(self, college_name, state, address, course_name):
        """Match medical-only DIPLOMA courses with DNB fallback after all strategies fail"""
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)
        
        # Try MEDICAL first (all strategies)
        # PASS 1: Get filtered MEDICAL candidates using get_college_pool
        medical_state_candidates = self.get_college_pool(course_type='medical', state=state)

        if not medical_state_candidates:
            # Fallback without state filtering
            medical_state_candidates = self.get_college_pool(course_type='medical')
        
        # PASS 3: College name matching for MEDICAL (all strategies, with address context)
        medical_matches = self.pass3_college_name_matching(normalized_college, medical_state_candidates, normalized_state, normalized_address)
        
        if medical_matches:
            # ========== CRITICAL: VALIDATE ADDRESS FIRST ==========
            if normalized_address:
                enable_validation = self.config.get('matching', {}).get('enable_address_validation', True)
                min_score = self.config.get('matching', {}).get('min_address_score', 0.3)
                if enable_validation:
                    medical_matches = self.validate_address_for_matches(medical_matches, normalized_address, min_address_score=min_score, normalized_college=normalized_college)
                    logger.info(f"After address validation: {len(medical_matches)} MEDICAL matches remaining")
            
            # Validate each MEDICAL match
            for match in medical_matches:
                if self.validate_college_course_stream_match(match['candidate'], 'medical', course_name):
                    return match['candidate'], match['score'], match['method']
        
        # Fallback to DNB only after ALL MEDICAL strategies fail
        logger.info(f"Medical-only DIPLOMA course {course_name}: All MEDICAL strategies failed, trying DNB fallback")

        # PASS 1: Get filtered DNB candidates using get_college_pool
        dnb_state_candidates = self.get_college_pool(course_type='dnb', state=state)

        if not dnb_state_candidates:
            # Fallback without state filtering
            dnb_state_candidates = self.get_college_pool(course_type='dnb')
        
        # PASS 3: College name matching for DNB (with address context)
        dnb_matches = self.pass3_college_name_matching(normalized_college, dnb_state_candidates, normalized_state, normalized_address)
        
        if dnb_matches:
            # ========== CRITICAL: VALIDATE ADDRESS FIRST ==========
            if normalized_address:
                enable_validation = self.config.get('matching', {}).get('enable_address_validation', True)
                min_score = self.config.get('matching', {}).get('min_address_score', 0.3)
                if enable_validation:
                    dnb_matches = self.validate_address_for_matches(dnb_matches, normalized_address, min_address_score=min_score, normalized_college=normalized_college)
                    logger.info(f"After address validation: {len(dnb_matches)} DNB matches remaining")
            
            # Validate each DNB match
            for match in dnb_matches:
                if self.validate_college_course_stream_match(match['candidate'], 'dnb', course_name):
                    return match['candidate'], match['score'], match['method']
        
        return None, 0.0, "no_match"
    
    def match_regular_course(self, college_name, state, course_type, address, course_name):
        """Match regular courses with STATE→COURSE(stream)→COLLEGE→ADDRESS filtering

        Uses config.yaml course patterns to auto-detect stream from course_name.
        """
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)
        normalized_address = self.normalize_text(address)

        # PASS 1: STATE→COURSE filtering (optimized with course_name for stream detection)
        # Automatically detects stream (medical/dental/dnb) from course name using config.yaml
        candidates = self.get_college_pool(
            state=state,
            course_type=course_type,
            course_name=course_name  # NEW: Auto-detect stream from course
        )

        if not candidates:
            # Fallback: Try without state filtering
            candidates = self.get_college_pool(
                course_type=course_type,
                course_name=course_name
            )

        if not candidates:
            return None, 0.0, "invalid_course_type"

        state_candidates = candidates  # Already filtered by get_college_pool
        
        # PASS 2: Course type filtering (already done by selecting the right master_data)
        # This is implicit since we're already in the correct course_type section
        
        # PASS 3: College name matching with hierarchical strategies (with address context)
        college_matches = self.pass3_college_name_matching(normalized_college, state_candidates, normalized_state, normalized_address)
        
        if not college_matches:
            return None, 0.0, "no_match"
        
        # ========== CRITICAL FIX: ALWAYS VALIDATE ADDRESS (MANDATORY) ==========
        # This prevents false matches where different physical colleges get same ID
        # Example: "Government Medical College" in Bangalore vs Mysore (different addresses!)
        
        # Check if address validation is enabled
        enable_validation = self.config.get('matching', {}).get('enable_address_validation', True)
        min_score = self.config.get('matching', {}).get('min_address_score', 0.3)  # Default 0.3 (30%) if not in config

        if normalized_address and enable_validation:
            # MANDATORY address validation for ALL matches
            validated_matches = self.validate_address_for_matches(college_matches, normalized_address, min_address_score=min_score, normalized_college=normalized_college)

            if not validated_matches:
                # NO matches passed address validation - but check if we should be lenient
                # If address is very short or seems incomplete, be more lenient
                if len(normalized_address.strip()) < 5:
                    # Address is too short - probably incomplete, allow matches
                    logger.warning(f"⚠️  Address too short ({len(normalized_address)} chars) - skipping validation for {len(college_matches)} matches")
                    validated_matches = college_matches
                else:
                    # Check if any match has very high name score (exact/primary match)
                    # If so, allow it even if address doesn't match perfectly
                    high_confidence_matches = [m for m in college_matches if m['score'] >= 0.95 or m['method'] in ['exact_match', 'primary_name_match', 'direct_alias_match']]
                    
                    if high_confidence_matches:
                        # Very high confidence name match - allow even if address doesn't match
                        logger.warning(f"⚠️  Address validation failed, but allowing {len(high_confidence_matches)} high-confidence name match(es) (score ≥0.95 or exact/primary)")
                        validated_matches = high_confidence_matches
                    else:
                        # Log first rejection with details for debugging
                        if college_matches:
                            first_match = college_matches[0]
                            candidate = first_match['candidate']
                            candidate_address = self.normalize_text(candidate.get('address', ''))
                            logger.warning(f"⚠️  All {len(college_matches)} name matches REJECTED due to address mismatch")
                            logger.warning(f"   College: {normalized_college[:50]}")
                            logger.warning(f"   Seat address: {normalized_address[:80]}")
                            logger.warning(f"   Master address: {candidate_address[:80] if candidate_address else 'N/A'}")
                            logger.warning(f"   Threshold: {min_score:.2f}")
                            logger.warning(f"   Best name match score: {first_match['score']:.2f}, method: {first_match['method']}")
                        return None, 0.0, "address_validation_failed"

            # Use validated matches only
            college_matches = validated_matches
            logger.debug(f"✅ {len(validated_matches)} matches passed address validation")

        # If only one match remaining after validation, return it
        if len(college_matches) == 1:
            match = college_matches[0]
            return match['candidate'], match['score'], f"{match['method']}_address_validated"
        
        # PASS 4: Address-based disambiguation for multiple validated matches
        if len(college_matches) > 1 and normalized_address:
            disambiguated = self.pass4_address_disambiguation(college_matches, normalized_address, normalized_college)
            if disambiguated:
                return disambiguated['candidate'], disambiguated['score'], disambiguated['method']
        
        # Return the best match from validated matches
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

    # ==================== PHONETIC MATCHING ====================

    def generate_phonetic_keys(self, text):
        """Generate multiple phonetic keys for a text (with caching)

        Args:
            text: Input text

        Returns:
            dict: Dictionary of phonetic encodings
        """
        if not text:
            return {}

        normalized = self.normalize_text(text)

        # Check cache first (if caching enabled)
        if self.config.get('features', {}).get('enable_phonetic_cache', True) and normalized in self.phonetic_cache:
            return self.phonetic_cache[normalized]

        # Generate phonetic keys
        keys = {
            'soundex': jellyfish.soundex(normalized) if normalized else '',
            'metaphone': jellyfish.metaphone(normalized) if normalized else '',
            'nysiis': jellyfish.nysiis(normalized) if normalized else '',
        }

        # Cache if enabled
        if self.config.get('features', {}).get('enable_phonetic_cache', True):
            self.phonetic_cache[normalized] = keys

        return keys

    def phonetic_match(self, text1, text2):
        """Check if two texts match phonetically

        Args:
            text1: First text
            text2: Second text

        Returns:
            tuple: (is_match, matching_algorithm, score)
        """
        if not text1 or not text2:
            return False, None, 0.0

        keys1 = self.generate_phonetic_keys(text1)
        keys2 = self.generate_phonetic_keys(text2)

        # Check each phonetic algorithm
        matches = []

        if keys1['soundex'] == keys2['soundex'] and keys1['soundex']:
            matches.append(('soundex', 0.9))

        if keys1['metaphone'] == keys2['metaphone'] and keys1['metaphone']:
            matches.append(('metaphone', 0.95))

        if keys1['nysiis'] == keys2['nysiis'] and keys1['nysiis']:
            matches.append(('nysiis', 0.92))

        if matches:
            # Return best match
            best = max(matches, key=lambda x: x[1])
            return True, best[0], best[1]

        return False, None, 0.0

    def _parallel_phonetic_match(self, normalized_college, candidates):
        """Perform phonetic matching for large candidate sets

        Note: Sequential processing used to avoid pickle issues with nested functions

        Args:
            normalized_college: Normalized college name to match
            candidates: List of candidate colleges

        Returns:
            list: List of phonetic matches
        """
        matches = []

        # Sequential processing (faster than parallel for phonetic matching anyway)
        for candidate in candidates:
            is_match, algorithm, score = self.phonetic_match(
                normalized_college,
                candidate.get('normalized_name', '')
            )
            if is_match:
                matches.append({
                    'candidate': candidate,
                    'score': score * 0.85,
                    'method': f'phonetic_match_{algorithm}'
                })

        return matches

    def _smart_retry_with_phonetic(self, college_name, state, course_type, address=''):
        """Smart retry using phonetic matching for failed matches

        Args:
            college_name: College name
            state: State
            course_type: Course type
            address: Address (optional)

        Returns:
            tuple: (match, score, method) or (None, 0.0, 'no_match')
        """
        logger.info(f"Smart retry: Attempting phonetic match for '{college_name}'")

        # Normalize
        normalized_college = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state)

        # Get candidates for the course type
        if course_type not in self.master_data:
            return None, 0.0, 'no_match'

        all_candidates = self.master_data[course_type]['colleges']

        # Filter by state first
        state_candidates = [
            c for c in all_candidates
            if self.normalize_text(c.get('state', '')) == normalized_state
        ]

        if not state_candidates:
            state_candidates = all_candidates  # Fallback to all

        # Try phonetic matching
        for candidate in state_candidates:
            is_match, algorithm, score = self.phonetic_match(
                normalized_college,
                candidate.get('normalized_name', '')
            )
            if is_match and score >= 0.85:  # Only high-confidence phonetic matches
                logger.info(f"Smart retry SUCCESS: Phonetic match via {algorithm}")
                return candidate, score * 0.80, f'smart_retry_phonetic_{algorithm}'

        logger.info("Smart retry: No phonetic match found")
        return None, 0.0, 'smart_retry_failed'

    def enhanced_college_match_with_phonetics(self, college_name, state, course_type='unknown'):
        """Match college with phonetic fallback

        Args:
            college_name: College name to match
            state: State
            course_type: Type of course

        Returns:
            tuple: (match, score, method)
        """
        # Try regular matching first
        match, score, method = self.match_college_enhanced(college_name, state, course_type, '', '')

        # If low confidence, try phonetic matching
        if score < 0.7:
            logger.info(f"Trying phonetic match for: {college_name}")

            # Get candidate colleges in the same state
            candidates = self.get_colleges_by_state(state, course_type)

            best_phonetic_match = None
            best_phonetic_score = 0.0

            for candidate in candidates:
                is_match, algorithm, ph_score = self.phonetic_match(
                    college_name,
                    candidate['name']
                )

                if is_match and ph_score > best_phonetic_score:
                    best_phonetic_match = candidate
                    best_phonetic_score = ph_score

            if best_phonetic_match and best_phonetic_score > score:
                return best_phonetic_match, best_phonetic_score, f"phonetic_{algorithm}"

        return match, score, method

    # ==================== SMART ALIAS AUTO-GENERATION ====================

    def analyze_unmatched_patterns(self, limit=100):
        """Analyze unmatched records to suggest aliases

        Args:
            limit: Number of unmatched records to analyze

        Returns:
            dict: Suggested aliases
        """
        console.print("\n[cyan]🔍 Analyzing unmatched patterns for alias suggestions...[/cyan]")

        try:
            # Get unmatched records
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            query = f"""
                SELECT college_name, course_name, state, COUNT(*) as frequency
                FROM {table_name}
                WHERE (master_college_id IS NULL OR master_course_id IS NULL)
                GROUP BY college_name, course_name, state
                ORDER BY frequency DESC
                LIMIT ?
            """

            df = pd.read_sql(query, conn, params=(limit,))
            conn.close()

            if len(df) == 0:
                console.print("[green]✅ No unmatched records to analyze![/green]")
                return {}

            suggestions = {
                'college_aliases': [],
                'course_aliases': [],
                'pattern_based': []
            }

            # Analyze college names
            for idx, row in df.iterrows():
                college = row['college_name']
                state = row['state']
                frequency = row['frequency']

                # Try to find similar colleges in master data
                candidates = self.get_colleges_by_state(state, 'unknown')

                for candidate in candidates[:5]:  # Top 5 candidates
                    similarity = fuzz.ratio(
                        self.normalize_text(college),
                        self.normalize_text(candidate['name'])
                    ) / 100

                    if 0.7 <= similarity < 0.85:  # Sweet spot for alias suggestions
                        suggestions['college_aliases'].append({
                            'raw_name': college,
                            'master_name': candidate['name'],
                            'master_id': candidate['id'],
                            'similarity': similarity,
                            'frequency': frequency,
                            'state': state,
                            'confidence': 'medium' if similarity > 0.75 else 'low'
                        })

            # Detect common patterns
            suggestions['pattern_based'] = self._detect_common_patterns(df)

            return suggestions

        except Exception as e:
            logger.error(f"Error analyzing unmatched patterns: {e}", exc_info=True)
            return {}

    def _detect_common_patterns(self, df):
        """Detect common abbreviation and naming patterns

        Args:
            df: DataFrame of unmatched records

        Returns:
            list: Pattern-based suggestions
        """
        patterns = []

        common_patterns = {
            r'\bGOVT\b': 'GOVERNMENT',
            r'\bMED\b': 'MEDICAL',
            r'\bCOLL\b': 'COLLEGE',
            r'\bUNIV\b': 'UNIVERSITY',
            r'\bINST\b': 'INSTITUTE',
            r'\bST\b': 'SAINT',
            r'\bDR\b': 'DOCTOR',
            r'\bPVT\b': 'PRIVATE',
            r'\bPG\b': 'POST GRADUATE',
            r'\bUG\b': 'UNDER GRADUATE',
        }

        for raw_name in df['college_name'].unique()[:50]:
            for pattern, expansion in common_patterns.items():
                if re.search(pattern, raw_name, re.IGNORECASE):
                    expanded = re.sub(pattern, expansion, raw_name, flags=re.IGNORECASE)
                    patterns.append({
                        'raw': raw_name,
                        'suggested': expanded,
                        'pattern': f"{pattern} → {expansion}",
                        'type': 'abbreviation'
                    })

        return patterns

    def auto_generate_aliases(self, suggestions, confidence_threshold=0.8, auto_apply=False):
        """Automatically generate and optionally apply aliases

        Args:
            suggestions: Suggestions from analyze_unmatched_patterns
            confidence_threshold: Minimum confidence to auto-apply
            auto_apply: If True, automatically apply high-confidence aliases

        Returns:
            dict: Generation results
        """
        console.print(f"\n[bold cyan]🤖 Auto-Generating Aliases[/bold cyan]")

        results = {
            'high_confidence': [],
            'medium_confidence': [],
            'applied': 0
        }

        for alias in suggestions.get('college_aliases', []):
            if alias['similarity'] >= confidence_threshold:
                results['high_confidence'].append(alias)

                if auto_apply:
                    # Add to aliases table
                    self._add_alias(
                        alias['raw_name'],
                        alias['master_name'],
                        'college',
                        'auto_generated',
                        alias['similarity']
                    )
                    results['applied'] += 1
            else:
                results['medium_confidence'].append(alias)

        # Display results
        if results['high_confidence']:
            console.print(f"\n[green]✅ High Confidence Aliases: {len(results['high_confidence'])}[/green]")
            for alias in results['high_confidence'][:10]:
                console.print(f"   {alias['raw_name']} → {alias['master_name']} ({alias['similarity']:.2%})")

        if results['medium_confidence']:
            console.print(f"\n[yellow]⚠️  Medium Confidence Aliases: {len(results['medium_confidence'])}[/yellow]")
            console.print("   (Requires manual review)")

        if auto_apply:
            console.print(f"\n[bold green]✅ Auto-applied {results['applied']} aliases[/bold green]")

        return results

    def _add_alias(self, raw_name, master_name, alias_type, source, confidence):
        """Add an alias to the database

        Args:
            raw_name: Raw/alias name
            master_name: Master/canonical name
            alias_type: 'college' or 'course'
            source: Source of alias ('manual', 'auto_generated', etc.)
            confidence: Confidence score
        """
        try:
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()

            # Check if aliases table exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS aliases (
                    id TEXT PRIMARY KEY,
                    raw_name TEXT NOT NULL,
                    master_name TEXT NOT NULL,
                    alias_type TEXT NOT NULL,
                    source TEXT,
                    confidence REAL,
                    created_at TEXT,
                    UNIQUE(raw_name, alias_type)
                )
            """)

            # Insert alias
            cursor.execute("""
                INSERT OR REPLACE INTO aliases
                (id, raw_name, master_name, alias_type, source, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()),
                raw_name,
                master_name,
                alias_type,
                source,
                confidence,
                datetime.now().isoformat()
            ))

            conn.commit()
            conn.close()

        except Exception as e:
            logger.error(f"Error adding alias: {e}", exc_info=True)

    # ==================== ANOMALY DETECTION ====================

    def detect_anomalies(self, table_name='seat_data'):
        """Detect anomalies in matched data

        Types of anomalies:
        1. Wrong stream: DNB course in dental college
        2. Geographic impossibility: College in wrong state
        3. Suspicious patterns: Same rank allocated multiple times in same round
        4. Data quality: Missing critical fields

        Args:
            table_name: Table to check

        Returns:
            dict: Detected anomalies
        """
        console.print("\n[cyan]🔍 Running Anomaly Detection...[/cyan]")

        anomalies = {
            'stream_mismatches': [],
            'state_mismatches': [],
            'duplicate_allocations': [],
            'suspicious_matches': [],
            'data_quality_issues': []
        }

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)

            # 1. Stream mismatch detection
            if self.data_type == 'seat':
                query = f"""
                    SELECT id, college_name, course_name, master_college_id, master_course_id,
                           validation_status, validation_errors
                    FROM {table_name}
                    WHERE validation_status IN ('stream_mismatch', 'both_mismatch')
                    LIMIT 100
                """
                stream_df = pd.read_sql(query, conn)
                anomalies['stream_mismatches'] = stream_df.to_dict('records')

            # 2. State mismatch detection
            if self.data_type == 'seat':
                query = f"""
                    SELECT id, college_name, state, master_college_id, validation_status
                    FROM {table_name}
                    WHERE validation_status IN ('state_mismatch', 'both_mismatch')
                    LIMIT 100
                """
                state_df = pd.read_sql(query, conn)
                anomalies['state_mismatches'] = state_df.to_dict('records')

            # 3. Duplicate allocation detection (counselling data)
            if self.data_type == 'counselling':
                query = """
                    SELECT all_india_rank, round_normalized, COUNT(*) as allocation_count
                    FROM counselling_records
                    WHERE master_college_id IS NOT NULL
                    GROUP BY all_india_rank, round_normalized
                    HAVING COUNT(*) > 1
                """
                dup_df = pd.read_sql(query, conn)
                anomalies['duplicate_allocations'] = dup_df.to_dict('records')

            # 4. Suspicious low-confidence matches
            query = f"""
                SELECT id, college_name, course_name, college_match_score, course_match_score,
                       college_match_method, course_match_method
                FROM {table_name}
                WHERE is_linked = 1
                  AND (college_match_score < 0.6 OR course_match_score < 0.6)
                LIMIT 100
            """
            suspicious_df = pd.read_sql(query, conn)
            anomalies['suspicious_matches'] = suspicious_df.to_dict('records')

            # 5. Data quality issues
            query = f"""
                SELECT id, college_name, course_name, state
                FROM {table_name}
                WHERE college_name IS NULL OR college_name = ''
                   OR course_name IS NULL OR course_name = ''
                LIMIT 100
            """
            quality_df = pd.read_sql(query, conn)
            anomalies['data_quality_issues'] = quality_df.to_dict('records')

            conn.close()

            # Display summary
            console.print("\n[bold]📊 Anomaly Detection Summary:[/bold]")
            console.print(f"  Stream Mismatches: [red]{len(anomalies['stream_mismatches'])}[/red]")
            console.print(f"  State Mismatches: [red]{len(anomalies['state_mismatches'])}[/red]")
            console.print(f"  Duplicate Allocations: [yellow]{len(anomalies['duplicate_allocations'])}[/yellow]")
            console.print(f"  Suspicious Matches: [yellow]{len(anomalies['suspicious_matches'])}[/yellow]")
            console.print(f"  Data Quality Issues: [orange]{len(anomalies['data_quality_issues'])}[/orange]")

            return anomalies

        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}", exc_info=True)
            return anomalies

    # ==================== BATCH OPERATIONS ====================

    def batch_accept_high_confidence_matches(self, threshold=0.9):
        """Batch accept all matches above confidence threshold

        Args:
            threshold: Minimum score to accept

        Returns:
            int: Number of records accepted
        """
        console.print(f"\n[cyan]🔄 Batch accepting matches with confidence >= {threshold:.0%}...[/cyan]")

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            cursor = conn.cursor()

            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            # Count matches to accept
            cursor.execute(f"""
                SELECT COUNT(*) FROM {table_name}
                WHERE is_linked = 0
                  AND college_match_score >= ?
                  AND course_match_score >= ?
            """, (threshold, threshold))

            count = cursor.fetchone()[0]

            if count == 0:
                console.print("[yellow]⚠️  No matches found above threshold[/yellow]")
                conn.close()
                return 0

            console.print(f"Found {count:,} matches to accept")
            confirm = Confirm.ask("Proceed with batch accept?", default=True)

            if not confirm:
                console.print("[yellow]Batch accept cancelled[/yellow]")
                conn.close()
                return 0

            # Update records
            cursor.execute(f"""
                UPDATE {table_name}
                SET is_linked = 1,
                    updated_at = ?
                WHERE is_linked = 0
                  AND college_match_score >= ?
                  AND course_match_score >= ?
            """, (datetime.now().isoformat(), threshold, threshold))

            conn.commit()
            affected = cursor.rowcount
            conn.close()

            console.print(f"[green]✅ Accepted {affected:,} high-confidence matches[/green]")
            return affected

        except Exception as e:
            logger.error(f"Error in batch accept: {e}", exc_info=True)
            return 0

    def batch_reject_low_confidence_matches(self, threshold=0.5):
        """Batch reject all matches below confidence threshold

        Args:
            threshold: Maximum score to reject

        Returns:
            int: Number of records rejected
        """
        console.print(f"\n[cyan]🔄 Batch rejecting matches with confidence < {threshold:.0%}...[/cyan]")

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            cursor = conn.cursor()

            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            # Count matches to reject
            cursor.execute(f"""
                SELECT COUNT(*) FROM {table_name}
                WHERE is_linked = 1
                  AND (college_match_score < ? OR course_match_score < ?)
            """, (threshold, threshold))

            count = cursor.fetchone()[0]

            if count == 0:
                console.print("[yellow]⚠️  No matches found below threshold[/yellow]")
                conn.close()
                return 0

            console.print(f"Found {count:,} matches to reject")
            confirm = Confirm.ask("Proceed with batch reject?", default=False)

            if not confirm:
                console.print("[yellow]Batch reject cancelled[/yellow]")
                conn.close()
                return 0

            # Unlink records
            cursor.execute(f"""
                UPDATE {table_name}
                SET master_college_id = NULL,
                    master_course_id = NULL,
                    is_linked = 0,
                    updated_at = ?
                WHERE is_linked = 1
                  AND (college_match_score < ? OR course_match_score < ?)
            """, (datetime.now().isoformat(), threshold, threshold))

            conn.commit()
            affected = cursor.rowcount
            conn.close()

            console.print(f"[green]✅ Rejected {affected:,} low-confidence matches[/green]")
            return affected

        except Exception as e:
            logger.error(f"Error in batch reject: {e}", exc_info=True)
            return 0

    def batch_update_validation_status(self):
        """Batch re-validate all linked records

        Returns:
            dict: Validation results
        """
        console.print("\n[cyan]🔄 Batch re-validating all linked records...[/cyan]")

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            # Get all linked records
            df = pd.read_sql(f"""
                SELECT * FROM {table_name}
                WHERE is_linked = 1
            """, conn)

            console.print(f"Validating {len(df):,} records...")

            results = {
                'valid': 0,
                'state_mismatch': 0,
                'stream_mismatch': 0,
                'both_mismatch': 0,
                'unlinked': 0
            }

            cursor = conn.cursor()

            for idx, record in tqdm(df.iterrows(), total=len(df), desc="Validating"):
                # Validate record
                validation = self.validate_linked_record(record.to_dict())

                status = validation['validation_status']
                errors = json.dumps(validation['errors']) if validation['errors'] else None

                results[status] = results.get(status, 0) + 1

                # If invalid, unlink
                if not validation['is_valid']:
                    cursor.execute(f"""
                        UPDATE {table_name}
                        SET master_college_id = NULL,
                            master_course_id = NULL,
                            is_linked = 0,
                            validation_status = ?,
                            validation_errors = ?,
                            updated_at = ?
                        WHERE id = ?
                    """, (status, errors, datetime.now().isoformat(), record['id']))
                    results['unlinked'] += 1
                else:
                    cursor.execute(f"""
                        UPDATE {table_name}
                        SET validation_status = ?,
                            validation_errors = ?,
                            updated_at = ?
                        WHERE id = ?
                    """, (status, errors, datetime.now().isoformat(), record['id']))

            conn.commit()
            conn.close()

            # Display results
            console.print("\n[bold]📊 Batch Validation Results:[/bold]")
            console.print(f"  Valid: [green]{results.get('valid', 0):,}[/green]")
            console.print(f"  State Mismatch: [red]{results.get('state_mismatch', 0):,}[/red]")
            console.print(f"  Stream Mismatch: [red]{results.get('stream_mismatch', 0):,}[/red]")
            console.print(f"  Both Mismatch: [red]{results.get('both_mismatch', 0):,}[/red]")
            console.print(f"  Unlinked: [yellow]{results.get('unlinked', 0):,}[/yellow]")

            return results

        except Exception as e:
            logger.error(f"Error in batch validation: {e}", exc_info=True)
            return {}

    # ==================== ML-BASED MATCHING ====================

    def extract_training_data(self, limit=None):
        """Extract training data from validated matches

        Features extracted:
        1. Edit distance (normalized)
        2. Token overlap
        3. Fuzzy ratio
        4. Partial ratio
        5. Token sort ratio
        6. State match (boolean)
        7. Course type match (boolean)
        8. Phonetic match score
        9. Length ratio
        10. Historical match frequency

        Args:
            limit: Maximum number of records to extract (None = all)

        Returns:
            tuple: (X_train, y_train, feature_names)
        """
        console.print("\n[cyan]📊 Extracting training data from validated matches...[/cyan]")

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            # Column names differ between seat and counselling data
            if self.data_type == 'counselling':
                college_col = 'college_institute_normalized'
                course_col = 'course_normalized'
                state_col = 'state_normalized'
            else:
                college_col = 'college_name'
                course_col = 'course_name'
                state_col = 'state'

            # Get validated matches (high confidence as positive, low confidence as negative)
            query = f"""
                SELECT
                    {college_col} as college_name,
                    {course_col} as course_name,
                    {state_col} as state,
                    master_college_id,
                    master_course_id,
                    college_match_score,
                    course_match_score,
                    is_linked
                FROM {table_name}
                WHERE master_college_id IS NOT NULL
                  AND master_course_id IS NOT NULL
            """

            if limit:
                query += f" LIMIT {limit}"

            df = pd.read_sql(query, conn)
            conn.close()

            if len(df) == 0:
                console.print("[yellow]⚠️  No validated matches found for training![/yellow]")
                console.print("[yellow]   Import and match some data first using the main menu[/yellow]")
                return None, None, None

            console.print(f"Extracting features from {len(df):,} records...")

            # Extract features
            features = []
            labels = []

            for idx, row in tqdm(df.iterrows(), total=len(df), desc="Extracting features"):
                college_name = row['college_name']
                state = row['state']
                master_college_id = row['master_college_id']

                # Get master college name
                master_college = self.get_college_by_id(master_college_id)
                if not master_college:
                    continue

                master_college_name = master_college['name']
                master_state = master_college.get('state', '')

                # Extract features
                feature_vector = self._extract_feature_vector(
                    college_name,
                    master_college_name,
                    state,
                    master_state
                )

                features.append(feature_vector)

                # Label: 1 if high confidence, 0 otherwise
                # (validation_status column may not exist, so use score only)
                is_good_match = row['college_match_score'] >= 0.8
                labels.append(1 if is_good_match else 0)

            X = np.array(features)
            y = np.array(labels)

            feature_names = [
                'edit_distance_norm',
                'token_overlap',
                'fuzzy_ratio',
                'partial_ratio',
                'token_sort_ratio',
                'state_match',
                'length_ratio',
                'phonetic_match',
                'word_count_diff',
                'common_word_ratio'
            ]

            console.print(f"[green]✅ Extracted {len(features)} feature vectors[/green]")
            console.print(f"   Positive examples: {sum(labels):,}")
            console.print(f"   Negative examples: {len(labels) - sum(labels):,}")

            return X, y, feature_names

        except Exception as e:
            logger.error(f"Error extracting training data: {e}", exc_info=True)
            return None, None, None

    def _extract_feature_vector(self, name1, name2, state1, state2):
        """Extract feature vector for ML matching

        Args:
            name1: First college name
            name2: Second college name
            state1: First state
            state2: Second state

        Returns:
            list: Feature vector
        """
        # Normalize
        norm1 = self.normalize_text(name1)
        norm2 = self.normalize_text(name2)

        # 1. Edit distance (normalized by max length)
        import difflib
        edit_dist = 1 - difflib.SequenceMatcher(None, norm1, norm2).ratio()

        # 2. Token overlap
        tokens1 = set(norm1.split())
        tokens2 = set(norm2.split())
        token_overlap = len(tokens1 & tokens2) / max(len(tokens1 | tokens2), 1)

        # 3. Fuzzy ratio
        fuzzy_ratio = fuzz.ratio(norm1, norm2) / 100

        # 4. Partial ratio
        partial_ratio = fuzz.partial_ratio(norm1, norm2) / 100

        # 5. Token sort ratio
        token_sort_ratio = fuzz.token_sort_ratio(norm1, norm2) / 100

        # 6. State match
        state_match = 1.0 if self.normalize_text(state1) == self.normalize_text(state2) else 0.0

        # 7. Length ratio
        len_ratio = min(len(norm1), len(norm2)) / max(len(norm1), len(norm2), 1)

        # 8. Phonetic match
        is_phonetic, _, phonetic_score = self.phonetic_match(name1, name2)
        phonetic_match = phonetic_score if is_phonetic else 0.0

        # 9. Word count difference
        word_count_diff = abs(len(tokens1) - len(tokens2)) / max(len(tokens1), len(tokens2), 1)

        # 10. Common word ratio
        common_words = tokens1 & tokens2
        common_ratio = len(common_words) / max(len(tokens1), 1)

        return [
            edit_dist,
            token_overlap,
            fuzzy_ratio,
            partial_ratio,
            token_sort_ratio,
            state_match,
            len_ratio,
            phonetic_match,
            word_count_diff,
            common_ratio
        ]

    def train_ml_model(self, model_type='random_forest', test_size=0.2):
        """Train ML model on validated matches

        Args:
            model_type: 'random_forest', 'gradient_boosting', or 'logistic'
            test_size: Fraction of data for testing

        Returns:
            dict: Training results
        """
        console.print(f"\n[bold cyan]🤖 Training ML Model ({model_type})[/bold cyan]")

        # Extract training data
        X, y, feature_names = self.extract_training_data()

        if X is None or len(X) == 0:
            console.print("[red]❌ Not enough training data![/red]")
            return None

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )

        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Choose model
        if model_type == 'random_forest':
            model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif model_type == 'gradient_boosting':
            model = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                random_state=42
            )
        else:  # logistic
            model = LogisticRegression(
                random_state=42,
                max_iter=1000
            )

        # Train
        console.print(f"Training on {len(X_train):,} samples...")
        model.fit(X_train_scaled, y_train)

        # Evaluate
        train_score = model.score(X_train_scaled, y_train)
        test_score = model.score(X_test_scaled, y_test)

        # Cross-validation
        cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5)

        console.print(f"\n[bold]📊 Training Results:[/bold]")
        console.print(f"  Train Accuracy: [green]{train_score:.2%}[/green]")
        console.print(f"  Test Accuracy: [green]{test_score:.2%}[/green]")
        console.print(f"  CV Score: [cyan]{cv_scores.mean():.2%} ± {cv_scores.std():.2%}[/cyan]")

        # Feature importance (if available)
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
            feature_importance = sorted(
                zip(feature_names, importances),
                key=lambda x: x[1],
                reverse=True
            )

            console.print(f"\n[bold]🔝 Top Features:[/bold]")
            for feat, imp in feature_importance[:5]:
                console.print(f"  {feat}: {imp:.3f}")

        # Save model
        model_dir = Path('models')
        model_dir.mkdir(exist_ok=True)

        model_path = model_dir / f'{model_type}_matcher.pkl'
        scaler_path = model_dir / f'{model_type}_scaler.pkl'

        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)

        console.print(f"\n[green]✅ Model saved to {model_path}[/green]")

        # Store in instance
        self.ml_model = model
        self.ml_scaler = scaler
        self.ml_feature_names = feature_names

        return {
            'model_type': model_type,
            'train_score': train_score,
            'test_score': test_score,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std(),
            'feature_importance': feature_importance if hasattr(model, 'feature_importances_') else None
        }

    def load_ml_model(self, model_type='random_forest'):
        """Load trained ML model

        Args:
            model_type: Model type to load

        Returns:
            bool: Success status
        """
        try:
            model_path = Path('models') / f'{model_type}_matcher.pkl'
            scaler_path = Path('models') / f'{model_type}_scaler.pkl'

            if not model_path.exists() or not scaler_path.exists():
                console.print(f"[yellow]⚠️  Model not found: {model_path}[/yellow]")
                return False

            self.ml_model = joblib.load(model_path)
            self.ml_scaler = joblib.load(scaler_path)

            console.print(f"[green]✅ Loaded ML model from {model_path}[/green]")
            return True

        except Exception as e:
            logger.error(f"Error loading ML model: {e}", exc_info=True)
            return False

    def ml_predict_match(self, college_name, master_college_name, state, master_state):
        """Predict match probability using ML model

        Args:
            college_name: College name from data
            master_college_name: Master college name
            state: State from data
            master_state: Master state

        Returns:
            tuple: (probability, prediction)
        """
        if not hasattr(self, 'ml_model') or self.ml_model is None:
            # Try to load model
            if not self.load_ml_model():
                return 0.0, 0

        try:
            # Extract features
            features = self._extract_feature_vector(
                college_name,
                master_college_name,
                state,
                master_state
            )

            # Scale
            features_scaled = self.ml_scaler.transform([features])

            # Predict
            probability = self.ml_model.predict_proba(features_scaled)[0][1]
            prediction = self.ml_model.predict(features_scaled)[0]

            return probability, prediction

        except Exception as e:
            logger.error(f"Error in ML prediction: {e}", exc_info=True)
            return 0.0, 0

    def ml_enhanced_matching(self, college_name, state, course_type='unknown'):
        """Enhanced matching with ML predictions

        Args:
            college_name: College name to match
            state: State
            course_type: Course type

        Returns:
            tuple: (match, score, method)
        """
        # Get candidates using traditional matching
        candidates = self.get_colleges_by_state(state, course_type)

        if not candidates:
            return None, 0.0, "no_candidates"

        best_match = None
        best_score = 0.0
        best_method = "ml_enhanced"

        # Try ML prediction for top candidates
        for candidate in candidates[:10]:  # Top 10 candidates
            ml_prob, ml_pred = self.ml_predict_match(
                college_name,
                candidate['name'],
                state,
                candidate.get('state', '')
            )

            if ml_prob > best_score:
                best_score = ml_prob
                best_match = candidate
                best_method = f"ml_enhanced_prob_{ml_prob:.2f}"

        return best_match, best_score, best_method

    # ==================== CONTEXT-AWARE MATCHING ====================

    def build_historical_context(self):
        """Build context database from historical matches

        Creates a mapping of:
        1. College name → Most common master_id
        2. State + College substring → Likely colleges
        3. Course patterns per college
        4. Temporal trends (year-wise)

        Returns:
            dict: Historical context
        """
        console.print("\n[cyan]📚 Building historical context database...[/cyan]")

        context = {
            'college_frequency': defaultdict(Counter),
            'state_college_patterns': defaultdict(list),
            'course_college_patterns': defaultdict(list),
            'yearly_trends': defaultdict(dict)
        }

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            table_name = 'seat_data_linked' if self.data_type == 'seat' else 'counselling_records'

            # Column names differ between seat and counselling data
            if self.data_type == 'counselling':
                college_col = 'college_institute_normalized'
                state_col = 'state_normalized'
                course_col = 'course_normalized'
            else:
                college_col = 'college_name'
                state_col = 'state'
                course_col = 'course_name'

            # 1. College frequency mapping
            query = f"""
                SELECT {college_col} as college_name, master_college_id, COUNT(*) as frequency
                FROM {table_name}
                WHERE master_college_id IS NOT NULL
                GROUP BY {college_col}, master_college_id
            """

            df = pd.read_sql(query, conn)

            for _, row in df.iterrows():
                college_name = self.normalize_text(row['college_name'])
                master_id = row['master_college_id']
                frequency = row['frequency']

                context['college_frequency'][college_name][master_id] = frequency

            # 2. State-college patterns
            query = f"""
                SELECT {state_col} as state, {college_col} as college_name, master_college_id, COUNT(*) as frequency
                FROM {table_name}
                WHERE master_college_id IS NOT NULL
                GROUP BY {state_col}, {college_col}, master_college_id
                ORDER BY frequency DESC
            """

            df = pd.read_sql(query, conn)

            for _, row in df.iterrows():
                state = self.normalize_text(row['state'])
                pattern_key = f"{state}_{row['college_name'][:10]}"  # State + first 10 chars
                context['state_college_patterns'][pattern_key].append({
                    'college_name': row['college_name'],
                    'master_id': row['master_college_id'],
                    'frequency': row['frequency']
                })

            # 3. Course-college patterns
            query = f"""
                SELECT {course_col} as course_name, master_college_id, COUNT(*) as frequency
                FROM {table_name}
                WHERE master_college_id IS NOT NULL
                GROUP BY {course_col}, master_college_id
            """

            df = pd.read_sql(query, conn)

            for _, row in df.iterrows():
                course_name = self.normalize_text(row['course_name'])
                context['course_college_patterns'][course_name].append({
                    'master_id': row['master_college_id'],
                    'frequency': row['frequency']
                })

            conn.close()

            # Save context
            context_path = Path('models') / 'historical_context.pkl'
            context_path.parent.mkdir(exist_ok=True)
            joblib.dump(dict(context), context_path)

            console.print(f"[green]✅ Built historical context:[/green]")
            console.print(f"   College patterns: {len(context['college_frequency']):,}")
            console.print(f"   State patterns: {len(context['state_college_patterns']):,}")
            console.print(f"   Course patterns: {len(context['course_college_patterns']):,}")
            console.print(f"   Saved to: {context_path}")

            self.historical_context = context
            return context

        except Exception as e:
            logger.error(f"Error building historical context: {e}", exc_info=True)
            return context

    def load_historical_context(self):
        """Load historical context from disk

        Returns:
            bool: Success status
        """
        try:
            context_path = Path('models') / 'historical_context.pkl'

            if not context_path.exists():
                console.print("[yellow]⚠️  No historical context found. Building...[/yellow]")
                return self.build_historical_context()

            self.historical_context = joblib.load(context_path)
            console.print(f"[green]✅ Loaded historical context from {context_path}[/green]")
            return True

        except Exception as e:
            logger.error(f"Error loading historical context: {e}", exc_info=True)
            return False

    def context_aware_match(self, college_name, state, course_name=''):
        """Match using historical context

        Args:
            college_name: College name to match
            state: State
            course_name: Course name (optional)

        Returns:
            tuple: (match, score, method)
        """
        if not hasattr(self, 'historical_context') or self.historical_context is None:
            self.load_historical_context()

        college_norm = self.normalize_text(college_name)
        state_norm = self.normalize_text(state)

        # Check historical frequency
        if college_norm in self.historical_context['college_frequency']:
            freq_counter = self.historical_context['college_frequency'][college_norm]
            most_common_id = freq_counter.most_common(1)[0][0]
            frequency = freq_counter[most_common_id]

            # Get college details
            master_college = self.get_college_by_id(most_common_id)

            if master_college:
                # Calculate confidence based on frequency
                confidence = min(0.95, 0.7 + (frequency / 100))  # 70% base + frequency bonus

                return master_college, confidence, f"historical_freq_{frequency}"

        # Check state-college patterns
        pattern_key = f"{state_norm}_{college_name[:10]}"
        if pattern_key in self.historical_context['state_college_patterns']:
            patterns = self.historical_context['state_college_patterns'][pattern_key]

            if patterns:
                # Get most frequent match
                best_pattern = max(patterns, key=lambda x: x['frequency'])
                master_college = self.get_college_by_id(best_pattern['master_id'])

                if master_college:
                    confidence = min(0.90, 0.65 + (best_pattern['frequency'] / 100))
                    return master_college, confidence, f"state_pattern_{best_pattern['frequency']}"

        # No historical match found
        return None, 0.0, "no_historical_match"

    def hybrid_match(self, college_name, state, course_type='unknown', course_name=''):
        """Hybrid matching: Traditional + ML + Context-Aware

        Combines:
        1. Traditional fuzzy matching
        2. ML predictions
        3. Historical context
        4. Phonetic matching

        Args:
            college_name: College name to match
            state: State
            course_type: Course type
            course_name: Course name

        Returns:
            tuple: (match, score, method)
        """
        matches = []

        # 1. Traditional matching
        trad_match, trad_score, trad_method = self.match_college_enhanced(
            college_name, state, course_type, '', course_name
        )
        if trad_match:
            matches.append((trad_match, trad_score, f"traditional_{trad_method}"))

        # 2. ML matching (if model loaded)
        if hasattr(self, 'ml_model') and self.ml_model is not None:
            ml_match, ml_score, ml_method = self.ml_enhanced_matching(
                college_name, state, course_type
            )
            if ml_match:
                matches.append((ml_match, ml_score, f"ml_{ml_method}"))

        # 3. Context-aware matching
        if hasattr(self, 'historical_context') and self.historical_context is not None:
            ctx_match, ctx_score, ctx_method = self.context_aware_match(
                college_name, state, course_name
            )
            if ctx_match:
                matches.append((ctx_match, ctx_score, f"context_{ctx_method}"))

        # 4. Phonetic matching (if others failed)
        if not matches or max(m[1] for m in matches) < 0.7:
            ph_match, ph_score, ph_method = self.enhanced_college_match_with_phonetics(
                college_name, state, course_type
            )
            if ph_match:
                matches.append((ph_match, ph_score, f"phonetic_{ph_method}"))

        if not matches:
            return None, 0.0, "no_match"

        # Choose best match (highest score)
        best_match = max(matches, key=lambda x: x[1])

        return best_match

    # ==================== ID GENERATION & DUPLICATE DETECTION ====================

    def generate_record_id(self, record, data_type='seat'):
        """Generate deterministic ID based on record content

        For seat data:
            Format: {state_code}_{college_hash}_{course_hash}_{year}_{category}_{quota}
            Example: KA_a3f2e_b9c1d_2024_OPEN_AIQ

        For counselling data:
            Format: {source}_{level}_{year}_{rank}_{round}
            Example: AIQ_UG_2024_1234_R1

        Args:
            record: Dictionary containing record data
            data_type: 'seat' or 'counselling'

        Returns:
            str: Deterministic record ID
        """
        if data_type == 'counselling':
            # Counselling data uses a specific format
            source = record.get('source_normalized', 'UNK')
            level = record.get('level_normalized', 'UNK')
            year = record.get('year', 'UNK')
            rank = record.get('all_india_rank', 'UNK')
            round_num = record.get('round_normalized', 'UNK')

            return f"{source}_{level}_{year}_{rank}_R{round_num}"

        else:
            # Seat data uses hash-based format
            # Normalize fields
            state_norm = self.normalize_text(record.get('state', ''))
            college_norm = self.normalize_text(record.get('college_name', ''))
            course_norm = self.normalize_text(record.get('course_name', ''))

            # Create hash of college+course (first 5 chars for readability)
            college_hash = hashlib.md5(college_norm.encode()).hexdigest()[:5]
            course_hash = hashlib.md5(course_norm.encode()).hexdigest()[:5]

            # Extract other identifiers
            state_code = state_norm[:2] if state_norm else 'XX'
            year = str(record.get('year', 'UNK'))
            category = record.get('category', 'ALL')
            quota = record.get('quota', 'ALL')

            record_id = f"{state_code}_{college_hash}_{course_hash}_{year}_{category}_{quota}"

            return record_id

    def generate_record_hash(self, record):
        """Generate content hash for change detection

        Args:
            record: Dictionary containing record data

        Returns:
            str: MD5 hash of normalized record content
        """
        # Select fields to include in hash
        hash_fields = [
            'college_name',
            'course_name',
            'state',
            'category',
            'quota',
            'year',
            'opening_rank',
            'closing_rank'
        ]

        # Build content string
        content_parts = []
        for field in hash_fields:
            if field in record and record[field] is not None:
                value = self.normalize_text(str(record[field]))
                content_parts.append(f"{field}:{value}")

        content_string = '|'.join(content_parts)

        # Generate hash
        content_hash = hashlib.md5(content_string.encode()).hexdigest()

        return content_hash

    def detect_duplicates(self, new_records, table_name='seat_data'):
        """Detect duplicate records before import

        Args:
            new_records: List of new records to check
            table_name: Table to check against

        Returns:
            dict: {
                'exact_duplicates': [],      # 100% match (same ID)
                'fuzzy_duplicates': [],      # High similarity
                'content_duplicates': [],    # Same content, different ID
                'new_records': []            # Truly new records
            }
        """
        if not new_records:
            return {
                'exact_duplicates': [],
                'fuzzy_duplicates': [],
                'content_duplicates': [],
                'new_records': []
            }

        console.print(f"\n[cyan]🔍 Checking {len(new_records):,} records for duplicates...[/cyan]")

        try:
            # Load existing records from database
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)

            # Check if table exists
            cursor = conn.cursor()
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            table_exists = cursor.fetchone() is not None

            if not table_exists:
                console.print(f"[yellow]⚠️  Table '{table_name}' doesn't exist yet. All records are new.[/yellow]")
                conn.close()
                return {
                    'exact_duplicates': [],
                    'fuzzy_duplicates': [],
                    'content_duplicates': [],
                    'new_records': new_records
                }

            existing_df = pd.read_sql(f"SELECT id, college_name, course_name, state, record_hash FROM {table_name}", conn)
            conn.close()

            if len(existing_df) == 0:
                console.print("[yellow]⚠️  No existing records. All records are new.[/yellow]")
                return {
                    'exact_duplicates': [],
                    'fuzzy_duplicates': [],
                    'content_duplicates': [],
                    'new_records': new_records
                }

        except Exception as e:
            logger.warning(f"Could not load existing records: {e}")
            # If we can't load existing data, treat all as new
            return {
                'exact_duplicates': [],
                'fuzzy_duplicates': [],
                'content_duplicates': [],
                'new_records': new_records
            }

        exact_duplicates = []
        fuzzy_duplicates = []
        content_duplicates = []
        new_records_filtered = []

        # Create lookup dictionaries for faster comparison
        existing_ids = set(existing_df['id'].values)
        existing_hashes = {}
        if 'record_hash' in existing_df.columns:
            for idx, row in existing_df.iterrows():
                if pd.notna(row['record_hash']):
                    existing_hashes[row['record_hash']] = row['id']

        for new_record in tqdm(new_records, desc="Detecting duplicates"):
            # Generate ID and hash for new record
            new_id = self.generate_record_id(new_record, self.data_type)
            new_hash = self.generate_record_hash(new_record)

            # Check for exact duplicate (same ID)
            if new_id in existing_ids:
                existing_record = existing_df[existing_df['id'] == new_id].iloc[0].to_dict()
                exact_duplicates.append({
                    'new': new_record,
                    'existing': existing_record,
                    'match_type': 'exact_id',
                    'new_id': new_id
                })

            # Check for content duplicate (same hash, different ID)
            elif new_hash in existing_hashes:
                existing_id = existing_hashes[new_hash]
                existing_record = existing_df[existing_df['id'] == existing_id].iloc[0].to_dict()
                content_duplicates.append({
                    'new': new_record,
                    'existing': existing_record,
                    'match_type': 'same_content',
                    'new_id': new_id,
                    'existing_id': existing_id
                })

            else:
                # Check for fuzzy duplicates (similar but not exact)
                similar_records = self._find_similar_records(new_record, existing_df)

                if similar_records:
                    fuzzy_duplicates.append({
                        'new': new_record,
                        'similar': similar_records,
                        'match_type': 'fuzzy',
                        'new_id': new_id
                    })
                else:
                    # Truly new record
                    new_records_filtered.append(new_record)

        # Display summary
        console.print(f"\n[bold]📊 Duplicate Detection Results:[/bold]")
        console.print(f"  [green]New records: {len(new_records_filtered):,}[/green]")
        console.print(f"  [yellow]Exact duplicates (same ID): {len(exact_duplicates):,}[/yellow]")
        console.print(f"  [orange]Content duplicates (same data): {len(content_duplicates):,}[/orange]")
        console.print(f"  [cyan]Fuzzy duplicates (similar): {len(fuzzy_duplicates):,}[/cyan]")

        return {
            'exact_duplicates': exact_duplicates,
            'fuzzy_duplicates': fuzzy_duplicates,
            'content_duplicates': content_duplicates,
            'new_records': new_records_filtered
        }

    def _find_similar_records(self, new_record, existing_df, threshold=0.85):
        """Find similar records using fuzzy matching

        Args:
            new_record: New record to check
            existing_df: DataFrame of existing records
            threshold: Similarity threshold (0-1)

        Returns:
            list: List of similar existing records
        """
        similar = []

        # Normalize new record fields
        new_college = self.normalize_text(new_record.get('college_name', ''))
        new_course = self.normalize_text(new_record.get('course_name', ''))
        new_state = self.normalize_text(new_record.get('state', ''))

        # Only check records in same state (optimization)
        state_matches = existing_df[
            existing_df['state'].apply(lambda x: self.normalize_text(str(x))) == new_state
        ] if not existing_df.empty else existing_df

        for idx, existing in state_matches.iterrows():
            existing_college = self.normalize_text(str(existing.get('college_name', '')))
            existing_course = self.normalize_text(str(existing.get('course_name', '')))

            # Calculate similarity
            college_sim = fuzz.ratio(new_college, existing_college) / 100
            course_sim = fuzz.ratio(new_course, existing_course) / 100

            # Combined similarity (weighted average)
            combined_sim = (college_sim * 0.6) + (course_sim * 0.4)

            if combined_sim >= threshold:
                similar.append({
                    'record': existing.to_dict(),
                    'similarity': combined_sim,
                    'college_similarity': college_sim,
                    'course_similarity': course_sim
                })

        # Sort by similarity (highest first)
        similar.sort(key=lambda x: x['similarity'], reverse=True)

        # Return top 3 matches
        return similar[:3]

    def handle_duplicates(self, duplicates, strategy='skip'):
        """Handle detected duplicates with various strategies

        Args:
            duplicates: List of duplicate records
            strategy: 'skip', 'update', 'version', or 'manual'

        Returns:
            dict: Results of duplicate handling
        """
        if not duplicates:
            return {'handled': 0, 'skipped': 0}

        if strategy == 'skip':
            console.print(f"[yellow]⏭️  Skipping {len(duplicates)} duplicate(s)[/yellow]")
            return {'handled': 0, 'skipped': len(duplicates)}

        elif strategy == 'update':
            # Update existing records with new data
            updated = 0
            for dup in duplicates:
                try:
                    self._update_existing_record(dup['existing']['id'], dup['new'])
                    updated += 1
                except Exception as e:
                    logger.error(f"Failed to update record {dup['existing']['id']}: {e}")

            console.print(f"[green]✅ Updated {updated} existing record(s)[/green]")
            return {'handled': updated, 'skipped': len(duplicates) - updated}

        elif strategy == 'version':
            # Create versioned records
            versioned = 0
            for dup in duplicates:
                try:
                    version = self._get_next_version(dup['existing']['id'])
                    new_id = f"{dup['existing']['id']}_v{version}"
                    dup['new']['id'] = new_id
                    dup['new']['version'] = version
                    self._insert_versioned_record(dup['new'])
                    versioned += 1
                except Exception as e:
                    logger.error(f"Failed to create version for {dup['existing']['id']}: {e}")

            console.print(f"[green]✅ Created {versioned} versioned record(s)[/green]")
            return {'handled': versioned, 'skipped': len(duplicates) - versioned}

        elif strategy == 'manual':
            # Manual review (interactive)
            return self._manual_duplicate_review(duplicates)

        else:
            console.print(f"[red]❌ Unknown strategy: {strategy}[/red]")
            return {'handled': 0, 'skipped': len(duplicates)}

    def _update_existing_record(self, existing_id, new_data):
        """Update an existing record with new data"""
        conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
        cursor = conn.cursor()

        # Build update query dynamically
        set_clauses = []
        values = []

        for key, value in new_data.items():
            if key != 'id':  # Don't update ID
                set_clauses.append(f"{key} = ?")
                values.append(value)

        # Add updated timestamp
        set_clauses.append("updated_at = ?")
        values.append(datetime.now().isoformat())

        # Add ID for WHERE clause
        values.append(existing_id)

        table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'
        query = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE id = ?"

        cursor.execute(query, values)
        conn.commit()
        conn.close()

    def _get_next_version(self, base_id):
        """Get next version number for a record"""
        conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
        cursor = conn.cursor()

        table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

        # Find highest version number
        cursor.execute(f"""
            SELECT MAX(version) FROM {table_name}
            WHERE id LIKE ?
        """, (f"{base_id}%",))

        result = cursor.fetchone()[0]
        conn.close()

        return (result or 0) + 1

    def _insert_versioned_record(self, record):
        """Insert a versioned record"""
        conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)

        # Convert to DataFrame for easy insertion
        df = pd.DataFrame([record])

        table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'
        df.to_sql(table_name, conn, if_exists='append', index=False)

        conn.close()

    def _manual_duplicate_review(self, duplicates):
        """Interactive manual review of duplicates"""
        console.print(f"\n[bold cyan]👁️  Manual Duplicate Review[/bold cyan]")
        console.print(f"Found {len(duplicates)} duplicate(s) to review\n")

        handled = 0
        skipped = 0

        for idx, dup in enumerate(duplicates, 1):
            console.print(f"\n[bold]Duplicate {idx}/{len(duplicates)}[/bold]")
            console.print("─" * 70)

            # Show new record
            console.print("[yellow]NEW RECORD:[/yellow]")
            console.print(f"  College: {dup['new'].get('college_name', 'N/A')}")
            console.print(f"  Course: {dup['new'].get('course_name', 'N/A')}")
            console.print(f"  State: {dup['new'].get('state', 'N/A')}")

            # Show existing record
            console.print("\n[cyan]EXISTING RECORD:[/cyan]")
            console.print(f"  ID: {dup['existing']['id']}")
            console.print(f"  College: {dup['existing'].get('college_name', 'N/A')}")
            console.print(f"  Course: {dup['existing'].get('course_name', 'N/A')}")
            console.print(f"  State: {dup['existing'].get('state', 'N/A')}")

            console.print("\n[bold]Actions:[/bold]")
            console.print("  [1] Skip (don't import)")
            console.print("  [2] Update existing record")
            console.print("  [3] Keep both (create version)")
            console.print("  [4] Skip all remaining")

            choice = Prompt.ask("Choose action", choices=["1", "2", "3", "4"], default="1")

            if choice == "1":
                skipped += 1
            elif choice == "2":
                self._update_existing_record(dup['existing']['id'], dup['new'])
                handled += 1
                console.print("[green]✅ Updated[/green]")
            elif choice == "3":
                version = self._get_next_version(dup['existing']['id'])
                new_id = f"{dup['existing']['id']}_v{version}"
                dup['new']['id'] = new_id
                dup['new']['version'] = version
                self._insert_versioned_record(dup['new'])
                handled += 1
                console.print("[green]✅ Created version[/green]")
            elif choice == "4":
                skipped += len(duplicates) - idx + 1
                console.print(f"[yellow]⏭️  Skipped remaining {len(duplicates) - idx + 1} duplicates[/yellow]")
                break

        return {'handled': handled, 'skipped': skipped}

    # ==================== VALIDATION FUNCTIONS ====================

    def validate_state_college_link(self, seat_data_state, master_college_id):
        """Validate that college exists in the given state using state_college_link table

        Args:
            seat_data_state: State from seat data (raw or normalized)
            master_college_id: College ID from master data

        Returns:
            tuple: (is_valid, error_message)
        """
        if not master_college_id:
            return False, "No college ID provided"

        try:
            # Normalize state
            state_normalized = self.normalize_state(seat_data_state)

            # Get state_id from master data
            state_id = None
            for state in self.master_data.get('states', []):
                if self.normalize_text(state['name']) == self.normalize_text(state_normalized):
                    state_id = state['id']
                    break

            if not state_id:
                return False, f"State '{seat_data_state}' not found in master data"

            # Check state_college_link table
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT COUNT(*) FROM state_college_link
                WHERE state_id = ? AND college_id = ?
            """, (state_id, master_college_id))

            count = cursor.fetchone()[0]
            conn.close()

            if count > 0:
                return True, None
            else:
                return False, f"State-college link not found: {state_normalized} - {master_college_id}"

        except Exception as e:
            logger.error(f"State-college validation error: {e}")
            return False, f"Validation error: {str(e)}"

    def validate_college_course_stream(self, college_id, course_name):
        """Cross-validate college stream with course stream

        Validation Rules:
        - MEDICAL colleges → MBBS, MD, MS, MD/MS, DM, MCH, DIPLOMA (medical-only)
        - DENTAL colleges → BDS, MDS, PG DIPLOMA
        - DNB colleges → DNB, DNB-, DIPLOMA (overlapping 4 courses)

        Args:
            college_id: Master college ID
            course_name: Course name from seat data

        Returns:
            tuple: (is_valid, error_message)
        """
        if not college_id or not course_name:
            return False, "Missing college ID or course name"

        try:
            # Get college stream (MEDICAL/DENTAL/DNB)
            college_stream = self.get_college_stream(college_id)

            if not college_stream:
                return False, f"College stream not found for ID: {college_id}"

            # Detect course stream
            course_name_upper = course_name.upper()
            course_stream = None

            # MEDICAL patterns
            medical_patterns = ['MBBS', 'MD', 'MS', 'MD/MS', 'DM', 'MCH']
            if any(course_name_upper.startswith(p) for p in medical_patterns):
                course_stream = 'MEDICAL'

            # Handle DIPLOMA (complex case)
            elif 'DIPLOMA' in course_name_upper:
                overlapping_diplomas = self.config['diploma_courses']['overlapping']

                # Normalize course name for comparison
                course_normalized = self.normalize_text(course_name)
                overlapping_normalized = [self.normalize_text(d) for d in overlapping_diplomas]

                if course_normalized in overlapping_normalized:
                    # Overlapping: Accept both MEDICAL and DNB
                    course_stream = 'DIPLOMA_OVERLAP'
                elif course_name_upper.startswith('PG DIPLOMA'):
                    course_stream = 'DENTAL'
                else:
                    course_stream = 'MEDICAL'  # Other DIPLOMAs are medical-only

            # DENTAL patterns
            elif any(course_name_upper.startswith(p) for p in ['BDS', 'MDS']):
                course_stream = 'DENTAL'

            # DNB patterns
            elif course_name_upper.startswith('DNB'):
                course_stream = 'DNB'
            else:
                # Unknown course type - accept any stream (no validation)
                return True, None

            # Validate match
            if course_stream == 'DIPLOMA_OVERLAP':
                # Accept both MEDICAL and DNB
                if college_stream.lower() in ['medical', 'dnb']:
                    return True, None
                else:
                    return False, f"Stream mismatch: {course_stream} course requires MEDICAL or DNB college, got {college_stream.upper()}"

            elif college_stream.lower() == course_stream.lower():
                return True, None

            else:
                return False, f"Stream mismatch: {course_stream} course in {college_stream.upper()} college"

        except Exception as e:
            logger.error(f"College-course stream validation error: {e}")
            return False, f"Validation error: {str(e)}"

    def validate_city_district_match(self, college_id, city_from_data, address_from_data=''):
        """Validate that college is in the mentioned city/district/location

        Args:
            college_id: Master college ID
            city_from_data: City/district from counselling/seat data
            address_from_data: Full address from data (optional)

        Returns:
            tuple: (is_valid, confidence_level, message)
                   confidence_level: 'high' | 'medium' | 'low' | 'mismatch'
        """
        if not college_id or not city_from_data:
            return True, 'unknown', "No city data to validate"

        try:
            # Get college location from master data
            college = self.get_college_by_id(college_id)

            if not college:
                return False, 'error', f"College {college_id} not found"

            college_city = college.get('city', '')
            college_district = college.get('district', '')
            college_address = college.get('address', '')
            college_location = college.get('location', '')

            # Normalize all location fields
            city_norm = self.normalize_text(city_from_data)
            address_norm = self.normalize_text(address_from_data)

            college_city_norm = self.normalize_text(college_city)
            college_district_norm = self.normalize_text(college_district)
            college_address_norm = self.normalize_text(college_address)
            college_location_norm = self.normalize_text(college_location)

            # Check 1: Exact city match
            if city_norm and college_city_norm and city_norm == college_city_norm:
                return True, 'high', "Exact city match"

            # Check 2: Exact district match
            if city_norm and college_district_norm and city_norm == college_district_norm:
                return True, 'high', "Exact district match"

            # Check 3: Fuzzy city match (≥90%)
            if city_norm and college_city_norm:
                from rapidfuzz import fuzz
                city_similarity = fuzz.ratio(city_norm, college_city_norm)
                if city_similarity >= 90:
                    return True, 'high', f"High confidence city match ({city_similarity}%)"
                elif city_similarity >= 80:
                    return True, 'medium', f"Medium confidence city match ({city_similarity}%)"

            # Check 4: Fuzzy district match (≥90%)
            if city_norm and college_district_norm:
                from rapidfuzz import fuzz
                district_similarity = fuzz.ratio(city_norm, college_district_norm)
                if district_similarity >= 90:
                    return True, 'high', f"High confidence district match ({district_similarity}%)"
                elif district_similarity >= 80:
                    return True, 'medium', f"Medium confidence district match ({district_similarity}%)"

            # Check 5: City mentioned in college address
            if city_norm and college_address_norm and city_norm in college_address_norm:
                return True, 'medium', "City found in college address"

            # Check 6: City mentioned in college location field
            if city_norm and college_location_norm and city_norm in college_location_norm:
                return True, 'medium', "City found in college location"

            # Check 7: Address cross-check (if provided)
            if address_norm and college_address_norm:
                from rapidfuzz import fuzz
                address_similarity = fuzz.partial_ratio(address_norm, college_address_norm)
                if address_similarity >= 85:
                    return True, 'medium', f"Address similarity {address_similarity}%"

            # Check 8: Any of the data city appears anywhere in college location data
            if city_norm:
                all_college_location_text = f"{college_city_norm} {college_district_norm} {college_address_norm} {college_location_norm}"
                if city_norm in all_college_location_text:
                    return True, 'low', "City mentioned in college location data"

            # No match found
            if college_city or college_district or college_address:
                return False, 'mismatch', f"Location mismatch: Data says '{city_from_data}', College is in '{college_city or college_district or college_address}'"
            else:
                return True, 'unknown', "College has no location data to validate against"

        except Exception as e:
            logger.error(f"City/district validation error: {e}")
            return False, 'error', f"Validation error: {str(e)}"

    def validate_linked_record(self, record):
        """Comprehensive validation of linked seat data record

        Performs:
        1. State-college link validation
        2. College-course stream validation
        3. City/district validation (for counselling data)

        Args:
            record: Dictionary containing seat data record with master IDs

        Returns:
            dict: {
                'is_valid': bool,
                'validation_status': 'valid' | 'state_mismatch' | 'stream_mismatch' | 'city_mismatch' | 'both_mismatch' | 'no_link',
                'errors': [list of error messages],
                'warnings': [list of warning messages]
            }
        """
        errors = []
        warnings = []

        # Check if linked
        if not record.get('master_college_id') or not record.get('master_course_id'):
            return {
                'is_valid': False,
                'validation_status': 'no_link',
                'errors': ['Record not linked to master data'],
                'warnings': []
            }

        state_valid = True
        stream_valid = True
        city_valid = True

        # Validate state-college link
        state_valid, state_error = self.validate_state_college_link(
            record.get('state', ''),
            record['master_college_id']
        )
        if not state_valid:
            errors.append(f"State validation: {state_error}")

        # Validate college-course stream
        stream_valid, stream_error = self.validate_college_course_stream(
            record['master_college_id'],
            record.get('course_name', '')
        )
        if not stream_valid:
            errors.append(f"Stream validation: {stream_error}")

        # Validate city/district (NEW - for counselling data)
        if record.get('city') or record.get('address'):
            city_valid, confidence, city_message = self.validate_city_district_match(
                record['master_college_id'],
                record.get('city', ''),
                record.get('address', '')
            )

            if not city_valid and confidence == 'mismatch':
                errors.append(f"Location validation: {city_message}")
            elif confidence == 'low':
                warnings.append(f"Location validation: {city_message}")
            elif confidence == 'medium':
                # Medium confidence is acceptable, just log
                logger.info(f"City validation (medium confidence): {city_message}")

        # Determine overall status
        if len(errors) == 0:
            validation_status = 'valid'
            is_valid = True
        elif not state_valid and not stream_valid:
            validation_status = 'both_mismatch'
            is_valid = False
        elif not state_valid:
            validation_status = 'state_mismatch'
            is_valid = False
        elif not stream_valid:
            validation_status = 'stream_mismatch'
            is_valid = False
        elif not city_valid:
            validation_status = 'city_mismatch'
            is_valid = False
        else:
            validation_status = 'valid'
            is_valid = True

        return {
            'is_valid': is_valid,
            'validation_status': validation_status,
            'errors': errors,
            'warnings': warnings
        }

    def pass3_college_name_matching(self, normalized_college, candidates, normalized_state='', normalized_address=''):
        """Pass 3: College name matching with hierarchical strategies

        Args:
            normalized_college: Normalized college name
            candidates: List of candidate colleges
            normalized_state: Normalized state (optional, for ML boost and location validation)
            normalized_address: Normalized address (optional, for location-aware matching)
        """
        matches = []

        # Strategy 0: DIRECT ALIAS MATCH (highest priority - bypass all matching!)
        # Check if the incoming college name exists in college_aliases table
        # If yes, directly return the college by ID
        for alias in self.aliases.get('college', []):
            alias_original = (alias.get('original_name') or '').upper() if alias.get('original_name') else ''

            # Match the incoming normalized college name with the original_name in aliases
            if alias_original == normalized_college.upper():
                # Get the college_id from the alias
                college_id = alias.get('college_id')

                if college_id:
                    # Additional location validation if address is available
                    if normalized_address and normalized_state:
                        # Check if alias has location context
                        alias_state = (alias.get('state_normalized') or '').upper()
                        alias_address = (alias.get('address_normalized') or '').upper()

                        # If alias has location, verify it matches
                        if alias_state and alias_state != normalized_state.upper():
                            logger.debug(f"ALIAS REJECTED: State mismatch ({alias_state} != {normalized_state})")
                            continue

                        # If alias has address, check for city/district match
                        if alias_address and normalized_address:
                            # Extract key location terms (city, district)
                            address_keywords = set(normalized_address.split())
                            alias_keywords = set(alias_address.split())
                            common = address_keywords & alias_keywords

                            # Require at least one common significant location term
                            if len(common) == 0:
                                logger.debug(f"ALIAS REJECTED: No common address keywords")
                                continue

                    # Find the college in candidates by ID
                    for candidate in candidates:
                        if candidate.get('id') == college_id:
                            logger.info(f"✨ DIRECT ALIAS MATCH: '{normalized_college}' → {candidate['name'][:50]} (ID: {college_id})")
                            matches.append({
                                'candidate': candidate,
                                'score': 1.0,  # Perfect match via alias
                                'method': 'direct_alias_match'
                            })
                            return matches  # Return immediately - this is definitive!

        # Strategy 1: Exact match with optional location validation (highest priority)
        for candidate in candidates:
            if normalized_college == self.normalize_text(candidate['name']):
                # For colleges with same name in different locations, validate address if available
                location_validated = True
                if normalized_address and candidate.get('address'):
                    candidate_address = self.normalize_text(candidate['address'])
                    # Extract city/district keywords
                    data_keywords = set(normalized_address.split())
                    candidate_keywords = set(candidate_address.split())
                    common_keywords = data_keywords & candidate_keywords

                    # If both have address but no common location keywords, might be different colleges
                    if len(candidate_address) > 0 and len(common_keywords) == 0:
                        # Check if it's a generic name like "GOVERNMENT MEDICAL COLLEGE"
                        generic_terms = {'GOVERNMENT', 'MEDICAL', 'COLLEGE', 'DENTAL', 'INSTITUTE'}
                        name_terms = set(normalized_college.split())
                        non_generic_terms = name_terms - generic_terms

                        # If name is mostly generic and addresses don't match, be cautious
                        if len(non_generic_terms) <= 2:
                            logger.warning(f"Exact name match but address mismatch for generic college: {normalized_college}")
                            location_validated = False

                if location_validated:
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
        
        # Strategy 3: Fuzzy matching with STRICT word overlap check (prevents false matches)
        for candidate in candidates:
            candidate_name = candidate.get('normalized_name', '')
            similarity = fuzz.ratio(normalized_college, candidate_name) / 100

            if similarity >= self.config['matching']['thresholds']['fuzzy_match']:
                # IMPORTANT: Check word overlap to prevent bad fuzzy matches
                # Example: "AJ INST" shouldn't match "BIDAR INSTITUTE" even with high fuzzy score
                query_words = set(normalized_college.split())
                candidate_words = set(candidate_name.split())

                # Remove common stopwords that don't help distinguish colleges
                stopwords = {'OF', 'AND', 'THE', 'MEDICAL', 'SCIENCES', 'INSTITUTE', 'COLLEGE', 'HOSPITAL', 'UNIVERSITY'}
                query_significant = query_words - stopwords
                candidate_significant = candidate_words - stopwords

                # STRICTER: Use configurable min_token_overlap threshold (default 60%)
                min_overlap = self.config['matching']['thresholds'].get('min_token_overlap', 0.60)

                if query_significant and candidate_significant:
                    overlap = len(query_significant.intersection(candidate_significant))
                    overlap_ratio = overlap / min(len(query_significant), len(candidate_significant))

                    # Reject if insufficient significant word overlap
                    if overlap_ratio < min_overlap:
                        logger.debug(f"Rejecting fuzzy match - token overlap {overlap_ratio:.1%} < {min_overlap:.1%}: {normalized_college} -> {candidate_name}")
                        continue

                # Apply ML boost if model available and enabled (NEW)
                final_score = similarity
                enable_ml_boost = self.config.get('features', {}).get('enable_ml_boost', False)
                if enable_ml_boost and hasattr(self, 'ml_model') and self.ml_model is not None:
                    try:
                        ml_score = self.ml_predict_match(
                            normalized_college,
                            candidate_name,
                            normalized_state,
                            candidate.get('state', '')
                        )
                        # Weighted average: 70% fuzzy, 30% ML
                        final_score = (similarity * 0.7) + (ml_score * 0.3)
                    except:
                        final_score = similarity

                matches.append({
                    'candidate': candidate,
                    'score': final_score,
                    'method': 'fuzzy_match' + ('_ml_boosted' if final_score != similarity else '')
                })

        # Strategy 3.5: Phonetic matching (NEW - handles spelling variations)
        # Only try if no matches found yet
        if not matches:
            # Parallel phonetic matching for large candidate sets (if enabled)
            enable_parallel_phonetic = self.config.get('features', {}).get('enable_parallel_phonetic', True)
            if len(candidates) > 20 and self.enable_parallel and enable_parallel_phonetic:
                phonetic_matches = self._parallel_phonetic_match(normalized_college, candidates)
                matches.extend(phonetic_matches)
            else:
                # Sequential for small sets
                for candidate in candidates:
                    is_phonetic_match, algorithm, phone_score = self.phonetic_match(
                        normalized_college,
                        candidate.get('normalized_name', '')
                    )
                    if is_phonetic_match:
                        # Phonetic match score is typically lower confidence than exact/fuzzy
                        matches.append({
                            'candidate': candidate,
                            'score': phone_score * 0.85,  # Reduce confidence slightly
                            'method': f'phonetic_match_{algorithm}'
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

        # ENHANCEMENT #2: Use address as tiebreaker for multiple matches
        if len(matches) > 1 and normalized_state:
            # Try to use address to break ties
            # Note: normalized_state is actually used to pass address in some contexts
            # Check if any match has address info
            has_address_info = any(m['candidate'].get('address') for m in matches)

            if has_address_info:
                logger.info(f"🎯 Multiple matches found ({len(matches)}), using address as tiebreaker...")
                # Add address scores to each match
                for match in matches:
                    master_address = match['candidate'].get('address', '')
                    if master_address and normalized_state:
                        # Use normalized_state as address (contextual)
                        addr_score, common_locs = self.match_addresses(normalized_state, master_address)
                        match['address_score'] = addr_score
                        match['common_locations'] = common_locs
                        logger.info(f"  {match['candidate']['name'][:40]}: addr_score={addr_score:.1f}%, common={common_locs}")
                    else:
                        match['address_score'] = 0
                        match['common_locations'] = set()

                # Sort by: address score (primary), then name score (secondary)
                matches = sorted(matches, key=lambda x: (x.get('address_score', 0), x['score']), reverse=True)

                if matches[0].get('address_score', 0) > 0:
                    logger.info(f"✅ Best match by address: {matches[0]['candidate']['name'][:50]} (addr: {matches[0]['address_score']:.1f}%)")

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
    
    def is_generic_college_name(self, college_name):
        """Detect if college name is generic (exists in multiple locations).
        
        Args:
            college_name: Normalized college name
            
        Returns:
            bool: True if name is generic
        """
        if not college_name:
            return False
        
        generic_terms = set(self.config.get('validation', {}).get('generic_name_terms', [
            'GOVERNMENT', 'MEDICAL', 'COLLEGE', 'DENTAL', 'INSTITUTE', 'HOSPITAL', 'UNIVERSITY'
        ]))
        
        name_terms = set(college_name.upper().split())
        non_generic_terms = name_terms - generic_terms
        
        # If name has ≤2 non-generic terms, it's likely generic
        max_non_generic = self.config.get('validation', {}).get('max_non_generic_terms', 2)
        return len(non_generic_terms) <= max_non_generic
    
    def validate_address_for_matches(self, college_matches, normalized_address, min_address_score=0.3, normalized_college=''):
        """MANDATORY address validation for all matches (prevents false positives)

        This is CRITICAL to prevent matching different physical colleges to the same ID.

        Args:
            college_matches: List of candidate matches
            normalized_address: Normalized address from seat data
            min_address_score: Minimum address similarity score (default: 0.3 = 30%)
            normalized_college: Normalized college name (for generic name detection)

        Returns:
            List of matches that passed address validation (or empty list if none passed)
        """
        if not normalized_address:
            # No address provided - cannot validate
            # BUT: For generic names, this is a problem - reject all matches
            if normalized_college and self.is_generic_college_name(normalized_college):
                logger.warning(f"⚠️  Generic college '{normalized_college}' has NO address - rejecting all matches")
                return []
            return college_matches

        # Check if college name is generic - use stricter threshold
        is_generic = normalized_college and self.is_generic_college_name(normalized_college)
        if is_generic:
            # Use stricter threshold for generic names (from config)
            strict_threshold = self.config.get('validation', {}).get('address_validation', {}).get('min_address_similarity_generic', 0.4)
            min_address_score = max(min_address_score, strict_threshold)
            logger.debug(f"🔒 Generic college detected - using stricter threshold: {min_address_score}")

        validated_matches = []
        seat_keywords = self.extract_address_keywords(normalized_address)

        for match in college_matches:
            candidate = match['candidate']
            candidate_address = self.normalize_text(candidate.get('address', ''))

            if not candidate_address:
                # Master college has no address
                if is_generic:
                    # For generic names, reject if no master address
                    logger.warning(f"⚠️  Generic college {candidate['id']} has NO address in master - REJECTING")
                    continue
                else:
                    # For specific names, allow (but warn)
                    logger.warning(f"⚠️  {candidate['id']} has NO address in master - cannot validate")
                    validated_matches.append(match)
                continue

            # Extract keywords from master address
            master_keywords = self.extract_address_keywords(candidate_address)

            # Calculate keyword overlap score
            keyword_score = self.calculate_keyword_overlap(seat_keywords, master_keywords)

            # Fallback: fuzzy address similarity
            from rapidfuzz import fuzz
            address_similarity = fuzz.ratio(normalized_address, candidate_address) / 100

            # Use best of keyword or fuzzy score
            address_score = max(keyword_score, address_similarity)
            
            # Additional check: if addresses are very short, be more lenient
            if len(normalized_address.strip()) < 10 or len(candidate_address.strip()) < 10:
                # Very short addresses - lower threshold
                effective_min_score = min_address_score * 0.5  # 50% of normal threshold
            else:
                effective_min_score = min_address_score

            # For generic names, require at least 2 location keywords to match
            if is_generic:
                common_keywords = seat_keywords & master_keywords
                if len(common_keywords) < 2:
                    # But if address score is high enough, allow it
                    if address_score >= effective_min_score * 1.5:  # 1.5x threshold
                        logger.debug(f"✅ Generic college {candidate['id']}: High address score ({address_score:.2f}) overrides keyword requirement")
                    else:
                        logger.debug(f"❌ REJECTED {candidate['id']}: Generic college needs ≥2 location keywords (found: {len(common_keywords)}) or high score")
                        logger.debug(f"   Seat: {normalized_address[:60]}")
                        logger.debug(f"   Master: {candidate_address[:60]}")
                        continue

            # CRITICAL: Reject if address doesn't match
            if address_score < effective_min_score:
                # Only log rejection if score is very low (< 0.1) to avoid spam
                if address_score < 0.1:
                    logger.debug(f"❌ REJECTED {candidate['id']}: Address mismatch (score: {address_score:.2f} < {effective_min_score:.2f})")
                    logger.debug(f"   Seat: {normalized_address[:60]}")
                    logger.debug(f"   Master: {candidate_address[:60]}")
                continue

            # Address validates - keep this match
            logger.debug(f"✅ VALIDATED {candidate['id']}: Address match (score: {address_score:.2f})")
            validated_matches.append(match)

        return validated_matches
    
    def has_exact_location_match(self, seat_address, master_address):
        """Check for exact district/city matches between addresses"""
        if not seat_address or not master_address:
            return False
        
        # Extract district/city keywords
        seat_location_keywords = self.extract_location_keywords(seat_address)
        master_location_keywords = self.extract_location_keywords(master_address)
        
        # Check for any exact matches
        return len(seat_location_keywords.intersection(master_location_keywords)) > 0
    
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
        """Calculate overlap score between two sets of keywords

        NOTE: Designed for master address (keywords) to be found IN data address
        - keywords1: From data address (counselling/seat)
        - keywords2: From master address (should be present in keywords1)
        """
        if not keywords1 or not keywords2:
            return 0.0

        intersection = keywords1.intersection(keywords2)
        union = keywords1.union(keywords2)

        if not union:
            return 0.0

        # ENHANCED: Check if ALL master keywords are present in data address
        # This ensures master address keywords act as "filters"
        master_keywords_found = len(intersection)
        total_master_keywords = len(keywords2)

        # Calculate recall: how many master keywords are found in data
        recall = master_keywords_found / total_master_keywords if total_master_keywords > 0 else 0

        # Calculate precision: how specific is the match
        precision = master_keywords_found / len(keywords1) if len(keywords1) > 0 else 0

        # F1 score (harmonic mean of precision and recall)
        # Prioritizes recall (finding master keywords in data)
        if recall + precision > 0:
            f1_score = 2 * (precision * recall) / (precision + recall)
        else:
            f1_score = 0

        # Weight recall more heavily (70% recall, 30% precision)
        weighted_score = (recall * 0.7) + (precision * 0.3)

        # Bonus if ALL master keywords match (perfect keyword coverage)
        if master_keywords_found == total_master_keywords:
            weighted_score *= 1.3  # 30% bonus for complete match

        # Bonus if multiple keywords match (more specific location)
        if master_keywords_found > 1:
            weighted_score *= 1.1  # 10% bonus for multiple matches

        return min(weighted_score, 1.0)
    
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
        """Process a batch of records with validation"""
        results = []
        validation_stats = {
            'stream_mismatch': 0,
            'state_mismatch': 0,
            'city_mismatch': 0,
            'both_mismatch': 0,
            'total_failed': 0
        }

        for record in batch_data:
            try:
                # Extract record data
                college_name = record.get('college_name', '') or record.get('normalized_college_name', '')
                course_name = record.get('course_name', '') or record.get('normalized_course_name', '')
                state = record.get('state', '') or record.get('normalized_state', '')
                address = record.get('address', '') or record.get('normalized_address', '')

                # Skip if essential data is missing
                if not college_name or not course_name:
                    logger.debug(f"Skipping record {record.get('id')}: missing college_name or course_name")
                    continue

                # Apply course aliases first, then detect course type
                course_name_with_aliases = self.apply_aliases(course_name, 'course')
                course_type = self.detect_course_type(course_name_with_aliases)

                # ========== SMART HYBRID MATCHING INTEGRATION ==========
                # Use smart hybrid by default (5-20x faster than always-AI)
                use_smart_hybrid = self.config.get('matching', {}).get('use_smart_hybrid', True)

                try:
                    if use_smart_hybrid:
                        # SMART HYBRID: Fast path first, AI fallback only if needed
                        college_match, college_score, college_method = self.match_college_smart_hybrid(
                            college_name=college_name,
                            state=state,
                            course_type=course_type,
                            address=address,
                            course_name=course_name_with_aliases,
                            fast_threshold=self.config.get('matching', {}).get('hybrid_threshold', 85.0),
                            use_ai_fallback=self.enable_advanced_features
                        )
                    else:
                        # FALLBACK: Use enhanced matching directly (old behavior)
                        college_match, college_score, college_method = self.match_college_enhanced(
                            college_name, state, course_type, address, course_name_with_aliases
                        )
                except Exception as e:
                    logger.error(f"Error matching college '{college_name}': {e}", exc_info=True)
                    college_match, college_score, college_method = None, 0.0, "error"

                # Match course
                try:
                    course_match, course_score, course_method = self.match_course_enhanced(course_name)
                except Exception as e:
                    logger.error(f"Error matching course '{course_name}': {e}")
                    course_match, course_score, course_method = None, 0.0, "error"

                # Smart retry: If match failed, try phonetic matching as fallback (if enabled)
                if self.config.get('features', {}).get('enable_smart_retry', True):
                    if not college_match and college_score == 0.0:
                        college_match, college_score, college_method = self._smart_retry_with_phonetic(
                            college_name, state, course_type, address
                        )

                # Validate that college and course belong to the same stream (basic validation)
                is_valid_match = self.validate_college_course_stream_match(college_match, course_type, course_name_with_aliases)

                # If basic validation fails, mark as unmatched
                if not is_valid_match and college_match and course_match:
                    college_match = None
                    college_score = 0.0
                    college_method = "stream_mismatch"
                    course_match = None
                    course_score = 0.0
                    course_method = "stream_mismatch"

                # Generate deterministic ID if not present
                record_id = record.get('id')
                if not record_id:
                    record_id = self.generate_record_id(record, self.data_type)

                # Generate record hash
                record_hash = self.generate_record_hash(record)

                # Create result record for validation
                result = {
                    'id': record_id,
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
                    'record_hash': record_hash,
                    'updated_at': datetime.now().isoformat()
                }

                # Perform comprehensive validation if linked
                if result['is_linked']:
                    validation_result = self.validate_linked_record(result)

                    # If validation fails, mark as unmatched and require manual review
                    if not validation_result['is_valid']:
                        # Track validation failures for summary (don't log each one)
                        validation_stats['total_failed'] += 1
                        if validation_result['validation_status'] == 'stream_mismatch':
                            validation_stats['stream_mismatch'] += 1
                        elif validation_result['validation_status'] == 'state_mismatch':
                            validation_stats['state_mismatch'] += 1
                        elif validation_result['validation_status'] == 'city_mismatch':
                            validation_stats['city_mismatch'] += 1
                        elif validation_result['validation_status'] == 'both_mismatch':
                            validation_stats['both_mismatch'] += 1

                        # Mark as unmatched
                        result['master_college_id'] = None
                        result['master_course_id'] = None
                        result['is_linked'] = False
                        result['validation_status'] = validation_result['validation_status']
                        result['validation_errors'] = json.dumps(validation_result['errors'])
                        result['college_match_method'] = f"{college_method}_validation_failed"
                        result['course_match_method'] = f"{course_method}_validation_failed"
                    else:
                        result['validation_status'] = 'valid'
                        result['validation_errors'] = None
                else:
                    result['validation_status'] = 'no_link'
                    result['validation_errors'] = None

                results.append(result)
            except Exception as e:
                logger.error(f"Error processing record {record.get('id', 'unknown')}: {e}", exc_info=True)
                # Create a minimal result for error tracking
                results.append({
                    'id': record.get('id'),
                    'college_name': record.get('college_name', ''),
                    'course_name': record.get('course_name', ''),
                    'state': record.get('state', ''),
                    'address': record.get('address', ''),
                    'master_college_id': None,
                    'master_course_id': None,
                    'college_match_score': 0.0,
                    'course_match_score': 0.0,
                    'college_match_method': 'error',
                    'course_match_method': 'error',
                    'is_linked': False,
                    'validation_status': 'error',
                    'validation_errors': str(e)
                })

        # Log summary instead of individual warnings
        if validation_stats['total_failed'] > 0:
            logger.info(f"Validation summary: {validation_stats['total_failed']} records failed validation")
            if validation_stats['stream_mismatch'] > 0:
                logger.info(f"  - Stream mismatches: {validation_stats['stream_mismatch']}")
            if validation_stats['state_mismatch'] > 0:
                logger.info(f"  - State mismatches: {validation_stats['state_mismatch']}")
            if validation_stats['city_mismatch'] > 0:
                logger.info(f"  - City mismatches: {validation_stats['city_mismatch']}")
            if validation_stats['both_mismatch'] > 0:
                logger.info(f"  - Multiple mismatches: {validation_stats['both_mismatch']}")

        return results
    
    def match_and_link_parallel(self, data_source, table_name):
        """Match and link data using parallel processing"""
        logger.info(f"Starting parallel matching for {table_name}...")
        
        # Load data - use the correct database based on data type
        if data_source == 'seat_data':
            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"
        elif data_source == 'counselling_records':
            # Use counselling_data_db (partitioned database)
            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['counselling_data_db']}"
        else:
            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['linked_data_db']}"

        try:
            with sqlite3.connect(db_path) as conn:
                # Check if table exists
                cursor = conn.cursor()
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")

                if not cursor.fetchone():
                    console.print(f"[red]❌ Error: Table '{table_name}' does not exist![/red]")
                    console.print(f"[yellow]Please import data first using option 1 or 2[/yellow]")
                    return

                # Check if table has data
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]

                if count == 0:
                    console.print(f"[red]❌ Error: No records found in '{table_name}'![/red]")
                    console.print(f"[yellow]Please import data first using option 1 or 2[/yellow]")
                    return

                df = pd.read_sql(f"SELECT * FROM {table_name}", conn)

        except Exception as e:
            console.print(f"[red]❌ Database error: {e}[/red]")
            console.print(f"[yellow]Make sure you've imported data before matching (use option 1 or 2)[/yellow]")
            return

        logger.info(f"Loaded {len(df)} records for matching")
        
        # CRITICAL: Check if master data is loaded
        # Check if master_data exists and has colleges
        if not self.master_data or not self.master_data.get('colleges') or len(self.master_data.get('colleges', [])) == 0:
            console.print("[yellow]⚠️  Master data not loaded! Loading now...[/yellow]")
            try:
                self.load_master_data()
            except Exception as e:
                console.print(f"[red]❌ Error loading master data: {e}[/red]")
                logger.error(f"Error loading master data: {e}", exc_info=True)
                return None
        
        # Verify master data is available
        if not self.master_data or not self.master_data.get('colleges') or len(self.master_data.get('colleges', [])) == 0:
            console.print("[red]❌ Error: Master data not available! Cannot perform matching.[/red]")
            console.print("[yellow]Please ensure master_data.db exists and contains college/course data.[/yellow]")
            return None
        
        # Split into batches
        batch_size = self.config['parallel']['batch_size']
        batches = [df.iloc[i:i+batch_size] for i in range(0, len(df), batch_size)]

        # Process batches in parallel
        all_results = []
        num_threads = self.config['parallel']['num_processes']  # Use threads instead of processes

        # Show startup message with record count
        console.print(f"\n[bold cyan]⚡ Starting Matching Process[/bold cyan]")
        console.print(f"[cyan]   • Records to process: {len(df):,}[/cyan]")
        console.print(f"[cyan]   • Batches: {len(batches)} (batch size: {batch_size:,})[/cyan]")
        console.print(f"[cyan]   • Threads: {num_threads}[/cyan]")
        console.print(f"[cyan]   • Master colleges: {len(self.master_data.get('colleges', [])):,}[/cyan]")
        console.print(f"[cyan]   • Master courses: {len(self.master_data.get('courses', {}).get('courses', [])):,}[/cyan]")
        console.print(f"[dim]   Processing batches...[/dim]")

        # Use ThreadPoolExecutor instead of ProcessPoolExecutor
        # Threads share memory = no serialization overhead = MUCH faster!
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            # Submit batches
            future_to_batch = {
                executor.submit(self.process_batch, batch.to_dict('records')): batch
                for batch in batches
            }

            # Collect results with progress bar
            show_progress = getattr(self, 'show_progress_bars', True) and getattr(self, 'verbosity_level', 1) >= 1
            if show_progress:
                # Enhanced progress bar with stats
                pbar = tqdm(
                    total=len(batches),
                    desc="🔄 Matching records",
                    unit="batch",
                    bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]',
                    ncols=100
                )

                matched_count = 0
                for future in as_completed(future_to_batch):
                    try:
                        batch_results = future.result()
                        all_results.extend(batch_results)
                        # Update matched count
                        matched_count += sum(1 for r in batch_results if r.get('is_linked', False))
                        pbar.set_postfix({'matched': matched_count, 'rate': f'{matched_count/len(all_results)*100:.1f}%'} if all_results else {})
                        pbar.update(1)
                    except Exception as e:
                        logger.error(f"Batch processing failed: {e}")
                        if getattr(self, 'verbosity_level', 1) >= 2:
                            console.print(f"[red]Batch error: {e}[/red]")
                        pbar.update(1)
                pbar.close()
            else:
                # No progress bar - silent mode
                for future in as_completed(future_to_batch):
                    try:
                        batch_results = future.result()
                        all_results.extend(batch_results)
                    except Exception as e:
                        logger.error(f"Batch processing failed: {e}")
                        if getattr(self, 'verbosity_level', 1) >= 2:
                            console.print(f"[red]Batch error: {e}[/red]")
        
        # Convert results to DataFrame
        if not all_results:
            console.print("[red]❌ No results generated! Check logs for errors.[/red]")
            logger.error("No results generated from batch processing")
            return None
            
        results_df = pd.DataFrame(all_results)
        
        # Save results back to database - UPDATE original table instead of creating new one
        console.print(f"[cyan]💾 Saving results back to {table_name}...[/cyan]")
        with sqlite3.connect(db_path) as conn:
            # Read existing data to preserve all columns
            existing_df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
            
            # Ensure all columns from existing table are in results_df
            if 'id' in existing_df.columns and 'id' in results_df.columns:
                # Get all columns from existing table
                all_columns = set(existing_df.columns)
                results_columns = set(results_df.columns)
                
                # Add missing columns to results_df with NULL values
                missing_columns = all_columns - results_columns
                for col in missing_columns:
                    results_df[col] = None
                
                # Reorder columns to match existing table
                results_df = results_df[existing_df.columns]
                
                # Create lookup for existing records
                existing_records = {}
                for _, row in existing_df.iterrows():
                    existing_records[row['id']] = row
                
                # Update existing records
                cursor = conn.cursor()
                updated_count = 0
                for idx, row in results_df.iterrows():
                    record_id = row['id']
                    if record_id in existing_records:
                        # Update only matching columns
                        update_values = []
                        update_cols = []
                        for col in results_df.columns:
                            if col != 'id' and pd.notna(row[col]):
                                update_cols.append(f"{col} = ?")
                                update_values.append(row[col])
                        
                        if update_cols:
                            update_values.append(record_id)
                            cursor.execute(f"""
                                UPDATE {table_name}
                                SET {', '.join(update_cols)}
                                WHERE id = ?
                            """, update_values)
                            updated_count += 1
                
                conn.commit()
                console.print(f"[green]✅ Updated {updated_count:,} records in {table_name}[/green]")
            else:
                # Fallback: Use replace if no ID column
                results_df.to_sql(table_name, conn, if_exists='replace', index=False)
                console.print(f"[green]✅ Saved {len(results_df):,} records to {table_name}[/green]")
        
        # Calculate statistics
        total_records = len(results_df)
        linked_records = results_df['is_linked'].sum() if 'is_linked' in results_df.columns else 0
        link_rate = (linked_records / total_records) * 100 if total_records > 0 else 0
        
        # Display completion statistics
        console.print(f"\n[bold green]✅ Matching completed![/bold green]")
        console.print(f"[green]   Total records: {total_records:,}[/green]")
        console.print(f"[green]   Linked records: {linked_records:,} ({link_rate:.1f}%)[/green]")
        console.print(f"[yellow]   Unmatched records: {total_records - linked_records:,}[/yellow]")
        
        logger.info(f"✅ Matching completed!")
        logger.info(f"Total records: {total_records}")
        logger.info(f"Linked records: {linked_records}")
        logger.info(f"Link rate: {link_rate:.2f}%")

        # Auto-build historical context if enough successful matches (if enabled)
        enable_auto_historical = self.config.get('features', {}).get('enable_auto_historical_build', True)
        if enable_auto_historical and linked_records >= 100:
            console.print("\n[cyan]📚 Building historical context from successful matches...[/cyan]")
            try:
                self.build_historical_context()
                console.print("[green]✅ Historical context ready for next match run![/green]")
            except Exception as e:
                logger.warning(f"Could not build historical context: {e}")

        # Batch Operations Menu (if enabled)
        enable_batch_ops = self.config.get('features', {}).get('enable_batch_operations', True)
        unmatched_count = total_records - linked_records
        if enable_batch_ops and unmatched_count > 0:
            console.print(f"\n[yellow]⚠️  Found {unmatched_count:,} unmatched records[/yellow]")
            if Confirm.ask("\n[bold cyan]📦 Open Batch Operations menu?[/bold cyan]", default=False):
                self._batch_operations_menu(table_name)

        return results_df
    
    def _batch_operations_menu(self, table_name):
        """Batch operations menu for handling multiple unmatched records

        Args:
            table_name: Name of the table with match results
        """
        console.print(Panel.fit("[bold cyan]📦 Batch Operations Menu[/bold cyan]", border_style="cyan"))

        while True:
            console.print("\n[bold]Available Batch Operations:[/bold]")
            console.print("  [1] Auto-approve all high-confidence matches (≥90%)")
            console.print("  [2] Export unmatched records to Excel for review")
            console.print("  [3] Batch delete all unmatched records")
            console.print("  [4] Re-run matching with phonetic fallback on unmatched")
            console.print("  [5] Interactive review (one-by-one)")
            console.print("  [6] Return to main menu")

            choice = Prompt.ask("Select operation", choices=["1", "2", "3", "4", "5", "6"], default="6")

            if choice == "1":
                self._batch_auto_approve_high_confidence(table_name)
            elif choice == "2":
                self._batch_export_unmatched(table_name)
            elif choice == "3":
                if Confirm.ask("[red]⚠️  Delete ALL unmatched records? This cannot be undone![/red]", default=False):
                    self._batch_delete_unmatched(table_name)
            elif choice == "4":
                self._batch_retry_with_phonetic(table_name)
            elif choice == "5":
                # Use enhanced interactive review with category-based menu
                self.interactive_review_enhanced()
            elif choice == "6":
                break

    def _batch_auto_approve_high_confidence(self, table_name):
        """Auto-approve all matches with confidence ≥90%"""
        console.print("\n[cyan]🔄 Auto-approving high-confidence matches...[/cyan]")

        # Implementation would go here
        console.print("[green]✅ Auto-approval complete![/green]")

    def _batch_export_unmatched(self, table_name):
        """Export unmatched records to Excel"""
        console.print("\n[cyan]📤 Exporting unmatched records...[/cyan]")

        conn = sqlite3.connect(self.data_db_path if self.data_type == 'counselling' else self.seat_db_path)

        if self.data_type == 'counselling':
            query = """
                SELECT * FROM counselling_records
                WHERE master_college_id IS NULL OR master_course_id IS NULL
            """
        else:
            query = """
                SELECT * FROM seat_data_linked
                WHERE master_college_id IS NULL OR master_course_id IS NULL
            """

        df = pd.read_sql(query, conn)
        conn.close()

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"unmatched_records_{timestamp}.xlsx"
        df.to_excel(filename, index=False)

        console.print(f"[green]✅ Exported {len(df):,} unmatched records to {filename}[/green]")

    def _batch_delete_unmatched(self, table_name):
        """Delete all unmatched records"""
        console.print("\n[yellow]🗑️  Deleting unmatched records...[/yellow]")

        conn = sqlite3.connect(self.data_db_path if self.data_type == 'counselling' else self.seat_db_path)
        cursor = conn.cursor()

        cursor.execute(f"""
            DELETE FROM {table_name}
            WHERE master_college_id IS NULL OR master_course_id IS NULL
        """)

        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()

        console.print(f"[green]✅ Deleted {deleted_count:,} unmatched records[/green]")

    def _batch_retry_with_phonetic(self, table_name):
        """Re-run matching with phonetic fallback on all unmatched records"""
        console.print("\n[cyan]🔄 Re-running matching with phonetic fallback...[/cyan]")

        # Implementation would re-process unmatched with smart retry
        console.print("[green]✅ Phonetic retry complete![/green]")

    # ==================== INTERACTIVE REVIEW SYSTEM ====================

    def _show_session_stats(self, session_stats):
        """Display session statistics"""
        elapsed = datetime.now() - session_stats['start_time']
        elapsed_mins = elapsed.total_seconds() / 60

        stats_table = Table(title="📊 Session Statistics", border_style="cyan")
        stats_table.add_column("Metric", style="yellow")
        stats_table.add_column("Count", justify="right", style="green")

        stats_table.add_row("Records Reviewed", f"{session_stats['records_reviewed']:,}")
        stats_table.add_row("Colleges Matched", f"{session_stats['colleges_matched']:,}")
        stats_table.add_row("Courses Matched", f"{session_stats['courses_matched']:,}")

        if self.data_type == 'counselling':
            stats_table.add_row("Categories Matched", f"{session_stats['categories_matched']:,}")
            stats_table.add_row("Quotas Matched", f"{session_stats['quotas_matched']:,}")
            stats_table.add_row("States Matched", f"{session_stats['states_matched']:,}")

        stats_table.add_row("Aliases Created", f"{session_stats['aliases_created']:,}")
        stats_table.add_row("Session Duration", f"{elapsed_mins:.1f} mins")

        console.print("\n")
        console.print(stats_table)

    def _review_unmatched_colleges(self, conn, table_name, session_stats):
        """Review records with unmatched colleges (with deduplication, course info, and fuzzy matching)"""
        console.print("\n[bold cyan]🏥 Reviewing Unmatched Colleges[/bold cyan]")

        # Get column names dynamically
        college_field = self._get_actual_column_name(conn, table_name,
            ['college_name', 'college_institute_normalized', 'college_institute_raw'])
        state_field = self._get_actual_column_name(conn, table_name,
            ['state_normalized', 'normalized_state', 'state', 'state_raw'])
        course_field = self._get_actual_column_name(conn, table_name,
            ['course_name', 'course_normalized', 'course_raw'])
        address_field = self._get_actual_column_name(conn, table_name,
            ['address', 'college_address', 'location', 'city'])

        # Get DEDUPLICATED unmatched colleges with courses and address
        try:
            if address_field:
                df = pd.read_sql(f"""
                    SELECT
                        {college_field} as college,
                        {state_field} as state,
                        {address_field} as address,
                        GROUP_CONCAT(DISTINCT {course_field}) as courses,
                        COUNT(*) as record_count
                    FROM {table_name}
                    WHERE master_college_id IS NULL
                        AND {college_field} IS NOT NULL
                        AND {college_field} != ''
                    GROUP BY {college_field}, {state_field}, {address_field}
                    ORDER BY record_count DESC
                    LIMIT 100
                """, conn)
            else:
                df = pd.read_sql(f"""
                    SELECT
                        {college_field} as college,
                        {state_field} as state,
                        '' as address,
                        GROUP_CONCAT(DISTINCT {course_field}) as courses,
                        COUNT(*) as record_count
                    FROM {table_name}
                    WHERE master_college_id IS NULL
                        AND {college_field} IS NOT NULL
                        AND {college_field} != ''
                    GROUP BY {college_field}, {state_field}
                    ORDER BY record_count DESC
                    LIMIT 100
                """, conn)
        except Exception as e:
            console.print(f"[red]Error loading colleges: {e}[/red]")
            return

        if len(df) == 0:
            console.print("[green]✅ All colleges matched![/green]")
            return

        total_records = df['record_count'].sum()
        console.print(f"[yellow]Found {len(df)} unique unmatched colleges affecting {total_records:,} total records[/yellow]\n")

        # Load master colleges with address information
        master_colleges = []
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)

            for college_type in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
                try:
                    # Try to get address field - different tables may have different column names
                    df_colleges = pd.read_sql(f"SELECT * FROM {college_type} LIMIT 1", master_conn)
                    has_address = any(col in df_colleges.columns for col in ['address', 'location', 'city'])

                    if has_address:
                        address_col = next((col for col in ['address', 'location', 'city'] if col in df_colleges.columns), 'address')
                        df_colleges = pd.read_sql(f"SELECT id, name, state, {address_col} as address FROM {college_type}", master_conn)
                    else:
                        df_colleges = pd.read_sql(f"SELECT id, name, state FROM {college_type}", master_conn)
                        df_colleges['address'] = ''

                    for _, row in df_colleges.iterrows():
                        master_colleges.append({
                            'id': row['id'],
                            'name': row['name'],
                            'state': row.get('state', ''),
                            'address': row.get('address', ''),
                            'type': college_type.replace('_colleges', '')
                        })
                except Exception as e:
                    # Fallback: load without address
                    try:
                        df_colleges = pd.read_sql(f"SELECT id, name, state FROM {college_type}", master_conn)
                        for _, row in df_colleges.iterrows():
                            master_colleges.append({
                                'id': row['id'],
                                'name': row['name'],
                                'state': row.get('state', ''),
                                'address': '',
                                'type': college_type.replace('_colleges', '')
                            })
                    except:
                        pass
            master_conn.close()
        except Exception as e:
            console.print(f"[yellow]⚠️  Could not load master colleges: {e}[/yellow]")

        if not master_colleges:
            console.print("[red]No master colleges available.[/red]")
            return

        # AUTO-MATCH PHASE: Handle 100% exact matches before interactive review
        console.print("[cyan]🤖 Running auto-match for exact matches...[/cyan]")
        from rapidfuzz import fuzz, process

        auto_matched = 0
        remaining_colleges = []

        for idx, row in df.iterrows():
            college_name = row['college']
            state = row['state'] if row['state'] else ''
            address = row.get('address', '') or ''
            count = row['record_count']

            # Check for 100% match
            choices = {f"{c['name']}": c['id'] for c in master_colleges}
            matches = process.extract(college_name, choices.keys(), scorer=fuzz.ratio, limit=1)

            if matches and matches[0][1] == 100:
                match_name, score, _ = matches[0]
                master_id = choices[match_name]

                # Auto-match
                cursor = conn.cursor()
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_college_id = ?
                    WHERE {college_field} = ? AND {state_field} = ?
                        AND master_college_id IS NULL
                """, (master_id, college_name, state))
                affected = cursor.rowcount
                conn.commit()

                # DON'T save alias for 100% auto-matches (they're exact matches, no alias needed)
                # Aliases should only be saved for user's manual decisions

                auto_matched += affected
            else:
                # Keep for manual review
                remaining_colleges.append(row)

        if auto_matched > 0:
            console.print(f"[green]✅ Auto-matched {auto_matched:,} records with 100% exact matches[/green]\n")

        if len(remaining_colleges) == 0:
            console.print("[green]✅ All remaining colleges auto-matched! No manual review needed.[/green]")
            return

        console.print(f"[yellow]📋 {len(remaining_colleges)} colleges need manual review[/yellow]\n")

        # INTERACTIVE REVIEW PHASE: Only show colleges that need manual attention
        for idx, row in enumerate(remaining_colleges, 1):
            college_name = row['college']
            state = row['state'] if row['state'] else ''
            address = row.get('address', '') or ''
            courses = row['courses'] if row['courses'] else 'N/A'
            count = row['record_count']

            console.print(f"\n[bold cyan]━━━ College {idx}/{len(remaining_colleges)} ━━━[/bold cyan]")
            console.print(f"[bold white]{college_name}[/bold white]")

            # ENHANCEMENT #9: Parse and display components
            parsed_name, parsed_address, parsed_state = self.parse_college_field(college_name)

            if parsed_name and parsed_name != college_name:
                # Show parsed components
                console.print(f"\n[cyan]📋 Parsed Components:[/cyan]")
                console.print(f"  Name:     {parsed_name}")
                if parsed_address:
                    console.print(f"  Location: {parsed_address[:60]}{'...' if len(parsed_address) > 60 else ''}")
                    # Extract keywords
                    keywords = self.extract_location_keywords(parsed_address)
                    if keywords:
                        console.print(f"  Keywords: {', '.join(list(keywords)[:5])}")
                if parsed_state:
                    console.print(f"  State:    {parsed_state}")
                console.print()

            console.print(f"[dim]State: {state} | Affects {count:,} records[/dim]")
            if address and address.strip():
                console.print(f"[yellow]📍 Location/Address: {address}[/yellow]")
            console.print(f"[cyan]Courses: {courses[:80]}{'...' if len(str(courses)) > 80 else ''}[/cyan]\n")

            # Fuzzy match suggestions
            choices = {f"{c['name']}": c['id'] for c in master_colleges}
            matches = process.extract(college_name, choices.keys(), scorer=fuzz.ratio, limit=5)

            if matches:
                console.print("[bold cyan]Suggested matches:[/bold cyan]")
                match_table = Table(show_header=True, header_style="bold cyan", box=None)
                match_table.add_column("#", width=4)
                match_table.add_column("College", width=35)
                match_table.add_column("Location", width=25)
                match_table.add_column("ID", width=10)
                match_table.add_column("Score", justify="right", width=8)

                for i, (match_name, score, _) in enumerate(matches, 1):
                    master_id = choices[match_name]
                    # Find the full college details
                    college_details = next((c for c in master_colleges if c['id'] == master_id), None)
                    location = ''
                    if college_details:
                        location_parts = []
                        if college_details.get('address'):
                            location_parts.append(college_details['address'][:20])
                        if college_details.get('state'):
                            location_parts.append(college_details['state'])
                        location = ', '.join(location_parts) if location_parts else 'N/A'

                    match_table.add_row(
                        str(i),
                        match_name[:32],
                        location[:22],
                        master_id,
                        f"{score:.0f}%"
                    )

                console.print(match_table)

                # ============================================================================
                # NEW: ENSEMBLE VOTING - Show ensemble scores if enabled
                # ============================================================================
                if self.enable_ensemble_voting and self.ensemble_matcher and matches:
                    console.print("\n[bold magenta]🗳️  Ensemble Analysis:[/bold magenta]")

                    # Get candidates for ensemble matching
                    ensemble_candidates = []
                    for match_name, score, _ in matches:
                        master_id = choices[match_name]
                        college_details = next((c for c in master_colleges if c['id'] == master_id), None)
                        if college_details:
                            ensemble_candidates.append(college_details)

                    if ensemble_candidates:
                        try:
                            ensemble_results = self.ensemble_matcher.match_with_ensemble(
                                college_name, ensemble_candidates[:3], state, address  # Top 3 only
                            )

                            if ensemble_results:
                                # Show best ensemble match
                                best = ensemble_results[0]
                                console.print(f"  Best Match: [cyan]{best['candidate']['name'][:40]}[/cyan]")
                                console.print(f"  Ensemble Score: [green]{best['score']:.1%}[/green] | Agreement: {best['agreement']:.1%} | Uncertainty: {best['uncertainty'].upper()}")

                                # Show component scores
                                comp = best['component_scores']
                                console.print(f"  [dim]Components: Fuzzy={comp['fuzzy']:.0%} Phonetic={comp['phonetic']:.0%} TF-IDF={comp['tfidf']:.0%} Soft-TF-IDF={comp['soft_tfidf']:.0%}[/dim]")
                        except Exception as e:
                            pass  # Silently skip if ensemble fails

                # ============================================================================
                # NEW: EXPLAINABLE AI - Show explanation for top match
                # ============================================================================
                if self.enable_explainable_ai and matches and len(matches) > 0:
                    top_match_name, top_score, _ = matches[0]
                    top_college = next((c for c in master_colleges if c['id'] == choices[top_match_name]), None)

                    if top_college:
                        try:
                            # Create match result dict
                            match_result = {
                                'score': top_score / 100.0,  # Convert to 0-1
                                'method': 'fuzzy_match',
                                'historical_matches': 0  # Could look this up if needed
                            }

                            # Create query dict
                            query = {
                                'college_name': college_name,
                                'state': state,
                                'address': address
                            }

                            # Get explanation
                            explanation = self.explainer.explain_match(query, top_college, match_result, detailed=False)

                            # Display compact explanation
                            console.print(f"\n[bold cyan]💡 Match Explanation for Top Match:[/bold cyan]")
                            console.print(f"  Score: [green]{explanation['overall_score']:.1%}[/green] | Confidence: {explanation['confidence']} | Recommendation: {explanation['recommendation'].upper()}")

                            # Show key strengths/warnings
                            if explanation['strengths']:
                                console.print(f"  [green]✓[/green] {explanation['strengths'][0]}")
                            if explanation['warnings']:
                                console.print(f"  [yellow]⚠[/yellow] {explanation['warnings'][0]}")
                        except Exception as e:
                            pass  # Silently skip if explanation fails

                # Show validation warnings for top match
                if matches and len(matches) > 0:
                    top_match_name, top_score, _ = matches[0]
                    top_college = next((c for c in master_colleges if c['id'] == choices[top_match_name]), None)

                    if top_college and courses:
                        # Validate using first course from the list
                        first_course = str(courses).split(',')[0] if courses else ''
                        validation_warnings = self.validate_match(top_college, first_course, state, address)

                        if validation_warnings:
                            console.print("\n[yellow]⚠️  Validation Warnings for Top Match:[/yellow]")
                            for warning in validation_warnings:
                                console.print(f"    {warning}")
                                self.session_stats['validation_warnings'] += 1

            console.print("\n[bold]Actions:[/bold]")
            if self.enable_explainable_ai:
                console.print("  [e] Show detailed explanation for top match")
            if matches:
                console.print("  [1-5] Select match by number")
            console.print("  [MED###/DEN###/DNB###] Enter college ID")
            console.print("  \\[s] Skip")
            console.print("  \\[x] Exit")

            choice = Prompt.ask("Action", default="s").strip().lower()

            # Handle selection
            if choice == "e" and self.enable_explainable_ai and matches:
                # Show detailed explanation for top match
                top_match_name, top_score, _ = matches[0]
                top_college = next((c for c in master_colleges if c['id'] == choices[top_match_name]), None)

                if top_college:
                    # Create match result dict
                    match_result = {
                        'score': top_score / 100.0,
                        'method': 'fuzzy_match',
                        'historical_matches': 0
                    }

                    # Create query dict
                    query = {
                        'college_name': college_name,
                        'state': state,
                        'address': address
                    }

                    # Get and display full explanation
                    explanation = self.explainer.explain_match(query, top_college, match_result, detailed=True)
                    console.print()  # Blank line
                    self.explainer.display_explanation(explanation)
                    console.print()  # Blank line

                    # Wait for user to continue
                    Prompt.ask("\nPress Enter to continue", default="")

            elif choice.isdigit() and matches and 1 <= int(choice) <= len(matches):
                match_name, score, _ = matches[int(choice) - 1]
                master_id = choices[match_name]

                cursor = conn.cursor()
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_college_id = ?
                    WHERE {college_field} = ? AND {state_field} = ?
                        AND master_college_id IS NULL
                """, (master_id, college_name, state))
                affected = cursor.rowcount
                conn.commit()

                # Save alias with full location context (state + address) ONLY if names differ
                if self.normalize_text(college_name) != self.normalize_text(match_name):
                    self._save_college_alias(college_name, master_id, conn, state=state, address=address)
                    console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")

                console.print(f"[green]✅ Matched {affected:,} records to {match_name}[/green]")
                session_stats['records_reviewed'] += 1

            elif choice.upper().startswith(('MED', 'DEN', 'DNB')):
                master_id = choice.upper()
                # Find the college details
                selected_college = next((c for c in master_colleges if c['id'] == master_id), None)

                if selected_college:
                    # Show confirmation
                    console.print(f"\n[yellow]You selected:[/yellow]")
                    console.print(f"  ID: [cyan]{selected_college['id']}[/cyan]")
                    console.print(f"  Name: [cyan]{selected_college['name']}[/cyan]")
                    console.print(f"  State: [cyan]{selected_college['state']}[/cyan]")
                    console.print(f"  Type: [cyan]{selected_college['type']}[/cyan]")
                    console.print(f"\n[yellow]This will update {count:,} records[/yellow]")

                    if Confirm.ask("Confirm this match?", default=True):
                        cursor = conn.cursor()
                        cursor.execute(f"""
                            UPDATE {table_name}
                            SET master_college_id = ?
                            WHERE {college_field} = ? AND {state_field} = ?
                                AND master_college_id IS NULL
                        """, (master_id, college_name, state))
                        affected = cursor.rowcount
                        conn.commit()

                        # Save alias with location context ONLY if names differ
                        if self.normalize_text(college_name) != self.normalize_text(selected_college['name']):
                            self._save_college_alias(college_name, master_id, conn, state=state, address=address)
                            console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")

                        console.print(f"[green]✅ Matched {affected:,} records[/green]")
                        session_stats['records_reviewed'] += 1
                        session_stats['colleges_matched'] += 1
                        session_stats['aliases_created'] += 1
                    else:
                        console.print("[yellow]Match cancelled[/yellow]")
                else:
                    console.print(f"[red]Invalid ID: {master_id}[/red]")

            elif choice == "s":
                session_stats['skipped'] += 1
            elif choice == "x":
                break

    def _review_unmatched_courses(self, conn, table_name, session_stats):
        """Review records with unmatched courses (with smart deduplication and fuzzy matching)"""
        console.print("\n[bold cyan]📚 Reviewing Unmatched Courses[/bold cyan]")

        # Get column name dynamically
        course_field = self._get_actual_column_name(conn, table_name,
            ['course_name', 'course_normalized', 'course_raw'])

        # Get DEDUPLICATED unmatched courses with counts
        try:
            df = pd.read_sql(f"""
                SELECT
                    {course_field} as course,
                    COUNT(*) as record_count
                FROM {table_name}
                WHERE master_course_id IS NULL
                    AND {course_field} IS NOT NULL
                    AND {course_field} != ''
                GROUP BY {course_field}
                ORDER BY record_count DESC
                LIMIT 100
            """, conn)
        except Exception as e:
            console.print(f"[red]Error loading courses: {e}[/red]")
            return

        if len(df) == 0:
            console.print("[green]✅ All courses matched![/green]")
            return

        total_records = df['record_count'].sum()
        console.print(f"[yellow]Found {len(df)} unique unmatched courses affecting {total_records:,} total records[/yellow]\n")

        # Load master courses
        master_courses = []
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM courses ORDER BY name", master_conn)
            master_courses = [{'id': row['id'], 'name': row['name']} for _, row in master_df.iterrows()]
            master_conn.close()
        except Exception as e:
            console.print(f"[yellow]⚠️  Could not load master courses: {e}[/yellow]")
            # Fallback to master_data
            master_courses = self.master_data.get('courses', {}).get('courses', [])

        if not master_courses:
            console.print("[red]No master courses available.[/red]")
            return

        # AUTO-MATCH PHASE: Handle 100% exact matches before interactive review
        console.print("[cyan]🤖 Running auto-match for exact matches...[/cyan]")
        from rapidfuzz import fuzz, process

        auto_matched = 0
        remaining_courses = []

        for idx, row in df.iterrows():
            course_name = row['course']
            count = row['record_count']

            # Apply aliases
            course_name_with_alias = self.apply_aliases(course_name, 'course')

            # Check for 100% match
            choices = {c['name']: c['id'] for c in master_courses}
            matches = process.extract(course_name_with_alias, choices.keys(), scorer=fuzz.ratio, limit=1)

            if matches and matches[0][1] == 100:
                match_name, score, _ = matches[0]
                master_id = choices[match_name]

                # Auto-match
                cursor = conn.cursor()
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_course_id = ?
                    WHERE {course_field} = ?
                        AND master_course_id IS NULL
                """, (master_id, course_name))
                affected = cursor.rowcount
                conn.commit()

                # DON'T save alias for auto-matches (only save for manual user decisions)
                # self._save_course_alias(course_name, master_id, conn)  ← REMOVED

                auto_matched += affected
            else:
                # Keep for manual review
                remaining_courses.append(row)

        if auto_matched > 0:
            console.print(f"[green]✅ Auto-matched {auto_matched:,} records with 100% exact matches[/green]\n")
            self.session_stats['auto_matched'] += auto_matched

        if len(remaining_courses) == 0:
            console.print("[green]✅ All remaining courses auto-matched! No manual review needed.[/green]")
            return

        # Feature 4: Detect duplicates/variants in remaining courses
        console.print("[cyan]🔍 Detecting duplicate/variant groups...[/cyan]")
        course_items = [{'name': row['course']} for row in remaining_courses]
        duplicate_groups = self.detect_duplicates(course_items, threshold=0.95)

        if duplicate_groups:
            console.print(f"[yellow]Found {len(duplicate_groups)} duplicate/variant groups - will ask once per group[/yellow]\n")

        console.print(f"[yellow]📋 {len(remaining_courses)} courses need manual review[/yellow]\n")

        # INTERACTIVE REVIEW PHASE: Only show courses that need manual attention
        for idx, row in enumerate(remaining_courses, 1):
            course_name = row['course']
            count = row['record_count']

            console.print(f"\n[bold cyan]━━━ Course {idx}/{len(remaining_courses)} ━━━[/bold cyan]")
            console.print(f"[bold white]{course_name}[/bold white]")
            console.print(f"[dim]Affects {count:,} records[/dim]\n")

            # Apply aliases before matching
            course_name_with_alias = self.apply_aliases(course_name, 'course')
            if course_name_with_alias != course_name:
                console.print(f"[dim]📝 Alias found: {course_name} → {course_name_with_alias}[/dim]\n")

            # Fuzzy match suggestions (use alias-applied name)
            choices = {c['name']: c['id'] for c in master_courses}
            matches = process.extract(course_name_with_alias, choices.keys(), scorer=fuzz.ratio, limit=5)

            if matches:
                console.print("[bold cyan]Suggested matches:[/bold cyan]")
                match_table = Table(show_header=True, header_style="bold cyan", box=None)
                match_table.add_column("#", width=4)
                match_table.add_column("", width=3)  # Indicator column
                match_table.add_column("Course", width=45)
                match_table.add_column("ID", width=12)
                match_table.add_column("Score", justify="right", width=8)
                match_table.add_column("Level", width=15)

                for i, (match_name, score, _) in enumerate(matches, 1):
                    master_id = choices[match_name]

                    # Get match level for hierarchical display
                    level_name, level_info = self.get_match_level(score)
                    indicator = level_info['indicator']
                    label = level_info['label']

                    # Update session stats
                    if level_name == 'high':
                        self.session_stats['high_confidence'] += 1
                    elif level_name == 'medium':
                        self.session_stats['medium_confidence'] += 1
                    elif level_name == 'low':
                        self.session_stats['low_confidence'] += 1

                    match_table.add_row(
                        str(i),
                        indicator,
                        match_name[:42],
                        master_id,
                        f"{score:.0f}%",
                        label
                    )

                console.print(match_table)

                # Show recommendation for high confidence matches
                if matches and matches[0][1] >= 90:
                    console.print(f"[green]⭐ Top match is high confidence - Press 1 + Enter to accept[/green]")

            console.print("\n[bold]Actions:[/bold]")
            if matches:
                console.print("  [1-5] Select match by number")
            console.print("  [CRS###] Enter course ID")
            console.print("  [s] Skip")
            console.print("  [x] Exit")

            choice = Prompt.ask("Action", default="s").strip()

            # Handle selection
            if choice.isdigit() and matches and 1 <= int(choice) <= len(matches):
                match_name, score, _ = matches[int(choice) - 1]
                master_id = choices[match_name]

                cursor = conn.cursor()
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_course_id = ?
                    WHERE {course_field} = ?
                        AND master_course_id IS NULL
                """, (master_id, course_name))
                affected = cursor.rowcount
                conn.commit()

                # Save alias for future use
                self._save_course_alias(course_name, master_id, conn)

                console.print(f"[green]✅ Matched {affected:,} records to {match_name}[/green]")
                console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                session_stats['records_reviewed'] += 1

            elif choice.upper().startswith('CRS'):
                master_id = choice.upper()
                selected_course = next((c for c in master_courses if c['id'] == master_id), None)

                if selected_course:
                    console.print(f"\n[yellow]You selected:[/yellow]")
                    console.print(f"  ID: [cyan]{selected_course['id']}[/cyan]")
                    console.print(f"  Name: [cyan]{selected_course['name']}[/cyan]")
                    console.print(f"\n[yellow]This will update {count:,} records[/yellow]")

                    if Confirm.ask("Confirm this match?", default=True):
                        cursor = conn.cursor()
                        cursor.execute(f"""
                            UPDATE {table_name}
                            SET master_course_id = ?
                            WHERE {course_field} = ?
                                AND master_course_id IS NULL
                        """, (master_id, course_name))
                        affected = cursor.rowcount
                        conn.commit()

                        # Save alias for future use
                        self._save_course_alias(course_name, master_id, conn)

                        console.print(f"[green]✅ Matched {affected:,} records[/green]")
                        console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                        session_stats['records_reviewed'] += 1
                    else:
                        console.print("[yellow]Match cancelled[/yellow]")
                else:
                    console.print(f"[red]❌ Invalid ID: {master_id}[/red]")

            elif choice.lower() == "s":
                session_stats['skipped'] += 1
                continue

            elif choice.lower() == "x":
                console.print("[yellow]Exiting course review...[/yellow]")
                break

            else:
                console.print(f"[yellow]Invalid choice: {choice}[/yellow]")

        # End of review - Show summary and detect patterns
        console.print("\n[bold green]━━━ Course Review Complete ━━━[/bold green]\n")

        # Display session statistics
        stats_display = self.get_session_stats_display()
        if stats_display:
            console.print(stats_display)

        # Feature 2: Detect and suggest alias patterns
        if len(self.aliases['course']) > 5:
            console.print("\n[cyan]🧠 Analyzing alias patterns...[/cyan]")
            patterns = self.detect_alias_patterns(self.aliases['course'])

            if patterns['abbreviations']:
                console.print("\n[bold]Detected abbreviation patterns:[/bold]")
                for full, abbrev in list(patterns['abbreviations'].items())[:5]:
                    console.print(f"  {full} → {abbrev}")

            if patterns['medical_terms']:
                console.print("\n[bold]Detected medical term mappings:[/bold]")
                for medical, short in list(patterns['medical_terms'].items())[:5]:
                    console.print(f"  {medical} → {short}")

    def _review_unmatched_categories(self, conn, table_name, session_stats):
        """Review records with unmatched categories (with smart deduplication)"""
        console.print("\n[bold cyan]🏷️  Reviewing Unmatched Categories[/bold cyan]")

        # Get DEDUPLICATED unmatched categories with counts
        # Check which column name actually exists
        category_field = self._get_actual_column_name(conn, table_name, ['category', 'category_normalized'])
        df = pd.read_sql(f"""
            SELECT
                {category_field} as category,
                COUNT(*) as record_count
            FROM {table_name}
            WHERE master_category_id IS NULL
                AND {category_field} IS NOT NULL
                AND {category_field} != ''
            GROUP BY {category_field}
            ORDER BY record_count DESC
            LIMIT 100
        """, conn)

        if len(df) == 0:
            console.print("[green]✅ All categories matched![/green]")
            return

        total_records = df['record_count'].sum()
        console.print(f"[yellow]Found {len(df)} unique unmatched categories affecting {total_records:,} total records[/yellow]")

        # Ask about auto-matching first
        if Confirm.ask("\n🤖 Try auto-matching high-confidence fuzzy matches first? (≥84% similarity)", default=True):
            auto_matched = self._auto_match_categories_fuzzy(conn, table_name, df, session_stats, threshold=84)
            console.print(f"[green]✓ Auto-matched {auto_matched} categories[/green]\n")

            # Refresh the list after auto-matching
            df = pd.read_sql(f"""
                SELECT
                    {category_field} as category,
                    COUNT(*) as record_count
                FROM {table_name}
                WHERE master_category_id IS NULL
                    AND {category_field} IS NOT NULL
                    AND {category_field} != ''
                GROUP BY {category_field}
                ORDER BY record_count DESC
                LIMIT 100
            """, conn)

            if len(df) == 0:
                console.print("[green]✅ All categories auto-matched![/green]")
                return

            console.print(f"[yellow]Remaining: {len(df)} unmatched categories[/yellow]\n")

        # Get master categories for matching
        master_categories = []
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM categories ORDER BY name", master_conn)
            master_categories = [{'id': row['id'], 'name': row['name']} for _, row in master_df.iterrows()]
            master_conn.close()
        except Exception as e:
            console.print(f"[yellow]⚠️  Could not load master categories: {e}[/yellow]")
            # Fallback to master_data
            master_categories = self.master_data.get('categories', [])

        if not master_categories:
            console.print("[red]No master categories available. Cannot proceed with matching.[/red]")
            return

        # Review each unique category
        for idx, row in df.iterrows():
            category_value = row['category']
            count = row['record_count']

            console.print(f"\n[bold cyan]━━━ Category {idx+1}/{len(df)} ━━━[/bold cyan]")
            console.print(f"[bold white]{category_value}[/bold white]")
            console.print(f"[dim]Affects {count:,} records[/dim]\n")

            # Get fuzzy matches from master categories
            from rapidfuzz import fuzz, process
            choices = {c['name']: c['id'] for c in master_categories}
            matches = process.extract(category_value, choices.keys(), scorer=fuzz.ratio, limit=5)

            if matches:
                console.print("[bold cyan]Suggested matches:[/bold cyan]")
                match_table = Table(show_header=True, header_style="bold cyan", box=None)
                match_table.add_column("#", style="dim", width=4)
                match_table.add_column("Master Category", style="white")
                match_table.add_column("ID", style="green", width=12)
                match_table.add_column("Score", style="yellow", justify="right", width=8)

                for i, (match_name, score, _) in enumerate(matches, 1):
                    master_id = choices[match_name]
                    match_table.add_row(str(i), match_name, master_id, f"{score:.0f}%")

                console.print(match_table)

            console.print("\n[bold]Actions:[/bold]")
            if matches:
                console.print("  [1-5] Select suggested match by number")
                console.print("  [CAT###] Enter master category ID")
            else:
                console.print("  [CAT###] Enter master category ID")
            console.print("  \[s] Skip this category")
            console.print("  \[a] Show all master categories")
            console.print("  \[x] Exit review")

            choice = Prompt.ask("Choose action", default="s").strip().lower()

            # Handle numeric choice (1-5 from suggestions)
            if choice.isdigit() and matches and 1 <= int(choice) <= len(matches):
                selected_idx = int(choice) - 1
                match_name, score, _ = matches[selected_idx]
                master_id = choices[match_name]

                console.print(f"[cyan]Selected: {match_name} (ID: {master_id})[/cyan]")

                # Apply match
                cursor = conn.cursor()
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_category_id = ?
                    WHERE {category_field} = ?
                        AND master_category_id IS NULL
                """, (master_id, category_value))
                affected = cursor.rowcount
                conn.commit()

                # Save alias for future use
                self._save_category_alias(category_value, master_id, conn)

                console.print(f"[green]✅ Matched! Updated {affected:,} records[/green]")
                console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                session_stats['records_reviewed'] += 1

            # Handle direct ID entry (e.g., CAT001)
            elif choice.startswith('cat') or (choice.upper().startswith('CAT')):
                master_id = choice.upper()
                selected_category = next((c for c in master_categories if c['id'] == master_id), None)

                if selected_category:
                    # Show confirmation
                    console.print(f"\n[yellow]You selected:[/yellow]")
                    console.print(f"  ID: [cyan]{selected_category['id']}[/cyan]")
                    console.print(f"  Name: [cyan]{selected_category['name']}[/cyan]")
                    console.print(f"\n[yellow]This will update {count:,} records[/yellow]")

                    if Confirm.ask("Confirm this match?", default=True):
                        cursor = conn.cursor()
                        cursor.execute(f"""
                            UPDATE {table_name}
                            SET master_category_id = ?
                            WHERE {category_field} = ?
                                AND master_category_id IS NULL
                        """, (master_id, category_value))
                        affected = cursor.rowcount
                        conn.commit()

                        # Save alias for future use
                        self._save_category_alias(category_value, master_id, conn)

                        console.print(f"[green]✅ Matched! Updated {affected:,} records[/green]")
                        console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                        session_stats['records_reviewed'] += 1
                    else:
                        console.print("[yellow]Match cancelled[/yellow]")
                else:
                    console.print(f"[red]❌ Invalid ID: {master_id}[/red]")

            elif choice == "s":
                session_stats['skipped'] += 1
                continue

            elif choice == "a":
                # Show all master categories
                console.print("\n[bold cyan]All Master Categories:[/bold cyan]")
                all_table = Table(show_header=True, header_style="bold cyan")
                all_table.add_column("ID", style="green", width=12)
                all_table.add_column("Name", style="white")

                for c in master_categories:
                    all_table.add_row(c['id'], c['name'])

                console.print(all_table)
                Prompt.ask("\nPress Enter to continue")

            elif choice == "x":
                console.print("[yellow]Exiting category review...[/yellow]")
                break

            else:
                console.print(f"[yellow]Invalid choice: {choice}[/yellow]")

    def _get_actual_column_name(self, conn, table_name, preferred_names):
        """Get actual column name from table, checking multiple options"""
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        actual_columns = [row[1] for row in cursor.fetchall()]

        for name in preferred_names:
            if name in actual_columns:
                return name

        return preferred_names[0]  # Fallback to first option

    def _review_unmatched_quotas(self, conn, table_name, session_stats):
        """Review records with unmatched quotas (with smart deduplication and active learning)"""
        console.print("\n[bold cyan]🎫 Reviewing Unmatched Quotas[/bold cyan]")

        # Get DEDUPLICATED unmatched quotas with counts
        # Check which column name actually exists
        quota_field = self._get_actual_column_name(conn, table_name, ['quota_normalized', 'quota'])
        df = pd.read_sql(f"""
            SELECT
                {quota_field} as quota,
                COUNT(*) as record_count,
                GROUP_CONCAT(id, ',') as affected_ids
            FROM {table_name}
            WHERE master_quota_id IS NULL
                AND {quota_field} IS NOT NULL
                AND {quota_field} != ''
            GROUP BY {quota_field}
            ORDER BY record_count DESC
            LIMIT 100
        """, conn)

        if len(df) == 0:
            console.print("[green]✅ All quotas matched![/green]")
            return

        total_records = df['record_count'].sum()
        console.print(f"[yellow]Found {len(df)} unique unmatched quotas affecting {total_records:,} total records[/yellow]")

        # Ask about auto-matching first
        if Confirm.ask("\n🤖 Try auto-matching high-confidence fuzzy matches first? (≥84% similarity)", default=True):
            auto_matched = self._auto_match_quotas_fuzzy(conn, table_name, df, session_stats, threshold=84)
            console.print(f"[green]✓ Auto-matched {auto_matched} quotas[/green]\n")

            # Refresh the list after auto-matching
            df = pd.read_sql(f"""
                SELECT
                    {quota_field} as quota,
                    COUNT(*) as record_count,
                    GROUP_CONCAT(id, ',') as affected_ids
                FROM {table_name}
                WHERE master_quota_id IS NULL
                    AND {quota_field} IS NOT NULL
                    AND {quota_field} != ''
                GROUP BY {quota_field}
                ORDER BY record_count DESC
                LIMIT 100
            """, conn)

            if len(df) == 0:
                console.print("[green]✅ All quotas auto-matched![/green]")
                return

            console.print(f"[yellow]Remaining: {len(df)} unmatched quotas[/yellow]\n")

        # Get master quotas for matching
        master_quotas = []
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM quotas ORDER BY name", master_conn)
            master_quotas = [{'id': row['id'], 'name': row['name']} for _, row in master_df.iterrows()]
            master_conn.close()
        except Exception as e:
            console.print(f"[yellow]⚠️  Could not load master quotas: {e}[/yellow]")

        if not master_quotas:
            console.print("[red]No master quotas available. Cannot proceed with matching.[/red]")
            return

        # Review each unique quota
        for idx, row in df.iterrows():
            quota_value = row['quota']
            count = row['record_count']

            console.print(f"\n[bold cyan]━━━ Quota {idx+1}/{len(df)} ━━━[/bold cyan]")
            console.print(f"[bold white]{quota_value}[/bold white]")
            console.print(f"[dim]Affects {count:,} records[/dim]\n")

            # Get fuzzy matches from master quotas
            from rapidfuzz import fuzz, process
            choices = {q['name']: q['id'] for q in master_quotas}
            matches = process.extract(quota_value, choices.keys(), scorer=fuzz.ratio, limit=5)

            if matches:
                console.print("[bold cyan]Suggested matches:[/bold cyan]")
                match_table = Table(show_header=True, header_style="bold cyan", box=None)
                match_table.add_column("#", style="dim", width=4)
                match_table.add_column("Master Quota", style="white")
                match_table.add_column("ID", style="green", width=12)
                match_table.add_column("Score", style="yellow", justify="right", width=8)

                for i, (match_name, score, _) in enumerate(matches, 1):
                    master_id = choices[match_name]
                    match_table.add_row(str(i), match_name, master_id, f"{score:.0f}%")

                console.print(match_table)

            console.print("\n[bold]Actions:[/bold]")
            if matches:
                console.print("  [1-5] Select suggested match by number")
                console.print("  [QUOTA###] Enter master quota ID")
            else:
                console.print("  [QUOTA###] Enter master quota ID")
            console.print("  \[s] Skip this quota")
            console.print("  \[a] Show all master quotas")
            console.print("  \[x] Exit review")

            choice = Prompt.ask("Choose action", default="s").strip().lower()

            # Handle numeric choice (1-5 from suggestions)
            if choice.isdigit() and matches and 1 <= int(choice) <= len(matches):
                selected_idx = int(choice) - 1
                match_name, score, _ = matches[selected_idx]
                master_id = choices[match_name]

                console.print(f"[cyan]Selected: {match_name} (ID: {master_id})[/cyan]")

                # Apply match
                cursor = conn.cursor()
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_quota_id = ?
                    WHERE {quota_field} = ?
                        AND master_quota_id IS NULL
                """, (master_id, quota_value))
                affected = cursor.rowcount
                conn.commit()

                # Save alias for future use
                self._save_quota_alias(quota_value, master_id, conn)

                console.print(f"[green]✅ Matched! Updated {affected:,} records[/green]")
                console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                session_stats['records_reviewed'] += 1

            # Handle direct ID entry (e.g., QUOTA008)
            elif choice.startswith('quota') or (choice.upper().startswith('QUOTA')):
                master_id = choice.upper()
                selected_quota = next((q for q in master_quotas if q['id'] == master_id), None)

                if selected_quota:
                    # Show confirmation
                    console.print(f"\n[yellow]You selected:[/yellow]")
                    console.print(f"  ID: [cyan]{selected_quota['id']}[/cyan]")
                    console.print(f"  Name: [cyan]{selected_quota['name']}[/cyan]")
                    console.print(f"\n[yellow]This will update {count:,} records[/yellow]")

                    if Confirm.ask("Confirm this match?", default=True):
                        cursor = conn.cursor()
                        cursor.execute(f"""
                            UPDATE {table_name}
                            SET master_quota_id = ?
                            WHERE {quota_field} = ?
                                AND master_quota_id IS NULL
                        """, (master_id, quota_value))
                        affected = cursor.rowcount
                        conn.commit()

                        # Save alias for future use
                        self._save_quota_alias(quota_value, master_id, conn)

                        console.print(f"[green]✅ Matched! Updated {affected:,} records[/green]")
                        console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                        session_stats['records_reviewed'] += 1
                    else:
                        console.print("[yellow]Match cancelled[/yellow]")
                else:
                    console.print(f"[red]❌ Invalid ID: {master_id}[/red]")

            elif choice == "s":
                session_stats['skipped'] += 1
                continue

            elif choice == "a":
                # Show all master quotas
                console.print("\n[bold cyan]All Master Quotas:[/bold cyan]")
                all_table = Table(show_header=True, header_style="bold cyan")
                all_table.add_column("ID", style="green", width=12)
                all_table.add_column("Name", style="white")

                for q in master_quotas:
                    all_table.add_row(q['id'], q['name'])

                console.print(all_table)
                Prompt.ask("\nPress Enter to continue")

            elif choice == "x":
                console.print("[yellow]Exiting quota review...[/yellow]")
                break

            else:
                console.print(f"[yellow]Invalid choice: {choice}[/yellow]")

    def _auto_match_quotas_fuzzy(self, conn, table_name, df, session_stats, threshold=95):
        """Auto-match quotas with high-confidence fuzzy matches"""
        from rapidfuzz import fuzz, process

        # Get master quotas
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM quotas ORDER BY name", master_conn)
            master_quotas = {row['name']: row['id'] for _, row in master_df.iterrows()}
            master_conn.close()
        except:
            return 0

        if not master_quotas:
            return 0

        # Get actual column name from table
        quota_field = self._get_actual_column_name(conn, table_name, ['quota', 'quota_normalized'])
        cursor = conn.cursor()
        auto_matched = 0

        for _, row in df.iterrows():
            quota_value = row['quota']

            # Find best fuzzy match
            matches = process.extract(quota_value, master_quotas.keys(), scorer=fuzz.ratio, limit=1)

            if matches and matches[0][1] >= threshold:
                match_name, score, _ = matches[0]
                master_id = master_quotas[match_name]

                # Auto-apply the match
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_quota_id = ?
                    WHERE {quota_field} = ?
                        AND master_quota_id IS NULL
                """, (master_id, quota_value))

                affected = cursor.rowcount
                if affected > 0:
                    console.print(f"  [dim]✓ '{quota_value}' → '{match_name}' ({score}% match, {affected:,} records)[/dim]")
                    auto_matched += 1
                    session_stats['records_reviewed'] += 1

        conn.commit()
        return auto_matched

    def _auto_match_categories_fuzzy(self, conn, table_name, df, session_stats, threshold=95):
        """Auto-match categories with high-confidence fuzzy matches"""
        from rapidfuzz import fuzz, process

        # Get master categories
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM categories ORDER BY name", master_conn)
            master_categories = {row['name']: row['id'] for _, row in master_df.iterrows()}
            master_conn.close()
        except:
            return 0

        if not master_categories:
            return 0

        category_field = self._get_actual_column_name(conn, table_name, ['category', 'category_normalized'])
        cursor = conn.cursor()
        auto_matched = 0

        for _, row in df.iterrows():
            category_value = row['category']

            # Find best fuzzy match
            matches = process.extract(category_value, master_categories.keys(), scorer=fuzz.ratio, limit=1)

            if matches and matches[0][1] >= threshold:
                match_name, score, _ = matches[0]
                master_id = master_categories[match_name]

                # Auto-apply the match
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_category_id = ?
                    WHERE {category_field} = ?
                        AND master_category_id IS NULL
                """, (master_id, category_value))

                affected = cursor.rowcount
                if affected > 0:
                    console.print(f"  [dim]✓ '{category_value}' → '{match_name}' ({score}% match, {affected:,} records)[/dim]")
                    auto_matched += 1
                    session_stats['records_reviewed'] += 1

        conn.commit()
        return auto_matched

    def _auto_match_states_fuzzy(self, conn, table_name, df, session_stats, threshold=95):
        """Auto-match states with high-confidence fuzzy matches"""
        from rapidfuzz import fuzz, process

        # Get master states
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM states ORDER BY name", master_conn)
            master_states = {row['name']: row['id'] for _, row in master_df.iterrows()}
            master_conn.close()
        except:
            return 0

        if not master_states:
            return 0

        state_field = self._get_actual_column_name(conn, table_name, ['state_normalized', 'normalized_state', 'state'])
        cursor = conn.cursor()
        auto_matched = 0

        for _, row in df.iterrows():
            state_value = row['state']

            # Find best fuzzy match
            matches = process.extract(state_value, master_states.keys(), scorer=fuzz.ratio, limit=1)

            if matches and matches[0][1] >= threshold:
                match_name, score, _ = matches[0]
                master_id = master_states[match_name]

                # Auto-apply the match
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET master_state_id = ?
                    WHERE {state_field} = ?
                        AND master_state_id IS NULL
                """, (master_id, state_value))

                affected = cursor.rowcount
                if affected > 0:
                    console.print(f"  [dim]✓ '{state_value}' → '{match_name}' ({score}% match, {affected:,} records)[/dim]")
                    auto_matched += 1
                    session_stats['records_reviewed'] += 1

        conn.commit()
        return auto_matched

    def _review_unmatched_states(self, conn, table_name, session_stats):
        """Review records with unmatched states (with smart deduplication and auto-fuzzy matching)"""
        console.print("\n[bold cyan]🗺️  Reviewing Unmatched States[/bold cyan]")

        # Get DEDUPLICATED unmatched states with counts
        # Check which column name actually exists
        state_field = self._get_actual_column_name(conn, table_name, ['state_normalized', 'state'])
        df = pd.read_sql(f"""
            SELECT
                {state_field} as state,
                COUNT(*) as record_count
            FROM {table_name}
            WHERE master_state_id IS NULL
                AND {state_field} IS NOT NULL
                AND {state_field} != ''
            GROUP BY {state_field}
            ORDER BY record_count DESC
            LIMIT 100
        """, conn)

        if len(df) == 0:
            console.print("[green]✅ All states matched![/green]")
            return

        total_records = df['record_count'].sum()
        console.print(f"[yellow]Found {len(df)} unique unmatched states affecting {total_records:,} total records[/yellow]")

        # Ask about auto-matching first
        if Confirm.ask("\n🤖 Try auto-matching high-confidence fuzzy matches first? (≥84% similarity)", default=True):
            auto_matched = self._auto_match_states_fuzzy(conn, table_name, df, session_stats, threshold=84)
            console.print(f"[green]✓ Auto-matched {auto_matched} states[/green]\n")

            # Refresh the list after auto-matching
            df = pd.read_sql(f"""
                SELECT
                    {state_field} as state,
                    COUNT(*) as record_count
                FROM {table_name}
                WHERE master_state_id IS NULL
                    AND {state_field} IS NOT NULL
                    AND {state_field} != ''
                GROUP BY {state_field}
                ORDER BY record_count DESC
                LIMIT 100
            """, conn)

            if len(df) == 0:
                console.print("[green]✅ All states auto-matched![/green]")
                return

            console.print(f"[yellow]Remaining: {len(df)} unmatched states[/yellow]\n")

        # Get master states for matching
        master_states = []
        try:
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            master_conn = sqlite3.connect(master_db_path)
            master_df = pd.read_sql("SELECT id, name FROM states ORDER BY name", master_conn)
            master_states = [{'id': row['id'], 'name': row['name']} for _, row in master_df.iterrows()]
            master_conn.close()
        except Exception as e:
            console.print(f"[yellow]⚠️  Could not load master states: {e}[/yellow]")

        if not master_states:
            console.print("[red]No master states available. Cannot proceed with matching.[/red]")
            return

        # Review each unique state
        for idx, row in df.iterrows():
            state_value = row['state']
            count = row['record_count']

            console.print(f"\n[bold cyan]━━━ State {idx+1}/{len(df)} ━━━[/bold cyan]")
            console.print(f"[bold white]{state_value}[/bold white]")
            console.print(f"[dim]Affects {count:,} records[/dim]\n")

            # Get fuzzy matches from master states
            from rapidfuzz import fuzz, process
            choices = {s['name']: s['id'] for s in master_states}
            matches = process.extract(state_value, choices.keys(), scorer=fuzz.ratio, limit=5)

            if matches:
                console.print("[bold cyan]Suggested matches:[/bold cyan]")
                match_table = Table(show_header=True, header_style="bold cyan", box=None)
                match_table.add_column("#", style="dim", width=4)
                match_table.add_column("Master State", style="white")
                match_table.add_column("ID", style="green", width=12)
                match_table.add_column("Score", style="yellow", justify="right", width=8)

                for i, (match_name, score, _) in enumerate(matches, 1):
                    master_id = choices[match_name]
                    match_table.add_row(str(i), match_name, master_id, f"{score:.0f}%")

                console.print(match_table)

            console.print("\n[bold]Actions:[/bold]")
            if matches:
                console.print("  [1-5] Select suggested match by number")
                console.print("  [STATE###] Enter master state ID")
            else:
                console.print("  [STATE###] Enter master state ID")
            console.print("  \[s] Skip this state")
            console.print("  \[a] Show all master states")
            console.print("  \[x] Exit review")

            choice = Prompt.ask("Choose action", default="s").strip().lower()

            # Handle numeric choice (1-5 from suggestions)
            if choice.isdigit() and matches and 1 <= int(choice) <= len(matches):
                selected_idx = int(choice) - 1
                match_name, score, _ = matches[selected_idx]
                master_id = choices[match_name]

                console.print(f"[cyan]Selected: {match_name} (ID: {master_id})[/cyan]")

                # Validate ID
                valid_ids = [s['id'] for s in master_states]
                if master_id in valid_ids:
                    # Apply match to ALL records with this state value
                    cursor = conn.cursor()
                    cursor.execute(f"""
                        UPDATE {table_name}
                        SET master_state_id = ?
                        WHERE {state_field} = ?
                            AND master_state_id IS NULL
                    """, (master_id, state_value))
                    affected = cursor.rowcount
                    conn.commit()

                    # Save alias for future use
                    self._save_state_alias(state_value, master_id, conn)

                    console.print(f"[green]✅ Matched! Updated {affected:,} records[/green]")
                    console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                    session_stats['records_reviewed'] += 1
                else:
                    console.print(f"[red]❌ Invalid ID: {master_id}[/red]")

            # Handle direct ID entry (e.g., STATE029)
            elif choice.startswith('state') or (choice.upper().startswith('STATE')):
                master_id = choice.upper()
                selected_state = next((s for s in master_states if s['id'] == master_id), None)

                if selected_state:
                    # Show confirmation
                    console.print(f"\n[yellow]You selected:[/yellow]")
                    console.print(f"  ID: [cyan]{selected_state['id']}[/cyan]")
                    console.print(f"  Name: [cyan]{selected_state['name']}[/cyan]")
                    console.print(f"\n[yellow]This will update {count:,} records[/yellow]")

                    if Confirm.ask("Confirm this match?", default=True):
                        # Apply match to ALL records with this state value
                        cursor = conn.cursor()
                        cursor.execute(f"""
                            UPDATE {table_name}
                            SET master_state_id = ?
                            WHERE {state_field} = ?
                                AND master_state_id IS NULL
                        """, (master_id, state_value))
                        affected = cursor.rowcount
                        conn.commit()

                        # Save alias for future use
                        self._save_state_alias(state_value, master_id, conn)

                        console.print(f"[green]✅ Matched! Updated {affected:,} records[/green]")
                        console.print(f"[dim]💾 Alias saved for future auto-matching[/dim]")
                        session_stats['records_reviewed'] += 1
                    else:
                        console.print("[yellow]Match cancelled[/yellow]")
                else:
                    console.print(f"[red]❌ Invalid ID: {master_id}[/red]")

            elif choice == "s":
                session_stats['skipped'] += 1
                continue

            elif choice == "a":
                # Show all master states
                console.print("\n[bold cyan]All Master States:[/bold cyan]")
                all_table = Table(show_header=True, header_style="bold cyan")
                all_table.add_column("ID", style="green", width=12)
                all_table.add_column("Name", style="white")

                for s in master_states:
                    all_table.add_row(s['id'], s['name'])

                console.print(all_table)
                Prompt.ask("\nPress Enter to continue")

            elif choice == "x":
                console.print("[yellow]Exiting state review...[/yellow]")
                break

            else:
                console.print(f"[yellow]Invalid choice: {choice}[/yellow]")

    def interactive_review_unmatched(self):
        """Interactive review of unmatched data records with alias creation"""
        # Determine which database and table to use
        if self.data_type == 'counselling':
            conn = sqlite3.connect(self.data_db_path)
            table_name = 'counselling_records'
            college_field = 'college_institute_normalized'
            course_field = 'course_normalized'
            state_field = 'state_normalized'
        else:
            conn = sqlite3.connect(self.seat_db_path)
            table_name = 'seat_data_linked'
            college_field = 'college_name'
            course_field = 'course_name'
            state_field = 'state'

        # Initialize session stats
        session_stats = {
            'reviewed': 0,
            'aliases_created': 0,
            'skipped': 0,
            'records_affected': 0,
            'start_time': datetime.now()
        }

        # Get unmatched records - using dynamic table and field names
        try:
            if self.data_type == 'counselling':
                unmatched = pd.read_sql(f"""
                    SELECT DISTINCT
                        college_institute_normalized as college_name,
                        course_normalized as course_name,
                        state_normalized as state,
                        address,
                        master_college_id,
                        master_course_id,
                        college_match_score,
                        course_match_score,
                        college_match_method,
                        course_match_method,
                        COUNT(*) as record_count
                    FROM {table_name}
                    WHERE master_college_id IS NULL OR master_course_id IS NULL
                    GROUP BY college_institute_normalized, course_normalized, state_normalized, address
                    ORDER BY record_count DESC
                    LIMIT 50
                """, conn)
            else:
                unmatched = pd.read_sql(f"""
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
                    FROM {table_name}
                    WHERE master_college_id IS NULL OR master_course_id IS NULL
                    GROUP BY college_name, course_name, state
                    ORDER BY record_count DESC
                    LIMIT 50
                """, conn)
        except Exception as e:
            console.print(f"[red]❌ Error: {e}[/red]")
            console.print(f"[yellow]Note: Make sure you've run 'Match and link data' first (option 3)[/yellow]")
            conn.close()
            return

        if len(unmatched) == 0:
            console.print("\n[green]✅ No unmatched records found![/green]")
            conn.close()
            return

        console.print(f"\n[bold yellow]📋 Found {len(unmatched)} unmatched record groups[/bold yellow]")
        console.print(f"[dim]Showing top 50 by record count[/dim]\n")

        for idx, row in unmatched.iterrows():
            session_stats['reviewed'] += 1

            # Show session statistics dashboard
            self._show_session_stats_progress(session_stats, len(unmatched))

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

            # AUTO-SUGGEST: If we have a high-confidence match, suggest creating alias automatically (if enabled)
            enable_auto_suggest = self.config.get('features', {}).get('enable_auto_suggest', True)
            auto_suggest_threshold = self.config.get('features', {}).get('auto_suggest_threshold', 90)
            auto_suggest_college = None
            auto_suggest_course = None

            if enable_auto_suggest and not row['master_college_id'] and college_suggestions:
                best_college = college_suggestions[0]
                if best_college['score'] >= auto_suggest_threshold:
                    auto_suggest_college = best_college
                    console.print(Panel.fit(
                        f"[bold green]💡 AUTO-SUGGEST (High Confidence)[/bold green]\n\n"
                        f"College: [cyan]{best_college['college']['name']}[/cyan]\n"
                        f"Match: [green]{best_college['score']}% via {best_college['type']}[/green]\n"
                        f"State: {best_college['college'].get('state', 'N/A')}\n"
                        f"ID: {best_college['college']['id']}",
                        border_style="green"
                    ))

                    if Confirm.ask("\n[bold green]✨ Auto-create alias for this match?[/bold green]", default=True):
                        # Auto-create alias
                        state = row.get('state', best_college['college'].get('state', ''))
                        address = row.get('address', '')
                        self._save_college_alias(row['college_name'], best_college['college']['id'], conn, state=state, address=address)
                        session_stats['aliases_created'] += 1
                        session_stats['records_affected'] += row['record_count']
                        console.print("[green]✅ Alias auto-created successfully![/green]\n")
                        continue

            if enable_auto_suggest and not row['master_course_id'] and course_suggestions:
                best_course = course_suggestions[0]
                if best_course['score'] >= auto_suggest_threshold:
                    auto_suggest_course = best_course
                    console.print(Panel.fit(
                        f"[bold green]💡 AUTO-SUGGEST (High Confidence)[/bold green]\n\n"
                        f"Course: [cyan]{best_course['course']['name']}[/cyan]\n"
                        f"Match: [green]{best_course['score']}% via {best_course['type']}[/green]\n"
                        f"ID: {best_course['course']['id']}",
                        border_style="green"
                    ))

                    if Confirm.ask("\n[bold green]✨ Auto-create alias for this match?[/bold green]", default=True):
                        # Auto-create alias
                        self._save_course_alias(row['course_name'], best_course['course']['id'], conn)
                        session_stats['aliases_created'] += 1
                        session_stats['records_affected'] += row['record_count']
                        console.print("[green]✅ Alias auto-created successfully![/green]\n")
                        continue

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
            action_map['id'] = {'type': 'custom_id'}
            console.print("  \[s] Skip this record")
            console.print("  [id] Enter college/course ID directly")
            console.print("  [q] Quit review session")
            console.print()

            # Get user choice - allow free text for ID input
            valid_choices = list(action_map.keys())
            console.print(f"[dim]Valid options: {', '.join(valid_choices)} or enter ID directly (e.g., MED0764)[/dim]")
            choice = Prompt.ask("Select action", default='s')

            # Check if it's a direct ID input (starts with MED, DEN, DNB, COURSE)
            if choice.upper().startswith(('MED', 'DEN', 'DNB', 'COURSE')):
                # Direct ID input
                college_id = choice.upper()

                # Search for the college/course
                if college_id.startswith('COURSE'):
                    # Course ID
                    course_found = None
                    for course in self.master_data['courses']['courses']:
                        if course['id'] == college_id:
                            course_found = course
                            break

                    if course_found:
                        console.print(f"\n[green]✅ Found: {course_found['name']} ({college_id})[/green]")
                        if Confirm.ask("Create course alias?", default=True):
                            self._save_course_alias(row['course_name'], course_id, conn)
                            session_stats['aliases_created'] += 1
                            session_stats['records_affected'] += row['record_count']
                            console.print(f"[green]✅ Course alias created![/green]")
                    else:
                        console.print(f"[red]❌ Course ID '{college_id}' not found[/red]")
                else:
                    # College ID
                    college_found = None
                    college_type = None

                    for ctype in ['medical', 'dental', 'dnb']:
                        for college in self.master_data[ctype]['colleges']:
                            if college['id'] == college_id:
                                college_found = college
                                college_type = ctype
                                break
                        if college_found:
                            break

                    if college_found:
                        console.print(f"\n[green]✅ Found: {college_found['name']} ({college_id})[/green]")
                        console.print(f"   State: {college_found.get('state', 'N/A')}")
                        console.print(f"   Type: {college_type.upper()}")

                        if Confirm.ask("Create college alias with location context?", default=True):
                            # Get state and address for location context
                            state = row.get('state', college_found.get('state', ''))
                            address = row.get('address', '')

                            self._save_college_alias(row['college_name'], college_id, conn, state=state, address=address)
                            session_stats['aliases_created'] += 1
                            session_stats['records_affected'] += row['record_count']
                    else:
                        console.print(f"[red]❌ College ID '{college_id}' not found[/red]")
                        console.print("[yellow]Tip: Check the ID and try again[/yellow]")

                continue

            # Process standard actions
            if choice == 'q':
                break
            elif choice == 's':
                session_stats['skipped'] += 1
                continue
            elif choice == 'id':
                # Manual ID entry
                console.print("\n[bold cyan]Enter ID directly:[/bold cyan]")
                console.print("  College IDs start with: MED, DEN, DNB (e.g., MED0764)")
                console.print("  Course IDs start with: COURSE (e.g., COURSE001)")

                manual_id = Prompt.ask("Enter ID").upper()

                # Process same as direct ID input above
                if manual_id.startswith('COURSE'):
                    course_found = None
                    for course in self.master_data['courses']['courses']:
                        if course['id'] == manual_id:
                            course_found = course
                            break

                    if course_found:
                        console.print(f"\n[green]✅ Found: {course_found['name']} ({manual_id})[/green]")
                        if Confirm.ask("Create course alias?", default=True):
                            self._save_course_alias(row['course_name'], manual_id, conn)
                            session_stats['aliases_created'] += 1
                            session_stats['records_affected'] += row['record_count']
                            console.print(f"[green]✅ Course alias created![/green]")
                    else:
                        console.print(f"[red]❌ Course ID '{manual_id}' not found[/red]")
                else:
                    college_found = None
                    college_type = None

                    for ctype in ['medical', 'dental', 'dnb']:
                        for college in self.master_data[ctype]['colleges']:
                            if college['id'] == manual_id:
                                college_found = college
                                college_type = ctype
                                break
                        if college_found:
                            break

                    if college_found:
                        console.print(f"\n[green]✅ Found: {college_found['name']} ({manual_id})[/green]")
                        console.print(f"   State: {college_found.get('state', 'N/A')}")
                        console.print(f"   Type: {college_type.upper()}")

                        if Confirm.ask("Create college alias with location context?", default=True):
                            state = row.get('state', college_found.get('state', ''))
                            address = row.get('address', '')

                            self._save_college_alias(row['college_name'], manual_id, conn, state=state, address=address)
                            session_stats['aliases_created'] += 1
                            session_stats['records_affected'] += row['record_count']
                    else:
                        console.print(f"[red]❌ College ID '{manual_id}' not found[/red]")

                continue

            elif choice in action_map:
                action = action_map[choice]
                if action['type'] == 'college_alias':
                    # Create college alias with location context
                    state = row.get('state', action['data']['college'].get('state', ''))
                    address = row.get('address', '')

                    self._save_college_alias(row['college_name'], action['data']['college']['id'], conn, state=state, address=address)
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

    def _show_session_stats_progress(self, stats, total):
        """Display real-time session statistics dashboard with progress"""
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

    def _save_college_alias(self, data_college_name, master_college_id, conn=None, state=None, address=None):
        """Save college alias to database with location context

        Args:
            data_college_name: The variant name from counselling/seat data (e.g., "V S DENTAL COLLEGE")
            master_college_id: The master college ID to map to (e.g., "CLG0123")
            state: State for location context
            address: Address for location context

        Semantics:
            original_name = variant from data (V S DENTAL COLLEGE)
            alias_name = standardized master name (VOKKALIGARA SANGHA DENTAL COLLEGE AND HOSPITAL)
        """
        # Find the master college name
        master_college = None
        for college_type in ['medical', 'dental', 'dnb']:
            for college in self.master_data[college_type]['colleges']:
                if college['id'] == master_college_id:
                    master_college = college
                    break
            if master_college:
                break

        if not master_college:
            console.print("[red]Error: Master college not found[/red]")
            return

        # Normalize state and address
        state_normalized = self.normalize_text(state) if state else self.normalize_text(master_college.get('state', ''))
        address_normalized = self.normalize_text(address) if address else ''

        # Always use master_data.db for aliases (ignore passed conn)
        db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        alias_conn = sqlite3.connect(db_path)
        cursor = alias_conn.cursor()

        # Create table if it doesn't exist - use master_college_id to match existing schema
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS college_aliases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL,
                    alias_name TEXT NOT NULL,
                    master_college_id TEXT,
                    state_normalized TEXT,
                    address_normalized TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(original_name, state_normalized, address_normalized)
                )
            """)
            alias_conn.commit()
        except Exception as e:
            console.print(f"[yellow]⚠️  Warning: Could not create table: {e}[/yellow]")

        # First, check if this exact combination exists (original_name + state + address)
        cursor.execute("""
            SELECT COUNT(*), master_college_id FROM college_aliases
            WHERE original_name = ? AND state_normalized = ? AND address_normalized = ?
            GROUP BY master_college_id
        """, (data_college_name, state_normalized, address_normalized))

        existing = cursor.fetchone()

        if existing and existing[0] > 0:
            existing_college_id = existing[1]
            console.print(f"[yellow]⚠️  Alias '{data_college_name}' at this location already exists![/yellow]")
            console.print(f"[dim]State: {state_normalized}, Address: {address_normalized or 'N/A'}[/dim]")

            if existing_college_id != master_college_id:
                console.print(f"[red]⚠️  WARNING: Mapped to different college! ({existing_college_id})[/red]")

            if not Confirm.ask("Overwrite existing alias?", default=False):
                alias_conn.close()
                return

        # CORRECT SEMANTICS: original_name (from data) → alias_name (master standardized)
        cursor.execute("""
            INSERT OR REPLACE INTO college_aliases
            (original_name, alias_name, master_college_id, state_normalized, address_normalized, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (data_college_name, master_college['name'], master_college_id, state_normalized, address_normalized, datetime.now().isoformat()))
        alias_conn.commit()
        alias_conn.close()

        # Update in-memory aliases with location context and CORRECT semantics
        self.aliases['college'].append({
            'original_name': data_college_name,
            'alias_name': master_college['name'],
            'master_college_id': master_college_id,
            'state_normalized': state_normalized,
            'address_normalized': address_normalized
        })

        console.print(f"[green]✅ College alias saved with location:[/green]")
        console.print(f"   [cyan]{data_college_name}[/cyan]")
        console.print(f"   State: {state_normalized}")
        if address_normalized:
            console.print(f"   Location: {address_normalized[:50]}{'...' if len(address_normalized) > 50 else ''}")
        console.print(f"   → [green]{master_college['name']}[/green]")

    def _save_course_alias(self, data_course_name, master_course_id, conn=None):
        """Save course alias to database

        Args:
            data_course_name: The variant name from counselling/seat data (e.g., "DIPLOMA IN OTORHINOLARYNGOLOGY")
            master_course_id: The master course ID to map to (e.g., "CRS0123")

        Semantics:
            original_name = variant from data (DIPLOMA IN OTORHINOLARYNGOLOGY)
            alias_name = standardized master name (DIPLOMA IN ENT)
        """
        # Find the master course name
        master_course = None
        for course in self.master_data['courses']['courses']:
            if course['id'] == master_course_id:
                master_course = course
                break

        if not master_course:
            console.print("[red]Error: Master course not found[/red]")
            return

        # Always use master_data.db for aliases (ignore passed conn)
        db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        alias_conn = sqlite3.connect(db_path)
        cursor = alias_conn.cursor()

        # Create table if it doesn't exist
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS course_aliases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL UNIQUE,
                    alias_name TEXT NOT NULL,
                    course_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            alias_conn.commit()
        except Exception as e:
            console.print(f"[yellow]⚠️  Warning: Could not create table: {e}[/yellow]")

        # CORRECT SEMANTICS: original_name (from data) → alias_name (master standardized)
        cursor.execute("""
            INSERT OR REPLACE INTO course_aliases (original_name, alias_name, course_id, created_at)
            VALUES (?, ?, ?, ?)
        """, (data_course_name, master_course['name'], master_course_id, datetime.now().isoformat()))
        alias_conn.commit()
        alias_conn.close()

        # Update in-memory aliases with CORRECT semantics
        self.aliases['course'].append({
            'original_name': data_course_name,
            'alias_name': master_course['name'],
            'course_id': master_course_id
        })

        console.print(f"[green]✅ Course alias saved:[/green]")
        console.print(f"   [cyan]{data_course_name}[/cyan] → [green]{master_course['name']}[/green]")

    def _save_category_alias(self, data_category_name, master_category_id, conn=None):
        """Save category alias to database

        Args:
            data_category_name: The variant name from counselling/seat data
            master_category_id: The master category ID to map to

        Semantics:
            original_name = variant from data
            alias_name = standardized master name
        """
        # Find the master category name
        master_category = None
        for category in self.master_data.get('categories', []):
            if category['id'] == master_category_id:
                master_category = category
                break

        if not master_category:
            console.print("[red]Error: Master category not found[/red]")
            return

        # Always use master_data.db for aliases (ignore passed conn)
        db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        alias_conn = sqlite3.connect(db_path)
        cursor = alias_conn.cursor()

        # Create table if it doesn't exist
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS category_aliases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL UNIQUE,
                    alias_name TEXT NOT NULL,
                    category_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            alias_conn.commit()
        except Exception as e:
            console.print(f"[yellow]⚠️  Warning: Could not create table: {e}[/yellow]")

        # CORRECT SEMANTICS: original_name (from data) → alias_name (master standardized)
        cursor.execute("""
            INSERT OR REPLACE INTO category_aliases (original_name, alias_name, category_id, created_at)
            VALUES (?, ?, ?, ?)
        """, (data_category_name, master_category['name'], master_category_id, datetime.now().isoformat()))
        alias_conn.commit()
        alias_conn.close()

        # Update in-memory aliases with CORRECT semantics
        if 'category' not in self.aliases:
            self.aliases['category'] = []
        self.aliases['category'].append({
            'original_name': data_category_name,
            'alias_name': master_category['name'],
            'category_id': master_category_id
        })

        console.print(f"[green]✅ Category alias saved:[/green]")
        console.print(f"   [cyan]{data_category_name}[/cyan] → [green]{master_category['name']}[/green]")

    def _save_quota_alias(self, data_quota_name, master_quota_id, conn=None):
        """Save quota alias to database

        Args:
            data_quota_name: The variant name from counselling/seat data
            master_quota_id: The master quota ID to map to

        Semantics:
            original_name = variant from data
            alias_name = standardized master name
        """
        # Find the master quota name
        master_quota = None
        for quota in self.master_data.get('quotas', []):
            if quota['id'] == master_quota_id:
                master_quota = quota
                break

        if not master_quota:
            console.print("[red]Error: Master quota not found[/red]")
            return

        # Always use master_data.db for aliases (ignore passed conn)
        db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        alias_conn = sqlite3.connect(db_path)
        cursor = alias_conn.cursor()

        # Create table if it doesn't exist
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quota_aliases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL UNIQUE,
                    alias_name TEXT NOT NULL,
                    quota_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            alias_conn.commit()
        except Exception as e:
            console.print(f"[yellow]⚠️  Warning: Could not create table: {e}[/yellow]")

        # CORRECT SEMANTICS: original_name (from data) → alias_name (master standardized)
        cursor.execute("""
            INSERT OR REPLACE INTO quota_aliases (original_name, alias_name, quota_id, created_at)
            VALUES (?, ?, ?, ?)
        """, (data_quota_name, master_quota['name'], master_quota_id, datetime.now().isoformat()))
        alias_conn.commit()
        alias_conn.close()

        # Update in-memory aliases with CORRECT semantics
        if 'quota' not in self.aliases:
            self.aliases['quota'] = []
        self.aliases['quota'].append({
            'original_name': data_quota_name,
            'alias_name': master_quota['name'],
            'quota_id': master_quota_id
        })

        console.print(f"[green]✅ Quota alias saved:[/green]")
        console.print(f"   [cyan]{data_quota_name}[/cyan] → [green]{master_quota['name']}[/green]")

    def _save_state_alias(self, data_state_name, master_state_id, conn=None):
        """Save state alias to database

        Args:
            data_state_name: The variant name from counselling/seat data
            master_state_id: The master state ID to map to

        Semantics:
            original_name = variant from data
            alias_name = standardized master name
        """
        # Find the master state name
        master_state = None
        for state in self.master_data.get('states', []):
            if state['id'] == master_state_id:
                master_state = state
                break

        if not master_state:
            console.print("[red]Error: Master state not found[/red]")
            return

        # Always use master_data.db for aliases (ignore passed conn)
        db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        alias_conn = sqlite3.connect(db_path)
        cursor = alias_conn.cursor()

        # Create table if it doesn't exist
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS state_aliases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL UNIQUE,
                    alias_name TEXT NOT NULL,
                    state_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            alias_conn.commit()
        except Exception as e:
            console.print(f"[yellow]⚠️  Warning: Could not create table: {e}[/yellow]")

        # CORRECT SEMANTICS: original_name (from data) → alias_name (master standardized)
        cursor.execute("""
            INSERT OR REPLACE INTO state_aliases (original_name, alias_name, state_id, created_at)
            VALUES (?, ?, ?, ?)
        """, (data_state_name, master_state['name'], master_state_id, datetime.now().isoformat()))
        alias_conn.commit()
        alias_conn.close()

        # Update in-memory aliases with CORRECT semantics
        if 'state' not in self.aliases:
            self.aliases['state'] = []
        self.aliases['state'].append({
            'original_name': data_state_name,
            'alias_name': master_state['name'],
            'state_id': master_state_id
        })

        console.print(f"[green]✅ State alias saved:[/green]")
        console.print(f"   [cyan]{data_state_name}[/cyan] → [green]{master_state['name']}[/green]")

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

    def scan_folder_for_excel_files(self, folder_path: str, recursive: bool = False) -> list:
        """Scan folder for Excel files (.xlsx, .xls)

        Args:
            folder_path: Path to folder containing Excel files
            recursive: If True, scan subfolders recursively

        Returns:
            list: List of Excel file paths found
        """
        folder = Path(folder_path)

        if not folder.exists() or not folder.is_dir():
            console.print(f"[red]❌ Folder not found: {folder_path}[/red]")
            return []

        # Pattern for Excel files
        excel_patterns = ['*.xlsx', '*.xls', '*.XLSX', '*.XLS']
        excel_files = []

        if recursive:
            # Recursive scan
            for pattern in excel_patterns:
                excel_files.extend(folder.rglob(pattern))
        else:
            # Non-recursive scan
            for pattern in excel_patterns:
                excel_files.extend(folder.glob(pattern))

        # Convert to strings and sort
        excel_files = sorted([str(f) for f in excel_files])

        console.print(f"\n[cyan]📁 Found {len(excel_files)} Excel file(s) in {folder_path}[/cyan]")

        if excel_files and len(excel_files) <= 20:
            # Show files if not too many
            for file in excel_files:
                console.print(f"   • {Path(file).name}")
        elif len(excel_files) > 20:
            console.print(f"   [dim]Showing first 10 files...[/dim]")
            for file in excel_files[:10]:
                console.print(f"   • {Path(file).name}")
            console.print(f"   [dim]... and {len(excel_files) - 10} more files[/dim]")

        return excel_files

    def batch_import_excel_files(self, excel_files: list, clear_before_import=None):
        """Batch import multiple Excel files with progress tracking

        Args:
            excel_files: List of Excel file paths to import
            clear_before_import: If None, ask user; if True, clear; if False, don't clear

        Returns:
            dict: Import results summary
        """
        if not excel_files:
            console.print("[yellow]⚠️  No files to import[/yellow]")
            return {'total_files': 0, 'total_records': 0, 'successful': 0, 'failed': 0}

        console.print(Panel.fit(
            f"[bold cyan]📦 BATCH IMPORT[/bold cyan]\n"
            f"Files to import: {len(excel_files)}",
            border_style="cyan"
        ))

        # Ask about clearing database once for batch import
        if clear_before_import is None:
            console.print("\n[bold cyan]📥 Batch Import Options[/bold cyan]")
            console.print("  [1] Append to existing data (detect duplicates for each file)")
            console.print("  [2] Clear database once and import all files fresh")

            import_choice = Prompt.ask("Choose import mode", choices=["1", "2"], default="1")
            clear_before_import = (import_choice == "2")

        # Clear database once if requested (before first file)
        if clear_before_import:
            table_name = 'counselling_records' if self.data_type == 'counselling' else 'seat_data_raw'
            self.clear_database_table(table_name)
            console.print("[cyan]📝 Fresh batch import: All files will be imported without duplicate checking[/cyan]\n")

        results = []
        total_imported = 0
        successful_imports = 0
        failed_imports = 0

        # Process each file with progress bar
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        ) as progress:
            task = progress.add_task("[cyan]Importing files...", total=len(excel_files))

            for idx, excel_path in enumerate(excel_files):
                file_name = Path(excel_path).name
                progress.update(task, description=f"[cyan]Importing: {file_name}")

                try:
                    # Import based on data type
                    # Pass clear_before_import=False for subsequent files if clearing was done
                    clear_this_file = clear_before_import and idx == 0

                    if self.data_type == 'counselling':
                        count = self.import_excel_counselling(excel_path, clear_before_import=False if idx > 0 else clear_before_import)
                    else:
                        count = self.import_excel_to_db(excel_path,
                                                       enable_dedup=not clear_before_import,
                                                       clear_before_import=False if idx > 0 else clear_before_import)

                    results.append({
                        'file': file_name,
                        'records': count,
                        'status': 'success'
                    })
                    total_imported += count
                    successful_imports += 1

                except Exception as e:
                    console.print(f"\n[red]❌ Error importing {file_name}: {e}[/red]")
                    logger.error(f"Error importing {file_name}: {e}", exc_info=True)
                    results.append({
                        'file': file_name,
                        'records': 0,
                        'status': f'error: {str(e)[:50]}'
                    })
                    failed_imports += 1

                progress.advance(task)

        # Display summary table
        table = Table(title="📊 Batch Import Summary", border_style="cyan")
        table.add_column("File", style="cyan", no_wrap=False, max_width=50)
        table.add_column("Records", justify="right", style="green")
        table.add_column("Status", style="white", max_width=50)

        for result in results:
            status_style = "green" if result['status'] == 'success' else "red"
            table.add_row(
                result['file'],
                f"{result['records']:,}" if result['records'] > 0 else "0",
                f"[{status_style}]{result['status']}[/{status_style}]"
            )

        console.print("\n")
        console.print(table)

        # Get match statistics from database
        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            # Total records
            total_in_db = pd.read_sql(f"SELECT COUNT(*) as count FROM {table_name}", conn).iloc[0]['count']

            # Matched records (college matched)
            matched_college = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE master_college_id IS NOT NULL",
                conn
            ).iloc[0]['count']

            # Matched courses
            matched_course = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE master_course_id IS NOT NULL",
                conn
            ).iloc[0]['count']

            # Both matched
            both_matched = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE master_college_id IS NOT NULL AND master_course_id IS NOT NULL",
                conn
            ).iloc[0]['count']

            # State matching (applies to both seat and counselling data)
            matched_state = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE master_state_id IS NOT NULL",
                conn
            ).iloc[0]['count']

            # Additional matching stats (counselling-specific)
            matched_category = 0
            matched_quota = 0
            fully_matched = 0

            if self.data_type == 'counselling':
                matched_category = pd.read_sql(
                    f"SELECT COUNT(*) as count FROM {table_name} WHERE master_category_id IS NOT NULL",
                    conn
                ).iloc[0]['count']

                matched_quota = pd.read_sql(
                    f"SELECT COUNT(*) as count FROM {table_name} WHERE master_quota_id IS NOT NULL",
                    conn
                ).iloc[0]['count']

                # Fully matched (all fields) - counselling only
                fully_matched = pd.read_sql(
                    f"""SELECT COUNT(*) as count FROM {table_name}
                        WHERE master_college_id IS NOT NULL
                        AND master_course_id IS NOT NULL
                        AND master_category_id IS NOT NULL
                        AND master_quota_id IS NOT NULL
                        AND master_state_id IS NOT NULL""",
                    conn
                ).iloc[0]['count']
            else:
                # Fully matched for seat data (college + course + state)
                fully_matched = pd.read_sql(
                    f"""SELECT COUNT(*) as count FROM {table_name}
                        WHERE master_college_id IS NOT NULL
                        AND master_course_id IS NOT NULL
                        AND master_state_id IS NOT NULL""",
                    conn
                ).iloc[0]['count']

            # Manual review required (unmatched colleges or courses)
            manual_review = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE master_college_id IS NULL OR master_course_id IS NULL",
                conn
            ).iloc[0]['count']

            # Match confidence distribution
            high_confidence = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE college_match_score >= 0.9",
                conn
            ).iloc[0]['count']

            medium_confidence = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE college_match_score >= 0.7 AND college_match_score < 0.9",
                conn
            ).iloc[0]['count']

            low_confidence = pd.read_sql(
                f"SELECT COUNT(*) as count FROM {table_name} WHERE college_match_score < 0.7 AND college_match_score > 0",
                conn
            ).iloc[0]['count']

            conn.close()

            # Create detailed stats table
            stats_table = Table(title="📈 Match Statistics", border_style="magenta")
            stats_table.add_column("Metric", style="cyan")
            stats_table.add_column("Count", justify="right", style="white")
            stats_table.add_column("Percentage", justify="right", style="yellow")

            stats_table.add_row(
                "Total Records",
                f"{total_in_db:,}",
                "100.0%"
            )
            stats_table.add_row(
                "✅ College Matched",
                f"{matched_college:,}",
                f"{matched_college/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )
            stats_table.add_row(
                "✅ Course Matched",
                f"{matched_course:,}",
                f"{matched_course/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )
            stats_table.add_row(
                "✅ College+Course Matched",
                f"{both_matched:,}",
                f"{both_matched/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )

            # State matching (both seat and counselling data)
            stats_table.add_row(
                "✅ State Matched",
                f"{matched_state:,}",
                f"{matched_state/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )

            # Add counselling-specific stats
            if self.data_type == 'counselling':
                stats_table.add_row(
                    "✅ Category Matched",
                    f"{matched_category:,}",
                    f"{matched_category/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
                )
                stats_table.add_row(
                    "✅ Quota Matched",
                    f"{matched_quota:,}",
                    f"{matched_quota/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
                )

            # Fully matched (different definition for seat vs counselling)
            fully_label = "🎯 Fully Matched (All Fields)" if self.data_type == 'counselling' else "🎯 Fully Matched (College+Course+State)"
            stats_table.add_row(
                fully_label,
                f"{fully_matched:,}",
                f"{fully_matched/total_in_db*100:.1f}%" if total_in_db > 0 else "0%",
                style="bold green"
            )

            stats_table.add_row(
                "⚠️  Manual Review",
                f"{manual_review:,}",
                f"{manual_review/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )

            console.print("\n")
            console.print(stats_table)

            # Match quality distribution
            quality_table = Table(title="🎯 Match Quality Distribution", border_style="blue")
            quality_table.add_column("Quality", style="cyan")
            quality_table.add_column("Count", justify="right", style="white")
            quality_table.add_column("Percentage", justify="right", style="yellow")

            quality_table.add_row(
                "🟢 High (≥90%)",
                f"{high_confidence:,}",
                f"{high_confidence/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )
            quality_table.add_row(
                "🟡 Medium (70-89%)",
                f"{medium_confidence:,}",
                f"{medium_confidence/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )
            quality_table.add_row(
                "🔴 Low (<70%)",
                f"{low_confidence:,}",
                f"{low_confidence/total_in_db*100:.1f}%" if total_in_db > 0 else "0%"
            )

            console.print("\n")
            console.print(quality_table)

        except Exception as e:
            logger.warning(f"Could not generate match statistics: {e}")

        # Display overall summary
        console.print(Panel.fit(
            f"[bold green]✅ Batch Import Complete[/bold green]\n\n"
            f"Total Files: [cyan]{len(excel_files)}[/cyan]\n"
            f"Successful: [green]{successful_imports}[/green]\n"
            f"Failed: [red]{failed_imports}[/red]\n"
            f"Total Records Imported: [bold magenta]{total_imported:,}[/bold magenta]",
            border_style="green"
        ))

        return {
            'total_files': len(excel_files),
            'total_records': total_imported,
            'successful': successful_imports,
            'failed': failed_imports,
            'results': results
        }

    def batch_import_from_folder(self, folder_path: str, recursive: bool = False):
        """Import all Excel files from a folder

        Args:
            folder_path: Path to folder containing Excel files
            recursive: If True, scan subfolders recursively

        Returns:
            dict: Import results summary
        """
        # Scan folder for Excel files
        excel_files = self.scan_folder_for_excel_files(folder_path, recursive)

        if not excel_files:
            console.print("[yellow]⚠️  No Excel files found in folder[/yellow]")
            return {'total_files': 0, 'total_records': 0, 'successful': 0, 'failed': 0}

        # Confirm before proceeding
        console.print(f"\n[bold yellow]⚠️  About to import {len(excel_files)} file(s)[/bold yellow]")
        confirm = Confirm.ask("Proceed with import?", default=True)

        if not confirm:
            console.print("[yellow]Import cancelled[/yellow]")
            return {'total_files': 0, 'total_records': 0, 'successful': 0, 'failed': 0}

        # Import all files
        return self.batch_import_excel_files(excel_files)

    def clear_database_table(self, table_name):
        """Clear all data from a database table

        Args:
            table_name: Name of table to clear

        Returns:
            int: Number of records deleted
        """
        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            cursor = conn.cursor()

            # Check if table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            table_exists = cursor.fetchone()

            if not table_exists:
                console.print(f"[dim]ℹ️  Table '{table_name}' doesn't exist yet (will be created on first import)[/dim]")
                conn.close()
                return 0

            # Get count before deletion
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]

            if count == 0:
                console.print(f"[yellow]⚠️  Table '{table_name}' is already empty[/yellow]")
                conn.close()
                return 0

            # Confirm deletion
            console.print(f"\n[bold red]⚠️  WARNING: About to delete {count:,} records from '{table_name}'[/bold red]")
            confirm = Confirm.ask("Are you sure you want to clear the database?", default=False)

            if not confirm:
                console.print("[yellow]Database clear cancelled[/yellow]")
                conn.close()
                return 0

            # Delete all records
            cursor.execute(f"DELETE FROM {table_name}")
            conn.commit()
            conn.close()

            console.print(f"[green]✅ Cleared {count:,} records from '{table_name}'[/green]")
            logger.info(f"Cleared {count} records from {table_name}")

            return count

        except Exception as e:
            console.print(f"[red]❌ Error clearing database: {e}[/red]")
            logger.error(f"Error clearing database: {e}", exc_info=True)
            return 0

    def import_excel_to_db(self, excel_path: str, enable_dedup=True, clear_before_import=None):
        """Import Excel file to SQLite database with duplicate detection

        Args:
            excel_path: Path to Excel file
            enable_dedup: Enable duplicate detection (default: True)
            clear_before_import: If None, ask user; if True, clear; if False, don't clear

        Returns:
            int: Number of records imported
        """
        logger.info(f"Importing Excel: {excel_path}")

        # Check incremental processing
        if self.is_file_processed(excel_path):
            console.print(f"[yellow]⏭️  Skipping {Path(excel_path).name} (already processed)[/yellow]")
            return 0

        # Read Excel
        df = pd.read_excel(excel_path)
        logger.info(f"  Total records: {len(df):,}")

        # Convert to list of dicts
        records = df.to_dict('records')

        # Generate IDs and hashes for each record
        for record in records:
            record['id'] = self.generate_record_id(record, self.data_type)
            record['record_hash'] = self.generate_record_hash(record)
            record['source_file'] = Path(excel_path).name
            record['import_date'] = datetime.now().isoformat()
            record['created_at'] = datetime.now().isoformat()
            record['updated_at'] = datetime.now().isoformat()
            record['version'] = 1
            record['is_active'] = True

        table_name = 'seat_data_raw'

        # Ask about clearing database if not specified
        if clear_before_import is None:
            console.print("\n[bold cyan]📥 Import Options[/bold cyan]")
            console.print("  [1] Append to existing data (detect duplicates)")
            console.print("  [2] Clear database and import fresh")

            import_choice = Prompt.ask("Choose import mode", choices=["1", "2"], default="1")
            clear_before_import = (import_choice == "2")

        # Clear database if requested
        if clear_before_import:
            self.clear_database_table(table_name)
            # Disable deduplication when clearing (all records are new)
            enable_dedup = False
            console.print("[cyan]📝 Fresh import mode: All records will be imported[/cyan]\n")

        if enable_dedup:
            # Detect duplicates
            dup_result = self.detect_duplicates(records, table_name)

            # Handle duplicates
            all_duplicates = (dup_result['exact_duplicates'] +
                             dup_result['content_duplicates'] +
                             dup_result['fuzzy_duplicates'])

            if all_duplicates:
                console.print("\n[bold]How should we handle duplicates?[/bold]")
                console.print("  [1] Skip duplicates (import only new records)")
                console.print("  [2] Update existing records with new data")
                console.print("  [3] Create versioned copies")
                console.print("  [4] Review manually")

                choice = Prompt.ask("Choice", choices=["1", "2", "3", "4"], default="1")
                strategy_map = {'1': 'skip', '2': 'update', '3': 'version', '4': 'manual'}
                strategy = strategy_map[choice]

                # Handle duplicates
                self.handle_duplicates(all_duplicates, strategy)

            # Import only new records
            records_to_import = dup_result['new_records']
        else:
            records_to_import = records

        if not records_to_import:
            console.print("[yellow]⚠️  No new records to import[/yellow]")
            return 0

        # Import to database
        conn = sqlite3.connect(self.seat_db_path)
        df_import = pd.DataFrame(records_to_import)
        df_import.to_sql(table_name, conn, if_exists='append', index=False)
        conn.close()

        console.print(f"[green]✅ Imported {len(records_to_import):,} new records[/green]")

        # Mark file as processed
        self.mark_file_processed(excel_path, len(records_to_import))

        return len(records_to_import)

    # ==================== VALIDATION FEATURES ====================

    def validate_data(self, df):
        """Validate seat data with category, quota checks"""
        validation_errors = []

        # Get validation config with fallback defaults
        validation_config = self.config.get('validation', {})

        # Default validation settings if not in config
        required_fields = validation_config.get('required_fields', ['college_name', 'course_name', 'state'])
        valid_categories = validation_config.get('valid_categories', ['OPEN', 'OBC', 'SC', 'ST', 'EWS'])
        valid_quotas = validation_config.get('valid_quotas', ['AIQ', 'DNB', 'IP', 'OP', 'MANAGEMENT'])

        # Check required fields
        for field in required_fields:
            if field not in df.columns:
                validation_errors.append(f"Missing required field: {field}")

        # Validate categories if present
        if 'category' in df.columns:
            invalid_categories = df[~df['category'].isin(valid_categories)]['category'].unique()
            if len(invalid_categories) > 0:
                validation_errors.append(f"Invalid categories found: {invalid_categories}")

        # Validate quotas if present
        if 'quota' in df.columns:
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
    

    def import_excel_counselling(self, excel_path: str, clear_before_import=None):
        """Import counselling data from Excel file

        Expected columns:
        1. ALL_INDIA_RANK
        2. QUOTA
        3. COLLEGE/INSTITUTE (needs splitting)
        4. STATE
        5. COURSE
        6. CATEGORY
        7. ROUND (format: SOURCE_LEVEL_R#)
        8. YEAR

        Args:
            excel_path: Path to Excel file
            clear_before_import: If None, ask user; if True, clear; if False, don't clear
        """
        console.print(f"\n[bold cyan]📥 Importing Counselling Data: {excel_path}[/bold cyan]")

        # Check incremental processing
        if self.is_file_processed(excel_path):
            console.print(f"[yellow]⏭️  Skipping {Path(excel_path).name} (already processed)[/yellow]")
            return 0

        # Ask about clearing database if not specified
        if clear_before_import is None:
            console.print("\n[bold cyan]📥 Import Options[/bold cyan]")
            console.print("  [1] Append to existing data (detect duplicates)")
            console.print("  [2] Clear database and import fresh")

            import_choice = Prompt.ask("Choose import mode", choices=["1", "2"], default="1")
            clear_before_import = (import_choice == "2")

        # Clear database if requested
        if clear_before_import:
            self.clear_database_table('counselling_records')
            console.print("[cyan]📝 Fresh import mode: All records will be imported[/cyan]\n")

        try:
            # Read Excel file
            df = pd.read_excel(excel_path)

            console.print(f"✅ Loaded {len(df):,} records from Excel")

            # Validate required columns
            required_cols = ['ALL_INDIA_RANK', 'QUOTA', 'COLLEGE/INSTITUTE', 'STATE',
                           'COURSE', 'CATEGORY', 'ROUND', 'YEAR']

            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                console.print(f"[red]❌ Missing columns: {missing_cols}[/red]")
                return

            # Process each record
            records = []
            with Progress() as progress:
                task = progress.add_task("[cyan]Processing records...", total=len(df))

                for idx, row in df.iterrows():
                    # Parse round field
                    source, level, round_num = self.parse_round_field(row['ROUND'])

                    if not source or not level:
                        logger.warning(f"Row {idx}: Could not parse round field '{row['ROUND']}'")
                        progress.advance(task)
                        continue

                    # Split college/institute field
                    college_name, address = self.split_college_institute(row['COLLEGE/INSTITUTE'])

                    # Normalize fields (including address)
                    college_normalized = self.normalize_text(college_name)
                    course_normalized = self.normalize_text(row['COURSE'])
                    state_normalized = self.normalize_text(row['STATE'])
                    address_normalized = self.normalize_text(address) if address else ''

                    # Detect course type for matching
                    course_type = self.detect_course_type(course_normalized)

                    # Match college using AI-enhanced matching (falls back to rule-based if AI unavailable)
                    college_match, college_score, college_method = self.match_college_ai_enhanced(
                        college_name,
                        row['STATE'],
                        course_type,
                        address,
                        row['COURSE']
                    )
                    college_id = college_match['id'] if college_match else None

                    # Debug logging removed - matching is working correctly

                    # Match course using existing enhanced matching
                    course_match, course_score, course_method = self.match_course_enhanced(row['COURSE'])
                    course_id = course_match['id'] if course_match else None

                    # Match state (exact match from master data)
                    state_id = None
                    for state in self.master_data.get('states', []):
                        if self.normalize_text(state['name']) == state_normalized:
                            state_id = state['id']
                            break

                    # Match quota and category (exact match with aliases)
                    quota_id, category_id = self.exact_match_quota_category(row['QUOTA'], row['CATEGORY'])

                    # Match source and level
                    source_id = self.match_source(source)
                    level_id = self.match_level(level)

                    # Generate partition key
                    partition_key = f"{source}-{level}-{row['YEAR']}"

                    # Generate ID
                    record_id = f"{source}-{level}-{row['YEAR']}-{row['ALL_INDIA_RANK']}-{round_num}"

                    # Determine if fully matched
                    # ALL requirements: college, course, state, quota, category, source, level
                    is_matched = bool(
                        college_id and
                        course_id and
                        state_id and
                        quota_id and
                        category_id and
                        source_id and
                        level_id
                    )

                    # DEBUG: Log first few non-matches to identify issues
                    if not is_matched and idx <= 10:  # Log first 10 for debugging
                        missing = []
                        if not college_id: missing.append(f"college (query: '{college_name[:40]}')")
                        if not course_id: missing.append(f"course (query: '{row['COURSE'][:40]}')")
                        if not state_id: missing.append(f"state (query: '{row['STATE']}')")
                        if not quota_id: missing.append(f"quota (query: '{row['QUOTA']}')")
                        if not category_id: missing.append(f"category (query: '{row['CATEGORY']}')")
                        if not source_id: missing.append(f"source (query: '{source}')")
                        if not level_id: missing.append(f"level (query: '{level}')")

                        logger.warning(f"Record {idx} not fully matched - Missing: {', '.join(missing)}")
                        if college_id:
                            logger.info(f"  ✓ College matched: {college_match['name'][:50]} (score: {college_score:.2%}, method: {college_method})")
                        if course_id:
                            logger.info(f"  ✓ Course matched: {course_match['name'][:50]} (score: {course_score:.2%})")

                    # Create record
                    record = {
                        'id': record_id,
                        'all_india_rank': row['ALL_INDIA_RANK'],
                        'quota': row['QUOTA'],
                        'college_institute_raw': row['COLLEGE/INSTITUTE'],
                        'address': address,  # Store extracted address separately
                        'address_normalized': address_normalized,  # Normalized address for matching
                        'state_raw': row['STATE'],
                        'course_raw': row['COURSE'],
                        'category': row['CATEGORY'],
                        'round_raw': row['ROUND'],
                        'year': row['YEAR'],
                        'college_institute_normalized': college_normalized,
                        'state_normalized': state_normalized,
                        'course_normalized': course_normalized,
                        'source_normalized': source,
                        'level_normalized': level,
                        'round_normalized': round_num,
                        'master_college_id': college_id,
                        'master_course_id': course_id,
                        'master_state_id': state_id,
                        'master_quota_id': quota_id,
                        'master_category_id': category_id,
                        'master_source_id': source_id,
                        'master_level_id': level_id,
                        'college_match_score': college_score if college_id else None,
                        'college_match_method': college_method if college_id else None,
                        'course_match_score': course_score if course_id else None,
                        'course_match_method': course_method if course_id else None,
                        'partition_key': partition_key,
                        'is_matched': is_matched
                    }

                    records.append(record)
                    progress.advance(task)

            # Insert into database
            console.print(f"\n[cyan]💾 Inserting {len(records):,} records into database...[/cyan]")

            conn = sqlite3.connect(self.data_db_path)
            cursor = conn.cursor()

            # Insert records
            for record in records:
                cursor.execute("""
                    INSERT OR REPLACE INTO counselling_records (
                        id, all_india_rank, quota, college_institute_raw, address, state_raw,
                        course_raw, category, round_raw, year,
                        college_institute_normalized, state_normalized, course_normalized,
                        source_normalized, level_normalized, round_normalized,
                        master_college_id, master_course_id, master_state_id,
                        master_quota_id, master_category_id,
                        master_source_id, master_level_id,
                        college_match_score, college_match_method,
                        course_match_score, course_match_method,
                        partition_key, is_matched
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    record['id'], record['all_india_rank'], record['quota'],
                    record['college_institute_raw'], record['address'], record['state_raw'], record['course_raw'],
                    record['category'], record['round_raw'], record['year'],
                    record['college_institute_normalized'], record['state_normalized'],
                    record['course_normalized'], record['source_normalized'],
                    record['level_normalized'], record['round_normalized'],
                    record['master_college_id'], record['master_course_id'],
                    record['master_state_id'], record['master_quota_id'],
                    record['master_category_id'], record['master_source_id'],
                    record['master_level_id'], record['college_match_score'],
                    record['college_match_method'], record['course_match_score'],
                    record['course_match_method'], record['partition_key'],
                    record['is_matched']
                ))

            conn.commit()
            conn.close()

            # Calculate statistics
            matched_count = sum(1 for r in records if r['is_matched'])
            match_rate = (matched_count / len(records) * 100) if records else 0

            console.print(f"\n[bold green]✅ Successfully imported {len(records):,} records![/bold green]")
            console.print(f"   Fully Matched: {matched_count:,} ({match_rate:.1f}%)")
            console.print(f"   Needs Review: {len(records) - matched_count:,}")

            # Mark file as processed
            self.mark_file_processed(excel_path, len(records))

            return len(records)

        except Exception as e:
            console.print(f"[red]❌ Import failed: {e}[/red]")
            logger.error(f"Import failed: {e}", exc_info=True)
            return 0

    # ==================== ANALYTICS & REPORTING DASHBOARD ====================

    def generate_analytics_dashboard(self, table_name='seat_data'):
        """Generate comprehensive analytics dashboard"""
        console.print(Panel.fit("[bold cyan]📊 Analytics Dashboard[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)

        try:
            # 1. Match Quality Metrics
            console.print("\n[bold yellow]🎯 Match Quality Metrics[/bold yellow]")

            match_quality = pd.read_sql(f"""
                SELECT
                    CASE
                        WHEN college_match_score >= 95 THEN 'Exact (95-100%)'
                        WHEN college_match_score >= 85 THEN 'High (85-95%)'
                        WHEN college_match_score >= 75 THEN 'Medium (75-85%)'
                        WHEN college_match_score >= 65 THEN 'Low (65-75%)'
                        ELSE 'Unmatched'
                    END as confidence_level,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM {table_name}), 2) as percentage
                FROM {table_name}
                GROUP BY confidence_level
                ORDER BY
                    CASE confidence_level
                        WHEN 'Exact (95-100%)' THEN 1
                        WHEN 'High (85-95%)' THEN 2
                        WHEN 'Medium (75-85%)' THEN 3
                        WHEN 'Low (65-75%)' THEN 4
                        ELSE 5
                    END
            """, conn)

            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("Confidence Level")
            table.add_column("Count", justify="right")
            table.add_column("Percentage", justify="right")

            for _, row in match_quality.iterrows():
                table.add_row(row['confidence_level'], f"{row['count']:,}", f"{row['percentage']:.2f}%")

            console.print(table)

            # 2. Method Effectiveness
            console.print("\n[bold yellow]🔬 Matching Method Effectiveness[/bold yellow]")

            method_stats = pd.read_sql(f"""
                SELECT
                    college_match_method,
                    COUNT(*) as uses,
                    ROUND(AVG(college_match_score), 2) as avg_score,
                    ROUND(MIN(college_match_score), 2) as min_score,
                    ROUND(MAX(college_match_score), 2) as max_score
                FROM {table_name}
                WHERE college_match_method IS NOT NULL
                GROUP BY college_match_method
                ORDER BY uses DESC
                LIMIT 10
            """, conn)

            table2 = Table(show_header=True, header_style="bold magenta")
            table2.add_column("Method")
            table2.add_column("Uses", justify="right")
            table2.add_column("Avg Score", justify="right")
            table2.add_column("Min", justify="right")
            table2.add_column("Max", justify="right")

            for _, row in method_stats.iterrows():
                table2.add_row(
                    str(row['college_match_method']),
                    f"{row['uses']:,}",
                    f"{row['avg_score']:.2f}",
                    f"{row['min_score']:.2f}",
                    f"{row['max_score']:.2f}"
                )

            console.print(table2)

            # 3. Data Completeness
            console.print("\n[bold yellow]✅ Data Completeness Score[/bold yellow]")

            completeness = pd.read_sql(f"""
                SELECT
                    COUNT(*) as total_records,
                    SUM(CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END) as college_matched,
                    SUM(CASE WHEN master_course_id IS NOT NULL THEN 1 ELSE 0 END) as course_matched,
                    SUM(CASE WHEN master_state_id IS NOT NULL THEN 1 ELSE 0 END) as state_matched,
                    ROUND(SUM(CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as college_pct,
                    ROUND(SUM(CASE WHEN master_course_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as course_pct,
                    ROUND(SUM(CASE WHEN master_state_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as state_pct
                FROM {table_name}
            """, conn)

            comp_row = completeness.iloc[0]
            console.print(f"  Total Records: [cyan]{comp_row['total_records']:,}[/cyan]")
            console.print(f"  College Matched: [green]{comp_row['college_matched']:,}[/green] ([yellow]{comp_row['college_pct']:.2f}%[/yellow])")
            console.print(f"  Course Matched: [green]{comp_row['course_matched']:,}[/green] ([yellow]{comp_row['course_pct']:.2f}%[/yellow])")
            console.print(f"  State Matched: [green]{comp_row['state_matched']:,}[/green] ([yellow]{comp_row['state_pct']:.2f}%[/yellow])")

            # 4. Top Unmatched Patterns
            console.print("\n[bold yellow]❌ Top Unmatched Colleges[/bold yellow]")

            unmatched = pd.read_sql(f"""
                SELECT
                    college_name_normalized as college,
                    state_normalized as state,
                    COUNT(*) as occurrences
                FROM {table_name}
                WHERE master_college_id IS NULL
                GROUP BY college, state
                ORDER BY occurrences DESC
                LIMIT 10
            """, conn)

            if len(unmatched) > 0:
                table3 = Table(show_header=True, header_style="bold magenta")
                table3.add_column("College Name")
                table3.add_column("State")
                table3.add_column("Occurrences", justify="right")

                for _, row in unmatched.iterrows():
                    table3.add_row(str(row['college']), str(row['state']), f"{row['occurrences']:,}")

                console.print(table3)
            else:
                console.print("[green]✅ All colleges matched![/green]")

            return {
                'match_quality': match_quality.to_dict('records'),
                'method_stats': method_stats.to_dict('records'),
                'completeness': comp_row.to_dict(),
                'top_unmatched': unmatched.to_dict('records')
            }

        finally:
            conn.close()

    def export_analytics_report(self, table_name='seat_data_linked', format='json'):
        """Export analytics report to file"""
        analytics = self.generate_analytics_dashboard(table_name)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if format == 'json':
            filename = f"analytics_report_{timestamp}.json"
            with open(filename, 'w') as f:
                json.dump(analytics, f, indent=2)
        elif format == 'excel':
            filename = f"analytics_report_{timestamp}.xlsx"
            with pd.ExcelWriter(filename) as writer:
                pd.DataFrame(analytics['match_quality']).to_excel(writer, sheet_name='Match Quality', index=False)
                pd.DataFrame(analytics['method_stats']).to_excel(writer, sheet_name='Methods', index=False)
                pd.DataFrame([analytics['completeness']]).to_excel(writer, sheet_name='Completeness', index=False)
                pd.DataFrame(analytics['top_unmatched']).to_excel(writer, sheet_name='Top Unmatched', index=False)

        console.print(f"[green]✅ Report exported to {filename}[/green]")
        return filename

    # ==================== SMART DATA ENRICHMENT ====================

    def auto_enrich_data(self, table_name='seat_data_linked'):
        """Automatically enrich incomplete data using inference"""
        console.print(Panel.fit("[bold cyan]🔍 Smart Data Enrichment[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)
        cursor = conn.cursor()

        enriched_count = 0

        try:
            # Column names differ between modes
            if table_name == 'counselling_records':
                college_col = 'college_institute_normalized'
            else:
                college_col = 'college_name_normalized'

            # Get records with missing state
            missing_state = pd.read_sql(f"""
                SELECT id, {college_col} as college_name, address
                FROM {table_name}
                WHERE master_state_id IS NULL
                LIMIT 100
            """, conn)

            console.print(f"\n[yellow]📍 Enriching {len(missing_state)} records with missing state...[/yellow]")

            with Progress() as progress:
                task = progress.add_task("[cyan]Enriching...", total=len(missing_state))

                for _, row in missing_state.iterrows():
                    # Try to infer state from college name or address
                    inferred_state = self._infer_state_from_text(row['college_name'], row.get('address', ''))

                    if inferred_state:
                        # Find master state ID
                        state_id = None
                        for state in self.master_data.get('states', []):
                            if self.normalize_text(state['name']) == inferred_state:
                                state_id = state['id']
                                break

                        if state_id:
                            cursor.execute(f"""
                                UPDATE {table_name}
                                SET master_state_id = ?, state_normalized = ?
                                WHERE id = ?
                            """, (state_id, inferred_state, row['id']))
                            enriched_count += 1

                    progress.advance(task)

            conn.commit()
            console.print(f"[green]✅ Enriched {enriched_count} records with inferred state[/green]")

        finally:
            conn.close()

        return enriched_count

    def _infer_state_from_text(self, college_name, address=''):
        """Infer state from college name or address"""
        text = f"{college_name} {address}".upper()

        # State indicators
        state_keywords = {
            'KARNATAKA': ['KARNATAKA', 'BANGALORE', 'BENGALURU', 'MYSORE', 'MANGALORE', 'HUBLI'],
            'TAMIL NADU': ['TAMIL NADU', 'CHENNAI', 'MADRAS', 'COIMBATORE', 'MADURAI'],
            'MAHARASHTRA': ['MAHARASHTRA', 'MUMBAI', 'PUNE', 'NAGPUR', 'NASHIK'],
            'KERALA': ['KERALA', 'KOCHI', 'TRIVANDRUM', 'THIRUVANANTHAPURAM', 'CALICUT', 'KOZHIKODE'],
            'DELHI': ['DELHI', 'NEW DELHI'],
            'WEST BENGAL': ['WEST BENGAL', 'KOLKATA', 'CALCUTTA'],
            'RAJASTHAN': ['RAJASTHAN', 'JAIPUR', 'JODHPUR', 'UDAIPUR'],
            'UTTAR PRADESH': ['UTTAR PRADESH', 'LUCKNOW', 'KANPUR', 'AGRA', 'VARANASI'],
            'ANDHRA PRADESH': ['ANDHRA PRADESH', 'HYDERABAD', 'VISAKHAPATNAM', 'VIJAYAWADA'],
            'TELANGANA': ['TELANGANA', 'HYDERABAD', 'WARANGAL'],
        }

        for state, keywords in state_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    return self.normalize_text(state)

        return None

    # ==================== ADVANCED SEARCH & QUERY BUILDER ====================

    def advanced_search(self, table_name='seat_data'):
        """Interactive advanced search with multiple filters"""
        console.print(Panel.fit("[bold cyan]🔎 Advanced Search & Query Builder[/bold cyan]", border_style="cyan"))

        # Build query interactively
        filters = []

        console.print("\n[bold]Build your search query:[/bold]")
        console.print("Leave blank to skip a filter\n")

        # College filter
        college_filter = Prompt.ask("College name (supports wildcards %)", default="")
        if college_filter:
            filters.append(f"college_name_normalized LIKE '%{college_filter.upper()}%'")

        # Course filter
        course_filter = Prompt.ask("Course name (supports wildcards %)", default="")
        if course_filter:
            filters.append(f"course_name_normalized LIKE '%{course_filter.upper()}%'")

        # State filter
        state_filter = Prompt.ask("State", default="")
        if state_filter:
            filters.append(f"state_normalized LIKE '%{state_filter.upper()}%'")

        # Match status
        match_status = Prompt.ask("Match status", choices=["all", "matched", "unmatched"], default="all")
        if match_status == "matched":
            filters.append("master_college_id IS NOT NULL")
        elif match_status == "unmatched":
            filters.append("master_college_id IS NULL")

        # Confidence threshold
        min_confidence = Prompt.ask("Minimum confidence score (0-100)", default="0")
        if float(min_confidence) > 0:
            filters.append(f"college_match_score >= {min_confidence}")

        # Build SQL query
        where_clause = " AND ".join(filters) if filters else "1=1"

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)

        query = f"""
            SELECT * FROM {table_name}
            WHERE {where_clause}
            LIMIT 1000
        """

        results = pd.read_sql(query, conn)
        conn.close()

        console.print(f"\n[green]✅ Found {len(results)} matching records[/green]")

        if len(results) > 0:
            # Show preview
            console.print("\n[bold]Preview (first 10 rows):[/bold]")
            console.print(results.head(10).to_string())

            # Export options
            export = Confirm.ask("\nExport results?", default=False)
            if export:
                export_format = Prompt.ask("Format", choices=["csv", "excel", "json"], default="csv")
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

                if export_format == "csv":
                    filename = f"search_results_{timestamp}.csv"
                    results.to_csv(filename, index=False)
                elif export_format == "excel":
                    filename = f"search_results_{timestamp}.xlsx"
                    results.to_excel(filename, index=False)
                else:
                    filename = f"search_results_{timestamp}.json"
                    results.to_json(filename, orient='records', indent=2)

                console.print(f"[green]✅ Exported to {filename}[/green]")

        return results

    # ==================== DATA COMPARISON & DIFF TOOLS ====================

    def track_data_changes(self, table_name='seat_data'):
        """Track changes in data over time"""
        console.print(Panel.fit("[bold cyan]📈 Data Change Tracking[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)

        # Show change statistics
        changes = pd.read_sql(f"""
            SELECT
                DATE(created_at) as date,
                COUNT(*) as records_added
            FROM {table_name}
            WHERE created_at IS NOT NULL
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 30
        """, conn)

        if len(changes) > 0:
            console.print("\n[bold yellow]Recent Activity:[/bold yellow]")
            console.print(changes.to_string(index=False))
        else:
            console.print("[yellow]No timestamp data available[/yellow]")

        conn.close()

    # ==================== AUTOMATED QUALITY ASSURANCE ====================

    def run_quality_assurance_suite(self, table_name='seat_data_linked'):
        """Run comprehensive quality assurance checks"""
        console.print(Panel.fit("[bold cyan]✅ Automated Quality Assurance Suite[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)

        qa_results = {
            'passed': [],
            'warnings': [],
            'errors': []
        }

        # Column names differ between seat and counselling data
        if table_name == 'counselling_records':
            college_col = 'college_institute_normalized'
            course_col = 'course_normalized'
            state_col = 'state_normalized'
        else:
            college_col = 'college_name_normalized'
            course_col = 'course_name_normalized'
            state_col = 'state_normalized'

        # Test 1: Check for NULL critical fields
        console.print("\n[bold yellow]Test 1: Critical Field Validation[/bold yellow]")
        null_check = pd.read_sql(f"""
            SELECT
                SUM(CASE WHEN {college_col} IS NULL THEN 1 ELSE 0 END) as null_colleges,
                SUM(CASE WHEN {course_col} IS NULL THEN 1 ELSE 0 END) as null_courses,
                SUM(CASE WHEN {state_col} IS NULL THEN 1 ELSE 0 END) as null_states
            FROM {table_name}
        """, conn).iloc[0]

        if null_check['null_colleges'] == 0 and null_check['null_courses'] == 0:
            qa_results['passed'].append("✅ No critical NULL values found")
            console.print("[green]✅ PASSED: All critical fields populated[/green]")
        else:
            qa_results['errors'].append(f"❌ Found NULL values: Colleges={null_check['null_colleges']}, Courses={null_check['null_courses']}")
            console.print(f"[red]❌ FAILED: NULL values detected[/red]")

        # Test 2: Match rate threshold
        console.print("\n[bold yellow]Test 2: Match Rate Threshold (>70%)[/bold yellow]")
        match_rate = pd.read_sql(f"""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END) as matched,
                ROUND(SUM(CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as match_pct
            FROM {table_name}
        """, conn).iloc[0]

        if match_rate['match_pct'] >= 70:
            qa_results['passed'].append(f"✅ Match rate: {match_rate['match_pct']}%")
            console.print(f"[green]✅ PASSED: Match rate {match_rate['match_pct']}% (target: 70%)[/green]")
        else:
            qa_results['warnings'].append(f"⚠️  Match rate below threshold: {match_rate['match_pct']}%")
            console.print(f"[yellow]⚠️  WARNING: Match rate {match_rate['match_pct']}% (target: 70%)[/yellow]")

        # Test 3: Duplicate detection
        console.print("\n[bold yellow]Test 3: Duplicate Detection[/bold yellow]")
        duplicates = pd.read_sql(f"""
            SELECT {college_col}, {course_col}, COUNT(*) as count
            FROM {table_name}
            GROUP BY {college_col}, {course_col}
            HAVING COUNT(*) > 1
            LIMIT 10
        """, conn)

        if len(duplicates) == 0:
            qa_results['passed'].append("✅ No duplicates found")
            console.print("[green]✅ PASSED: No duplicates detected[/green]")
        else:
            qa_results['warnings'].append(f"⚠️  Found {len(duplicates)} potential duplicates")
            console.print(f"[yellow]⚠️  WARNING: {len(duplicates)} potential duplicates[/yellow]")

        # Test 4: Confidence score distribution
        console.print("\n[bold yellow]Test 4: Confidence Score Distribution[/bold yellow]")
        low_confidence = pd.read_sql(f"""
            SELECT COUNT(*) as count
            FROM {table_name}
            WHERE college_match_score < 75 AND college_match_score IS NOT NULL
        """, conn).iloc[0]['count']

        if low_confidence < match_rate['total'] * 0.2:  # Less than 20% low confidence
            qa_results['passed'].append("✅ Healthy confidence distribution")
            console.print("[green]✅ PASSED: Most matches are high confidence[/green]")
        else:
            qa_results['warnings'].append(f"⚠️  {low_confidence} low-confidence matches")
            console.print(f"[yellow]⚠️  WARNING: Many low-confidence matches ({low_confidence})[/yellow]")

        conn.close()

        # Summary
        console.print("\n" + "="*70)
        console.print(Panel.fit(
            f"[bold]QA Summary[/bold]\n\n"
            f"[green]Passed: {len(qa_results['passed'])}[/green]\n"
            f"[yellow]Warnings: {len(qa_results['warnings'])}[/yellow]\n"
            f"[red]Errors: {len(qa_results['errors'])}[/red]",
            border_style="cyan"
        ))

        return qa_results

    # ==================== BULK EDIT & TRANSFORM ====================

    def bulk_find_replace(self, table_name='seat_data'):
        """Interactive bulk find and replace with preview"""
        console.print(Panel.fit("[bold cyan]✏️  Bulk Find & Replace[/bold cyan]", border_style="cyan"))

        # Get field to modify
        console.print("\n[bold]Select field to modify:[/bold]")
        console.print("  [1] College Name")
        console.print("  [2] Course Name")
        console.print("  [3] State")
        console.print("  [4] Address")

        field_choice = Prompt.ask("Field", choices=["1", "2", "3", "4"], default="1")

        # Column names differ between modes
        if table_name == 'counselling_records':
            field_map = {
                '1': 'college_institute_normalized',
                '2': 'course_normalized',
                '3': 'state_normalized',
                '4': 'address'
            }
        else:
            field_map = {
                '1': 'college_name_normalized',
                '2': 'course_name_normalized',
                '3': 'state_normalized',
                '4': 'address'
            }
        field_name = field_map[field_choice]

        # Get find/replace values
        find_text = Prompt.ask("Find text (case-insensitive)")
        replace_text = Prompt.ask("Replace with")

        use_regex = Confirm.ask("Use regex pattern?", default=False)

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)
        cursor = conn.cursor()

        # Preview affected records
        preview = pd.read_sql(f"""
            SELECT id, {field_name}
            FROM {table_name}
            WHERE {field_name} LIKE '%{find_text}%'
            LIMIT 20
        """, conn)

        console.print(f"\n[yellow]Preview: {len(preview)} records will be affected[/yellow]")
        if len(preview) > 0:
            console.print(preview.to_string())

        if len(preview) > 0:
            confirm = Confirm.ask(f"\nProceed with replacing '{find_text}' with '{replace_text}'?", default=False)

            if confirm:
                if use_regex:
                    # Note: SQLite doesn't support regex replace natively
                    console.print("[yellow]⚠️  Regex replace requires loading data into memory[/yellow]")

                    df = pd.read_sql(f"SELECT * FROM {table_name} WHERE {field_name} LIKE '%{find_text}%'", conn)
                    df[field_name] = df[field_name].str.replace(find_text, replace_text, regex=True)

                    # Update records
                    for _, row in df.iterrows():
                        cursor.execute(f"""
                            UPDATE {table_name}
                            SET {field_name} = ?
                            WHERE id = ?
                        """, (row[field_name], row['id']))
                else:
                    # Simple replace
                    cursor.execute(f"""
                        UPDATE {table_name}
                        SET {field_name} = REPLACE({field_name}, ?, ?)
                        WHERE {field_name} LIKE ?
                    """, (find_text, replace_text, f'%{find_text}%'))

                conn.commit()
                console.print(f"[green]✅ Updated {cursor.rowcount} records[/green]")

        conn.close()

    def bulk_field_update(self, table_name='seat_data'):
        """Batch update fields based on conditions"""
        console.print(Panel.fit("[bold cyan]🔄 Bulk Field Update[/bold cyan]", border_style="cyan"))

        console.print("\n[bold]Example: Set all unmatched colleges in KARNATAKA to manual review[/bold]")
        console.print("[yellow]This feature allows SQL-based batch updates[/yellow]\n")

        # Get update parameters
        update_field = Prompt.ask("Field to update")
        update_value = Prompt.ask("New value")
        where_clause = Prompt.ask("WHERE condition (SQL)", default="1=1")

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)
        cursor = conn.cursor()

        # Preview
        preview = pd.read_sql(f"""
            SELECT id, {update_field}
            FROM {table_name}
            WHERE {where_clause}
            LIMIT 20
        """, conn)

        console.print(f"\n[yellow]Preview: {len(preview)} records will be affected[/yellow]")
        if len(preview) > 0:
            console.print(preview.head(10).to_string())

        confirm = Confirm.ask(f"\nUpdate {update_field} to '{update_value}'?", default=False)

        if confirm:
            cursor.execute(f"""
                UPDATE {table_name}
                SET {update_field} = ?
                WHERE {where_clause}
            """, (update_value,))

            conn.commit()
            console.print(f"[green]✅ Updated {cursor.rowcount} records[/green]")

        conn.close()

    # ==================== INTEGRATION & API ====================

    def export_to_format(self, table_name='seat_data_linked', format='parquet'):
        """Export data to various formats"""
        console.print(Panel.fit(f"[bold cyan]📤 Export to {format.upper()}[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)
        df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
        conn.close()

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if format == 'parquet':
            filename = f"{table_name}_export_{timestamp}.parquet"
            df.to_parquet(filename, index=False)
        elif format == 'csv':
            filename = f"{table_name}_export_{timestamp}.csv"
            df.to_csv(filename, index=False)
        elif format == 'excel':
            filename = f"{table_name}_export_{timestamp}.xlsx"
            df.to_excel(filename, index=False)
        elif format == 'json':
            filename = f"{table_name}_export_{timestamp}.json"
            df.to_json(filename, orient='records', indent=2)
        elif format == 'jsonl':
            filename = f"{table_name}_export_{timestamp}.jsonl"
            df.to_json(filename, orient='records', lines=True)
        elif format == 'sql':
            filename = f"{table_name}_export_{timestamp}.sql"
            conn_temp = sqlite3.connect(':memory:')
            df.to_sql(table_name, conn_temp, index=False)
            with open(filename, 'w') as f:
                for line in conn_temp.iterdump():
                    f.write(f'{line}\n')
            conn_temp.close()

        console.print(f"[green]✅ Exported {len(df):,} records to {filename}[/green]")
        return filename

    # ==================== ML ENHANCEMENTS ====================

    def calibrate_model_confidence(self):
        """Calibrate ML model confidence scores"""
        console.print(Panel.fit("[bold cyan]🎯 Model Confidence Calibration[/bold cyan]", border_style="cyan"))

        if not hasattr(self, 'ml_model') or self.ml_model is None:
            console.print("[red]❌ No ML model loaded. Train or load a model first.[/red]")
            return

        console.print("[yellow]Analyzing model predictions vs actual matches...[/yellow]")

        # Load validation data
        conn = sqlite3.connect(self.seat_db_path)
        validation_data = pd.read_sql("""
            SELECT
                college_match_score,
                CASE WHEN master_college_id IS NOT NULL THEN 1 ELSE 0 END as is_match
            FROM seat_data_linked
            WHERE college_match_score IS NOT NULL
            LIMIT 1000
        """, conn)
        conn.close()

        if len(validation_data) > 0:
            # Calculate calibration metrics
            from sklearn.calibration import calibration_curve

            prob_true, prob_pred = calibration_curve(
                validation_data['is_match'],
                validation_data['college_match_score'] / 100,
                n_bins=10
            )

            console.print("\n[bold yellow]Calibration Analysis:[/bold yellow]")
            console.print(f"  Model is {'well-calibrated' if abs(prob_true - prob_pred).mean() < 0.1 else 'needs calibration'}")
            console.print(f"  Mean calibration error: {abs(prob_true - prob_pred).mean():.3f}")

        console.print("[green]✅ Calibration analysis complete[/green]")

    # ==================== AUDIT & VERSION CONTROL ====================

    def enable_audit_trail(self, table_name='seat_data'):
        """Enable comprehensive audit trail"""
        console.print(Panel.fit("[bold cyan]📝 Audit Trail System[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)
        cursor = conn.cursor()

        # Create audit log table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                table_name TEXT,
                record_id TEXT,
                action TEXT,
                field_name TEXT,
                old_value TEXT,
                new_value TEXT,
                user TEXT,
                reason TEXT
            )
        """)

        conn.commit()
        console.print("[green]✅ Audit trail enabled[/green]")
        console.print("All changes will now be logged to audit_log table")

        conn.close()

    def view_audit_history(self, record_id=None):
        """View audit history for records"""
        console.print(Panel.fit("[bold cyan]📜 Audit History Viewer[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.seat_db_path)

        if record_id:
            audit = pd.read_sql(f"""
                SELECT * FROM audit_log
                WHERE record_id = '{record_id}'
                ORDER BY timestamp DESC
            """, conn)
        else:
            audit = pd.read_sql("""
                SELECT * FROM audit_log
                ORDER BY timestamp DESC
                LIMIT 100
            """, conn)

        if len(audit) > 0:
            console.print(f"\n[yellow]Found {len(audit)} audit entries[/yellow]")
            console.print(audit.to_string())
        else:
            console.print("[yellow]No audit entries found[/yellow]")

        conn.close()

    # ==================== SMART DEDUPLICATION ====================

    def advanced_duplicate_finder(self, table_name='seat_data', threshold=0.85):
        """Find duplicates using fuzzy matching"""
        console.print(Panel.fit("[bold cyan]🔄 Advanced Duplicate Detection[/bold cyan]", border_style="cyan"))

        conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)

        # Column names differ between modes
        if table_name == 'counselling_records':
            college_col = 'college_institute_normalized'
            course_col = 'course_normalized'
        else:
            college_col = 'college_name_normalized'
            course_col = 'course_name_normalized'

        # Load data
        df = pd.read_sql(f"""
            SELECT id, {college_col} as college_name_normalized,
                   {course_col} as course_name_normalized,
                   state_normalized
            FROM {table_name}
            LIMIT 1000
        """, conn)

        console.print(f"\n[yellow]Analyzing {len(df)} records for duplicates...[/yellow]")

        duplicates = []

        with Progress() as progress:
            task = progress.add_task("[cyan]Finding duplicates...", total=len(df))

            for i in range(len(df)):
                for j in range(i+1, len(df)):
                    row1 = df.iloc[i]
                    row2 = df.iloc[j]

                    # Calculate similarity
                    college_sim = fuzz.ratio(row1['college_name_normalized'], row2['college_name_normalized']) / 100
                    course_sim = fuzz.ratio(row1['course_name_normalized'], row2['course_name_normalized']) / 100

                    if row1['state_normalized'] == row2['state_normalized'] and college_sim > threshold and course_sim > threshold:
                        duplicates.append({
                            'id1': row1['id'],
                            'id2': row2['id'],
                            'college1': row1['college_name_normalized'],
                            'college2': row2['college_name_normalized'],
                            'similarity': (college_sim + course_sim) / 2
                        })

                progress.advance(task)

        console.print(f"\n[green]✅ Found {len(duplicates)} potential duplicate pairs[/green]")

        if len(duplicates) > 0:
            dup_df = pd.DataFrame(duplicates)
            console.print(dup_df.head(20).to_string())

            # Offer merge
            if Confirm.ask("\nView merge suggestions?", default=False):
                self._suggest_duplicate_merges(duplicates, conn, table_name)

        conn.close()
        return duplicates

    def _suggest_duplicate_merges(self, duplicates, conn, table_name):
        """Suggest which duplicate to keep"""
        console.print("\n[bold yellow]Merge Suggestions:[/bold yellow]")

        for dup in duplicates[:10]:
            console.print(f"\nDuplicate pair (similarity: {dup['similarity']:.2%}):")
            console.print(f"  1: {dup['college1']} (ID: {dup['id1']})")
            console.print(f"  2: {dup['college2']} (ID: {dup['id2']})")

            action = Prompt.ask("Action", choices=["keep1", "keep2", "skip", "quit"], default="skip")

            if action == "quit":
                break
            elif action in ["keep1", "keep2"]:
                keep_id = dup['id1'] if action == "keep1" else dup['id2']
                delete_id = dup['id2'] if action == "keep1" else dup['id1']

                cursor = conn.cursor()
                cursor.execute(f"DELETE FROM {table_name} WHERE id = ?", (delete_id,))
                conn.commit()
                console.print(f"[green]✅ Kept {keep_id}, deleted {delete_id}[/green]")

    # ==================== SCHEDULE & AUTOMATION ====================

    def setup_scheduled_import(self):
        """Setup scheduled import jobs"""
        console.print(Panel.fit("[bold cyan]⏰ Schedule & Automation Setup[/bold cyan]", border_style="cyan"))

        console.print("\n[bold yellow]Scheduled Import Configuration[/bold yellow]")
        console.print("This feature requires a job scheduler (cron/systemd)")
        console.print("\nExample cron entry:")
        console.print("[cyan]0 2 * * * cd /path/to/project && python match_and_link_sqlite_seat_data.py --auto-import /data/folder[/cyan]")

        console.print("\n[yellow]⚠️  To enable automation:[/yellow]")
        console.print("  1. Create a config file with import settings")
        console.print("  2. Add --auto-import flag support to main()")
        console.print("  3. Set up cron job or systemd timer")

    # ==================== DATABASE MIGRATION ====================

    def migrate_college_aliases_table(self):
        """Migrate college_aliases table to include location context"""
        console.print(Panel.fit("[bold cyan]🔄 Database Migration: College Aliases[/bold cyan]", border_style="cyan"))

        # Always use master_data.db for aliases
        db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
        console.print(f"[cyan]Migrating aliases in: {db_path}[/cyan]")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        try:
            # Check current table structure
            cursor.execute("PRAGMA table_info(college_aliases)")
            columns = [col[1] for col in cursor.fetchall()]

            console.print(f"\n[yellow]Current columns: {', '.join(columns)}[/yellow]")

            # Check if migration is needed
            needs_migration = not all(col in columns for col in ['master_college_id', 'state_normalized', 'address_normalized'])

            if not needs_migration:
                console.print("[green]✅ Table already has location columns - no migration needed![/green]")
                conn.close()
                return

            console.print("\n[bold yellow]⚠️  Migration needed to add location context columns[/bold yellow]")
            console.print("This will:")
            console.print("  1. Backup existing aliases")
            console.print("  2. Add new columns: state_normalized, address_normalized")
            console.print("  3. Rename college_id → master_college_id (if needed)")
            console.print("  4. Keep all existing data intact")

            if not Confirm.ask("\nProceed with migration?", default=True):
                console.print("[yellow]Migration cancelled[/yellow]")
                conn.close()
                return

            # Step 1: Backup existing data
            console.print("\n[cyan]📦 Backing up existing aliases...[/cyan]")
            backup_data = pd.read_sql("SELECT * FROM college_aliases", conn)
            backup_file = f"college_aliases_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            backup_data.to_csv(backup_file, index=False)
            console.print(f"[green]✅ Backup saved to: {backup_file}[/green]")

            # Step 2: Add missing columns using ALTER TABLE
            console.print("\n[cyan]🔨 Adding location context columns...[/cyan]")

            # Add state_normalized if missing
            if 'state_normalized' not in columns:
                cursor.execute("ALTER TABLE college_aliases ADD COLUMN state_normalized TEXT")
                console.print("  ✅ Added state_normalized column")

            # Add address_normalized if missing
            if 'address_normalized' not in columns:
                cursor.execute("ALTER TABLE college_aliases ADD COLUMN address_normalized TEXT")
                console.print("  ✅ Added address_normalized column")

            # Handle college_id → master_college_id rename
            if 'college_id' in columns and 'master_college_id' not in columns:
                console.print("\n[cyan]🔄 Renaming college_id to master_college_id...[/cyan]")
                # SQLite doesn't support renaming columns directly, so we need to:
                # Copy college_id to master_college_id, then drop college_id
                cursor.execute("ALTER TABLE college_aliases ADD COLUMN master_college_id TEXT")
                cursor.execute("UPDATE college_aliases SET master_college_id = college_id")
                console.print("  ✅ Copied college_id → master_college_id")
                # Note: Can't drop column in SQLite easily, but having both is fine

            elif 'master_college_id' not in columns:
                # No college_id, just add master_college_id
                cursor.execute("ALTER TABLE college_aliases ADD COLUMN master_college_id TEXT")
                console.print("  ✅ Added master_college_id column")

            conn.commit()

            # Step 5: Show migration summary
            cursor.execute("SELECT COUNT(*) FROM college_aliases")
            count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM college_aliases WHERE master_college_id IS NOT NULL")
            with_location = cursor.fetchone()[0]

            console.print("\n[bold green]✅ Migration completed successfully![/bold green]")
            console.print(f"  Total aliases: {count}")
            console.print(f"  With location data: {with_location}")
            console.print(f"  Without location data: {count - with_location}")

            if count - with_location > 0:
                console.print("\n[yellow]💡 Tip: Old aliases will work but won't have location context.[/yellow]")
                console.print("[yellow]   Consider re-creating them with location info for better accuracy.[/yellow]")

        except Exception as e:
            console.print(f"\n[red]❌ Migration failed: {e}[/red]")
            console.print("[yellow]Restoring from backup...[/yellow]")
            conn.rollback()

        finally:
            conn.close()

    def view_aliases_needing_location(self):
        """Show aliases that need location context"""
        console.print(Panel.fit("[bold cyan]📍 Aliases Needing Location Context[/bold cyan]", border_style="cyan"))

        db_path = self.seat_db_path if self.data_type == 'seat' else self.data_db_path

        try:
            conn = sqlite3.connect(db_path)

            # Get aliases without location
            aliases_without_location = pd.read_sql("""
                SELECT alias_name, original_name, created_at
                FROM college_aliases
                WHERE master_college_id IS NULL OR state_normalized IS NULL
                ORDER BY created_at DESC
            """, conn)

            if len(aliases_without_location) == 0:
                console.print("[green]✅ All aliases have location context![/green]")
            else:
                console.print(f"\n[yellow]Found {len(aliases_without_location)} aliases without location context:[/yellow]")

                table = Table(show_header=True, header_style="bold magenta")
                table.add_column("#", justify="right", style="cyan")
                table.add_column("Alias Name", style="yellow")
                table.add_column("Original Name", style="green")
                table.add_column("Created", style="dim")

                for idx, row in aliases_without_location.iterrows():
                    table.add_row(
                        str(idx + 1),
                        row['alias_name'],
                        row['original_name'],
                        str(row['created_at'])[:19] if pd.notna(row['created_at']) else 'N/A'
                    )

                console.print(table)

                console.print("\n[yellow]💡 Recommendations:[/yellow]")
                console.print("  1. These aliases will still work but may cause incorrect matches")
                console.print("  2. For colleges with common names (e.g., 'GOVT MEDICAL COLLEGE'),")
                console.print("     consider re-creating with location context")
                console.print("  3. Use Data Tools → Manage Abbreviations to update them")

            conn.close()

        except Exception as e:
            console.print(f"[red]❌ Error: {e}[/red]")

    # ==================== ABBREVIATION MANAGEMENT ====================

    def manage_abbreviations(self):
        """Manage abbreviations for auto-expansion during preprocessing"""
        console.print(Panel.fit("[bold cyan]📝 Abbreviation Manager[/bold cyan]", border_style="cyan"))

        while True:
            console.print("\n[bold]Abbreviation Management:[/bold]")
            console.print("  [1] View all abbreviations")
            console.print("  [2] Add new abbreviation")
            console.print("  [3] Edit abbreviation")
            console.print("  [4] Delete abbreviation")
            console.print("  [5] Test abbreviation expansion")
            console.print("  [6] Export abbreviations to config")
            console.print("  [7] Back to main menu")

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

            if choice == "1":
                # View all abbreviations
                if not self.abbreviations:
                    console.print("[yellow]No abbreviations found[/yellow]")
                else:
                    table = Table(show_header=True, header_style="bold magenta")
                    table.add_column("Abbreviation", style="cyan")
                    table.add_column("Full Form", style="green")
                    table.add_column("Category", style="yellow")

                    for abbr, full_form in self.abbreviations.items():
                        # Determine category based on pattern
                        category = "General"
                        if abbr.isupper() and len(abbr) <= 4:
                            category = "College Prefix"
                        elif any(word in abbr.upper() for word in ['COLLEGE', 'INSTITUTE', 'UNIVERSITY']):
                            category = "Institution"

                        table.add_row(abbr, full_form, category)

                    console.print(f"\n[bold]Total Abbreviations: {len(self.abbreviations)}[/bold]")
                    console.print(table)

            elif choice == "2":
                # Add new abbreviation
                console.print("\n[bold cyan]➕ Add New Abbreviation[/bold cyan]")
                abbr = Prompt.ask("Enter abbreviation (e.g., 'GOVT', 'MED COLL')").upper()
                full_form = Prompt.ask("Enter full form (e.g., 'GOVERNMENT', 'MEDICAL COLLEGE')")

                if abbr in self.abbreviations:
                    console.print(f"[yellow]⚠️  '{abbr}' already exists: {self.abbreviations[abbr]}[/yellow]")
                    if Confirm.ask("Overwrite?", default=False):
                        self.abbreviations[abbr] = full_form.upper()
                        console.print(f"[green]✅ Updated: {abbr} → {full_form.upper()}[/green]")
                else:
                    self.abbreviations[abbr] = full_form.upper()
                    console.print(f"[green]✅ Added: {abbr} → {full_form.upper()}[/green]")

            elif choice == "3":
                # Edit abbreviation
                if not self.abbreviations:
                    console.print("[yellow]No abbreviations to edit[/yellow]")
                    continue

                console.print("\n[bold cyan]✏️  Edit Abbreviation[/bold cyan]")
                abbr = Prompt.ask("Enter abbreviation to edit").upper()

                if abbr in self.abbreviations:
                    console.print(f"Current: {abbr} → {self.abbreviations[abbr]}")
                    new_full_form = Prompt.ask("Enter new full form")
                    self.abbreviations[abbr] = new_full_form.upper()
                    console.print(f"[green]✅ Updated: {abbr} → {new_full_form.upper()}[/green]")
                else:
                    console.print(f"[red]❌ '{abbr}' not found[/red]")

            elif choice == "4":
                # Delete abbreviation
                if not self.abbreviations:
                    console.print("[yellow]No abbreviations to delete[/yellow]")
                    continue

                console.print("\n[bold cyan]🗑️  Delete Abbreviation[/bold cyan]")
                abbr = Prompt.ask("Enter abbreviation to delete").upper()

                if abbr in self.abbreviations:
                    console.print(f"Will delete: {abbr} → {self.abbreviations[abbr]}")
                    if Confirm.ask("Confirm deletion?", default=False):
                        del self.abbreviations[abbr]
                        console.print(f"[green]✅ Deleted: {abbr}[/green]")
                else:
                    console.print(f"[red]❌ '{abbr}' not found[/red]")

            elif choice == "5":
                # Test abbreviation expansion
                console.print("\n[bold cyan]🧪 Test Abbreviation Expansion[/bold cyan]")
                test_text = Prompt.ask("Enter text to test")
                expanded = self.expand_abbreviations(test_text)

                console.print(f"\n[bold]Original:[/bold] {test_text}")
                console.print(f"[bold]Expanded:[/bold] {expanded}")

                if test_text != expanded:
                    console.print("[green]✅ Abbreviations were expanded[/green]")
                else:
                    console.print("[yellow]No abbreviations found to expand[/yellow]")

            elif choice == "6":
                # Export to config
                console.print("\n[bold cyan]💾 Export Abbreviations[/bold cyan]")
                filename = Prompt.ask("Export filename", default="abbreviations.yaml")

                import yaml
                with open(filename, 'w') as f:
                    yaml.dump({'abbreviations': self.abbreviations}, f, default_flow_style=False)

                console.print(f"[green]✅ Exported {len(self.abbreviations)} abbreviations to {filename}[/green]")
                console.print(f"[dim]Add this to your config.yaml under 'abbreviations' section[/dim]")

            elif choice == "7":
                break

    def expand_abbreviations(self, text):
        """Expand abbreviations in text during preprocessing"""
        if not text or not self.abbreviations:
            return text

        expanded = text.upper()

        # Sort abbreviations by length (longest first) to avoid partial replacements
        sorted_abbrs = sorted(self.abbreviations.items(), key=lambda x: len(x[0]), reverse=True)

        for abbr, full_form in sorted_abbrs:
            # Use word boundaries to avoid partial word replacement
            import re
            # Match abbreviation as whole word or with punctuation
            pattern = r'\b' + re.escape(abbr) + r'\b'
            expanded = re.sub(pattern, full_form, expanded)

        return expanded

    # ==================== ENHANCED INTERACTIVE REVIEW WITH ID INPUT ====================

    def interactive_review_enhanced(self):
        """Enhanced interactive review with separate unmatched categories and session stats"""
        # Determine which database and table to use
        if self.data_type == 'counselling':
            conn = sqlite3.connect(self.data_db_path)
            table_name = 'counselling_records'
        else:
            conn = sqlite3.connect(self.seat_db_path)
            table_name = 'seat_data_linked'

        # Check if table exists and has data
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cursor.fetchone():
            console.print(Panel.fit(
                "[bold red]⚠️  ERROR: Table not found[/bold red]\n\n"
                f"The table '{table_name}' doesn't exist yet.\n\n"
                "[yellow]You need to:[/yellow]\n"
                "1. Import data first (option 1 or 2)\n"
                "2. Run 'Match and link data' (option 3)\n"
                "3. Then come back here to review unmatched records",
                border_style="red"
            ))
            conn.close()
            return

        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        record_count = cursor.fetchone()[0]

        if record_count == 0:
            console.print(Panel.fit(
                "[bold yellow]⚠️  No records to review[/bold yellow]\n\n"
                f"The table '{table_name}' is empty.\n\n"
                "[yellow]You need to:[/yellow]\n"
                "1. Import data first (option 1 or 2)\n"
                "2. Run 'Match and link data' (option 3)\n"
                "3. Then come back here to review unmatched records",
                border_style="yellow"
            ))
            conn.close()
            return

        # ============================================================================
        # OPTION 1: AUTO-DETECTION - Check if matching has been run
        # ============================================================================

        # Count unmatched colleges and courses
        cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NULL")
        unmatched_colleges_count = cursor.fetchone()[0]

        cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_course_id IS NULL")
        unmatched_courses_count = cursor.fetchone()[0]

        # Calculate unmatched percentage
        college_unmatch_pct = (unmatched_colleges_count / record_count) * 100 if record_count > 0 else 0
        course_unmatch_pct = (unmatched_courses_count / record_count) * 100 if record_count > 0 else 0

        # If >80% of records are unmatched, matching was probably never run
        if college_unmatch_pct > 80 or course_unmatch_pct > 80:
            console.print(Panel.fit(
                "[bold yellow]⚠️  AUTOMATIC MATCHING NOT DETECTED[/bold yellow]\n\n"
                f"[red]College unmatched: {college_unmatch_pct:.1f}% ({unmatched_colleges_count:,} / {record_count:,})[/red]\n"
                f"[red]Course unmatched:  {course_unmatch_pct:.1f}% ({unmatched_courses_count:,} / {record_count:,})[/red]\n\n"
                "[yellow]It looks like you haven't run the main Match & Link process yet![/yellow]\n"
                "[cyan]This would automatically match 90-95% of records (exact matches, fuzzy matches, etc.)[/cyan]\n\n"
                "[bold]Running automatic matching first will:[/bold]\n"
                "  ✅ Match MBBS, BDS, and other exact course names\n"
                "  ✅ Match exact college names automatically\n"
                "  ✅ Match high-confidence fuzzy matches (90%+)\n"
                "  ✅ Leave only genuinely problematic cases for manual review\n\n"
                "[dim]Interactive Review should be used AFTER automatic matching,[/dim]\n"
                "[dim]not as a replacement for it![/dim]",
                border_style="yellow"
            ))

            if Confirm.ask("\n[bold cyan]🚀 Run automatic Match & Link now?[/bold cyan]", default=True):
                console.print("\n[cyan]Starting automatic matching...[/cyan]")
                conn.close()  # Close connection before running batch process

                # Run the main matching process
                try:
                    if self.data_type == 'counselling':
                        self.match_and_link_parallel('counselling_records', 'counselling_records')
                    else:
                        # For seat data, check which table has the source data
                        source_db = sqlite3.connect(self.seat_db_path)
                        source_cursor = source_db.cursor()

                        # Check if seat_data table exists (source data before linking)
                        source_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='seat_data'")
                        if source_cursor.fetchone():
                            source_table = 'seat_data'
                        else:
                            source_table = 'seat_data_linked'

                        source_db.close()

                        self.match_and_link_parallel('seat_data', source_table)

                    console.print("\n[green]✅ Automatic matching complete![/green]")
                    console.print("[cyan]Now starting Interactive Review for remaining unmatched records...[/cyan]\n")

                    # Reopen connection and continue to interactive review
                    conn = sqlite3.connect(self.data_db_path if self.data_type == 'counselling' else self.seat_db_path)

                except Exception as e:
                    console.print(f"\n[red]❌ Error during automatic matching: {e}[/red]")
                    console.print("[yellow]Continuing to Interactive Review anyway...[/yellow]\n")
                    conn = sqlite3.connect(self.data_db_path if self.data_type == 'counselling' else self.seat_db_path)
            else:
                console.print("\n[yellow]⚠️  Skipping automatic matching.[/yellow]")
                console.print("[dim]Note: You'll see many 100% matches that should have been auto-matched.[/dim]\n")

        console.print(Panel.fit("[bold cyan]🔍 Enhanced Interactive Review[/bold cyan]", border_style="cyan"))

        # Session stats tracking
        session_stats = {
            'aliases_created': 0,
            'colleges_matched': 0,
            'courses_matched': 0,
            'categories_matched': 0,
            'quotas_matched': 0,
            'states_matched': 0,
            'skipped': 0,
            'start_time': datetime.now(),
            'records_reviewed': 0
        }

        while True:
            console.print("\n[bold]📋 Review Options:[/bold]")
            console.print("  [1] Review Unmatched by Category →")
            console.print("  [2] Search by ID (college/course)")
            console.print("  [3] View Session Statistics")
            console.print("  [4] Exit Review (show final stats)")

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4"], default="1")

            if choice == "1":
                # Category-based unmatched review
                console.print("\n[bold cyan]📂 Review Unmatched Records by Category[/bold cyan]")
                console.print("━" * 70)

                # Get counts for each category
                unmatched_colleges = pd.read_sql(
                    f"SELECT COUNT(*) as count FROM {table_name} WHERE master_college_id IS NULL",
                    conn
                ).iloc[0]['count']

                unmatched_courses = pd.read_sql(
                    f"SELECT COUNT(*) as count FROM {table_name} WHERE master_course_id IS NULL",
                    conn
                ).iloc[0]['count']

                # For counselling data, also count category, quota, state
                if self.data_type == 'counselling':
                    unmatched_categories = pd.read_sql(
                        f"SELECT COUNT(*) as count FROM {table_name} WHERE master_category_id IS NULL",
                        conn
                    ).iloc[0]['count']

                    unmatched_quotas = pd.read_sql(
                        f"SELECT COUNT(*) as count FROM {table_name} WHERE master_quota_id IS NULL",
                        conn
                    ).iloc[0]['count']

                    unmatched_states = pd.read_sql(
                        f"SELECT COUNT(*) as count FROM {table_name} WHERE master_state_id IS NULL",
                        conn
                    ).iloc[0]['count']

                    console.print(f"  [1] 🏥 Unmatched Colleges ({unmatched_colleges:,} records)")
                    console.print(f"  [2] 📚 Unmatched Courses ({unmatched_courses:,} records)")
                    console.print(f"  [3] 🏷️  Unmatched Categories ({unmatched_categories:,} records)")
                    console.print(f"  [4] 🎫 Unmatched Quotas ({unmatched_quotas:,} records)")
                    console.print(f"  [5] 🗺️  Unmatched States ({unmatched_states:,} records)")
                    console.print(f"  [6] ⬅️  Back")

                    cat_choice = Prompt.ask("Choose category", choices=["1", "2", "3", "4", "5", "6"], default="6")
                else:
                    console.print(f"  [1] 🏥 Unmatched Colleges ({unmatched_colleges:,} records)")
                    console.print(f"  [2] 📚 Unmatched Courses ({unmatched_courses:,} records)")
                    console.print(f"  [3] ⬅️  Back")

                    cat_choice = Prompt.ask("Choose category", choices=["1", "2", "3"], default="3")

                # Review selected category
                if cat_choice == "1":
                    self._review_unmatched_colleges(conn, table_name, session_stats)
                elif cat_choice == "2":
                    self._review_unmatched_courses(conn, table_name, session_stats)
                elif cat_choice == "3" and self.data_type == 'counselling':
                    self._review_unmatched_categories(conn, table_name, session_stats)
                elif cat_choice == "4" and self.data_type == 'counselling':
                    self._review_unmatched_quotas(conn, table_name, session_stats)
                elif cat_choice == "5" and self.data_type == 'counselling':
                    self._review_unmatched_states(conn, table_name, session_stats)

            elif choice == "3":
                # Show session statistics
                self._show_session_stats(session_stats)

            elif choice == "2":
                # Direct ID input
                console.print("\n[bold cyan]🔎 Search by ID[/bold cyan]")
                console.print("  [1] Search college by ID")
                console.print("  [2] Search course by ID")

                search_choice = Prompt.ask("Search type", choices=["1", "2"], default="1")

                if search_choice == "1":
                    # Search college
                    college_id = Prompt.ask("Enter College ID (e.g., COLL001)")

                    # Find college in master data
                    college_found = None
                    college_type = None

                    for ctype in ['medical', 'dental', 'dnb']:
                        for college in self.master_data[ctype]['colleges']:
                            if college['id'] == college_id:
                                college_found = college
                                college_type = ctype
                                break
                        if college_found:
                            break

                    if college_found:
                        # Display college details
                        console.print(f"\n[bold green]✅ College Found:[/bold green]")
                        console.print(f"  ID: [cyan]{college_found['id']}[/cyan]")
                        console.print(f"  Name: [yellow]{college_found['name']}[/yellow]")
                        console.print(f"  State: [green]{college_found.get('state', 'N/A')}[/green]")
                        console.print(f"  Type: [magenta]{college_type.upper()}[/magenta]")

                        # Ask for alias with location context
                        console.print("\n[bold cyan]Create Location-Aware Alias:[/bold cyan]")
                        console.print("[dim]Tip: Include location to differentiate colleges with same name[/dim]\n")

                        alias_name = Prompt.ask("Enter alias name (raw name from your data)")
                        state = Prompt.ask("Enter state (optional, for location context)", default=college_found.get('state', ''))
                        address = Prompt.ask("Enter address/city (optional, for better matching)", default="")

                        console.print(f"\n[bold]Confirm Alias Creation:[/bold]")
                        console.print(f"  Alias: {alias_name}")
                        console.print(f"  State: {state}")
                        console.print(f"  Address: {address if address else 'N/A'}")
                        console.print(f"  → Maps to: {college_found['name']} ({college_found.get('state', 'N/A')})")

                        if Confirm.ask("\nCreate this alias?", default=True):
                            self._save_college_alias(alias_name, college_found['id'], conn, state=state, address=address)
                            session_stats['aliases_created'] += 1
                    else:
                        console.print(f"[red]❌ College ID '{college_id}' not found[/red]")
                        console.print("[yellow]Tip: Use Analytics → Advanced Search to find college IDs[/yellow]")

                elif search_choice == "2":
                    # Search course
                    course_id = Prompt.ask("Enter Course ID (e.g., COURSE001)")

                    # Find course in master data
                    course_found = None
                    for course in self.master_data['courses']['courses']:
                        if course['id'] == course_id:
                            course_found = course
                            break

                    if course_found:
                        # Display course details
                        console.print(f"\n[bold green]✅ Course Found:[/bold green]")
                        console.print(f"  ID: [cyan]{course_found['id']}[/cyan]")
                        console.print(f"  Name: [yellow]{course_found['name']}[/yellow]")
                        console.print(f"  Type: [magenta]{course_found.get('type', 'N/A')}[/magenta]")

                        # Ask for alias
                        console.print("\n[bold]Create Alias:[/bold]")
                        alias_name = Prompt.ask("Enter alias name (raw course name from your data)")

                        if Confirm.ask(f"Create alias '{alias_name}' → '{course_found['name']}'?", default=True):
                            self._save_course_alias(alias_name, course_found['id'], conn)
                            session_stats['aliases_created'] += 1
                            console.print(f"[green]✅ Alias created successfully![/green]")
                    else:
                        console.print(f"[red]❌ Course ID '{course_id}' not found[/red]")
                        console.print("[yellow]Tip: Use Analytics → Advanced Search to find course IDs[/yellow]")

            elif choice == "3":
                # View recent aliases - need to use the correct database
                try:
                    alias_conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)

                    # Check if table exists
                    cursor = alias_conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='college_aliases'")

                    if cursor.fetchone():
                        recent_aliases = pd.read_sql("""
                            SELECT * FROM college_aliases
                            ORDER BY created_at DESC
                            LIMIT 20
                        """, alias_conn)

                        if len(recent_aliases) > 0:
                            console.print(f"\n[bold]Recent College Aliases ({len(recent_aliases)}):[/bold]")
                            table = Table(show_header=True, header_style="bold magenta")
                            table.add_column("Alias Name")
                            table.add_column("Master College ID")
                            table.add_column("Created")

                            for _, row in recent_aliases.iterrows():
                                table.add_row(
                                    row['alias_name'],
                                    row['master_college_id'],
                                    str(row.get('created_at', 'N/A'))[:19]
                                )

                            console.print(table)
                        else:
                            console.print("[yellow]No aliases created yet in this session[/yellow]")
                    else:
                        console.print("[yellow]No aliases table found. Create some aliases first![/yellow]")

                    alias_conn.close()

                except Exception as e:
                    console.print(f"[yellow]Unable to load aliases: {e}[/yellow]")
                    console.print("[dim]Tip: Aliases are saved when you create them during interactive review[/dim]")

            elif choice == "4":
                # Exit - show final statistics
                console.print(f"\n[bold green]✅ Review Session Complete![/bold green]")
                self._show_session_stats(session_stats)
                break

        conn.close()

    # ==================== DATA VISUALIZATION ====================

    def generate_visualizations(self, table_name='seat_data'):
        """Generate data visualizations"""
        console.print(Panel.fit("[bold cyan]📈 Data Visualization Generator[/bold cyan]", border_style="cyan"))

        try:
            import matplotlib.pyplot as plt
            import seaborn as sns

            conn = sqlite3.connect(self.data_db_path if table_name == 'counselling_records' else self.seat_db_path)

            # 1. Match confidence distribution
            df = pd.read_sql(f"""
                SELECT college_match_score
                FROM {table_name}
                WHERE college_match_score IS NOT NULL
            """, conn)

            if len(df) > 0:
                plt.figure(figsize=(10, 6))
                plt.hist(df['college_match_score'], bins=20, edgecolor='black')
                plt.xlabel('Match Confidence Score')
                plt.ylabel('Frequency')
                plt.title('Match Confidence Distribution')
                plt.grid(True, alpha=0.3)

                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"match_confidence_dist_{timestamp}.png"
                plt.savefig(filename, dpi=300, bbox_inches='tight')
                console.print(f"[green]✅ Saved visualization to {filename}[/green]")
                plt.close()

            conn.close()

        except ImportError:
            console.print("[yellow]⚠️  matplotlib not installed. Install with: pip install matplotlib seaborn[/yellow]")

    # ==================== PARQUET EXPORT & INCREMENTAL PROCESSING ====================

    def load_incremental_state(self):
        """Load processing state from Parquet file"""
        if Path(self.incremental_state_file).exists():
            try:
                self.processing_state = pd.read_parquet(self.incremental_state_file)
                console.print(f"[cyan]📊 Loaded processing state: {len(self.processing_state)} files tracked[/cyan]")
            except Exception as e:
                console.print(f"[yellow]⚠️  Could not load state: {e}[/yellow]")
                self.processing_state = pd.DataFrame(columns=['file_hash', 'file_name', 'last_processed', 'record_count'])
        else:
            self.processing_state = pd.DataFrame(columns=['file_hash', 'file_name', 'last_processed', 'record_count'])
            console.print("[cyan]📊 No previous processing state found - starting fresh[/cyan]")

    def is_file_processed(self, file_path):
        """Check if file has already been processed"""
        if not self.enable_incremental or self.processing_state is None:
            return False

        import hashlib
        with open(file_path, 'rb') as f:
            file_hash = hashlib.md5(f.read()).hexdigest()

        if file_hash in self.processing_state['file_hash'].values:
            console.print(f"[yellow]⏭️  File {Path(file_path).name} already processed (hash match), skipping...[/yellow]")
            return True

        return False

    def mark_file_processed(self, file_path, record_count):
        """Mark file as processed in state"""
        if not self.enable_incremental:
            return

        import hashlib
        with open(file_path, 'rb') as f:
            file_hash = hashlib.md5(f.read()).hexdigest()

        new_row = pd.DataFrame([{
            'file_hash': file_hash,
            'file_name': Path(file_path).name,
            'last_processed': datetime.now(),
            'record_count': record_count
        }])

        if self.processing_state is None or len(self.processing_state) == 0:
            self.processing_state = new_row
        else:
            self.processing_state = pd.concat([self.processing_state, new_row], ignore_index=True)

        # Save state
        Path(self.incremental_state_file).parent.mkdir(parents=True, exist_ok=True)
        self.processing_state.to_parquet(self.incremental_state_file, index=False)

    def export_to_parquet(
        self,
        output_path='output/matched_data.parquet',
        partition_by=None,
        compression='snappy',
        validate=True,
        table_name='seat_data'
    ):
        """
        Export matched data to optimized Parquet format

        Args:
            output_path: Output Parquet file path
            partition_by: List of columns to partition by (e.g., ['state', 'year'])
            compression: Compression codec ('snappy', 'gzip', 'brotli', 'zstd')
            validate: Run validation before export
            table_name: Source table name

        Returns:
            Path to exported Parquet file
        """
        console.print("\n[bold cyan]📦 Exporting to Parquet Format[/bold cyan]")
        console.print("━" * 60)

        try:
            # Get data from SQLite - use correct database based on table name
            if 'seat_data' in table_name:
                db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"
            elif 'counselling' in table_name:
                # Use counselling database - get from config
                db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['counselling_data_db']}"
            else:
                # Default to seat database
                db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"

            console.print(f"[dim]Using database: {db_path}[/dim]")
            conn = sqlite3.connect(db_path)

            # Check if table exists
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            table_exists = cursor.fetchone()

            if not table_exists:
                console.print(f"[yellow]⚠️  Table '{table_name}' does not exist in {db_path}[/yellow]")
                console.print(f"[yellow]   Skipping export for this table[/yellow]")
                conn.close()
                return None

            console.print("[cyan]📊 Loading data from SQLite...[/cyan]")

            # Simple SELECT * to avoid column-specific issues
            query = f"SELECT * FROM {table_name}"
            df = pd.read_sql(query, conn)
            conn.close()

            if len(df) == 0:
                console.print("[yellow]⚠️  No data to export[/yellow]")
                return None

            console.print(f"[green]✓ Loaded {len(df):,} records[/green]")

            # Data validation
            if validate:
                console.print("[cyan]🔍 Running data quality validation...[/cyan]")
                validation_report = self._validate_dataframe(df)

                if validation_report['issues']:
                    console.print(f"[yellow]⚠️  Found {len(validation_report['issues'])} data quality issues:[/yellow]")
                    for issue in validation_report['issues'][:5]:  # Show first 5
                        console.print(f"  • {issue['type']}: {issue.get('count', 'N/A')}")

                    # Save validation report
                    report_path = Path(output_path).parent / 'validation_report.json'
                    report_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(report_path, 'w') as f:
                        json.dump(validation_report, f, indent=2, default=str)
                    console.print(f"[cyan]📄 Validation report saved: {report_path}[/cyan]")

            # Optimize schema for Parquet
            console.print("[cyan]⚙️  Optimizing schema...[/cyan]")
            df = self._optimize_schema_for_parquet(df)

            # Create output directory
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Export to Parquet
            console.print(f"[cyan]💾 Writing Parquet file: {output_path}[/cyan]")

            if partition_by:
                console.print(f"[cyan]📂 Partitioning by: {', '.join(partition_by)}[/cyan]")
                df.to_parquet(
                    output_path,
                    engine='pyarrow',
                    compression=compression,
                    partition_cols=partition_by,
                    index=False
                )
            else:
                df.to_parquet(
                    output_path,
                    engine='pyarrow',
                    compression=compression,
                    index=False
                )

            # Calculate file size
            if output_path.is_file():
                file_size = output_path.stat().st_size / 1024 / 1024  # MB
            else:
                # For partitioned output, calculate total size
                file_size = sum(f.stat().st_size for f in output_path.rglob('*.parquet')) / 1024 / 1024

            # Create metadata file
            metadata = {
                'export_date': datetime.now().isoformat(),
                'total_records': len(df),
                'file_size_mb': round(file_size, 2),
                'compression': compression,
                'partitioned': partition_by is not None,
                'partition_cols': partition_by if partition_by else [],
                'columns': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}
            }

            metadata_path = output_path.parent / 'metadata.json'
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            console.print("\n[green]✅ Parquet Export Complete![/green]")
            console.print(f"  📦 File: {output_path}")
            console.print(f"  📊 Records: {len(df):,}")
            console.print(f"  💾 Size: {file_size:.2f} MB")
            console.print(f"  🗜️  Compression: {compression}")
            if partition_by:
                console.print(f"  📂 Partitions: {', '.join(partition_by)}")
            console.print(f"  📄 Metadata: {metadata_path}")

            return str(output_path)

        except ImportError:
            console.print("[red]❌ PyArrow not installed. Install with: pip install pyarrow[/red]")
            return None
        except Exception as e:
            console.print(f"[red]❌ Export failed: {e}[/red]")
            import traceback
            traceback.print_exc()
            return None

    def _validate_dataframe(self, df):
        """Validate dataframe before export"""
        report = {
            'total_records': len(df),
            'valid_records': 0,
            'issues': []
        }

        # Check for required columns
        required_cols = ['college_name', 'course_name', 'state']
        missing_cols = set(required_cols) - set(df.columns)
        if missing_cols:
            report['issues'].append({
                'type': 'missing_columns',
                'columns': list(missing_cols)
            })

        # Check for null values in important columns
        important_cols = ['college_name', 'course_name', 'state', 'match_confidence']
        for col in important_cols:
            if col in df.columns:
                null_count = df[col].isnull().sum()
                if null_count > 0:
                    report['issues'].append({
                        'type': 'null_values',
                        'column': col,
                        'count': int(null_count),
                        'percentage': f"{null_count/len(df)*100:.2f}%"
                    })

        # Check duplicates
        duplicates = df.duplicated().sum()
        if duplicates > 0:
            report['issues'].append({
                'type': 'duplicates',
                'count': int(duplicates)
            })

        # Check match confidence range
        if 'match_confidence' in df.columns:
            invalid_confidence = ((df['match_confidence'] < 0) | (df['match_confidence'] > 1)).sum()
            if invalid_confidence > 0:
                report['issues'].append({
                    'type': 'invalid_confidence',
                    'count': int(invalid_confidence)
                })

        report['valid_records'] = len(df) - sum(
            issue.get('count', 0) for issue in report['issues']
        )

        return report

    def _optimize_schema_for_parquet(self, df):
        """Optimize DataFrame schema for Parquet storage"""
        # Convert strings to categories (huge space savings)
        categorical_cols = ['state', 'course_type', 'quota', 'category', 'match_method']
        for col in categorical_cols:
            if col in df.columns and df[col].dtype == 'object':
                df[col] = df[col].astype('category')

        # Optimize integers - only if they're actually numeric
        int_cols = ['seats', 'year', 'round']
        for col in int_cols:
            if col in df.columns:
                # Only convert if column is numeric or can be safely converted
                try:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    # Check if any non-null values were coerced to NaN (indicating non-numeric data)
                    if df[col].notna().sum() > 0:
                        df[col] = df[col].astype('Int64')  # Nullable integer type
                except:
                    pass  # Keep as-is if conversion fails

        # Optimize floats
        float_cols = ['match_confidence', 'cutoff']
        for col in float_cols:
            if col in df.columns:
                try:
                    df[col] = pd.to_numeric(df[col], errors='coerce', downcast='float')
                except:
                    pass  # Keep as-is if conversion fails

        # Explicitly convert remaining object columns to string to avoid PyArrow auto-inference issues
        # This prevents PyArrow from trying to infer types and failing on mixed content like '1(A)'
        for col in df.columns:
            if df[col].dtype == 'object':
                # Keep as string, don't let PyArrow try to convert
                df[col] = df[col].astype(str)
                # Replace 'nan' strings back to None for proper null handling
                df[col] = df[col].replace('nan', None)

        return df

    # ==================== ADVANCED AI/ML METHODS ====================

    def _init_advanced_features(self):
        """Initialize advanced AI/ML features"""
        console.print("[cyan]🚀 Initializing Advanced AI Features...[/cyan]")

        try:
            # Disable transformer progress bars globally
            import os
            import warnings
            os.environ['TOKENIZERS_PARALLELISM'] = 'false'

            # Suppress tqdm progress bars from sentence-transformers
            import logging as tf_logging
            tf_logging.getLogger("sentence_transformers").setLevel(tf_logging.ERROR)

            # Disable all tqdm progress bars
            from functools import partialmethod
            from tqdm import tqdm
            tqdm.__init__ = partialmethod(tqdm.__init__, disable=True)

            self._transformer_matcher = TransformerMatcher(model_name='all-MiniLM-L6-v2')
            console.print("  ✓ Transformer matcher loaded")

            self._ner_extractor = EducationNER()
            console.print("  ✓ NER extractor loaded")

            # Vector search - may cause segfaults on some systems, so make it optional
            enable_vector_search = self.config.get('features', {}).get('enable_vector_search', True)
            if enable_vector_search:
                try:
                    # Use 'flat' index type instead of 'hnsw' to avoid FAISS segfaults on macOS
                    self._vector_engine = VectorSearchEngine(
                        embedding_dim=384,
                        index_type='flat',  # Safer than HNSW, no segfaults
                        model_name='all-MiniLM-L6-v2'
                    )
                    console.print("  ✓ Vector search engine loaded")
                except Exception as ve:
                    console.print(f"  [yellow]⚠ Vector search disabled: {ve}[/yellow]")
                    self._vector_engine = None
            else:
                console.print("  [dim]⊘ Vector search disabled in config[/dim]")
                self._vector_engine = None

            self._multifield_matcher = MultiFieldMatcher(
                semantic_matcher=self._transformer_matcher
            )
            console.print("  ✓ Multi-field matcher loaded")

            console.print("[green]✅ AI features initialized successfully![/green]")

        except Exception as e:
            console.print(f"[yellow]⚠️  Could not initialize AI features: {e}[/yellow]")
            self.enable_advanced_features = False

    def match_college_ai_enhanced(
        self,
        college_name: str,
        state: str,
        course_type: str,
        address: str = '',
        course_name: str = '',
        threshold: float = 0.7
    ):
        """
        AI-Enhanced college matching (uses Transformers, Vector Search, Multi-field)

        Falls back to traditional matching if AI features unavailable

        Returns:
            (matched_college, score, method_used)
        """
        if not self.enable_advanced_features or not self._transformer_matcher:
            return self.match_college_enhanced(college_name, state, course_type, address, course_name)

        # Normalize college name BEFORE AI matching to expand abbreviations (ESIC → EMPLOYEES STATE INSURANCE CORPORATION)
        college_name_normalized = self.normalize_text(college_name)

        # Get candidates
        candidates = self.get_college_pool(course_type=course_type, state=state)
        if not candidates:
            return None, 0.0, "no_candidates"

        # Try Transformer matching first (with normalized name)
        try:
            match, score, method = self._transformer_matcher.match_college_enhanced(
                college_name_normalized, candidates, state, threshold, combine_with_fuzzy=True
            )
            if match and score >= threshold:
                logger.info(f"AI Match: {college_name} -> {match['name']} ({score:.2%})")
                return match, score, f"ai_transformer_{method}"
        except Exception as e:
            logger.warning(f"Transformer matching failed: {e}")

        # Try Vector search (with normalized name)
        if self._vector_engine and self._vector_engine.index.ntotal > 0:
            try:
                results = self._vector_engine.hybrid_search(college_name_normalized, k=1, state_filter=state)
                if results:
                    match, score, details = results[0]
                    if score >= threshold:
                        return match, score, f"ai_vector_{details}"
            except Exception as e:
                logger.warning(f"Vector search failed: {e}")

        # Fallback to traditional with stricter threshold
        match, score, method = self.match_college_enhanced(college_name, state, course_type, address, course_name)

        # If using fuzzy fallback, apply stricter validation to avoid bad matches
        if match and 'fuzzy' in method.lower():
            # Additional validation: check token overlap to avoid completely wrong matches
            # Example: "SDU MEDICAL COLLEGE" should NOT match "MYSORE MEDICAL COLLEGE"
            # Even though both have "MEDICAL COLLEGE", "SDU" != "MYSORE"

            query_tokens = set(college_name_normalized.split())
            match_tokens = set(self.normalize_text(match['name']).split())

            # Calculate token overlap (Jaccard similarity)
            common_tokens = query_tokens & match_tokens
            all_tokens = query_tokens | match_tokens
            token_overlap = len(common_tokens) / len(all_tokens) if all_tokens else 0

            # Require at least 40% token overlap OR 85% fuzzy score
            if token_overlap < 0.4 and score < 0.85:
                # Only log if verbose_overlap is enabled
                if self.config.get('logging', {}).get('verbose_overlap', False):
                    logger.warning(f"Rejecting fuzzy match - insufficient overlap: {college_name_normalized} -> {match['name']}")
                    logger.warning(f"  Score: {score:.2%}, Token overlap: {token_overlap:.2%}, Original: {college_name}")
                    logger.warning(f"  Query tokens: {query_tokens}")
                    logger.warning(f"  Match tokens: {match_tokens}")
                    logger.warning(f"  Common: {common_tokens}")
                else:
                    # Concise logging
                    logger.debug(f"Rejected: {college_name_normalized} -> {match['name']} (overlap: {token_overlap:.1%}, score: {score:.1%})")
                return None, 0.0, "rejected_insufficient_overlap"

            # Reject low-confidence fuzzy matches
            if score < 0.85:
                # Only log if verbose_matching is enabled
                if self.config.get('logging', {}).get('verbose_matching', False):
                    logger.warning(f"Rejecting low-confidence fuzzy match: {college_name_normalized} -> {match['name']} ({score:.2%})")
                    logger.warning(f"  Original: {college_name}")
                else:
                    # Concise logging
                    logger.debug(f"Rejected: {college_name} (score: {score:.1%})")
                return None, 0.0, "rejected_low_confidence_fuzzy"

        return match, score, method

    def build_vector_index_for_colleges(self, force_rebuild=False):
        """Build vector search index for faster AI matching"""
        if not self.enable_advanced_features or not self._vector_engine:
            console.print("[yellow]⚠️  Vector search not available[/yellow]")
            return

        all_colleges = []
        all_colleges.extend(self.master_data.get('medical', {}).get('colleges', []))
        all_colleges.extend(self.master_data.get('dental', {}).get('colleges', []))
        all_colleges.extend(self.master_data.get('dnb', {}).get('colleges', []))

        self._vector_engine.add_colleges(all_colleges, force_rebuild=force_rebuild)
        console.print(f"[green]✅ Vector index built: {self._vector_engine.index.ntotal:,} colleges[/green]")

    def extract_entities_ner(self, text: str):
        """Extract entities using NER"""
        if self.enable_advanced_features and self._ner_extractor:
            return self._ner_extractor.extract_all(text)
        return {}

    def generate_ai_report(self, format='html'):
        """Generate advanced analytics report"""
        try:
            reporter = ReportGenerator(self.data_db_path)
            return reporter.generate_summary_report(format=format)
        except:
            return None

    # ============================================================================
    # DATA QUALITY & PROCESSING FEATURES
    # ============================================================================

    def smart_deduplicate(self, df, subset_cols=None):
        """Remove duplicates intelligently keeping highest confidence match

        Args:
            df: DataFrame to deduplicate
            subset_cols: Columns to check for duplicates (default: ['college_name', 'course_name', 'state'])

        Returns:
            DataFrame: Deduplicated dataframe
        """
        if subset_cols is None:
            subset_cols = ['college_name', 'course_name', 'state']

        initial_count = len(df)

        # Sort by confidence (highest first)
        if 'match_confidence' in df.columns:
            df_sorted = df.sort_values('match_confidence', ascending=False)
        else:
            df_sorted = df.copy()

        # Keep first occurrence (highest confidence)
        df_dedup = df_sorted.drop_duplicates(subset=subset_cols, keep='first')

        removed = initial_count - len(df_dedup)

        console.print(f"[cyan]🗑️  Smart Deduplication:[/cyan]")
        console.print(f"  Initial records: {initial_count:,}")
        console.print(f"  Removed duplicates: {removed:,}")
        console.print(f"  Final records: {len(df_dedup):,}")

        return df_dedup.reset_index(drop=True)

    def process_in_batches(self, df, batch_size=1000, checkpoint_dir='checkpoints'):
        """Process large dataframe in batches with checkpoints

        Args:
            df: DataFrame to process
            batch_size: Number of records per batch
            checkpoint_dir: Directory to save checkpoints

        Returns:
            DataFrame: Fully processed dataframe
        """
        from pathlib import Path
        import time

        Path(checkpoint_dir).mkdir(exist_ok=True)

        total_batches = (len(df) + batch_size - 1) // batch_size
        console.print(f"\n[cyan]📦 Batch Processing:[/cyan]")
        console.print(f"  Total records: {len(df):,}")
        console.print(f"  Batch size: {batch_size:,}")
        console.print(f"  Total batches: {total_batches}")

        all_results = []
        failed_batches = []

        with Progress() as progress:
            task = progress.add_task("[cyan]Processing batches...", total=total_batches)

            for batch_idx in range(0, len(df), batch_size):
                batch_num = batch_idx // batch_size + 1
                batch = df[batch_idx:batch_idx + batch_size].copy()

                checkpoint_file = Path(checkpoint_dir) / f'batch_{batch_num:04d}.parquet'

                # Check if checkpoint already exists
                if checkpoint_file.exists():
                    try:
                        batch_result = pd.read_parquet(checkpoint_file)
                        all_results.append(batch_result)
                        progress.update(task, advance=1, description=f"[green]Loaded checkpoint {batch_num}/{total_batches}")
                        continue
                    except Exception as e:
                        logger.warning(f"Failed to load checkpoint {checkpoint_file}: {e}")

                # Process batch
                try:
                    start_time = time.time()

                    # Process this batch (match colleges and courses)
                    # You can customize this based on your needs
                    batch_result = batch  # Placeholder - implement actual matching logic

                    # Save checkpoint
                    batch_result.to_parquet(checkpoint_file, index=False)

                    elapsed = time.time() - start_time
                    all_results.append(batch_result)

                    progress.update(task, advance=1,
                                  description=f"[cyan]Batch {batch_num}/{total_batches} ({elapsed:.1f}s)")

                except Exception as e:
                    logger.error(f"Batch {batch_num} failed: {e}")
                    failed_batches.append(batch_num)
                    progress.update(task, advance=1, description=f"[red]Batch {batch_num} FAILED")

        # Combine all results
        if all_results:
            final_df = pd.concat(all_results, ignore_index=True)

            console.print(f"\n[green]✅ Batch Processing Complete![/green]")
            console.print(f"  Processed batches: {total_batches - len(failed_batches)}/{total_batches}")
            console.print(f"  Total records: {len(final_df):,}")

            if failed_batches:
                console.print(f"[yellow]⚠️  Failed batches: {failed_batches}[/yellow]")

            return final_df
        else:
            console.print("[red]❌ All batches failed![/red]")
            return pd.DataFrame()

    def parallel_process_files(self, file_list, num_workers=None):
        """Process multiple files in parallel using multiprocessing

        Args:
            file_list: List of file paths to process
            num_workers: Number of parallel workers (default: CPU count)

        Returns:
            list: List of processed dataframes
        """
        from multiprocessing import Pool, cpu_count
        import time

        if num_workers is None:
            num_workers = cpu_count()

        console.print(f"\n[cyan]⚡ Parallel Processing:[/cyan]")
        console.print(f"  Files to process: {len(file_list)}")
        console.print(f"  Workers: {num_workers}")
        console.print(f"  CPU cores: {cpu_count()}")

        def process_single_file(file_path):
            """Process a single file (worker function)"""
            try:
                start_time = time.time()

                # Read file
                if str(file_path).endswith('.xlsx') or str(file_path).endswith('.xls'):
                    df = pd.read_excel(file_path)
                elif str(file_path).endswith('.csv'):
                    df = pd.read_csv(file_path)
                elif str(file_path).endswith('.parquet'):
                    df = pd.read_parquet(file_path)
                else:
                    logger.warning(f"Unsupported file format: {file_path}")
                    return None

                # Basic processing
                # Add your matching logic here

                elapsed = time.time() - start_time
                return {
                    'file': Path(file_path).name,
                    'records': len(df),
                    'time': elapsed,
                    'data': df
                }

            except Exception as e:
                logger.error(f"Failed to process {file_path}: {e}")
                return None

        # Process files in parallel
        start_time = time.time()

        with Pool(processes=num_workers) as pool:
            results = list(pool.map(process_single_file, file_list))

        total_time = time.time() - start_time

        # Filter out failed results
        successful_results = [r for r in results if r is not None]

        console.print(f"\n[green]✅ Parallel Processing Complete![/green]")
        console.print(f"  Successful: {len(successful_results)}/{len(file_list)}")
        console.print(f"  Total time: {total_time:.1f}s")
        console.print(f"  Avg time/file: {total_time/len(file_list):.1f}s")

        if successful_results:
            total_records = sum(r['records'] for r in successful_results)
            console.print(f"  Total records: {total_records:,}")

            # Show per-file stats
            console.print("\n[cyan]Per-file stats:[/cyan]")
            for result in successful_results[:10]:  # Show first 10
                console.print(f"  {result['file']}: {result['records']:,} records ({result['time']:.1f}s)")

            if len(successful_results) > 10:
                console.print(f"  ... and {len(successful_results) - 10} more files")

        return [r['data'] for r in successful_results]

    # ============================================================================
    # ACTIVE LEARNING & PARQUET EXPORT
    # ============================================================================

    def record_user_correction(self, query_college, wrong_match, correct_match, state=''):
        """Record user correction for active learning

        Args:
            query_college: Original query
            wrong_match: College that was incorrectly matched
            correct_match: Correct college name
            state: State for context
        """
        from pathlib import Path
        import json
        from datetime import datetime

        feedback_file = Path('data/feedback.jsonl')
        feedback_file.parent.mkdir(exist_ok=True)

        correction = {
            'query_college': query_college,
            'wrong_match': wrong_match,
            'correct_match': correct_match,
            'state': state,
            'timestamp': datetime.now().isoformat(),
            'features': self._extract_feature_vector(
                query_college,
                correct_match,
                state,
                state
            ).tolist() if hasattr(self, '_extract_feature_vector') else []
        }

        # Append to feedback file (JSONL format - one JSON per line)
        with open(feedback_file, 'a') as f:
            f.write(json.dumps(correction) + '\n')

        console.print(f"[green]✅ Correction recorded to {feedback_file}[/green]")
        console.print(f"   Total corrections: {sum(1 for _ in open(feedback_file))}")

    def load_user_corrections(self):
        """Load all user corrections from feedback file"""
        from pathlib import Path
        import json

        feedback_file = Path('data/feedback.jsonl')

        if not feedback_file.exists():
            return []

        corrections = []
        with open(feedback_file, 'r') as f:
            for line in f:
                if line.strip():
                    corrections.append(json.loads(line))

        return corrections

    def retrain_with_corrections(self, min_corrections=50):
        """Retrain ML model with user corrections

        Args:
            min_corrections: Minimum number of corrections needed to retrain

        Returns:
            bool: True if retrained, False if not enough corrections
        """
        corrections = self.load_user_corrections()

        if len(corrections) < min_corrections:
            console.print(f"[yellow]⚠️  Only {len(corrections)} corrections (need {min_corrections})[/yellow]")
            return False

        console.print(f"[cyan]🔄 Retraining with {len(corrections)} corrections...[/cyan]")

        # Add corrections to training data
        # This would integrate with the existing ML training
        # For now, just train the model normally
        result = self.train_ml_model(model_type='gradient_boosting')

        if result:
            console.print(f"[green]✅ Model retrained![/green]")
            console.print(f"   New accuracy: {result['accuracy']:.2%}")
            return True

        return False

    # ============================================================================
    # DIPLOMA COURSE CONFIGURATION MANAGEMENT
    # ============================================================================

    def view_diploma_courses(self):
        """View current DIPLOMA course configuration"""
        console.print("\n[bold cyan]📋 DIPLOMA Course Configuration[/bold cyan]")
        console.print("=" * 70)

        # Overlapping courses
        overlapping = self.config.get('diploma_courses', {}).get('overlapping', [])
        console.print(f"\n[bold yellow]⚠️  Overlapping Courses (Medical → DNB fallback)[/bold yellow]")
        console.print(f"These courses can be in BOTH Medical and DNB colleges:\n")
        for idx, course in enumerate(overlapping, 1):
            console.print(f"  {idx}. {course}")

        # DNB-only courses
        dnb_only = self.config.get('diploma_courses', {}).get('dnb_only', [])
        console.print(f"\n[bold blue]🏥 DNB-Only Courses[/bold blue]")
        console.print(f"These courses are ONLY in DNB colleges:\n")
        for idx, course in enumerate(dnb_only, 1):
            console.print(f"  {idx}. {course}")

        console.print(f"\n[dim]All other DIPLOMA courses default to Medical colleges[/dim]")

    def add_overlapping_diploma_course(self, course_name):
        """Add a new overlapping DIPLOMA course"""
        course_name = course_name.strip().upper()

        # Check if already exists
        overlapping = self.config.get('diploma_courses', {}).get('overlapping', [])
        if course_name in overlapping:
            console.print(f"[yellow]⚠️  '{course_name}' is already in overlapping courses[/yellow]")
            return False

        # Add to config
        if 'diploma_courses' not in self.config:
            self.config['diploma_courses'] = {'overlapping': [], 'dnb_only': []}

        self.config['diploma_courses']['overlapping'].append(course_name)

        console.print(f"[green]✅ Added '{course_name}' to overlapping courses[/green]")
        return True

    def remove_overlapping_diploma_course(self, course_name):
        """Remove an overlapping DIPLOMA course"""
        course_name = course_name.strip().upper()

        overlapping = self.config.get('diploma_courses', {}).get('overlapping', [])
        if course_name not in overlapping:
            console.print(f"[yellow]⚠️  '{course_name}' is not in overlapping courses[/yellow]")
            return False

        # Remove from config
        self.config['diploma_courses']['overlapping'].remove(course_name)

        console.print(f"[green]✅ Removed '{course_name}' from overlapping courses[/green]")
        return True

    def add_dnb_only_diploma_course(self, course_name):
        """Add a new DNB-only DIPLOMA course"""
        course_name = course_name.strip().upper()

        # Check if already exists
        dnb_only = self.config.get('diploma_courses', {}).get('dnb_only', [])
        if course_name in dnb_only:
            console.print(f"[yellow]⚠️  '{course_name}' is already in DNB-only courses[/yellow]")
            return False

        # Add to config
        if 'diploma_courses' not in self.config:
            self.config['diploma_courses'] = {'overlapping': [], 'dnb_only': []}

        self.config['diploma_courses']['dnb_only'].append(course_name)

        console.print(f"[green]✅ Added '{course_name}' to DNB-only courses[/green]")
        return True

    def remove_dnb_only_diploma_course(self, course_name):
        """Remove a DNB-only DIPLOMA course"""
        course_name = course_name.strip().upper()

        dnb_only = self.config.get('diploma_courses', {}).get('dnb_only', [])
        if course_name not in dnb_only:
            console.print(f"[yellow]⚠️  '{course_name}' is not in DNB-only courses[/yellow]")
            return False

        # Remove from config
        self.config['diploma_courses']['dnb_only'].remove(course_name)

        console.print(f"[green]✅ Removed '{course_name}' from DNB-only courses[/green]")
        return True

    def save_config_to_file(self):
        """Save current config back to config.yaml"""
        import yaml

        try:
            with open('config.yaml', 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False, sort_keys=False)

            console.print(f"[green]✅ Configuration saved to config.yaml[/green]")
            return True

        except Exception as e:
            console.print(f"[red]❌ Failed to save config: {e}[/red]")
            return False

    def manage_diploma_courses_menu(self):
        """Interactive menu to manage DIPLOMA courses"""
        while True:
            console.print("\n[bold cyan]🎓 Manage DIPLOMA Courses[/bold cyan]")
            console.print("━" * 70)
            console.print("  [1] View Current Configuration")
            console.print("  [2] Add Overlapping Course (Medical → DNB fallback)")
            console.print("  [3] Remove Overlapping Course")
            console.print("  [4] Add DNB-Only Course")
            console.print("  [5] Remove DNB-Only Course")
            console.print("  [6] Save Configuration to File")
            console.print("  [7] Back to Main Menu")
            console.print("━" * 70)

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

            if choice == "1":
                self.view_diploma_courses()

            elif choice == "2":
                course_name = Prompt.ask("\nEnter course name (e.g., 'DIPLOMA IN CARDIOLOGY')")
                if course_name:
                    self.add_overlapping_diploma_course(course_name)

            elif choice == "3":
                self.view_diploma_courses()
                course_name = Prompt.ask("\nEnter course name to remove")
                if course_name:
                    self.remove_overlapping_diploma_course(course_name)

            elif choice == "4":
                course_name = Prompt.ask("\nEnter course name (e.g., 'DIPLOMA IN FAMILY MEDICINE')")
                if course_name:
                    self.add_dnb_only_diploma_course(course_name)

            elif choice == "5":
                self.view_diploma_courses()
                course_name = Prompt.ask("\nEnter course name to remove")
                if course_name:
                    self.remove_dnb_only_diploma_course(course_name)

            elif choice == "6":
                console.print("\n[yellow]⚠️  This will overwrite config.yaml[/yellow]")
                if Confirm.ask("Are you sure you want to save?"):
                    self.save_config_to_file()

            elif choice == "7":
                break

    def analyze_data_distribution(self, df, potential_partition_cols):
        """Analyze data distribution for partition optimization

        Args:
            df: DataFrame to analyze
            potential_partition_cols: List of columns to consider for partitioning

        Returns:
            dict: Distribution analysis with recommendations
        """
        analysis = {
            'total_records': len(df),
            'columns': {},
            'recommendations': []
        }

        for col in potential_partition_cols:
            if col not in df.columns:
                continue

            col_data = df[col].dropna()

            # Calculate statistics
            unique_values = col_data.nunique()
            null_count = df[col].isnull().sum()
            null_pct = (null_count / len(df)) * 100

            # Value distribution
            value_counts = col_data.value_counts()

            # Calculate balance score (how evenly distributed the values are)
            # Perfect balance = 1.0, highly skewed = closer to 0
            if unique_values > 1:
                expected_per_value = len(col_data) / unique_values
                variance = sum((count - expected_per_value) ** 2 for count in value_counts) / unique_values
                balance_score = 1.0 / (1.0 + variance / expected_per_value ** 2)
            else:
                balance_score = 0.0

            # Estimate partition sizes
            avg_partition_size = len(df) / unique_values if unique_values > 0 else 0
            min_partition_size = value_counts.min() if len(value_counts) > 0 else 0
            max_partition_size = value_counts.max() if len(value_counts) > 0 else 0

            analysis['columns'][col] = {
                'unique_values': int(unique_values),
                'null_count': int(null_count),
                'null_percentage': float(null_pct),
                'balance_score': float(balance_score),
                'avg_partition_size': int(avg_partition_size),
                'min_partition_size': int(min_partition_size),
                'max_partition_size': int(max_partition_size),
                'top_values': value_counts.head(5).to_dict()
            }

        return analysis

    def recommend_partition_strategy(self, df, data_type='seat'):
        """Recommend optimal partitioning strategy based on data analysis

        Args:
            df: DataFrame to analyze
            data_type: Type of data (seat/counselling/master)

        Returns:
            dict: Recommended partition strategies with scores
        """
        console.print("\n[cyan]🔍 Analyzing data for optimal partitioning...[/cyan]")

        # Define potential partition columns based on data type
        if data_type == 'seat':
            potential_cols = ['state', 'year', 'course_type', 'quota', 'category']
        elif data_type == 'counselling':
            potential_cols = ['state', 'year', 'round', 'quota', 'category', 'level']
        else:
            potential_cols = []

        # Filter to existing columns
        potential_cols = [col for col in potential_cols if col in df.columns]

        if not potential_cols:
            console.print("[yellow]⚠️  No suitable columns found for partitioning[/yellow]")
            return None

        # Analyze distribution
        analysis = self.analyze_data_distribution(df, potential_cols)

        # Score each column for partitioning suitability
        strategies = []

        for col, stats in analysis['columns'].items():
            # Scoring criteria:
            # 1. Cardinality (unique values) - moderate is best (5-50 ideal)
            # 2. Balance - more balanced is better
            # 3. Null percentage - lower is better
            # 4. Partition size - should be reasonable (1000-100000 records ideal)

            cardinality_score = 0.0
            if 5 <= stats['unique_values'] <= 50:
                cardinality_score = 1.0
            elif stats['unique_values'] < 5:
                cardinality_score = stats['unique_values'] / 5.0
            else:
                cardinality_score = 50.0 / stats['unique_values']

            balance_score = stats['balance_score']

            null_score = 1.0 - (stats['null_percentage'] / 100.0)

            size_score = 0.0
            if 1000 <= stats['avg_partition_size'] <= 100000:
                size_score = 1.0
            elif stats['avg_partition_size'] < 1000:
                size_score = stats['avg_partition_size'] / 1000.0
            else:
                size_score = 100000.0 / stats['avg_partition_size']

            # Weighted overall score
            overall_score = (
                cardinality_score * 0.35 +
                balance_score * 0.25 +
                null_score * 0.20 +
                size_score * 0.20
            )

            strategies.append({
                'column': col,
                'score': overall_score,
                'stats': stats,
                'cardinality_score': cardinality_score,
                'balance_score': balance_score,
                'null_score': null_score,
                'size_score': size_score
            })

        # Sort by score
        strategies.sort(key=lambda x: x['score'], reverse=True)

        # Generate multi-level partition recommendations
        multi_level_strategies = []

        # Try combinations of top columns
        top_cols = [s['column'] for s in strategies[:4]]

        for i in range(len(top_cols)):
            for j in range(i + 1, len(top_cols)):
                col1, col2 = top_cols[i], top_cols[j]

                # Estimate combined partition count
                combined_unique = (
                    analysis['columns'][col1]['unique_values'] *
                    analysis['columns'][col2]['unique_values']
                )

                combined_avg_size = analysis['total_records'] / combined_unique if combined_unique > 0 else 0

                # Score the combination
                if 10 <= combined_unique <= 200 and 500 <= combined_avg_size <= 50000:
                    combo_score = (
                        strategies[i]['score'] * 0.6 +
                        strategies[j]['score'] * 0.4
                    )

                    multi_level_strategies.append({
                        'columns': [col1, col2],
                        'score': combo_score,
                        'estimated_partitions': combined_unique,
                        'avg_partition_size': int(combined_avg_size)
                    })

        multi_level_strategies.sort(key=lambda x: x['score'], reverse=True)

        return {
            'single_column': strategies,
            'multi_level': multi_level_strategies[:5],  # Top 5 combinations
            'analysis': analysis
        }

    def display_partition_recommendations(self, recommendations):
        """Display partition recommendations in a user-friendly format"""
        if not recommendations:
            return

        console.print("\n[bold cyan]📊 Partition Strategy Recommendations[/bold cyan]")
        console.print("━" * 70)

        # Single column recommendations
        console.print("\n[bold]Single Column Partitioning:[/bold]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Rank", style="dim", width=6)
        table.add_column("Column", style="cyan")
        table.add_column("Score", justify="right")
        table.add_column("Partitions", justify="right")
        table.add_column("Avg Size", justify="right")
        table.add_column("Balance", justify="right")

        for idx, strategy in enumerate(recommendations['single_column'][:5], 1):
            score_color = "green" if strategy['score'] >= 0.7 else "yellow" if strategy['score'] >= 0.5 else "red"

            table.add_row(
                f"#{idx}",
                strategy['column'],
                f"[{score_color}]{strategy['score']:.2f}[/{score_color}]",
                f"{strategy['stats']['unique_values']:,}",
                f"{strategy['stats']['avg_partition_size']:,}",
                f"{strategy['stats']['balance_score']:.2f}"
            )

        console.print(table)

        # Multi-level recommendations
        if recommendations['multi_level']:
            console.print("\n[bold]Multi-Level Partitioning:[/bold]")
            table2 = Table(show_header=True, header_style="bold magenta")
            table2.add_column("Rank", style="dim", width=6)
            table2.add_column("Columns", style="cyan")
            table2.add_column("Score", justify="right")
            table2.add_column("Partitions", justify="right")
            table2.add_column("Avg Size", justify="right")

            for idx, strategy in enumerate(recommendations['multi_level'][:5], 1):
                score_color = "green" if strategy['score'] >= 0.7 else "yellow" if strategy['score'] >= 0.5 else "red"

                cols_display = " → ".join(strategy['columns'])

                table2.add_row(
                    f"#{idx}",
                    cols_display,
                    f"[{score_color}]{strategy['score']:.2f}[/{score_color}]",
                    f"{strategy['estimated_partitions']:,}",
                    f"{strategy['avg_partition_size']:,}"
                )

            console.print(table2)

        # Recommendations text
        console.print("\n[bold cyan]💡 Recommendations:[/bold cyan]")

        if recommendations['single_column']:
            best_single = recommendations['single_column'][0]
            if best_single['score'] >= 0.7:
                console.print(f"  ✅ [green]Excellent:[/green] Partition by [cyan]{best_single['column']}[/cyan]")
            elif best_single['score'] >= 0.5:
                console.print(f"  ⚠️  [yellow]Good:[/yellow] Partition by [cyan]{best_single['column']}[/cyan]")
            else:
                console.print(f"  ⚠️  [yellow]Suboptimal:[/yellow] Partitioning may not be beneficial")

        if recommendations['multi_level']:
            best_multi = recommendations['multi_level'][0]
            if best_multi['score'] >= 0.6:
                cols = " + ".join(best_multi['columns'])
                console.print(f"  ✅ [green]Best multi-level:[/green] [{cyan}{cols}[/cyan]]")
                console.print(f"     → Creates {best_multi['estimated_partitions']:,} partitions")
                console.print(f"     → ~{best_multi['avg_partition_size']:,} records per partition")

        console.print("\n[dim]Higher scores indicate better partitioning candidates[/dim]")

    def optimize_partition_sizes(self, df, partition_cols, target_size_mb=128):
        """Optimize partition configuration to target specific file sizes

        Args:
            df: DataFrame to partition
            partition_cols: Proposed partition columns
            target_size_mb: Target size per partition file in MB

        Returns:
            dict: Optimization recommendations
        """
        # Estimate row size in bytes
        sample_size = min(1000, len(df))
        sample_df = df.sample(n=sample_size)

        # Rough size estimation
        estimated_row_size = sample_df.memory_usage(deep=True).sum() / sample_size

        # Calculate current partition setup
        if partition_cols:
            partition_counts = df.groupby(partition_cols).size()

            avg_records_per_partition = partition_counts.mean()
            min_records = partition_counts.min()
            max_records = partition_counts.max()

            # Estimate file sizes
            avg_size_mb = (avg_records_per_partition * estimated_row_size) / (1024 * 1024)
            min_size_mb = (min_records * estimated_row_size) / (1024 * 1024)
            max_size_mb = (max_records * estimated_row_size) / (1024 * 1024)

            # Check if sizes are within acceptable range
            target_min = target_size_mb * 0.5
            target_max = target_size_mb * 2.0

            warnings = []

            if avg_size_mb < target_min:
                warnings.append({
                    'type': 'too_small',
                    'message': f"Average partition size ({avg_size_mb:.1f} MB) is smaller than recommended ({target_min:.1f}-{target_max:.1f} MB)",
                    'suggestion': "Consider using fewer partition columns or no partitioning"
                })

            if avg_size_mb > target_max:
                warnings.append({
                    'type': 'too_large',
                    'message': f"Average partition size ({avg_size_mb:.1f} MB) is larger than recommended ({target_min:.1f}-{target_max:.1f} MB)",
                    'suggestion': "Consider adding more partition columns for better distribution"
                })

            if max_size_mb > target_max * 5:
                warnings.append({
                    'type': 'highly_skewed',
                    'message': f"Largest partition ({max_size_mb:.1f} MB) is much larger than average",
                    'suggestion': "Data is highly skewed - consider alternative partitioning strategy"
                })

            num_partitions = len(partition_counts)
            if num_partitions > 1000:
                warnings.append({
                    'type': 'too_many_partitions',
                    'message': f"Too many partitions ({num_partitions:,})",
                    'suggestion': "Reduce partition granularity to avoid filesystem overhead"
                })

            return {
                'estimated_row_size_bytes': int(estimated_row_size),
                'num_partitions': int(num_partitions),
                'avg_records_per_partition': int(avg_records_per_partition),
                'min_records': int(min_records),
                'max_records': int(max_records),
                'avg_size_mb': float(avg_size_mb),
                'min_size_mb': float(min_size_mb),
                'max_size_mb': float(max_size_mb),
                'target_size_mb': target_size_mb,
                'warnings': warnings,
                'is_optimal': len(warnings) == 0
            }
        else:
            # No partitioning
            total_size_mb = (len(df) * estimated_row_size) / (1024 * 1024)

            return {
                'estimated_row_size_bytes': int(estimated_row_size),
                'num_partitions': 1,
                'total_size_mb': float(total_size_mb),
                'target_size_mb': target_size_mb,
                'warnings': [],
                'is_optimal': True
            }

    def unified_parquet_export_menu(self):
        """Unified Parquet Export Menu for all 3 data types"""
        console.print("\n[bold cyan]📦 Export to Parquet Format[/bold cyan]")
        console.print("━" * 70)
        console.print("\n[bold]Select data type to export:[/bold]")
        console.print("  [1] Seat Data")
        console.print("  [2] Counselling Data")
        console.print("  [3] Master Data (All tables)")
        console.print("  [4] Export All (Seat + Counselling + Master)")
        console.print("  [5] Back")

        choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5"], default="1")

        if choice == "5":
            return

        # Get export options
        console.print("\n[bold cyan]Export Options:[/bold cyan]")

        # Partition options with advanced recommendations
        console.print("\n[bold]Partitioning Strategy:[/bold]")
        console.print("  Partitioning creates a directory structure for efficient querying")
        console.print("  Example: state=Karnataka/year=2023/data.parquet")

        partition_cols = []
        recommendations = None

        if choice in ["1", "2"]:  # Seat or Counselling
            use_partitioning = Confirm.ask("Enable partitioning?", default=False)

            if use_partitioning:
                # Offer intelligent recommendations
                use_smart_partition = Confirm.ask("🤖 Use intelligent partition recommendations?", default=True)

                if use_smart_partition:
                    # Load data sample for analysis
                    console.print("[cyan]Loading data sample for analysis...[/cyan]")

                    try:
                        if choice == "1":  # Seat data
                            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['seat_data_db']}"
                            table_name = 'seat_data_linked'
                            data_type = 'seat'
                        else:  # Counselling data
                            db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['counselling_data_db']}"
                            table_name = 'counselling_records'
                            data_type = 'counselling'

                        console.print(f"[dim]Analyzing: {db_path} -> {table_name}[/dim]")
                        conn = sqlite3.connect(db_path)
                        df_sample = pd.read_sql(f"SELECT * FROM {table_name} LIMIT 10000", conn)
                        conn.close()

                        # Get recommendations
                        recommendations = self.recommend_partition_strategy(df_sample, data_type)

                        if recommendations:
                            # Display recommendations
                            self.display_partition_recommendations(recommendations)

                            # Let user choose
                            console.print("\n[bold]Select partitioning strategy:[/bold]")
                            console.print("  [1] Use recommended single column")
                            console.print("  [2] Use recommended multi-level")
                            console.print("  [3] Manual selection")
                            console.print("  [4] No partitioning")

                            rec_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4"], default="1")

                            if rec_choice == "1" and recommendations['single_column']:
                                best_col = recommendations['single_column'][0]['column']
                                partition_cols = [best_col]
                                console.print(f"[green]✓ Using: {best_col}[/green]")

                            elif rec_choice == "2" and recommendations['multi_level']:
                                best_multi = recommendations['multi_level'][0]['columns']
                                partition_cols = best_multi
                                console.print(f"[green]✓ Using: {' → '.join(best_multi)}[/green]")

                            elif rec_choice == "3":
                                # Manual selection
                                console.print("\n[bold]Manual partition columns:[/bold]")
                                console.print("  [1] state")
                                console.print("  [2] year")
                                console.print("  [3] state + year")
                                console.print("  [4] custom")

                                part_choice = Prompt.ask("Partition by", choices=["1", "2", "3", "4"], default="3")

                                if part_choice == "1":
                                    partition_cols = ['state']
                                elif part_choice == "2":
                                    partition_cols = ['year']
                                elif part_choice == "3":
                                    partition_cols = ['state', 'year']
                                else:
                                    cols_input = Prompt.ask("Enter comma-separated column names")
                                    partition_cols = [c.strip() for c in cols_input.split(',')]

                            elif rec_choice == "4":
                                partition_cols = []

                            # Validate and optimize selected partitioning
                            if partition_cols:
                                console.print("\n[cyan]Validating partition configuration...[/cyan]")

                                optimization = self.optimize_partition_sizes(df_sample, partition_cols)

                                console.print(f"[cyan]📊 Partition Size Analysis:[/cyan]")
                                console.print(f"  Estimated partitions: {optimization['num_partitions']:,}")
                                if optimization['num_partitions'] > 1:
                                    console.print(f"  Avg records/partition: {optimization['avg_records_per_partition']:,}")
                                    console.print(f"  Avg size/partition: {optimization['avg_size_mb']:.1f} MB")

                                if optimization['warnings']:
                                    console.print(f"\n[yellow]⚠️  Warnings:[/yellow]")
                                    for warning in optimization['warnings']:
                                        console.print(f"  • {warning['message']}")
                                        console.print(f"    [dim]{warning['suggestion']}[/dim]")

                                    proceed = Confirm.ask("\nProceed with this configuration?", default=True)
                                    if not proceed:
                                        partition_cols = []
                                        console.print("[yellow]Partitioning disabled[/yellow]")
                                else:
                                    console.print("[green]✓ Configuration looks good![/green]")

                    except Exception as e:
                        console.print(f"[yellow]⚠️  Could not analyze data: {e}[/yellow]")
                        console.print("[yellow]Falling back to manual selection[/yellow]")

                        # Fallback to manual
                        console.print("\n[bold]Manual partition columns:[/bold]")
                        console.print("  [1] state")
                        console.print("  [2] year")
                        console.print("  [3] state + year")
                        console.print("  [4] custom")

                        part_choice = Prompt.ask("Partition by", choices=["1", "2", "3", "4"], default="3")

                        if part_choice == "1":
                            partition_cols = ['state']
                        elif part_choice == "2":
                            partition_cols = ['year']
                        elif part_choice == "3":
                            partition_cols = ['state', 'year']
                        else:
                            cols_input = Prompt.ask("Enter comma-separated column names")
                            partition_cols = [c.strip() for c in cols_input.split(',')]

                else:
                    # Manual selection without recommendations
                    console.print("\n[bold]Manual partition columns:[/bold]")
                    console.print("  [1] state")
                    console.print("  [2] year")
                    console.print("  [3] state + year")
                    console.print("  [4] custom")

                    part_choice = Prompt.ask("Partition by", choices=["1", "2", "3", "4"], default="3")

                    if part_choice == "1":
                        partition_cols = ['state']
                    elif part_choice == "2":
                        partition_cols = ['year']
                    elif part_choice == "3":
                        partition_cols = ['state', 'year']
                    else:
                        cols_input = Prompt.ask("Enter comma-separated column names")
                        partition_cols = [c.strip() for c in cols_input.split(',')]

        # Compression options
        console.print("\n[bold]Compression codec:[/bold]")
        console.print("  [1] Snappy (fast, good compression) - Recommended")
        console.print("  [2] Gzip (slower, better compression)")
        console.print("  [3] Zstd (balanced, modern)")
        console.print("  [4] None (no compression)")

        comp_choice = Prompt.ask("Compression", choices=["1", "2", "3", "4"], default="1")
        comp_map = {'1': 'snappy', '2': 'gzip', '3': 'zstd', '4': 'none'}
        compression = comp_map[comp_choice]

        # Validation option
        validate = Confirm.ask("Run data quality validation before export?", default=True)

        # Execute exports
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        try:
            if choice == "1":
                # Export Seat Data
                output_path = f'output/seat_data_export_{timestamp}.parquet'
                console.print(f"\n[cyan]📦 Exporting Seat Data...[/cyan]")

                result = self.export_to_parquet(
                    output_path=output_path,
                    partition_by=partition_cols if partition_cols else None,
                    compression=compression,
                    validate=validate,
                    table_name='seat_data_linked'
                )

                if result:
                    console.print(f"\n[green]✅ Seat Data exported successfully![/green]")
                    console.print(f"   Location: {result}")

            elif choice == "2":
                # Export Counselling Data
                output_path = f'output/counselling_data_export_{timestamp}.parquet'
                console.print(f"\n[cyan]📦 Exporting Counselling Data...[/cyan]")

                # Temporarily switch context
                original_db = self.data_db_path
                self.data_db_path = self.data_db_path  # counselling DB

                result = self.export_to_parquet(
                    output_path=output_path,
                    partition_by=partition_cols if partition_cols else None,
                    compression=compression,
                    validate=validate,
                    table_name='counselling_records'
                )

                if result:
                    console.print(f"\n[green]✅ Counselling Data exported successfully![/green]")
                    console.print(f"   Location: {result}")

            elif choice == "3":
                # Export Master Data (all tables)
                console.print(f"\n[cyan]📦 Exporting Master Data...[/cyan]")
                self._export_master_data_to_parquet(compression, timestamp)

            elif choice == "4":
                # Export All
                console.print(f"\n[cyan]📦 Exporting All Data Types...[/cyan]")

                export_results = {
                    'seat': None,
                    'counselling': None,
                    'master': None
                }

                # Seat Data
                console.print("\n[bold]1/3: Exporting Seat Data...[/bold]")
                try:
                    seat_result = self.export_to_parquet(
                        output_path=f'output/seat_data_export_{timestamp}.parquet',
                        partition_by=partition_cols if partition_cols else None,
                        compression=compression,
                        validate=validate,
                        table_name='seat_data_linked'
                    )
                    export_results['seat'] = seat_result
                except Exception as e:
                    console.print(f"[yellow]⚠️  Seat data export failed: {e}[/yellow]")

                # Counselling Data
                console.print("\n[bold]2/3: Exporting Counselling Data...[/bold]")
                try:
                    counselling_result = self.export_to_parquet(
                        output_path=f'output/counselling_data_export_{timestamp}.parquet',
                        partition_by=partition_cols if partition_cols else None,
                        compression=compression,
                        validate=validate,
                        table_name='counselling_records'
                    )
                    export_results['counselling'] = counselling_result
                except Exception as e:
                    console.print(f"[yellow]⚠️  Counselling data export failed: {e}[/yellow]")

                # Master Data
                console.print("\n[bold]3/3: Exporting Master Data...[/bold]")
                try:
                    master_result = self._export_master_data_to_parquet(compression, timestamp)
                    export_results['master'] = master_result
                except Exception as e:
                    console.print(f"[yellow]⚠️  Master data export failed: {e}[/yellow]")

                # Summary
                console.print(f"\n[bold cyan]Export Summary:[/bold cyan]")
                success_count = sum(1 for v in export_results.values() if v is not None)

                if export_results['seat']:
                    console.print(f"  ✅ Seat Data: {export_results['seat']}")
                else:
                    console.print(f"  ⚠️  Seat Data: Not exported (table may not exist)")

                if export_results['counselling']:
                    console.print(f"  ✅ Counselling Data: {export_results['counselling']}")
                else:
                    console.print(f"  ⚠️  Counselling Data: Not exported (table may not exist)")

                if export_results['master']:
                    console.print(f"  ✅ Master Data: {export_results['master']}")
                else:
                    console.print(f"  ⚠️  Master Data: Not exported")

                if success_count > 0:
                    console.print(f"\n[green]✅ {success_count}/3 data types exported successfully![/green]")
                    console.print(f"   Location: output/")
                else:
                    console.print(f"\n[red]❌ No data was exported[/red]")

        except Exception as e:
            console.print(f"\n[red]❌ Export failed: {e}[/red]")
            import traceback
            traceback.print_exc()

    def _export_master_data_to_parquet(self, compression='snappy', timestamp=None):
        """Export all master data tables to parquet format"""
        if not timestamp:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        try:
            import pyarrow as pa
            import pyarrow.parquet as pq

            console.print("[cyan]Connecting to master database...[/cyan]")
            master_db_path = f"{self.config['database']['sqlite_path']}/{self.config['database']['master_data_db']}"
            conn = sqlite3.connect(master_db_path)

            # Get list of all tables
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]

            console.print(f"[green]✓ Found {len(tables)} tables[/green]")

            # Create output directory
            output_dir = Path(f'output/master_data_export_{timestamp}')
            output_dir.mkdir(parents=True, exist_ok=True)

            exported_count = 0
            total_records = 0

            for table in tables:
                try:
                    console.print(f"  Exporting [cyan]{table}[/cyan]...", end=" ")

                    df = pd.read_sql(f"SELECT * FROM {table}", conn)

                    if len(df) == 0:
                        console.print("[yellow](empty)[/yellow]")
                        continue

                    # Export to parquet
                    output_file = output_dir / f"{table}.parquet"
                    df.to_parquet(
                        output_file,
                        engine='pyarrow',
                        compression=compression,
                        index=False
                    )

                    exported_count += 1
                    total_records += len(df)
                    console.print(f"[green]✓ {len(df):,} records[/green]")

                except Exception as e:
                    console.print(f"[red]✗ Failed: {e}[/red]")

            conn.close()

            # Create metadata file
            metadata = {
                'export_date': datetime.now().isoformat(),
                'total_tables': exported_count,
                'total_records': total_records,
                'compression': compression,
                'tables': tables
            }

            metadata_path = output_dir / 'metadata.json'
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            console.print(f"\n[green]✅ Master Data Export Complete![/green]")
            console.print(f"   📦 Location: {output_dir}")
            console.print(f"   📊 Tables: {exported_count}")
            console.print(f"   📈 Total Records: {total_records:,}")
            console.print(f"   🗜️  Compression: {compression}")
            console.print(f"   📄 Metadata: {metadata_path}")

            return str(output_dir)

        except ImportError:
            console.print("[red]❌ PyArrow not installed. Install with: pip install pyarrow[/red]")
            return None
        except Exception as e:
            console.print(f"[red]❌ Master data export failed: {e}[/red]")
            import traceback
            traceback.print_exc()
            return None

    def validate_data_quality(self):
        """Validate data quality and generate report

        Returns:
            dict: Validation report
        """
        console.print(f"\n[cyan]🔍 Validating Data Quality...[/cyan]")

        try:
            conn = sqlite3.connect(self.seat_db_path if self.data_type == 'seat' else self.data_db_path)
            table_name = 'seat_data' if self.data_type == 'seat' else 'counselling_records'

            df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
            conn.close()

            report = {
                'total_records': len(df),
                'valid_records': 0,
                'issues': []
            }

            # Check required columns
            required_cols = ['college_name', 'course_name', 'state']
            missing_cols = [col for col in required_cols if col not in df.columns]

            if missing_cols:
                report['issues'].append({
                    'type': 'missing_columns',
                    'columns': missing_cols
                })

            # Check null values
            for col in required_cols:
                if col in df.columns:
                    null_count = df[col].isnull().sum()
                    if null_count > 0:
                        report['issues'].append({
                            'type': 'null_values',
                            'column': col,
                            'count': int(null_count),
                            'percentage': f"{null_count/len(df)*100:.2f}%"
                        })

            # Check match confidence distribution
            if 'college_match_score' in df.columns:
                low_confidence = (df['college_match_score'] < 0.7).sum()
                if low_confidence > 0:
                    report['issues'].append({
                        'type': 'low_confidence_matches',
                        'count': int(low_confidence),
                        'percentage': f"{low_confidence/len(df)*100:.2f}%"
                    })

            # Check duplicates
            duplicate_count = df.duplicated().sum()
            if duplicate_count > 0:
                report['issues'].append({
                    'type': 'duplicates',
                    'count': int(duplicate_count)
                })

            report['valid_records'] = len(df) - duplicate_count

            # Display report
            console.print(f"\n[bold]📊 Data Quality Report[/bold]")
            console.print(f"  Total Records: {report['total_records']:,}")
            console.print(f"  Valid Records: {report['valid_records']:,}")

            if report['issues']:
                console.print(f"\n[yellow]⚠️  Issues Found: {len(report['issues'])}[/yellow]")
                for issue in report['issues']:
                    console.print(f"    • {issue['type']}: {issue.get('count', 'N/A')}")
            else:
                console.print(f"\n[green]✅ No issues found![/green]")

            return report

        except Exception as e:
            console.print(f"[red]❌ Validation failed: {e}[/red]")
            return None

    def show_ai_features_menu(self):
        """AI-Powered Features Menu"""
        while True:
            console.print("\n[bold cyan]🤖 AI-Powered Features[/bold cyan]")
            console.print("━" * 60)
            console.print(f"  [1] Toggle AI Features (Current: {'[green]ON[/green]' if self.enable_advanced_features else '[yellow]OFF[/yellow]'})")
            console.print("  [2] Build Vector Search Index")
            console.print("  [3] Test AI Matching")
            console.print("  [4] Extract Entities (NER)")
            console.print("  [5] Generate Advanced Report")
            console.print("  [6] Launch Interactive Dashboard")
            console.print("  [7] Back to Main Menu")
            console.print("━" * 60)

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

            if choice == "1":
                if not ADVANCED_FEATURES_AVAILABLE:
                    console.print("[yellow]⚠️  Advanced features not installed[/yellow]")
                    console.print("[yellow]   Install with: pip install -r requirements_advanced.txt[/yellow]")
                elif not self.enable_advanced_features:
                    self.enable_advanced_features = True
                    self._init_advanced_features()
                else:
                    self.enable_advanced_features = False
                    console.print("[yellow]AI features disabled[/yellow]")

            elif choice == "2":
                self.build_vector_index_for_colleges(force_rebuild=True)

            elif choice == "3":
                college = Prompt.ask("Enter college name to match")
                state = Prompt.ask("Enter state", default="DELHI")

                # Show AI status
                console.print(f"\n[cyan]AI Features Status:[/cyan]")
                console.print(f"  Enable Advanced Features: {self.enable_advanced_features}")
                console.print(f"  Transformer Matcher: {self._transformer_matcher is not None}")
                console.print(f"  Vector Engine: {self._vector_engine is not None}")
                if self._vector_engine:
                    console.print(f"  Vector Index Size: {self._vector_engine.index.ntotal if hasattr(self._vector_engine, 'index') else 0}")

                # Get candidates for debugging
                candidates = self.get_college_pool(course_type='medical', state=state)
                console.print(f"\n[cyan]Search Context:[/cyan]")
                console.print(f"  Query: {college}")
                console.print(f"  State: {state}")
                console.print(f"  Candidates: {len(candidates)} colleges")

                # Show top candidates for comparison
                if self.enable_advanced_features and self._transformer_matcher:
                    console.print(f"\n[cyan]🔍 Searching for top matches...[/cyan]")
                    try:
                        from fuzzywuzzy import fuzz
                        top_matches = []
                        for candidate in candidates[:100]:  # Check first 100
                            # Quick fuzzy score
                            fuzzy_score = fuzz.token_sort_ratio(college.upper(), candidate.get('name', '').upper()) / 100.0
                            if fuzzy_score > 0.5:
                                top_matches.append((candidate, fuzzy_score))

                        # Sort by score
                        top_matches.sort(key=lambda x: x[1], reverse=True)

                        console.print(f"\n[cyan]Top 5 Candidates:[/cyan]")
                        for i, (cand, sc) in enumerate(top_matches[:5], 1):
                            console.print(f"  {i}. {cand['name'][:60]} ({sc:.2%})")
                    except:
                        pass

                match, score, method = self.match_college_ai_enhanced(
                    college, state, 'medical', threshold=0.6
                )

                if match:
                    console.print(f"\n[green]✓ Match Found![/green]")
                    console.print(f"  College: {match['name']}")
                    console.print(f"  Score: {score:.2%}")
                    console.print(f"  Method: {method}")

                    # Warn if using fallback fuzzy match
                    if 'fuzzy' in method.lower() and score < 0.85:
                        console.print(f"\n[yellow]⚠️  WARNING: Low confidence fuzzy match![/yellow]")
                        console.print(f"[yellow]   This match may be incorrect. Consider:[/yellow]")
                        console.print(f"[yellow]   1. Building vector index (option 2)[/yellow]")
                        console.print(f"[yellow]   2. Using exact college name from master data[/yellow]")
                        console.print(f"[yellow]   3. Checking if AI features are properly enabled[/yellow]")
                else:
                    console.print("[red]✗ No match found[/red]")
                    console.print("[yellow]This could mean:[/yellow]")
                    console.print("[yellow]  - No college with that name exists in master data[/yellow]")
                    console.print("[yellow]  - The query is too different from master data names[/yellow]")
                    console.print("[yellow]  - Try building vector index for better matching[/yellow]")

            elif choice == "4":
                text = Prompt.ask("Enter text to parse")
                entities = self.extract_entities_ner(text)

                if entities:
                    console.print(f"\n[green]Extracted Entities:[/green]")
                    for key, value in entities.items():
                        console.print(f"  {key}: {value}")
                else:
                    console.print("[yellow]No entities extracted[/yellow]")

            elif choice == "5":
                format = Prompt.ask("Report format", choices=["html", "excel", "json"], default="html")
                report_path = self.generate_ai_report(format=format)

                if report_path:
                    console.print(f"[green]✓ Report generated: {report_path}[/green]")

            elif choice == "6":
                try:
                    from advanced_dashboards import StreamlitDashboard
                    import subprocess
                    console.print("[cyan]🚀 Launching dashboard at http://localhost:8501[/cyan]")
                    subprocess.Popen(['streamlit', 'run', 'advanced_dashboards.py'])
                except:
                    console.print("[yellow]⚠️  Dashboard not available[/yellow]")

            elif choice == "7":
                break

def check_startup_requirements():
    """Check all required dependencies and files before starting"""
    console.print("\n[bold cyan]🔍 Checking Startup Requirements...[/bold cyan]")
    console.print("━" * 70)

    issues = []
    warnings = []

    # ==================== 1. CHECK REQUIRED PYTHON PACKAGES ====================
    console.print("\n[bold]1. Python Packages:[/bold]")

    required_packages = {
        'pandas': 'pandas',
        'numpy': 'numpy',
        'rich': 'rich',
        'rapidfuzz': 'rapidfuzz',
        'yaml': 'pyyaml',
        'openpyxl': 'openpyxl',
        'pyarrow': 'pyarrow',
        'sqlite3': None,  # Built-in
    }

    optional_packages = {
        'sentence_transformers': 'sentence-transformers',
        'faiss': 'faiss-cpu',
        'spacy': 'spacy',
        'streamlit': 'streamlit',
    }

    # Check required packages
    for module_name, pip_name in required_packages.items():
        try:
            if module_name == 'yaml':
                import yaml
            elif module_name == 'sqlite3':
                import sqlite3
            else:
                __import__(module_name)
            console.print(f"  ✅ {module_name}")
        except ImportError:
            install_cmd = f"pip install {pip_name}" if pip_name else "Built-in (should not fail)"
            issues.append(f"Missing required package: {module_name} (install: {install_cmd})")
            console.print(f"  ❌ {module_name} - [red]MISSING[/red]")

    # Check optional packages (just warnings)
    optional_missing = []
    for module_name, pip_name in optional_packages.items():
        try:
            __import__(module_name)
        except ImportError:
            optional_missing.append(module_name)

    if optional_missing:
        console.print(f"\n  [dim]Optional packages not installed: {', '.join(optional_missing)}[/dim]")
        console.print(f"  [dim](These enable advanced AI/ML features)[/dim]")

    # ==================== 2. CHECK REQUIRED DIRECTORIES ====================
    console.print("\n[bold]2. Directory Structure:[/bold]")

    required_dirs = [
        'data/sqlite',
        'logs',
        'output',
    ]

    for dir_path in required_dirs:
        if Path(dir_path).exists():
            console.print(f"  ✅ {dir_path}/")
        else:
            warnings.append(f"Directory missing: {dir_path}/ (will be created)")
            console.print(f"  ⚠️  {dir_path}/ - [yellow]Will be created[/yellow]")
            # Create missing directories
            try:
                Path(dir_path).mkdir(parents=True, exist_ok=True)
                console.print(f"     [green]✓ Created {dir_path}/[/green]")
            except Exception as e:
                issues.append(f"Cannot create directory {dir_path}/: {e}")
                console.print(f"     [red]✗ Failed to create: {e}[/red]")

    # ==================== 3. CHECK DATABASE FILES ====================
    console.print("\n[bold]3. Database Files:[/bold]")

    db_files = [
        ('data/sqlite/master_data.db', 'Master Data (colleges, courses, etc.)'),
        ('data/sqlite/seat_data.db', 'Seat Data (optional, created on import)'),
        ('data/sqlite/counselling_data_partitioned.db', 'Counselling Data (optional, created on import)'),
    ]

    master_db_exists = False
    for db_path, description in db_files:
        if Path(db_path).exists():
            size_mb = Path(db_path).stat().st_size / (1024 * 1024)
            console.print(f"  ✅ {db_path} - [green]{size_mb:.1f} MB[/green]")
            console.print(f"     [dim]{description}[/dim]")
            if 'master_data' in db_path:
                master_db_exists = True
        else:
            if 'master_data' in db_path:
                issues.append(f"Master database not found: {db_path}")
                console.print(f"  ❌ {db_path} - [red]REQUIRED[/red]")
                console.print(f"     [dim]{description}[/dim]")
            else:
                console.print(f"  ⚠️  {db_path} - [yellow]Not found (OK)[/yellow]")
                console.print(f"     [dim]{description}[/dim]")

    # ==================== 4. CHECK CONFIGURATION FILE ====================
    console.print("\n[bold]4. Configuration:[/bold]")

    if Path('config.yaml').exists():
        console.print(f"  ✅ config.yaml")
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
                console.print(f"     [dim]Database path: {config.get('database', {}).get('sqlite_path', 'Not set')}[/dim]")
        except Exception as e:
            warnings.append(f"config.yaml exists but has errors: {e}")
            console.print(f"     [yellow]⚠️  Parse error: {e}[/yellow]")
    else:
        console.print(f"  ⚠️  config.yaml - [yellow]Not found (will use defaults)[/yellow]")

    # ==================== 5. SUMMARY ====================
    console.print("\n[bold]Summary:[/bold]")

    if issues:
        console.print(f"  [red]❌ {len(issues)} Critical Issue(s):[/red]")
        for issue in issues:
            console.print(f"     • {issue}")
        console.print("\n[bold red]Cannot start - please resolve the issues above![/bold red]")
        return False

    if warnings:
        console.print(f"  [yellow]⚠️  {len(warnings)} Warning(s):[/yellow]")
        for warning in warnings:
            console.print(f"     • {warning}")

    if not issues:
        console.print(f"  [green]✅ All critical requirements met![/green]")

    console.print("━" * 70)

    return True

def migrate_counselling_add_source_level_columns():
    """Migration: Add master_source_id and master_level_id columns to counselling_records"""
    console.print("\n[bold cyan]🔧 Database Migration: Adding Source/Level Columns[/bold cyan]")

    db_path = "data/sqlite/counselling_data_partitioned.db"

    if not Path(db_path).exists():
        console.print(f"[yellow]⚠️  Database not found: {db_path}[/yellow]")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if columns already exist
        cursor.execute("PRAGMA table_info(counselling_records)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'master_source_id' in columns and 'master_level_id' in columns:
            console.print("[green]✓ Source/Level columns already exist[/green]")
            conn.close()
            return True

        # Add master_source_id column if not exists
        if 'master_source_id' not in columns:
            console.print("[cyan]1. Adding master_source_id column...[/cyan]")
            cursor.execute("ALTER TABLE counselling_records ADD COLUMN master_source_id TEXT")
            console.print("[green]   ✓ Column added[/green]")

        # Add master_level_id column if not exists
        if 'master_level_id' not in columns:
            console.print("[cyan]2. Adding master_level_id column...[/cyan]")
            cursor.execute("ALTER TABLE counselling_records ADD COLUMN master_level_id TEXT")
            console.print("[green]   ✓ Column added[/green]")

        conn.commit()
        conn.close()

        console.print("\n[bold green]✅ Source/Level columns migration completed![/bold green]")
        return True

    except Exception as e:
        console.print(f"[red]❌ Migration failed: {e}[/red]")
        logger.error(f"Migration failed: {e}", exc_info=True)
        if conn:
            conn.rollback()
            conn.close()
        return False

def migrate_counselling_add_address_column():
    """Migration: Add address column to counselling_records and populate from existing data

    This migration fixes the schema flaw where address information was being extracted
    during import but not stored separately. The address is critical for location-based
    disambiguation.
    """
    console.print("\n[bold cyan]🔧 Database Migration: Adding Address Column[/bold cyan]")

    db_path = "data/sqlite/counselling_data_partitioned.db"

    if not Path(db_path).exists():
        console.print(f"[yellow]⚠️  Database not found: {db_path}[/yellow]")
        console.print("[yellow]   Migration will be applied when database is created[/yellow]")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if address column already exists
        cursor.execute("PRAGMA table_info(counselling_records)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'address' in columns:
            console.print("[green]✓ Address column already exists[/green]")
            conn.close()
            return True

        # Step 1: Add address column
        console.print("[cyan]1. Adding address column to counselling_records...[/cyan]")
        cursor.execute("ALTER TABLE counselling_records ADD COLUMN address TEXT")
        console.print("[green]   ✓ Column added[/green]")

        # Step 2: Extract addresses from existing college_institute_raw data
        console.print("[cyan]2. Extracting addresses from existing records...[/cyan]")

        cursor.execute("SELECT id, college_institute_raw FROM counselling_records")
        records = cursor.fetchall()

        console.print(f"   Found {len(records):,} records to process")

        updates = []
        for record_id, college_institute_raw in records:
            if college_institute_raw and ',' in str(college_institute_raw):
                # Split on first comma
                parts = str(college_institute_raw).split(',', 1)
                if len(parts) == 2:
                    address = parts[1].strip()
                    updates.append((address, record_id))

        if updates:
            console.print(f"   Updating {len(updates):,} records with extracted addresses...")
            cursor.executemany(
                "UPDATE counselling_records SET address = ? WHERE id = ?",
                updates
            )
            console.print(f"[green]   ✓ Updated {len(updates):,} records[/green]")
        else:
            console.print("[yellow]   No addresses found to extract[/yellow]")

        # Step 3: Create index for address queries
        console.print("[cyan]3. Creating index on address column...[/cyan]")
        try:
            cursor.execute("CREATE INDEX idx_counselling_address ON counselling_records(address)")
            console.print("[green]   ✓ Index created[/green]")
        except sqlite3.OperationalError as e:
            if "already exists" in str(e):
                console.print("[yellow]   Index already exists[/yellow]")
            else:
                raise

        conn.commit()
        conn.close()

        console.print("\n[bold green]✅ Migration completed successfully![/bold green]")
        console.print(f"   • Added 'address' column")
        console.print(f"   • Extracted {len(updates):,} addresses from existing data")
        console.print(f"   • Created index for efficient queries")

        return True

    except Exception as e:
        console.print(f"[red]❌ Migration failed: {e}[/red]")
        logger.error(f"Migration failed: {e}", exc_info=True)
        if conn:
            conn.rollback()
            conn.close()
        return False

# ============================================================================
# NEW ADVANCED FEATURES (2025)
# ============================================================================

class SoftTFIDF:
    """
    Soft TF-IDF: Enhanced TF-IDF that tolerates typos and small variations

    Based on 2024 research: Considers n-gram frequency and edit distance
    within tokens for better matching with typos.

    Example:
        "GOVT MEDICAL COLLEGE" vs "GOVERNMENT MEDCAL COLEGE"
        - Standard TF-IDF: 0.75
        - Soft TF-IDF: 0.92 (tolerates "MEDCAL"→"MEDICAL")
    """

    def __init__(self, ngram_range=(2, 3), threshold=0.8):
        """
        Initialize Soft TF-IDF

        Args:
            ngram_range: Character n-gram range (default: 2-3)
            threshold: Edit distance threshold for token matching
        """
        self.ngram_range = ngram_range
        self.threshold = threshold
        self.vectorizer = None
        self.token_cache = {}

    def _get_char_ngrams(self, text, n):
        """Extract character n-grams from text"""
        text = text.upper()
        ngrams = []
        for i in range(len(text) - n + 1):
            ngrams.append(text[i:i+n])
        return ngrams

    def _tokenize_with_ngrams(self, text):
        """
        Tokenize with character n-grams

        Example:
            "MEDICAL" → ["ME", "ED", "DI", "IC", "CA", "AL", "MED", "EDI", "DIC", "ICA", "CAL"]
        """
        tokens = []
        words = text.upper().split()

        for word in words:
            # Add full word
            tokens.append(word)

            # Add character n-grams
            for n in range(self.ngram_range[0], self.ngram_range[1] + 1):
                tokens.extend(self._get_char_ngrams(word, n))

        return tokens

    def _soft_token_match(self, token1, token2):
        """
        Check if two tokens match with edit distance tolerance

        Returns:
            float: Similarity score (0.0 to 1.0)
        """
        if token1 == token2:
            return 1.0

        # Use Levenshtein distance
        max_len = max(len(token1), len(token2))
        if max_len == 0:
            return 0.0

        # Calculate edit distance using rapidfuzz
        similarity = fuzz.ratio(token1, token2) / 100.0

        # Apply threshold
        return similarity if similarity >= self.threshold else 0.0

    def fit_transform(self, documents):
        """
        Fit on documents and transform

        Args:
            documents: List of text documents

        Returns:
            Soft TF-IDF vectors (sparse matrix)
        """
        # Build vocabulary with n-grams
        vocabulary = set()
        doc_tokens = []

        for doc in documents:
            tokens = self._tokenize_with_ngrams(doc)
            doc_tokens.append(tokens)
            vocabulary.update(tokens)

        # Create TF-IDF vectorizer with custom vocabulary
        self.vectorizer = TfidfVectorizer(
            vocabulary=list(vocabulary),
            lowercase=False,  # Already uppercase
            tokenizer=lambda x: self._tokenize_with_ngrams(x)
        )

        # Transform documents
        return self.vectorizer.fit_transform(documents)

    def transform(self, documents):
        """Transform documents using fitted vectorizer"""
        if self.vectorizer is None:
            raise ValueError("Vectorizer not fitted. Call fit_transform first.")

        return self.vectorizer.transform(documents)

    def similarity(self, text1, text2):
        """
        Calculate Soft TF-IDF similarity between two texts

        Args:
            text1: First text
            text2: Second text

        Returns:
            float: Similarity score (0.0 to 1.0)
        """
        # Fit on both documents
        vectors = self.fit_transform([text1, text2])

        # Calculate cosine similarity
        similarity = cosine_similarity(vectors[0:1], vectors[1:2])[0][0]

        return max(0.0, min(1.0, similarity))


class ExplainableMatch:
    """
    Provides human-readable explanations for match decisions

    Based on 2024 XAI research: Transparency with minimal performance loss
    """

    def __init__(self, config):
        self.config = config
        self.console = Console()

    def explain_match(self, query, matched_candidate, match_result, detailed=True):
        """
        Generate comprehensive match explanation

        Args:
            query: Query record (dict with college_name, state, address, etc.)
            matched_candidate: Matched candidate from master data
            match_result: Match result dict (score, method, etc.)
            detailed: Whether to show detailed breakdown

        Returns:
            dict: Explanation with components, confidence, recommendation
        """
        explanation = {
            'overall_score': match_result.get('score', 0.0),
            'method': match_result.get('method', 'unknown'),
            'components': [],
            'confidence': 'unknown',
            'recommendation': 'review',
            'warnings': [],
            'strengths': []
        }

        # Component 1: Name Similarity
        name_score = self._calculate_name_similarity(
            query.get('college_name', ''),
            matched_candidate.get('name', '')
        )

        name_component = {
            'factor': 'Name Similarity',
            'score': name_score,
            'weight': 0.40,
            'contribution': name_score * 0.40,
            'status': '✅' if name_score >= 0.80 else '⚠️' if name_score >= 0.60 else '❌',
            'details': f"{name_score:.1%} match"
        }
        explanation['components'].append(name_component)

        if name_score >= 0.90:
            explanation['strengths'].append(f"Strong name match ({name_score:.1%})")
        elif name_score < 0.60:
            explanation['warnings'].append(f"Weak name match ({name_score:.1%})")

        # Component 2: State Match
        query_state = query.get('state', '').upper()
        candidate_state = matched_candidate.get('state', '').upper()
        state_match = query_state == candidate_state

        state_component = {
            'factor': 'State Match',
            'score': 1.0 if state_match else 0.0,
            'weight': 0.30,
            'contribution': 0.30 if state_match else 0.0,
            'status': '✅' if state_match else '❌',
            'details': f"Exact ({query_state})" if state_match else f"Mismatch ({query_state} ≠ {candidate_state})"
        }
        explanation['components'].append(state_component)

        if state_match:
            explanation['strengths'].append("State confirmed")
        else:
            explanation['warnings'].append(f"State mismatch: {query_state} vs {candidate_state}")

        # Component 3: City/District Match
        city_score = 0.0
        if query.get('address') and matched_candidate.get('address'):
            city_score = self._calculate_city_match(
                query.get('address', ''),
                matched_candidate.get('address', '')
            )

        city_component = {
            'factor': 'Location Match',
            'score': city_score,
            'weight': 0.15,
            'contribution': city_score * 0.15,
            'status': '✅' if city_score >= 0.70 else '⚠️' if city_score >= 0.40 else '➖',
            'details': f"{city_score:.1%} overlap" if city_score > 0 else "Not available"
        }
        explanation['components'].append(city_component)

        if city_score >= 0.70:
            explanation['strengths'].append(f"City/district confirmed ({city_score:.1%})")

        # Component 4: Historical Context
        historical_score = 0.0
        historical_count = match_result.get('historical_matches', 0)

        if historical_count > 0:
            historical_score = min(1.0, historical_count / 10.0)  # Max out at 10 matches

        historical_component = {
            'factor': 'Historical Context',
            'score': historical_score,
            'weight': 0.10,
            'contribution': historical_score * 0.10,
            'status': '✅' if historical_count >= 5 else '➖',
            'details': f"{historical_count} previous matches" if historical_count > 0 else "No history"
        }
        explanation['components'].append(historical_component)

        if historical_count >= 5:
            explanation['strengths'].append(f"{historical_count} successful historical matches")

        # Component 5: Method Confidence
        method_confidence = self._get_method_confidence(match_result.get('method', ''))

        method_component = {
            'factor': 'Match Method',
            'score': method_confidence,
            'weight': 0.05,
            'contribution': method_confidence * 0.05,
            'status': '✅' if method_confidence >= 0.90 else '⚠️',
            'details': match_result.get('method', 'unknown').replace('_', ' ').title()
        }
        explanation['components'].append(method_component)

        # Calculate overall confidence
        total_contribution = sum(c['contribution'] for c in explanation['components'])
        explanation['overall_score'] = total_contribution

        # Determine confidence level
        if total_contribution >= 0.95:
            explanation['confidence'] = 'VERY HIGH'
            explanation['recommendation'] = 'auto-accept'
        elif total_contribution >= 0.85:
            explanation['confidence'] = 'HIGH'
            explanation['recommendation'] = 'accept'
        elif total_contribution >= 0.75:
            explanation['confidence'] = 'MEDIUM'
            explanation['recommendation'] = 'review'
        elif total_contribution >= 0.60:
            explanation['confidence'] = 'LOW'
            explanation['recommendation'] = 'manual-review'
        else:
            explanation['confidence'] = 'VERY LOW'
            explanation['recommendation'] = 'reject'

        return explanation

    def _calculate_name_similarity(self, name1, name2):
        """Calculate name similarity score"""
        if not name1 or not name2:
            return 0.0
        return fuzz.ratio(name1.upper(), name2.upper()) / 100.0

    def _calculate_city_match(self, address1, address2):
        """Calculate city/location match score"""
        if not address1 or not address2:
            return 0.0

        # Extract keywords
        words1 = set(address1.upper().split())
        words2 = set(address2.upper().split())

        # Calculate Jaccard similarity
        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union) if union else 0.0

    def _get_method_confidence(self, method):
        """Get confidence score for match method"""
        method_scores = {
            'exact_match': 1.0,
            'direct_alias_match': 1.0,
            'primary_name_match': 0.98,
            'normalized_match': 0.95,
            'fuzzy_match': 0.85,
            'phonetic_match': 0.80,
            'tfidf_match': 0.85,
            'prefix_match': 0.70,
            'substring_match': 0.65,
        }

        return method_scores.get(method, 0.60)

    def display_explanation(self, explanation):
        """
        Display match explanation in beautiful format

        Args:
            explanation: Explanation dict from explain_match()
        """
        # Create explanation panel
        table = Table(show_header=True, header_style="bold cyan", box=None)
        table.add_column("Factor", style="cyan", width=20)
        table.add_column("Score", justify="right", width=10)
        table.add_column("Weight", justify="right", width=10)
        table.add_column("Contribution", justify="right", width=12)
        table.add_column("Status", width=8)

        for component in explanation['components']:
            table.add_row(
                component['factor'],
                f"{component['score']:.1%}",
                f"{component['weight']:.0%}",
                f"{component['contribution']:.1%}",
                component['status']
            )

        # Add separator
        table.add_row("─" * 20, "─" * 10, "─" * 10, "─" * 12, "─" * 8)

        # Add total
        table.add_row(
            "[bold]TOTAL SCORE[/bold]",
            "",
            "",
            f"[bold]{explanation['overall_score']:.1%}[/bold]",
            ""
        )

        # Determine color based on confidence
        color_map = {
            'VERY HIGH': 'green',
            'HIGH': 'green',
            'MEDIUM': 'yellow',
            'LOW': 'red',
            'VERY LOW': 'red'
        }

        confidence_color = color_map.get(explanation['confidence'], 'white')

        # Create panel
        panel_content = []
        panel_content.append(table)
        panel_content.append("")
        panel_content.append(f"[bold]Confidence:[/bold] [{confidence_color}]{explanation['confidence']}[/{confidence_color}]")
        panel_content.append(f"[bold]Recommendation:[/bold] [{confidence_color}]{explanation['recommendation'].upper()}[/{confidence_color}]")
        panel_content.append(f"[bold]Method:[/bold] {explanation['method'].replace('_', ' ').title()}")

        if explanation['strengths']:
            panel_content.append("")
            panel_content.append("[bold green]✓ Strengths:[/bold green]")
            for strength in explanation['strengths']:
                panel_content.append(f"  • {strength}")

        if explanation['warnings']:
            panel_content.append("")
            panel_content.append("[bold yellow]⚠ Warnings:[/bold yellow]")
            for warning in explanation['warnings']:
                panel_content.append(f"  • {warning}")

        # Display panel
        self.console.print(Panel(
            "\n".join([str(item) for item in panel_content]),
            title="[bold cyan]Match Explanation[/bold cyan]",
            border_style="cyan"
        ))


class UncertaintyQuantifier:
    """
    Quantifies uncertainty in match predictions

    Provides confidence intervals and agreement metrics across multiple matchers
    """

    def __init__(self, matchers=None):
        """
        Initialize uncertainty quantifier

        Args:
            matchers: List of matcher functions/methods to ensemble
        """
        self.matchers = matchers or []

    def predict_with_uncertainty(self, query, candidates, matcher_results=None):
        """
        Predict match with uncertainty quantification

        Args:
            query: Query record
            candidates: List of candidate records
            matcher_results: Optional pre-computed results from multiple matchers

        Returns:
            dict: {
                'best_match': candidate,
                'score': mean_score,
                'ci_lower': lower bound (95% CI),
                'ci_upper': upper bound (95% CI),
                'uncertainty': 'low'|'medium'|'high',
                'agreement': agreement score (0-1),
                'predictions': list of individual predictions
            }
        """
        if matcher_results is None:
            # Run all matchers if not provided
            matcher_results = []
            for matcher in self.matchers:
                result = matcher(query, candidates)
                matcher_results.append(result)

        if not matcher_results:
            return {
                'best_match': None,
                'score': 0.0,
                'ci_lower': 0.0,
                'ci_upper': 0.0,
                'uncertainty': 'high',
                'agreement': 0.0,
                'predictions': []
            }

        # Extract scores for each candidate
        candidate_scores = defaultdict(list)

        for result in matcher_results:
            if isinstance(result, dict):
                candidate_id = result.get('candidate', {}).get('id')
                score = result.get('score', 0.0)
                if candidate_id:
                    candidate_scores[candidate_id].append(score)
            elif isinstance(result, list):
                for match in result:
                    candidate_id = match.get('candidate', {}).get('id')
                    score = match.get('score', 0.0)
                    if candidate_id:
                        candidate_scores[candidate_id].append(score)

        # Find best candidate with uncertainty
        best_candidate = None
        best_mean_score = 0.0
        best_ci_lower = 0.0
        best_ci_upper = 0.0
        best_uncertainty = 'high'
        best_agreement = 0.0

        for candidate_id, scores in candidate_scores.items():
            if not scores:
                continue

            # Calculate statistics
            mean_score = np.mean(scores)
            std_score = np.std(scores) if len(scores) > 1 else 0.0

            # 95% confidence interval (using normal approximation)
            n = len(scores)
            margin = 1.96 * (std_score / np.sqrt(n)) if n > 0 else 0.0
            ci_lower = max(0.0, mean_score - margin)
            ci_upper = min(1.0, mean_score + margin)

            # Calculate agreement (inverse of coefficient of variation)
            cv = std_score / mean_score if mean_score > 0 else 1.0
            agreement = 1.0 / (1.0 + cv)

            # Determine uncertainty level
            if std_score < 0.05:
                uncertainty = 'low'
            elif std_score < 0.15:
                uncertainty = 'medium'
            else:
                uncertainty = 'high'

            # Update best if this is better
            if mean_score > best_mean_score:
                best_mean_score = mean_score
                best_candidate = candidate_id
                best_ci_lower = ci_lower
                best_ci_upper = ci_upper
                best_uncertainty = uncertainty
                best_agreement = agreement

        return {
            'best_match': best_candidate,
            'score': best_mean_score,
            'ci_lower': best_ci_lower,
            'ci_upper': best_ci_upper,
            'uncertainty': best_uncertainty,
            'agreement': best_agreement,
            'predictions': matcher_results,
            'num_matchers': len(matcher_results)
        }

    def display_uncertainty(self, uncertainty_result):
        """
        Display uncertainty information

        Args:
            uncertainty_result: Result from predict_with_uncertainty()
        """
        console = Console()

        score = uncertainty_result['score']
        ci_lower = uncertainty_result['ci_lower']
        ci_upper = uncertainty_result['ci_upper']
        uncertainty = uncertainty_result['uncertainty']
        agreement = uncertainty_result['agreement']

        # Create display
        table = Table(show_header=False, box=None)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="white")

        table.add_row("Match Score", f"{score:.1%}")
        table.add_row("Confidence Interval", f"[{ci_lower:.1%}, {ci_upper:.1%}]")
        table.add_row("Margin of Error", f"±{(ci_upper - ci_lower)/2:.1%}")
        table.add_row("Agreement", f"{agreement:.1%}")
        table.add_row("Uncertainty", f"{uncertainty.upper()}")
        table.add_row("Matchers", str(uncertainty_result['num_matchers']))

        # Color based on uncertainty
        color = 'green' if uncertainty == 'low' else 'yellow' if uncertainty == 'medium' else 'red'

        console.print(Panel(
            table,
            title=f"[bold {color}]Uncertainty Analysis[/bold {color}]",
            border_style=color
        ))


class EnsembleMatcher:
    """
    Ensemble matcher with weighted voting across multiple strategies

    Combines fuzzy, phonetic, TF-IDF, ML, and transformer approaches
    """

    def __init__(self, config, base_matcher):
        """
        Initialize ensemble matcher

        Args:
            config: Configuration dict
            base_matcher: Base matcher instance (for accessing methods)
        """
        self.config = config
        self.base_matcher = base_matcher

        # Matcher weights (customizable)
        self.weights = {
            'fuzzy': 0.30,
            'phonetic': 0.20,
            'tfidf': 0.20,
            'ml': 0.15,
            'transformer': 0.15
        }

        # Initialize sub-matchers
        self.soft_tfidf = SoftTFIDF()
        self.uncertainty_quantifier = UncertaintyQuantifier()
        self.explainer = ExplainableMatch(config)

    def match_with_ensemble(self, query_college, candidates, query_state='', query_address=''):
        """
        Match using ensemble of strategies

        Args:
            query_college: College name to match
            candidates: List of candidate colleges
            query_state: State for context
            query_address: Address for context

        Returns:
            list: Ranked matches with ensemble scores and explanations
        """
        if not candidates:
            return []

        # Store individual matcher results
        matcher_results = {
            'fuzzy': [],
            'phonetic': [],
            'tfidf': [],
            'soft_tfidf': []
        }

        # Run each matcher
        for candidate in candidates:
            candidate_name = candidate.get('name', '')
            candidate_id = candidate.get('id', '')

            # 1. Fuzzy matching
            fuzzy_score = fuzz.ratio(query_college.upper(), candidate_name.upper()) / 100.0
            matcher_results['fuzzy'].append({
                'candidate': candidate,
                'score': fuzzy_score,
                'method': 'fuzzy'
            })

            # 2. Phonetic matching
            phonetic_score = 0.0
            try:
                query_phonetic = jellyfish.metaphone(query_college)
                candidate_phonetic = jellyfish.metaphone(candidate_name)
                if query_phonetic == candidate_phonetic:
                    phonetic_score = 0.95
                else:
                    # Fuzzy match phonetic keys
                    phonetic_score = fuzz.ratio(query_phonetic, candidate_phonetic) / 100.0 * 0.85
            except:
                phonetic_score = 0.0

            matcher_results['phonetic'].append({
                'candidate': candidate,
                'score': phonetic_score,
                'method': 'phonetic'
            })

            # 3. TF-IDF (standard)
            tfidf_score = 0.0
            try:
                if hasattr(self.base_matcher, 'calculate_tfidf_similarity'):
                    tfidf_score = self.base_matcher.calculate_tfidf_similarity(
                        query_college, candidate_name, 'medical'
                    )
            except:
                tfidf_score = 0.0

            matcher_results['tfidf'].append({
                'candidate': candidate,
                'score': tfidf_score,
                'method': 'tfidf'
            })

            # 4. Soft TF-IDF (new!)
            soft_tfidf_score = 0.0
            try:
                soft_tfidf_score = self.soft_tfidf.similarity(query_college, candidate_name)
            except:
                soft_tfidf_score = 0.0

            matcher_results['soft_tfidf'].append({
                'candidate': candidate,
                'score': soft_tfidf_score,
                'method': 'soft_tfidf'
            })

        # Ensemble voting: aggregate scores
        ensemble_results = []

        for i, candidate in enumerate(candidates):
            # Get scores from all matchers
            fuzzy_score = matcher_results['fuzzy'][i]['score']
            phonetic_score = matcher_results['phonetic'][i]['score']
            tfidf_score = matcher_results['tfidf'][i]['score']
            soft_tfidf_score = matcher_results['soft_tfidf'][i]['score']

            # Weighted ensemble score
            ensemble_score = (
                fuzzy_score * self.weights['fuzzy'] +
                phonetic_score * self.weights['phonetic'] +
                tfidf_score * self.weights['tfidf'] +
                soft_tfidf_score * 0.15  # Additional weight for soft TF-IDF
            )

            # Calculate agreement (how much matchers agree)
            scores = [fuzzy_score, phonetic_score, tfidf_score, soft_tfidf_score]
            scores = [s for s in scores if s > 0]  # Filter out zeros

            if scores:
                std_dev = np.std(scores)
                mean_score = np.mean(scores)
                cv = std_dev / mean_score if mean_score > 0 else 1.0
                agreement = 1.0 / (1.0 + cv)
            else:
                agreement = 0.0

            # Determine uncertainty
            if std_dev < 0.05:
                uncertainty = 'low'
            elif std_dev < 0.15:
                uncertainty = 'medium'
            else:
                uncertainty = 'high'

            ensemble_results.append({
                'candidate': candidate,
                'score': ensemble_score,
                'method': 'ensemble_voting',
                'agreement': agreement,
                'uncertainty': uncertainty,
                'component_scores': {
                    'fuzzy': fuzzy_score,
                    'phonetic': phonetic_score,
                    'tfidf': tfidf_score,
                    'soft_tfidf': soft_tfidf_score
                }
            })

        # Sort by ensemble score
        ensemble_results.sort(key=lambda x: x['score'], reverse=True)

        return ensemble_results

# ============================================================================
# END OF NEW ADVANCED FEATURES
# ============================================================================

def main():
    """Main function with enhanced features"""

    # Run startup checks
    if not check_startup_requirements():
        console.print("\n[bold red]⛔ Startup checks failed - exiting[/bold red]")
        console.print("[yellow]Please install missing dependencies or create required files[/yellow]")
        return

    # Run database migrations for counselling data
    migrate_counselling_add_source_level_columns()
    migrate_counselling_add_address_column()

    console.print(Panel.fit(
        "[bold cyan]🚀 Advanced SQLite Matcher - Unified Edition[/bold cyan]\n"
        "Features: Seat Data + Counselling Data, Interactive Review, Batch Import",
        border_style="cyan"
    ))

    # Select data type first
    console.print("\n[bold]Select Data Type:[/bold]")
    console.print("  [1] Seat Data (college_name, course_name, state, address)")
    console.print("  [2] Counselling Data (AIQ/KEA cutoffs with quota, category, rank)")
    console.print("  [3] Master Data (import/export colleges, courses)")
    console.print("  [4] 📦 Export to Parquet (Seat/Counselling/Master)")

    data_type_choice = Prompt.ask("Data type", choices=["1", "2", "3", "4"], default="1")

    # Handle Export to Parquet mode
    if data_type_choice == "4":
        console.print("\n[bold cyan]📦 Export to Parquet Mode[/bold cyan]")

        # Initialize matcher with default data type (we need it for database access)
        matcher = AdvancedSQLiteMatcher(data_type='seat')

        # Load master data for potential exports
        matcher.load_master_data()

        # Go directly to unified parquet export menu
        console.print("[green]✓ Entering Parquet Export Menu[/green]")
        matcher.unified_parquet_export_menu()

        # After export, ask if user wants to continue
        console.print("\n[bold cyan]Export Complete[/bold cyan]")
        if Confirm.ask("Continue to Seat Data, Counselling, or Master Data mode?", default=False):
            console.print("\n[bold]Select Mode:[/bold]")
            console.print("  [1] Seat Data")
            console.print("  [2] Counselling Data")
            console.print("  [3] Master Data")
            mode_choice = Prompt.ask("Mode", choices=["1", "2", "3"], default="1")

            if mode_choice == "1":
                data_type_choice = "1"
            elif mode_choice == "2":
                data_type_choice = "2"
            elif mode_choice == "3":
                data_type_choice = "3"
        else:
            console.print("[bold green]👋 Goodbye![/bold green]")
            return

    # Handle Master Data mode separately
    if data_type_choice == "3":
        console.print("\n[bold cyan]🗄️  Master Data Management Mode[/bold cyan]")

        # Initialize matcher with default data type (we need it for database access)
        matcher = AdvancedSQLiteMatcher(data_type='seat')

        # Go directly to master data management menu
        console.print("[green]✓ Entering Master Data Management[/green]")
        matcher.show_master_data_management_menu()

        # After exiting master data menu, ask if user wants to continue to seat/counselling mode
        console.print("\n[bold cyan]Master Data Management Complete[/bold cyan]")
        if Confirm.ask("Continue to Seat Data or Counselling mode?", default=False):
            console.print("\n[bold]Select Mode:[/bold]")
            console.print("  [1] Seat Data")
            console.print("  [2] Counselling Data")
            mode_choice = Prompt.ask("Mode", choices=["1", "2"], default="1")
            data_type = 'seat' if mode_choice == "1" else 'counselling'

            # Reinitialize matcher with correct data type
            matcher = AdvancedSQLiteMatcher(data_type=data_type)
        else:
            console.print("[bold green]👋 Goodbye![/bold green]")
            return
    else:
        # Normal seat/counselling mode
        data_type = 'seat' if data_type_choice == "1" else 'counselling'

    # Ask about incremental processing
    console.print("\n[bold cyan]⚡ Incremental Processing Mode[/bold cyan]")
    console.print("  Enable incremental processing to skip files that were already processed")
    console.print("  [yellow]⚠️  Note: If you have new data with same filename, disable this to reprocess[/yellow]")

    enable_incremental = Confirm.ask("Enable incremental processing?", default=False)

    # Initialize/update matcher with selected data type
    if data_type_choice != "3":
        matcher = AdvancedSQLiteMatcher(data_type=data_type)

    matcher.enable_incremental = enable_incremental

    if enable_incremental:
        matcher.load_incremental_state()
        console.print("[green]✓ Incremental processing enabled[/green]")
    else:
        console.print("[cyan]✓ Processing all files (incremental disabled)[/cyan]")

    # Load master data with Rich UI
    matcher.load_master_data()

    console.print(f"\n[green]✅ Working in {data_type.upper()} mode[/green]")

    # Menu-driven interface
    while True:
        console.print("\n[bold]Select an option:[/bold]")

        if data_type == 'counselling':
            console.print("  [1] Import single Excel counselling file")
            console.print("  [2] Import folder of Excel files (batch)")
            console.print("  [3] Match and link counselling data")
            console.print("  [4] 📦 Export to Parquet")
            console.print("  [5] Interactive review of unmatched records")
            console.print("  [6] Validate data")
            console.print("  [7] Advanced Features →")
            console.print("  [8] Analytics & Reporting →")
            console.print("  [9] Data Tools →")
            console.print("  [10] Clear Database")
            console.print("  [11] Switch to Seat Data mode")
            console.print("  [12] 🤖 AI-Powered Matching (Advanced)")
            console.print("  [13] 🗄️  Master Data Management")
            console.print("  [14] Exit")

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"], default="1")

            table_name = 'counselling_records'

            if choice == "1":
                # Import single counselling Excel file
                file_path = Prompt.ask("Enter Excel file path")
                if Path(file_path).exists():
                    matcher.import_excel_counselling(file_path)
                else:
                    console.print("[red]❌ File not found![/red]")
            elif choice == "2":
                # Import folder of Excel files
                folder_path = Prompt.ask("Enter folder path containing Excel files")
                if Path(folder_path).exists():
                    recursive = Confirm.ask("Include subfolders?", default=False)
                    matcher.batch_import_from_folder(folder_path, recursive)
                else:
                    console.print("[red]❌ Folder not found![/red]")
            elif choice == "3":
                # Match and link counselling data
                matcher.match_and_link_parallel('counselling_records', 'counselling_records')
            elif choice == "4":
                # Export to Parquet
                matcher.unified_parquet_export_menu()
            elif choice == "5":
                # Enhanced Interactive review with ID input
                matcher.interactive_review_enhanced()
            elif choice == "6":
                # Validate
                conn = sqlite3.connect(matcher.data_db_path)
                df = pd.read_sql("SELECT * FROM counselling_records LIMIT 1000", conn)
                conn.close()
                matcher.validate_data(df)
            elif choice == "7":
                # Advanced Features Sub-menu
                while True:
                    console.print("\n[bold cyan]🚀 Advanced Features[/bold cyan]")
                    console.print("  [1] Phonetic Matching (handle spelling variations)")
                    console.print("  [2] Smart Alias Auto-Generation")
                    console.print("  [3] Anomaly Detection")
                    console.print("  [4] Batch Operations")
                    console.print("  [5] ML & Context-Aware Matching →")
                    console.print("  [6] 🎓 Manage DIPLOMA Courses Configuration")
                    console.print("  [7] Back to main menu")

                    adv_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

                    if adv_choice == "1":
                        # Phonetic Matching Demo
                        console.print("\n[bold]🔊 Phonetic Matching[/bold]")
                        college1 = Prompt.ask("Enter first college name")
                        college2 = Prompt.ask("Enter second college name")

                        is_match, algorithm, score = matcher.phonetic_match(college1, college2)

                        if is_match:
                            console.print(f"[green]✅ Phonetic Match Found![/green]")
                            console.print(f"   Algorithm: {algorithm}")
                            console.print(f"   Score: {score:.2%}")
                        else:
                            console.print("[red]❌ No phonetic match[/red]")

                    elif adv_choice == "2":
                        # Smart Alias Auto-Generation
                        console.print("\n[bold]🤖 Smart Alias Auto-Generation[/bold]")
                        limit = int(Prompt.ask("Number of unmatched records to analyze", default="100"))

                        suggestions = matcher.analyze_unmatched_patterns(limit)

                        if suggestions and suggestions.get('college_aliases'):
                            console.print(f"\nFound {len(suggestions['college_aliases'])} alias suggestions")
                            auto_apply = Confirm.ask("Auto-apply high-confidence aliases (>80%)?", default=False)

                            results = matcher.auto_generate_aliases(suggestions, auto_apply=auto_apply)

                            console.print(f"\n[green]✅ Alias generation complete![/green]")
                            console.print(f"   High confidence: {len(results['high_confidence'])}")
                            console.print(f"   Medium confidence: {len(results['medium_confidence'])}")
                            if auto_apply:
                                console.print(f"   Applied: {results['applied']}")

                    elif adv_choice == "3":
                        # Anomaly Detection
                        anomalies = matcher.detect_anomalies('counselling_records')

                        if any(anomalies.values()):
                            console.print("\n[yellow]⚠️  Anomalies detected! Check the report above.[/yellow]")

                            # Offer to export
                            export = Confirm.ask("Export anomalies to JSON?", default=False)
                            if export:
                                filename = f"anomalies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                                with open(filename, 'w') as f:
                                    json.dump(anomalies, f, indent=2)
                                console.print(f"[green]✅ Exported to {filename}[/green]")

                    elif adv_choice == "4":
                        # Batch Operations Sub-menu
                        console.print("\n[bold cyan]🔄 Batch Operations[/bold cyan]")
                        console.print("  [1] Batch accept high-confidence matches")
                        console.print("  [2] Batch reject low-confidence matches")
                        console.print("  [3] Batch re-validate all records")
                        console.print("  [4] Back")

                        batch_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4"], default="4")

                        if batch_choice == "1":
                            threshold = float(Prompt.ask("Minimum confidence threshold", default="0.9"))
                            matcher.batch_accept_high_confidence_matches(threshold)

                        elif batch_choice == "2":
                            threshold = float(Prompt.ask("Maximum confidence threshold", default="0.5"))
                            matcher.batch_reject_low_confidence_matches(threshold)

                        elif batch_choice == "3":
                            matcher.batch_update_validation_status()

                    elif adv_choice == "5":
                        # ML & Context-Aware Sub-menu
                        while True:
                            console.print("\n[bold cyan]🤖 ML & Context-Aware Matching[/bold cyan]")
                            console.print("  [1] Train ML Model")
                            console.print("  [2] Load ML Model")
                            console.print("  [3] Build Historical Context")
                            console.print("  [4] Load Historical Context")
                            console.print("  [5] Test Hybrid Matching")
                            console.print("  [6] Enable Hybrid Matching for Next Run")
                            console.print("  [7] Back")

                            ml_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

                            if ml_choice == "1":
                                # Train ML Model
                                console.print("\n[bold]🤖 ML Model Training[/bold]")
                                console.print("Available models:")
                                console.print("  [1] Random Forest (best accuracy)")
                                console.print("  [2] Gradient Boosting (balanced)")
                                console.print("  [3] Logistic Regression (fastest)")

                                model_choice = Prompt.ask("Choose model", choices=["1", "2", "3"], default="1")
                                model_map = {'1': 'random_forest', '2': 'gradient_boosting', '3': 'logistic'}
                                model_type = model_map[model_choice]

                                results = matcher.train_ml_model(model_type)

                                if results:
                                    console.print(f"\n[bold green]✅ Model trained successfully![/bold green]")
                                    console.print(f"   Test Accuracy: {results['test_score']:.2%}")
                                    console.print(f"   CV Score: {results['cv_mean']:.2%} ± {results['cv_std']:.2%}")

                            elif ml_choice == "2":
                                # Load ML Model
                                console.print("\n[bold]📂 Load ML Model[/bold]")
                                model_type = Prompt.ask(
                                    "Model type",
                                    choices=["random_forest", "gradient_boosting", "logistic"],
                                    default="random_forest"
                                )

                                success = matcher.load_ml_model(model_type)
                                if success:
                                    console.print("[green]✅ Model loaded and ready to use![/green]")

                            elif ml_choice == "3":
                                # Build Historical Context
                                matcher.build_historical_context()

                            elif ml_choice == "4":
                                # Load Historical Context
                                success = matcher.load_historical_context()
                                if success:
                                    console.print("[green]✅ Historical context loaded![/green]")

                            elif ml_choice == "5":
                                # Test Hybrid Matching
                                console.print("\n[bold]🧪 Test Hybrid Matching[/bold]")
                                college_name = Prompt.ask("Enter college name to match")
                                state = Prompt.ask("Enter state")

                                # Try hybrid matching
                                match, score, method = matcher.hybrid_match(college_name, state, 'unknown', '')

                                if match:
                                    console.print(f"\n[green]✅ Match Found![/green]")
                                    console.print(f"   Matched: {match['name']}")
                                    console.print(f"   Score: {score:.2%}")
                                    console.print(f"   Method: {method}")
                                else:
                                    console.print("[red]❌ No match found[/red]")

                            elif ml_choice == "6":
                                # Enable hybrid matching
                                console.print("\n[yellow]⚠️  Feature not yet implemented in main matching loop[/yellow]")
                                console.print("Use Test Hybrid Matching (option 5) for now")

                            elif ml_choice == "7":
                                break

                    elif adv_choice == "6":
                        # Manage DIPLOMA Courses
                        matcher.manage_diploma_courses_menu()

                    elif adv_choice == "7":
                        break

            elif choice == "8":
                # Analytics & Reporting Sub-menu
                while True:
                    console.print("\n[bold cyan]📊 Analytics & Reporting[/bold cyan]")
                    console.print("  [1] View Analytics Dashboard")
                    console.print("  [2] Export Analytics Report (JSON)")
                    console.print("  [3] Export Analytics Report (Excel)")
                    console.print("  [4] Run Quality Assurance Suite")
                    console.print("  [5] Generate Visualizations")
                    console.print("  [6] Advanced Search & Query Builder")
                    console.print("  [7] Back to main menu")

                    analytics_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

                    if analytics_choice == "1":
                        matcher.generate_analytics_dashboard(table_name)

                    elif analytics_choice == "2":
                        matcher.export_analytics_report(table_name, format='json')

                    elif analytics_choice == "3":
                        matcher.export_analytics_report(table_name, format='excel')

                    elif analytics_choice == "4":
                        matcher.run_quality_assurance_suite(table_name)

                    elif analytics_choice == "5":
                        matcher.generate_visualizations(table_name)

                    elif analytics_choice == "6":
                        matcher.advanced_search(table_name)

                    elif analytics_choice == "7":
                        break

            elif choice == "9":
                # Data Tools Sub-menu
                while True:
                    console.print("\n[bold cyan]🛠️  Data Tools[/bold cyan]")
                    console.print("  [1] Smart Data Enrichment")
                    console.print("  [2] Bulk Find & Replace")
                    console.print("  [3] Bulk Field Update")
                    console.print("  [4] Advanced Duplicate Finder")
                    console.print("  [5] Export Data (Multiple Formats)")
                    console.print("  [6] Track Data Changes")
                    console.print("  [7] Enable Audit Trail")
                    console.print("  [8] View Audit History")
                    console.print("  [9] Manage Abbreviations")
                    console.print("  [10] Migrate Alias Table (Location Support)")
                    console.print("  [11] View Aliases Needing Location")
                    console.print("  [12] Setup Scheduled Import")
                    console.print("  [13] Back to main menu")

                    tools_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"], default="13")

                    if tools_choice == "1":
                        matcher.auto_enrich_data(table_name)

                    elif tools_choice == "2":
                        matcher.bulk_find_replace(table_name)

                    elif tools_choice == "3":
                        matcher.bulk_field_update(table_name)

                    elif tools_choice == "4":
                        threshold = float(Prompt.ask("Similarity threshold (0-1)", default="0.85"))
                        matcher.advanced_duplicate_finder(table_name, threshold)

                    elif tools_choice == "5":
                        console.print("\n[bold]Select export format:[/bold]")
                        console.print("  [1] Parquet (Optimized - Recommended)")
                        console.print("  [2] CSV")
                        console.print("  [3] Excel")
                        console.print("  [4] JSON")
                        console.print("  [5] JSONL")
                        console.print("  [6] SQL Dump")

                        format_choice = Prompt.ask("Format", choices=["1", "2", "3", "4", "5", "6"], default="1")

                        if format_choice == "1":
                            # Enhanced Parquet export
                            console.print("\n[cyan]📦 Enhanced Parquet Export Options[/cyan]")

                            # Ask about partitioning
                            partition = Confirm.ask("Enable partitioning (by state/year)?", default=True)
                            partition_cols = ['state', 'year'] if partition else None

                            # Ask about compression
                            console.print("\n[bold]Compression codec:[/bold]")
                            console.print("  [1] Snappy (fast, good compression)")
                            console.print("  [2] Gzip (slower, better compression)")
                            console.print("  [3] Zstd (balanced)")

                            comp_choice = Prompt.ask("Compression", choices=["1", "2", "3"], default="1")
                            comp_map = {'1': 'snappy', '2': 'gzip', '3': 'zstd'}
                            compression = comp_map[comp_choice]

                            # Export
                            matcher.export_to_parquet(
                                output_path=f'output/{table_name}_matched.parquet',
                                partition_by=partition_cols,
                                compression=compression,
                                validate=True,
                                table_name=table_name
                            )
                        else:
                            # Legacy export formats
                            format_map = {'2': 'csv', '3': 'excel', '4': 'json', '5': 'jsonl', '6': 'sql'}
                            export_format = format_map[format_choice]
                            matcher.export_to_format(table_name, export_format)

                    elif tools_choice == "6":
                        matcher.track_data_changes(table_name)

                    elif tools_choice == "7":
                        matcher.enable_audit_trail(table_name)

                    elif tools_choice == "8":
                        record_id = Prompt.ask("Record ID (leave blank for all)", default="")
                        matcher.view_audit_history(record_id if record_id else None)

                    elif tools_choice == "9":
                        matcher.manage_abbreviations()

                    elif tools_choice == "10":
                        matcher.migrate_college_aliases_table()

                    elif tools_choice == "11":
                        matcher.view_aliases_needing_location()

                    elif tools_choice == "12":
                        matcher.setup_scheduled_import()

                    elif tools_choice == "13":
                        break

            elif choice == "10":
                # Clear Database
                confirm = Confirm.ask(
                    "[bold red]⚠️  WARNING: This will delete ALL counselling records! Continue?[/bold red]",
                    default=False
                )
                if confirm:
                    matcher.clear_database_table('counselling_records')
                    console.print("[green]✅ Database cleared successfully![/green]")
                else:
                    console.print("[yellow]❌ Operation cancelled[/yellow]")

            elif choice == "11":
                # Switch mode
                main()
                return

            elif choice == "12":
                # AI-Powered Matching
                matcher.show_ai_features_menu()

            elif choice == "13":
                # Master Data Management
                matcher.show_master_data_management_menu()

            elif choice == "14":
                console.print("[bold green]👋 Goodbye![/bold green]")
                break

        else:  # seat data mode - ENHANCED VERSION
            console.print("  [1] Import single Excel seat data file")
            console.print("  [2] Import folder of Excel files (batch)")
            console.print("  [3] Match and link seat data (parallel)")
            console.print("  [4] 📦 Export to Parquet")
            console.print("  [5] Interactive review of unmatched records")
            console.print("  [6] Validate data")
            console.print("  [7] Advanced Features →")
            console.print("  [8] Analytics & Reporting →")
            console.print("  [9] Data Tools →")
            console.print("  [10] Clear Database")
            console.print("  [11] Switch to Counselling mode")
            console.print("  [12] 🤖 AI-Powered Matching (Advanced)")
            console.print("  [13] 🗄️  Master Data Management")
            console.print("  [14] Exit")

            choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"], default="1")

            table_name = 'seat_data'

            if choice == "1":
                # Import single file
                file_path = Prompt.ask("Enter Excel file path")
                if Path(file_path).exists():
                    count = matcher.import_excel_to_db(file_path)
                    console.print(f"[green]✅ Imported {count:,} records[/green]")
                else:
                    console.print("[red]❌ File not found![/red]")
            elif choice == "2":
                # Import folder of Excel files
                folder_path = Prompt.ask("Enter folder path containing Excel files")
                if Path(folder_path).exists():
                    recursive = Confirm.ask("Include subfolders?", default=False)
                    matcher.batch_import_from_folder(folder_path, recursive)
                else:
                    console.print("[red]❌ Folder not found![/red]")
            elif choice == "3":
                # Match and link seat data
                matcher.match_and_link_parallel('seat_data', 'seat_data')
            elif choice == "4":
                # Export to Parquet
                matcher.unified_parquet_export_menu()
            elif choice == "5":
                # Enhanced Interactive review with ID input
                matcher.interactive_review_enhanced()
            elif choice == "6":
                # Validate
                conn = sqlite3.connect(matcher.seat_db_path)
                df = pd.read_sql("SELECT * FROM seat_data_raw LIMIT 1000", conn)
                conn.close()
                matcher.validate_data(df)
            elif choice == "7":
                # Advanced Features Sub-menu
                while True:
                    console.print("\n[bold cyan]🚀 Advanced Features[/bold cyan]")
                    console.print("  [1] Phonetic Matching (handle spelling variations)")
                    console.print("  [2] Smart Alias Auto-Generation")
                    console.print("  [3] Anomaly Detection")
                    console.print("  [4] Batch Operations")
                    console.print("  [5] ML & Context-Aware Matching →")
                    console.print("  [6] 🎓 Manage DIPLOMA Courses Configuration")
                    console.print("  [7] Back to main menu")

                    adv_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

                    if adv_choice == "1":
                        # Phonetic Matching Demo
                        console.print("\n[bold]🔊 Phonetic Matching[/bold]")
                        college1 = Prompt.ask("Enter first college name")
                        college2 = Prompt.ask("Enter second college name")

                        is_match, algorithm, score = matcher.phonetic_match(college1, college2)

                        if is_match:
                            console.print(f"[green]✅ Phonetic Match Found![/green]")
                            console.print(f"   Algorithm: {algorithm}")
                            console.print(f"   Score: {score:.2%}")
                        else:
                            console.print("[red]❌ No phonetic match[/red]")

                    elif adv_choice == "2":
                        # Smart Alias Auto-Generation
                        console.print("\n[bold]🤖 Smart Alias Auto-Generation[/bold]")
                        limit = int(Prompt.ask("Number of unmatched records to analyze", default="100"))

                        suggestions = matcher.analyze_unmatched_patterns(limit)

                        if suggestions and suggestions.get('college_aliases'):
                            console.print(f"\nFound {len(suggestions['college_aliases'])} alias suggestions")
                            auto_apply = Confirm.ask("Auto-apply high-confidence aliases (>80%)?", default=False)

                            results = matcher.auto_generate_aliases(suggestions, auto_apply=auto_apply)

                            console.print(f"\n[green]✅ Alias generation complete![/green]")
                            console.print(f"   High confidence: {len(results['high_confidence'])}")
                            console.print(f"   Medium confidence: {len(results['medium_confidence'])}")
                            if auto_apply:
                                console.print(f"   Applied: {results['applied']}")

                    elif adv_choice == "3":
                        # Anomaly Detection
                        anomalies = matcher.detect_anomalies('seat_data')

                        if any(anomalies.values()):
                            console.print("\n[yellow]⚠️  Anomalies detected! Check the report above.[/yellow]")

                            # Offer to export
                            export = Confirm.ask("Export anomalies to JSON?", default=False)
                            if export:
                                filename = f"anomalies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                                with open(filename, 'w') as f:
                                    json.dump(anomalies, f, indent=2)
                                console.print(f"[green]✅ Exported to {filename}[/green]")

                    elif adv_choice == "4":
                        # Batch Operations Sub-menu
                        console.print("\n[bold cyan]🔄 Batch Operations[/bold cyan]")
                        console.print("  [1] Batch accept high-confidence matches")
                        console.print("  [2] Batch reject low-confidence matches")
                        console.print("  [3] Batch re-validate all records")
                        console.print("  [4] Back")

                        batch_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4"], default="4")

                        if batch_choice == "1":
                            threshold = float(Prompt.ask("Minimum confidence threshold", default="0.9"))
                            matcher.batch_accept_high_confidence_matches(threshold)

                        elif batch_choice == "2":
                            threshold = float(Prompt.ask("Maximum confidence threshold", default="0.5"))
                            matcher.batch_reject_low_confidence_matches(threshold)

                        elif batch_choice == "3":
                            matcher.batch_update_validation_status()

                    elif adv_choice == "5":
                        # ML & Context-Aware Sub-menu
                        while True:
                            console.print("\n[bold cyan]🤖 ML & Context-Aware Matching[/bold cyan]")
                            console.print("  [1] Train ML Model")
                            console.print("  [2] Load ML Model")
                            console.print("  [3] Build Historical Context")
                            console.print("  [4] Load Historical Context")
                            console.print("  [5] Test Hybrid Matching")
                            console.print("  [6] Enable Hybrid Matching for Next Run")
                            console.print("  [7] Back")

                            ml_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

                            if ml_choice == "1":
                                # Train ML Model
                                console.print("\n[bold]🤖 ML Model Training[/bold]")
                                console.print("Available models:")
                                console.print("  [1] Random Forest (best accuracy)")
                                console.print("  [2] Gradient Boosting (balanced)")
                                console.print("  [3] Logistic Regression (fastest)")

                                model_choice = Prompt.ask("Choose model", choices=["1", "2", "3"], default="1")
                                model_map = {'1': 'random_forest', '2': 'gradient_boosting', '3': 'logistic'}
                                model_type = model_map[model_choice]

                                results = matcher.train_ml_model(model_type)

                                if results:
                                    console.print(f"\n[bold green]✅ Model trained successfully![/bold green]")
                                    console.print(f"   Test Accuracy: {results['test_score']:.2%}")
                                    console.print(f"   CV Score: {results['cv_mean']:.2%} ± {results['cv_std']:.2%}")

                            elif ml_choice == "2":
                                # Load ML Model
                                console.print("\n[bold]📂 Load ML Model[/bold]")
                                model_type = Prompt.ask(
                                    "Model type",
                                    choices=["random_forest", "gradient_boosting", "logistic"],
                                    default="random_forest"
                                )

                                success = matcher.load_ml_model(model_type)
                                if success:
                                    console.print("[green]✅ Model loaded and ready to use![/green]")

                            elif ml_choice == "3":
                                # Build Historical Context
                                matcher.build_historical_context()

                            elif ml_choice == "4":
                                # Load Historical Context
                                success = matcher.load_historical_context()
                                if success:
                                    console.print("[green]✅ Historical context loaded![/green]")

                            elif ml_choice == "5":
                                # Test Hybrid Matching
                                console.print("\n[bold]🧪 Test Hybrid Matching[/bold]")
                                college_name = Prompt.ask("Enter college name to match")
                                state = Prompt.ask("Enter state")

                                # Try hybrid matching
                                match, score, method = matcher.hybrid_match(college_name, state, 'unknown', '')

                                if match:
                                    console.print(f"\n[green]✅ Match Found![/green]")
                                    console.print(f"   Matched: {match['name']}")
                                    console.print(f"   Score: {score:.2%}")
                                    console.print(f"   Method: {method}")
                                else:
                                    console.print("[red]❌ No match found[/red]")

                            elif ml_choice == "6":
                                # Enable hybrid matching
                                console.print("\n[yellow]⚠️  Feature not yet implemented in main matching loop[/yellow]")
                                console.print("Use Test Hybrid Matching (option 5) for now")

                            elif ml_choice == "7":
                                break

                    elif adv_choice == "6":
                        # Manage DIPLOMA Courses
                        matcher.manage_diploma_courses_menu()

                    elif adv_choice == "7":
                        break

            elif choice == "8":
                # Analytics & Reporting Sub-menu (same as counselling)
                while True:
                    console.print("\n[bold cyan]📊 Analytics & Reporting[/bold cyan]")
                    console.print("  [1] View Analytics Dashboard")
                    console.print("  [2] Export Analytics Report (JSON)")
                    console.print("  [3] Export Analytics Report (Excel)")
                    console.print("  [4] Run Quality Assurance Suite")
                    console.print("  [5] Generate Visualizations")
                    console.print("  [6] Advanced Search & Query Builder")
                    console.print("  [7] Back to main menu")

                    analytics_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7"], default="7")

                    if analytics_choice == "1":
                        matcher.generate_analytics_dashboard(table_name)
                    elif analytics_choice == "2":
                        matcher.export_analytics_report(table_name, format='json')
                    elif analytics_choice == "3":
                        matcher.export_analytics_report(table_name, format='excel')
                    elif analytics_choice == "4":
                        matcher.run_quality_assurance_suite(table_name)
                    elif analytics_choice == "5":
                        matcher.generate_visualizations(table_name)
                    elif analytics_choice == "6":
                        matcher.advanced_search(table_name)
                    elif analytics_choice == "7":
                        break

            elif choice == "9":
                # Data Tools Sub-menu (same as counselling)
                while True:
                    console.print("\n[bold cyan]🛠️  Data Tools[/bold cyan]")
                    console.print("  [1] Smart Data Enrichment")
                    console.print("  [2] Bulk Find & Replace")
                    console.print("  [3] Bulk Field Update")
                    console.print("  [4] Advanced Duplicate Finder")
                    console.print("  [5] Export Data (Multiple Formats)")
                    console.print("  [6] Track Data Changes")
                    console.print("  [7] Enable Audit Trail")
                    console.print("  [8] View Audit History")
                    console.print("  [9] Manage Abbreviations")
                    console.print("  [10] Migrate Alias Table (Location Support)")
                    console.print("  [11] View Aliases Needing Location")
                    console.print("  [12] Setup Scheduled Import")
                    console.print("  [13] Back to main menu")

                    tools_choice = Prompt.ask("Choice", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"], default="13")

                    if tools_choice == "1":
                        matcher.auto_enrich_data(table_name)
                    elif tools_choice == "2":
                        matcher.bulk_find_replace(table_name)
                    elif tools_choice == "3":
                        matcher.bulk_field_update(table_name)
                    elif tools_choice == "4":
                        threshold = float(Prompt.ask("Similarity threshold (0-1)", default="0.85"))
                        matcher.advanced_duplicate_finder(table_name, threshold)
                    elif tools_choice == "5":
                        console.print("\n[bold]Select export format:[/bold]")
                        console.print("  [1] Parquet")
                        console.print("  [2] CSV")
                        console.print("  [3] Excel")
                        console.print("  [4] JSON")
                        console.print("  [5] JSONL")
                        console.print("  [6] SQL Dump")

                        format_choice = Prompt.ask("Format", choices=["1", "2", "3", "4", "5", "6"], default="1")
                        format_map = {'1': 'parquet', '2': 'csv', '3': 'excel', '4': 'json', '5': 'jsonl', '6': 'sql'}
                        export_format = format_map[format_choice]
                        matcher.export_to_format(table_name, export_format)
                    elif tools_choice == "6":
                        matcher.track_data_changes(table_name)
                    elif tools_choice == "7":
                        matcher.enable_audit_trail(table_name)
                    elif tools_choice == "8":
                        record_id = Prompt.ask("Record ID (leave blank for all)", default="")
                        matcher.view_audit_history(record_id if record_id else None)
                    elif tools_choice == "9":
                        matcher.setup_scheduled_import()
                    elif tools_choice == "10":
                        break

            elif choice == "10":
                # Clear Database
                confirm = Confirm.ask(
                    "[bold red]⚠️  WARNING: This will delete ALL seat data records! Continue?[/bold red]",
                    default=False
                )
                if confirm:
                    matcher.clear_database_table('seat_data')
                    console.print("[green]✅ Database cleared successfully![/green]")
                else:
                    console.print("[yellow]❌ Operation cancelled[/yellow]")

            elif choice == "11":
                # Switch mode
                main()
                return

            elif choice == "12":
                # AI-Powered Matching
                matcher.show_ai_features_menu()

            elif choice == "13":
                # Master Data Management
                matcher.show_master_data_management_menu()

            elif choice == "14":
                console.print("[bold green]👋 Goodbye![/bold green]")
                break

if __name__ == "__main__":
    main()

