#!/usr/bin/env python3
"""
PASS 8: Cross-Group Consistency Validator with Ensemble Voting

Detects silent false matches by comparing groups matched to the same master_college_id.

ENSEMBLE VOTING SYSTEM:
Uses 7 similarity measures with weighted voting:
1. Token Set Ratio (word overlap)
2. Token Sort Ratio (order-independent)
3. Levenshtein Ratio (character-level)
4. Jaccard Similarity (set intersection)
5. N-gram Similarity (character patterns)
6. Vector/Semantic Similarity (BGE embeddings)
7. Unique Identifier Match (proper noun presence)

Logic:
1. For each master_college_id with multiple groups matched to it
2. Calculate ensemble similarity score (weighted average of all methods)
3. Flag as DEVIATION if:
   - Unique identifier match < 50% (critical)
   - Vector similarity < 70% (critical)
   - Weighted ensemble score < 60%
4. Delink flagged groups and route to interactive review
"""

import sqlite3
import logging
import warnings
import os
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict, Counter
from rapidfuzz import fuzz
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

# Suppress verbose tokenizer warnings and tqdm progress bars
warnings.filterwarnings("ignore", message=".*fast tokenizer.*")
warnings.filterwarnings("ignore", message=".*XLMRobertaTokenizerFast.*")

# Disable tqdm globally before FlagEmbedding loads
os.environ['TQDM_DISABLE'] = '1'

# Also patch tqdm.auto to disable progress bars
try:
    from tqdm import tqdm
    from functools import partialmethod
    tqdm.__init__ = partialmethod(tqdm.__init__, disable=True)
except:
    pass

logger = logging.getLogger(__name__)
console = Console()


@dataclass
class EnsembleScores:
    """Ensemble similarity scores breakdown."""
    token_set: float = 0.0
    token_sort: float = 0.0
    levenshtein: float = 0.0
    jaccard: float = 0.0
    ngram: float = 0.0
    vector: float = 0.0
    unique_id: float = 0.0
    address: float = 0.0  # Address similarity for multi-campus detection
    phonetic: float = 0.0  # Phonetic similarity (Metaphone) for sound-alike names
    weighted_total: float = 0.0
    
    def to_dict(self) -> Dict[str, float]:
        return {
            'token_set': self.token_set,
            'token_sort': self.token_sort,
            'levenshtein': self.levenshtein,
            'jaccard': self.jaccard,
            'ngram': self.ngram,
            'vector': self.vector,
            'unique_id': self.unique_id,
            'address': self.address,
            'phonetic': self.phonetic,
            'weighted': self.weighted_total,
        }


@dataclass
class GroupInfo:
    """Information about a matched group."""
    group_id: int
    normalized_college_name: str
    normalized_address: str
    normalized_state: str
    record_count: int
    match_score: float
    match_method: str
    sample_course: str = ''
    course_type: str = ''


@dataclass
class DeviationResult:
    """Result of deviation detection for a group."""
    group_id: int
    college_name: str
    record_count: int
    master_college_id: str
    master_name: str
    similarity_to_master: float
    similarity_to_majority: float
    is_minority: bool
    deviation_reason: str
    ensemble_scores: EnsembleScores = field(default_factory=EnsembleScores)


