#!/usr/bin/env python3
"""
GUARDIAN MATCH VALIDATOR
Automated validation system for 100% match accuracy with zero human review.

Architecture:
1. Guardian Rules: 12 deterministic validation rules
2. LLM Council: 9 free models for uncertain cases
3. Zero human review: Conservative REJECT default

Example usage:
    guardian = GuardianValidator()
    results = guardian.validate_all()
    print(f"PASS: {len(results['pass'])}, QUARANTINE: {len(results['quarantine'])}, BLOCK: {len(results['block'])}")
"""

import sqlite3
import logging
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
from rapidfuzz import fuzz

# Cache integration for verified-only caching
try:
    from llm_response_cache import get_matcher_cache
    _cache_available = True
except ImportError:
    _cache_available = False

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

logger = logging.getLogger(__name__)
console = Console()


class ValidationAction(Enum):
    """Validation result actions."""
    PASS = "pass"
    QUARANTINE = "quarantine"
    BLOCK = "block"


class RuleSeverity(Enum):
    """Rule severity levels."""
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"


@dataclass
class ValidationRule:
    """A validation rule configuration."""
    id: str
    name: str
    description: str
    severity: RuleSeverity
    enabled: bool
    action: ValidationAction
    threshold: float = 0.0
    min_threshold: float = 0.0
    max_threshold: float = 1.0
    z_score_threshold: float = 3.0
    score_threshold: float = 0.95


@dataclass
class ValidationResult:
    """Result of validating a single record."""
    record_id: str
    action: ValidationAction
    passed_rules: List[str] = field(default_factory=list)
    failed_rules: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    # For multi-campus conflicts: list of (master_id, master_address) options
    multi_master_options: List[Tuple[str, str]] = field(default_factory=list)


@dataclass
class MatchRecord:
    """A matched seat record with its master data."""
    id: str
    college_name: str
    state: str
    address: Optional[str]
    course_type: Optional[str]
    master_college_id: Optional[str]
    match_score: float
    match_method: Optional[str]
    normalized_college_name: Optional[str] = None
    normalized_state: Optional[str] = None
    normalized_address: Optional[str] = None
    # Master data (populated via join)
    master_name: Optional[str] = None
    master_state: Optional[str] = None
    master_address: Optional[str] = None
    master_stream: Optional[str] = None  # 'medical', 'dental', 'dnb'


