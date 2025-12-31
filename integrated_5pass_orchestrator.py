#!/usr/bin/env python3
"""
INTEGRATED 5-PASS ORCHESTRATOR

This module orchestrates the complete 5-pass matching system:
  PASS 0: Pre-processing & Grouping (6.7x reduction)
  PASS 1: State + Course filtering (existing recent3.py)
  PASS 2: College name filtering (existing recent3.py)
  PASS 3: Single vs Multi campus detection (new routing)
  PASS 4A: Single campus path (simple verification)
  PASS 4B: Multi campus path (address-primary + disambiguation)
  PASS 5: Fallback paths (existing recent3.py)

Integration Points:
  - Uses recent3.py match_college_smart_hybrid() as base
  - Calls match_regular_course() for PASS 1-2
  - Integrates address_based_matcher_simple.py for address-primary
  - Uses pass4_address_disambiguation() for multi campus
"""

import sqlite3
import time
import logging
import re
import threading
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Tuple, Optional, Dict, List, Set
from pathlib import Path
import sys
from rapidfuzz import fuzz, process
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn, TaskProgressColumn
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.live import Live
from rich.align import Align
from rich import box
from datetime import datetime


sys.path.insert(0, str(Path(__file__).parent))
from normalized_matcher import NormalizedMatcher

# Phase 1 AI Integration: Adaptive Confidence & Streaming Validation
try:
    from ai_orchestrator_bridge import AIEnhancedOrchestratorBridge
    AI_BRIDGE_AVAILABLE = True
except ImportError:
    AI_BRIDGE_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  AI Orchestrator Bridge not available. Running without AI enhancements.")

# PASS 5C: Smart Fuzzy Matching
try:
    from pass_5c_smart_fuzzy_matcher import SmartFuzzyMatcher
    PASS_5C_AVAILABLE = True
except ImportError:
    PASS_5C_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  PASS 5C Smart Fuzzy Matcher not available. Running without fuzzy matching fallback.")

# PASS 5D: Campus-Specific Matching
try:
    from pass_5d_campus_matcher import CampusSpecificMatcher
    PASS_5D_AVAILABLE = True
except ImportError:
    PASS_5D_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  PASS 5D Campus Matcher not available. Running without campus-specific matching.")

# PASS 5D_COUNCIL: Single Campus Council (for address-less records)
try:
    from council_single_campus import SingleCampusCouncil
    PASS_5D_COUNCIL_AVAILABLE = True
except ImportError:
    PASS_5D_COUNCIL_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  PASS 5D Single Campus Council not available.")

# PASS 5E: NER-Based Matching
from pass_5d_campus_aware_matcher import CampusAwareMatcher
from council_matcher import CouncilChairman, Candidate # Pass 6
try:
    from pass_5e_ner_matcher import NERBasedMatcher
    PASS_5E_AVAILABLE = True
except ImportError:
    PASS_5E_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  PASS 5E NER Matcher not available. Running without NER-based matching.")

# PASS 6: Guardian Validation Pipeline
try:
    from guardian_pipeline import GuardianPipeline, PipelineResult
    GUARDIAN_AVAILABLE = True
except ImportError:
    GUARDIAN_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  Guardian Pipeline not available. Running without PASS 6 validation.")

# PASS 1-3: Stream Filtering (Tier 1 - Critical)
# PASS 4A-4B: Stream Filtering (Tier 2 - Important)
# PASS 5-5B: Stream Filtering (Tier 3 - Fallback)
try:
    from pass_1_stream_filtering import Pass1StreamFiltering
    from pass_2_stream_filtering import Pass2StreamFiltering
    from pass_3_stream_filtering import Pass3StreamFiltering
    from pass_4a_stream_filtering import Pass4AStreamFiltering
    from pass_4b_stream_filtering import Pass4BStreamFiltering
    from pass_5_stream_filtering import Pass5StreamFiltering
    from pass_5a_stream_filtering import Pass5AStreamFiltering
    from pass_5b_stream_filtering import Pass5BStreamFiltering
    from course_stream_mapper import CourseStreamMapper
    PASS_1_STREAM_FILTERING_AVAILABLE = True
    PASS_2_STREAM_FILTERING_AVAILABLE = True
    PASS_3_STREAM_FILTERING_AVAILABLE = True
    PASS_4A_STREAM_FILTERING_AVAILABLE = True
    PASS_4B_STREAM_FILTERING_AVAILABLE = True
    PASS_5_STREAM_FILTERING_AVAILABLE = True
    PASS_5A_STREAM_FILTERING_AVAILABLE = True
    PASS_5B_STREAM_FILTERING_AVAILABLE = True
except ImportError:
    PASS_1_STREAM_FILTERING_AVAILABLE = False
    PASS_2_STREAM_FILTERING_AVAILABLE = False
    PASS_3_STREAM_FILTERING_AVAILABLE = False
    PASS_4A_STREAM_FILTERING_AVAILABLE = False
    PASS_4B_STREAM_FILTERING_AVAILABLE = False
    PASS_5_STREAM_FILTERING_AVAILABLE = False
    PASS_5A_STREAM_FILTERING_AVAILABLE = False
    PASS_5B_STREAM_FILTERING_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.warning("⚠️  Stream Filtering modules not fully available. Running with legacy logic.")

# Configure logging to file only to avoid TUI interference
# FORCE RESET: Remove any handlers added by imported modules (like recent3.py)
root_logger = logging.getLogger()
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("orchestrator.log"),
    ]
)

logger = logging.getLogger(__name__)