class CrossGroupValidator:
    """
    PASS 8: Validates consistency of groups matched to the same master_college_id.
    
    Uses ENSEMBLE VOTING with 7 similarity measures for robust detection.
    """
    
    # Thresholds for deviation detection
    MIN_SIMILARITY_TO_MASTER = 50.0  # Minimum weighted ensemble similarity
    MIN_SIMILARITY_TO_MAJORITY = 40.0  # Minimum similarity to majority group
    MINORITY_THRESHOLD = 0.10  # Groups with < 10% of total records are suspicious
    
    # Critical thresholds (fail any = deviation)
    CRITICAL_UNIQUE_ID_THRESHOLD = 50.0  # Unique identifier match threshold
    CRITICAL_VECTOR_THRESHOLD = 70.0  # Vector similarity threshold
    
    # Ensemble weights (must sum to 1.0)
    ENSEMBLE_WEIGHTS = {
        'token_set': 0.10,
        'token_sort': 0.08,
        'levenshtein': 0.08,
        'jaccard': 0.10,
        'ngram': 0.07,
        'vector': 0.20,  # Highest weight for semantic similarity
        'unique_id': 0.12,  # Critical for catching false matches
        'address': 0.15,  # Address similarity for multi-campus detection
        'phonetic': 0.10,  # Phonetic similarity (Metaphone) for sound-alike names
    }
    
    # Critical threshold for address mismatch
    CRITICAL_ADDRESS_THRESHOLD = 50.0  # Flag if address similarity < 50% (raised from 30%)
    
    # Acronym expansions (loaded from config.yaml)
    ACRONYM_EXPANSIONS = {}
    
    def __init__(
        self,
        counselling_db_path: str = 'data/sqlite/counselling_data_partitioned.db',
        master_db_path: str = 'data/sqlite/master_data.db',
        table_name: str = 'counselling_records',  # Support seat_data or counselling_records
    ):
        self.counselling_db_path = counselling_db_path
        self.master_db_path = master_db_path
        self.table_name = table_name  # Use this instead of hardcoded table name
        self._embedding_model = None
        self._embedding_cache: Dict[str, np.ndarray] = {}
        
        # Past decisions cache (loaded on first use)
        self._past_decisions: Dict[str, str] = {}
        self._decisions_loaded = False
        
        # Ensure deviation_decisions table exists
        self._ensure_deviation_decisions_table()
        
        # Load acronym expansions from config.yaml
        self._load_acronym_expansions()
    
    def _ensure_deviation_decisions_table(self):
        """Create deviation_decisions table if it doesn't exist."""
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS deviation_decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                master_college_id TEXT NOT NULL,
                group_college_name TEXT NOT NULL,
                normalized_state TEXT,
                decision TEXT NOT NULL,  -- 'APPROVED' | 'REJECTED'
                deviation_reason TEXT,
                decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(master_college_id, group_college_name, normalized_state)
            )
        """)
        
        # Create index for fast lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_deviation_decisions_lookup 
            ON deviation_decisions(master_college_id, group_college_name, normalized_state)
        """)
        
        conn.commit()
        conn.close()
    
    def load_past_decisions(self) -> Dict[str, str]:
        """
        Load past deviation decisions from database.
        
        Returns:
            Dict mapping (master_id, group_name, state) -> decision ('APPROVED' or 'REJECTED')
        """
        if self._decisions_loaded:
            return self._past_decisions
        
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT master_college_id, group_college_name, normalized_state, decision
            FROM deviation_decisions
        """)
        
        for row in cursor.fetchall():
            master_id, group_name, state, decision = row
            # Create key from (master_id, group_name, state)
            key = f"{master_id}|{(group_name or '').upper()}|{(state or '').upper()}"
            self._past_decisions[key] = decision
        
        conn.close()
        self._decisions_loaded = True
        
        approved = sum(1 for d in self._past_decisions.values() if d == 'APPROVED')
        rejected = sum(1 for d in self._past_decisions.values() if d == 'REJECTED')
        
        if self._past_decisions:
            console.print(f"[cyan]📚 Loaded {len(self._past_decisions)} past decisions: {approved} APPROVED, {rejected} REJECTED[/cyan]")
        
        return self._past_decisions
    
    def save_deviation_decision(self, master_id: str, group_name: str, state: str, decision: str, reason: str = None):
        """
        Save a deviation decision to the database.
        
        Args:
            master_id: Master college ID
            group_name: Group college name
            state: Normalized state
            decision: 'APPROVED' or 'REJECTED'
            reason: Optional reason for the deviation
        """
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO deviation_decisions 
                (master_college_id, group_college_name, normalized_state, decision, deviation_reason, decided_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            """, (master_id, (group_name or '').upper(), (state or '').upper(), decision, reason))
            conn.commit()
            
            # Update cache
            key = f"{master_id}|{(group_name or '').upper()}|{(state or '').upper()}"
            self._past_decisions[key] = decision
            
        except Exception as e:
            logger.error(f"Failed to save deviation decision: {e}")
        finally:
            conn.close()
    
    def check_past_decision(self, master_id: str, group_name: str, state: str) -> Optional[str]:
        """
        Check if there's a past decision for this deviation.
        
        Returns:
            'APPROVED', 'REJECTED', or None if no past decision
        """
        if not self._decisions_loaded:
            self.load_past_decisions()
        
        key = f"{master_id}|{(group_name or '').upper()}|{(state or '').upper()}"
        return self._past_decisions.get(key)

        
    def _get_master_college_name(self, college_id: str) -> Optional[str]:
        """Get the normalized name of a master college."""
        result = self._get_master_college_info(college_id)
        return result[0] if result else None
    
    def _load_acronym_expansions(self):
        """Load acronym expansions from config.yaml."""
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            # Load acronym expansions for ensemble voting
            acronyms = config.get('pass8_cross_group', {}).get('acronym_expansions', {})
            self.ACRONYM_EXPANSIONS = {k.upper(): v.upper() for k, v in acronyms.items()}
            
            if self.ACRONYM_EXPANSIONS:
                logger.info(f"Loaded {len(self.ACRONYM_EXPANSIONS)} acronym expansions")
        except Exception as e:
            logger.warning(f"Could not load acronym expansions: {e}")
            self.ACRONYM_EXPANSIONS = {}
    
    def _expand_acronyms(self, text: str) -> str:
        """Expand acronyms in text using config mappings."""
        if not text:
            return text
        
        words = text.upper().split()
        expanded = []
        for word in words:
            if word in self.ACRONYM_EXPANSIONS:
                expanded.append(self.ACRONYM_EXPANSIONS[word])
            else:
                expanded.append(word)
        return ' '.join(expanded)
    
    def _check_initial_letter_match(self, master_name: str, group_name: str) -> Tuple[bool, float, str]:
        """
        Check if abbreviated master name matches group name's initial letters.
        
        This catches cases like:
        - Master: "V S DENTAL COLLEGE" → V, S should match group's first-letter initials
        - Group: "VOKKALIGARA SANGHA DENTAL COLLEGE" → V, S ✓
        - Group: "VENKATESWARA DENTAL COLLEGE" → V only ✗
        
        Returns:
            Tuple of (is_valid_match, confidence, reason)
        """
        if not master_name or not group_name:
            return True, 1.0, "Missing name data"
        
        # Generic words to ignore
        GENERIC_WORDS = {
            'MEDICAL', 'DENTAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'UNIVERSITY',
            'AND', 'OF', 'THE', 'FOR', 'A', 'AN', 'IN', 'AT', 'TO', 'SCIENCES',
            'SCIENCE', 'HEALTH', 'CARE', 'CENTRE', 'CENTER', 'POSTGRADUATE',
            'POST', 'GRADUATE', 'PG', 'GOVT', 'GOVERNMENT', 'PRIVATE', 'PVT',
            'TRUST', 'SOCIETY', 'FOUNDATION', 'MEMORIAL', 'SHRI', 'SRI', 'DR'
        }
        
        master_upper = master_name.upper()
        group_upper = group_name.upper()
        master_words = [w for w in master_upper.split() if w not in GENERIC_WORDS]
        group_words = [w for w in group_upper.split() if w not in GENERIC_WORDS]
        
        if not master_words or not group_words:
            return True, 1.0, "Only generic words"
        
        # Detect abbreviated words (1-2 chars, all caps single letters)
        def is_abbreviated(word: str) -> bool:
            return len(word) <= 2 or (len(word) <= 3 and word.isalpha() and word.isupper())
        
        master_abbreviated = [w for w in master_words if is_abbreviated(w)]
        
        # If master has no abbreviations, skip this check
        if not master_abbreviated:
            return True, 1.0, "No abbreviations in master"
        
        # Check if abbreviations match group name initials
        # "V S" should match first letters of "VOKKALIGARA SANGHA"
        group_initials = [w[0] for w in group_words if len(w) > 2]
        
        matched_abbrevs = 0
        total_abbrevs = len(master_abbreviated)
        
        for abbrev in master_abbreviated:
            # Check if abbreviation letters appear in sequence in group initials
            if abbrev in group_initials:
                matched_abbrevs += 1
            elif len(abbrev) == 1 and abbrev in group_initials:
                matched_abbrevs += 1
            else:
                # Check if any group word STARTS with this abbreviation
                if any(gw.startswith(abbrev) for gw in group_words):
                    matched_abbrevs += 1
        
        match_ratio = matched_abbrevs / total_abbrevs if total_abbrevs > 0 else 1.0
        
        if match_ratio >= 0.8:
            return True, match_ratio, f"Initials match ({matched_abbrevs}/{total_abbrevs})"
        elif match_ratio >= 0.5:
            return True, match_ratio, f"Partial initial match ({matched_abbrevs}/{total_abbrevs})"
        else:
            return False, match_ratio, f"ACRONYM MISMATCH: '{' '.join(master_abbreviated)}' not in '{group_upper[:40]}' ({matched_abbrevs}/{total_abbrevs})"
    
    def _get_master_college_info(self, college_id: str) -> Optional[Tuple[str, str, str]]:
        """Get the normalized name, address, and state of a master college.
        
        Returns:
            Tuple of (name, address, state) or None if not found
        """
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        # Determine table based on prefix
        if college_id.startswith('MED'):
            table = 'medical_colleges'
        elif college_id.startswith('DEN'):
            table = 'dental_colleges'
        elif college_id.startswith('DNB'):
            table = 'dnb_colleges'
        else:
            conn.close()
            return None
        
        cursor.execute(f"""
            SELECT 
                COALESCE(normalized_name, name) as name,
                COALESCE(normalized_address, address, '') as address,
                COALESCE(normalized_state, state, '') as state
            FROM {table}
            WHERE id = ?
        """, (college_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        return (row[0], row[1], row[2]) if row else None
    
    def _get_groups_by_master_id(self) -> Dict[str, List[GroupInfo]]:
        """
        Get all matched groups from counselling_records, grouped by master_college_id.
        
        Groups records by (normalized_college_name, normalized_address, normalized_state)
        for each master_college_id.
        """
        conn = sqlite3.connect(self.counselling_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Query to get groups - using configurable table name for seat_data or counselling_records
        cursor.execute(f"""
            SELECT 
                master_college_id,
                normalized_college_name,
                COALESCE(normalized_address, '') as normalized_address,
                COALESCE(normalized_state, state) as normalized_state,
                COUNT(*) as record_count,
                AVG(college_match_score) as avg_match_score,
                college_match_method,
                MAX(course_name) as sample_course,
                MAX(course_type) as course_type
            FROM {self.table_name}
            WHERE master_college_id IS NOT NULL 
            AND master_college_id != ''
            GROUP BY master_college_id, normalized_college_name, normalized_address, normalized_state
            ORDER BY master_college_id, record_count DESC
        """)
        
        groups_by_master: Dict[str, List[GroupInfo]] = defaultdict(list)
        
        for row in cursor.fetchall():
            group = GroupInfo(
                group_id=0,  # Will be assigned later if needed
                normalized_college_name=row['normalized_college_name'] or '',
                normalized_address=row['normalized_address'] or '',
                normalized_state=row['normalized_state'] or '',
                record_count=row['record_count'],
                match_score=row['avg_match_score'] or 0.0,
                match_method=row['college_match_method'] or '',
                sample_course=row['sample_course'] or '',
                course_type=row['course_type'] or '',
            )
            groups_by_master[row['master_college_id']].append(group)
        
        conn.close()
        
        # Filter to only master_ids with multiple groups (potential deviations)
        multi_group_masters = {
            mid: groups for mid, groups in groups_by_master.items()
            if len(groups) > 1
        }
        
        logger.info(f"Found {len(multi_group_masters)} master colleges with multiple matched groups")
        return multi_group_masters
    
    # Generic words that exist in almost all medical college names
    # These should NOT be considered unique identifiers
    GENERIC_WORDS = frozenset({
        # Common institutional terms
        'INSTITUTE', 'INSTITUTION', 'COLLEGE', 'UNIVERSITY', 'ACADEMY', 'SCHOOL',
        'HOSPITAL', 'MEDICAL', 'DENTAL', 'NURSING', 'PHARMACY', 'PARAMEDICAL',
        'CENTRE', 'CENTER', 'FOUNDATION', 'TRUST', 'SOCIETY', 'ASSOCIATION',
        # Common descriptors
        'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'AUTONOMOUS', 'STATE', 'NATIONAL',
        'DISTRICT', 'REGIONAL', 'GENERAL', 'SUPER', 'SPECIALTY', 'SPECIALITY',
        'MULTI', 'TEACHING', 'RESEARCH', 'EDUCATION', 'STUDIES', 'TRAINING',
        # Common prepositions/articles
        'OF', 'AND', 'THE', 'FOR', 'IN', 'AT', 'WITH', 'BY',
        # Common suffixes
        'POST', 'GRADUATE', 'POSTGRADUATE', 'UNDER', 'UNDERGRADUATE',
        'SCIENCES', 'SCIENCE', 'ARTS', 'TECHNOLOGY',
        # Common abbreviations (expanded forms)
        'ALL', 'INDIA', 'INDIAN',
    })
    
    def _extract_unique_identifiers(self, name: str) -> set:
        """
        Extract unique identifying words from a college name.
        
        Removes generic institutional words to find differentiating terms.
        
        Examples:
            'GB PANT INSTITUTE OF POSTGRADUATE MEDICAL EDUCATION' → {'GB', 'PANT'}
            'POST GRADUATE INSTITUTE OF MEDICAL EDUCATION' → set() (all generic!)
            'SAFDARJUNG HOSPITAL NEW DELHI' → {'SAFDARJUNG', 'NEW', 'DELHI'}
        """
        if not name:
            return set()
        
        words = name.upper().split()
        unique = {w for w in words if w not in self.GENERIC_WORDS and len(w) > 1}
        return unique
    
    def _check_unique_identifier_match(self, group_name: str, master_name: str) -> Tuple[bool, str]:
        """
        Intelligent check: Does the group contain the unique identifiers from master?
        
        Returns:
            Tuple of (has_match, reason)
            
        Example:
            Master: 'GB PANT INSTITUTE...' → unique: {'GB', 'PANT'}
            Group1: 'POST GRADUATE INSTITUTE...' → unique: {} → MISSING 'PANT'! → False
            Group2: 'G B PANT INSTITUTE...' → unique: {'G', 'B', 'PANT'} → Has 'PANT' → True
        """
        master_unique = self._extract_unique_identifiers(master_name)
        group_unique = self._extract_unique_identifiers(group_name)
        
        if not master_unique:
            # Master has no unique identifiers, fall back to fuzzy match
            return True, "Master has no unique identifiers"
        
        # Check what percentage of master's unique words are in group
        matched_words = master_unique & group_unique
        match_ratio = len(matched_words) / len(master_unique) if master_unique else 0
        
        # Also check for partial matches (G B vs GB)
        # Join group words and check if master words appear as substrings
        group_text = ' '.join(group_unique)
        partial_matches = sum(1 for w in master_unique if w in group_text or any(w in gw or gw in w for gw in group_unique))
        partial_ratio = partial_matches / len(master_unique) if master_unique else 0
        
        effective_ratio = max(match_ratio, partial_ratio)
        
        if effective_ratio >= 0.5:  # At least 50% of unique identifiers present
            return True, f"Found {len(matched_words)}/{len(master_unique)} unique identifiers"
        else:
            missing = master_unique - group_unique
            return False, f"Missing unique identifiers: {missing}"
    
    def _calculate_similarity(self, name1: str, name2: str) -> float:
        """Calculate fuzzy similarity between two names (legacy method for compatibility)."""
        if not name1 or not name2:
            return 0.0
        return fuzz.token_set_ratio(name1.upper(), name2.upper())
    
    # ============================================================
    # ENSEMBLE SIMILARITY METHODS
    # ============================================================
    
    def _get_embedding_model(self):
        """Get embedding model via shared vector_index singleton (BGE-base-en-v1.5)."""
        if self._embedding_model is None:
            try:
                from vector_index import get_vector_index
                vector_index = get_vector_index()
                if vector_index and vector_index._engine:
                    self._embedding_model = vector_index._engine.model
                else:
                    self._embedding_model = False  # Mark as unavailable
            except Exception as e:
                logger.warning(f"Failed to get embedding model: {e}")
                self._embedding_model = False
        return self._embedding_model if self._embedding_model else None
    
    def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding vector for text with caching."""
        if not text:
            return None
        
        text_key = text.upper().strip()
        if text_key in self._embedding_cache:
            return self._embedding_cache[text_key]
        
        model = self._get_embedding_model()
        if not model:
            return None
        
        try:
            # Suppress verbose progress bars by redirecting stderr temporarily
            import sys
            import io
            from contextlib import redirect_stderr, redirect_stdout
            
            # Create null output
            null_output = io.StringIO()
            
            # Encode with suppressed output
            with redirect_stderr(null_output), redirect_stdout(null_output):
                embeddings = model.encode([text_key], batch_size=1, max_length=128)
                
            if 'dense_vecs' in embeddings:
                vec = embeddings['dense_vecs'][0]
            else:
                vec = embeddings[0]
            self._embedding_cache[text_key] = vec
            return vec
        except Exception as e:
            logger.warning(f"Embedding failed: {e}")
            return None
    
    def _calc_token_set_ratio(self, name1: str, name2: str) -> float:
        """Calculate token set ratio (word overlap, order-independent)."""
        if not name1 or not name2:
            return 0.0
        return fuzz.token_set_ratio(name1.upper(), name2.upper())
    
    def _calc_token_sort_ratio(self, name1: str, name2: str) -> float:
        """Calculate token sort ratio (sorted word comparison)."""
        if not name1 or not name2:
            return 0.0
        return fuzz.token_sort_ratio(name1.upper(), name2.upper())
    
    def _calc_levenshtein_ratio(self, name1: str, name2: str) -> float:
        """Calculate Levenshtein (character-level edit distance) ratio."""
        if not name1 or not name2:
            return 0.0
        return fuzz.ratio(name1.upper(), name2.upper())
    
    def _calc_jaccard_similarity(self, name1: str, name2: str) -> float:
        """Calculate Jaccard similarity (set intersection / union)."""
        if not name1 or not name2:
            return 0.0
        
        words1 = set(name1.upper().split())
        words2 = set(name2.upper().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return (intersection / union) * 100 if union > 0 else 0.0
    
    def _calc_ngram_similarity(self, name1: str, name2: str, n: int = 3) -> float:
        """Calculate character n-gram similarity."""
        if not name1 or not name2:
            return 0.0
        
        def get_ngrams(text: str, n: int) -> set:
            text = text.upper().replace(' ', '')
            return {text[i:i+n] for i in range(len(text) - n + 1)} if len(text) >= n else set()
        
        ngrams1 = get_ngrams(name1, n)
        ngrams2 = get_ngrams(name2, n)
        
        if not ngrams1 or not ngrams2:
            return 0.0
        
        intersection = len(ngrams1 & ngrams2)
        union = len(ngrams1 | ngrams2)
        
        return (intersection / union) * 100 if union > 0 else 0.0
    
    def _calc_vector_similarity(self, name1: str, name2: str) -> float:
        """
        Calculate semantic similarity using pre-computed vector index.
        
        Uses BGE-base-en-v1.5 embeddings with caching for fast lookups.
        """
        try:
            from vector_index import get_similarity
            
            # Expand acronyms for better semantic matching
            expanded1 = self._expand_acronyms(name1)
            expanded2 = self._expand_acronyms(name2)
            
            return get_similarity(expanded1, expanded2)
            
        except Exception as e:
            # Fallback to token_set if vector index unavailable
            logger.debug(f"Vector similarity failed: {e}")
            return self._calc_token_set_ratio(name1, name2)
    
    def _calc_unique_id_match(self, group_name: str, master_name: str) -> float:
        """
        Calculate unique identifier match percentage.
        
        Checks if GROUP contains MASTER's unique identifiers.
        This catches: 'POST GRADUATE INSTITUTE' vs 'GB PANT INSTITUTE' → 0% (missing PANT)
        
        Enhancements:
        - Uses acronym expansion (KMC → KASTURBA)
        - Uses fuzzy matching for typos (KASTOORBA → KASTURBA)
        """
        # Expand acronyms before extracting unique identifiers
        expanded_group_name = self._expand_acronyms(group_name)
        expanded_master_name = self._expand_acronyms(master_name)
        
        master_unique = self._extract_unique_identifiers(expanded_master_name)
        group_unique = self._extract_unique_identifiers(expanded_group_name)
        
        if not master_unique:
            return 100.0  # No master unique IDs = can't check, assume OK
        
        matched = set()
        
        for master_word in master_unique:
            # Check 1: Exact match
            if master_word in group_unique:
                matched.add(master_word)
                continue
            
            # Check 2: Partial match (G B vs GB)
            for group_word in group_unique:
                if master_word in group_word or group_word in master_word:
                    matched.add(master_word)
                    break
            
            # Check 3: Fuzzy match for typos (KASTOORBA vs KASTURBA)
            if master_word not in matched:
                for group_word in group_unique:
                    fuzzy_score = fuzz.ratio(master_word, group_word)
                    if fuzzy_score >= 80:  # 80% fuzzy threshold for typos
                        matched.add(master_word)
                        break
        
        return (len(matched) / len(master_unique)) * 100 if master_unique else 100.0
    
    def _calc_phonetic_similarity(self, name1: str, name2: str) -> float:
        """
        Calculate phonetic similarity using Metaphone algorithm.
        
        Compares how names SOUND rather than how they're spelled.
        - KASTOORBA ≈ KASTURBA (both encode to KSTRB) → 100%
        - MANIPAL ≠ MANGALORE (MNPL vs MNKLR) → different sounds → low score
        """
        try:
            import jellyfish
        except ImportError:
            # Fallback to fuzzy matching if jellyfish not available
            return fuzz.ratio(name1.upper(), name2.upper())
        
        # Get words from both names
        words1 = name1.upper().split()
        words2 = name2.upper().split()
        
        if not words1 or not words2:
            return 100.0
        
        # Calculate phonetic encoding for each word
        phonetics1 = [jellyfish.metaphone(w) for w in words1 if len(w) > 2]
        phonetics2 = [jellyfish.metaphone(w) for w in words2 if len(w) > 2]
        
        if not phonetics1 or not phonetics2:
            return 100.0
        
        # Count matching phonetic codes
        matched = 0
        for p1 in phonetics1:
            if p1 in phonetics2:
                matched += 1
            else:
                # Check partial phonetic match (for compound encodings)
                for p2 in phonetics2:
                    if p1 and p2 and (p1 in p2 or p2 in p1):
                        matched += 0.5
                        break
        
        return min(100.0, (matched / len(phonetics1)) * 100)
    
    def calculate_ensemble_similarity(
        self, 
        group_name: str, 
        master_name: str,
        group_address: str = '',
        master_address: str = ''
    ) -> EnsembleScores:
        """
        Calculate ensemble similarity using all 9 methods (including address and phonetic).
        
        Args:
            group_name: Normalized college name from group
            master_name: Normalized college name from master
            group_address: Normalized address from group
            master_address: Normalized address from master
        
        Returns:
            EnsembleScores with individual scores and weighted total
        """
        # Name-based similarities (including vector with BGE-base-en-v1.5)
        scores = EnsembleScores(
            token_set=self._calc_token_set_ratio(group_name, master_name),
            token_sort=self._calc_token_sort_ratio(group_name, master_name),
            levenshtein=self._calc_levenshtein_ratio(group_name, master_name),
            jaccard=self._calc_jaccard_similarity(group_name, master_name),
            ngram=self._calc_ngram_similarity(group_name, master_name, n=3),
            vector=self._calc_vector_similarity(group_name, master_name),  # Fast via cached index
            unique_id=self._calc_unique_id_match(group_name, master_name),
            # Address similarity (for multi-campus detection)
            address=self._calc_address_similarity(group_address, master_address),
            # Phonetic similarity (for sound-alike detection)
            phonetic=self._calc_phonetic_similarity(group_name, master_name),
        )
        
        # Calculate weighted total
        weights = self.ENSEMBLE_WEIGHTS
        scores.weighted_total = (
            scores.token_set * weights['token_set'] +
            scores.token_sort * weights['token_sort'] +
            scores.levenshtein * weights['levenshtein'] +
            scores.jaccard * weights['jaccard'] +
            scores.ngram * weights['ngram'] +
            scores.vector * weights['vector'] +
            scores.unique_id * weights['unique_id'] +
            scores.address * weights['address'] +
            scores.phonetic * weights['phonetic']
        )
        
        return scores
    
    def _calc_address_similarity(self, addr1: str, addr2: str) -> float:
        """
        Calculate address similarity for multi-campus detection.
        
        OCR-AWARE: Handles broken addresses with random spaces (e.g., 'MANGALUR U' → 'MANGALURU').
        Uses PHONETIC matching on addresses to catch sound-different cities:
        - MANIPAL vs MANGALORE → MNPL vs MNKLR → Different sounds → Low score
        
        Returns 100 if either address is empty (can't compare, so assume OK).
        """
        if not addr1 or not addr2:
            return 100.0  # Can't compare, assume OK
        
        addr1_upper = addr1.upper()
        addr2_upper = addr2.upper()
        
        # ============================================================
        # OCR-AWARE: Compare addresses with spaces removed first
        # This catches OCR artifacts like "MANGALUR U" vs "MANGALURU"
        # ============================================================
        addr1_nospace = addr1_upper.replace(' ', '')
        addr2_nospace = addr2_upper.replace(' ', '')
        
        # If space-normalized addresses are very similar, it's likely OCR noise
        nospace_score = fuzz.ratio(addr1_nospace, addr2_nospace)
        if nospace_score >= 85:
            return nospace_score  # OCR-fixed match, return high score
        
        # Check if one contains the other (after space normalization)
        if addr1_nospace in addr2_nospace or addr2_nospace in addr1_nospace:
            return 90.0  # One is substring of other
        
        # ============================================================
        # Standard fuzzy + phonetic matching for different locations
        # ============================================================
        fuzzy_score = fuzz.token_set_ratio(addr1_upper, addr2_upper)
        
        # Add phonetic check for addresses
        try:
            import jellyfish
            
            # Extract location words (skip short words and digits)
            words1 = [w for w in addr1_upper.split() if len(w) > 2 and not w.isdigit()]
            words2 = [w for w in addr2_upper.split() if len(w) > 2 and not w.isdigit()]
            
            if words1 and words2:
                phonetics1 = set(jellyfish.metaphone(w) for w in words1)
                phonetics2 = set(jellyfish.metaphone(w) for w in words2)
                
                # Calculate phonetic overlap
                overlap = len(phonetics1 & phonetics2)
                total = max(len(phonetics1), len(phonetics2))
                phonetic_score = (overlap / total) * 100 if total > 0 else 100.0
                
                # Return max of fuzzy and phonetic (OCR-tolerant)
                return max(fuzzy_score, phonetic_score)
        except ImportError:
            pass
        
        return fuzzy_score
    
    def is_ensemble_deviation(self, scores: EnsembleScores) -> Tuple[bool, List[str]]:
        """
        Determine if ensemble scores indicate a deviation.
        
        Returns:
            Tuple of (is_deviation, list_of_reasons)
        """
        reasons = []
        
        # Critical checks (any fail = deviation)
        if scores.unique_id < self.CRITICAL_UNIQUE_ID_THRESHOLD:
            reasons.append(f"CRITICAL: Unique ID {scores.unique_id:.0f}% < {self.CRITICAL_UNIQUE_ID_THRESHOLD}%")
        
        # Vector similarity check (now fast via BGE-base-en-v1.5 index)
        if scores.vector < self.CRITICAL_VECTOR_THRESHOLD:
            reasons.append(f"CRITICAL: Vector {scores.vector:.0f}% < {self.CRITICAL_VECTOR_THRESHOLD}%")
        
        # Address mismatch check (for multi-campus detection)
        if scores.address < self.CRITICAL_ADDRESS_THRESHOLD:
            reasons.append(f"CRITICAL: Address {scores.address:.0f}% < {self.CRITICAL_ADDRESS_THRESHOLD}%")
        
        # Overall weighted score check
        if scores.weighted_total < self.MIN_SIMILARITY_TO_MASTER:
            reasons.append(f"LOW ENSEMBLE: Weighted {scores.weighted_total:.0f}% < {self.MIN_SIMILARITY_TO_MASTER}%")
        
        return len(reasons) > 0, reasons
    
    def _detect_deviations(
        self, 
        master_id: str, 
        groups: List[GroupInfo],
        master_name: str,
        master_address: str = ''
    ) -> List[DeviationResult]:
        """
        Detect deviating groups for a single master_college_id.
        
        Uses ENSEMBLE VOTING with 8 similarity methods (including address) for robust detection.
        Now checks past decisions to skip already-approved groups.
        
        Returns list of groups that should be flagged for review.
        """
        deviations = []
        
        if len(groups) < 2:
            return deviations
        
        # Find majority group (most records)
        total_records = sum(g.record_count for g in groups)
        majority_group = max(groups, key=lambda g: g.record_count)
        
        for group in groups:
            # NEW: Check past decisions first
            past_decision = self.check_past_decision(
                master_id, group.normalized_college_name, group.normalized_state
            )
            
            if past_decision == 'APPROVED':
                # User already approved this match - skip silently
                continue
            
            # Calculate ENSEMBLE similarity to master (including address)
            ensemble_scores = self.calculate_ensemble_similarity(
                group_name=group.normalized_college_name,
                master_name=master_name,
                group_address=group.normalized_address,
                master_address=master_address
            )
            
            # Also calculate similarity to majority (for display purposes)
            sim_to_majority = self._calculate_similarity(
                group.normalized_college_name, majority_group.normalized_college_name
            )
            
            # Check if this group is a minority
            is_minority = (group.record_count / total_records) < self.MINORITY_THRESHOLD
            
            # Use ENSEMBLE voting to determine deviation
            is_deviation, deviation_reasons = self.is_ensemble_deviation(ensemble_scores)
            
            # NEW: Acronym/Initial letter mismatch check
            # Catches "V S DENTAL" vs "VENKATESWARA DENTAL" (V,S not matching)
            initial_match, initial_conf, initial_reason = self._check_initial_letter_match(
                master_name, group.normalized_college_name
            )
            if not initial_match:
                if not is_deviation:
                    is_deviation = True
                deviation_reasons.append(f"CRITICAL: {initial_reason}")
            
            # Additional check: Low similarity to majority AND is minority
            if sim_to_majority < self.MIN_SIMILARITY_TO_MAJORITY and is_minority:
                if not is_deviation:
                    is_deviation = True
                deviation_reasons.append(
                    f"MINORITY: {group.record_count}/{total_records} with low majority sim ({sim_to_majority:.0f}%)"
                )
            
            if is_deviation:
                deviations.append(DeviationResult(
                    group_id=0,
                    college_name=group.normalized_college_name,
                    record_count=group.record_count,
                    master_college_id=master_id,
                    master_name=master_name,
                    similarity_to_master=ensemble_scores.weighted_total,  # Use ensemble score
                    similarity_to_majority=sim_to_majority,
                    is_minority=is_minority,
                    deviation_reason="; ".join(deviation_reasons),
                    ensemble_scores=ensemble_scores,
                ))
        
        return deviations
    
    def validate_all(self, dry_run: bool = True) -> Tuple[int, int, List[DeviationResult]]:
        """
        Run cross-group validation on all matched records.
        
        Args:
            dry_run: If True, only report deviations without delinking
            
        Returns:
            Tuple of (total_master_ids_checked, deviations_found, deviation_details)
        """
        console.print("\n[bold cyan]═══ PASS 8: Cross-Group Consistency Validator ═══[/bold cyan]\n")
        
        # Get groups by master_id
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Loading matched groups...", total=None)
            groups_by_master = self._get_groups_by_master_id()
            progress.update(task, completed=True)
        
        console.print(f"[dim]Found {len(groups_by_master)} master colleges with multiple matched groups[/dim]")
        
        all_deviations: List[DeviationResult] = []
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Checking for deviations...", total=len(groups_by_master))
            
            for master_id, groups in groups_by_master.items():
                # Get master college info (name, address, state)
                master_info = self._get_master_college_info(master_id)
                if not master_info:
                    progress.advance(task)
                    continue
                master_name = master_info[0]
                master_address = master_info[1]
                
                # Detect deviations (with address comparison)
                deviations = self._detect_deviations(master_id, groups, master_name, master_address)
                all_deviations.extend(deviations)
                
                progress.advance(task)
        
        # Report results
        if all_deviations:
            console.print(f"\n[bold red]⚠️  Found {len(all_deviations)} deviating groups![/bold red]\n")
            
            # Create results table
            table = Table(title="Deviating Groups", show_lines=True)
            table.add_column("Master ID", style="cyan")
            table.add_column("Master Name", style="green", max_width=30)
            table.add_column("Group Name", style="yellow", max_width=35)
            table.add_column("Records", justify="right")
            table.add_column("Sim→Master", justify="right")
            table.add_column("Sim→Majority", justify="right")
            table.add_column("Reason", style="red", max_width=40)
            
            for dev in all_deviations[:20]:  # Show first 20
                table.add_row(
                    dev.master_college_id,
                    dev.master_name[:30] + "..." if len(dev.master_name) > 30 else dev.master_name,
                    dev.college_name[:35] + "..." if len(dev.college_name) > 35 else dev.college_name,
                    str(dev.record_count),
                    f"{dev.similarity_to_master:.0f}%",
                    f"{dev.similarity_to_majority:.0f}%",
                    dev.deviation_reason[:40],
                )
            
            console.print(table)
            
            if len(all_deviations) > 20:
                console.print(f"[dim]... and {len(all_deviations) - 20} more deviations[/dim]")
            
            if not dry_run:
                # Delink the deviating groups
                delinked = self._delink_deviations(all_deviations)
                console.print(f"\n[bold green]✓ Delinked {delinked} records from false matches[/bold green]")
            else:
                console.print(f"\n[dim]Dry run - no changes made. Use dry_run=False to delink.[/dim]")
        else:
            console.print(f"\n[bold green]✓ No deviations found - all matches are consistent![/bold green]")
        
        return len(groups_by_master), len(all_deviations), all_deviations
    
    def validate_interactive(self) -> Tuple[int, int]:
        """
        Interactive validation - shows all groups per master and lets user choose which to delink.
        
        Now saves decisions to deviation_decisions table for learning.
        
        Returns:
            Tuple of (masters_reviewed, records_delinked)
        """
        console.print("\n[bold cyan]═══ PASS 8: Interactive Cross-Group Validator ═══[/bold cyan]\n")
        
        # Load past decisions first
        self.load_past_decisions()
        
        # Get groups by master_id
        console.print("[dim]Loading matched groups...[/dim]")
        groups_by_master = self._get_groups_by_master_id()
        
        console.print(f"Found [bold]{len(groups_by_master)}[/bold] master colleges with multiple matched groups\n")
        
        total_delinked = 0
        masters_reviewed = 0
        approved_count = 0
        rejected_count = 0
        
        # Process each master that has potential deviations
        for master_id, groups in groups_by_master.items():
            # Get full master info (name, address, state) first
            master_info = self._get_master_college_info(master_id)
            if not master_info:
                continue
            
            master_name = master_info[0]
            master_address = master_info[1]
            master_state = master_info[2]
            
            # Detect deviations for this master (with address comparison)
            deviations = self._detect_deviations(master_id, groups, master_name, master_address)
            
            if not deviations:
                continue  # No deviations for this master
            
            masters_reviewed += 1
            master_state = master_info[2] if master_info else ""
            
            # Show master info (full, untruncated)
            console.print(f"\n[bold yellow]{'='*80}[/bold yellow]")
            console.print(f"[bold cyan]MASTER: {master_id}[/bold cyan]")
            console.print(f"[bold green]Name:[/bold green] {master_name}")
            console.print(f"[bold green]State:[/bold green] {master_state or '(not set)'}")
            console.print(f"[bold green]Address:[/bold green] {master_address or '(not set)'}")
            console.print(f"[dim]Unique IDs: {self._extract_unique_identifiers(master_name)}[/dim]")
            console.print()
            
            # Show all groups (full, untruncated)
            console.print(f"[bold]MATCHED GROUPS ({len(groups)}):[/bold]")
            
            group_map = {}  # Map index to group info
            deviation_indices = set()
            
            for idx, group in enumerate(groups, 1):
                group_unique = self._extract_unique_identifiers(group.normalized_college_name)
                sim_to_master = self._calculate_similarity(group.normalized_college_name, master_name)
                
                # Check if this group is a deviation
                is_deviation = any(
                    d.college_name == group.normalized_college_name 
                    for d in deviations
                )
                
                status = "[bold red]⚠️ DEVIATION[/bold red]" if is_deviation else "[bold green]✓ OK[/bold green]"
                
                if is_deviation:
                    deviation_indices.add(idx)
                    dev = next((d for d in deviations if d.college_name == group.normalized_college_name), None)
                    reason = dev.deviation_reason if dev else ""
                
                # Print group in card format
                console.print(f"\n[bold white]───── Group {idx} ───── {status}[/bold white]")
                console.print(f"  [yellow]Name:[/yellow] {group.normalized_college_name}")
                console.print(f"  [cyan]State:[/cyan] {group.normalized_state or '(none)'}")
                console.print(f"  [dim]Address:[/dim] {group.normalized_address or '(none)'}")
                console.print(f"  [magenta]Type:[/magenta] {group.course_type or '-'} | [magenta]Sample:[/magenta] {group.sample_course or '-'}")
                console.print(f"  [white]Records:[/white] {group.record_count}")
                console.print(f"  [dim]Unique IDs:[/dim] {group_unique if group_unique else '(none)'}")
                
                # Calculate and show ENSEMBLE scores for this group (with address)
                ensemble = self.calculate_ensemble_similarity(
                    group_name=group.normalized_college_name,
                    master_name=master_name,
                    group_address=group.normalized_address,
                    master_address=master_address
                )
                console.print(f"  [bold]Ensemble Scores:[/bold]")
                console.print(f"    TSet:{ensemble.token_set:.0f} TSort:{ensemble.token_sort:.0f} Lev:{ensemble.levenshtein:.0f} Jac:{ensemble.jaccard:.0f} Ngram:{ensemble.ngram:.0f} Vec:{ensemble.vector:.0f} UID:{ensemble.unique_id:.0f} Addr:{ensemble.address:.0f} → [bold]Wgt:{ensemble.weighted_total:.0f}%[/bold]")
                
                if is_deviation and reason:
                    console.print(f"  [bold red]Reason:[/bold red] {reason}")
                
                group_map[idx] = group
            
            # No need for separate deviation details, already shown inline
            
            # Ask user which groups to delink
            console.print("\n[bold]Options:[/bold]")
            console.print("  Enter group numbers to delink (e.g., '1' or '1,2,3')")
            console.print("  Enter 'd' to delink all flagged deviations")
            console.print("  Press [bold]Enter[/bold] to skip this master")
            console.print("  Enter 'q' to quit interactive review")
            
            while True:
                choice = console.input("\n[bold cyan]Your choice (Enter to skip): [/bold cyan]").strip().lower()
                
                if choice == 'q':
                    console.print("\n[yellow]Exiting interactive review...[/yellow]")
                    console.print(f"[dim]Decisions saved: {approved_count} APPROVED, {rejected_count} REJECTED[/dim]")
                    return masters_reviewed, total_delinked
                
                if choice == '' or choice == 's':
                    # Skip = APPROVE all groups for this master
                    for group in groups:
                        self.save_deviation_decision(
                            master_id=master_id,
                            group_name=group.normalized_college_name,
                            state=group.normalized_state,
                            decision='APPROVED',
                            reason='User skipped (approved match)'
                        )
                        approved_count += 1
                    console.print(f"[dim]Skipped (saved {len(groups)} as APPROVED)[/dim]")
                    break
                
                if choice == 'd':
                    # Delink all flagged deviations = REJECT those groups
                    for dev in deviations:
                        matching_group = next((g for g in groups if g.normalized_college_name == dev.college_name), None)
                        if matching_group:
                            self.save_deviation_decision(
                                master_id=master_id,
                                group_name=dev.college_name,
                                state=matching_group.normalized_state,
                                decision='REJECTED',
                                reason=dev.deviation_reason
                            )
                            rejected_count += 1
                    # Approve the rest
                    for group in groups:
                        if not any(d.college_name == group.normalized_college_name for d in deviations):
                            self.save_deviation_decision(
                                master_id=master_id,
                                group_name=group.normalized_college_name,
                                state=group.normalized_state,
                                decision='APPROVED',
                                reason='User approved (not delinked)'
                            )
                            approved_count += 1
                    
                    delinked = self._delink_deviations(deviations)
                    total_delinked += delinked
                    console.print(f"[green]✓ Delinked {delinked} records[/green]")
                    break
                
                # Parse group numbers
                try:
                    selected_indices = [int(x.strip()) for x in choice.split(',')]
                    valid_indices = [i for i in selected_indices if i in group_map]
                    
                    if not valid_indices:
                        console.print("[red]Invalid selection. Try again.[/red]")
                        continue
                    
                    # Create deviation results for selected groups AND save decisions
                    selected_deviations = []
                    for idx in valid_indices:
                        group = group_map[idx]
                        selected_deviations.append(DeviationResult(
                            group_id=0,
                            college_name=group.normalized_college_name,
                            record_count=group.record_count,
                            master_college_id=master_id,
                            master_name=master_name,
                            similarity_to_master=0,
                            similarity_to_majority=0,
                            is_minority=False,
                            deviation_reason="User selected for delinking",
                        ))
                        # Save as REJECTED
                        self.save_deviation_decision(
                            master_id=master_id,
                            group_name=group.normalized_college_name,
                            state=group.normalized_state,
                            decision='REJECTED',
                            reason='User selected for delinking'
                        )
                        rejected_count += 1
                    
                    # Approve unselected groups
                    for idx, group in group_map.items():
                        if idx not in valid_indices:
                            self.save_deviation_decision(
                                master_id=master_id,
                                group_name=group.normalized_college_name,
                                state=group.normalized_state,
                                decision='APPROVED',
                                reason='User approved (not delinked)'
                            )
                            approved_count += 1
                    
                    delinked = self._delink_deviations(selected_deviations)
                    total_delinked += delinked
                    console.print(f"[green]✓ Delinked {delinked} records from groups {valid_indices}[/green]")
                    break
                    
                except ValueError:
                    console.print("[red]Invalid input. Enter numbers separated by commas.[/red]")
        
        console.print(f"\n[bold green]═══ Interactive Review Complete ═══[/bold green]")
        console.print(f"Masters reviewed: {masters_reviewed}")
        console.print(f"Total records delinked: {total_delinked}")
        console.print(f"[cyan]Decisions saved: {approved_count} APPROVED, {rejected_count} REJECTED[/cyan]")
        
        return masters_reviewed, total_delinked
    
    def _delink_deviations(self, deviations: List[DeviationResult]) -> int:
        """
        Delink deviating records from their false matches.
        
        Sets master_college_id = NULL and marks for interactive review.
        """
        conn = sqlite3.connect(self.counselling_db_path)
        cursor = conn.cursor()
        
        total_delinked = 0
        
        for dev in deviations:
            cursor.execute(f"""
                UPDATE {self.table_name}
                SET master_college_id = NULL,
                    college_match_score = NULL,
                    college_match_method = 'delinked_pass8_deviation',
                    is_matched = 0
                WHERE master_college_id = ?
                AND normalized_college_name = ?
            """, (dev.master_college_id, dev.college_name))
            
            total_delinked += cursor.rowcount
            
            logger.info(
                f"Delinked {cursor.rowcount} records: "
                f"{dev.college_name[:40]} from {dev.master_college_id}"
            )
        
        conn.commit()
        conn.close()
        
        return total_delinked


def run_pass8_validation(dry_run: bool = True, interactive: bool = False):
    """Run PASS 8 cross-group validation."""
    validator = CrossGroupValidator()
    
    if interactive:
        return validator.validate_interactive()
    else:
        return validator.validate_all(dry_run=dry_run)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="PASS 8: Cross-Group Consistency Validator")
    parser.add_argument("--apply", action="store_true", help="Apply changes (delink deviations)")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive mode - choose which groups to delink")
    args = parser.parse_args()
    
    run_pass8_validation(dry_run=not args.apply, interactive=args.interactive)