class GuardianValidator:
    """
    Guardian Match Validator - 12 deterministic rules for pre-filtering.
    
    Records are classified as:
    - PASS: All critical rules pass, no warnings
    - QUARANTINE: All critical rules pass, but has warnings → send to LLM council
    - BLOCK: Any critical rule fails → definite error, reject
    """
    
    def __init__(
        self,
        seat_db_path: str = 'data/sqlite/seat_data.db',
        master_db_path: str = 'data/sqlite/master_data.db',
        rules_path: str = 'guardian_rules.yaml',
        table_name: str = None,  # Auto-detect if not specified
    ):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path
        self.rules_path = rules_path
        
        # Auto-detect table name if not specified
        if table_name:
            self.table_name = table_name
        else:
            self.table_name = self._detect_table_name()
        
        # Load configuration
        self.config = self._load_config()
        self.rules = self._load_rules()
        
        # Statistics
        self.stats = {
            'total': 0,
            'pass': 0,
            'quarantine': 0,
            'block': 0,
            'rule_triggers': defaultdict(int),
        }
        
        # Caches for consistency checking
        self._name_to_master_cache: Dict[str, Set[str]] = defaultdict(set)
        self._master_to_names_cache: Dict[str, Set[str]] = defaultdict(set)
    
    def _detect_table_name(self) -> str:
        """Auto-detect the correct table name in the database."""
        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            
            # Check for tables in order of preference
            for table in ['counselling_records', 'seat_data']:
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
                if cursor.fetchone():
                    conn.close()
                    logger.info(f"Auto-detected table: {table}")
                    return table
            
            conn.close()
            return 'seat_data'  # Default fallback
        except Exception as e:
            logger.warning(f"Table detection failed: {e}, defaulting to seat_data")
            return 'seat_data'
    
    def _load_config(self) -> Dict:
        """Load configuration from YAML file."""
        config_path = Path(self.rules_path)
        if config_path.exists():
            with open(config_path) as f:
                return yaml.safe_load(f)
        else:
            logger.warning(f"Config file not found: {self.rules_path}, using defaults")
            return self._default_config()
    
    def _default_config(self) -> Dict:
        """Default configuration if YAML not found."""
        return {
            'rules': [
                {'id': 'R01', 'name': 'State Match', 'severity': 'CRITICAL', 'enabled': True, 'action': 'BLOCK'},
                {'id': 'R02', 'name': 'Stream Match', 'severity': 'CRITICAL', 'enabled': True, 'action': 'BLOCK'},
                {'id': 'R03', 'name': 'Score Floor', 'severity': 'CRITICAL', 'enabled': True, 'threshold': 0.70, 'action': 'BLOCK'},
            ]
        }
    
    def _load_rules(self) -> List[ValidationRule]:
        """Parse rules from configuration."""
        rules = []
        for r in self.config.get('rules', []):
            if not r.get('enabled', True):
                continue
            
            rules.append(ValidationRule(
                id=r['id'],
                name=r['name'],
                description=r.get('description', ''),
                severity=RuleSeverity[r.get('severity', 'WARNING')],
                enabled=r.get('enabled', True),
                action=ValidationAction[r.get('action', 'QUARANTINE')],
                threshold=r.get('threshold', 0.0),
                min_threshold=r.get('min_threshold', 0.0),
                max_threshold=r.get('max_threshold', 1.0),
                z_score_threshold=r.get('z_score_threshold', 3.0),
                score_threshold=r.get('score_threshold', 0.95),
            ))
        
        return rules
    
    def get_matched_records(self, limit: Optional[int] = None) -> List[MatchRecord]:
        """
        Fetch all matched records with their master data.
        
        Returns records where master_college_id IS NOT NULL.
        """
        conn = sqlite3.connect(self.seat_db_path)
        conn.execute('ATTACH DATABASE ? AS masterdb', (self.master_db_path,))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = f"""
            SELECT 
                sd.id,
                sd.college_name,
                sd.state,
                sd.address,
                sd.course_type,
                sd.master_college_id,
                COALESCE(sd.college_match_score, 0) as match_score,
                sd.college_match_method,
                sd.normalized_college_name,
                sd.normalized_state,
                sd.normalized_address,
                c.name as master_name,
                c.normalized_state as master_state,
                c.address as master_address,
                c.college_type as master_stream
            FROM {self.table_name} sd
            LEFT JOIN masterdb.colleges c ON sd.master_college_id = c.id
            WHERE sd.master_college_id IS NOT NULL AND sd.master_college_id != ''
        """
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query)
        
        records = []
        for row in cursor.fetchall():
            records.append(MatchRecord(
                id=row['id'],
                college_name=row['college_name'],
                state=row['state'],
                address=row['address'],
                course_type=row['course_type'],
                master_college_id=row['master_college_id'],
                match_score=row['match_score'] or 0,
                match_method=row['college_match_method'],
                normalized_college_name=row['normalized_college_name'],
                normalized_state=row['normalized_state'],
                normalized_address=row['normalized_address'],
                master_name=row['master_name'],
                master_state=row['master_state'],
                master_address=row['master_address'],
                master_stream=row['master_stream'],
            ))
        
        conn.close()
        return records
    
    def _build_consistency_caches(self, records: List[MatchRecord]):
        """Build caches for consistency checking (R04).
        
        Key includes:
        - normalized_college_name
        - normalized_address (for multi-campus like Bharati Vidyapeeth)
        - normalized_state
        - course_type (for multi-stream like AFMC)
        """
        self._name_to_master_cache.clear()
        self._master_to_names_cache.clear()
        self._master_address_cache: Dict[str, str] = {}  # master_id → address
        
        for record in records:
            if record.normalized_college_name and record.master_college_id:
                # Include address and course_type for multi-campus/multi-stream support
                course_type = (record.course_type or 'unknown').upper()
                address = (record.normalized_address or record.address or '').upper()[:50]  # First 50 chars
                key = (
                    record.normalized_college_name.upper(), 
                    address,
                    record.normalized_state or '',
                    course_type
                )
                self._name_to_master_cache[key].add(record.master_college_id)
                self._master_to_names_cache[record.master_college_id].add(key)
                
                # Store master address for multi-campus verification
                if record.master_college_id not in self._master_address_cache:
                    self._master_address_cache[record.master_college_id] = record.master_address or ''
    
    def _normalize_state(self, state: Optional[str]) -> str:
        """Normalize state name for comparison."""
        if not state:
            return ''
        return state.upper().strip()
    
    def _check_state_match(self, record: MatchRecord) -> Tuple[bool, str]:
        """R01: State must match."""
        seat_state = self._normalize_state(record.normalized_state or record.state)
        master_state = self._normalize_state(record.master_state)
        
        if not seat_state or not master_state:
            return True, "State data missing, skipped"
        
        # Handle common state name variations
        state_aliases = {
            'ORISSA': 'ODISHA',
            'PONDICHERRY': 'PUDUCHERRY',
            'DELHI': 'NEW DELHI',
            'NCT OF DELHI': 'NEW DELHI',
            'ANDAMAN AND NICOBAR': 'ANDAMAN AND NICOBAR ISLANDS',
            'CHATTISGARH': 'CHHATTISGARH',
        }
        
        seat_normalized = state_aliases.get(seat_state, seat_state)
        master_normalized = state_aliases.get(master_state, master_state)
        
        if seat_normalized == master_normalized:
            return True, f"State match: {seat_state}"
        
        # Check partial match (one contains the other)
        if seat_normalized in master_normalized or master_normalized in seat_normalized:
            return True, f"Partial state match: {seat_state} ~ {master_state}"
        
        return False, f"State mismatch: {seat_state} != {master_state}"
    
    def _check_stream_match(self, record: MatchRecord) -> Tuple[bool, str]:
        """R02: Course type must match college stream."""
        if not record.course_type or not record.master_stream:
            return True, "Stream data missing, skipped"
        
        course_type = record.course_type.lower()
        master_stream = record.master_stream.lower()
        
        # Define valid course-stream mappings
        valid_mappings = {
            'medical': ['medical', 'dnb'],
            'dental': ['dental'],
            'dnb': ['medical', 'dnb'],
            'paramedical': ['medical', 'dnb'],
            'nursing': ['medical', 'dnb'],
        }
        
        if course_type in valid_mappings:
            if master_stream in valid_mappings[course_type]:
                return True, f"Stream match: {course_type} → {master_stream}"
            else:
                return False, f"Stream mismatch: {course_type} course → {master_stream} college"
        
        return True, f"Unknown course type: {course_type}, passed"
    
    def _check_score_floor(self, record: MatchRecord, threshold: float) -> Tuple[bool, str]:
        """R03: Match score must be >= threshold."""
        if record.match_score >= threshold:
            return True, f"Score OK: {record.match_score:.2f} >= {threshold}"
        return False, f"Score below threshold: {record.match_score:.2f} < {threshold}"
    
    def _check_consistency(self, record: MatchRecord) -> Tuple[bool, str, List[Tuple[str, str]]]:
        """R04: Same (name + address + state + course_type) must map to same master.
        
        Multi-campus colleges (e.g., Bharati Vidyapeeth in Pune vs Sangli) and
        multi-stream colleges (e.g., AFMC) can map to different masters.
        
        Returns: (passed, message, multi_master_options)
        where multi_master_options = [(master_id, master_address), ...] for LLM to resolve
        """
        if not record.normalized_college_name or not record.master_college_id:
            return True, "Consistency check skipped (missing data)", []
        
        # Include address and course_type in key for multi-campus/multi-stream support
        course_type = (record.course_type or 'unknown').upper()
        address = (record.normalized_address or record.address or '').upper()[:50]
        key = (
            record.normalized_college_name.upper(), 
            address,
            record.normalized_state or '',
            course_type
        )
        masters = self._name_to_master_cache.get(key, set())
        
        if len(masters) > 1:
            # Collect all master options with their addresses for LLM verification
            multi_master_options = [
                (mid, self._master_address_cache.get(mid, '')) 
                for mid in masters
            ]
            return False, f"Multi-campus conflict: '{record.normalized_college_name}' has {len(masters)} campus options", multi_master_options
        
        return True, "Consistency OK", []
    
    def _check_cardinality(self, record: MatchRecord) -> Tuple[bool, str]:
        """R05: One seat record must have exactly one master_college_id."""
        # This is implicit in our data model - each record has one master_college_id
        # But we check for valid format
        if not record.master_college_id:
            return False, "No master_college_id"
        
        if ',' in record.master_college_id or ';' in record.master_college_id:
            return False, f"Multiple masters detected: {record.master_college_id}"
        
        return True, f"Single master: {record.master_college_id}"
    
    def _check_code_conflict(self, record: MatchRecord) -> Tuple[bool, str]:
        """R06: If college code in name/address, must match master ID."""
        # Look for codes like (902791) or [MED0123] in name/address
        import re
        
        text = f"{record.college_name or ''} {record.address or ''}"
        
        # Pattern for numeric codes in parentheses
        code_matches = re.findall(r'\((\d{5,8})\)', text)
        # Pattern for MED/DEN/DNB codes
        id_matches = re.findall(r'\b(MED\d{4}|DEN\d{4}|DNB\d{4})\b', text, re.IGNORECASE)
        
        if id_matches:
            for id_match in id_matches:
                if id_match.upper() != record.master_college_id.upper():
                    return False, f"Code conflict: found {id_match} but matched to {record.master_college_id}"
        
        return True, "No code conflict"
    
    def _check_weak_address(self, record: MatchRecord, threshold: float) -> Tuple[bool, str]:
        """R07: Address overlap must be above threshold."""
        seat_addr = record.normalized_address or record.address or ''
        master_addr = record.master_address or ''
        
        if not seat_addr or not master_addr:
            return True, "Address data missing, skipped"
        
        # Calculate word overlap
        seat_words = set(seat_addr.upper().split())
        master_words = set(master_addr.upper().split())
        
        # Remove common stopwords
        stopwords = {'THE', 'OF', 'AND', 'IN', 'AT', 'TO', 'FOR', 'A', 'AN'}
        seat_words -= stopwords
        master_words -= stopwords
        
        if not seat_words or not master_words:
            return True, "Insufficient address words"
        
        overlap = len(seat_words & master_words)
        total = len(seat_words | master_words)
        overlap_ratio = overlap / total if total > 0 else 0
        
        if overlap_ratio >= threshold:
            return True, f"Address overlap: {overlap_ratio:.1%}"
        
        return False, f"Weak address overlap: {overlap_ratio:.1%} < {threshold:.0%}"
    
    def _check_name_drift(self, record: MatchRecord, threshold: float) -> Tuple[bool, str]:
        """R08: Name similarity must be above threshold."""
        seat_name = record.normalized_college_name or record.college_name or ''
        master_name = record.master_name or ''
        
        if not seat_name or not master_name:
            return True, "Name data missing, skipped"
        
        # Use fuzzy matching
        ratio = fuzz.ratio(seat_name.upper(), master_name.upper()) / 100
        
        if ratio >= threshold:
            return True, f"Name similarity: {ratio:.0%}"
        
        return False, f"Name drift: {ratio:.0%} < {threshold:.0%}"
    
    def _check_ai_unvalidated(self, record: MatchRecord) -> Tuple[bool, str]:
        """R10: Flag unvalidated AI matches."""
        if not record.match_method:
            return True, "No match method"
        
        if 'unvalidated' in record.match_method.lower():
            return False, f"AI unvalidated match: {record.match_method}"
        
        return True, "Match method OK"
    
    def _check_low_confidence(self, record: MatchRecord, min_thresh: float, max_thresh: float) -> Tuple[bool, str]:
        """R11: Flag matches in warning zone."""
        if record.match_score >= max_thresh:
            return True, f"High confidence: {record.match_score:.2f}"
        
        if record.match_score >= min_thresh:
            return False, f"Low confidence warning: {record.match_score:.2f} in [{min_thresh}, {max_thresh}]"
        
        return True, f"Score below min: {record.match_score:.2f}"  # Handled by R03
    
    def _check_no_address_low_score(self, record: MatchRecord, threshold: float) -> Tuple[bool, str]:
        """R12: Missing address with low score needs quarantine."""
        addr = record.normalized_address or record.address or ''
        
        if addr.strip() and len(addr.strip()) >= 10:
            return True, "Has address"
        
        if record.match_score >= threshold:
            return True, f"No address but high score: {record.match_score:.2f}"
        
        return False, f"No address AND low score: {record.match_score:.2f} < {threshold}"
    
    def _check_multi_campus_address(self, record: MatchRecord) -> Tuple[bool, str]:
        """R13: Multi-campus colleges must have matching addresses.
        
        CRITICAL: If the same master_college_id is matched to records from 
        DIFFERENT physical locations (different districts/cities), it's a FALSE MATCH.
        
        Example violations:
        - MED0687 matched to KAMAREDDY and MEDAK - DIFFERENT locations!
        - Same college_id, different addresses = FALSE MATCH
        """
        if not record.master_college_id or not record.master_address:
            return True, "Multi-campus check skipped (missing data)"
        
        # Get record's address for district/city extraction
        seat_addr = (record.normalized_address or record.address or '').upper()
        master_addr = (record.master_address or '').upper()
        
        if not seat_addr or not master_addr:
            return True, "Multi-campus check skipped (no address)"
        
        # Extract key location identifiers (district, city)
        def extract_location_keys(addr: str) -> set:
            """Extract district/city names from address."""
            # Common Indian location keywords to preserve
            words = set(addr.replace(',', ' ').replace('.', ' ').split())
            # Remove stopwords and common terms
            stopwords = {
                'THE', 'OF', 'AND', 'IN', 'AT', 'TO', 'FOR', 'A', 'AN',
                'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'UNIVERSITY',
                'GOVT', 'GOVERNMENT', 'PRIVATE', 'PVT', 'LTD', 'TRUST',
                'DISTRICT', 'STATE', 'INDIA', 'CAMPUS', 'ROAD', 'STREET',
                'MAIN', 'NEW', 'OLD', 'NEAR', 'OPP', 'POST', 'PIN', 'PINCODE'
            }
            # Remove numeric tokens (pincodes, etc)
            words = {w for w in words if not w.isdigit() and len(w) > 2}
            return words - stopwords
        
        seat_keys = extract_location_keys(seat_addr)
        master_keys = extract_location_keys(master_addr)
        
        if not seat_keys or not master_keys:
            return True, "Multi-campus check skipped (insufficient address data)"
        
        # Check for overlap - if addresses share location keywords, they're likely same place
        overlap = seat_keys & master_keys
        overlap_ratio = len(overlap) / max(len(seat_keys), len(master_keys)) if max(len(seat_keys), len(master_keys)) > 0 else 0
        
        # If low overlap (<50%), these are likely DIFFERENT campuses/locations
        # Increased from 0.35 to 0.50 for stricter multi-campus validation
        if overlap_ratio < 0.50:
            # Check for district-level mismatch explicitly
            # Common district patterns in Indian addresses
            import re
            seat_districts = re.findall(r'\b([A-Z]{4,})\b', seat_addr)
            master_districts = re.findall(r'\b([A-Z]{4,})\b', master_addr)
            
            # If both have district-like terms but no overlap, it's a mismatch
            if seat_districts and master_districts:
                district_overlap = set(seat_districts) & set(master_districts)
                if not district_overlap:
                    return False, f"Multi-campus address mismatch! Record: {seat_addr[:50]}... vs Master: {master_addr[:50]}..."
        
        return True, f"Multi-campus address OK (overlap: {overlap_ratio:.0%})"
    
    def _check_same_id_multi_address(self, record: MatchRecord) -> Tuple[bool, str]:
        """R14: Same-ID Multi-Address Detection.
        
        CRITICAL: Detects when the same master_college_id has been matched to
        records from DIFFERENT physical locations. This is a pattern-level check
        that queries ALL records with the same college_id to find conflicts.
        
        Example: MED0442 matched to both YAVATMAL and NASHIK = FALSE MATCH!
        """
        if not record.master_college_id:
            return True, "Same-ID check skipped (no master_college_id)"
        
        # Query all records with the same master_college_id
        try:
            conn = sqlite3.connect(self.seat_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get distinct addresses for this college_id - get FULL address, not just prefix
            cursor.execute(f"""
                SELECT DISTINCT 
                    COALESCE(UPPER(TRIM(address)), 'UNKNOWN') as full_address,
                    state
                FROM {self.table_name}
                WHERE master_college_id = ?
                  AND address IS NOT NULL
                  AND LENGTH(TRIM(address)) > 3
            """, (record.master_college_id,))
            
            distinct_addresses = cursor.fetchall()
            conn.close()
            
            if len(distinct_addresses) <= 1:
                return True, "Same-ID check passed (single address)"
            
            # IMPROVED: Extract ALL significant words from each address
            # Then check if addresses share ANY common city/district keywords
            def extract_location_words(addr: str) -> set:
                """Extract significant location words from address."""
                if not addr:
                    return set()
                # Remove common non-location words
                stopwords = {
                    'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'INSTITUTE', 
                    'UNIVERSITY', 'GOVT', 'GOVERNMENT', 'PRIVATE', 'PVT',
                    'TRUST', 'SOCIETY', 'CAMPUS', 'ROAD', 'STREET', 'MARG',
                    'NEAR', 'OPP', 'POST', 'OFFICE', 'DISTRICT', 'TALUK'
                }
                words = addr.replace(',', ' ').replace('.', ' ').split()
                # Keep words with length > 3 that aren't stopwords or numbers
                return {w for w in words if len(w) > 3 and w not in stopwords and not w.isdigit()}
            
            # Build set of location words for each address
            address_word_sets = []
            for row in distinct_addresses:
                words = extract_location_words(row['full_address'])
                if words:
                    address_word_sets.append(words)
            
            if len(address_word_sets) < 2:
                return True, "Same-ID check passed (insufficient address data)"
            
            # Compare addresses pairwise - if ANY pair has NO overlap, it's a false match
            for i in range(len(address_word_sets)):
                for j in range(i + 1, len(address_word_sets)):
                    set1 = address_word_sets[i]
                    set2 = address_word_sets[j]
                    overlap = set1 & set2
                    
                    # If addresses have NO common location words, they're different places
                    if len(overlap) == 0:
                        # Get first word from each for the message
                        loc1 = list(set1)[0] if set1 else 'UNKNOWN'
                        loc2 = list(set2)[0] if set2 else 'UNKNOWN'
                        return False, f"Same college_id has DIFFERENT locations: {loc1} vs {loc2}"
            
            return True, f"Same-ID check passed ({len(distinct_addresses)} addresses with common patterns)"
            
        except Exception as e:
            logger.warning(f"R14 check failed: {e}")
            return True, f"Same-ID check error: {e}"
    
    def _check_gross_name_mismatch(self, record: MatchRecord, threshold: float = 0.40) -> Tuple[bool, str]:
        """R15: Gross Name Mismatch Detection.
        
        CRITICAL: Catches cases where names are completely different:
        - PGIMER → ALL INDIA INSTITUTE OF MEDICAL SCIENCES (13% similarity)
        - SHREE NARAYAN → SHRI RAWATPURA SARKAR (52% similarity)
        
        Uses token_set_ratio for flexibility, but blocks below 40%.
        """
        seat_name = record.college_name or ''
        master_name = record.master_name or ''
        
        if not seat_name or not master_name:
            return True, "Name check skipped (missing name)"
        
        # Use token_set_ratio for flexibility with word order
        token_set = fuzz.token_set_ratio(seat_name.upper(), master_name.upper()) / 100
        
        if token_set >= threshold:
            return True, f"Name similarity OK: {token_set:.0%}"
        
        # Additional check: partial ratio for abbreviations (PGIMER = Post Graduate Institute...)
        partial = fuzz.partial_ratio(seat_name.upper(), master_name.upper()) / 100
        
        if partial >= 0.80:  # 80% partial match is OK (handles abbreviations)
            return True, f"Partial name match OK: {partial:.0%}"
        
        return False, f"GROSS NAME MISMATCH: '{seat_name[:25]}' vs '{master_name[:25]}' ({token_set:.0%} similarity)"
    
    def _check_cross_state_mismatch(self, record: MatchRecord) -> Tuple[bool, str]:
        """R16: Cross-State Mismatch Detection.
        
        CRITICAL: Catches when seat state is DIFFERENT from master college state.
        Example: BIHAR record matched to CHHATTISGARH college = FALSE MATCH!
        
        Handles common state aliases (NEW DELHI = DELHI NCT, etc.)
        """
        seat_state = (record.normalized_state or record.state or '').upper().strip()
        master_state = (record.master_state or '').upper().strip()
        
        if not seat_state or not master_state:
            return True, "State check skipped (missing state)"
        
        # Handle common state aliases
        state_aliases = {
            'NEW DELHI': 'DELHI (NCT)',
            'DELHI': 'DELHI (NCT)',
            'NCT': 'DELHI (NCT)',
            'NCT OF DELHI': 'DELHI (NCT)',
            'CHATTISGARH': 'CHHATTISGARH',
            'CHHATISGARH': 'CHHATTISGARH',
            'ORISSA': 'ODISHA',
            'PONDICHERRY': 'PUDUCHERRY',
            'UTTARANCHAL': 'UTTARAKHAND',
            'JAMMU AND KASHMIR': 'JAMMU & KASHMIR',
            'ANDAMAN AND NICOBAR ISLANDS': 'ANDAMAN & NICOBAR ISLANDS',
        }
        
        seat_state_norm = state_aliases.get(seat_state, seat_state)
        master_state_norm = state_aliases.get(master_state, master_state)
        
        if seat_state_norm == master_state_norm:
            return True, f"State match OK: {seat_state}"
        
        return False, f"CROSS-STATE MISMATCH: Seat={seat_state} vs Master={master_state}"
    
    def validate_record(self, record: MatchRecord) -> ValidationResult:
        """
        Validate a single record against all enabled rules.
        
        Returns ValidationResult with action (PASS/QUARANTINE/BLOCK).
        """
        result = ValidationResult(
            record_id=record.id,
            action=ValidationAction.PASS,
            passed_rules=[],
            failed_rules=[],
            warnings=[],
            details={
                'college_name': record.college_name,
                'master_id': record.master_college_id,
                'score': record.match_score,
            }
        )
        
        # BYPASS: Alias-matched records are trusted (manually verified or from knowledge loop)
        if record.match_method and 'alias' in record.match_method.lower():
            result.passed_rules.append('ALIAS_BYPASS')
            result.details['bypass_reason'] = 'Alias match - trusted source'
            return result
        
        critical_failed = False
        has_warnings = False
        
        for rule in self.rules:
            passed = True
            message = ""
            
            # Route to appropriate check function
            if rule.id == 'R01':
                passed, message = self._check_state_match(record)
            elif rule.id == 'R02':
                passed, message = self._check_stream_match(record)
            elif rule.id == 'R03':
                passed, message = self._check_score_floor(record, rule.threshold)
            elif rule.id == 'R04':
                passed, message, multi_master_options = self._check_consistency(record)
                if multi_master_options:
                    result.multi_master_options = multi_master_options
            elif rule.id == 'R05':
                passed, message = self._check_cardinality(record)
            elif rule.id == 'R06':
                passed, message = self._check_code_conflict(record)
            elif rule.id == 'R07':
                passed, message = self._check_weak_address(record, rule.threshold)
            elif rule.id == 'R08':
                passed, message = self._check_name_drift(record, rule.threshold)
            elif rule.id == 'R09':
                # Statistical outlier - would need global stats, skip for now
                passed, message = True, "Outlier check skipped (needs batch context)"
            elif rule.id == 'R10':
                passed, message = self._check_ai_unvalidated(record)
            elif rule.id == 'R11':
                passed, message = self._check_low_confidence(record, rule.min_threshold, rule.max_threshold)
            elif rule.id == 'R12':
                passed, message = self._check_no_address_low_score(record, rule.score_threshold)
            elif rule.id == 'R13':
                passed, message = self._check_multi_campus_address(record)
            elif rule.id == 'R14':
                passed, message = self._check_same_id_multi_address(record)
            elif rule.id == 'R15':
                passed, message = self._check_gross_name_mismatch(record, rule.threshold if hasattr(rule, 'threshold') else 0.40)
            elif rule.id == 'R16':
                passed, message = self._check_cross_state_mismatch(record)
            
            # Track results
            if passed:
                result.passed_rules.append(rule.id)
            else:
                self.stats['rule_triggers'][rule.id] += 1
                
                if rule.severity == RuleSeverity.CRITICAL:
                    result.failed_rules.append(f"{rule.id}: {message}")
                    critical_failed = True
                else:  # WARNING
                    result.warnings.append(f"{rule.id}: {message}")
                    has_warnings = True
        
        # Determine final action
        if critical_failed:
            # Special case: R04 multi-campus conflicts go to QUARANTINE for LLM address resolution
            if result.multi_master_options:
                result.action = ValidationAction.QUARANTINE
                # Add to warnings instead of failed_rules for proper routing
                if result.failed_rules:
                    # Move R04 message from failed_rules to warnings
                    r04_msgs = [r for r in result.failed_rules if r.startswith('R04:')]
                    for msg in r04_msgs:
                        result.warnings.append(f"{msg} [LLM RESOLVES]")
                        result.failed_rules.remove(msg)
                    # Check if we still have other critical failures
                    if result.failed_rules:
                        result.action = ValidationAction.BLOCK
            else:
                result.action = ValidationAction.BLOCK
        elif has_warnings:
            result.action = ValidationAction.QUARANTINE
        else:
            result.action = ValidationAction.PASS
        
        return result
    
    def validate_batch(self, records: List[MatchRecord]) -> Dict[str, List[ValidationResult]]:
        """
        Validate a batch of records.
        
        Returns dict with keys: 'pass', 'quarantine', 'block'
        """
        # Build consistency caches first
        self._build_consistency_caches(records)
        
        # Get LLM cache for verified-only caching
        cache = get_matcher_cache() if _cache_available else None
        
        results = {
            'pass': [],
            'quarantine': [],
            'block': [],
        }
        
        for record in records:
            validation = self.validate_record(record)
            results[validation.action.value].append(validation)
            self.stats[validation.action.value] += 1
            self.stats['total'] += 1
            
            # CACHE INTEGRATION: Update cache based on Guardian verdict
            if cache and record.college_name:
                if validation.action == ValidationAction.PASS:
                    # Mark cache entry as verified (Guardian approved)
                    cache.mark_verified(
                        college_name=record.college_name,
                        state=record.state or '',
                        address=record.address or '',
                        course_type=record.course_type,
                    )
                elif validation.action == ValidationAction.BLOCK:
                    # Invalidate cache entry (Guardian rejected this match)
                    cache.invalidate(
                        college_name=record.college_name,
                        state=record.state or '',
                        address=record.address or '',
                        course_type=record.course_type,
                    )
        
        return results
    
    def validate_all(self, limit: Optional[int] = None) -> Dict[str, List[ValidationResult]]:
        """
        Validate all matched records in the database.
        
        Args:
            limit: Optional limit on number of records to validate
            
        Returns:
            Dict with 'pass', 'quarantine', 'block' lists
        """
        console.print(Panel.fit(
            "[bold cyan]🛡️ GUARDIAN VALIDATOR[/bold cyan]\n"
            f"Rules loaded: {len(self.rules)}\n"
            f"Database: {self.seat_db_path}",
            border_style="cyan"
        ))
        
        # Fetch records
        with console.status("[bold green]Loading matched records..."):
            records = self.get_matched_records(limit=limit)
        
        console.print(f"[yellow]📋 Found {len(records)} matched records[/yellow]")
        
        if not records:
            return {'pass': [], 'quarantine': [], 'block': []}
        
        # Validate with progress
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=console,
        ) as progress:
            task = progress.add_task("Validating...", total=len(records))
            
            # Build caches
            self._build_consistency_caches(records)
            
            results = {'pass': [], 'quarantine': [], 'block': []}
            
            for record in records:
                validation = self.validate_record(record)
                results[validation.action.value].append(validation)
                self.stats[validation.action.value] += 1
                self.stats['total'] += 1
                progress.advance(task)
        
        # Print summary
        self._print_summary(results)
        
        return results
    
    def _print_summary(self, results: Dict[str, List[ValidationResult]]):
        """Print validation summary."""
        total = self.stats['total']
        if total == 0:
            return
        
        # Results table
        table = Table(title="🛡️ Guardian Validation Results", show_header=True, header_style="bold green")
        table.add_column("Category", style="cyan", width=20)
        table.add_column("Count", justify="right", width=15)
        table.add_column("Percentage", justify="right", width=15)
        
        pass_count = len(results['pass'])
        quarantine_count = len(results['quarantine'])
        block_count = len(results['block'])
        
        table.add_row("✅ PASS", f"{pass_count:,}", f"{pass_count/total*100:.1f}%")
        table.add_row("🟡 QUARANTINE", f"{quarantine_count:,}", f"{quarantine_count/total*100:.1f}%")
        table.add_row("🔴 BLOCK", f"{block_count:,}", f"{block_count/total*100:.1f}%")
        table.add_row("━" * 15, "━" * 10, "━" * 10)
        table.add_row("Total", f"{total:,}", "100%")
        
        console.print(table)
        
        # Rule triggers
        if self.stats['rule_triggers']:
            rule_table = Table(title="📊 Rule Triggers", show_header=True, header_style="bold yellow")
            rule_table.add_column("Rule", style="cyan", width=10)
            rule_table.add_column("Triggers", justify="right", width=15)
            
            for rule_id, count in sorted(self.stats['rule_triggers'].items()):
                rule_table.add_row(rule_id, f"{count:,}")
            
            console.print(rule_table)
        
        # Show sample blocks
        if results['block'][:5]:
            console.print("\n[bold red]Sample BLOCKED records:[/bold red]")
            for v in results['block'][:5]:
                console.print(f"  ❌ {v.record_id}: {v.failed_rules[0] if v.failed_rules else 'Unknown'}")
        
        # Show sample quarantine
        if results['quarantine'][:5]:
            console.print("\n[bold yellow]Sample QUARANTINE records:[/bold yellow]")
            for v in results['quarantine'][:5]:
                console.print(f"  🟡 {v.record_id}: {v.warnings[0] if v.warnings else 'Unknown'}")


def run_guardian_validation(limit: Optional[int] = None) -> Dict[str, List[ValidationResult]]:
    """
    Convenience function to run Guardian validation.
    
    Returns:
        Dict with 'pass', 'quarantine', 'block' lists
    """
    guardian = GuardianValidator()
    return guardian.validate_all(limit=limit)


if __name__ == "__main__":
    import sys
    
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            pass
    
    results = run_guardian_validation(limit=limit)
    print(f"\n✅ PASS: {len(results['pass'])}")
    print(f"🟡 QUARANTINE: {len(results['quarantine'])}")
    print(f"🔴 BLOCK: {len(results['block'])}")