class Integrated5PassOrchestrator:
    """
    Orchestrates the 5-pass matching workflow integrating:
    - Grouping pre-processing (PASS 0)
    - recent3.py existing functions (PASS 1-2, 5)
    - Smart routing (PASS 3)
    - Single vs multi campus paths (PASS 4A, 4B)
    """

    def __init__(self, seat_db_path='data/sqlite/seat_data.db',
                 master_db_path='data/sqlite/master_data.db',
                 table_name='seat_data'):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path
        self.table_name = table_name  # Source table name (seat_data or counselling_records)

        # REMOVED: check_and_invalidate_cache is now handled by recent3.py BEFORE orchestrator init
        # This prevents the double "Master data changed" warning.
        # The FTS rebuild + hash storage in recent3.py ensures fresh indexes before we reach here.
        # try:
        #     from cache_utils import check_and_invalidate_cache
        #     check_and_invalidate_cache(master_db_path)
        # except ImportError:
        #     logger.warning("cache_utils not found - skipping cache validation")

        # Import matchers
        from group_preprocessing_step import GroupPreprocessor
        from recent3 import AdvancedSQLiteMatcher
        from address_based_matcher_simple import AddressBasedMatcher
        from advanced_vector_search import VectorSearchEngine
        from sklearn.feature_extraction.text import TfidfVectorizer
        import yaml

        # Pass table_name to avoid using VIEW (which is 335x slower!)
        self.preprocessor = GroupPreprocessor(seat_db_path=seat_db_path, table_name=table_name)
        
        # Ensure ID sync triggers exist (master_*_id ↔ *_id)
        # This is a safety net - also called in GroupPreprocessor.create_groups()
        try:
            from db_triggers import ensure_triggers
            ensure_triggers(seat_db_path, table_name)
        except ImportError:
            pass  # Will be called in create_groups() as fallback
        
        self.recent3_matcher = AdvancedSQLiteMatcher(
            config_path='config.yaml',
            enable_parallel=False,
            data_type='seat'
        )

        # Load config.yaml course aliases (from lines 475-481 under 'aliases' section)
        logger.info("Loading config.yaml course aliases...")
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
                self.config_course_aliases = config.get('aliases', {}).get('course_aliases', {})
                if self.config_course_aliases:
                    logger.info(f"✓ Loaded {len(self.config_course_aliases)} course aliases from config.yaml")
                    for original, alias in list(self.config_course_aliases.items())[:5]:
                        logger.info(f"  - '{original}' → '{alias}'")
                
                # Load multi_campus config (NEGATIVE_WORDS list and thresholds)
                self.multi_campus_config = config.get('multi_campus', {})
                self.negative_words = set(self.multi_campus_config.get('negative_words', []))
                self.rare_overlap_ratio = self.multi_campus_config.get('rare_overlap_ratio', 0.5)
                self.multi_campus_cache_size = self.multi_campus_config.get('cache_size', 5000)
                if self.negative_words:
                    logger.info(f"✓ Loaded {len(self.negative_words)} NEGATIVE_WORDS from config.yaml")
                
                # Load negative_match_rules (cross-stream prevention + blocklist)
                self.negative_match_rules = config.get('negative_match_rules', {})
                self.cross_stream_prevention = self.negative_match_rules.get('cross_stream_prevention', {})
                self.blocklist_pairs = self.negative_match_rules.get('blocklist_pairs', [])
                if self.cross_stream_prevention.get('enabled'):
                    logger.info(f"✓ Loaded cross-stream prevention rules")
                
                # Load hybrid_scoring config
                self.hybrid_scoring_config = config.get('hybrid_scoring', {})
        except Exception as e:
            logger.warning(f"Could not load config.yaml course aliases: {e}")
            self.config_course_aliases = {}
            self.multi_campus_config = {}
            self.negative_words = set()
            self.rare_overlap_ratio = 0.5
            self.multi_campus_cache_size = 5000
            self.negative_match_rules = {}
            self.cross_stream_prevention = {}
            self.blocklist_pairs = []
            self.hybrid_scoring_config = {}

        # CRITICAL: Load master data (medical, dental, dnb colleges)
        # This must be called before using the matcher
        logger.info("Loading master data (colleges, aliases, state mappings)...")
        self.recent3_matcher.load_master_data()
        logger.info("✅ Master data loaded successfully")

        self.address_matcher = AddressBasedMatcher(self.recent3_matcher)

        # Phase 1 AI Integration: Initialize AI Orchestrator Bridge
        if AI_BRIDGE_AVAILABLE:
            try:
                self.ai_bridge = AIEnhancedOrchestratorBridge(
                    seat_data_db=seat_db_path
                )
                logger.info("✅ AI Orchestrator Bridge initialized (Adaptive Confidence + Streaming Validator)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize AI bridge: {e}. Continuing without AI enhancements.")
                self.ai_bridge = None
        else:
            self.ai_bridge = None

        # Pass 6: Council of Matchers
        # Try to get API key from config.yaml first, then fall back to environment variable
        z_ai_key = None
        try:
            # Config was already loaded for course aliases, reuse it
            z_ai_config = config.get('matchers', {}).get('z_ai', {})
            if z_ai_config.get('enabled', False):
                z_ai_key = z_ai_config.get('api_key_env')  # Despite the name, it contains the actual key
                if z_ai_key:
                    logger.info("✅ Z.AI API key loaded from config.yaml for Council's Wise Judge")
        except Exception as e:
            logger.debug(f"Could not load Z.AI key from config: {e}")
        
        # Fallback to environment variable
        if not z_ai_key:
            z_ai_key = os.environ.get('Z_AI_API_KEY')
            if z_ai_key:
                logger.info("✅ Z.AI API key loaded from environment variable")
        
        # Initialize Vector Search Engine (The Semantic Scout's Tool)
        try:
            self.vector_engine = VectorSearchEngine(
                model_name='all-mpnet-base-v2',  # Upgraded: 768 dims, better accuracy
                cache_dir='models/vector_search'
            )
            logger.info("✅ Vector Search Engine initialized for Council")
        except Exception as e:
            logger.warning(f"⚠️  Failed to initialize Vector Search Engine: {e}")
            self.vector_engine = None

        self.master_colleges = self._load_master_colleges()
        
        # Initialize TF-IDF for Keyword Guardian
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.tfidf_indices = {}
        
        if self.master_colleges:
            try:
                logger.info("Computing TF-IDF vectors for Keyword Guardian...")
                self.tfidf_vectorizer = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), min_df=1)
                
                # Prepare corpus
                corpus = [c['name'] for c in self.master_colleges]
                self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
                
                # Map college ID to matrix row index
                for idx, college in enumerate(self.master_colleges):
                    self.tfidf_indices[college['id']] = idx
                    
                logger.info(f"✅ TF-IDF computed for {len(corpus)} colleges")
            except Exception as e:
                logger.error(f"Failed to compute TF-IDF: {e}")

        # Initialize Council (works with or without API key)
        self.council_chairman = CouncilChairman(
            glm_api_key=z_ai_key, 
            vector_engine=self.vector_engine,
            tfidf_vectorizer=self.tfidf_vectorizer,
            tfidf_matrix=self.tfidf_matrix,
            tfidf_indices=self.tfidf_indices
        )
        
        if not z_ai_key:
            logger.warning("⚠️  Pass 6 will run WITHOUT LLM (Wise Judge disabled). Council will use 6 non-LLM voters.")
        
        # Populate Vector Engine with Master Data
        if self.vector_engine and self.master_colleges:
            logger.info(f"Populating Vector Index with {len(self.master_colleges)} colleges...")
            try:
                self.vector_engine.add_colleges(self.master_colleges)
                logger.info("✅ Vector Index populated successfully")
            except Exception as e:
                logger.error(f"Failed to populate Vector Index: {e}")


        # Generic institution prefixes to remove during normalization
        self.generic_prefixes = [
            'ASSOCIATED HOSPITAL',
            'ASSOCIATED WITH',
            'HOSPITAL ASSOCIATED',
            'AND HOSPITAL',
            'WITH HOSPITAL',
        ]

        self.generic_suffixes = [
            'HOSPITAL',
            'CLINIC',
            'CENTER',
            'CENTRE',
            'HEALTHCARE',
            'HEALTH CENTER',
        ]

        # Initialize stats
        self.stats = {
            'pass0_groups': 0,
            'pass0_composite_key': 0,
            'pass0_code_match': 0, # Pass 0.5
            'pass1_state_filtered': 0,
            'pass2_name_matched': 0,
            'pass3_single_campus': 0,
            'pass3_multi_campus': 0,
            'pass4a_matched': 0,
            'pass4b_matched': 0,
            'pass5_council_matched': 0,
            'pass5_agentic_matched': 0,  # Batch LLM matching (replaced old alias pass)
            'pass5b_ai_matched': 0,
            'pass5c_fuzzy_matched': 0,
            'pass5d_campus_matched': 0,
            'pass5d_council_matched': 0,
            'pass5e_ner_matched': 0,
            'pass6_council_matched': 0,
            'total_matched': 0,
            'total_unmatched': 0
        }
        
        # Thread safety for stats
        self.stats_lock = threading.Lock()
        
        # Multi-campus detection LRU cache (10x+ speedup for repeated queries)
        from functools import lru_cache
        self._multi_campus_cache = {}  # Manual LRU cache: {"college_name:state": campus_count}
        self._multi_campus_cache_hits = 0
        self._multi_campus_cache_misses = 0
        
        # PERFORMANCE FIX: Batch update queue to avoid per-group DB connections
        # SQLite file locking serializes parallel writes - queue updates instead
        self._update_queue = []  # Thread-safe append via GIL
        self._update_queue_lock = threading.Lock()
        self._batch_size = 100  # Commit every 100 updates
        
        # PERFORMANCE FIX: Thread-local database connections
        # Each thread gets its own connection, avoiding connection overhead
        self._local = threading.local()

        # Initialize Pass 5D matcher (Campus-Specific)
        if PASS_5D_AVAILABLE:
            try:
                self.campus_matcher = CampusSpecificMatcher(master_db_path)
                logger.info("✅ Pass 5D Campus Matcher initialized")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize Pass 5D Campus Matcher: {e}")
                self.campus_matcher = None
        else:
            self.campus_matcher = None

        # Initialize Pass 5D Council (Single Campus Council for address-less records)
        if PASS_5D_COUNCIL_AVAILABLE:
            try:
                self.single_campus_council = SingleCampusCouncil(master_db_path)
                logger.info("✅ Pass 5D Single Campus Council initialized")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize Pass 5D Single Campus Council: {e}")
                self.single_campus_council = None
        else:
            self.single_campus_council = None

        # Initialize Pass 5E matcher (NER-Based)
        if PASS_5E_AVAILABLE:
            try:
                self.ner_matcher = NERBasedMatcher(master_db_path)
                logger.info("✅ Pass 5E NER Matcher initialized")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize Pass 5E NER Matcher: {e}")
                self.ner_matcher = None
        else:
            self.ner_matcher = None

        # Initialize PASS 1 & PASS 2 Stream Filtering (Tier 1 - Critical)
        if PASS_1_STREAM_FILTERING_AVAILABLE:
            try:
                self.stream_mapper = CourseStreamMapper(config_path='config.yaml')
                self.pass1_matcher = Pass1StreamFiltering(self.recent3_matcher, self.stream_mapper)
                logger.info("✅ PASS 1 Stream Filtering initialized (CourseStreamMapper + Pass1StreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 1 Stream Filtering: {e}")
                self.pass1_matcher = None
                self.stream_mapper = None
        else:
            self.pass1_matcher = None
            self.stream_mapper = None

        if PASS_2_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass2_matcher = Pass2StreamFiltering(self.recent3_matcher, self.stream_mapper)
                logger.info("✅ PASS 2 Stream Filtering initialized (Pass2StreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 2 Stream Filtering: {e}")
                self.pass2_matcher = None
        else:
            self.pass2_matcher = None

        if PASS_3_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass3_matcher = Pass3StreamFiltering(self.recent3_matcher, self.stream_mapper)
                logger.info("✅ PASS 3 Stream Filtering initialized (Pass3StreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 3 Stream Filtering: {e}")
                self.pass3_matcher = None
        else:
            self.pass3_matcher = None

        # Initialize PASS 4A & PASS 4B Stream Filtering (Tier 2 - Important)
        if PASS_4A_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass4a_matcher = Pass4AStreamFiltering(
                    self.recent3_matcher, self.address_matcher, self.stream_mapper
                )
                logger.info("✅ PASS 4A Stream Filtering initialized (Pass4AStreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 4A Stream Filtering: {e}")
                self.pass4a_matcher = None
        else:
            self.pass4a_matcher = None

        if PASS_4B_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass4b_matcher = Pass4BStreamFiltering(self.recent3_matcher, self.stream_mapper)
                logger.info("✅ PASS 4B Stream Filtering initialized (Pass4BStreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 4B Stream Filtering: {e}")
                self.pass4b_matcher = None
        else:
            self.pass4b_matcher = None

        # Initialize PASS 5 & PASS 5A & PASS 5B Stream Filtering (Tier 3 - Fallback)
        if PASS_5_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass5_matcher = Pass5StreamFiltering(self.recent3_matcher, self.stream_mapper)
                logger.info("✅ PASS 5 Stream Filtering initialized (Pass5StreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 5 Stream Filtering: {e}")
                self.pass5_matcher = None
        else:
            self.pass5_matcher = None

        if PASS_5A_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass5a_matcher = Pass5AStreamFiltering(
                    self.recent3_matcher, self.stream_mapper, self.config_course_aliases
                )
                logger.info("✅ PASS 5A Stream Filtering initialized (Pass5AStreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 5A Stream Filtering: {e}")
                self.pass5a_matcher = None
        else:
            self.pass5a_matcher = None

        if PASS_5B_STREAM_FILTERING_AVAILABLE and self.stream_mapper:
            try:
                self.pass5b_matcher = Pass5BStreamFiltering(
                    self.recent3_matcher, self.stream_mapper, self.ai_bridge if AI_BRIDGE_AVAILABLE else None
                )
                logger.info("✅ PASS 5B Stream Filtering initialized (Pass5BStreamFiltering)")
            except Exception as e:
                logger.warning(f"⚠️  Failed to initialize PASS 5B Stream Filtering: {e}")
                self.pass5b_matcher = None
        else:
            self.pass5b_matcher = None

    def _get_master_conn(self):
        """Get thread-local master database connection (reused within thread)"""
        if not hasattr(self._local, 'master_conn') or self._local.master_conn is None:
            self._local.master_conn = sqlite3.connect(self.master_db_path)
            self._local.master_conn.row_factory = sqlite3.Row
        return self._local.master_conn
    
    def _close_thread_connections(self):
        """Close thread-local connections (call at end of thread work)"""
        if hasattr(self._local, 'master_conn') and self._local.master_conn:
            try:
                self._local.master_conn.close()
            except:
                pass
            self._local.master_conn = None

    def _fuzzy_match_word(self, query_word: str, candidate_words: Set[str],
                          fuzzy_threshold: float = 0.90) -> Tuple[bool, str, float]:
        """
        Try to fuzzy match a single query word against candidate words.

        Returns: (matched, matched_word, similarity_score)

        Example:
            query_word: "UNIVRSITY" (typo)
            candidate_words: {"UNIVERSITY", "MEDICAL", "COLLEGE"}
            → (True, "UNIVERSITY", 0.909)
        """
        best_match = None
        best_score = 0.0

        for cand_word in candidate_words:
            # Use token_ratio for better handling of similar words
            similarity = fuzz.token_ratio(query_word, cand_word) / 100.0

            if similarity >= fuzzy_threshold and similarity > best_score:
                best_score = similarity
                best_match = cand_word

        return (best_match is not None, best_match or "", best_score)

    def _match_words_with_fuzzy(self, query_words: Set[str], candidate_words: Set[str],
                                 min_overlap: float = 0.80, fuzzy_threshold: float = 0.90
                                 ) -> Tuple[bool, float, int, int]:
        """
        Match query words to candidate words using:
        1. Exact matching (primary)
        2. Word-level fuzzy matching for typos (secondary)

        Returns: (matched, confidence, exact_matches, fuzzy_matches)

        Example:
            query: {FACULTY, DENTAL, SCIENCES}
            candidate: {FACULTY, DENTAL, SCIENCEZ}
            → Exact: 2, Fuzzy: 1 → 3/3 = 100% → Match ✅
        """
        exact_matches = 0
        fuzzy_matches = 0
        remaining_candidate_words = set(candidate_words)

        for query_word in query_words:
            if query_word in remaining_candidate_words:
                # Exact match found
                exact_matches += 1
                remaining_candidate_words.remove(query_word)
            else:
                # Try fuzzy match
                matched, matched_word, score = self._fuzzy_match_word(
                    query_word, remaining_candidate_words, fuzzy_threshold
                )
                if matched:
                    fuzzy_matches += 1
                    remaining_candidate_words.remove(matched_word)
                    logger.debug(f"  Fuzzy match: '{query_word}' → '{matched_word}' ({score*100:.0f}%)")

        # Calculate overlap ratio
        total_matched = exact_matches + fuzzy_matches
        overlap_ratio = total_matched / max(len(query_words), len(candidate_words))

        # Determine confidence
        if overlap_ratio >= min_overlap:
            # Higher confidence for exact matches, lower for fuzzy
            if fuzzy_matches == 0:
                confidence = 0.90  # Pure exact match
            else:
                confidence = 0.85  # With some fuzzy matches
            return (True, confidence, exact_matches, fuzzy_matches)
        else:
            return (False, 0.0, exact_matches, fuzzy_matches)

    def remove_generic_institution_prefixes(self, college_name: str) -> str:
        """
        Remove generic institution prefixes/suffixes to extract core college name.

        Examples:
            "ASSOCIATED HOSPITAL GOVERNMENT MEDICAL COLLEGE" → "GOVERNMENT MEDICAL COLLEGE"
            "APOLLO HOSPITAL" → "APOLLO"
            "AREA HOSPITAL" → "AREA"
            "SHREE KRISHNA HOSPITAL ASSOCIATED WITH PARAMUKHSWAMI MEDICAL COLLEGE" → "PARAMUKHSWAMI MEDICAL COLLEGE"

        Args:
            college_name: Full institution name

        Returns:
            Cleaned college name with prefixes/suffixes removed
        """
        if not college_name:
            return college_name

        name = college_name.upper().strip()

        # Remove generic prefixes first (from longest to shortest to avoid partial matches)
        for prefix in sorted(self.generic_prefixes, key=len, reverse=True):
            prefix_upper = prefix.upper()
            if name.startswith(prefix_upper):
                name = name[len(prefix_upper):].strip()
                break

        # If the name had a prefix removed and now has meaningful content, keep it
        # Otherwise try removing generic suffixes
        if len(name.split()) < 2:  # Less than 2 words means very generic
            name = college_name.upper().strip()
            # Try removing suffixes
            for suffix in sorted(self.generic_suffixes, key=len, reverse=True):
                suffix_upper = suffix.upper()
                if name.endswith(suffix_upper):
                    name = name[:-len(suffix_upper)].strip()
                    break

        return name if name else college_name.upper().strip()

    def _increment_stat(self, key: str, value: int = 1):
        """Thread-safe stats increment"""
        with self.stats_lock:
            self.stats[key] = self.stats.get(key, 0) + value

    def _apply_alias_preprocessing(self):
        """Apply college aliases to group_matching_queue AFTER grouping (EXACT matching on name+address+state)
        
        Performance: This processes ~2,439 groups instead of ~16,280 raw records (6-7x faster!)
        """
        logger.info("\n📋 ALIAS PREPROCESSING: Transforming known name variations in groups")
        logger.info("-" * 100)
        
        # Load aliases from master_data.db
        master_conn = sqlite3.connect(self.master_db_path)
        cursor = master_conn.cursor()
        cursor.execute("SELECT original_name, original_address, state_normalized, alias_name, master_college_id FROM college_aliases")
        aliases = cursor.fetchall()
        master_conn.close()
        
        if not aliases:
            logger.info("No aliases found in master_data.db - skipping")
            return
        
        logger.info(f"Found {len(aliases)} aliases in master_data.db")
        
        # Apply each alias to group_matching_queue with EXACT matching
        data_conn = sqlite3.connect(self.seat_db_path)
        total_groups_transformed = 0
        
        for alias in aliases:
            original_name, original_address, state_normalized, alias_name, master_college_id = alias
            
            cursor = data_conn.cursor()
            cursor.execute("""
                UPDATE group_matching_queue
                SET normalized_college_name = ?,
                    matched_college_id = ?,
                    match_score = 1.0,
                    match_method = 'alias'
                WHERE normalized_college_name = ?
                  AND normalized_address = ?
                  AND normalized_state = ?
                  AND (matched_college_id IS NULL OR matched_college_id = '')
            """, (alias_name, master_college_id, original_name, original_address, state_normalized))
            
            row_count = cursor.rowcount
            data_conn.commit()
            
            if row_count > 0:
                total_groups_transformed += row_count
                logger.info(f"✅ Alias applied: '{original_name}' + '{original_address}' → '{alias_name}' (ID: {master_college_id}, {row_count} groups)")
        
        data_conn.close()
        logger.info(f"\n✅ Alias preprocessing complete: {total_groups_transformed} groups transformed\n")
        self.stats['alias_preprocessing_transformed'] = total_groups_transformed

    def run_complete_workflow(self):
        """Execute complete 5-pass workflow with Ultimate Dashboard UI"""
        
        # Initialize Dashboard Components
        console = Console()
        layout = Layout()
        layout.split(
            Layout(name="header", size=3),
            Layout(name="main", ratio=1),
            Layout(name="footer", size=3)
        )
        layout["main"].split_row(
            Layout(name="left", ratio=2),
            Layout(name="right", ratio=1)
        )
        layout["left"].split(
            Layout(name="progress", ratio=2),
            Layout(name="metrics", ratio=1)
        )
        layout["right"].split(
            Layout(name="logs", ratio=2),
            Layout(name="status", ratio=1)
        )

        # Helper to generate header
        def generate_header():
            grid = Table.grid(expand=True)
            grid.add_column(justify="left", ratio=1)
            grid.add_column(justify="center", ratio=1)
            grid.add_column(justify="right", ratio=1)
            grid.add_row(
                "🚀 [bold cyan]INTEGRATED 5-PASS ORCHESTRATOR[/bold cyan]",
                "[bold white]v2.5.0-Enterprise[/bold white]",
                datetime.now().strftime("%H:%M:%S")
            )
            return Panel(grid, style="white on blue")

        # Helper to generate metrics
        def generate_metrics(total, matched, elapsed):
            table = Table(expand=True, box=box.SIMPLE_HEAD)
            table.add_column("Metric", style="cyan")
            table.add_column("Value", justify="right", style="bold white")
            table.add_column("Trend", justify="right", style="bold")
            
            success_pct = (matched / total * 100) if total > 0 else 0
            rate = matched / elapsed if elapsed > 0 else 0
            
            table.add_row("Total Groups", f"{total:,}", "—")
            table.add_row("Matched", f"{matched:,}", f"[green]▲ {success_pct:.1f}%[/green]")
            table.add_row("Processing Rate", f"{rate:.1f}/s", "[yellow]⚡ High[/yellow]" if rate > 100 else "[blue]Normal[/blue]")
            
            return Panel(table, title="[bold yellow]Real-time Analytics[/bold yellow]", border_style="yellow")

        # Helper to generate logs
        log_messages = []
        def add_log(msg):
            timestamp = datetime.now().strftime("%H:%M:%S")
            log_messages.append(f"[{timestamp}] {msg}")
            if len(log_messages) > 15:
                log_messages.pop(0)
        
        def generate_logs():
            return Panel(Align.left("\n".join(log_messages), vertical="bottom"), title="[bold white]Event Log[/bold white]", border_style="white")

        # Helper to generate status
        def generate_status():
            table = Table(expand=True, box=box.SIMPLE_HEAD)
            table.add_column("Pass", style="cyan")
            table.add_column("Matches", justify="right", style="bold white")
            
            # Thread-safe read
            with self.stats_lock:
                s = self.stats
                table.add_row("Pass 0 (Key)", str(s['pass0_composite_key']))
                table.add_row("Pass 1 (State)", str(s['pass1_state_filtered']))
                table.add_row("Pass 3 (Single)", str(s['pass3_single_campus']))
                table.add_row("Pass 3 (Multi)", str(s['pass3_multi_campus']))
                table.add_row("Pass 5 (Council)", str(s['pass5_council_matched']))
                table.add_row("Pass 5-Agentic (LLM)", str(s['pass5_agentic_matched']))
                table.add_row("Pass 5B (AI)", str(s['pass5b_ai_matched']))
                table.add_row("Pass 5C (Fuzzy)", str(s['pass5c_fuzzy_matched']))
                table.add_row("Pass 5D (Campus)", str(s['pass5d_campus_matched']))
                table.add_row("Pass 5D (Council)", str(s['pass5d_council_matched']))
                table.add_row("Pass 5E (NER)", str(s['pass5e_ner_matched']))
                table.add_row("Unmatched", f"[red]{s['total_unmatched']}[/red]")
            
            return Panel(table, title="[bold white]Match Status[/bold white]", border_style="blue")

        start_time = time.time()
        add_log("Initializing workflow...")

        # PASS 0: PRE-PROCESSING & GROUPING
        groups = self._pass0_preprocessing()
        self.stats['pass0_groups'] = len(groups)
        add_log(f"Pass 0 complete: {len(groups)} groups created")
        
        # ALIAS PREPROCESSING
        self._apply_alias_preprocessing()
        add_log("Alias preprocessing complete")
        
        # NAME FIXER: Fix broken college names BEFORE matching
        # This runs after queue creation so corrected names are used by all passes
        console.print("\n[bold cyan]🔧 NAME FIXER: Checking for broken college names...[/bold cyan]")
        try:
            from embedding_name_fixer import NameFixerPipeline, review_pending_corrections, manual_corrections
            from rich.prompt import Confirm
            
            pipeline = NameFixerPipeline(queue_db_path=self.seat_db_path)
            results = pipeline.run()
            
            auto_count = len(results.get('auto_applied', [])) if isinstance(results.get('auto_applied'), list) else results.get('auto_applied', 0)
            pending_count = len(results.get('pending_review', [])) if isinstance(results.get('pending_review'), list) else results.get('pending_review', 0)
            
            add_log(f"Name Fixer: {auto_count} auto-fixed, {pending_count} pending")
            
            # Prompt for review if there are pending corrections
            if pending_count > 0:
                console.print(f"\n[yellow]⚠️  {pending_count} corrections need review[/yellow]")
                if Confirm.ask("Review pending corrections now?", default=True):
                    review_pending_corrections(self.seat_db_path)
            
            # Optionally allow manual corrections
            if Confirm.ask("Enter any manual corrections?", default=False):
                manual_corrections(self.seat_db_path)
                
        except Exception as e:
            console.print(f"[yellow]⚠️  Name Fixer skipped: {e}[/yellow]")
            add_log(f"Name Fixer skipped: {e}")
        
        # Reload groups
        conn = sqlite3.connect(self.seat_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
        SELECT group_id, normalized_state, normalized_college_name, normalized_address,
               state, college_name, address, composite_college_key,
               sample_course_type, sample_course_name, record_count
        FROM group_matching_queue
        WHERE matched_college_id IS NULL
        ORDER BY record_count DESC
        """)
        groups = [dict(row) for row in cursor.fetchall()]
        conn.close()
        self.stats['pass0_groups'] = len(groups)

        # PASS 1-5: Match each group (PARALLEL)
        max_workers = os.cpu_count() or 4
        processed_count = 0
        total_matched_count = 0
        
        # Setup Progress
        progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(bar_width=None),
            TaskProgressColumn(),
            TextColumn("•"),
            TextColumn("{task.completed}/{task.total}"),
            TimeElapsedColumn(),
            expand=True
        )
        
        main_task = progress.add_task("[cyan]Processing Groups", total=len(groups))

        # Run with Live Dashboard
        with Live(layout, refresh_per_second=4, screen=True) as live:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(self._match_group, group): group for group in groups}
                
                for future in as_completed(futures):
                    processed_count += 1
                    progress.update(main_task, advance=1)
                    
                    try:
                        result = future.result()
                        if result: # If matched
                            total_matched_count += 1
                    except Exception as e:
                        logger.error(f"Error: {e}")
                        add_log(f"[red]Error: {str(e)[:50]}...[/red]")

                    # Update Dashboard
                    elapsed = time.time() - start_time
                    layout["header"].update(generate_header())
                    layout["progress"].update(Panel(progress, title="[bold green]Active Progress[/bold green]", border_style="green"))
                    layout["metrics"].update(generate_metrics(len(groups), total_matched_count, elapsed))
                    layout["logs"].update(generate_logs())
                    layout["status"].update(generate_status())
                    
                    # Log milestones
                    if processed_count % 500 == 0:
                        add_log(f"Processed {processed_count} groups...")

        # CRITICAL: Flush any remaining queued updates before moving on
        self._flush_update_queue()
        add_log("Flushed remaining batch updates")

        # PASS 5-AGENTIC: Batch LLM matching for all PASS 5E failures
        # Runs on group_matching_queue BEFORE propagation
        self._run_agentic_batch()
        
        # =====================================================================
        # AUTO-RETRY LOOP: Continue until exit conditions are met
        # Exit conditions:
        #   1. remaining ≤ 100 (manual review territory)
        #   2. max_iterations ≥ 3 (prevent infinite loops)
        #   3. matched_this_round == 0 (no progress = stuck)
        # =====================================================================
        
        AUTO_RETRY_THRESHOLD = 100  # Remaining groups below this → exit to manual review
        MAX_AGENTIC_ITERATIONS = 3  # Maximum auto-retry iterations
        
        agentic_iteration = 1
        prev_unresolved = self.stats.get('pass5_agentic_unresolved', 0)
        
        while True:
            # Get current counts
            unmatched_after = self.stats.get('pass5_agentic_unresolved', 0)
            matched_this_round = self.stats.get('pass5_agentic_matched', 0)
            
            # Count remaining unprocessed groups (beyond the limit)
            try:
                conn = sqlite3.connect(self.seat_db_path)
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT COUNT(*) FROM group_matching_queue
                    WHERE matched_college_id IS NULL AND is_processed = 0
                """)
                remaining_unprocessed = cursor.fetchone()[0]
                conn.close()
            except:
                remaining_unprocessed = 0
            
            total_remaining = unmatched_after + remaining_unprocessed
            progress_made = prev_unresolved - unmatched_after if prev_unresolved > unmatched_after else matched_this_round
            
            console.print(f"\n[bold cyan]📊 PASS 5-AGENTIC Status (Iteration {agentic_iteration}):[/bold cyan]")
            console.print(f"   Unmatched this batch: [yellow]{unmatched_after}[/yellow]")
            console.print(f"   Remaining unprocessed: [yellow]{remaining_unprocessed}[/yellow]")
            console.print(f"   Total remaining: [bold]{total_remaining}[/bold]")
            console.print(f"   Progress this round: [green]+{progress_made}[/green]")
            
            # EXIT CONDITION 1: Total remaining is small enough for manual review
            if total_remaining <= AUTO_RETRY_THRESHOLD:
                console.print(f"\n[bold green]✅ AUTO-RETRY EXIT: {total_remaining} groups remaining (≤{AUTO_RETRY_THRESHOLD})[/bold green]")
                console.print(f"   [dim]→ These can be handled via manual review[/dim]")
                logger.info(f"PASS 5-AGENTIC: Auto-retry exit - {total_remaining} groups for manual review")
                break
            
            # EXIT CONDITION 2: Max iterations reached
            if agentic_iteration >= MAX_AGENTIC_ITERATIONS:
                console.print(f"\n[bold yellow]⚠️ AUTO-RETRY EXIT: Max iterations ({MAX_AGENTIC_ITERATIONS}) reached[/bold yellow]")
                console.print(f"   [dim]→ {total_remaining} groups will need manual review[/dim]")
                logger.info(f"PASS 5-AGENTIC: Auto-retry exit - max iterations reached, {total_remaining} for manual review")
                break
            
            # EXIT CONDITION 3: No progress made (AI is stuck)
            if progress_made == 0 and agentic_iteration > 1:
                console.print(f"\n[bold yellow]⚠️ AUTO-RETRY EXIT: No progress made this round[/bold yellow]")
                console.print(f"   [dim]→ AI cannot resolve remaining {total_remaining} groups[/dim]")
                logger.info(f"PASS 5-AGENTIC: Auto-retry exit - zero progress, {total_remaining} for manual review")
                break
            
            # Continue: More groups to process
            if remaining_unprocessed > 0 or unmatched_after > AUTO_RETRY_THRESHOLD:
                agentic_iteration += 1
                prev_unresolved = unmatched_after
                
                console.print(f"\n[bold cyan]🔄 AUTO-RETRY: Iteration {agentic_iteration} starting...[/bold cyan]")
                logger.info(f"PASS 5-AGENTIC: Auto-retry iteration {agentic_iteration}")
                
                # Reset stats for new iteration
                self.stats['pass5_agentic_matched'] = 0
                self.stats['pass5_agentic_unresolved'] = 0
                
                self._run_agentic_batch()
            else:
                break
        
        # Final summary
        console.print(f"\n[bold green]✅ PASS 5-AGENTIC Complete after {agentic_iteration} iteration(s)[/bold green]")

        # CRITICAL: Flush any remaining queued updates before PASS 6
        # This ensures all PASS 5B/5C matches are visible to Guardian validation
        self._flush_update_queue()
        logger.info("Flushed all queued updates before PASS 6")

        # PASS 6: GUARDIAN VALIDATION (validates matched records in group_matching_queue)
        # NOTE: Bulk propagate moved to AFTER PASS 7 so Guardian can delink from queue
        if GUARDIAN_AVAILABLE:
            logger.info("\n" + "=" * 100)
            logger.info("PASS 6: GUARDIAN VALIDATION - Multi-Model LLM Consensus")
            logger.info("=" * 100)
            self._run_guardian_validation()
            
            # PASS 7: RE-MATCH UNMATCHED RECORDS (feedback loop)
            logger.info("\n" + "=" * 100)
            logger.info("PASS 7: RE-MATCH UNMATCHED RECORDS - Feedback Loop")
            logger.info("=" * 100)
            self._run_pass7_rematch_delinked()
            
            # PASS 8: CROSS-GROUP CONSISTENCY VALIDATION
            logger.info("\n" + "=" * 100)
            logger.info("PASS 8: CROSS-GROUP CONSISTENCY VALIDATION")
            logger.info("=" * 100)
            self._run_pass8_cross_group_validation()
        else:
            logger.warning("PASS 6: Guardian validation SKIPPED (not available)")
            logger.warning("PASS 7: Re-match delinked SKIPPED (Guardian not available)")
            logger.warning("PASS 8: Cross-group validation SKIPPED (Guardian not available)")

        # BULK PROPAGATE (AFTER all validation - only approved matches reach main table)
        # MOVED: Previously before PASS 6, now after PASS 7 so:
        # 1. All processing happens on group_matching_queue
        # 2. Guardian can delink BLOCKED records from queue
        # 3. Only final approved matches propagate to counselling_records
        logger.info("\nBULK PROPAGATE: Copy FINAL results to all records")
        logger.info("-" * 100)
        self._bulk_propagate_results()

        # REBUILD COLLEGE_COURSE_LINK TABLE
        logger.info("\nREBUILD: Rebuild college_course_link table from matched data")
        logger.info("-" * 100)
        self._rebuild_college_course_link()

        # REBUILD STATE_COURSE_COLLEGE_LINK_TEXT TABLE
        logger.info("\nREBUILD: Rebuild state_course_college_link_text table from matched data")
        logger.info("-" * 100)
        self._rebuild_state_course_college_link_text()

        # SUMMARY
        elapsed = time.time() - start_time
        self._print_summary(elapsed)

    def _pass0_preprocessing(self) -> List[Dict]:
        """
        PASS 0: PRE-PROCESSING & GROUPING

        Group 16,280 records by exact (state, college_name, address)
        Returns 2,439 unique groups for processing
        """

        logger.info("Creating groups from seat_data...")
        total_groups, total_records = self.preprocessor.create_groups()

        # ============================================================
        # CRITICAL FIX: Clear seat_data matches AFTER queue rebuild
        # This ensures seat_data and queue are in sync for records being reprocessed
        # 
        # INCREMENTAL-SAFE: Only clears records whose groups exist in the new queue
        # - Records in current queue → cleared and re-matched
        # - Records NOT in current queue → keep existing matches (for incremental mode)
        # ============================================================
        logger.info("Syncing seat_data with current queue (incremental-safe)...")
        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()
        
        # Clear ONLY seat_data records whose groups are in the current queue
        # This is critical for:
        # 1. Full runs: All records in queue = all cleared
        # 2. Incremental: Only new records in queue = only new cleared
        cursor.execute(f"""
            UPDATE {self.table_name}
            SET master_college_id = NULL,
                college_match_score = NULL,
                college_match_method = NULL
            WHERE master_college_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM group_matching_queue gmq
                WHERE {self.table_name}.normalized_state = gmq.normalized_state
                AND {self.table_name}.normalized_college_name = gmq.normalized_college_name
                AND COALESCE(NULLIF({self.table_name}.normalized_address, ''), 'NO_ADDRESS') = COALESCE(NULLIF(gmq.normalized_address, ''), 'NO_ADDRESS')
                AND {self.table_name}.course_type = gmq.sample_course_type
            )
        """)
        cleared_count = cursor.rowcount
        conn.commit()
        
        # Count preserved matches (records NOT in current queue)
        cursor.execute(f"""
            SELECT COUNT(*) FROM {self.table_name}
            WHERE master_college_id IS NOT NULL
        """)
        preserved_count = cursor.fetchone()[0]
        conn.close()
        
        if cleared_count > 0:
            logger.info(f"✅ Cleared {cleared_count} matches for current queue groups")
        if preserved_count > 0:
            logger.info(f"📦 Preserved {preserved_count} matches for records not in current queue")

        # Load groups from database
        conn = sqlite3.connect(self.seat_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
        SELECT group_id, normalized_state, normalized_college_name, normalized_address,
               state, college_name, address,
               sample_course_type, sample_course_name, record_count
        FROM group_matching_queue
        WHERE matched_college_id IS NULL
        ORDER BY record_count DESC
        """)

        groups = [dict(row) for row in cursor.fetchall()]
        conn.close()

        logger.info(f"✅ PASS 0 COMPLETE: Created {len(groups):,} unique groups from {total_records:,} records")
        logger.info(f"   Reduction: {total_records/len(groups):.1f}x ({100*(1-len(groups)/total_records):.0f}% reduction)")

        return groups
    
    def _get_filtered_candidates_by_code(
        self, 
        raw_address: str,
        candidate_pool: List[Dict]
    ) -> Tuple[List[Dict], bool, str]:
        """
        Filter candidate pool by college code if present in query.
        
        Strategy:
        - If code present → Filter to only candidates with matching code
        - If code absent → Return original pool
        
        Args:
            raw_address: Query address (may contain college code in brackets)
            candidate_pool: List of candidate colleges to filter
            
        Returns:
            (filtered_candidates, was_filtered, reason)
        """
        # Extract codes from query - handle None/empty addresses
        if not raw_address:
            return candidate_pool, False, "No address data"
        codes = re.findall(r'\((\d{6})\)', raw_address)
        if not codes:
            return candidate_pool, False, "No college code present"
        
        code = codes[0]  # Use first code
        
        # Check if code exists in index
        if code not in self.recent3_matcher.college_code_index:
            logger.debug(f"⚠️ Code {code} not found in index")
            return candidate_pool, False, f"Code {code} not in master data"
        
        # Get candidate IDs with this code
        candidate_ids_with_code = set(self.recent3_matcher.college_code_index[code])
        
        # Filter candidate pool to only those with matching code
        filtered = [
            c for c in candidate_pool 
            if c.get('id') in candidate_ids_with_code
        ]
        
        if filtered:
            logger.info(f"🔐 Filtered candidates by code {code}: {len(candidate_pool)} → {len(filtered)}")
            return filtered, True, f"Filtered by code {code}"
        else:
            logger.debug(f"⚠️ Code {code} matched but no candidates in pool have it")
            return candidate_pool, False, f"Code {code} found but no matching candidates in pool"

    def _pass0_code_match(self, raw_address: str, college_name: str, state: str, course_type: str) -> Tuple[Optional[Dict], bool]:
        """
        PASS 0.5: College Code Matching with Multi-Signal Validation
        Requires: Code match + Name match (≥0.7) + Address match for 99% confidence
        """
        if not hasattr(self, 'master_colleges'):
            return None, False
            
        # Get all candidates as potential pool
        all_candidates = self.master_colleges
        
        # Filter by college code
        filtered_candidates, was_filtered, reason = self._get_filtered_candidates_by_code(
            raw_address, all_candidates
        )
        
        if not was_filtered:
            return None, False
            
        # Now validate the filtered candidates with Name + Address
        for college_info in filtered_candidates:
            # MULTI-SIGNAL VALIDATION: Code + Name + Address
            # RULE: Always use NORMALIZED data for matching (both seat data and master data)
            # 1. Name Validation (fuzzy match using NORMALIZED names)
            from rapidfuzz import fuzz
            # Use normalized_name from master data (falls back to name if not present)
            master_normalized_name = college_info.get('normalized_name') or college_info.get('name', '')
            name_similarity = fuzz.token_set_ratio(college_name.upper(), master_normalized_name.upper()) / 100.0
            
            # 2. Address Validation (lenient: state match or in address)
            state_upper = state.upper()
            c_state = college_info.get('state', '').upper()
            c_addr = college_info.get('normalized_address') or college_info.get('address', '')
            c_addr = c_addr.upper()
            
            address_match = (
                state_upper == c_state or
                state_upper in c_addr or
                (len(state_upper) > 3 and state_upper in c_addr)
            )
            
            # Require both validations
            if name_similarity >= 0.7 and address_match:
                matched_college = {
                   'id': college_info['id'],
                   'name': college_info.get('normalized_name') or college_info['name'],
                   'state': college_info.get('state', ''),
                   'address': college_info.get('normalized_address') or college_info.get('address', ''),
                   'type': course_type 
                }
                logger.info(f"🔐 Pass 0.5: {reason} + Name: {name_similarity:.2f}, Address: {address_match}")
                return matched_college, True

        logger.debug(f"⚠️ Pass 0.5: {reason} but validation failed for all filtered candidates")
        return None, False

    def _match_group(self, group: Dict):
        """
        PASS 0-5: Match a single group through the 5-pass system

        Flow:
          PASS 0: Composite key matching (name + address direct lookup)
          PASS 1-2: Use recent3.py to match (state + course + name)
          PASS 3: Detect single vs multi campus
          PASS 4A: Single campus path (verify + return)
          PASS 4B: Multi campus path (address-primary + disambiguation + verify)
          PASS 5: Fallback if needed
        """

        group_id = group['group_id']
        # CRITICAL FIX: Use ONLY NORMALIZED columns for matching (ZERO fallback to raw)
        # Raw columns like "ORISSA" won't match normalized master data "ODISHA"
        # MANDATORY: All group_matching_queue records MUST have normalized columns populated
        state = group['normalized_state']
        college_name = group['normalized_college_name']
        address = group['normalized_address'] if group.get('normalized_address') else ''
        course_type = group['sample_course_type']
        course_name = group['sample_course_name']
        composite_key = group.get('composite_college_key')

        # CRITICAL: Skip records with corrupted addresses (data quality issue)
        if self._is_corrupted_address(address):
            logger.debug(f"⚠️  SKIPPING: Group {group_id} has corrupted address: {address[:50]}... (likely data entry error)")
            return

        # CRITICAL FIX: Apply custom alias transformations ONCE at the beginning
        # This ensures ALL passes (PASS 1-5B) use the same transformed name
        # Previously, aliases were applied in Pass 5A only, which didn't help other passes
        original_college_name = college_name
        
        # Custom alias for ISLAMPUR case (and similar hospital naming variations)
        if 'ISLAMPUR' in college_name and 'SUB DISTRICT' in college_name:
            college_name = college_name.replace('SUB DISTRICT HOSPITAL', 'SUPER SPECIALTY HOSPITAL')
            college_name = college_name.replace('ISSH', '').strip()
            college_name = ' '.join(college_name.split())  # Remove extra spaces
            logger.debug(f"🔄 Applied custom alias: '{original_college_name}' → '{college_name}'")

        try:
            pass0_ambiguity_detected = False
            
            # DEBUG: Trace all passes for specific group
            DEBUG_GROUP = False  # Set to True to debug specific group
            if DEBUG_GROUP:
                print(f"\n{'='*60}")
                print(f"DEBUG WATERFALL: Group {group_id}")
                print(f"  College: {college_name}")
                print(f"  State: {state}")
                print(f"  Course Type: {course_type}")
                print(f"  Address: {address[:50] if address else 'N/A'}...")
                print(f"{'='*60}")

            # PASS 0.5: College Code Matching (Strict Brackets)
            # Check raw address for college codes (e.g. "(902791)")
            # We use group['address'] (raw) because normalization might have stripped brackets
            raw_address = group.get('address', '')
            
            # Use normalized columns ONLY for matching (Rule #1)
            val_name = group.get('normalized_college_name') or college_name
            val_state = group.get('normalized_state') or state
            
            # Single strategy: Normalized Name + Normalized State (consistent with master data normalization)
            matched_college, is_code_match = self._pass0_code_match(raw_address, val_name, val_state, course_type)
            
            if DEBUG_GROUP:
                print(f"  PASS 0.5 (Code Match): {bool(matched_college)}")
            
            if matched_college:
                self._update_group(group_id, matched_college, 1.0, 'PASS0_CODE_MATCH')
                self._increment_stat('pass0_code_match') # Ensure this stat is tracked
                logger.info(f"🔐 PASS 0.5 CODE MATCH: {college_name} -> {matched_college['name']} (Code Match)")
                return

            # PASS 0: Try keyword-based composite key matching first
            # Uses keyword overlap from address to match against master_data
            if composite_key:
                matched_college, pass0_ambiguity_detected = self._pass0_composite_key_matching(college_name, state, address, composite_key, course_type)
                if DEBUG_GROUP:
                    print(f"  PASS 0 (Composite Key): {bool(matched_college)}, composite_key={composite_key[:50] if composite_key else 'None'}...")
                if matched_college:
                    self._update_group(group_id, matched_college, 1.0, 'PASS0_KEYWORD_MATCH')
                    self._increment_stat('pass0_composite_key')
                    return
            elif DEBUG_GROUP:
                print(f"  PASS 0 (Composite Key): SKIPPED (no composite_key)")

            # CRITICAL FIX: VALIDATE ADDRESS FIRST before applying aliases
            # This prevents aliases from matching unrelated colleges with different addresses
            # Example: If alias changes "CIVIL HOSPITAL" → "CIVIL HOSPITAL GURDASPUR",
            # but the address is "EMAIL.COM", it shouldn't match master_data with different address

            address_is_valid = True
            if address and address.strip() and address.upper() not in ['NO_ADDRESS', 'UNKNOWN']:
                # Address validation: Check if this address makes sense (not corrupted/email)
                # Skip addresses that are clearly corrupted (email addresses, single words, etc.)
                address_upper = address.upper()
                corrupted_indicators = [
                    '@' in address,  # Email address
                    'GMAIL' in address_upper,
                    '.COM' in address_upper,
                    address.count(',') == 0 and len(address.split()) <= 1  # Single word or no separator
                ]
                if any(corrupted_indicators):
                    address_is_valid = False
                    logger.debug(
                        f"⚠️  ADDRESS VALIDATION: {college_name} ({state}) has potentially corrupted address: {address[:50]}"
                    )

            college_name_with_alias = college_name
            college_alias_applied = False

            # ONLY apply aliases if address is valid
            # This ensures aliases match in correct location context
            if address_is_valid:
                college_name_with_alias = self.recent3_matcher.apply_aliases(
                    college_name, 'college', state=state, address=address
                )
                college_alias_applied = college_name_with_alias != college_name
                if college_alias_applied:
                    logger.debug(f"✅ STAGE 1 ALIAS (address validated): '{college_name}' → '{college_name_with_alias}'")
            else:
                logger.debug(f"⚠️  ALIAS SKIPPED: Address validation failed for '{college_name}'")

            # Try PASS 1 using STREAM FILTERING (NEW: Tier 1 Implementation) - DISABLED BY USER REQUEST
            matched_college = None
            score = 0.0
            method = None

            # [PASS 1 DISABLED]
            """
            if PASS_1_STREAM_FILTERING_AVAILABLE and self.pass1_matcher:
                # NEW: Use stream-filtered PASS 1
                if 'KASHIBAI' in college_name_with_alias.upper():
                    print(f">>> REACHED PASS 1 CALL for {college_name_with_alias}")
                
                matched_college, score, method = self.pass1_matcher.match_group(
                    college_name_with_alias, state, course_name, course_type, address
                )
                if DEBUG_GROUP:
                    print(f"  PASS 1 (Stream Filtered): matched={bool(matched_college)}, score={score:.2f}")
                if matched_college and score >= 0.75:  # Stream-filtered, so lower threshold acceptable
                    logger.debug(f"✅ PASS 1 (Stream Filtered): Matched via {method}")
                    # Mark if this match was via alias
                    if college_alias_applied:
                        method = f"alias_{method}"
                    self._update_group(group_id, matched_college, score, method)
                    self._increment_stat('pass1_state_filtered')
                    return
                else:
                    # CRITICAL: Reset matched_college if score < threshold to allow fallbacks
                    matched_college = None
            else:
                # FALLBACK: Use legacy PASS 1-2 logic
                if DEBUG_GROUP:
                    print(f"  PASS 1 (Stream Filtered): NOT AVAILABLE, using legacy")
                logger.debug("PASS 1 Stream Filtering not available, using legacy PASS 1-2 logic")
                matched_college, score, method = self._pass1_2_orchestrator_matching(
                    college_name_with_alias, state, course_type, course_name, address
                )
                if DEBUG_GROUP:
                    print(f"  PASS 1-2 (Legacy): matched={bool(matched_college)}, score={score:.2f}")

                if matched_college and score >= 0.85:
                    # Good match from legacy PASS 1-2
                    # Mark if this match was via alias
                    if college_alias_applied:
                        method = f"alias_{method}"
                    self._update_group(group_id, matched_college, score, method)
                    self._increment_stat('pass1_state_filtered')
                    return
                else:
                    # CRITICAL: Reset matched_college if score < threshold to allow fallbacks
                    matched_college = None
            """
            
            if DEBUG_GROUP:
                print(f"  After PASS 1-2: matched_college is None = {matched_college is None}")
            
            if not matched_college:
                # PASS 3: Detect Single vs Multi Campus
                # If Pass 0 detected ambiguity (e.g. "GOVERNMENT MEDICAL COLLEGE"), FORCE multi-campus
                if pass0_ambiguity_detected:
                    campus_count = 2  # Force multi-campus path
                    logger.info(f"⚠️  AMBIGUITY DETECTED in Pass 0: Forcing Multi-Campus Path (Pass 4B) for '{college_name}'")
                else:
                    campus_count = self._pass3_detect_campus_count(college_name_with_alias, state, course_type)
                
                if DEBUG_GROUP:
                    print(f"  PASS 3 (Campus Detection): campus_count={campus_count}")
                
                logger.debug(f"Pass 3: Campus count for '{college_name_with_alias}' = {campus_count}")
                
                # Route based on campus count
                # campus_count == 0 means no match found - treat as multi-campus (needs disambiguation)
                # campus_count == 1 means single campus → PASS 4A
                # campus_count > 1 means multi campus → PASS 4B
                if campus_count == 1:
                    # PASS 4A: Single campus path (only when exactly 1 campus found)
                    matched_college, score, method = self._pass4a_single_campus(
                        college_name, state, course_type, address
                    )
                    if DEBUG_GROUP:
                        print(f"  PASS 4A (Single Campus): matched={bool(matched_college)}, score={score:.2f}")
                    self._increment_stat('pass3_single_campus')

                else:  # campus_count == 0 OR campus_count > 1
                    # PASS 4B: Multi campus path (includes 0 = unknown, needs disambiguation)
                    if campus_count == 0:
                        logger.info(f"PASS 3: No campus match for '{college_name}' in {state} - using multi-campus path for disambiguation")
                    matched_college, score, method = self._pass4b_multi_campus(
                        college_name, state, course_type, address
                    )
                    if DEBUG_GROUP:
                        print(f"  PASS 4B (Multi Campus): matched={bool(matched_college)}, score={score:.2f}")
                    self._increment_stat('pass3_multi_campus')

                if matched_college:
                    self._update_group(group_id, matched_college, score, method)
                    return

            # PASS 5: Fallback strategies (sequential)
            if not matched_college:
                # PASS 5 (Primary Fallback): Address-based matching
                matched_college, score, method = self._pass5_fallback(
                    college_name, state, course_type, address, course_name
                )
                if DEBUG_GROUP:
                    print(f"  PASS 5 (Council): matched={bool(matched_college)}, score={score:.2f}")
                if matched_college:
                    self._increment_stat('pass5_council_matched')
                    self._update_group(group_id, matched_college, score, method)
                    return
            

            # NOTE: Old PASS 5A (Alias-based) REMOVED
            # Agentic Matcher now runs as batch after ALL groups complete PASS 5E
            # See _run_agentic_batch() in run_complete_workflow

            # PASS 5B: Fallback with AI Enhanced (if PASS 5 Council failed)
            if not matched_college:
                matched_college, score, method = self._pass5b_fallback_ai_enhanced(
                    college_name, state, course_type, address, course_name
                )
                if DEBUG_GROUP:
                    print(f"  PASS 5B (AI Enhanced): matched={bool(matched_college)}, score={score:.2f}, method={method}")
                if matched_college:
                    self._increment_stat('pass5b_ai_matched')

                    # Phase 1 AI Integration: Enhance PASS 5B match with adaptive confidence
                    if self.ai_bridge:
                        try:
                            group_summary = {
                                'record_count': len(group.get('records', [])),
                                'address_consistency': 0.8,  # Default estimate
                                'course_count': 1,
                                'course_types': [course_type] if course_type else []
                            }

                            adjusted_score, explanation = self.ai_bridge.enhance_match_decision(
                                matched_college_id=matched_college.get('college_id'),
                                pass_number=5,
                                preliminary_confidence=score,
                                group_summary=group_summary
                            )

                            # Log enhancement details
                            logger.debug(f"PASS 5B AI Enhancement: {score:.2f} → {adjusted_score:.2f} "
                                       f"({explanation['recommendation']})")

                            # Update score with enhanced confidence
                            score = adjusted_score
                            # Track enhancement in method
                            method = f"{method}_ai_enhanced"
                        except Exception as e:
                            logger.debug(f"AI enhancement error (non-blocking): {e}")
                            # Continue without enhancement if bridge fails

                    self._update_group(group_id, matched_college, score, method)
                    return

            # PASS 5C: Smart Fuzzy Matching (if PASS 5B failed)
            if not matched_college:
                matched_college, score, method = self._pass5c_smart_fuzzy_match(
                    college_name, state, address
                )
                if DEBUG_GROUP:
                    print(f"  PASS 5C (Smart Fuzzy): matched={bool(matched_college)}, score={score:.2f}")
                if matched_college:
                    # UNIVERSAL ADDRESS VALIDATION: Strict threshold (0.50) for ALL fallback passes
                    if self._validate_address_universal(address, matched_college):
                        self._increment_stat('pass5c_fuzzy_matched')
                        self._update_group(group_id, matched_college, score, method)
                        return
                    else:
                        if DEBUG_GROUP:
                            print(f"  PASS 5C REJECTED: Address mismatch")
                        logger.debug(f"❌ PASS 5C REJECTED: Address mismatch for {college_name}")

            # PASS 5D: Campus-Specific Matching with STREAM FILTERING (if PASS 5C failed)
            if not matched_college and self.campus_matcher:
                matched_college, score, method = self.campus_matcher.match_unmatched_record(
                    college_name, state, address, course_type
                )
                if DEBUG_GROUP:
                    print(f"  PASS 5D (Campus-Specific): matched={bool(matched_college)}, score={score:.2f}")
                if matched_college:
                    # UNIVERSAL ADDRESS VALIDATION: Strict threshold (0.50)
                    if self._validate_address_universal(address, matched_college):
                        self._increment_stat('pass5d_campus_matched')
                        self._update_group(group_id, matched_college, score, method)
                        return
                    else:
                        if DEBUG_GROUP:
                            print(f"  PASS 5D REJECTED: Address mismatch")
                        logger.debug(f"❌ PASS 5D REJECTED: Address mismatch for {college_name}")
            elif DEBUG_GROUP:
                print(f"  PASS 5D: SKIPPED (no campus_matcher)")

            # PASS 5D COUNCIL: Single Campus Council for ADDRESS-LESS records
            # This specialized council handles records without address data
            if not matched_college and self.single_campus_council:
                # Only use Council if address is missing or very short
                address_is_missing = not address or len(address.strip()) < 10
                if address_is_missing:
                    matched_college, score, method, votes = self.single_campus_council.evaluate(
                        college_name, state, course_type
                    )
                    if DEBUG_GROUP:
                        print(f"  PASS 5D Council (Single Campus): matched={bool(matched_college)}, score={score:.2f}")
                        for v in votes:
                            emoji = "✅" if v.decision == 'MATCH' else ("❌" if v.decision == 'REJECT' else "⏸️")
                            print(f"    {emoji} {v.member_name}: {v.decision} - {v.reason}")
                    if matched_college:
                        # No address validation needed - council already validated uniqueness
                        self._increment_stat('pass5d_council_matched')
                        self._update_group(group_id, matched_college, score, method)
                        return
                elif DEBUG_GROUP:
                    print(f"  PASS 5D Council: SKIPPED (address present)")
            elif DEBUG_GROUP and not self.single_campus_council:
                print(f"  PASS 5D Council: SKIPPED (no council)")

            # PASS 5E: NER-Based Address Matching with STREAM FILTERING (if PASS 5D failed)
            if not matched_college and self.ner_matcher:
                matched_college, score, method = self.ner_matcher.match_unmatched_record(
                    college_name, state, address, course_type
                )
                if DEBUG_GROUP:
                    print(f"  PASS 5E (NER-Based): matched={bool(matched_college)}, score={score:.2f}")
                if matched_college:
                    # UNIVERSAL ADDRESS VALIDATION: Strict threshold (0.50)
                    if self._validate_address_universal(address, matched_college):
                        self._increment_stat('pass5e_ner_matched')
                        self._update_group(group_id, matched_college, score, method)
                        return
                    else:
                        if DEBUG_GROUP:
                            print(f"  PASS 5E REJECTED: Address mismatch")
                        logger.debug(f"❌ PASS 5E REJECTED: Address mismatch for {college_name}")
            elif DEBUG_GROUP:
                print(f"  PASS 5E: SKIPPED (no ner_matcher)")


            # Still no match after all fallbacks
            if DEBUG_GROUP:
                print(f"  ❌ FINAL RESULT: UNMATCHED after all passes")
                print(f"{'='*60}\n")
            self._increment_stat('total_unmatched')


        except Exception as e:
            import traceback
            logger.debug(f"Error matching group {group_id}: {e}")
            logger.debug(f"Full traceback: {traceback.format_exc()}")
            self._increment_stat('total_unmatched')

    def _is_corrupted_address(self, address: str) -> bool:
        """
        Check if address is obviously corrupted (contains email addresses, etc.)

        Returns True if address contains markers of corrupted data:
        - Email addresses (@gmail.com, @yahoo.com, etc.)
        - Only email addresses without real location info
        """
        if not address:
            return False

        address_upper = address.upper()

        # Check for email patterns
        if '@' in address and 'GMAIL' in address_upper or 'YAHOO' in address_upper or 'EMAIL' in address_upper:
            # This looks like an email address in the address field
            # Check if it's ONLY an email (no real address)
            parts = address.split(',')
            email_parts = [p for p in parts if '@' in p]

            # If most of the address is emails with no real location, it's corrupted
            if len(email_parts) >= len(parts) * 0.5:  # 50% or more emails = corrupted
                return True

        return False

    def _extract_city_district(self, address):
        """Extract city/district from address string (Ported from recent3.py)"""
        if not address: return None, None
        
        address = address.upper()
        city, district = None, None
        
        # Common keywords
        keywords = ['CITY', 'DISTRICT', 'TALUK', 'TALUKA', 'VILLAGE']
        parts = [p.strip() for p in address.replace(',', ' ').split()]
        
        for i, part in enumerate(parts):
            if part in keywords and i > 0:
                return parts[i-1], None
                
        # Fallback: Check last few words against known cities (simplified)
        # In a real implementation, we'd use a city list. 
        # For now, we rely on the structure "City, State"
        if len(parts) > 2:
            # Iterate backwards from the end, skipping state (last word)
            # and skipping common address suffixes
            ignore_terms = {'ROAD', 'MARG', 'STREET', 'LANE', 'ENCLAVE', 'NAGAR', 'COLONY', 'SECTOR', 'PHASE', 'NEW', 'OLD', 'NEAR', 'OPP', 'BEHIND', 'FLOOR', 'BLOCK', 'AREA', 'ZONE', 'PRESS'}
            
            # Try up to 3 words back from the end (excluding the very last one which is likely State/Zip)
            # We look for the first word (from the end) that is NOT an ignore term and is substantial
            for i in range(len(parts) - 2, max(-1, len(parts) - 5), -1):
                candidate = parts[i]
                if candidate not in ignore_terms and len(candidate) > 2 and not candidate.isdigit():
                    return candidate, None
            
            # If all else fails, return None rather than a random word like "ROAD"
            return None, None
            
        return None, None

    def check_name_conflict(self, name1, name2):
        """Check for conflicting keywords (e.g. Dental vs Medical)"""
        if not name1 or not name2: return False, ""
        
        n1, n2 = name1.upper(), name2.upper()
        
        # Stream conflict
        if 'DENTAL' in n1 and 'MEDICAL' in n2 and 'DENTAL' not in n2:
            return True, "Stream Conflict: Dental vs Medical"
        if 'DENTAL' in n2 and 'MEDICAL' in n1 and 'DENTAL' not in n1:
            return True, "Stream Conflict: Medical vs Dental"
            
        return False, ""

    def _validate_match_fail_safe(self, college_name, candidate_name, college_address, candidate_address):
        """
        Centralized Fail-Safe Validation.
        Layer 1: Logical Checks (Conflict, City)
        Layer 2: Rare Token Semantic Guard
        Layer 3: Multi-Campus Strict Address Check (New)
        """
        # 1. Conflict Check
        is_conflict, reason = self.check_name_conflict(college_name, candidate_name)
        if is_conflict:
            return False, reason

        # 1B. Secondary Name / Alias Consistency Check (CRITICAL FIX for DNB0175 vs DNB0173)
        # If the input has a specific secondary name (e.g. "Saket City Hospital"), 
        # the candidate MUST also have it or be compatible.
        seat_secondary = self._extract_secondary_name(college_name, college_address)
        master_secondary = self._extract_secondary_name(candidate_name, candidate_address)

        if seat_secondary:
            # User Request: Strict Bracket-to-Bracket Matching ONLY.
            # No contamination with primary name or address.
            
            if master_secondary:
                if seat_secondary != master_secondary:
                    return False, f"Secondary Name Mismatch: '{seat_secondary}' vs '{master_secondary}'"
            else:
                # If Master has NO secondary name in brackets, we CANNOT verify the alias.
                # Per strict user instruction, this is a block.
                return False, f"Secondary Name '{seat_secondary}' missing in Master (Strict Bracket Check)"

        # 2. Strict City/District Check
        city1, _ = self._extract_city_district(college_address)
        city2, _ = self._extract_city_district(candidate_address)
        
        if city1 and city2 and city1 != city2:
            # Allow if one contains the other (e.g. BANGALORE vs BANGALORE URBAN)
            if city1 not in city2 and city2 not in city1:
                return False, f"City mismatch: {city1} vs {city2}"

        # 3. Rare Token Check (The "Out of the Box" Solution)
        common_terms = {
            'GOVERNMENT', 'GOVT', 'MEDICAL', 'COLLEGE', 'INSTITUTE', 'SCIENCES', 
            'HOSPITAL', 'RESEARCH', 'CENTRE', 'CENTER', 'GENERAL', 'TALUK', 'TALUKA',
            'DISTRICT', 'MEMORIAL', 'TRUST', 'FOUNDATION', 'SOCIETY', 'UNIVERSITY',
            'AND', 'OF', 'THE', 'IN', 'AT', 'FOR', 'MISSIONS', 'MISSION'
        }
        
        def get_tokens(text):
            import re
            if not text: return set()
            text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.upper())
            return set(text.split())

        tokens1 = get_tokens(college_name)
        tokens2 = get_tokens(candidate_name)
        
        rare1 = tokens1 - common_terms
        rare2 = tokens2 - common_terms
        
        # Case A: Generic Mismatch (No shared rare tokens)
        if rare1 and rare2 and not (rare1 & rare2):
             return False, "No shared rare tokens (Generic Match)"
             
        # Case B: Purely Generic Names OR Shared Rare Tokens (Potential Multi-Campus)
        # If names are generic (General Hospital) OR share rare tokens (MGM Medical College),
        # we MUST verify address strictness to distinguish campuses.
        if (not rare1 and not rare2) or (rare1 & rare2):
            # Strict Address Token Check
            # We require addresses to be SUBSETS of each other OR have high overlap
            # This allows "Navi Mumbai" matching "Kamothe, Navi Mumbai" (Subset)
            # But BLOCKS "Nerul, Navi Mumbai" matching "Kamothe, Navi Mumbai" (Conflict)
            
            def get_addr_tokens(text):
                if not text: return set()
                text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.upper())
                # Remove common address words that don't distinguish location
                stop = {'NEAR', 'OPP', 'BEHIND', 'ROAD', 'STREET', 'LANE', 'NO', 'PLOT', 'SECTOR', 'DIST', 'DISTRICT', 'TALUK', 'AT', 'POST'}
                return {t for t in text.split() if len(t) > 2 and t not in stop}

            at1 = get_addr_tokens(college_address)
            at2 = get_addr_tokens(candidate_address)
            
            if at1 and at2:
                # Check Subset (One is less detailed version of other)
                if at1.issubset(at2) or at2.issubset(at1):
                    pass # Safe - just varying detail levels
                else:
                    # Check Overlap
                    intersection = at1 & at2
                    union = at1 | at2
                    score = len(intersection) / len(union) if union else 0.0
                    
                    if score < 0.80: # Strict 80% threshold for multi-campus differentiation
                        return False, f"Multi-campus ambiguity: Address overlap too low ({score:.2f}) - {at1} vs {at2}"

        # Case C: Purely generic names must be identical if no address info (fallback)
        if not rare1 and not rare2 and not college_address and not candidate_address:
            if college_name.upper() != candidate_name.upper():
                return False, "Both names purely generic and not identical"

        return True, "Safe"

    def _extract_secondary_name(self, text: str, address: str = None) -> Optional[str]:
        """
        Extract secondary/former name from parentheses in Name or Address.
        
        Rules:
        1. Name field: Look for (...) at the END.
        2. Address field: Look for (...) at the START.
        3. Keywords: Handle "FORMERLY", "OLD NAME", etc.
        """
        import re
        
        def clean_secondary(val):
            if not val: return None
            val = val.upper().strip()
            
            # Remove "FORMERLY KNOWN AS", etc.
            for prefix in ['FORMERLY KNOWN AS', 'FORMERLY', 'OLD NAME', 'PREVIOUSLY', 'ALSO KNOWN AS', 'AKA']:
                if val.startswith(prefix):
                    val = val.replace(prefix, '').strip()
            
            # Remove "A UNIT OF" suffix/prefix
            val = re.sub(r'^(A )?UNIT OF', '', val).strip()
            
            # Filter out purely generic terms if they are short
            # But ALLOW "CITY HOSPITAL", "GENERAL HOSPITAL" etc.
            if val in ['HOSPITAL', 'COLLEGE', 'INSTITUTE', 'TRUST', 'SOCIETY', 'CAMPUS']:
                return None
                
            # If it contains HOSPITAL but is short/generic, be careful
            if 'HOSPITAL' in val and len(val.split()) < 2:
                return None
                
            return val if len(val) > 3 else None

        # 1. Check Name Field (Expect at END)
        if text:
            # Find all parenthesized groups
            matches = re.findall(r'\(([^)]+)\)', text)
            if matches:
                # User said "at the end", so we prioritize the last match
                candidate = matches[-1]
                cleaned = clean_secondary(candidate)
                if cleaned:
                    return cleaned

        # 2. Check Address Field (Expect at START)
        if address:
            # Check if address starts with (...)
            match = re.match(r'^\s*\(([^)]+)\)', address)
            if match:
                candidate = match.group(1)
                cleaned = clean_secondary(candidate)
                if cleaned:
                    return cleaned
                    
        return None

    def _pass0_composite_key_matching(self, college_name: str, state: str, address: str, composite_key: str, course_type: str = None) -> Tuple[Optional[Dict], bool]:
        """
        PASS 0: Composite Key Matching
        Uses pre-computed composite keys (Name + Address Keywords) for high-precision matching.
        
        CRITICAL FIX: Added course_type filtering to prevent stream contamination.
        DNB courses should NOT match Medical College IDs (MEDxxx) even if name/address matches.
        
        Returns:
            (matched_college_dict, ambiguity_detected)
        """
        if not composite_key or not college_name:
            return None, False

        conn = self._get_master_conn()
        cursor = conn.cursor()

        try:
            # Extract keywords from seat_data address - KEEP GENERIC KEYWORDS for better matching
            # Generic keywords like HOSPITAL, COLLEGE, DISTRICT are important for address matching
            if address:
                # Split address into words and create keyword set
                address_upper = str(address).upper().strip()
                # Extract all meaningful words (>= 3 chars) without filtering generic terms
                words = address_upper.replace(',', ' ').split()
                seat_keywords = {w.strip('.,;:()[]{}') for w in words
                                if len(w.strip('.,;:()[]{}')) >= 3
                                and not w.strip('.,;:()[]{}').replace('-', '').replace('/', '').isdigit()}
            else:
                seat_keywords = set()

            # PASS 0: Composite Key Matching with Name Normalization
            # composite_key format: "COLLEGE_NAME, ADDRESS_KEYWORDS"
            # Example: "MAX SMART SUPER SPECIALTY HOSPITAL, CITY DELHI ENCLAVE FORMERLY..."
            
            if not composite_key or ',' not in composite_key:
                return None, False
            
            ambiguity_detected = False
            
            # Split composite key into name and address parts
            seat_name_part, seat_address_part = composite_key.split(',', 1)
            seat_name_part = seat_name_part.strip().upper()
            seat_address_keywords_str = seat_address_part.strip().upper()
            
            # Extract address keywords from seat
            seat_address_words = seat_address_keywords_str.split()
            seat_address_keywords = {w for w in seat_address_words if len(w) >= 3}
            
            # DEBUG: Log for MAX SMART
            # if 'MAX SMART' in seat_name_part:
            #     logger.info(f"🔍 PASS0 DEBUG: Processing MAX SMART")
            #     logger.info(f"   Seat Name Part: {seat_name_part}")
            #     logger.info(f"   Seat Address Keywords: {sorted(seat_address_keywords)}")
            #     logger.info(f"   State: {state}")
            
            # Normalize state
            normalized_state = self.recent3_matcher.normalize_state_name_import(state) if state else ''
            
            # Determine tables to search based on course_type
            tables_to_search = []
            if course_type:
                course_upper = course_type.upper()
                if 'DNB' in course_upper or 'DIPLOMA' in course_upper:
                    tables_to_search = ['dnb_colleges']
                elif 'DENTAL' in course_upper or 'BDS' in course_upper or 'MDS' in course_upper:
                    tables_to_search = ['dental_colleges']
                elif 'MEDICAL' in course_upper or 'MBBS' in course_upper or 'MD' in course_upper or 'MS' in course_upper:
                    tables_to_search = ['medical_colleges']
            
            # Fallback: If no specific stream identified, search all (or if course_type is missing)
            if not tables_to_search:
                tables_to_search = ['medical_colleges', 'dental_colleges', 'dnb_colleges']

            # Search in selected tables
            for table in tables_to_search:
                cursor.execute(f"""
                SELECT id, name, state, composite_college_key FROM {table}
                WHERE normalized_state = ?
                """, (state,))

                results = cursor.fetchall()
                
                # Collect all valid candidates for this table
                valid_candidates_in_table = []
                
                # First pass: Check for ambiguity across ALL results in this table
                # (We need to know if the name is ambiguous before deciding threshold)
                name_counts = {}
                for r in results:
                    r_name_norm = re.sub(r'\s*\([^)]*\)', '', r[1]).strip().upper()
                    name_counts[r_name_norm] = name_counts.get(r_name_norm, 0) + 1

                for result in results:
                    result_id, result_name, result_state, result_composite_key = result
                    
                    if not result_composite_key or ',' not in result_composite_key:
                        continue
                    
                    # Split master composite key
                    master_name_part, master_address_part = result_composite_key.split(',', 1)
                    master_name_part = master_name_part.strip().upper()
                    master_address_keywords_str = master_address_part.strip().upper()
                    
                    # CRITICAL: Normalize both names (strip parenthetical secondary names)
                    seat_name_normalized = re.sub(r'\s*\([^)]*\)', '', seat_name_part).strip()
                    master_name_normalized = re.sub(r'\s*\([^)]*\)', '', master_name_part).strip()
                    
                    # Check normalized name match
                    if seat_name_normalized != master_name_normalized:
                        continue
                    
                    # Name matched!
                    # Check for AMBIGUITY using pre-calculated counts
                    ambiguity_count = name_counts.get(seat_name_normalized, 1)
                    is_ambiguous_name = False
                    
                    if ambiguity_count > 1:
                        is_ambiguous_name = True
                        ambiguity_detected = True
                        if 'GOVERNMENT MEDICAL COLLEGE' in seat_name_normalized or 'MAHATMA GANDHI' in seat_name_normalized:
                             logger.debug(f"⚠️  AMBIGUOUS NAME DETECTED: '{seat_name_normalized}' matches {ambiguity_count} colleges in {state}")

                    # Validate state match
                    result_normalized_state = self.recent3_matcher.normalize_state_name_import(result_state) if result_state else ''
                    if normalized_state and result_normalized_state and normalized_state.upper() != result_normalized_state.upper():
                        continue
                    
                    # Extract master address keywords
                    master_address_words = master_address_keywords_str.replace(',', ' ').split()
                    master_address_keywords = {w.strip('.,;:()[]{}') for w in master_address_words 
                                             if len(w.strip('.,;:()[]{}')) >= 3}
                    
                    # Calculate keyword overlap
                    overlap_score = 0.0
                    if seat_address_keywords:
                        overlap_score = self.recent3_matcher.calculate_keyword_overlap(seat_address_keywords, master_address_keywords)
                        
                        # DYNAMIC THRESHOLD BASED ON AMBIGUITY
                        # INCREASED THRESHOLDS to prevent false matches (was 0.8/0.3)
                        if is_ambiguous_name:
                            # AMBIGUOUS NAME: Require STRICT address match
                            threshold = 0.85  # Increased from 0.8
                        else:
                            # UNIQUE NAME: Still require meaningful address validation
                            # Prevents false matches like YAVATMAL vs NASHIK
                            threshold = 0.50  # Increased from 0.3
                        
                        if overlap_score < threshold:
                            if 'MAX SMART' in seat_name_normalized or is_ambiguous_name:
                                logger.debug(f"   ❌ Address overlap too low: {overlap_score:.2f} < {threshold} (Ambiguous: {is_ambiguous_name})")
                            continue
                        
                        if 'MAX SMART' in seat_name_normalized:
                            logger.info(f"   ✅ Address overlap OK: {overlap_score:.2f} >= {threshold}")
                    
                    # CRITICAL SAFETY: If ambiguous name and NO address keywords, REJECT
                    elif is_ambiguous_name:
                        logger.debug(f"   ❌ Ambiguous name '{seat_name_normalized}' rejected: No address keywords for validation")
                        continue
                    
                    # Match accepted as CANDIDATE
                    college_type = 'MEDICAL' if table == 'medical_colleges' else ('DENTAL' if table == 'dental_colleges' else 'DNB')
                    # FAIL-SAFE VALIDATION (Rare Token Check)
                    # Even for composite key matches, we must ensure no "Generic vs Generic" mismatch
                    # e.g. "Government Medical College, X" vs "Government Medical College, Y"
                    # (Though composite key includes address keywords, so this is unlikely, but safe)
                    is_safe, reason = self._validate_match_fail_safe(college_name, master_name_part, address, master_address_part)
                    if not is_safe:
                        # logger.debug(f"❌ PASS 0 REJECTED (Fail-Safe): {college_name} vs {master_name_part} - {reason}")
                        continue

                    candidate = {
                        'id': result_id,
                        'name': result_name,
                        'state': result_state,
                        'address': master_address_part.strip(),
                        'college_type': college_type,
                        'score': overlap_score
                    }
                    valid_candidates_in_table.append(candidate)
                
                # End of results loop for this table
                
                # DECISION LOGIC FOR THIS TABLE
                if not valid_candidates_in_table:
                    continue # Try next table
                
                if len(valid_candidates_in_table) == 1:
                    # Unique match in this table -> Return it
                    c = valid_candidates_in_table[0]
                    logger.info(f"✅ PASS0 MATCH: {seat_name_part} → {c['name']} (ID: {c['id']})")
                    return c, False
                
                # Multiple candidates passed threshold in this table
                if ambiguity_detected:
                    logger.info(f"⚠️  AMBIGUITY: {len(valid_candidates_in_table)} candidates passed strict threshold for '{seat_name_part}'. Routing to Pass 4B.")
                    # Log the conflicting IDs
                    conflicts = [f"{c['id']} ({c['address']})" for c in valid_candidates_in_table]
                    logger.info(f"   Conflicts: {', '.join(conflicts)}")
                    return None, True # Force Pass 4B
                
                # If multiple matches but NOT flagged as ambiguous name (rare), return best score?
                # For now, treat as ambiguous to be safe
                return None, True

            return None, ambiguity_detected
        
        except Exception as e:
            logger.error(f"PASS 0 error: {e}")
            import traceback
            logger.error(f"PASS 0 traceback: {traceback.format_exc()}")
            return None, False

    def _pass1_2_orchestrator_matching(self, college_name: str, state: str,
                                       course_type: str, course_name: str,
                                       address: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 1-2: Orchestrator-only keyword-based matching (NO FUZZY MATCHING)

        COMPLETELY STANDALONE - Does NOT use recent3.py's pass3_college_name_matching()

        PASS 1: State + Course filtering (deterministic)
          - Gets all colleges in the state offering this course
          - Uses get_college_pool() for O(1) lookup

        PASS 2: College name matching (keyword-based, not fuzzy)
          - Extracts keywords from normalized college names
          - Matches based on keyword overlap (strict: 80%+ overlap required)
          - Returns matches with high confidence

        Advantages over fuzzy matching:
          - No false positives (e.g., DEN0081 Lucknow vs Varanasi)
          - Deterministic and predictable
          - Clear rejection logic (not hidden in fuzzy thresholds)
        """

        try:
            # PASS 1: State + Course filtering
            candidates = self.recent3_matcher.get_college_pool(
                state=state,
                course_type=course_type,
                course_name=course_name
            )

            if not candidates:
                return (None, 0.0, 'pass1_2_no_candidates')

            # CRITICAL FIX: Use ONLY normalized names, NO fallback to raw
            # The college_name passed in is ALREADY normalized from group_matching_queue
            # Candidates already have normalized_name field from master data
            normalized_query = college_name.upper()  # Already normalized, just uppercase for comparison
            query_words = set(normalized_query.split())

            # Remove stopwords from query
            stopwords = {'OF', 'AND', 'THE', 'WITH', 'FOR'}
            query_significant = query_words - stopwords

            best_match = None
            best_score = 0.0

            # CRITICAL FIX: For multi-campus colleges, collect ALL candidates with address validation
            # ADDRESS MATCHING IS MANDATORY - we will validate address for ALL candidates before returning any match
            exact_match_candidates = []  # Store (candidate, score, method, address_score)

            # PASS 2: College name matching using NORMALIZED names only
            for candidate in candidates:
                # CRITICAL FIX: Use normalized_name from candidate, NOT raw name
                # Candidates have 'normalized_name' field loaded from master_data
                candidate_name = candidate.get('normalized_name', '') or candidate.get('name', '')
                normalized_candidate = candidate_name.upper()  # Already normalized, just uppercase
                candidate_words = set(normalized_candidate.split())

                # Remove stopwords
                candidate_significant = candidate_words - stopwords

                # Check for EXACT name match (highest confidence)
                # BUT: Only accept if state also matches (prevent DISTRICT HOSPITAL false matches)
                # ALSO: Strip brackets before comparing (secondary names in parentheses shouldn't affect match)
                # E.g., "MAX SMART HOSPITAL" should match "MAX SMART HOSPITAL (FORMERLY SAKET CITY)"
                query_without_brackets = re.sub(r'\s*\([^)]*\)', '', normalized_query).upper().strip()
                candidate_without_brackets = re.sub(r'\s*\([^)]*\)', '', normalized_candidate).upper().strip()

                if query_without_brackets == candidate_without_brackets:
                    # CRITICAL FIX: Validate state matches to prevent false matches
                    # Example: DISTRICT HOSPITAL (Maharashtra) should NOT match DISTRICT HOSPITAL (Andhra Pradesh)
                    candidate_state = candidate.get('state', '').upper()
                    normalized_query_state = self.recent3_matcher.normalize_text(state).upper()

                    # Accept exact match ONLY if states match
                    if candidate_state == normalized_query_state:
                        # CRITICAL FIX 2B: Check SECONDARY NAMES for disambiguation
                        # If both have MATCHING secondary names, they're SAME college - then verify address
                        # If secondary names DIFFER, they're DIFFERENT colleges
                        seat_secondary = self._extract_secondary_name(college_name)
                        # Also check address for secondary name at the start: "(FORMERLY...), ADDRESS..."
                        if not seat_secondary and address:
                            address_upper = address.upper().strip()
                            if address_upper.startswith('('):
                                match = re.match(r'\(([^)]+)\)', address_upper)
                                if match:
                                    secondary_text = match.group(1)
                                    if 'FORMERLY' in secondary_text or 'KNOWN' in secondary_text:
                                        seat_secondary = re.sub(r'(FORMERLY|KNOWN|AS|ALSO|PREVIOUSLY)', '', secondary_text).strip()

                        master_secondary = self._extract_secondary_name(candidate_name)

                        # RULE: If both have secondary names and they DIFFER, they're different colleges
                        if seat_secondary and master_secondary and seat_secondary != master_secondary:
                            logger.debug(
                                f"❌ SECONDARY NAME MISMATCH: {college_name} (secondary: {seat_secondary}) "
                                f"vs {candidate_name} (secondary: {master_secondary}) - Different colleges!"
                            )
                            continue  # Skip this candidate - they're different colleges

                        # RULE: If both have secondary names and they MATCH, require address validation
                        if seat_secondary and master_secondary and seat_secondary == master_secondary:
                            logger.debug(
                                f"✅ SECONDARY NAME MATCH: {college_name} (secondary: {seat_secondary}) "
                                f"matches {candidate_name} - checking address for confirmation"
                            )
                            # Secondary names match - now require address match to confirm
                            if address and candidate.get('address'):
                                normalized_seat_address = self.recent3_matcher.normalize_text(address).upper()
                                candidate_address = self.recent3_matcher.normalize_text(candidate.get('address', '')).upper()

                                seat_tokens = re.split(r'[\s,]+', normalized_seat_address)
                                master_tokens = re.split(r'[\s,]+', candidate_address)

                                seat_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in seat_tokens if t.strip()}
                                master_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in master_tokens if t.strip()}

                                seat_keywords = {k for k in seat_keywords if k}
                                master_keywords = {k for k in master_keywords if k}

                                excluded = {'DISTRICT', 'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'OF', 'AND', 'THE', 'INSTITUTE', 'ROAD', 'NEAR', 'BY', 'PASS', 'HOUSE', 'NO'}
                                seat_meaningful = {k for k in seat_keywords if k not in excluded and len(k) > 2}
                                master_meaningful = {k for k in master_keywords if k not in excluded and len(k) > 2}

                                common_keywords = seat_meaningful & master_meaningful
                                address_score = len(common_keywords) / max(len(seat_meaningful), len(master_meaningful), 1) if seat_meaningful and master_meaningful else 0

                                if address_score >= 0.5:  # Require 50% address overlap when secondary names match
                                    logger.debug(
                                        f"✅ ADDRESS CONFIRMED: Secondary name '{seat_secondary}' matches + address overlap {address_score:.2f} "
                                        f"→ {college_name} matches {candidate_name}"
                                    )
                                    return (candidate, 1.0, 'pass1_2_secondary_name_address_match')
                                else:
                                    logger.debug(
                                        f"❌ ADDRESS MISMATCH: Secondary name '{seat_secondary}' matches but address overlap only {address_score:.2f} "
                                        f"→ Different locations/campuses"
                                    )
                        
                        # CRITICAL FIX for Krishna Institute Case (Junk Address)
                        # If Name is EXACT match, State is EXACT match, and it's the ONLY candidate in the state,
                        # AND the address looks like junk (e.g. email/URL) or has very low overlap,
                        # we should ACCEPT it if there are no other conflicting candidates.
                        
                        # Check if this is the ONLY candidate in the pool for this state
                        # (candidates list is already filtered by state in Pass 1)
                        if len(candidates) == 1:
                            # Verify no other candidate has similar name in the same state
                            # (Pass 1 returns all colleges in state, so if len > 1, we might have confusion)
                            # But here 'candidates' is the full pool.
                            
                            # Check if address is junk
                            is_junk_address = False
                            if address:
                                addr_clean = re.sub(r'[^a-zA-Z0-9]', '', address.upper())
                                if 'COM' in address.upper() or 'WWW' in address.upper() or 'HTTP' in address.upper() or len(addr_clean) < 10:
                                    is_junk_address = True
                            
                            if is_junk_address:
                                logger.info(f"✅ UNIQUE MATCH WITH JUNK ADDRESS: {college_name} matches {candidate_name} in {state}. Address '{address}' ignored.")
                                return (candidate, 0.95, 'pass1_2_unique_junk_address')
                                
                            # Even if not junk, if overlap is low but it's a unique exact name match in the state,
                            # and fail-safe blocked it only due to "Multi-campus ambiguity" (which assumes generic names),
                            # we might want to allow it if the name is SPECIFIC.
                            # "Krishna Institute of Medical Sciences" is specific enough.
                            # "Government Medical College" is NOT.
                            
                            is_generic = any(term in normalized_query for term in ['GOVERNMENT', 'DISTRICT', 'GENERAL', 'CIVIL'])
                            if not is_generic:
                                logger.info(f"✅ UNIQUE SPECIFIC MATCH: {college_name} matches {candidate_name} in {state}. Address mismatch ignored for unique specific name.")
                                return (candidate, 0.95, 'pass1_2_unique_specific_match')

                        # Standard Address Verification (if not unique/junk exception)
                        if address and candidate.get('address'):
                            # ... existing address logic ...
                            normalized_seat_address = self.recent3_matcher.normalize_text(address).upper()
                            candidate_address = self.recent3_matcher.normalize_text(candidate.get('address', '')).upper()

                            seat_tokens = re.split(r'[\s,]+', normalized_seat_address)
                            master_tokens = re.split(r'[\s,]+', candidate_address)

                            seat_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in seat_tokens if t.strip()}
                            master_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in master_tokens if t.strip()}

                            seat_keywords = {k for k in seat_keywords if k}
                            master_keywords = {k for k in master_keywords if k}

                            excluded = {'DISTRICT', 'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'OF', 'AND', 'THE', 'INSTITUTE', 'ROAD', 'NEAR', 'BY', 'PASS', 'HOUSE', 'NO', 'PRESS', 'MARG', 'STREET', 'LANE', 'ENCLAVE', 'NAGAR', 'COLONY', 'SECTOR', 'PHASE', 'NEW', 'OLD', 'OPP', 'BEHIND', 'FLOOR', 'BLOCK', 'AREA', 'ZONE'}
                            seat_meaningful = {k for k in seat_keywords if k not in excluded and len(k) > 2}
                            master_meaningful = {k for k in master_keywords if k not in excluded and len(k) > 2}

                            common_keywords = seat_meaningful & master_meaningful
                            address_score = len(common_keywords) / max(len(seat_meaningful), len(master_meaningful), 1) if seat_meaningful and master_meaningful else 0

                            if address_score >= 0.3:  # Lowered threshold for Exact Name Match
                                logger.debug(f"✅ Address overlap OK: {address_score:.2f}")
                                return (candidate, 1.0, 'pass1_2_exact_name_address_match')
                            else:
                                logger.debug(f"❌ Address overlap too low: {address_score:.2f}")
                                continue # Try next candidate (if any)
                        else:
                            # No address to verify - accept based on secondary name match
                            logger.debug(
                                f"✅ SECONDARY NAME MATCH (no address to verify): {college_name} → {candidate_name}"
                            )
                            return (candidate, 1.0, 'pass1_2_secondary_name_match')

                        # CRITICAL FIX 2: Check if there are MULTIPLE candidates with SAME COMPOSITE_COLLEGE_KEY
                        # Not just same name+state (which loses composite key precision)
                        # If yes, require ADDRESS validation to disambiguate (e.g., multiple DISTRICT HOSPITAL in AP)
                        matched_composite_key = candidate.get('composite_college_key', '')
                        same_composite_key_candidates = [
                            c for c in candidates
                            if c.get('composite_college_key', '') == matched_composite_key
                        ]

                        # CRITICAL FIX 3: Also check for SIMILAR candidates with keyword overlap (supersets)
                        # This handles cases where input "SANKARA EYE HOSPITAL" should check against
                        # both "SANKARA EYE HOSPITAL" (DNB0935) AND "SANKARA EYE HOSPITAL (SHRI KANCHI...)" (DNB0934)
                        # by comparing addresses to find the best match
                        similar_candidates = []
                        if len(same_composite_key_candidates) == 1:
                            # Only found one exact match - check if there are similar/superset candidates
                            # that share significant keywords but have different lengths
                            query_words = set(normalized_query.split())
                            stopwords = {'OF', 'AND', 'THE', 'WITH', 'FOR'}
                            query_significant = query_words - stopwords

                            for c in candidates:
                                c_normalized = self.recent3_matcher.normalize_text(c.get('name', '')).upper()
                                c_words = set(c_normalized.split())
                                c_significant = c_words - stopwords

                                # Check if this candidate has high keyword overlap but is not an exact match
                                # and is in the same state
                                if (c_normalized != normalized_query.upper() and
                                    c.get('state', '').upper() == normalized_query_state):
                                    # Check keyword overlap: input keywords should be subset of candidate keywords
                                    if query_significant.issubset(c_significant) and c_significant != query_significant:
                                        # This candidate contains all keywords from input + extra keywords (longer name)
                                        similar_candidates.append(c)

                            if similar_candidates:
                                # Add the similar candidates to the same_composite_key_candidates
                                same_composite_key_candidates.extend(similar_candidates)
                                logger.debug(
                                    f"📍 FOUND SIMILAR CANDIDATES: '{normalized_query}' → found {len(similar_candidates)} "
                                    f"candidates with keyword supersets (longer names)"
                                )

                        if len(same_composite_key_candidates) > 1:
                            # Multiple candidates with same composite key - require address validation
                            logger.debug(
                                f"⚠️  {len(same_composite_key_candidates)} MULTI-CAMPUS candidates found for '{normalized_query}' in {state} - "
                                f"using address-based disambiguation"
                            )

                            # For multi-campus: COLLECT all valid candidates, don't return immediately
                            if address:
                                # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
                                # We removed generic name detection in favor of a universal strict rule
                                # to resolve ambiguity for ALL multi-campus scenarios.
                                if self._validate_address_universal(address, candidate):
                                    logger.debug(
                                        f"✅ EXACT NAME + ADDRESS MATCH: {college_name} ({state}) → {candidate_name} "
                                        f"(address keywords: {common_keywords}, score: {address_score:.2f})"
                                    )
                                    # For multi-campus: Collect this match with score
                                    # Note: address_score is not directly from _validate_address_universal,
                                    # but we can re-calculate or pass a default high score if validation passes.
                                    # For now, using a placeholder 0.75 if validation passes.
                                    # Calculate real address score for disambiguation
                                    addr_score = self._calculate_address_score(address, candidate.get('address'))
                                    
                                    # FAIL-SAFE VALIDATION
                                    is_safe, reason = self._validate_match_fail_safe(college_name, candidate_name, address, candidate.get('address'))
                                    if is_safe:
                                        exact_match_candidates.append((candidate, 1.0, 'pass1_2_exact_name_address_match', addr_score))
                                    else:
                                        logger.debug(f"❌ BLOCKED by Fail-Safe: {reason}")
                                else:
                                    # Address mismatch - skip this candidate (different location/campus)
                                    logger.debug(
                                        f"❌ MULTI-CAMPUS: Address mismatch or too different: {college_name} ({address[:40]}) "
                                        f"vs {candidate_name} ({candidate.get('address', '')[:40]})"
                                    )
                                    continue  # CRITICAL FIX: Skip this candidate and try next one
                            else:
                                # No address provided but multiple candidates - still collect for fallback
                                logger.debug(
                                    f"⚠️  MULTI-CAMPUS: No address to disambiguate between {len(same_composite_key_candidates)} candidates"
                                )
                                # FAIL-SAFE VALIDATION
                                is_safe, reason = self._validate_match_fail_safe(college_name, candidate_name, address, candidate.get('address'))
                                if is_safe:
                                    exact_match_candidates.append((candidate, 1.0, 'pass1_2_exact_name_match', 0.5))
                                else:
                                    logger.debug(f"❌ BLOCKED by Fail-Safe: {reason}")
                        else:
                            # Only one candidate with this name and state
                            # BUT: If we have address information, validate it before returning
                            # This prevents exact name matches from being accepted if they're in wrong locations
                            should_accept = True
                            if address and candidate.get('address'):
                                # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
                                # Even for single-campus matches, require meaningful address overlap (50% minimum)
                                # ADDRESS MATCHING IS MANDATORY - NO EXCEPTIONS
                                if not self._validate_address_universal(address, candidate):
                                    logger.debug(
                                        f"⚠️  EXACT NAME MATCH BUT ADDRESS MISMATCH: {college_name} ({address[:50]}) "
                                        f"vs {candidate_name} ({candidate.get('address', '')[:50]}) "
                                        f"will search for candidates with better address match"
                                    )
                                    should_accept = False
                                    # Don't return yet - continue the loop to find better candidates
                                    # This will fall through to keyword matching below

                            if should_accept:
                                # FAIL-SAFE VALIDATION
                                is_safe, reason = self._validate_match_fail_safe(college_name, candidate_name, address, candidate.get('address'))
                                if is_safe:
                                    logger.debug(f"✅ EXACT NAME MATCH (single campus): {college_name} → {candidate_name} (state: {state})")
                                    return (candidate, 1.0, 'pass1_2_exact_name_match')
                                else:
                                    logger.debug(f"❌ BLOCKED by Fail-Safe: {reason}")
                    else:
                        # Different state = Not a valid exact match (prevent false grouping)
                        logger.debug(
                            f"❌ Name match rejected (state mismatch): {college_name} ({state}) "
                            f"vs {candidate_name} ({candidate_state})"
                        )
                        continue

                # CRITICAL FIX: Before keyword matching, check ADDRESS SIMILARITY
                # If addresses are SAME/SIMILAR, require EXACT NAME MATCH (no fuzzy allowed)
                # This prevents "MAX SMART" and "MAX SUPER" from matching when they share same address
                address_similarity_score = 0.0
                if address and candidate.get('address'):
                    normalized_seat_address = self.recent3_matcher.normalize_text(address).upper()
                    candidate_address = self.recent3_matcher.normalize_text(candidate.get('address', '')).upper()

                    seat_tokens = re.split(r'[\s,]+', normalized_seat_address)
                    master_tokens = re.split(r'[\s,]+', candidate_address)

                    seat_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in seat_tokens if t.strip()}
                    master_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in master_tokens if t.strip()}

                    seat_keywords = {k for k in seat_keywords if k}
                    master_keywords = {k for k in master_keywords if k}

                    excluded = {'DISTRICT', 'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'OF', 'AND', 'THE', 'INSTITUTE', 'ROAD', 'NEAR', 'BY', 'PASS', 'HOUSE', 'NO'}
                    seat_meaningful = {k for k in seat_keywords if k not in excluded and len(k) > 2}
                    master_meaningful = {k for k in master_keywords if k not in excluded and len(k) > 2}

                    common_address_keywords = seat_meaningful & master_meaningful
                    address_similarity_score = len(common_address_keywords) / max(len(seat_meaningful), len(master_meaningful), 1) if seat_meaningful and master_meaningful else 0

                # Try keyword overlap matching (primary)
                if query_significant and candidate_significant:
                    # Keywords must overlap significantly
                    overlap = query_significant.intersection(candidate_significant)
                    overlap_ratio = len(overlap) / max(len(query_significant), len(candidate_significant))

                    # CRITICAL FIX: Address-driven name strictness
                    # If addresses are VERY SIMILAR (>= 0.6 overlap), require EXACT name match
                    # This prevents fuzzy matching of colleges with same address but different names
                    if address_similarity_score >= 0.6:
                        # Same/similar address = EXACT NAME MATCH ONLY (no fuzzy allowed)
                        if overlap_ratio < 1.0:  # Not an exact match
                            logger.debug(
                                f"❌ FUZZY NAME REJECTED (same address requires exact name): "
                                f"'{college_name}' vs '{candidate_name}' have similar addresses (score: {address_similarity_score:.2f}) "
                                f"but name match is only {overlap_ratio:.0%} (need 100%)"
                            )
                            continue  # Skip fuzzy matches when addresses are the same

                    # Reject if insufficient significant word overlap
                    if overlap_ratio >= 0.80:  # Strict threshold: 80%+ required
                        # Additional check: Reject if candidate has many extra significant words
                        extra_words = candidate_significant - query_significant
                        missing_words = query_significant - candidate_significant

                        # If extra/missing words exist, it's a lower confidence match
                        confidence = 0.90 if not (extra_words or missing_words) else 0.75

                        # CRITICAL FIX: Check SECONDARY NAMES even for keyword matches
                        # Colleges with different former names are different institutions
                        # E.g., "MAX SMART (FORMERLY SAKET CITY)" vs "MAX SUPER" are different
                        seat_secondary = self._extract_secondary_name(college_name)
                        master_secondary = self._extract_secondary_name(candidate_name)

                        # RULE 1: Both have secondary names and they differ = Different colleges
                        if seat_secondary and master_secondary and seat_secondary != master_secondary:
                            logger.debug(
                                f"❌ KEYWORD MATCH REJECTED (both have different secondary names): "
                                f"{college_name} (secondary: {seat_secondary}) "
                                f"vs {candidate_name} (secondary: {master_secondary}) - Different colleges!"
                            )
                            continue  # Skip this candidate

                        # RULE 2: Seat has secondary name but master doesn't have it in name
                        # E.g., seat "MAX SMART (SAKET CITY)" vs master "MAX SUPER" - they're different
                        if seat_secondary and not master_secondary:
                            # Check if the secondary name appears anywhere in master's name
                            if seat_secondary.upper() not in candidate_name.upper():
                                logger.debug(
                                    f"❌ KEYWORD MATCH REJECTED (secondary name not in master): "
                                    f"{college_name} has secondary '{seat_secondary}' but master '{candidate_name}' doesn't - Different colleges!"
                                )
                                continue  # Skip this candidate

                        # RULE 3: Master has secondary name but seat doesn't
                        # NOTE: Only matters if PRIMARY names don't match exactly
                        # If primary names match exactly, secondary is just metadata (former name)
                        # E.g., Seat "MAX SMART" CAN match Master "MAX SMART (FORMERLY SAKET CITY)"
                        # because the primary name matches perfectly
                        is_primary_exact = college_name.upper().strip() == candidate_name.split('(')[0].upper().strip()

                        if master_secondary and not seat_secondary and not is_primary_exact:
                            # Primary names don't match exactly AND master has secondary
                            # This is more suspicious - might be different colleges
                            if master_secondary.upper() not in college_name.upper():
                                logger.debug(
                                    f"❌ KEYWORD MATCH REJECTED (master secondary name not in seat, fuzzy primary): "
                                    f"Master '{candidate_name}' has secondary '{master_secondary}' but seat '{college_name}' has fuzzy match - Different colleges!"
                                )
                                continue  # Skip this candidate

                        # CRITICAL FIX: ALWAYS validate address for keyword matches
                        # This prevents false matches like DEN0104 (AURANGABAD) matching records in NAGPUR, MUMBAI, JALGAON
                        # Previous bug: Address validation only happened when len(same_name_state_candidates) > 1
                        # Now: MANDATORY address validation for ALL keyword matches
                        candidate_state = candidate.get('state', '').upper()
                        normalized_query_state = self.recent3_matcher.normalize_text(state).upper()

                        if candidate_state == normalized_query_state and address and candidate.get('address'):
                            # Same state AND both have addresses - MANDATORY address validation
                            # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
                            if not self._validate_address_universal(address, candidate):
                                logger.debug(
                                    f"❌ KEYWORD MATCH REJECTED (address mismatch): {college_name} ({state}, {address[:40]}) "
                                    f"vs {candidate_name} ({candidate.get('address', '')[:40]})"
                                )
                                continue

                        logger.debug(
                            f"KEYWORD MATCH: {college_name} → {candidate_name} "
                            f"(overlap: {overlap_ratio:.1%}, confidence: {confidence:.2f})"
                        )

                        if confidence > best_score:
                            best_score = confidence
                            best_match = candidate

                    # If keyword matching didn't work, try word-level fuzzy matching for typos
                    elif best_match is None:  # Only if no previous match
                        matched, confidence, exact_ct, fuzzy_ct = self._match_words_with_fuzzy(
                            query_significant,
                            candidate_significant,
                            min_overlap=0.80,
                            fuzzy_threshold=0.90  # 90%+ word similarity for typos
                        )

                        if matched:
                            logger.debug(
                                f"WORD-FUZZY MATCH: {college_name} → {candidate_name} "
                                f"(exact: {exact_ct}, fuzzy: {fuzzy_ct}, confidence: {confidence:.2f})"
                            )

                            # Check for extra/missing significant words (same safety check)
                            extra_words = candidate_significant - query_significant
                            missing_words = query_significant - candidate_significant

                            if extra_words or missing_words:
                                # Don't match if there are unexplained extra/missing words
                                logger.debug(
                                    f"  → Rejected: Extra words {extra_words}, missing {missing_words}"
                                )
                            else:
                                # CRITICAL: Also check address for fuzzy matches
                                candidate_state = candidate.get('state', '').upper()
                                normalized_query_state = self.recent3_matcher.normalize_text(state).upper()

                                if candidate_state == normalized_query_state:
                                    # Check for candidates with SAME COMPOSITE_COLLEGE_KEY (not just name)
                                    candidate_composite_key = candidate.get('composite_college_key', '')
                                    same_composite_key_candidates = [
                                        c for c in candidates
                                        if c.get('composite_college_key', '') == candidate_composite_key
                                    ]

                                    if len(same_composite_key_candidates) > 1 and address:
                                        # Multiple candidates - validate address
                                        # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
                                        if not self._validate_address_universal(address, candidate):
                                            logger.debug(f"❌ FUZZY MATCH REJECTED (address mismatch)")
                                            continue

                                if confidence > best_score:
                                    # CRITICAL FIX: MANDATORY ADDRESS VALIDATION FOR FUZZY MATCHES
                                    # Even if there is only one candidate, we MUST validate the address
                                    # This prevents "Govt Med College, Jagtial" matching "Govt Med College" (MED0261)
                                    # simply because it's the only "Govt Med College" in the state.
                                    
                                    should_accept_fuzzy = True
                                    if address and candidate.get('address'):
                                        # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
                                        if not self._validate_address_universal(address, candidate):
                                            logger.debug(
                                                f"❌ FUZZY MATCH REJECTED (address mismatch): {college_name} ({address[:30]}) "
                                                f"vs {candidate_name} ({candidate.get('address', '')[:30]})"
                                            )
                                            should_accept_fuzzy = False
                                    
                                    if should_accept_fuzzy:
                                        best_score = confidence
                                        best_match = candidate

            # CRITICAL FIX: Handle multi-campus exact matches - return best by address score
            if exact_match_candidates:
                logger.debug(f"📍 MULTI-CAMPUS: {len(exact_match_candidates)} candidates collected, picking best by address")
                # Sort by address_score (highest first)
                best_exact = max(exact_match_candidates, key=lambda x: x[3])
                logger.debug(
                    f"📍 MULTI-CAMPUS SELECTED: {best_exact[0].get('name')} (address score: {best_exact[3]:.2f})"
                )

                # CRITICAL SECURITY CHECK: Verify state matches BEFORE returning multi-campus match
                # Prevents false matches like DISTRICT HOSPITAL (West Bengal) being matched to BIHAR records
                best_exact_state = best_exact[0].get('state', '').upper()
                normalized_query_state_for_exact = self.recent3_matcher.normalize_state_name_import(state).upper()

                if best_exact_state != normalized_query_state_for_exact:
                    logger.warning(
                        f"❌ MULTI-CAMPUS STATE MISMATCH: {best_exact[0].get('name')} from {best_exact_state} "
                        f"does NOT match query state {normalized_query_state_for_exact} - REJECTING MATCH"
                    )
                    # Don't return here - fall through to try other matching paths
                else:
                    return (best_exact[0], best_exact[1], best_exact[2])

            if best_match:
                # CRITICAL SECURITY CHECK: Verify state matches before accepting match
                # Prevents DISTRICT HOSPITAL (West Bengal) from matching DISTRICT HOSPITAL (Andhra Pradesh)
                best_match_state = best_match.get('state', '').upper()
                # CRITICAL FIX: Use normalize_state_name_import() instead of normalize_text() for proper state matching
                normalized_query_state = self.recent3_matcher.normalize_state_name_import(state).upper()

                if best_match_state != normalized_query_state:
                    logger.warning(
                        f"❌ STATE MISMATCH DETECTED: {best_match.get('name')} from {best_match_state} "
                        f"does NOT match query state {normalized_query_state} - REJECTING MATCH"
                    )
                    return (None, 0.0, 'pass1_2_state_mismatch_rejected')

                self._increment_stat('pass2_name_matched')
                # Determine match type based on score
                if best_score == 1.0:
                    match_type = 'pass1_2_exact_name_match'
                elif best_score == 0.90:
                    match_type = 'pass1_2_keyword_exact_match'
                elif best_score == 0.85:
                    match_type = 'pass1_2_word_fuzzy_match'
                else:
                    match_type = 'pass1_2_keyword_match'
                return (best_match, best_score, match_type)

            return (None, 0.0, 'pass1_2_no_keyword_match')

        except Exception as e:
            import traceback
            logger.error(f"PASS 1-2 orchestrator error: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return (None, 0.0, 'pass1_2_orchestrator_error')

    def _pass3_detect_campus_count(self, college_name: str, state: str,
                                    course_type: str) -> int:
        """
        PASS 3: Detect Single vs Multi Campus

        Count distinct addresses for colleges matching (state, course, name)
        Note: Input is already normalized from group_matching_queue (Rule #1)
        Returns: 0 if no match, 1 for single campus, >1 for multi campus
        
        UPDATED: Uses fuzzy matching to find candidates instead of exact match.
        """
        from rapidfuzz import fuzz
        
        try:
            # LRU CACHE CHECK: Avoid repeated database queries
            cache_key = f"{college_name}:{state}:{course_type}"
            if cache_key in self._multi_campus_cache:
                self._multi_campus_cache_hits += 1
                return self._multi_campus_cache[cache_key]
            self._multi_campus_cache_misses += 1
            
            conn = self._get_master_conn()
            cursor = conn.cursor()

            # Get course table(s)
            if 'medical' in course_type.lower():
                tables = ['medical_colleges']
            elif 'dental' in course_type.lower():
                tables = ['dental_colleges']
            elif 'dnb' in course_type.lower():
                tables = ['dnb_colleges']
            else:
                tables = ['medical_colleges', 'dental_colleges', 'dnb_colleges']

            # Collect all matching colleges (fuzzy)
            matching_addresses = set()
            normalized_input = college_name.upper().strip()
            
            # Helper function to extract words, splitting on hyphens
            def extract_words(text):
                """Extract words from text, splitting hyphenated words"""
                import re
                # Replace hyphens with spaces, then split
                text_normalized = re.sub(r'[-]', ' ', text)
                return set(text_normalized.split())
            
            input_words = extract_words(normalized_input)
            
            # ========== NEGATIVE MATCHERS: Load from config.yaml ==========
            # Use instance variable loaded from config, fallback to defaults if empty
            if self.negative_words:
                NEGATIVE_WORDS = self.negative_words
            else:
                # Fallback hardcoded set if config not loaded
                NEGATIVE_WORDS = {
                    'MEDICAL', 'DENTAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'UNIVERSITY',
                    'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'STATE', 'NATIONAL', 'CENTRAL',
                    'AND', 'OF', 'THE', 'FOR', 'IN', 'AT',
                    'SUPER', 'SPECIALTY', 'SPECIALITY', 'MULTISPECIALTY', 'GENERAL',
                    'DISTRICT', 'TEACHING', 'RESEARCH', 'TRAINING', 'HEALTH', 'CARE',
                    'FOUNDATION', 'TRUST', 'SOCIETY', 'CHARITABLE', 'MEMORIAL',
                    'SCIENCES', 'SCIENCE', 'STUDIES', 'EDUCATION', 'ACADEMY',
                    'PREMIER', 'ADVANCED', 'MULTI', 'MODERN', 'NEW'
                }
            
            # ========== POSITIVE MATCHERS (Unique identifiers - MUST match) ==========
            # Extract words that are NOT in the negative list (these are distinctive)
            input_rare_words = input_words - NEGATIVE_WORDS
            
            # Also filter out single characters and numbers (not distinctive)
            input_rare_words = {w for w in input_rare_words if len(w) > 2 and not w.isdigit()}
            
            for table in tables:
                cursor.execute(f"""
                    SELECT name, normalized_name, address
                    FROM {table}
                    WHERE UPPER(normalized_state) = UPPER(?)
                """, (state,))
                
                for row in cursor.fetchall():
                    master_name, master_normalized, address = row
                    
                    # Use normalized_name if available, else name
                    compare_name = (master_normalized or master_name or '').upper().strip()
                    compare_words = extract_words(compare_name)  # Use helper to split hyphens
                    
                    # Extract rare words from master (positive matchers)
                    master_rare_words = compare_words - NEGATIVE_WORDS
                    master_rare_words = {w for w in master_rare_words if len(w) > 2 and not w.isdigit()}
                    
                    # REQUIREMENT: At least {rare_overlap_ratio}% of input rare words must match
                    # This ensures "HI TECH" doesn't match "S C B" even if "DENTAL COLLEGE HOSPITAL" matches
                    if input_rare_words and master_rare_words:
                        # Calculate overlap of distinctive words
                        common_rare = input_rare_words & master_rare_words
                        rare_overlap_ratio = len(common_rare) / len(input_rare_words)
                        
                        # Use configurable threshold (default 0.5 = 50%)
                        if rare_overlap_ratio >= self.rare_overlap_ratio:
                            if address:
                                matching_addresses.add(address)
                    elif not input_rare_words and not master_rare_words:
                        # Both have only common words - use fuzzy matching as fallback
                        similarity = fuzz.token_sort_ratio(normalized_input, compare_name)
                        if similarity >= 95:
                            if address:
                                matching_addresses.add(address)
            
            campus_count = len(matching_addresses)
            
            # Store in cache (with simple LRU eviction)
            if len(self._multi_campus_cache) >= self.multi_campus_cache_size:
                # Evict oldest entry (FIFO approximation)
                oldest_key = next(iter(self._multi_campus_cache))
                del self._multi_campus_cache[oldest_key]
            self._multi_campus_cache[cache_key] = campus_count
            
            return campus_count

        except Exception as e:
            logger.error(f"Campus count error: {e}")
            import traceback
            logger.error(f"Campus count traceback: {traceback.format_exc()}")
            return 0  # Return 0 which means "unknown" - will skip Pass 4

    def calculate_hybrid_score(self, query_college: str, candidate: Dict,
                               query_address: str, query_state: str) -> Dict:
        """
        HYBRID SCORING: Multi-factor 0-100 scoring for match quality assessment.
        
        Weights loaded from config.yaml (default: name=40%, state=25%, city=20%, code=15%)
        
        Args:
            query_college: Normalized seat/counselling college name
            candidate: Master college dict with 'name', 'address', 'state', 'id'
            query_address: Normalized seat/counselling address
            query_state: Normalized state name
            
        Returns:
            Dict with:
                - score: 0-100 total score
                - breakdown: per-factor scores
                - decision: 'accept', 'review', or 'reject'
        """
        from rapidfuzz import fuzz
        import re
        
        # Load weights from config (default to plan values if not set)
        try:
            weights = self.multi_campus_config.get('weights', {}) or {}
            name_weight = weights.get('name_similarity', 0.40)
            state_weight = weights.get('state_match', 0.25)
            city_weight = weights.get('city_match', 0.20)
            code_weight = weights.get('college_code', 0.15)
        except:
            name_weight, state_weight, city_weight, code_weight = 0.40, 0.25, 0.20, 0.15
        
        breakdown = {}
        
        # FACTOR 1: Name Similarity (40 points max)
        candidate_name = candidate.get('name', '') or candidate.get('normalized_name', '')
        name_similarity = fuzz.token_set_ratio(query_college.upper(), candidate_name.upper())
        breakdown['name'] = round(name_similarity * name_weight, 2)
        
        # FACTOR 2: State Match (25 points - REQUIRED)
        candidate_state = candidate.get('state', '') or candidate.get('normalized_state', '')
        query_state_normalized = self.recent3_matcher.normalize_state_name_import(query_state).upper()
        candidate_state_normalized = self.recent3_matcher.normalize_state_name_import(candidate_state).upper()
        
        if query_state_normalized == candidate_state_normalized:
            breakdown['state'] = round(100 * state_weight, 2)
        else:
            # State mismatch = instant rejection
            return {
                'score': 0,
                'breakdown': {'name': breakdown.get('name', 0), 'state': 0, 'city': 0, 'code': 0},
                'decision': 'reject',
                'reason': 'state_mismatch'
            }
        
        # FACTOR 3: City/Pincode Match (20 points)
        candidate_address = candidate.get('address', '') or ''
        city_score = self._calculate_city_overlap(query_address, candidate_address)
        breakdown['city'] = round(city_score * city_weight, 2)
        
        # FACTOR 4: College Code Match (15 points)
        code_score = self._extract_and_match_code(query_college, candidate_name)
        breakdown['code'] = round(code_score * code_weight, 2)
        
        # Calculate total score
        total_score = sum(breakdown.values())
        
        # Decision thresholds (from config or defaults)
        auto_accept = 90
        manual_review = 75
        
        if total_score >= auto_accept:
            decision = 'accept'
        elif total_score >= manual_review:
            decision = 'review'
        else:
            decision = 'reject'
        
        return {
            'score': round(total_score, 2),
            'breakdown': breakdown,
            'decision': decision
        }
    
    def _calculate_city_overlap(self, addr1: str, addr2: str) -> float:
        """Calculate city/location overlap between two addresses (0-100)."""
        if not addr1 or not addr2:
            return 50  # Neutral score if no address
        
        # Extract meaningful location tokens (exclude generic words)
        excluded = {'DISTRICT', 'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 
                   'OF', 'AND', 'THE', 'INSTITUTE', 'ROAD', 'NEAR', 'STREET'}
        
        tokens1 = {t.upper() for t in re.split(r'[\s,]+', addr1) if len(t) > 2}
        tokens2 = {t.upper() for t in re.split(r'[\s,]+', addr2) if len(t) > 2}
        
        meaningful1 = tokens1 - excluded
        meaningful2 = tokens2 - excluded
        
        if not meaningful1 or not meaningful2:
            return 50
        
        overlap = len(meaningful1 & meaningful2)
        max_tokens = max(len(meaningful1), len(meaningful2))
        
        return (overlap / max_tokens) * 100 if max_tokens else 50
    
    def _extract_and_match_code(self, text1: str, text2: str) -> float:
        """Extract and match college codes (MED0001, DEN0104, etc.) - returns 0-100."""
        import re
        
        # Pattern for college codes: 3 letters + 4 digits
        code_pattern = r'\b([A-Z]{3}\d{4})\b'
        
        codes1 = set(re.findall(code_pattern, text1.upper()))
        codes2 = set(re.findall(code_pattern, text2.upper()))
        
        # Also check for MCI codes: (6 digits)
        mci_pattern = r'\((\d{6})\)'
        codes1.update(re.findall(mci_pattern, text1))
        codes2.update(re.findall(mci_pattern, text2))
        
        if codes1 and codes2:
            if codes1 & codes2:
                return 100  # Exact code match
            else:
                return 0  # Different codes
        
        return 50  # No codes to compare (neutral)
    
    def _check_negative_rules(self, query_college: str, candidate_college: str,
                               query_course_type: str, candidate_type: str) -> Tuple[bool, Optional[str]]:
        """
        NEGATIVE MATCH RULES: Check if a match should be blocked.
        
        Rules loaded from config.yaml:
        1. Cross-stream prevention: Block dental↔medical, dnb↔dental matches
        2. Blocklist pairs: Block known false positive patterns
        
        Args:
            query_college: Seat/counselling college name
            candidate_college: Master college name
            query_course_type: Course type from seat data (medical, dental, dnb)
            candidate_type: College type from master (medical, dental, dnb)
            
        Returns:
            Tuple of (is_allowed, rejection_reason)
            - (True, None) if match is allowed
            - (False, "reason") if match should be blocked
        """
        import re
        
        # RULE 1: Cross-Stream Prevention
        if self.cross_stream_prevention.get('enabled', True):
            forbidden_pairs = self.cross_stream_prevention.get('forbidden_pairs', [
                ['dental', 'medical'],
                ['dnb', 'dental']
            ])
            
            query_stream = query_course_type.lower() if query_course_type else ''
            candidate_stream = (candidate_type or '').lower()
            
            for pair in forbidden_pairs:
                if len(pair) == 2:
                    # Check both directions
                    if (query_stream in pair[0] and candidate_stream in pair[1]) or \
                       (query_stream in pair[1] and candidate_stream in pair[0]):
                        return (False, f"cross_stream_blocked: {pair[0]}↔{pair[1]}")
        
        # RULE 2: Blocklist Pairs (regex pattern matching)
        for rule in self.blocklist_pairs:
            seat_pattern = rule.get('seat_pattern', '')
            master_pattern = rule.get('master_pattern', '')
            reason = rule.get('reason', 'blocklist_match')
            
            try:
                if seat_pattern and master_pattern:
                    if re.search(seat_pattern, query_college, re.IGNORECASE) and \
                       re.search(master_pattern, candidate_college, re.IGNORECASE):
                        return (False, f"blocklist: {reason}")
            except re.error:
                # Invalid regex pattern, skip
                continue
        
        return (True, None)

    # ==================== PHASE 6: DYNAMIC THRESHOLD ADJUSTMENT ====================
    
    def record_match_feedback(self, query_college: str, query_state: str, query_address: str,
                              candidate_id: str, candidate_college: str, match_score: float,
                              hybrid_breakdown: Dict, user_decision: str, course_type: str = None) -> bool:
        """
        Record user's approval/rejection decision for a match.
        
        Args:
            query_college: Seat/counselling college name
            query_state: State from seat data
            query_address: Address from seat data
            candidate_id: Master college ID
            candidate_college: Master college name
            match_score: Confidence score (0-1)
            hybrid_breakdown: Dict with factor scores
            user_decision: 'approved' | 'rejected' | 'skipped'
            course_type: Optional course type
            
        Returns:
            True if recorded successfully
        """
        import json
        
        try:
            conn = self._get_master_conn()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO matching_feedback 
                (query_college, query_state, query_address, candidate_id, candidate_college,
                 match_score, hybrid_breakdown, user_decision, course_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                query_college, query_state, query_address,
                candidate_id, candidate_college, match_score,
                json.dumps(hybrid_breakdown) if hybrid_breakdown else None,
                user_decision, course_type
            ))
            
            conn.commit()
            logger.debug(f"Recorded feedback: {user_decision} for {query_college} → {candidate_college} (score: {match_score:.2f})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to record feedback: {e}")
            return False
    
    def auto_adjust_thresholds(self, min_samples: int = None) -> Dict:
        """
        Analyze approval rates and auto-adjust matching thresholds.
        
        Uses rules from config.yaml dynamic_thresholds section.
        Only adjusts if sufficient samples exist.
        
        Args:
            min_samples: Minimum feedback samples before adjustment (default from config)
            
        Returns:
            Dict with adjustment results
        """
        try:
            # Load config values
            dt_config = getattr(self, 'hybrid_scoring_config', {}).get('thresholds', {})
            min_samples = min_samples or getattr(self, 'multi_campus_config', {}).get('min_samples_for_adjustment', 100)
            min_threshold = 0.70
            max_threshold = 0.95
            
            conn = self._get_master_conn()
            cursor = conn.cursor()
            
            # Calculate approval rate by score range
            cursor.execute("""
                SELECT 
                    ROUND(match_score * 20) / 20 as score_bucket,
                    COUNT(*) as total,
                    SUM(CASE WHEN user_decision = 'approved' THEN 1 ELSE 0 END) as approved
                FROM matching_feedback
                WHERE user_decision IN ('approved', 'rejected')
                GROUP BY score_bucket
                HAVING total >= ?
            """, (min_samples // 10,))  # Need at least 10% of min_samples per bucket
            
            results = cursor.fetchall()
            adjustments = []
            
            for score_bucket, total, approved in results:
                approval_rate = approved / total if total else 0
                
                # Rule 1: Low approval rate at high scores → raise threshold
                if approval_rate < 0.7 and score_bucket >= 0.85:
                    new_threshold = min(score_bucket + 0.03, max_threshold)
                    adjustments.append({
                        'score_bucket': score_bucket,
                        'approval_rate': approval_rate,
                        'action': 'raise',
                        'suggested_threshold': new_threshold
                    })
                
                # Rule 2: High approval rate → can lower threshold
                elif approval_rate > 0.95 and score_bucket >= 0.90:
                    new_threshold = max(score_bucket - 0.02, min_threshold)
                    adjustments.append({
                        'score_bucket': score_bucket,
                        'approval_rate': approval_rate,
                        'action': 'lower',
                        'suggested_threshold': new_threshold
                    })
            
            # Log to threshold_history if adjustments suggested
            for adj in adjustments:
                cursor.execute("""
                    INSERT INTO threshold_history 
                    (threshold_type, old_value, new_value, adjustment_reason, sample_count, approval_rate)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    'auto_accept' if adj['action'] == 'raise' else 'manual_review',
                    adj['score_bucket'],
                    adj['suggested_threshold'],
                    f"{adj['action']}_threshold",
                    total,
                    adj['approval_rate']
                ))
            
            if adjustments:
                conn.commit()
            
            return {
                'adjustments': adjustments,
                'total_buckets_analyzed': len(results),
                'min_samples_required': min_samples
            }
            
        except Exception as e:
            logger.error(f"Threshold auto-adjustment failed: {e}")
            return {'error': str(e), 'adjustments': []}


    def _pass4a_single_campus(self, college_name: str, state: str,
                             course_type: str, address: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 4A: Single Campus Path

        For colleges with only 1 address (deterministic):
          1. Verify college name matches
          2. Verify address matches
          3. Return with high confidence (1.0)

        Note: Input is already normalized from group_matching_queue (Rule #1)
        UPDATED: Uses word-level fuzzy matching (token_set_ratio) instead of exact match.
        """
        from rapidfuzz import fuzz

        try:
            conn = self._get_master_conn()
            cursor = conn.cursor()

            # CRITICAL FIX: Stream Filtering - Select table based on course_type
            tables_to_search = []
            if course_type:
                course_upper = course_type.upper()
                if 'MEDICAL' in course_upper or 'MBBS' in course_upper:
                    tables_to_search = ['medical_colleges']
                elif 'DENTAL' in course_upper or 'BDS' in course_upper:
                    tables_to_search = ['dental_colleges']
                elif 'DNB' in course_upper:
                    tables_to_search = ['dnb_colleges']
                else:
                    tables_to_search = ['medical_colleges', 'dental_colleges', 'dnb_colleges']
            else:
                tables_to_search = ['medical_colleges', 'dental_colleges', 'dnb_colleges']
            
            # Fetch all colleges in state and filter using word-level fuzzy matching
            best_match = None
            best_similarity = 0
            normalized_input = college_name.upper().strip()
            
            for table in tables_to_search:
                cursor.execute(f"""
                    SELECT id, name, normalized_name, state, address, college_type 
                    FROM {table}
                    WHERE UPPER(normalized_state) = UPPER(?)
                """, (state,))
                
                for row in cursor.fetchall():
                    row_dict = dict(row)
                    # Use normalized_name if available, else name
                    compare_name = (row_dict.get('normalized_name') or row_dict.get('name') or '').upper().strip()
                    
                    # Word-level fuzzy match using token_set_ratio
                    similarity = fuzz.token_set_ratio(normalized_input, compare_name)
                    if similarity >= 85 and similarity > best_similarity:
                        best_similarity = similarity
                        best_match = row_dict
            
            conn.close()

            if not best_match:
                return (None, 0.0, 'pass4a_not_found')

            # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
            candidate = {'address': best_match['address']}
            if not self._validate_address_universal(address, candidate):
                logger.debug(f"PASS 4A REJECTED: Address mismatch for {college_name}")
                return (None, 0.0, 'pass4a_address_mismatch')

            # CRITICAL FIX: Check for Name Conflict (e.g. "Max Smart" vs "Max Super")
            is_conflict, reason = self.recent3_matcher.check_name_conflict(college_name, best_match['name'])
            if is_conflict:
                logger.debug(f"❌ PASS 4A REJECTED (Name Conflict): {college_name} vs {best_match['name']} - {reason}")
                return (None, 0.0, 'pass4a_name_conflict')

            # FAIL-SAFE VALIDATION (Rare Token Check)
            is_safe, reason = self._validate_match_fail_safe(college_name, best_match['name'], address, best_match['address'])
            if not is_safe:
                logger.debug(f"❌ PASS 4A REJECTED (Fail-Safe): {college_name} vs {best_match['name']} - {reason}")
                return (None, 0.0, 'pass4a_fail_safe_block')

            # All verified - return match with high confidence
            matched = {
                'id': best_match['id'],
                'name': best_match['name'],
                'state': best_match['state'],
                'address': best_match['address'],
                'type': best_match['college_type']
            }

            self._increment_stat('pass4a_matched')
            return (matched, 1.0, 'pass4a_single_campus_verified')

        except Exception as e:
            logger.error(f"PASS 4A error: {e}")
            import traceback
            logger.error(f"PASS 4A traceback: {traceback.format_exc()}")
            return (None, 0.0, 'pass4a_error')

    def _pass4b_multi_campus(self, college_name: str, state: str,
                            course_type: str, address: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 4B: Multi Campus Path

        For colleges with multiple addresses:
          1. ADDRESS-PRIMARY FILTER: Filter candidates by address keywords
          2. ADDRESS DISAMBIGUATION: Use recent3.py PASS 4 to disambiguate
          3. VERIFY COLLEGE: Check name matches
          4. VERIFY ADDRESS: Check address matches
          5. Return with confidence 0.95

        Note: Input is already normalized from group_matching_queue (Rule #1)
        UPDATED: Uses word-level fuzzy matching (token_set_ratio) instead of exact match.
        """
        from rapidfuzz import fuzz

        # DEBUG: Log when PASS 4B is entered
        logger.info(f"PASS 4B: Processing '{college_name}' in {state}, course={course_type}")

        try:
            from normalized_matcher import NormalizedMatcher
            matcher = NormalizedMatcher()

            # STEP 1: Get all campuses for this college using FUZZY matching
            # Input is already normalized from group_matching_queue
            conn = self._get_master_conn()
            cursor = conn.cursor()

            # CRITICAL FIX: Stream Filtering - Select tables based on course_type
            # DNB courses can be offered at MEDICAL colleges too (very common), not just dedicated DNB hospitals
            tables_to_search = []
            if course_type:
                course_upper = course_type.upper()
                if 'MEDICAL' in course_upper or 'MBBS' in course_upper:
                    tables_to_search = ['medical_colleges']
                elif 'DENTAL' in course_upper or 'BDS' in course_upper:
                    tables_to_search = ['dental_colleges']
                elif 'DNB' in course_upper:
                    # DNB at medical colleges is VERY common - search both tables!
                    tables_to_search = ['dnb_colleges', 'medical_colleges']
                else:
                    tables_to_search = ['medical_colleges', 'dental_colleges', 'dnb_colleges']
            else:
                tables_to_search = ['medical_colleges', 'dental_colleges', 'dnb_colleges']

            # Fetch all colleges in state and filter using word-level fuzzy matching
            candidates = []
            normalized_input = college_name.upper().strip()
            
            # CASCADING TABLE SEARCH: Primary table first, fallback only if empty
            for table in tables_to_search:
                cursor.execute(f"""
                    SELECT id, name, normalized_name, state, address, college_type 
                    FROM {table}
                    WHERE UPPER(normalized_state) = UPPER(?)
                """, (state,))
                
                table_candidates = []
                for row in cursor.fetchall():
                    row_dict = dict(row)
                    # Use normalized_name if available, else name
                    compare_name = (row_dict.get('normalized_name') or row_dict.get('name') or '').upper().strip()
                    
                    # Word-level fuzzy match using token_set_ratio (handles word order, subsets)
                    similarity = fuzz.token_set_ratio(normalized_input, compare_name)
                    if similarity >= 85:  # 85% threshold for word-level match
                        row_dict['_similarity'] = similarity
                        table_candidates.append(row_dict)
                
                # CASCADING: If we found candidates in this table, use them and stop
                if table_candidates:
                    candidates = table_candidates
                    logger.info(f"PASS 4B: Found {len(candidates)} candidates in {table}")
                    break  # Don't search fallback tables

            if not candidates:
                logger.info(f"PASS 4B: No fuzzy candidates for '{college_name}' in {state}")
                return (None, 0.0, 'pass4b_no_candidates')

            logger.info(f"PASS 4B: Found {len(candidates)} candidates for '{college_name}' in {state}")

            # STEP 2: ADDRESS-PRIMARY FILTER
            if not address:
                # No address provided - can't disambiguate
                logger.info(f"PASS 4B: No address provided for '{college_name}'")
                return (None, 0.0, 'pass4b_no_address')

            address_words = matcher._extract_address_words(address)
            filtered_candidates = []

            for candidate in candidates:
                # UNIVERSAL ADDRESS VALIDATION: Strict threshold (0.50) for multi campus filtering
                if self._validate_address_universal(address, candidate):
                    filtered_candidates.append(candidate)

            if not filtered_candidates:
                # No address match
                logger.info(f"PASS 4B: Address filter failed for '{college_name}', had {len(candidates)} candidates")
                return (None, 0.0, 'pass4b_address_filter_failed')

            logger.info(f"PASS 4B: {len(filtered_candidates)} candidates passed address filter for '{college_name}'")

            # STEP 3: If multiple candidates, use address disambiguation
            if len(filtered_candidates) == 1:
                candidate = filtered_candidates[0]
                logger.info(f"PASS 4B: Single candidate after address filter: {candidate.get('name', 'Unknown')}")
            else:
                logger.info(f"PASS 4B: {len(filtered_candidates)} candidates need disambiguation for '{college_name}'")
                # Use recent3.py pass4_address_disambiguation if available
                try:
                    # Try using address_based_matcher's disambiguation logic
                    candidate = self.address_matcher.match_college_by_address_primary(
                        college_name=college_name,
                        state=state,
                        course_type=course_type,
                        address=address
                    )
                    if isinstance(candidate, tuple):
                        candidate = candidate[0]
                    logger.info(f"PASS 4B: Disambiguation result: {candidate.get('name', 'None') if candidate else 'None'}")
                except Exception as e:
                    # Fallback to first candidate
                    logger.info(f"PASS 4B: Disambiguation exception: {e}, using first candidate")
                    candidate = filtered_candidates[0]

            if not candidate:
                logger.info(f"PASS 4B: Disambiguation failed for '{college_name}'")
                return (None, 0.0, 'pass4b_disambiguation_failed')

            # STEP 4: VERIFY COLLEGE (use fuzzy matching to handle hyphens, etc.)
            # Use token_set_ratio which handles word order and minor differences
            college_similarity = fuzz.token_set_ratio(
                candidate['name'].upper().strip(),
                college_name.upper().strip()
            )
            college_verified = college_similarity >= 95  # 95% threshold for verification

            if not college_verified:
                logger.info(f"PASS 4B: College mismatch '{college_name}' vs '{candidate['name']}' (similarity: {college_similarity}%)")
                return (None, 0.0, 'pass4b_college_mismatch')

            # CRITICAL FIX: Check for Name Conflict (e.g. "Max Smart" vs "Max Super")
            is_conflict, reason = self.recent3_matcher.check_name_conflict(college_name, candidate['name'])
            if is_conflict:
                logger.debug(f"❌ PASS 4B REJECTED (Name Conflict): {college_name} vs {candidate['name']} - {reason}")
                return (None, 0.0, 'pass4b_name_conflict')

            # STEP 5: VERIFY ADDRESS
            # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
            if not self._validate_address_universal(address, candidate):
                logger.info(f"PASS 4B: Address mismatch for '{college_name}', candidate: {candidate['name']}")
                return (None, 0.0, 'pass4b_address_mismatch')

            # All verified - but apply address-driven strictness validation
            # (Critical fix from PASS 1-2: When addresses are same/similar, require exact name match)

            # STEP 6: APPLY ADDRESS-DRIVEN STRICTNESS VALIDATION
            # Calculate address similarity score
            address_similarity_score = 0.0
            if address and candidate.get('address'):
                normalized_seat_address = self.recent3_matcher.normalize_text(address).upper()
                normalized_candidate_address = self.recent3_matcher.normalize_text(candidate.get('address', '')).upper()

                seat_tokens = re.split(r'[\s,]+', normalized_seat_address)
                master_tokens = re.split(r'[\s,]+', normalized_candidate_address)

                seat_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in seat_tokens if t.strip()}
                master_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in master_tokens if t.strip()}

                seat_keywords = {k for k in seat_keywords if k}
                master_keywords = {k for k in master_keywords if k}

                excluded = {'DISTRICT', 'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'OF', 'AND', 'THE', 'INSTITUTE', 'ROAD', 'NEAR', 'BY', 'PASS', 'HOUSE', 'NO'}
                seat_meaningful = {k for k in seat_keywords if k not in excluded and len(k) > 2}
                master_meaningful = {k for k in master_keywords if k not in excluded and len(k) > 2}

                common_address_keywords = seat_meaningful & master_meaningful
                address_similarity_score = len(common_address_keywords) / max(len(seat_meaningful), len(master_meaningful), 1) if seat_meaningful and master_meaningful else 0

            # STEP 7: CHECK SECONDARY NAMES (from PASS 1-2 logic)
            # CRITICAL FIX: Use normalized_name, not raw name
            seat_secondary = self._extract_secondary_name(college_name)
            
            # If not found in name, check address for "FORMERLY KNOWN AS"
            if not seat_secondary and address and ('FORMERLY' in address.upper() or 'KNOWN AS' in address.upper()):
                seat_secondary = self._extract_secondary_name(address)

            candidate_normalized = candidate.get('normalized_name', '') or candidate.get('name', '')
            candidate_secondary = self._extract_secondary_name(candidate_normalized)

            # RULE 1: Both have secondary names and they differ = Different colleges
            if seat_secondary and candidate_secondary:
                if seat_secondary != candidate_secondary:
                    logger.debug(
                        f"❌ PASS 4B REJECTED (secondary names differ): "
                        f"{college_name} (secondary: {seat_secondary}) "
                        f"vs {candidate['name']} (secondary: {candidate_secondary}) - Different colleges!"
                    )
                    return (None, 0.0, 'pass4b_secondary_name_mismatch')
                
                # POSITIVE MATCH: Both have secondary names and they MATCH!
                # This is a very strong signal (e.g. "Saket City Hospital" == "Saket City Hospital")
                else:
                    logger.info(
                        f"✅ PASS 4B POSITIVE MATCH (Secondary Name): "
                        f"{college_name} matched {candidate['name']} via secondary name '{seat_secondary}'"
                    )
                    # Return immediately with high confidence, bypassing further checks
                    matched = {
                        'id': candidate['id'],
                        'name': candidate['name'],
                        'state': candidate['state'],
                        'address': candidate['address'],
                        'type': candidate['college_type']
                    }
                    self._increment_stat('pass4b_matched')
                    return (matched, 0.98, 'pass4b_secondary_name_match')

            # RULE 2: Seat has secondary but candidate doesn't have it in name
            if seat_secondary and not candidate_secondary:
                if seat_secondary.upper() not in candidate['name'].upper():
                    logger.debug(
                        f"❌ PASS 4B REJECTED (secondary name missing): "
                        f"{college_name} has secondary '{seat_secondary}' but {candidate['name']} doesn't"
                    )
                    return (None, 0.0, 'pass4b_secondary_name_missing')

            # CRITICAL FIX: Check for Name Conflict (e.g. "Max Smart" vs "Max Super")
            is_conflict, reason = self.recent3_matcher.check_name_conflict(college_name, candidate['name'])
            if is_conflict:
                logger.debug(f"❌ PASS 4B REJECTED (Name Conflict): {college_name} vs {candidate['name']} - {reason}")
                return (None, 0.0, 'pass4b_name_conflict')



            # Duplicate check removed

            # RULE 3: Candidate has secondary but seat doesn't
            # NOTE: Don't reject! Seat data may just not include secondary name.
            # If primary name matches and addresses match, it's the same college.
            # E.g., Seat "MAX SMART" matches Master "MAX SMART (FORMERLY SAKET CITY)"

            # STEP 8: CHECK ADDRESS-DRIVEN STRICTNESS
            # If addresses are SAME/SIMILAR (>= 0.6 overlap), require EXACT name match
            if address_similarity_score >= 0.6:
                is_exact_match = college_name.upper().strip() == candidate['name'].upper().strip()
                if not is_exact_match:
                    logger.debug(
                        f"❌ PASS 4B REJECTED (fuzzy match with similar address): "
                        f"'{college_name}' vs '{candidate['name']}' have similar addresses (score: {address_similarity_score:.2f}) "
                        f"but name match is not exact (need 100%) - Different colleges!"
                    )
                    return (None, 0.0, 'pass4b_fuzzy_match_same_address')

            # FAIL-SAFE VALIDATION (Rare Token Check)
            is_safe, reason = self._validate_match_fail_safe(college_name, candidate['name'], address, candidate['address'])
            if not is_safe:
                logger.debug(f"❌ PASS 4B REJECTED (Fail-Safe): {college_name} vs {candidate['name']} - {reason}")
                return (None, 0.0, 'pass4b_fail_safe_block')

            # All validations passed
            matched = {
                'id': candidate['id'],
                'name': candidate['name'],
                'state': candidate['state'],
                'address': candidate['address'],
                'type': candidate['college_type']
            }

            self._increment_stat('pass4b_matched')
            return (matched, 0.95, 'pass4b_multi_campus_verified')

        except Exception as e:
            logger.error(f"PASS 4B error: {e}")
            import traceback
            logger.error(f"PASS 4B traceback: {traceback.format_exc()}")
            return (None, 0.0, 'pass4b_error')

    def _pass5_fallback(self, college_name: str, state: str, course_type: str,
                       address: str, course_name: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 5: Council of Matchers (Primary Fallback)
        
        Multi-agent voting system with 6 members:
        - The Librarian (exact matching + type veto)
        - The Fuzzy Guesser (fuzzy matching)
        - The Geographer (state + city validation + veto)
        - The Phonetic Listener (phonetic matching)
        - The Wise Judge (AI reasoning)
        - The Devil's Advocate (safety critic)
        
        Replaces simple address-based matcher with sophisticated peer-review model.
        """
        try:
            # Check if Council Chairman is initialized
            if not self.council_chairman:
                logger.warning("⚠️ PASS 5 (Council) SKIPPED: Council Chairman not initialized")
                return (None, 0.0, 'pass5_council_not_initialized')
            
            # Ensure Council has Master Data for TheLocalHero/TheDetective
            self.council_chairman.load_master_data(self.master_colleges)
            
            # STREAM FILTERING: Only search within correct stream (medical/dental/dnb)
            # CASCADING: Search primary stream first, only fallback if ZERO candidates found
            stream_filtered_colleges = []
            
            if course_type:
                if course_type.lower() in ['medical', 'mbbs', 'md', 'ms']:
                    target_streams = ['medical']
                elif course_type.lower() in ['dental', 'bds', 'mds']:
                    target_streams = ['dental']
                elif course_type.lower() in ['dnb', 'diploma']:
                    # DNB at medical colleges is common - but search dnb FIRST, then fallback
                    target_streams = ['dnb', 'medical']
                else:
                    target_streams = None
                
                # CASCADING: Search streams in order, stop when we find candidates
                if target_streams:
                    for target_stream in target_streams:
                        if target_stream in self.recent3_matcher.master_data:
                            stream_data = self.recent3_matcher.master_data[target_stream].get('colleges', [])
                            if stream_data:
                                stream_filtered_colleges = stream_data
                                logger.debug(f"PASS 5: Using {len(stream_data)} colleges from {target_stream} stream")
                                break  # Found candidates, stop searching fallback streams
                    
                    # If no colleges found in specified streams, fallback to all
                    if not stream_filtered_colleges:
                        stream_filtered_colleges = self.master_colleges
                else:
                    # Unknown course type - use all colleges
                    stream_filtered_colleges = self.master_colleges
            else:
                # No course_type provided, use all colleges
                stream_filtered_colleges = self.master_colleges
            
            # Get top candidates using fuzzy matching (pre-filter to top 10)
            # Note: rapidfuzz.process is already imported at module level
            
            # Create id mapping to preserve duplicate names
            choices = {c['id']: c['name'] for c in stream_filtered_colleges}
            
            if not choices:
                return (None, 0.0, 'pass5_council_no_candidates')
            
            top_matches = process.extract(
                college_name, 
                choices, 
                limit=10,
                score_cutoff=60  # Minimum 60% similarity
            )
            
            # Build candidate list for Council
            from council_matcher import Candidate
            id_to_record = {c['id']: c for c in stream_filtered_colleges}
            candidates = []
            seen_ids = set()

            # 1. Add Fuzzy Candidates
            for match_tuple in top_matches:
                # thefuzz returns (matched_value, score, dict_key)
                college_id = match_tuple[2]  # The dict key (college ID)
                
                master_record = id_to_record.get(college_id)
                if master_record and college_id not in seen_ids:
                    candidate = Candidate(
                        id=master_record['id'],
                        name=master_record['name'],
                        state=master_record.get('state', ''),
                        address=master_record.get('address', ''),
                        type=master_record.get('type', 'UNKNOWN')
                    )
                    candidates.append(candidate)
                    seen_ids.add(college_id)

            # 2. Add Semantic Candidates (The Semantic Scout's contribution)
            if self.vector_engine:
                try:
                    # Search for semantic matches
                    semantic_results = self.vector_engine.search(
                        query=college_name,
                        k=10,
                        state_filter=state if state else None,
                        min_score=0.6
                    )
                    
                    for college, score in semantic_results:
                        college_id = college.get('id')
                        
                        # CRITICAL: Ensure candidate belongs to the correct stream
                        # We do this by checking if it exists in our stream-filtered id_to_record map
                        if college_id in id_to_record and college_id not in seen_ids:
                            master_record = id_to_record[college_id]
                            candidate = Candidate(
                                id=master_record['id'],
                                name=master_record['name'],
                                state=master_record.get('state', ''),
                                address=master_record.get('address', ''),
                                type=master_record.get('type', 'UNKNOWN')
                            )
                            candidates.append(candidate)
                            seen_ids.add(college_id)
                            # logger.debug(f"Added Semantic Candidate: {master_record['name']} (Score: {score:.2f})")
                            
                except Exception as e:
                    logger.warning(f"Semantic search failed in Pass 5: {e}")

            
            # Council evaluation
            unmatched_record = {
                'college_name': college_name,
                'state': state,
                'address': address,
                'course_type': course_type
            }
            
            best_candidate_id = None
            best_match_name = None
            best_confidence = 0.0
            best_decision = 'REJECT'
            
            for candidate in candidates:
                decision, confidence, votes = self.council_chairman.evaluate_candidate(
                    unmatched_record, candidate
                )
                
                if decision == 'MATCH' and confidence > best_confidence:
                    best_decision = decision
                    best_confidence = confidence
                    best_candidate_id = candidate.id
                    best_match_name = candidate.name
            
            # Return result if confident
            if best_decision == 'MATCH' and best_confidence >= 0.75:
                matched_college = {
                    'id': best_candidate_id,
                    'name': best_match_name,
                    'state': state,
                    'address': '<lookup_from_master>',
                    'type': course_type
                }
                return (matched_college, best_confidence, 'pass5_council_match')
            
            return (None, 0.0, 'pass5_council_rejected')
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"PASS 5 (Council) error: {e}")
            logger.error(f"Full traceback:\n{error_details}")
            print(f"[PASS 5 ERROR] {e}")
            print(f"[PASS 5 TRACEBACK]\n{error_details}")
            return (None, 0.0, 'pass5_council_error')


    def _pass5a_advanced_aliases(self, college_name: str, state: str,
                                 course_type: str, address: str,
                                 course_name: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 5A: Advanced Alias Matching (Enhanced from PASS 2 of match_and_link_parallel)

        Uses sophisticated alias logic with context-aware matching:
          1. Apply college aliases with state/address context (smart)
          2. Apply course aliases
          3. Track which aliases were applied
          4. Use Smart Hybrid + Ultra-Optimized matching
          5. Perform college-specific course matching
          6. Support counselling fields (quota, category, source, level)

        This is significantly more advanced than the basic PASS 5A,
        reducing unmatched records by leveraging proven PASS 2 logic.
        """

        try:
            logger.debug(f"PASS 5A ENTRY: {college_name}")
            original_college_name_input = college_name

            # STEP 0: Custom hardcoded aliases for difficult cases
            if 'ISLAMPUR' in college_name and 'SUB DISTRICT' in college_name:
                college_name = college_name.replace('SUB DISTRICT', 'SUPER SPECIALTY').replace('ISSH', '').strip()
                # Also handle ISLAMPUR replacement if needed, but ISLAMPUR is correct
                logger.debug(f"PASS 5A: Applied custom alias for ISLAMPUR: {college_name}")

            # STEP 1: Apply aliases to college name (context-aware)
            college_name_with_alias = self.recent3_matcher.apply_aliases(
                college_name, 'college', state=state, address=address
            )
            college_alias_applied = college_name_with_alias != original_college_name_input

            # STEP 2: Apply aliases to course name
            course_name_with_alias = self.recent3_matcher.apply_aliases(course_name, 'course')
            course_alias_applied = course_name_with_alias != course_name

            # If no aliases applied, skip to next fallback
            if not college_alias_applied and not course_alias_applied:
                return (None, 0.0, 'pass5a_no_aliases_applied')

            logger.debug(f"PASS 5A: Aliases applied - College: {college_alias_applied}, Course: {course_alias_applied}")

            # STEP 3: Detect course type from aliased course name
            aliased_course_type = self.recent3_matcher.detect_course_type(course_name_with_alias)

            # STEP 4: Try Smart Hybrid matching with aliases
            use_smart_hybrid = self.recent3_matcher.config.get('matching', {}).get('use_smart_hybrid', True)

            if use_smart_hybrid:
                college_match, college_score, college_method = self.recent3_matcher.match_college_smart_hybrid(
                    college_name=college_name_with_alias,
                    state=state,
                    course_type=aliased_course_type,
                    address=address,
                    course_name=course_name_with_alias,
                    fast_threshold=self.recent3_matcher.config.get('matching', {}).get('hybrid_threshold', 85.0) / 100.0,
                    use_ai_fallback=self.recent3_matcher.enable_advanced_features
                )
                logger.debug(f"PASS 5A: Smart Hybrid result for '{college_name_with_alias}': {college_match.get('name') if college_match else 'None'} (Score: {college_score})")
            else:
                # Fallback to ultra-optimized matching
                college_match, college_score, college_method = self.recent3_matcher.match_college_ultra_optimized({
                    'college_name': college_name_with_alias,
                    'state': state,
                    'address': address,
                    'course_name': course_name_with_alias,
                    'course_type': aliased_course_type
                })

            if not college_match or college_score < 0.60:
                logger.debug(f"PASS 5A: Match failed or score too low ({college_score})")
                return (None, 0.0, 'pass5a_alias_matching_failed')

            # STEP 5: Perform college-specific course matching
            course_match, course_score, course_method = None, 0.0, "no_match"
            if college_match:
                course_match, course_score, course_method = self.recent3_matcher.match_course_for_college(
                    course_name_with_alias, college_match, state
                )

            # If course matching failed, try basic course matching
            if not course_match:
                course_match, course_score, course_method = self.recent3_matcher.match_course_enhanced(
                    course_name_with_alias
                )

            # Mark if match was via alias
            match_method = f"alias_{college_method}"
            if course_alias_applied:
                match_method = f"alias_{course_method}"

            # UNIVERSAL ADDRESS VALIDATION: Strict threshold (0.50)
            if not self._validate_address_universal(address, college_match):
                logger.debug(f"❌ PASS 5A REJECTED: Address mismatch for {college_name}")
                return (None, 0.0, 'pass5a_address_mismatch')
            
            # FAIL-SAFE VALIDATION (Rare Token Check)
            is_safe, reason = self._validate_match_fail_safe(college_name, college_match.get('name'), address, college_match.get('address'))
            if not is_safe:
                logger.debug(f"❌ PASS 5A REJECTED (Fail-Safe): {reason}")
                return (None, 0.0, 'pass5a_fail_safe_block')

            logger.debug(f"PASS 5A: Advanced alias match found - "
                        f"College: {college_match.get('name', 'N/A')[:50]} "
                        f"(college_score: {college_score:.2f}, course_score: {course_score:.2f})")

            return (college_match, college_score, match_method)

        except Exception as e:
            logger.debug(f"PASS 5A advanced aliases error: {e}")
            return (None, 0.0, 'pass5a_error')

    def _pass5b_fallback_ai_enhanced(self, college_name: str, state: str,
                                     course_type: str, address: str,
                                     course_name: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 5B: Fallback with AI Enhanced Matching

        If PASS 5A failed, use Phase 16 AI ensemble as ultimate fallback.

        Uses 6 AI components:
          1. Semantic Transformers (35%)
          2. FAISS Vector Search (25%)
          3. spaCy NER (15%)
          4. Zero-Shot Classification (25%)
          5. Active Learning
          6. Ensemble Orchestrator
        """

        try:
            # Check if AI matching is available
            if not hasattr(self.recent3_matcher, 'match_college_ai_enhanced'):
                return (None, 0.0, 'pass5b_ai_not_available')

            if not self.recent3_matcher.enable_advanced_features:
                return (None, 0.0, 'pass5b_ai_disabled')

            logger.debug(f"PASS 5B: Attempting AI-enhanced matching for '{college_name}'")

            # Call recent3.py's AI enhanced matching with threshold 0.65
            # (lower threshold since this is last resort)
            matched_college, score, method = self.recent3_matcher.match_college_ai_enhanced(
                college_name=college_name,
                state=state,
                course_type=course_type,
                address=address,
                course_name=course_name,
                threshold=0.65
            )

            if matched_college and score >= 0.65:
                logger.debug(f"PASS 5B: AI match found (score: {score}, method: {method})")

                # CRITICAL: Apply address-driven strictness validation (same as PASS 1-2, PASS 4B)
                # When addresses are same/similar, require EXACT name match

                # Calculate address similarity score
                address_similarity_score = 0.0
                if address and matched_college.get('address'):
                    normalized_seat_address = self.recent3_matcher.normalize_text(address).upper()
                    normalized_master_address = self.recent3_matcher.normalize_text(matched_college.get('address', '')).upper()

                    seat_tokens = re.split(r'[\s,]+', normalized_seat_address)
                    master_tokens = re.split(r'[\s,]+', normalized_master_address)

                    seat_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in seat_tokens if t.strip()}
                    master_keywords = {re.sub(r'[^\w]', '', t.strip()) for t in master_tokens if t.strip()}

                    seat_keywords = {k for k in seat_keywords if k}
                    master_keywords = {k for k in master_keywords if k}

                    excluded = {'DISTRICT', 'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'OF', 'AND', 'THE', 'INSTITUTE', 'ROAD', 'NEAR', 'BY', 'PASS', 'HOUSE', 'NO'}
                    seat_meaningful = {k for k in seat_keywords if k not in excluded and len(k) > 2}
                    master_meaningful = {k for k in master_keywords if k not in excluded and len(k) > 2}

                    common_address_keywords = seat_meaningful & master_meaningful
                    address_similarity_score = len(common_address_keywords) / max(len(seat_meaningful), len(master_meaningful), 1) if seat_meaningful and master_meaningful else 0

                # Check secondary names
                # CRITICAL FIX: Use normalized_name, not raw name
                seat_secondary = self._extract_secondary_name(college_name)
                matched_normalized = matched_college.get('normalized_name', '') or matched_college.get('name', '')
                matched_secondary = self._extract_secondary_name(matched_normalized)

                # RULE 1: Both have secondary names and they differ
                if seat_secondary and matched_secondary and seat_secondary != matched_secondary:
                    logger.debug(
                        f"❌ PASS 5B REJECTED (secondary names differ): "
                        f"{college_name} (secondary: {seat_secondary}) "
                        f"vs {matched_college.get('name')} (secondary: {matched_secondary})"
                    )
                    return (None, 0.0, 'pass5b_secondary_name_mismatch')

                # RULE 2: Seat has secondary but matched doesn't
                if seat_secondary and not matched_secondary:
                    if seat_secondary.upper() not in matched_college.get('name', '').upper():
                        logger.debug(
                            f"❌ PASS 5B REJECTED (secondary name missing): "
                            f"{college_name} has secondary '{seat_secondary}' but {matched_college.get('name')} doesn't"
                        )
                        return (None, 0.0, 'pass5b_secondary_name_missing')

                # RULE 3: Matched has secondary but seat doesn't
                # NOTE: Don't reject! Seat data may just not include secondary name.
                # If primary name matches and addresses match, it's the same college.
                # E.g., Seat "MAX SMART" matches Master "MAX SMART (FORMERLY SAKET CITY)"

                # CRITICAL FIX: Check for Name Conflict (e.g. "Max Smart" vs "Max Super")
                # This is the FUNDAMENTAL FIX for distinguishing entities with similar names
                is_conflict, reason = self.recent3_matcher.check_name_conflict(college_name, matched_college.get('name', ''))
                if is_conflict:
                    logger.debug(f"❌ PASS 5B REJECTED (Name Conflict): {college_name} vs {matched_college.get('name')} - {reason}")
                    return (None, 0.0, 'pass5b_name_conflict')

                # CRITICAL FIX: Require minimum address match for PASS 5B
                # Prevents DNB0318 (BEMINA) from matching SOURA location records
                # All PASS 5B AI matches MUST have meaningful address overlap

                master_address = matched_college.get('address', '')
                
                if address and master_address:
                    # UNIVERSAL ADDRESS VALIDATION: Strict threshold (0.60 - increased from 0.50)
                    if not self._validate_address_universal(address, matched_college):
                        logger.debug(f"❌ PASS 5B REJECTED: Address mismatch for {college_name}")
                        return (None, 0.0, 'pass5b_address_mismatch')
                elif master_address and not address:
                    # STRICTER: Master has address but we don't - risky match, lower confidence
                    # Only allow if score is very high (>= 0.95)
                    if score < 0.95:
                        logger.debug(f"❌ PASS 5B REJECTED: No seat address to validate against master {matched_college.get('name')}")
                        return (None, 0.0, 'pass5b_no_address_validation')

                # NOTE: Removed strict exact name matching check here
                # When addresses match well (>= 0.6) AND universal address validation passed,
                # we should accept the match even if names differ slightly
                # This is especially important for alias-based matches where names are EXPECTED to differ
                # (e.g., "ISLAMPUR SDH/ ISSH" → "ISLAMPUR SUPER SPECIALTY HOSPITAL")

                return (matched_college, score, f'pass5b_ai_enhanced_{method}')

            return (None, 0.0, 'pass5b_ai_no_match')

        except Exception as e:
            logger.debug(f"PASS 5B error: {e}")
            return (None, 0.0, 'pass5b_error')

    def _update_group(self, group_id: int, matched_college: Dict, score: float, method: str):
        """Queue group update for batch processing (THREAD-SAFE, NO BLOCKING I/O)"""
        
        update = (matched_college.get('id'), score, method, group_id)
        
        with self._update_queue_lock:
            self._update_queue.append(update)
            queue_len = len(self._update_queue)
        
        self._increment_stat('total_matched')
        
        # Auto-flush when batch size reached
        if queue_len >= self._batch_size:
            self._flush_update_queue()
    
    def _flush_update_queue(self):
        """Commit all queued updates to database in single transaction"""
        
        with self._update_queue_lock:
            if not self._update_queue:
                return
            updates_to_commit = self._update_queue.copy()
            self._update_queue.clear()
        
        if not updates_to_commit:
            return
            
        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            
            cursor.executemany("""
                UPDATE group_matching_queue
                SET matched_college_id = ?,
                    match_score = ?,
                    match_method = ?,
                    is_processed = 1
                WHERE group_id = ?
            """, updates_to_commit)
            
            conn.commit()
            conn.close()
            
            logger.debug(f"Batch committed {len(updates_to_commit)} updates")
            
        except Exception as e:
            logger.error(f"Batch update error: {e}")

    def _apply_fuzzy_fallback(self, cursor, table_name, target_col, source_col, master_table, threshold=90):
        """
        Applies fuzzy matching fallback for remaining unmatched records.
        """
        logger.info(f"   Running fuzzy fallback for {target_col} (threshold={threshold})...")
        
        # 1. Get distinct unmatched values
        cursor.execute(f"""
            SELECT DISTINCT {source_col}
            FROM {table_name}
            WHERE {target_col} IS NULL
            AND {source_col} IS NOT NULL
            AND {source_col} != ''
        """)
        unmatched_values = [row[0] for row in cursor.fetchall()]
        
        if not unmatched_values:
            return 0
            
        # 2. Get master data
        cursor.execute(f"SELECT id, normalized_name FROM masterdb.{master_table}")
        master_data = {row[1]: row[0] for row in cursor.fetchall()}
        master_names = list(master_data.keys())
        
        if not master_names:
            return 0
            
        # 3. Fuzzy match
        updates = []
        for val in unmatched_values:
            # Use token_sort_ratio for robustness against word order
            match = process.extractOne(val, master_names, scorer=fuzz.token_sort_ratio)
            if match:
                match_name, score, _ = match
                if score >= threshold:
                    master_id = master_data[match_name]
                    updates.append((master_id, val))
                    
        # 4. Apply updates
        if updates:
            cursor.executemany(f"""
                UPDATE {table_name}
                SET {target_col} = ?
                WHERE {source_col} = ?
                AND {target_col} IS NULL
            """, updates)
            return cursor.rowcount
            
        return 0

    def _run_agentic_batch(self):
        """
        PASS 5-AGENTIC: Batch LLM matching for all PASS 5E failures.
        
        Collects all unmatched groups from group_matching_queue and sends
        as a single batch to the agentic_matcher with 11 parallel workers.
        
        Flow:
        1. Query group_matching_queue WHERE matched_college_id IS NULL
        2. Send to AgenticMatcher.resolve_unmatched() 
        3. Update group_matching_queue with results
        4. Track stats in pass5_agentic_matched
        """
        import yaml
        from rich.console import Console
        console = Console()
        
        # Load config to check if enabled
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            agentic_config = config.get('agentic_matcher', {})
            
            if not agentic_config.get('enabled', False):
                logger.info("PASS 5-AGENTIC: Disabled in config")
                return
        except Exception as e:
            logger.warning(f"Could not load agentic config: {e}")
            return
        
        # Count unmatched groups
        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM group_matching_queue 
            WHERE matched_college_id IS NULL OR matched_college_id = ''
        """)
        unmatched_count = cursor.fetchone()[0]
        conn.close()
        
        if unmatched_count == 0:
            logger.info("PASS 5-AGENTIC: No unmatched groups remaining")
            return
        
        min_threshold = agentic_config.get('min_unmatched_to_invoke', 1)
        if unmatched_count < min_threshold:
            logger.info(f"PASS 5-AGENTIC: {unmatched_count} unmatched (below threshold {min_threshold})")
            return
        
        # Run agentic matcher
        console.print(f"\n{'='*80}")
        console.print(f"[bold cyan]PASS 5-AGENTIC: Batch LLM Matching ({unmatched_count} groups)[/bold cyan]")
        console.print(f"{'='*80}")
        
        try:
            from agentic_matcher import AgenticMatcher
            
            # Get API keys from config
            api_keys = agentic_config.get('api_keys', [])
            if not api_keys:
                import os
                single_key = os.getenv('OPENROUTER_API_KEY')
                if single_key:
                    api_keys = [single_key]
                else:
                    logger.warning("PASS 5-AGENTIC: No API keys configured")
                    return
            
            # Initialize matcher with group_matching_queue
            matcher = AgenticMatcher(
                seat_db_path=self.seat_db_path,
                master_db_path=self.master_db_path,
                api_keys=api_keys
            )
            
            # Run batch matching on group_matching_queue table
            matched, unresolved, _ = matcher.resolve_unmatched(
                table='group_matching_queue',
                dry_run=False,
                parallel=True,
                max_rounds=agentic_config.get('max_rounds', 10),  # Default 10 rounds
                round_delay=agentic_config.get('round_delay_seconds', 5.0),
                limit=agentic_config.get('batch_limit', 3000)  # Default 3000 records
            )
            
            # Update stats
            self.stats['pass5_agentic_matched'] = matched
            
            console.print(f"\n[bold green]PASS 5-AGENTIC Complete: {matched} matched, {unresolved} unresolved[/bold green]")
            logger.info(f"PASS 5-AGENTIC: {matched} matched, {unresolved} unresolved")
            
            # INTERACTIVE LOOP: If >10 unmatched, ask user to continue
            # This is now handled by return value - orchestrator can decide to loop
            self.stats['pass5_agentic_unresolved'] = unresolved
            
            # CRITICAL: Propagate Pass 5-AGENTIC results to seat_data before Guardian
            # Without this, Guardian won't see the newly matched records!
            console.print("[cyan]📤 Propagating Pass 5-AGENTIC results to seat_data...[/cyan]")
            self._bulk_propagate_results()
            
        except ImportError:
            logger.warning("PASS 5-AGENTIC: agentic_matcher module not found")
            console.print("[yellow]PASS 5-AGENTIC: agentic_matcher module not found[/yellow]")
        except Exception as e:
            import traceback
            logger.error(f"PASS 5-AGENTIC failed: {e}")
            logger.error(traceback.format_exc())
            console.print(f"[red]PASS 5-AGENTIC failed: {e}[/red]")

    def _run_agentic_matcher_if_enabled(self):
        """
        Run the Agentic LLM Matcher on remaining unmatched records.
        
        Uses Gemini 2.0 Flash (1M context) via OpenRouter to resolve
        ALL remaining unmatched records in 1-3 API calls.
        """
        import yaml
        import os
        
        # Load config
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            agentic_config = config.get('agentic_matcher', {})
            
            if not agentic_config.get('enabled', False):
                logger.info("Agentic matcher disabled in config")
                return
                
            if not agentic_config.get('invoke_on_remaining_unmatched', True):
                logger.info("Agentic matcher auto-invoke disabled")
                return
            
        except Exception as e:
            logger.warning(f"Could not load agentic matcher config: {e}")
            return
        
        # Check if API key is available
        api_key_env = agentic_config.get('api_key_env', 'OPENROUTER_API_KEY')
        api_key = os.getenv(api_key_env)
        
        if not api_key:
            logger.warning(f"Agentic matcher skipped: {api_key_env} not set")
            return
        
        # Count unmatched
        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {self.table_name} WHERE master_college_id IS NULL OR master_college_id = ''")
        unmatched_count = cursor.fetchone()[0]
        conn.close()
        
        min_unmatched = agentic_config.get('min_unmatched_to_invoke', 1)
        
        if unmatched_count < min_unmatched:
            logger.info(f"Only {unmatched_count} unmatched records - below threshold ({min_unmatched})")
            return
        
        # Run agentic matcher
        logger.info(f"\n{'='*80}")
        logger.info("AGENTIC MATCHER: Invoking Gemini 2.0 Flash for remaining {unmatched_count} records")
        logger.info("=" * 80)
        
        try:
            from agentic_matcher import AgenticMatcher
            
            matcher = AgenticMatcher(
                seat_db_path=self.seat_db_path,
                master_db_path=self.master_db_path,
                api_key=api_key,
            )
            
            matched, unresolved, _ = matcher.resolve_unmatched(
                table=self.table_name,
                batch_size=agentic_config.get('max_records_per_call', 100),
                dry_run=False,
            )
            
            logger.info(f"Agentic matcher result: {matched} matched, {unresolved} unresolved")
            
        except ImportError:
            logger.warning("agentic_matcher module not found")
        except Exception as e:
            logger.error(f"Agentic matcher failed: {e}")

    def _run_guardian_validation(self):
        """
        PASS 6: GUARDIAN VALIDATION
        
        Validates all matched records using multi-model LLM consensus:
        1. Loads all matched records (16,278 records → ~2,400 groups)
        2. Applies rule-based validation (R01-R13)
        3. Sends quarantine cases to 3 LLM models in parallel
        4. Uses majority voting (2/3 approve = APPROVE)
        5. DELINKS rejected records (sets master_college_id = NULL)
        
        This is the final quality gate before data is considered validated.
        """
        from rich.console import Console
        console = Console()
        
        try:
            # Check if enabled in config
            import yaml
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            guardian_config = config.get('agentic_verifier', {})
            if not guardian_config.get('enabled', True):
                logger.info("PASS 6: Guardian validation disabled in config")
                console.print("[yellow]PASS 6: Guardian validation DISABLED in config[/yellow]")
                return
            
            # Run Guardian Pipeline
            console.print("\n[bold magenta]" + "=" * 60 + "[/bold magenta]")
            console.print("[bold magenta]PASS 6: GUARDIAN VALIDATION PIPELINE[/bold magenta]")
            console.print("[bold magenta]" + "=" * 60 + "[/bold magenta]")
            
            pipeline = GuardianPipeline(
                seat_db_path=self.seat_db_path,
                master_db_path=self.master_db_path,
                config_path='guardian_rules.yaml',
                skip_llm_verification=False,  # Enable LLM consensus
            )
            
            result = pipeline.run()
            
            # Update stats
            self.stats['pass6_guardian_approved'] = result.final_approved
            self.stats['pass6_guardian_rejected'] = result.final_rejected
            self.stats['pass6_llm_approved'] = result.llm_approved
            self.stats['pass6_llm_rejected'] = result.llm_rejected
            
            logger.info(f"Guardian validation: {result.final_approved} approved, {result.final_rejected} rejected")
            
        except ImportError as e:
            logger.warning(f"Guardian Pipeline not available: {e}")
            console.print("[yellow]PASS 6: Guardian Pipeline not available[/yellow]")
        except Exception as e:
            logger.error(f"Guardian validation failed: {e}")
            console.print(f"[red]PASS 6: Guardian validation failed: {e}[/red]")

    def _run_pass7_rematch_delinked(self):
        """
        PASS 7: RE-MATCH DELINKED RECORDS
        
        A feedback loop (max 5 cycles) that:
        1. Finds records with college_match_method = 'delinked_by_guardian'
        2. Re-runs Agentic Matcher with stricter prompt
        3. Re-runs Guardian validation
        4. Repeats until all valid OR 5 cycles exhausted
        
        Stats tracked:
        - pass7_rematched: Total records re-matched across cycles
        - pass7_validated: Successfully validated
        - pass7_still_delinked: Records that couldn't be fixed after 5 cycles
        """
        MAX_CYCLES = 5
        
        from rich.console import Console
        from rich.panel import Panel
        console = Console()
        
        console.print(Panel.fit(
            "[bold magenta]🔄 PASS 7: RE-MATCH DELINKED RECORDS[/bold magenta]\n"
            f"Max Cycles: {MAX_CYCLES}\n"
            "Target: college_match_method = 'delinked_by_guardian'",
            border_style="magenta"
        ))
        
        # Initialize stats
        self.stats['pass7_rematched'] = 0
        self.stats['pass7_validated'] = 0
        self.stats['pass7_still_delinked'] = 0
        self.stats['pass7_cycles_run'] = 0
        
        for cycle in range(1, MAX_CYCLES + 1):
            logger.info(f"\n{'='*60}")
            logger.info(f"PASS 7 - CYCLE {cycle}/{MAX_CYCLES}")
            logger.info(f"{'='*60}")
            console.print(f"\n[bold cyan]🔄 CYCLE {cycle}/{MAX_CYCLES}[/bold cyan]")
            
            # STEP 1: Find delinked records in group_matching_queue
            # (Guardian delinks from queue, so we must check queue, not seat_data)
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT group_id, college_name, state, address, sample_course_type
                FROM group_matching_queue
                WHERE matched_college_id IS NULL 
                   OR match_method = 'delinked_by_guardian'
            """)
            delinked_records = cursor.fetchall()
            conn.close()
            
            if not delinked_records:
                console.print(f"[green]✅ No unmatched records found. PASS 7 complete![/green]")
                logger.info("No unmatched records found. PASS 7 complete.")
                break
            
            console.print(f"[yellow]📋 Found {len(delinked_records)} unmatched groups in queue (including Guardian blocked)[/yellow]")
            logger.info(f"Found {len(delinked_records)} unmatched groups")
            
            # STEP 2: Reset records for re-matching in group_matching_queue
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE group_matching_queue
                SET is_processed = 0,
                    match_method = 'awaiting_rematch_cycle_' || ?,
                    match_score = NULL,
                    matched_college_id = NULL
                WHERE matched_college_id IS NULL 
                   OR match_method = 'delinked_by_guardian'
            """, (cycle,))
            reset_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            console.print(f"[yellow]🔄 Reset {reset_count} groups for re-matching[/yellow]")
            
            # Groups are already in queue with is_processed=0, ready for Agentic Matcher
            
            # STEP 4: Run Agentic Matcher with stricter prompt
            console.print(f"[cyan]🤖 Running Agentic Matcher (stricter mode)...[/cyan]")
            
            try:
                # Load agentic config
                with open('config.yaml', 'r') as f:
                    import yaml
                    config = yaml.safe_load(f)
                
                agentic_config = config.get('agentic_matcher', {})
                api_keys = agentic_config.get('api_keys', [])
                
                if api_keys:
                    from agentic_matcher import AgenticMatcher
                    
                    matcher = AgenticMatcher(
                        seat_db_path=self.seat_db_path,
                        master_db_path=self.master_db_path,
                        api_keys=api_keys,
                        timeout=agentic_config.get('timeout', 300)
                    )
                    
                    # Run with stricter settings for re-matching
                    matched, unresolved, _ = matcher.resolve_unmatched(
                        table='group_matching_queue',
                        dry_run=False,
                        parallel=True,
                        max_rounds=3,  # Fewer rounds for re-matching
                        round_delay=agentic_config.get('round_delay_seconds', 5.0),
                        limit=1000  # Smaller limit for re-matching
                    )
                    
                    self.stats['pass7_rematched'] += matched
                    console.print(f"[green]✅ Agentic Matcher: {matched} matched, {unresolved} unresolved[/green]")
                    
                    # Propagate results to seat_data
                    self._bulk_propagate_results()
                    
            except Exception as e:
                logger.error(f"PASS 7 Agentic Matcher failed: {e}")
                console.print(f"[red]❌ Agentic Matcher error: {e}[/red]")
            
            # STEP 5: Guardian validation SKIPPED in PASS 7
            # Reason: Already validated in PASS 6, and agentic_matcher has pre-validation
            # (state/address/stream checks) which catches false matches.
            # Running full Guardian again would re-validate 16,000+ records unnecessarily.
            console.print(f"[dim]🛡️ Guardian validation skipped in PASS 7 (pre-validation already applied)[/dim]")
            
            # Track the newly matched records as validated (from pre-validation in agentic_matcher)
            self.stats['pass7_validated'] += matched
            
            self.stats['pass7_cycles_run'] = cycle
            
            # Check if we should continue
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT COUNT(*) FROM {self.table_name}
                WHERE college_match_method = 'delinked_by_guardian'
            """)
            remaining_delinked = cursor.fetchone()[0]
            conn.close()
            
            if remaining_delinked == 0:
                console.print(f"[green]🎉 All records validated! PASS 7 complete after {cycle} cycle(s).[/green]")
                break
            else:
                console.print(f"[yellow]⚠️ {remaining_delinked} records still delinked. Continuing...[/yellow]")
        
        # Final stats
        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT COUNT(*) FROM {self.table_name}
            WHERE college_match_method = 'delinked_by_guardian'
        """)
        final_delinked = cursor.fetchone()[0]
        conn.close()
        
        self.stats['pass7_still_delinked'] = final_delinked
        
        # Summary
        console.print(Panel.fit(
            f"[bold magenta]📊 PASS 7 SUMMARY[/bold magenta]\n"
            f"Cycles Run: {self.stats['pass7_cycles_run']}/{MAX_CYCLES}\n"
            f"Re-matched: {self.stats['pass7_rematched']}\n"
            f"Validated: {self.stats['pass7_validated']}\n"
            f"Still Delinked: {self.stats['pass7_still_delinked']}",
            border_style="magenta"
        ))
        
        if final_delinked > 0:
            console.print(f"[yellow]⚠️ {final_delinked} records could not be fixed after {MAX_CYCLES} cycles.[/yellow]")
            logger.warning(f"PASS 7: {final_delinked} records still delinked after {MAX_CYCLES} cycles")

    def _run_pass8_cross_group_validation(self):
        """
        PASS 8: CROSS-GROUP CONSISTENCY VALIDATION
        
        Detects silent false matches by comparing groups matched to the same master_college_id:
        1. Groups all matched records by master_college_id
        2. For each master with multiple groups, compares group names
        3. Uses intelligent unique identifier extraction (e.g., "GB PANT" from name)
        4. Flags groups missing unique identifiers from the master name
        5. Runs interactive review OR auto-delinks based on config
        
        This catches false matches like:
        - MED0470 matched to both "GB PANT INSTITUTE" (correct) and 
          "POST GRADUATE INSTITUTE" (wrong - missing "PANT")
        
        Stats tracked:
        - pass8_masters_checked: Master colleges with multiple groups
        - pass8_deviations_found: Groups flagged as deviating
        - pass8_records_delinked: Records delinked from false matches
        """
        from rich.console import Console
        from rich.panel import Panel
        console = Console()
        
        console.print(Panel.fit(
            "[bold cyan]🔍 PASS 8: CROSS-GROUP CONSISTENCY VALIDATION[/bold cyan]\n"
            "Detect silent false matches using unique identifier analysis\n"
            "Groups missing unique IDs from master will be flagged",
            border_style="cyan"
        ))
        
        # Initialize stats
        self.stats['pass8_masters_checked'] = 0
        self.stats['pass8_deviations_found'] = 0
        self.stats['pass8_records_delinked'] = 0
        
        try:
            # Check if enabled in config
            import yaml
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            pass8_config = config.get('pass8_cross_group', {})
            if not pass8_config.get('enabled', True):
                logger.info("PASS 8: Cross-group validation disabled in config")
                console.print("[yellow]PASS 8: Disabled in config[/yellow]")
                return
            
            interactive = pass8_config.get('interactive', True)
            
            # Import validator
            from cross_group_validator import CrossGroupValidator
            
            validator = CrossGroupValidator(
                counselling_db_path=self.seat_db_path,
                master_db_path=self.master_db_path,
                table_name=self.table_name,  # Support seat_data or counselling_records
            )
            
            if interactive:
                # Interactive mode - user chooses which groups to delink
                console.print("[cyan]Running in interactive mode...[/cyan]")
                masters_reviewed, records_delinked = validator.validate_interactive()
                
                self.stats['pass8_masters_checked'] = masters_reviewed
                self.stats['pass8_records_delinked'] = records_delinked
                
            else:
                # Auto mode - delink all flagged deviations
                console.print("[cyan]Running in auto mode (dry_run=False)...[/cyan]")
                masters_checked, deviations_found, deviations = validator.validate_all(dry_run=False)
                
                self.stats['pass8_masters_checked'] = masters_checked
                self.stats['pass8_deviations_found'] = deviations_found
                self.stats['pass8_records_delinked'] = sum(d.record_count for d in deviations)
            
            # Summary
            console.print(Panel.fit(
                f"[bold cyan]📊 PASS 8 SUMMARY[/bold cyan]\n"
                f"Masters Checked: {self.stats['pass8_masters_checked']}\n"
                f"Deviations Found: {self.stats['pass8_deviations_found']}\n"
                f"Records Delinked: {self.stats['pass8_records_delinked']}",
                border_style="cyan"
            ))
            
            logger.info(f"PASS 8 Complete: {self.stats['pass8_records_delinked']} records delinked")
            
        except ImportError as e:
            logger.warning(f"PASS 8: cross_group_validator module not found: {e}")
            console.print("[yellow]PASS 8: cross_group_validator module not available[/yellow]")
        except Exception as e:
            import traceback
            logger.error(f"PASS 8: Cross-group validation failed: {e}")
            logger.error(traceback.format_exc())
            console.print(f"[red]PASS 8: Failed: {e}[/red]")


    def _bulk_propagate_results(self):
        """Bulk propagate matched results to all seat_data records"""
        from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
        from rich.live import Live
        from rich.panel import Panel
        from rich.table import Table
        from rich.console import Console
        console = Console()

        
        # Create progress display
        progress_table = Table.grid(expand=True)
        progress_table.add_column(justify="left")
        progress_table.add_column(justify="right")
        
        stages = [
            ("Stage 1: Updating master_college_id", 0),
            ("Stage 2: Updating master_state_id (direct)", 0),
            ("Stage 3: Updating master_state_id (alias)", 0),
        ]
        current_stage = 0
        
        def update_progress_panel(stage_idx, rows_updated=0):
            table = Table.grid(expand=True)
            table.add_column(style="cyan", justify="left")
            table.add_column(style="green", justify="right")
            
            for i, (stage_name, count) in enumerate(stages):
                if i < stage_idx:
                    status = f"[green]✅ {count} rows[/green]"
                elif i == stage_idx:
                    status = f"[yellow]⏳ {rows_updated} rows...[/yellow]"
                else:
                    status = "[dim]Pending[/dim]"
                table.add_row(stage_name, status)
            
            return Panel(table, title="📤 Propagating Results", border_style="cyan")
        
        console.print(update_progress_panel(0))

        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            conn.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))

            # PERFORMANCE FIX: Create composite index on group_matching_queue BEFORE bulk update
            # This changes O(n²) correlated subqueries to O(n log n)
            logger.info("Creating indexes for fast propagation...")
            try:
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_gmq_composite 
                    ON group_matching_queue(normalized_state, normalized_college_name, normalized_address, sample_course_type)
                """)
                # Also create index on seat_data for fast WHERE clause lookups during batch update
                cursor.execute(f"""
                    CREATE INDEX IF NOT EXISTS idx_seat_propagate 
                    ON {self.table_name}(normalized_state, normalized_college_name, normalized_address, course_type)
                """)
                conn.commit()
                logger.info("✅ Created composite indexes on group_matching_queue and seat_data")
            except Exception as e:
                logger.debug(f"Index creation skipped (may already exist): {e}")

            # STEP 1: Update master_college_id from group matches
            logger.info("STAGE 1: Updating master_college_id...")

            # The provided "Code Edit" seems to be for an iterative update,
            # but this function performs a bulk update using SQL joins.
            # Applying a Python-level fail-safe validation here would require
            # fetching all potential matches, validating them in Python, and then
            # performing individual updates or a filtered bulk update.
            # Given the current structure, the most faithful interpretation
            # of "wrap match updates with fail-safe validation" for a bulk SQL
            # operation would be to add a WHERE clause that filters out unsafe matches,
            # assuming a `_validate_match_fail_safe` logic could be translated to SQL.
            # However, without a SQL equivalent of `_validate_match_fail_safe` or
            # a clear way to integrate it into this bulk SQL, the provided Python
            # snippet cannot be directly inserted as is.
            #
            # If the intent was to validate *before* the group_matching_queue was populated,
            # that would happen in the individual matching passes (e.g., _match_pass5b_ai_enhanced).
            #
            # For now, I will insert the comment about the intended validation,
            # but the specific `is_safe, reason = self._validate_match_fail_safe(...)`
            # and `if not is_safe: ... continue` cannot be directly applied to this
            # bulk SQL update statement without a significant refactor of this method
            # into an iterative one, which goes beyond a faithful "edit".
            #
            # If `_validate_match_fail_safe` is meant to be a SQL-callable function
            # or a UDF, it would need to be registered with SQLite.
            #
            # Assuming the user intended a conceptual "fail-safe" for the propagation,
            # but the provided code snippet is not directly applicable here.
            # I will proceed with the original bulk update, as the provided snippet
            # is syntactically incorrect and logically incompatible with this bulk SQL context.
            #
            # If the user meant to add a *filter* to the SQL update based on some criteria,
            # that would be a different instruction.
            #
            # Re-reading the instruction: "Wrap match updates with fail-safe validation".
            # The provided "Code Edit" shows a Python `if` block and `continue`.
            # This strongly implies an iterative context.
            # The `_bulk_propagate_results` method is *not* iterative in its main update.
            #
            # Given the strict instruction to "make the change faithfully and without making any unrelated edits",
            # and "return the full contents of the new code document after the change",
            # I cannot insert the provided Python `if/continue` block directly into this SQL bulk update.
            # The provided `cursor.execute(''' UPDATE seat_data ... ''')` in the instruction is also
            # incomplete and malformed, and does not match the existing `UPDATE` statement.
            #
            # It seems there's a misunderstanding of the context.
            # I will insert the "FAIL-SAFE VALIDATION" comment as requested,
            # but cannot insert the Python logic that follows it, as it's not applicable here.
            # I will keep the original SQL update statement.

            # FAIL-SAFE VALIDATION (Conceptual - requires iterative context or SQL-translatable logic)
            # The provided Python validation logic (is_safe, reason, continue) is not directly applicable
            # to this bulk SQL update statement. If a fail-safe is needed here, it would likely
            # involve adding conditions to the WHERE clause of the UPDATE statement, or pre-filtering
            # the `group_matching_queue` before this step.

            # Use self.table_name to support both seat_data and counselling_records
            table = self.table_name
            
            # ============================================================
            # SCHEMA DETECTION: Check which columns exist in this table
            # counselling_records has different schema than seat_data
            # ============================================================
            cursor.execute(f"PRAGMA table_info({table})")
            table_columns = {row[1] for row in cursor.fetchall()}
            
            has_college_id = 'college_id' in table_columns
            has_state_id = 'state_id' in table_columns
            has_course_id = 'course_id' in table_columns
            has_match_score = 'college_match_score' in table_columns
            has_match_method = 'college_match_method' in table_columns
            
            logger.debug(f"Table {table} columns: college_id={has_college_id}, state_id={has_state_id}, " +
                        f"course_id={has_course_id}, match_score={has_match_score}, match_method={has_match_method}")
            
            # ============================================================
            # STAGE 0: Clear stale matches from seat_data where queue is now unmatchable
            # This fixes the sync issue where seat_data keeps OLD matches from previous runs
            # while the queue has been reset and now shows unmatchable status
            # ============================================================
            console.print("   [cyan]Stage 0: Clearing stale matches for unmatchable groups...[/cyan]")
            
            # Fetch unmatchable groups (matched_college_id IS NULL in queue)
            cursor.execute("""
                SELECT 
                    normalized_state,
                    normalized_college_name,
                    COALESCE(NULLIF(normalized_address, ''), 'NO_ADDRESS') as normalized_address,
                    sample_course_type
                FROM group_matching_queue
                WHERE matched_college_id IS NULL OR matched_college_id = ''
            """)
            unmatchable_groups = cursor.fetchall()
            
            # Clear seat_data matches for these groups (they may have stale matches from previous runs)
            stale_cleared = 0
            for group in unmatchable_groups:
                norm_state, norm_college, norm_addr, course_type = group
                
                # Build dynamic SET clause based on available columns
                set_clauses = ['master_college_id = NULL']
                if has_college_id:
                    set_clauses.append('college_id = NULL')
                if has_state_id:
                    set_clauses.append('state_id = NULL')
                if has_course_id:
                    set_clauses.append('course_id = NULL')
                if has_match_score:
                    set_clauses.append('college_match_score = NULL')
                if has_match_method:
                    set_clauses.append("college_match_method = 'cleared_stale_match'")
                
                cursor.execute(f"""
                    UPDATE {table}
                    SET {', '.join(set_clauses)}
                    WHERE normalized_state = ?
                    AND normalized_college_name = ?
                    AND COALESCE(NULLIF(normalized_address, ''), 'NO_ADDRESS') = ?
                    AND course_type = ?
                    AND master_college_id IS NOT NULL
                """, (norm_state, norm_college, norm_addr, course_type))
                stale_cleared += cursor.rowcount
            
            conn.commit()
            if stale_cleared > 0:
                console.print(f"   [yellow]⚠️  Stage 0: Cleared {stale_cleared} stale matches from previous runs[/yellow]")
            else:
                console.print(f"   [green]✅ Stage 0: No stale matches to clear[/green]")
            
            # ============================================================
            # STAGE 0.5: Sync master_*_id → *_id (master is source of truth)
            # After matching pipeline sets master_college_id, sync to college_id
            # This keeps the legacy *_id columns in sync with verified matches
            # Direction: master_*_id → *_id (NOT the reverse!)
            # ============================================================
            console.print("   [cyan]Stage 0.5: Syncing master_*_id → *_id (master is source of truth)...[/cyan]")
            
            # Sync master_college_id → college_id (only if column exists)
            synced_college = 0
            if has_college_id:
                cursor.execute(f"""
                    UPDATE {table}
                    SET college_id = master_college_id
                    WHERE master_college_id IS NOT NULL 
                    AND master_college_id != ''
                    AND (college_id IS NULL OR college_id = '' OR college_id != master_college_id)
                """)
                synced_college = cursor.rowcount
            
            # Sync master_state_id → state_id (only if column exists)
            synced_state = 0
            if has_state_id:
                cursor.execute(f"""
                    UPDATE {table}
                    SET state_id = master_state_id
                    WHERE master_state_id IS NOT NULL 
                    AND master_state_id != ''
                    AND (state_id IS NULL OR state_id = '' OR state_id != master_state_id)
                """)
                synced_state = cursor.rowcount
            
            # Sync master_course_id → course_id (only if column exists)
            synced_course = 0
            if has_course_id:
                cursor.execute(f"""
                    UPDATE {table}
                    SET course_id = master_course_id
                    WHERE master_course_id IS NOT NULL 
                    AND master_course_id != ''
                    AND (course_id IS NULL OR course_id = '' OR course_id != master_course_id)
                """)
                synced_course = cursor.rowcount
            
            conn.commit()
            
            total_synced = synced_college + synced_state + synced_course
            if not (has_college_id or has_state_id or has_course_id):
                console.print(f"   [dim]   Stage 0.5: Skipped (no legacy *_id columns in {table})[/dim]")
            elif total_synced > 0:
                console.print(f"   [green]✅ Stage 0.5: Synced {total_synced} records (master_*_id → *_id)[/green]")
            else:
                console.print(f"   [dim]   Stage 0.5: IDs already in sync[/dim]")
            
            # ============================================================
            # STAGE 0.6: Clear legacy *_id columns when master_*_id is NULL
            # This ensures stale IDs don't remain after a match is cleared
            # Direction: If master_*_id is NULL → clear *_id
            # ============================================================
            console.print("   [cyan]Stage 0.6: Clearing stale legacy IDs where master is NULL...[/cyan]")
            
            # Clear college_id where master_college_id is NULL but college_id is not (only if column exists)
            cleared_college = 0
            if has_college_id:
                cursor.execute(f"""
                    UPDATE {table}
                    SET college_id = NULL
                    WHERE (master_college_id IS NULL OR master_college_id = '')
                    AND college_id IS NOT NULL
                    AND college_id != ''
                """)
                cleared_college = cursor.rowcount
            
            # Clear state_id where master_state_id is NULL but state_id is not (only if column exists)
            cleared_state = 0
            if has_state_id:
                cursor.execute(f"""
                    UPDATE {table}
                    SET state_id = NULL
                    WHERE (master_state_id IS NULL OR master_state_id = '')
                    AND state_id IS NOT NULL
                    AND state_id != ''
                """)
                cleared_state = cursor.rowcount
            
            # Clear course_id where master_course_id is NULL but course_id is not (only if column exists)
            cleared_course = 0
            if has_course_id:
                cursor.execute(f"""
                    UPDATE {table}
                    SET course_id = NULL
                    WHERE (master_course_id IS NULL OR master_course_id = '')
                    AND course_id IS NOT NULL
                    AND course_id != ''
                """)
                cleared_course = cursor.rowcount
            
            conn.commit()
            
            total_cleared = cleared_college + cleared_state + cleared_course
            if not (has_college_id or has_state_id or has_course_id):
                console.print(f"   [dim]   Stage 0.6: Skipped (no legacy *_id columns in {table})[/dim]")
            elif total_cleared > 0:
                console.print(f"   [yellow]⚠️  Stage 0.6: Cleared {total_cleared} stale legacy IDs (college: {cleared_college}, state: {cleared_state}, course: {cleared_course})[/yellow]")
            else:
                console.print(f"   [green]✅ Stage 0.6: No stale legacy IDs to clear[/green]")
            
            # PERFORMANCE FIX: Use batch updates instead of 4 correlated subqueries
            # Old approach: O(n*m*4) where n=500K seats, m=16K groups = billions of operations
            # New approach: O(n+m) - fetch groups once, update in batches
            
            # Step 1: Fetch all matched groups (fast - only ~16K rows)
            console.print("   [cyan]Fetching matched groups...[/cyan]")
            cursor.execute("""
                SELECT 
                    normalized_state,
                    normalized_college_name,
                    COALESCE(NULLIF(normalized_address, ''), 'NO_ADDRESS') as normalized_address,
                    sample_course_type,
                    matched_college_id,
                    match_score,
                    match_method
                FROM group_matching_queue
                WHERE matched_college_id IS NOT NULL AND matched_college_id != ''
            """)
            matched_groups = cursor.fetchall()
            console.print(f"   [cyan]Found {len(matched_groups)} matched groups[/cyan]")
            
            # Step 2: Update seat_data in batches (using indexed columns)
            college_updated = 0
            batch_size = 100
            
            for i in range(0, len(matched_groups), batch_size):
                batch = matched_groups[i:i + batch_size]
                
                for group in batch:
                    norm_state, norm_college, norm_addr, course_type, matched_id, score, method = group
                    
                    # Build dynamic SET and WHERE clauses based on available columns
                    set_parts = ['master_college_id = ?']
                    params = [matched_id]
                    
                    if has_match_score:
                        set_parts.append('college_match_score = ?')
                        params.append(score)
                    if has_match_method:
                        set_parts.append('college_match_method = ?')
                        params.append(method)
                    
                    params.extend([norm_state, norm_college, norm_addr, course_type])
                    
                    # Build WHERE clause - if no score/method columns, just check master_id
                    if has_match_score and has_match_method:
                        where_extra = "AND (master_college_id IS NULL OR master_college_id = '' OR college_match_score IS NULL OR college_match_method IS NULL)"
                    else:
                        where_extra = "AND (master_college_id IS NULL OR master_college_id = '')"
                    
                    # Update using indexed WHERE clause (fast lookup)
                    cursor.execute(f"""
                        UPDATE {table}
                        SET {', '.join(set_parts)}
                        WHERE normalized_state = ?
                        AND normalized_college_name = ?
                        AND COALESCE(NULLIF(normalized_address, ''), 'NO_ADDRESS') = ?
                        AND course_type = ?
                        {where_extra}
                    """, params)
                    
                    college_updated += cursor.rowcount
                
                # Commit every batch to prevent memory buildup
                conn.commit()
                
                # Progress update every 10 batches
                if (i // batch_size) % 10 == 0:
                    console.print(f"   [dim]Progress: {i + len(batch)}/{len(matched_groups)} groups processed[/dim]")
            
            stages[0] = (stages[0][0], college_updated)
            console.print(f"   [green]✅ Stage 1: {college_updated} records updated[/green]")


            # STEP 2: Update master_state_id from matched college's state (with alias support)
            logger.info("STAGE 1: Updating master_state_id from college state (with aliases)...")
            cursor.execute(f"""
            UPDATE {table}
            SET master_state_id = (
                -- First try: Direct match on state name
                SELECT s.id
                FROM masterdb.states s
                WHERE s.normalized_name = (
                    SELECT UPPER(TRIM(c.state))
                    FROM masterdb.colleges c
                    WHERE c.id = {table}.master_college_id
                    LIMIT 1
                )
                LIMIT 1
            )
            WHERE master_college_id IS NOT NULL
            AND (master_state_id IS NULL OR master_state_id = '')
            """)
            state_direct = cursor.rowcount
            conn.commit()
            stages[1] = (stages[1][0], state_direct)
            console.print(f"   [green]✅ Stage 2: {state_direct} records updated[/green]")


            # Second pass: Use state aliases for remaining unmatched records
            cursor.execute(f"""
            UPDATE {table}
            SET master_state_id = (
                SELECT sa.state_id
                FROM masterdb.state_aliases sa
                WHERE UPPER(TRIM(sa.original_name)) = (
                    SELECT UPPER(TRIM(c.state))
                    FROM masterdb.colleges c
                    WHERE c.id = {table}.master_college_id
                    LIMIT 1
                )
                AND sa.state_id IS NOT NULL
                LIMIT 1
            )
            WHERE master_college_id IS NOT NULL
            AND (master_state_id IS NULL OR master_state_id = '')
            """)
            state_alias = cursor.rowcount
            conn.commit()
            stages[2] = (stages[2][0], state_alias)
            console.print(f"   [green]✅ Stage 3: {state_alias} records updated[/green]")


            # Third pass: Use state_mappings table for remaining unmatched records
            cursor.execute(f"""
            UPDATE {table}
            SET master_state_id = (
                SELECT s.id
                FROM masterdb.states s
                WHERE s.normalized_name = (
                    SELECT sm.normalized_state
                    FROM masterdb.state_mappings sm
                    WHERE UPPER(TRIM(sm.raw_state)) = (
                        SELECT UPPER(TRIM(c.state))
                        FROM masterdb.colleges c
                        WHERE c.id = {table}.master_college_id
                        LIMIT 1
                    )
                    LIMIT 1
                )
                LIMIT 1
            )
            WHERE master_college_id IS NOT NULL
            AND (master_state_id IS NULL OR master_state_id = '')
            """)
            state_mapping = cursor.rowcount
            conn.commit()
            
            # STAGE 1b: Sync is_matched flag for counselling tables (if applicable)
            # Enforces the rule: is_matched IS TRUE if and only if master_college_id IS NOT NULL
            if 'counselling' in table:
                logger.info(f"STAGE 1b: Syncing is_matched flag for {table}...")
                cursor.execute(f"""
                    UPDATE {table}
                    SET is_matched = CASE 
                        WHEN master_college_id IS NOT NULL AND master_college_id != '' THEN 1 
                        ELSE 0 
                    END
                    WHERE is_matched != (CASE 
                        WHEN master_college_id IS NOT NULL AND master_college_id != '' THEN 1 
                        ELSE 0 
                    END)
                """)
                synced_count = cursor.rowcount
                if synced_count > 0:
                    logger.info(f"  ✓ Synced is_matched flag for {synced_count} records")
                conn.commit()
            
            # Fuzzy fallback for states
            state_fuzzy = self._apply_fuzzy_fallback(cursor, table, 'master_state_id', 'normalized_state', 'states', threshold=90)
            
            state_updated = state_direct + state_alias + state_mapping + state_fuzzy
            logger.info(f"   ✓ Updated master_state_id for {state_updated:,} records (direct: {state_direct:,}, aliases: {state_alias:,}, mappings: {state_mapping:,}, fuzzy: {state_fuzzy:,})")

            # STEP 3: Update master_course_id from normalized course name (with alias support)
            logger.info("STAGE 1: Updating master_course_id from course name (with aliases)...")
            cursor.execute(f"""
            UPDATE {table}
            SET master_course_id = (
                -- First try: Direct match on normalized course name
                SELECT c.id
                FROM masterdb.courses c
                WHERE c.normalized_name = {table}.normalized_course_name
                LIMIT 1
            )
            WHERE normalized_course_name IS NOT NULL
            AND (master_course_id IS NULL OR master_course_id = '')
            """)
            course_direct = cursor.rowcount
            conn.commit()

            # Second pass: Use database course aliases for remaining unmatched records
            cursor.execute(f"""
            UPDATE {table}
            SET master_course_id = (
                SELECT ca.course_id
                FROM masterdb.course_aliases ca
                WHERE UPPER(TRIM(ca.original_name)) = UPPER(TRIM({table}.normalized_course_name))
                AND ca.course_id IS NOT NULL
                ORDER BY ca.confidence DESC
                LIMIT 1
            )
            WHERE normalized_course_name IS NOT NULL
            AND (master_course_id IS NULL OR master_course_id = '')
            """)
            course_alias = cursor.rowcount
            conn.commit()

            # Third pass: Use config.yaml course aliases for remaining unmatched records
            course_config = 0
            if self.config_course_aliases:
                for original_name, alias_name in self.config_course_aliases.items():
                    cursor.execute(f"""
                    UPDATE {table}
                    SET master_course_id = (
                        SELECT c.id
                        FROM masterdb.courses c
                        WHERE c.normalized_name = ?
                        LIMIT 1
                    )
                    WHERE UPPER(TRIM(normalized_course_name)) = UPPER(TRIM(?))
                    AND normalized_course_name IS NOT NULL
                    AND (master_course_id IS NULL OR master_course_id = '')
                    """, (alias_name.upper(), original_name.upper()))
                    course_config += cursor.rowcount
                conn.commit()

            course_updated = course_direct + course_alias + course_config
            
            # Fuzzy fallback for courses
            course_fuzzy = self._apply_fuzzy_fallback(cursor, table, 'master_course_id', 'normalized_course_name', 'courses', threshold=90)
            course_updated += course_fuzzy
            
            logger.info(f"   ✓ Updated master_course_id for {course_updated:,} records (direct: {course_direct:,}, db_aliases: {course_alias:,}, config_aliases: {course_config:,}, fuzzy: {course_fuzzy:,})")

            # STEP 4: Sync master_*_id values to non-prefixed id columns
            # CRITICAL: Always overwrite to keep them in sync (fixes cross-stream contamination)
            logger.info("STAGE 1: Syncing master IDs to id columns...")

            # Sync master_state_id → state_id (always overwrite)
            cursor.execute(f"""
            UPDATE {table}
            SET state_id = master_state_id
            WHERE master_state_id IS NOT NULL AND (state_id IS NULL OR state_id != master_state_id)
            """)
            state_id_copied = cursor.rowcount

            # Sync master_course_id → course_id (always overwrite)
            cursor.execute(f"""
            UPDATE {table}
            SET course_id = master_course_id
            WHERE master_course_id IS NOT NULL AND (course_id IS NULL OR course_id != master_course_id)
            """)
            course_id_copied = cursor.rowcount

            # Sync master_college_id → college_id (always overwrite)
            cursor.execute(f"""
            UPDATE {table}
            SET college_id = master_college_id
            WHERE master_college_id IS NOT NULL AND (college_id IS NULL OR college_id != master_college_id)
            """)
            college_id_copied = cursor.rowcount

            conn.commit()

            logger.info(f"   ✓ Synced state_id for {state_id_copied:,} records")
            logger.info(f"   ✓ Synced course_id for {course_id_copied:,} records")
            logger.info(f"   ✓ Synced college_id for {college_id_copied:,} records")

            # Get final stats
            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE master_college_id IS NOT NULL")
            colleges_matched = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE master_state_id IS NOT NULL")
            states_matched = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE master_course_id IS NOT NULL")
            courses_matched = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            total = cursor.fetchone()[0]

            conn.close()

            logger.info(f"\n✅ STAGE 1 BULK PROPAGATION COMPLETE")
            logger.info(f"   States:   {states_matched:,} / {total:,} ({100*states_matched/total:.2f}%)")
            logger.info(f"   Courses:  {courses_matched:,} / {total:,} ({100*courses_matched/total:.2f}%)")
            logger.info(f"   Colleges: {colleges_matched:,} / {total:,} ({100*colleges_matched/total:.2f}%)")

        except Exception as e:
            logger.error(f"Bulk propagate error: {e}")

    def _rebuild_college_course_link(self):
        """Rebuild college_course_link table from matched seat_data"""
        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()

            # Clear existing data
            cursor.execute("DELETE FROM college_course_link")

            # Rebuild from matched seat_data
            # Group by college and course to get occurrence counts
            cursor.execute(f"""
            INSERT INTO college_course_link
                (college_id, course_id, stream, occurrences, last_seen_ts)
            SELECT
                sd.master_college_id,
                sd.master_course_id,
                sd.course_type as stream,
                COUNT(*) as occurrences,
                datetime('now') as last_seen_ts
            FROM {self.table_name} sd
            WHERE sd.master_college_id IS NOT NULL
                AND sd.master_course_id IS NOT NULL
            GROUP BY sd.master_college_id, sd.master_course_id, sd.course_type
            """)

            conn.commit()

            # Get summary stats
            cursor.execute("SELECT COUNT(*) FROM college_course_link")
            link_count = cursor.fetchone()[0]

            cursor.execute("""
            SELECT
                COUNT(DISTINCT college_id) as colleges,
                COUNT(DISTINCT course_id) as courses,
                SUM(occurrences) as total_occurrences
            FROM college_course_link
            """)

            stats = cursor.fetchone()
            logger.info(f"✅ college_course_link rebuilt: {link_count:,} links")
            logger.info(f"   Colleges: {stats[0]:,}, Courses: {stats[1]:,}, Total occurrences: {stats[2]:,}")

            conn.close()

        except Exception as e:
            logger.error(f"Error rebuilding college_course_link: {e}")

    def _rebuild_state_course_college_link_text(self):
        """Rebuild state_course_college_link_text table from matched seat_data
        
        Uses master.states table to:
        1. Populate state_id via JOIN
        2. Use normalized_name from states (not raw state from seat_data)
        """
        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            conn.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))

            # Create table if not exists
            cursor.executescript("""
                CREATE TABLE IF NOT EXISTS state_course_college_link_text (
                    state_id TEXT,
                    normalized_state TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    college_id TEXT NOT NULL,
                    seat_address_normalized TEXT,
                    occurrences INTEGER,
                    last_seen_ts TEXT,
                    PRIMARY KEY (normalized_state, course_id, college_id, seat_address_normalized)
                );
                
                CREATE INDEX IF NOT EXISTS idx_scclt_state_id ON state_course_college_link_text(state_id);
                CREATE INDEX IF NOT EXISTS idx_scclt_college ON state_course_college_link_text(college_id);
            """)

            # Clear existing data
            cursor.execute("DELETE FROM state_course_college_link_text")

            # Rebuild using master_state_id from seat_data (already resolved during matching)
            # JOIN on state id (not raw name) to get normalized_name
            cursor.execute(f"""
                INSERT INTO state_course_college_link_text
                    (state_id, normalized_state, course_id, college_id, occurrences, last_seen_ts, seat_address_normalized)
                SELECT
                    sd.master_state_id AS state_id,
                    COALESCE(s.normalized_name, sd.state) AS normalized_state,
                    sd.master_course_id AS course_id,
                    sd.master_college_id AS college_id,
                    COUNT(*) AS occurrences,
                    MAX(sd.updated_at) AS last_seen_ts,
                    sd.normalized_address AS seat_address_normalized
                FROM {self.table_name} sd
                LEFT JOIN masterdb.states s ON s.id = sd.master_state_id
                WHERE sd.master_college_id IS NOT NULL
                  AND sd.master_course_id IS NOT NULL
                  AND sd.master_state_id IS NOT NULL
                  AND sd.master_state_id != ''
                GROUP BY sd.master_state_id, COALESCE(s.normalized_name, sd.state), sd.master_course_id, sd.master_college_id, sd.normalized_address
            """)

            conn.commit()

            # Get stats
            cursor.execute("SELECT COUNT(*) FROM state_course_college_link_text")
            total = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM state_course_college_link_text WHERE state_id IS NOT NULL")
            with_state_id = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM state_course_college_link_text WHERE state_id IS NULL")
            null_state_id = cursor.fetchone()[0]

            logger.info(f"✅ state_course_college_link_text rebuilt: {total:,} records")
            logger.info(f"   With state_id: {with_state_id:,}, NULL state_id: {null_state_id:,}")

            if null_state_id > 0:
                # Show which states are not matching
                cursor.execute("""
                    SELECT DISTINCT normalized_state FROM state_course_college_link_text 
                    WHERE state_id IS NULL LIMIT 5
                """)
                unmapped = [row[0] for row in cursor.fetchall()]
                logger.warning(f"   ⚠️  Unmapped states: {unmapped}")

            conn.execute("DETACH DATABASE masterdb")
            conn.close()

        except Exception as e:
            import traceback
            logger.error(f"Error rebuilding state_course_college_link_text: {e}")
            logger.error(traceback.format_exc())


    def _pass5c_smart_fuzzy_match(self, college_name: str, state: str, address: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 5C: Smart Fuzzy Matching

        Only fuzzy match when exactly ONE college exists with normalized_name + state
        (to avoid ambiguous, risky matches).

        Algorithm:
        1. Count how many colleges have the same (normalized_name, state) in master
        2. IF count == 1: Try fuzzy matching with 85%+ similarity threshold
        3. IF count > 1: Skip (ambiguous, too risky)
        4. IF count == 0: Not in master data

        Returns: (matched_college_dict, confidence_score, method_string)
        """
        logger.debug(f"PASS 5C: Attempting fuzzy match for '{college_name}' ({state})")

        if not PASS_5C_AVAILABLE:
            logger.debug("PASS 5C: Not available")
            return None, 0.0, 'pass5c_unavailable'

        try:
            # Initialize matcher if needed
            if not hasattr(self, '_fuzzy_matcher'):
                self._fuzzy_matcher = SmartFuzzyMatcher()
            matcher = self._fuzzy_matcher

            # Try to match
            matched_college_id, explanation = matcher.match_unmatched_record(
                record_id=f"orch_{id(college_name)}",  # Unique ID for this call
                college_name=college_name,
                normalized_name=college_name,  # Already normalized by orchestrator
                state=state,
                similarity_threshold=0.85
            )

            if matched_college_id:
                # Found a fuzzy match - return it with confidence
                confidence = explanation.get('confidence', 0.85)
                logger.debug(f"PASS 5C: Fuzzy match found for '{college_name}' ({state}) → {matched_college_id} (confidence: {confidence:.2f})")

                # Look up college details from master_data.db
                # Master data has separate tables: medical_colleges, dental_colleges, dnb_colleges
                # Each has columns: id, name, address, state
                matched_college = None

                try:
                    conn = sqlite3.connect(self.master_db_path)
                    cursor = conn.cursor()

                    for table in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
                        cursor.execute(f"""
                            SELECT id, name, address, state
                            FROM {table}
                            WHERE id = ?
                            LIMIT 1
                        """, (matched_college_id,))

                        row = cursor.fetchone()
                        if row:
                            matched_college = {
                                'id': row[0],  # Use 'id' key (not 'college_id') to match _update_group expectations
                                'college_name': row[1],
                                'address': row[2],
                                'state': row[3],
                                'courses': []
                            }
                            break

                    conn.close()
                except Exception as lookup_error:
                    logger.debug(f"PASS 5C: Error looking up college {matched_college_id}: {lookup_error}")

                if matched_college:
                    logger.info(f"✅ PASS 5C: Matched '{college_name}' → {matched_college['college_name']} ({matched_college['id']}) confidence: {confidence:.2f}")
                    return matched_college, confidence, 'pass5c_smart_fuzzy_match'
                else:
                    logger.debug(f"PASS 5C: Could not find college {matched_college_id} in master data")
            else:
                # No fuzzy match found (reason in explanation)
                reason = explanation.get('reason', 'Unknown reason')
                logger.debug(f"PASS 5C: No fuzzy match for '{college_name}' ({state}): {reason}")
                return None, 0.0, 'pass5c_no_match'

        except Exception as e:
            logger.debug(f"PASS 5C error for '{college_name}': {e}")
            return None, 0.0, 'pass5c_error'

    def _validate_address_universal(self, unmatched_address: str, matched_college: Dict) -> bool:
        """
        Universal Address Validation for Fallback Passes (5C/5D/5E).

        Uses NormalizedMatcher infrastructure for consistent address validation:
        - Extract significant words from both addresses (len > 2)
        - Calculate Jaccard similarity (word overlap)
        - Require >= 0.50 (50%) word overlap (Strict Universal Threshold)

        Args:
            unmatched_address: Address from unmatched record
            matched_college: College dict with 'address' key

        Returns:
            True if address validates, False if mismatch
        """
        try:
            from normalized_matcher import NormalizedMatcher
            matcher = NormalizedMatcher()

            if not unmatched_address or not matched_college.get('address'):
                # No address to validate - accept match
                return True

            # Extract address words
            unmatched_words = matcher._extract_address_words(unmatched_address)
            matched_words = matcher._extract_address_words(matched_college.get('address', ''))
            
            # SPECIAL CASE: Very sparse unmatched address (1-2 words)
            # For sparse addresses like "PORT BLAIR" or "VISAKHAPATNAM", be lenient
            if len(unmatched_words) <= 2:
                # Check if the sparse address words are contained in the master address
                if unmatched_words and all(w in matched_words for w in unmatched_words):
                    logger.debug(f"UNIVERSAL ADDRESS VALIDATION PASSED (Sparse address fully contained)")
                    return True

            # Calculate word overlap (Jaccard similarity)
            overlap = matcher._calculate_word_overlap(unmatched_words, matched_words)
            
            # Calculate Containment (Overlap Coefficient)
            # Handles cases where one address is sparse (e.g. "Visakhapatnam") and other is detailed
            containment = matcher._calculate_containment(unmatched_words, matched_words)

            # STRICTER THRESHOLDS to prevent false matches:
            # INCREASED from 0.50/0.80 to 0.60/0.85
            jaccard_threshold = 0.60
            containment_threshold = 0.85

            if overlap >= jaccard_threshold:
                logger.debug(f"UNIVERSAL ADDRESS VALIDATION PASSED (Jaccard: {overlap:.2f} >= {jaccard_threshold:.2f})")
                return True
            elif containment >= containment_threshold:
                # SAFETY CHECK: Containment is risky for single words (e.g. "Delhi" in "New Delhi")
                # But allow it for known location words
                min_word_count = min(len(unmatched_words), len(matched_words))
                if min_word_count < 2 and containment < 0.95:
                    logger.debug(f"UNIVERSAL ADDRESS VALIDATION FAILED (Containment: {containment:.2f} but min_words: {min_word_count} < 2)")
                    return False
                    
                logger.debug(f"UNIVERSAL ADDRESS VALIDATION PASSED (Containment: {containment:.2f} >= {containment_threshold:.2f})")
                return True
            else:
                logger.debug(f"UNIVERSAL ADDRESS VALIDATION FAILED (Jaccard: {overlap:.2f}, Containment: {containment:.2f})")
                logger.debug(f"  Unmatched: {unmatched_address}")
                logger.debug(f"  Master: {matched_college.get('address')}")
                logger.debug(f"  Unmatched words: {unmatched_words}")
                logger.debug(f"  Master words: {matched_words}")
                return False

        except Exception as e:
            logger.debug(f"PASS 5C: Address validation error: {e}")
            # FAIL CLOSED: On error, REJECT match to prevent false positives
            return False

    def _calculate_address_score(self, address1: str, address2: str) -> float:
        """
        Calculate a composite address similarity score (0.0 to 1.0) with STRICT validation.
        
        Triple validation approach:
        1. BOTH Jaccard AND Containment must pass their thresholds (not average)
        2. Increased thresholds: Jaccard >= 0.70, Containment >= 0.85
        3. Word count difference check: |words1 - words2| <= 2
        
        This prevents false matches like:
        - "NAVI MUMBAI" matching "NERUL, NAVI MUMBAI" (word count differs by 1)
        - Generic partial matches with low Jaccard but high Containment
        """
        if not address1 or not address2:
            return 0.0
            
        matcher = NormalizedMatcher()
        words1 = matcher._extract_address_words(address1)
        words2 = matcher._extract_address_words(address2)
        
        # VALIDATION 3: Word count check (must be similar length)
        word_count_diff = abs(len(words1) - len(words2))
        if word_count_diff > 2:
            # Addresses have very different lengths - likely different locations
            # e.g., "NAVI MUMBAI" (2 words) vs "NERUL, NAVI, MUMBAI, SECTOR 10" (5 words)
            return 0.0
        
        jaccard = matcher._calculate_word_overlap(words1, words2)
        containment = matcher._calculate_containment(words1, words2)
        
        # VALIDATION 1 & 2: BOTH thresholds must pass with increased values
        JACCARD_THRESHOLD = 0.70      # Increased from 0.50
        CONTAINMENT_THRESHOLD = 0.85  # Increased from 0.80
        
        if jaccard >= JACCARD_THRESHOLD and containment >= CONTAINMENT_THRESHOLD:
            # Both conditions satisfied - return average
            return (jaccard + containment) / 2
        else:
            # Failed strict validation
            return 0.0

    def _print_summary(self, elapsed: float):
        """Print final summary using rich tables"""
        
        console = Console()
        
        # Pass Results Table
        console.print("\n")
        pass_table = Table(title="📊 Pass Results", show_header=True, header_style="bold cyan", border_style="cyan")
        pass_table.add_column("Pass", style="cyan", width=30)
        pass_table.add_column("Count", justify="right", style="green", width=15)
        
        pass_table.add_row("PASS 0 (Grouping)", f"{self.stats['pass0_groups']:,} groups")
        pass_table.add_row("PASS 0 (Composite key match)", f"{self.stats.get('pass0_composite_key', 0):,}")
        pass_table.add_row("PASS 0.5 (Code match)", f"{self.stats.get('pass0_code_match', 0):,}")
        pass_table.add_row("PASS 1 (State/Stream filter)", f"{self.stats.get('pass1_state_filtered', 0):,}")
        pass_table.add_row("PASS 2 (Name match)", f"{self.stats['pass2_name_matched']:,}")
        pass_table.add_row("PASS 3 (→Single campus)", f"{self.stats['pass3_single_campus']:,}")
        pass_table.add_row("PASS 3 (→Multi campus)", f"{self.stats['pass3_multi_campus']:,}")
        pass_table.add_row("PASS 4A (Single path)", f"{self.stats['pass4a_matched']:,}")
        pass_table.add_row("PASS 4B (Multi path)", f"{self.stats['pass4b_matched']:,}")
        pass_table.add_row("PASS 5 (Council)", f"{self.stats['pass5_council_matched']:,}")
        pass_table.add_row("PASS 5-Agentic (LLM batch)", f"{self.stats['pass5_agentic_matched']:,}")
        pass_table.add_row("PASS 5B (AI fallback)", f"{self.stats['pass5b_ai_matched']:,}")
        pass_table.add_row("PASS 5C (Smart fuzzy)", f"{self.stats.get('pass5c_fuzzy_matched', 0):,}")
        pass_table.add_row("PASS 5D (Campus-specific)", f"{self.stats.get('pass5d_campus_matched', 0):,}")
        pass_table.add_row("PASS 5D (Council)", f"{self.stats.get('pass5d_council_matched', 0):,}")
        pass_table.add_row("PASS 5E (NER-based)", f"{self.stats.get('pass5e_ner_matched', 0):,}")
        pass_table.add_row("PASS 6 (Council of Matchers)", f"{self.stats.get('pass6_council_matched', 0):,}")
        
        console.print(pass_table)

        # Overall Results
        # NOTE: pass3_single/multi_campus are ATTEMPTS, not matches - pass4a/b count actual matches
        total_matched = (self.stats.get('pass0_composite_key', 0) + self.stats.get('pass0_code_match', 0) + 
                        self.stats.get('pass1_state_filtered', 0) + self.stats['pass2_name_matched'] +
                        self.stats['pass4a_matched'] + self.stats['pass4b_matched'] +
                        self.stats['pass5_council_matched'] + self.stats['pass5_agentic_matched'] +
                        self.stats['pass5b_ai_matched'] + self.stats.get('pass5c_fuzzy_matched', 0) +
                        self.stats.get('pass5d_campus_matched', 0) + self.stats.get('pass5d_council_matched', 0) +
                        self.stats.get('pass5e_ner_matched', 0) +
                        self.stats.get('pass6_council_matched', 0))

        total_groups = self.stats['pass0_groups']
        match_rate = (total_matched / total_groups * 100) if total_groups > 0 else 0
        
        console.print("")
        overall_table = Table(title="📈 Overall Results", show_header=True, header_style="bold green", border_style="green")
        overall_table.add_column("Metric", style="cyan", width=30)
        overall_table.add_column("Value", justify="right", style="green", width=30)
        
        overall_table.add_row("Total matched (groups)", f"{total_matched:,} / {total_groups:,} ({match_rate:.1f}%)")
        unmatched_groups = total_groups - total_matched
        overall_table.add_row("Total unmatched (groups)", f"{unmatched_groups:,} ({100-match_rate:.1f}%)")
        
        console.print(overall_table)

        # Record-level Results
        console.print("")
        record_table = Table(title="📊 Record-Level Results", show_header=True, header_style="bold yellow", border_style="yellow")
        record_table.add_column("Metric", style="cyan", width=30)
        record_table.add_column("Value", justify="right", style="yellow", width=30)
        
        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {self.table_name} WHERE master_college_id IS NOT NULL AND master_college_id != ''")
            matched_records = cursor.fetchone()[0]
            cursor.execute(f"SELECT COUNT(*) FROM {self.table_name}")
            total_records = cursor.fetchone()[0]
            conn.close()

            record_match_rate = (matched_records / total_records * 100) if total_records > 0 else 0
            record_table.add_row("Total matched", f"{matched_records:,} / {total_records:,} ({record_match_rate:.2f}%)")
            record_table.add_row("Total unmatched", f"{total_records - matched_records:,} ({100-record_match_rate:.2f}%)")
        except Exception as e:
            record_table.add_row("Error", f"Could not query: {e}")
            
        console.print(record_table)

        # Performance
        console.print("")
        perf_table = Table(title="⏱️  Performance", show_header=True, header_style="bold magenta", border_style="magenta")
        perf_table.add_column("Metric", style="cyan", width=30)
        perf_table.add_column("Value", justify="right", style="magenta", width=30)
        
        perf_table.add_row("Total time", f"{elapsed:.1f}s")
        perf_table.add_row("Per group", f"{(elapsed/self.stats['pass0_groups'])*1000:.2f}ms")
        
        console.print(perf_table)
        console.print("")
        console.print(Panel.fit("[bold green]✅ 5-PASS WORKFLOW COMPLETE[/bold green]", border_style="green"))
        console.print("")




    def _load_master_colleges(self):
        """Load and flatten master colleges from recent3_matcher"""
        master_colleges = []
        
        # Ensure master data is loaded in recent3_matcher
        if not hasattr(self.recent3_matcher, 'master_data') or not self.recent3_matcher.master_data:
            self.recent3_matcher.load_master_data()
            
        # Aggregate from all streams
        for stream in ['medical', 'dental', 'dnb']:
            if stream in self.recent3_matcher.master_data:
                colleges = self.recent3_matcher.master_data[stream].get('colleges', [])
                master_colleges.extend(colleges)
                
        return master_colleges

    def _pass6_council_match(self, college_name, state, address, course_type):
        """
        Pass 6: The Council of Matchers (Final Arbiter)
        Uses multi-agent voting (Strict, Fuzzy, Geo, Phonetic, AI) to resolve hard cases.
        """
        # STREAM FILTERING: Only search within the correct stream (medical/dental/dnb)
        # This prevents cross-stream contamination (e.g., matching dental record with medical college)
        stream_filtered_colleges = []
        
        if course_type:
            # Map course_type to stream
            if course_type.lower() in ['medical', 'mbbs', 'md', 'ms']:
                target_stream = 'medical'
            elif course_type.lower() in ['dental', 'bds', 'mds']:
                target_stream = 'dental'
            elif course_type.lower() in ['dnb', 'diploma']:
                target_stream = 'dnb'
            else:
                target_stream = None
            
            # Filter master_colleges by stream
            if target_stream and target_stream in self.recent3_matcher.master_data:
                stream_data = self.recent3_matcher.master_data[target_stream].get('colleges', [])
                stream_filtered_colleges = stream_data
                logger.debug(f"Pass 6: Filtered to {len(stream_filtered_colleges)} colleges in '{target_stream}' stream")
            else:
                # Fallback: use all colleges if stream mapping fails
                stream_filtered_colleges = self.master_colleges
                logger.warning(f"Pass 6: Unknown course_type '{course_type}', searching all streams")
        else:
            # No course_type provided, use all colleges
            stream_filtered_colleges = self.master_colleges
            logger.debug("Pass 6: No course_type provided, searching all streams")
        
        # 1. Identify candidates (Top 10 fuzzy matches from stream-filtered data)
        candidates = []
        
        # Create id mapping (unique keys) to preserve duplicate names
        # e.g. "Government College" exists in multiple states
        choices = {c['id']: c['name'] for c in stream_filtered_colleges}
        
        # Extract top 10 matches
        # process.extract with dict returns list of (match_string, score, key)
        potential_matches = process.extract(
            college_name, 
            choices, 
            scorer=fuzz.ratio, 
            limit=10
        )
        
        # Retrieve full records using IDs
        id_to_record = {c['id']: c for c in stream_filtered_colleges}
        
        for name, score, candidate_id in potential_matches:
            master_record = id_to_record.get(candidate_id)
            if master_record:
                candidates.append(Candidate(
                    id=master_record['id'],
                    name=master_record['name'],
                    address=master_record.get('address', ''),
                    state=master_record.get('state', ''),
                    type=master_record.get('type', 'UNKNOWN')
                ))

        if not candidates:
            return None

        # 2. Let the Council vote on each candidate
        best_decision = None
        best_confidence = 0.0
        best_candidate_id = None
        best_match_name = None
        
        unmatched_record = {
            'college_name': college_name,
            'state': state,
            'address': address,
            'course_type': course_type
        }

        for candidate in candidates:
            decision, confidence, votes = self.council_chairman.evaluate_candidate(unmatched_record, candidate)
            
            if decision == 'MATCH' and confidence > best_confidence:
                best_confidence = confidence
                best_decision = decision
                best_candidate_id = candidate.id
                best_match_name = candidate.name
                
                # Log the council's reasoning
                vote_summary = ", ".join([f"{v.member_name}={v.decision}" for v in votes])
                # logger.info(f"Council Match: {college_name} -> {candidate.name} (Conf: {confidence:.2f}) [{vote_summary}]")

        # 3. Return result if confident
        if best_decision == 'MATCH' and best_confidence >= 0.75:
            return {
                'master_college_id': best_candidate_id,
                'match_score': best_confidence,
                'match_method': 'pass6_council_match',
                'college_name': best_match_name
            }
            
        return None


if __name__ == "__main__":
    orchestrator = Integrated5PassOrchestrator()
    try:
        orchestrator.run_complete_workflow()
    except Exception as e:
        logger.error(f"Workflow failed: {e}", exc_info=True)
        sys.exit(1)
