#!/usr/bin/env python3
"""
AGENTIC LLM MATCHER
Uses OpenRouter's Gemini 2.0 Flash (1M context) to resolve ALL unmatched records in 1-3 API calls.

Architecture:
1. Collect all unmatched records after 5-pass orchestrator
2. Build master data summary (college names + IDs + states)
3. Single LLM call analyzes everything and returns match decisions
4. Apply decisions to database
"""

import json
import sqlite3
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from openrouter_client import OpenRouterClient, OpenRouterResponse
from llm_response_cache import get_matcher_cache, LLMResponseCache
from llm_performance_tracker import (
    get_performance_tracker, get_retry_queue, get_circuit_breaker,
    get_cost_tracker, health_check_models,
)
from match_audit import get_audit_logger

logger = logging.getLogger(__name__)
console = Console()


@dataclass
class MatchDecision:
    """Decision made by the agentic matcher."""
    record_id: str
    matched_college_id: Optional[str]
    confidence: float
    reason: str
    model: str = ""  # Which LLM model made this decision


class AgenticMatcher:
    """
    Single-session LLM agent that resolves all unmatched records.
    
    Uses Gemini 2.0 Flash with 1M context to process everything in one call.
    """
    
    SYSTEM_PROMPT = """You are an expert entity resolution specialist for Indian medical/dental colleges.

⛔ DO NOT HALLUCINATE OR RETURN WRONG MATCHES ⛔
- You may ONLY return college IDs that EXIST in the provided MASTER COLLEGE DATABASE
- You may ONLY match if the college NAME has significant similarity to the input record
- NEVER invent or guess college IDs - if unsure, return null
- NEVER match "BALVIR SINGH INSTITUTE" to "AMERICAN INTERNATIONAL INSTITUTE" - these are DIFFERENT colleges!
- A FALSE MATCH is WORSE than NO MATCH - when in doubt, return null

Your task: Match unmatched counselling/seat records to master college database entries.

CRITICAL MATCHING RULES (MUST FOLLOW):
1. Match ONLY if you are ≥90% confident
2. **STATE MUST MATCH EXACTLY** - NEVER match across states (Karnataka != Tamil Nadu)
3. **ADDRESS/CITY MUST MATCH** - If seat address says "ROURKELA" and master is "BHUBANESWAR", DO NOT MATCH
4. Watch for MULTI-CAMPUS chains (Apollo, KIMS, Manipal, Narayana, Fortis, HiTech, IMS, SUM):
   - These have MULTIPLE campuses in DIFFERENT cities
   - ALWAYS verify the CITY/DISTRICT matches before matching
   - Example: "KIMS ROURKELA" is DIFFERENT from "KIMS BHUBANESWAR"
5. Beware DENTAL vs MEDICAL conflicts - never mix them
6. Ignore minor spelling variations (GOVT = GOVERNMENT, HOSP = HOSPITAL)
7. College codes in parentheses (902791) are strong identifiers

⚠️ CRITICAL: STREAM/COURSE TYPE MATCHING ⚠️
Each record has a 'course_type' and 'sample_course' field. YOU MUST MATCH TO THE CORRECT COLLEGE TYPE:
- course_type='medical' (MBBS, MD, MS, etc.) → Match ONLY to MED* colleges (e.g., MED0770)
- course_type='dental' (BDS, MDS) → Match ONLY to DEN* colleges (e.g., DEN0123)
- course_type='dnb' (DNB, Diploma) → Match ONLY to DNB* colleges (e.g., DNB1071)

THE SAME HOSPITAL CAN EXIST AS BOTH MED* AND DNB*:
- MED0770: GOVERNMENT MEDICAL COLLEGE, AZAMGARH (for medical courses)
- DNB1071: GOVERNMENT MEDICAL COLLEGE, AZAMGARH (for DNB courses)

IF course_type='medical', NEVER suggest a DNB* college ID, even if the name matches!
IF course_type='dnb', NEVER suggest a MED* college ID, even if the name matches!

⚠️ CRITICAL: SAME-NAME DIFFERENT-LOCATION COLLEGES ⚠️
India has many colleges with IDENTICAL NAMES in DIFFERENT DISTRICTS, especially:
- "AUTONOMOUS STATE MEDICAL COLLEGE" - exists in 15+ districts in Uttar Pradesh
- "GOVERNMENT MEDICAL COLLEGE" - exists in multiple districts per state
- "DISTRICT HOSPITAL" variations - every district has one

FOR SAME-NAME COLLEGES, ADDRESS IS THE ONLY DIFFERENTIATOR:
- "AUTONOMOUS STATE MEDICAL COLLEGE, AKBARPUR" is MED0734
- "AUTONOMOUS STATE MEDICAL COLLEGE, GHAZIPUR" is MED0744
- Matching AKBARPUR to GHAZIPUR is a FALSE MATCH!


IF YOU SEE A COMMON NAME LIKE "AUTONOMOUS STATE MEDICAL COLLEGE":
1. STOP and check the DISTRICT/CITY in the seat record
2. Find the master college with MATCHING district/city
3. If districts don't match, it's a DIFFERENT college - DO NOT MATCH

⚠️ GENERIC HOSPITAL NAMES - EXTRA CAUTION REQUIRED ⚠️
These names exist in EVERY district - you MUST match by ADDRESS not just NAME:
- "AREA HOSPITAL" - exists in 50+ locations
- "DISTRICT HOSPITAL" - exists in 100+ locations  
- "GENERAL HOSPITAL" - exists in every major city
- "CIVIL HOSPITAL" - common across multiple states

FOR THESE GENERIC NAMES:
1. Name match is NOT ENOUGH - address MUST have clear overlap
2. Look for DISTRICT NAME, CITY NAME, or PINCODE in both addresses
3. If seat address shows "POLICE STATION RAICHUR" and master shows "TEMPLE MG ROAD BANGALORE", 
   these are DIFFERENT locations - return NULL!
4. If seat address is garbled/email-like (e.g., "GMAIL DOT COM"), return NULL
5. When in doubt, return NULL - better to miss than falsely match

FALSE MATCH PREVENTION:
- NEVER match if seat city/district is DIFFERENT from master college city
- NEVER match "Government Dental College JAIPUR" to records from "CUDDALORE"
- NEVER match across states even if names are identical
- When in doubt, return null - it's better to miss a match than create a false match

OUTPUT FORMAT:
Return a JSON array of decisions. For EACH unmatched record, provide:
{
  "record_id": "the exact record ID from input",
  "matched_college_id": "MED0123 or DEN0456 or null if no match",
  "matched_state": "STATE of the matched college (REQUIRED if matched_college_id is not null)",
  "confidence": 0.95,
  "reason": "Brief explanation of match/non-match"
}

STATE VERIFICATION RULE:
- You MUST include the matched_state field from the master college
- If the seat record state does NOT match matched_state, set matched_college_id to null
- State aliases are equivalent: PUDUCHERRY = PONDICHERRY, NEW DELHI = DELHI (NCT)

CITY/ADDRESS VERIFICATION:
- Address validation is handled separately - focus on matching the correct college by name
- Prefer colleges where address keywords overlap with seat data
- Example: Seat says "AKBARPUR" → prefer candidates with AKBARPUR address

💡 COMBINED NAME+ADDRESS MATCHING TIP:
Each record now includes a "Combined" field that merges name and address (e.g., "GOVERNMENT MEDICAL COLLEGE, KOZHIKODE").
Compare this COMBINED string with candidates' combined strings for BEST accuracy.
If the combined strings match well, it's likely a correct match.
If they differ significantly (different cities/districts), return null.

⚠️ CRITICAL: NAME SIMILARITY IS MANDATORY ⚠️
Even if the ADDRESS matches perfectly, you MUST verify NAME SIMILARITY:
- If the candidate NAME is completely different from the source NAME, DO NOT MATCH
- Example: Source="GENERAL HOSPITAL MORBI", Candidate="GMERS MEDICAL COLLEGE" → DO NOT MATCH (names are different!)
- The candidate's ADDRESS field may contain the source hospital name, but the NAME field must still match
- Rule: If candidate NAME shares <60% words with source NAME, return null (address match is NOT sufficient)
- A hospital/college NAME mismatch is a FALSE MATCH, even if same building/address

MANDATORY REASON FORMAT:
- For matches: "Name and state matched. Best candidate from list."
- For non-matches: "No suitable candidate in list" or "Name mismatch"

IMPORTANT:
- If address/city doesn't match, set matched_college_id to null
- If NAME similarity is low (<60%), set matched_college_id to null EVEN IF address matches
- Always include ALL records in your response
- Prefer precision over recall (better to miss a match than create a false match)
- SAME-NAME colleges are DIFFERENT if in DIFFERENT locations!"""

    # NEGATIVE EXAMPLE INJECTION: Known false match patterns to prevent LLM errors
    NEGATIVE_EXAMPLES = """
⛔ KNOWN FALSE MATCH PATTERNS - DO NOT REPEAT THESE MISTAKES ⛔

MULTI-CAMPUS CHAIN ERRORS (SAME BRAND, DIFFERENT LOCATIONS):
- "KIMS HOSPITAL ROURKELA" → is NOT "KIMS HOSPITAL BHUBANESWAR" (different cities!)
- "APOLLO HOSPITAL CHENNAI" → is NOT "APOLLO HOSPITAL HYDERABAD" 
- "NARAYANA HRUDAYALAYA BANGALORE" → is NOT "NARAYANA SUPERSPECIALITY KOLKATA"
- "MANIPAL HOSPITAL BANGALORE" → is NOT "MANIPAL HOSPITAL JAIPUR"
- "FORTIS HOSPITAL GURGAON" → is NOT "FORTIS HOSPITAL MOHALI"
- "HITECH MEDICAL COLLEGE ROURKELA" → is NOT "HITECH MEDICAL COLLEGE BHUBANESWAR"

GOVERNMENT COLLEGE ERRORS (SAME PREFIX, DIFFERENT DISTRICTS):
- "GMC KOTA" → is NOT "GMC JAIPUR" (both in Rajasthan but DIFFERENT districts)
- "GMC AKOLA" → is NOT "GMC NAGPUR" (both in Maharashtra but DIFFERENT cities)
- "AIIMS NEW DELHI" → is NOT "AIIMS PATNA" (AIIMS is a chain, locations matter!)
- "DISTRICT HOSPITAL AKBARPUR" → is NOT "DISTRICT HOSPITAL GHAZIPUR"

AUTONOMOUS STATE MEDICAL COLLEGE ERRORS (15+ LOCATIONS IN UP):
- "AUTONOMOUS STATE MEDICAL COLLEGE AKBARPUR" (MED0734) → is NOT "AUTONOMOUS STATE MEDICAL COLLEGE GHAZIPUR" (MED0744)
- "AUTONOMOUS STATE MEDICAL COLLEGE BAHRAICH" → is NOT "AUTONOMOUS STATE MEDICAL COLLEGE BASTI"
- ALWAYS check the DISTRICT name in address to differentiate!

STATE MISMATCH ERRORS (CRITICAL - NEVER CROSS STATE BOUNDARIES):
- "GOVERNMENT DENTAL COLLEGE JAIPUR" (Rajasthan) → is NOT a match for records from CUDDALORE (Tamil Nadu)
- "GMC BILASPUR" (CHHATTISGARH) → is NOT "GMC SHIMLA" (HIMACHAL PRADESH) - DIFFERENT STATES!
- "LATE SHRI LAKHI RAM AGRAWAL MEMORIAL GMC RAIGARH" (CHHATTISGARH) → NEVER match to Himachal colleges
- "CIMS BILASPUR" (CHHATTISGARH) → is NOT "IGMC SHIMLA" (HIMACHAL PRADESH)
- ANY college from CHHATTISGARH cannot match to HIMACHAL PRADESH, BIHAR, UP, etc.
- NEVER match across state boundaries, EVEN IF the college names look similar
- If seat record state is X, ONLY return colleges where master college state is EXACTLY X

STREAM/TYPE MISMATCH ERRORS:
- MED0770 (MBBS) → is NOT a match for DNB course records (use DNB* college)
- DNB1071 (DNB) → is NOT a match for medical course records (use MED* college)

ADDRESS-NAME MISMATCH ERRORS (CRITICAL - NAME MUST STILL MATCH!):
- "GENERAL HOSPITAL MORBI" → is NOT "GMERS MEDICAL COLLEGE" even if GMERS address contains "General Hospital Morbi"
- The candidate ADDRESS may mention the source hospital, but the candidate NAME must still match the source NAME
- If candidate NAME is completely different from source NAME, it's a FALSE MATCH regardless of address
- Always prioritize NAME similarity over ADDRESS match
"""

    # Multi-campus hospital chains that need extra address validation
    MULTI_CAMPUS_CHAINS = [
        'APOLLO', 'KIMS', 'MANIPAL', 'NARAYANA', 'FORTIS', 'HITECH', 'IMS', 'SUM',
        'MAX', 'MEDANTA', 'ASTER', 'CARE', 'GLOBAL', 'COLUMBIA', 'CONTINENTAL',
        'YASHODA', 'STERLING', 'PUSHPAGIRI', 'AMRITA', 'KASTURBA',
    ]
    
    # Same-name government colleges that require district verification
    SAME_NAME_PATTERNS = [
        'AUTONOMOUS STATE MEDICAL COLLEGE',
        'GOVERNMENT MEDICAL COLLEGE',
        'GOVERNMENT DENTAL COLLEGE', 
        'DISTRICT HOSPITAL',
        'GENERAL HOSPITAL',  # Generic hospital names need location disambiguation
        'RAJKIYA MEDICAL COLLEGE',
        'GMC ',  # GMC prefix
        'AIIMS ',  # AIIMS chain
    ]

    @classmethod
    def _get_negative_examples(cls, batch: List[Dict]) -> str:
        """
        Get relevant negative examples based on batch content.
        
        Args:
            batch: List of records being processed
            
        Returns:
            String of negative examples relevant to this batch
        """
        examples = []
        
        # Check if batch contains multi-campus chains
        has_multi_campus = False
        has_same_name = False
        
        for record in batch:
            college_name = (record.get('college_name') or '').upper()
            
            # Check for multi-campus chains
            for chain in cls.MULTI_CAMPUS_CHAINS:
                if chain in college_name:
                    has_multi_campus = True
                    break
            
            # Check for same-name patterns
            for pattern in cls.SAME_NAME_PATTERNS:
                if pattern in college_name:
                    has_same_name = True
                    break
        
        # Always include base warnings
        result = "\n⚠️ NEGATIVE EXAMPLES - AVOID THESE MISTAKES:\n"
        
        if has_multi_campus:
            result += """
MULTI-CAMPUS WARNING: This batch contains chain hospitals.
- KIMS ROURKELA ≠ KIMS BHUBANESWAR (different cities!)
- APOLLO CHENNAI ≠ APOLLO HYDERABAD (different cities!)
- ALWAYS verify the CITY matches before confirming!
"""
        
        if has_same_name:
            result += """
SAME-NAME WARNING: This batch contains commonly-named colleges.
- AUTONOMOUS STATE MEDICAL COLLEGE appears in 15+ UP districts
- Each district's college has a DIFFERENT ID
- AKBARPUR=MED0734, GHAZIPUR=MED0744, etc.
- CHECK THE DISTRICT in the address field!
"""
        
        # If no special patterns, just add general warning
        if not has_multi_campus and not has_same_name:
            result += """
- State mismatch = NO MATCH
- City mismatch for same-name colleges = NO MATCH
- When in doubt, return null
"""
        
        return result

    @classmethod
    def check_alias_match(cls, college_name: str, state: str = '', master_db_path: str = 'data/sqlite/master_data.db') -> Optional[Dict]:
        """
        Check if college name has a known alias in college_aliases table.
        This is called BEFORE any LLM API call to reuse manual matches.
        
        The Knowledge Loop: Manual review → college_aliases → reused here.
        
        Args:
            college_name: The seat/raw college name to look up
            state: Optional state to narrow search
            master_db_path: Path to master database
            
        Returns:
            Dict with matched_college_id, master_name, confidence if found, else None
        """
        if not college_name:
            return None
        
        try:
            conn = sqlite3.connect(master_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            college_name_upper = college_name.upper().strip()
            
            # Search for exact match on original_name
            if state:
                cursor.execute("""
                    SELECT master_college_id, alias_name, confidence, state_normalized
                    FROM college_aliases
                    WHERE UPPER(TRIM(original_name)) = ?
                    AND (UPPER(TRIM(original_state)) = ? OR original_state IS NULL)
                """, (college_name_upper, state.upper().strip()))
            else:
                cursor.execute("""
                    SELECT master_college_id, alias_name, confidence, state_normalized
                    FROM college_aliases
                    WHERE UPPER(TRIM(original_name)) = ?
                """, (college_name_upper,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row and row['master_college_id']:
                logger.info(f"🎯 ALIAS HIT: '{college_name[:40]}' → {row['master_college_id']} (from college_aliases)")
                return {
                    'matched_college_id': row['master_college_id'],
                    'master_name': row['alias_name'],
                    'confidence': row['confidence'] or 0.95,
                    'state': row['state_normalized'],
                    'source': 'college_aliases'
                }
            
            return None
            
        except Exception as e:
            logger.debug(f"Alias lookup failed: {e}")
            return None

    def __init__(
        self,
        seat_db_path: str = 'data/sqlite/seat_data.db',
        master_db_path: str = 'data/sqlite/master_data.db',
        api_keys: Optional[List[str]] = None,
        api_key: Optional[str] = None,  # Legacy single key support
        timeout: float = 300.0,
        enable_cache: bool = True,  # Enable LLM response caching
    ):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path
        
        # Support both single key and multiple keys
        if api_keys:
            self.api_keys = api_keys
        elif api_key:
            self.api_keys = [api_key]
        else:
            import os
            key = os.getenv("OPENROUTER_API_KEY")
            self.api_keys = [key] if key else []
        
        # Create a client for each API key (for parallel processing)
        self.clients = [OpenRouterClient(api_key=k, timeout=timeout) for k in self.api_keys]
        self.client = self.clients[0] if self.clients else None  # Default client
        
        # Initialize LLM response cache
        self.enable_cache = enable_cache
        self.cache = get_matcher_cache() if enable_cache else None
        if self.cache:
            logger.info(f"LLM Response Cache enabled")
        
        # Initialize TF-IDF pre-filter (optional, config-driven)
        self.tfidf_enabled = False
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.tfidf_college_data = []  # List of {id, state, type} for each row in tfidf_matrix
        try:
            import yaml
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            self.tfidf_enabled = config.get('features', {}).get('enable_tfidf_prefilter', False)
            if self.tfidf_enabled:
                self._build_tfidf_index()
        except Exception as e:
            logger.debug(f"TF-IDF config load failed (using default=disabled): {e}")
    
    def _build_tfidf_index(self):
        """Build TF-IDF vectors for all master colleges."""
        import numpy as np
        
        logger.info("Building TF-IDF index for master colleges...")
        
        conn = sqlite3.connect(self.master_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        tables = [('medical_colleges', 'medical'), ('dental_colleges', 'dental'), ('dnb_colleges', 'dnb')]
        corpus = []
        self.tfidf_college_data = []
        
        for table, college_type in tables:
            try:
                cursor.execute(f"""
                    SELECT id, COALESCE(normalized_name, name) as name,
                           COALESCE(normalized_state, state) as state,
                           COALESCE(normalized_address, address) as address
                    FROM {table}
                """)
                for row in cursor.fetchall():
                    text = f"{row['name']} {row['address'] or ''}"
                    corpus.append(text.upper().strip())
                    self.tfidf_college_data.append({
                        'id': row['id'], 'name': row['name'],
                        'state': (row['state'] or '').upper().strip(),
                        'address': row['address'] or '', 'type': college_type,
                    })
            except Exception as e:
                logger.debug(f"TF-IDF: Could not load {table}: {e}")
        
        conn.close()
        
        if not corpus:
            logger.warning("TF-IDF: No colleges found, disabling")
            self.tfidf_enabled = False
            return
        
        self.tfidf_vectorizer = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), min_df=1, lowercase=False)
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
        logger.info(f"✅ TF-IDF index: {len(corpus)} colleges, {self.tfidf_matrix.shape[1]} features")
        console.print(f"[green]✅ TF-IDF pre-filter ready: {len(corpus)} colleges indexed[/green]")
    
    def _tfidf_prefilter(self, query: str, state: str = None, course_type: str = 'medical', top_k: int = 20) -> List[Dict]:
        """Get top-K candidates using TF-IDF cosine similarity."""
        import numpy as np
        
        if not self.tfidf_enabled or self.tfidf_matrix is None:
            return []
        
        query_vec = self.tfidf_vectorizer.transform([query.upper().strip()])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        top_indices = np.argsort(scores)[::-1]
        
        candidates = []
        state_upper = (state or '').upper().strip()
        type_map = {'medical': 'medical', 'dental': 'dental', 'dnb': 'dnb'}
        target_type = type_map.get(course_type, 'medical')
        
        for idx in top_indices:
            if len(candidates) >= top_k:
                break
            college = self.tfidf_college_data[idx]
            score = scores[idx]
            if score < 0.1:
                continue
            if state_upper and college['state'] != state_upper:
                continue
            if college['type'] != target_type:
                continue
            candidates.append({
                'id': college['id'], 'name': college['name'], 'state': college['state'],
                'address': college['address'], 'tfidf_score': float(score), 'source': 'tfidf',
            })
        
        if candidates:
            logger.debug(f"TF-IDF: {len(candidates)} candidates, top score: {candidates[0]['tfidf_score']:.3f}")
        return candidates
        
    def get_unmatched_records(self, table: str = 'seat_data', limit: int = 500) -> List[Dict]:
        """
        Fetch unmatched records GROUPED BY (college_name + address + state + course_type).
        This reduces 1424 records to ~41 unique groups for efficient LLM processing.
        """
        conn = sqlite3.connect(self.seat_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        records = []
        
        if table == 'group_matching_queue':
            # Handle pre-grouped table
            cursor.execute(f"""
                SELECT 
                    group_id,
                    normalized_college_name,
                    corrected_college_name,
                    normalized_state,
                    normalized_address,
                    sample_course_type as course_type,
                    sample_course_name,
                    record_count
                FROM {table}
                WHERE (matched_college_id IS NULL OR matched_college_id = '')
                AND is_processed = 0
                LIMIT ?
            """, (limit,))
            
            for row in cursor.fetchall():
                records.append({
                    "record_id": str(row["group_id"]),  # Use group_id as ID
                    "college_name": row["corrected_college_name"] or row["normalized_college_name"],  # Prefer corrected
                    "normalized_college_name": row["normalized_college_name"],
                    "corrected_college_name": row["corrected_college_name"],
                    "state": row["normalized_state"],
                    "normalized_state": row["normalized_state"],  # Explicit key for validation
                    "address": row["normalized_address"] or "",
                    "normalized_address": row["normalized_address"] or "",  # Explicit key for validation
                    "course_type": row["course_type"],  # medical/dental/dnb
                    "sample_course": row["sample_course_name"] or "",  # e.g., "MS ENT"
                    "type": row["course_type"],  # Keep for backward compat
                    "count": row["record_count"],
                })
                
        else:
            # Handle raw seat_data table (needs grouping)
            cursor.execute(f"""
                SELECT 
                    normalized_college_name,
                    normalized_state,
                    normalized_address,
                    course_type,
                    GROUP_CONCAT(id) as record_ids,
                    COUNT(*) as record_count
                FROM {table}
                WHERE master_college_id IS NULL OR master_college_id = ''
                GROUP BY normalized_college_name, normalized_state, normalized_address, course_type
                LIMIT ?
            """, (limit,))
            
            for row in cursor.fetchall():
                records.append({
                    "record_id": row["record_ids"],  # Comma-separated IDs
                    "college_name": row["normalized_college_name"],
                    "state": row["normalized_state"],
                    "address": row["normalized_address"] or "",
                    "type": row["course_type"],
                    "count": row["record_count"],
                })
        
        conn.close()
        console.print(f"[dim]📊 Grouped {sum(r['count'] for r in records)} records into {len(records)} unique college+course combinations[/dim]")
        return records
    
    # Generic words that should NOT contribute to similarity matching
    # These exist in almost all medical college names and cause false matches
    GENERIC_COLLEGE_WORDS = frozenset({
        'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'OF', 'AND', 'THE', 
        'SCIENCES', 'SCIENCE', 'EDUCATION', 'RESEARCH', 'CENTRE', 'CENTER',
        'DENTAL', 'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'UNIVERSITY',
        'ACADEMY', 'SCHOOL', 'FOUNDATION', 'TRUST', 'CHARITABLE', 'SOCIETY',
        'FOR', 'IN', 'AT', 'WITH', 'STUDIES', 'TRAINING', 'POSTGRADUATE',
        'POST', 'GRADUATE', 'UNDER', 'SUPER', 'SPECIALTY', 'SPECIALITY',
        'MULTI', 'SUPER', 'TEACHING', 'GENERAL', 'DISTRICT', 'REGIONAL',
        'STATE', 'NATIONAL', 'INTERNATIONAL', 'INDIAN', 'INDIA',
        'AUTONOMOUS',  # Added: AUTONOMOUS STATE MEDICAL COLLEGE pattern
    })
    
    def _extract_unique_identifier(self, name: str) -> str:
        """
        Extract unique identifying words from a college name.
        Removes generic words that cause false matches.
        
        Examples:
            'GOVERNMENT MEDICAL COLLEGE NAGPUR' -> 'NAGPUR'
            'MAHAVIR INSTITUTE OF MEDICAL SCIENCES' -> 'MAHAVIR'
            'AIIMS DELHI' -> 'AIIMS DELHI'
        """
        words = name.upper().split()
        unique = [w for w in words if w not in self.GENERIC_COLLEGE_WORDS and len(w) > 2]
        if 'ESIC' in words:
            # Expand ESIC for better matching with 'EMPLOYEES STATE INSURANCE CORPORATION'
            words.append('EMPLOYEES')
            words.append('INSURANCE')
            
        unique = [w for w in words if w not in self.GENERIC_COLLEGE_WORDS and len(w) > 2]
        return ' '.join(unique)
    
    def _clean_address(self, address: str, college_name: str, state: str) -> str:
        """
        Clean address by removing college name and state to isolate location.
        """
        if not address:
            return ""
            
        import re
        
        # 1. Basic Normalization
        address_str = str(address).strip().upper()
        college_normalized = str(college_name).strip().upper() if college_name else ''
        state_normalized = str(state).strip().upper() if state else ''
        
        # 2. Remove College Name (Global replace, case-insensitive)
        if college_normalized and len(college_normalized) > 3:
            # Escape to handle special chars like Parens safely
            address_str = re.sub(re.escape(college_normalized), '', address_str, flags=re.IGNORECASE)
            
        # 3. Remove State Name (Global replace, case-insensitive)
        if state_normalized and len(state_normalized) > 2:
            address_str = re.sub(re.escape(state_normalized), '', address_str, flags=re.IGNORECASE)

        # 4. Split by comma and deduplicate segments
        segments = [s.strip() for s in address_str.split(',')]
        unique_segments = []
        seen = set()
        
        for seg in segments:
            # Create a normalized key for deduplication (alphanumeric only)
            seg_key = re.sub(r'[^A-Z0-9]', '', seg) 
            
            if not seg_key: 
                continue # Skip empty segments
            
            if seg_key in seen:
                continue # Skip duplicates
                
            unique_segments.append(seg)
            seen.add(seg_key)
        
        # 5. Reassemble
        addr_norm = ', '.join(unique_segments)
        
        # 6. Final Cleanup
        addr_norm = re.sub(r'\s+', ' ', addr_norm).strip()
        addr_norm = re.sub(r'^[,\s]+', '', addr_norm)
        addr_norm = re.sub(r'[,\s]+$', '', addr_norm)
            
        return addr_norm
    
    def _prefilter_candidates(self, unmatched_record: Dict, all_master_colleges: List[Dict], top_n: int = 10, min_similarity: float = 50.0) -> List[Dict]:
        """
        STAGE 1: Pre-filter master colleges by UNIQUE IDENTIFIER similarity.
        
        This prevents false matches caused by generic words like MEDICAL, COLLEGE, etc.
        
        Args:
            unmatched_record: Single unmatched record with 'college_name' field
            all_master_colleges: List of all master colleges (dicts with 'id', 'name', 'state', 'address')
            top_n: Maximum number of candidates to return (default 10)
            min_similarity: Minimum unique identifier similarity threshold (default 50%)
            
        Returns:
            List of top candidate colleges sorted by similarity (highest first)
        """
        from rapidfuzz import fuzz
        
        unmatched_name = (unmatched_record.get('college_name') or '').upper().strip()
        if not unmatched_name:
            return []
        
        # Extract unique identifier (remove generic words)
        unmatched_unique = self._extract_unique_identifier(unmatched_name)
        
        # If no unique identifier found (e.g., "GOVERNMENT MEDICAL COLLEGE"), 
        # use address/city as additional filter
        unmatched_address = (unmatched_record.get('address') or '').upper().strip()
        
        scored_candidates = []
        for college in all_master_colleges:
            master_name = (college.get('name') or '').upper().strip()
            if not master_name:
                continue
            
            master_unique = self._extract_unique_identifier(master_name)
            master_address = (college.get('address') or '').upper().strip()
            
            # STRATEGY: Compare unique identifiers, with address fallback for generics
            
            if unmatched_unique and master_unique:
                # Case 1: Both have unique identifiers (e.g. "PRAKASH" vs "SANJEEVAN")
                # Strict comparison
                unique_similarity = fuzz.token_set_ratio(unmatched_unique, master_unique)
                
            elif not unmatched_unique and master_unique:
                # Case 2: Unmatched is generic ("GOVT MED COL") but Master is specific ("GOVT MED COL KOTA")
                # Key Insight: The differentiating factor MUST be in the Address/Location
                # Check if Master's unique ID is present in Unmatched Address/City
                
                # e.g. Master Unique="KOTA", Unmatched Address="KOTA" -> Match!
                if unmatched_address:
                    unique_similarity = fuzz.token_set_ratio(unmatched_address, master_unique)
                else:
                    unique_similarity = 0
                    
            elif unmatched_unique and not master_unique:
                 # Case 3: Unmatched is specific ("AIIMS") but Master is generic ("ALL INDIA INST...")
                 # Note: Master might be generic because _extract failed or it's just generic
                 # Trust the full name similarity more here, or check Matcher Address vs Unmatched Unique
                 unique_similarity = 0 # Conservative, rely on full_similarity later? 
                 # Actually, better to check if Unmatched Unique is in Master Name (which it is, via Generic check logic)
                 # But let's set a baseline
                 unique_similarity = fuzz.token_set_ratio(unmatched_unique, master_name)
                 
            else:
                # Case 4: Both are generic ("GOVT MED COL" vs "GOVT MED COL")
                # Must rely on Address matching
                if unmatched_address and master_address:
                    unique_similarity = fuzz.token_set_ratio(unmatched_address[:50], master_address[:50])
                else:
                    unique_similarity = 0

            # Also calculate full name similarity for sorting (secondary)
            full_similarity = fuzz.token_set_ratio(unmatched_name, master_name)
            
            # FILTER DECISION
            # If unique similarity is high, include it.
            # If full similarity is VERY high (e.g. 90%+), include it even if unique logic failed (safety net)
            
            if unique_similarity >= min_similarity or full_similarity >= 90.0:
                scored_candidates.append({
                    **college,
                    'similarity': unique_similarity if unique_similarity > 0 else full_similarity,
                    'full_similarity': full_similarity,
                    'unique_id': master_unique,
                    'method': 'unique' if unique_similarity >= min_similarity else 'full_safety'
                })
        
        # Sort by unique similarity first, then full similarity
        scored_candidates.sort(key=lambda x: (x['similarity'], x['full_similarity']), reverse=True)
        top_candidates = scored_candidates[:top_n]
        
        if top_candidates:
            logger.debug(
                f"Pre-filtered {len(top_candidates)} candidates for '{unmatched_name[:30]}' (unique: '{unmatched_unique[:20]}') "
                f"(best: {top_candidates[0]['name'][:30]} @ {top_candidates[0]['similarity']:.1f}%)"
            )
        else:
            logger.debug(f"No candidates found for '{unmatched_name[:40]}' (unique: '{unmatched_unique[:20]}')")
        
        return top_candidates
    
    def _prefilter_with_fts(self, unmatched_record: Dict, course_type: str = 'medical', top_n: int = 15) -> List[Dict]:
        """
        ADVANCED PRE-FILTER: Use SQLite FTS5 Full Text Search with BM25 ranking.
        
        This is significantly more accurate than fuzzy matching because:
        1. FTS5 uses an inverted index (O(log n) vs O(n) loop)
        2. BM25 naturally handles term frequency / inverse document frequency
        3. Porter stemmer handles word variations (college/colleges, medical/medic)
        4. Filters by normalized_state for precise matching
        
        Args:
            unmatched_record: Single unmatched record with 'college_name', 'state', 'address' fields
            course_type: 'medical', 'dental', or 'dnb' to select the right FTS table
            top_n: Maximum number of candidates to return
            
        Returns:
            List of candidate colleges with BM25 scores
        """
        import sqlite3
        from rapidfuzz import fuzz
        
        # Map course type to FTS table
        fts_tables = {
            'medical': 'medical_colleges_fts',
            'dental': 'dental_colleges_fts',
            'dnb': 'dnb_colleges_fts',
        }
        
        base_tables = {
            'medical': 'medical_colleges',
            'dental': 'dental_colleges',
            'dnb': 'dnb_colleges',
        }
        
        fts_table = fts_tables.get(course_type, 'medical_colleges_fts')
        base_table = base_tables.get(course_type, 'medical_colleges')
        
        # Use NORMALIZED fields (no special characters like & or parentheses)
        # PRIORITY: corrected_college_name (from embedding fixer) > normalized_college_name
        college_name = (
            unmatched_record.get('corrected_college_name') or 
            unmatched_record.get('normalized_college_name') or 
            unmatched_record.get('college_name') or ''
        ).upper().strip()
        state = (unmatched_record.get('normalized_state') or unmatched_record.get('state') or '').upper().strip()
        state = (unmatched_record.get('normalized_state') or unmatched_record.get('state') or '').upper().strip()
        # Use clean address logic to ensure robustness
        # CRITICAL FIX: Check normalized_address first (records from get_unmatched_records use this)
        raw_addr = unmatched_record.get('normalized_address') or unmatched_record.get('address') or ''
        address = self._clean_address(raw_addr, college_name, state)
        
        if not college_name:
            return []
        
        # Build FTS5 query - use significant words only
        # Remove special characters that break FTS5 syntax (parentheses, brackets, etc.)
        import re
        clean_name = re.sub(r'[^\w\s]', ' ', college_name)  # Keep only alphanumeric and spaces
        query_words = [w for w in clean_name.split() if len(w) > 2 and w.isalnum()]
        if not query_words:
            return []
        
        # Build safe FTS5 query
        fts_query = ' '.join(query_words)
        
        candidates = []
        
        try:
            conn = sqlite3.connect(self.master_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # FTS5 query with optional state filter
            if state:
                cursor.execute(f"""
                    SELECT 
                        f.id,
                        f.name,
                        f.normalized_name,
                        f.normalized_state,
                        f.normalized_address,
                        bm25({fts_table}) as score
                    FROM {fts_table} f
                    WHERE {fts_table} MATCH ?
                    AND f.normalized_state = ?
                    ORDER BY score
                    LIMIT 100
                """, (fts_query, state))  # Get all candidates for state, filter by address later
            else:
                cursor.execute(f"""
                    SELECT 
                        f.id,
                        f.name,
                        f.normalized_name,
                        f.normalized_state,
                        f.normalized_address,
                        bm25({fts_table}) as score
                    FROM {fts_table} f
                    WHERE {fts_table} MATCH ?
                    ORDER BY score
                    LIMIT ?
                """, (fts_query, top_n * 2))
            
            fts_results = cursor.fetchall()
            conn.close()
            
            # Secondary validation: Apply Unique Identifier + Address matching
            unmatched_unique = self._extract_unique_identifier(college_name)
            
            for row in fts_results:
                master_name = row['name'] or row['normalized_name'] or ''
                master_address = row['normalized_address'] or ''
                master_unique = self._extract_unique_identifier(master_name)
                
                # Calculate validation score using existing logic
                if unmatched_unique and master_unique:
                    validation_score = fuzz.token_set_ratio(unmatched_unique, master_unique)
                elif not unmatched_unique and master_unique:
                    # Generic input - check address vs master unique
                    validation_score = fuzz.token_set_ratio(address, master_unique) if address else 0
                elif unmatched_unique and not master_unique:
                    validation_score = fuzz.token_set_ratio(unmatched_unique, master_name)
                else:
                    # Both generic - check addresses
                    validation_score = fuzz.token_set_ratio(address[:50], master_address[:50]) if address and master_address else 0
                
                # Include if FTS found it AND validation passes
                # BM25 score is negative (higher is worse), so we invert
                candidates.append({
                    'id': row['id'],
                    'name': master_name,
                    'state': row['normalized_state'],
                    'address': master_address,
                    'fts_score': abs(row['score']),  # Make positive for readability
                    'validation_score': validation_score,
                    'unique_id': master_unique,
                    'method': 'fts5_bm25'
                })
            
            # =================================================================
            # ADDRESS KEYWORD FILTERING (OPTIONAL ADD-ON for multi-campus)
            # =================================================================
            # Only needed when multiple candidates have same generic name
            # Example: 10 "GOVERNMENT MEDICAL COLLEGE" in AP → filter by "ELURU" → 1
            # 
            # This step is OPTIONAL - if address is null/empty, skip and let
            # other filters (state, course, name) handle disambiguation
            
            # Normalize address - handle NAN/None/empty
            addr_normalized = (address or '').upper().strip()
            if addr_normalized in ('', 'NAN', 'NONE', 'NULL', 'NA', 'N/A', '-'):
                addr_normalized = ''  # Treat as empty
            
            if addr_normalized and len(candidates) > 1:
                # Extract UNIQUE/DISTINCTIVE keywords from address
                # Priority: District names, City names (most unique identifiers)
                
                # Words to IGNORE (too generic or common)
                IGNORE_WORDS = {
                    # Common address terms
                    'DISTRICT', 'CITY', 'TOWN', 'VILLAGE', 'TEHSIL', 'TALUK', 'MANDAL',
                    'BLOCK', 'WARD', 'SECTOR', 'PHASE', 'ROAD', 'STREET', 'LANE',
                    'NAGAR', 'PURAM', 'PURA', 'GANJ', 'PUR', 'ABAD', 'GRAM', 'PADA',
                    'NEAR', 'OPP', 'OPPOSITE', 'BEHIND', 'NEXT', 'BESIDE', 'ADJACENT',
                    # States (already filtered by state)
                    'ANDHRA', 'PRADESH', 'ARUNACHAL', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
                    'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL', 'JHARKHAND', 'KARNATAKA',
                    'KERALA', 'MADHYA', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM',
                    'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL', 'NADU',
                    'TELANGANA', 'TRIPURA', 'UTTAR', 'UTTARAKHAND', 'WEST', 'BENGAL',
                    'DELHI', 'NCT', 'CHANDIGARH', 'PUDUCHERRY', 'PONDICHERRY',
                    # Null/NA values
                    'NAN', 'NONE', 'NULL', 'NA', 'N/A',
                    # Common hospital/medical terms (already in name filter)
                    'HOSPITAL', 'MEDICAL', 'COLLEGE', 'INSTITUTE', 'AREA', 'GOVERNMENT',
                    # Numbers and pincodes
                    'PIN', 'PINCODE', 'CODE',
                }
                
                # Clean address: remove punctuation, split into words
                import re
                addr_clean = re.sub(r'[^\w\s]', ' ', addr_normalized)
                addr_words = addr_clean.split()
                
                # Extract unique keywords (city/district names)
                # These are typically 4+ letters, not in ignore list, not numbers
                address_keywords = []
                for word in addr_words:
                    if (len(word) >= 4 and 
                        word not in IGNORE_WORDS and 
                        not word.isdigit() and
                        not (len(word) == 6 and word.isdigit())):  # Skip pincodes
                        address_keywords.append(word)
                
                # Deduplicate while preserving order (first occurrence)
                seen = set()
                address_keywords = [x for x in address_keywords if not (x in seen or seen.add(x))]
                
                # Limit to first 10 most distinctive keywords (increased from 5 to catch city at end)
                address_keywords = address_keywords[:10]
                
                if address_keywords:
                    # Find candidates whose address contains ANY of our keywords (OR logic)
                    matched_candidates = []
                    
                    for c in candidates:
                        master_addr = (c.get('address') or '').upper()
                        
                        # Check if ANY keyword is in master address (OR logic)
                        if any(kw in master_addr for kw in address_keywords):
                            matched_candidates.append(c)
                    
                    # Only filter if we found matches; otherwise keep all (let LLM decide)
                    if matched_candidates:
                        logger.debug(
                            f"Address filter: {len(candidates)} → {len(matched_candidates)} "
                            f"(keywords: {address_keywords[:3]})"
                        )
                        candidates = matched_candidates
                    # If no keyword matches, keep all candidates (don't filter)
            
            # Sort by validation score (primary) and FTS score (secondary)
            candidates.sort(key=lambda x: (x['validation_score'], x['fts_score']), reverse=True)
            
            # Filter: Keep only high-validation candidates
            validated_candidates = [c for c in candidates if c['validation_score'] >= 50 or c['fts_score'] >= 5.0]
            
            if validated_candidates:
                logger.debug(
                    f"FTS5 found {len(validated_candidates)} candidates for '{college_name[:30]}' "
                    f"(best: {validated_candidates[0]['name'][:30]} @ validation {validated_candidates[0]['validation_score']:.1f}%)"
                )
                
                # ENSEMBLE PRE-FILTER: Remove obviously bad candidates before LLM
                try:
                    from ensemble_validator import get_ensemble_validator
                    ensemble_validator = get_ensemble_validator()
                    
                    filtered_candidates, removed = ensemble_validator.prefilter_candidates(
                        candidates=validated_candidates[:top_n],
                        input_name=college_name,
                        input_address=address
                    )
                    
                    if removed > 0:
                        logger.info(f"Ensemble pre-filter: {len(validated_candidates[:top_n])} → {len(filtered_candidates)} candidates")
                    
                    return filtered_candidates
                except ImportError:
                    pass  # Ensemble validator not available
                except Exception as e:
                    logger.debug(f"Ensemble pre-filter failed: {e}")
            else:
                logger.debug(f"FTS5: No valid candidates for '{college_name[:40]}' (FTS returned {len(fts_results)} raw results)")
            
            return validated_candidates[:top_n]
            
        except Exception as e:
            logger.warning(f"FTS5 pre-filter failed: {e}. Falling back to rapidfuzz.")
            return []  # Caller should fall back to _prefilter_candidates
    
    def _filter_candidates_hybrid(self, unmatched_record: Dict, course_type: str = 'medical', top_n: int = 10) -> List[Dict]:
        """
        HYBRID CANDIDATE RETRIEVAL: SQL filtering + Python fuzzy matching.
        
        Filter Chain:
        1. course_type → Select correct table (medical_colleges, dental_colleges, dnb_colleges)
        2. state → SQL filter by normalized_state
        3. college_name → 3-tier matching:
           - Tier 1: Exact normalized match
           - Tier 2: Fuzzy match (≥85% token_set_ratio)
           - Tier 3: Contains/Substring match
        4. address → Keyword disambiguation (only if candidates > 1)
        
        Args:
            unmatched_record: Record with 'normalized_college_name', 'normalized_state', 'normalized_address'
            course_type: 'medical', 'dental', or 'dnb'
            top_n: Maximum candidates to return
            
        Returns:
            List of candidate dictionaries sorted by match quality
        """
        from rapidfuzz import fuzz
        import re
        
        # Map course type to table(s)
        # CRITICAL FIX: DNB courses can be offered at medical/dental colleges, not just dedicated DNB hospitals
        # Example: "DR RADHAKRISHNAN GOVERNMENT MEDICAL COLLEGE" offers DNB but is in medical_colleges table
        table_map = {
            'medical': ['medical_colleges'],
            'dental': ['dental_colleges'],
            'dnb': ['dnb_colleges', 'medical_colleges'],  # Search both! DNB at medical colleges is common
        }
        tables_to_search = table_map.get(course_type, ['medical_colleges'])
        
        # Extract record fields - PRIORITY: corrected_college_name > normalized_college_name
        college_name = (unmatched_record.get('corrected_college_name') or
                       unmatched_record.get('normalized_college_name') or 
                       unmatched_record.get('college_name') or '').upper().strip()
        state = (unmatched_record.get('normalized_state') or 
                unmatched_record.get('state') or '').upper().strip()
        address = (unmatched_record.get('normalized_address') or 
                  unmatched_record.get('address') or '').upper().strip()
        
        if not college_name:
            return []
        
        # =====================================================================
        # KNOWLEDGE LOOP: Check college_aliases FIRST before any API call
        # This reuses manual matches from review sessions to save cost and time
        # =====================================================================
        alias_match = self.check_alias_match(college_name, state, self.master_db_path)
        if alias_match:
            # Return as a high-confidence candidate, skipping LLM entirely
            return [{
                'id': alias_match['matched_college_id'],
                'name': alias_match['master_name'],
                'normalized_name': alias_match['master_name'].upper(),
                'state': alias_match.get('state', state),
                'normalized_state': alias_match.get('state', state),
                'address': '',
                'normalized_address': '',
                'validation_score': alias_match['confidence'] * 100,
                'match_score': 100.0,  # CRITICAL: Ensure alias passes quality filter (>= 70%)
                'fts_score': 999.0,  # Max score to ensure it's selected
                'match_tier': 'alias',
                'source': 'college_aliases',
            }]
        
        # Normalize address - handle NAN/None/empty
        if address in ('', 'NAN', 'NONE', 'NULL', 'NA', 'N/A', '-'):
            address = ''

        
        try:
            conn = sqlite3.connect(self.master_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # STEP 1: CASCADING TABLE SEARCH - Primary table first, fallback only if empty
            # Rule: If college found in primary table, use it. Only fall back if ZERO candidates.
            all_candidates = []
            for table in tables_to_search:
                if state:
                    cursor.execute(f"""
                        SELECT id, name, COALESCE(normalized_name, name) as normalized_name,
                               state, COALESCE(normalized_state, state) as normalized_state,
                               address, COALESCE(normalized_address, address) as normalized_address
                        FROM {table}
                        WHERE UPPER(COALESCE(normalized_state, state)) = ?
                    """, (state,))
                else:
                    cursor.execute(f"""
                        SELECT id, name, COALESCE(normalized_name, name) as normalized_name,
                               state, COALESCE(normalized_state, state) as normalized_state,
                               address, COALESCE(normalized_address, address) as normalized_address
                        FROM {table}
                    """)
                
                table_candidates = [dict(row) for row in cursor.fetchall()]
                
                # CASCADING: If we found candidates in this table, stop searching further tables
                if table_candidates:
                    all_candidates = table_candidates
                    logger.debug(f"Hybrid: Found {len(table_candidates)} candidates in {table} for state '{state}'")
                    break  # Don't search fallback tables
            
            conn.close()
            
            if not all_candidates:
                logger.debug(f"Hybrid: No candidates in any of {tables_to_search} for state '{state}'")
                return []
            
            # STEP 2: 3-Tier College Name Matching
            # FIXED: Collect ALL candidates across all tiers, then rank by combined name+address score
            # Previously: Tier 1 stopped search, missing better address matches in tier 2
            matched_candidates = []
            seen_ids = set()  # Prevent duplicates
            
            # Tier 1: Exact normalized match
            for c in all_candidates:
                master_name = (c.get('normalized_name') or c.get('name') or '').upper().strip()
                if master_name == college_name:
                    c['match_tier'] = 1
                    c['match_score'] = 100.0
                    c['match_method'] = 'exact'
                    matched_candidates.append(c)
                    seen_ids.add(c['id'])
            
            # Tier 2: Fuzzy match (≥85%) - ALWAYS run, add candidates not in tier 1
            for c in all_candidates:
                if c['id'] in seen_ids:
                    continue  # Already matched in tier 1
                master_name = (c.get('normalized_name') or c.get('name') or '').upper().strip()
                similarity = fuzz.token_set_ratio(college_name, master_name)
                if similarity >= 85:
                    c['match_tier'] = 2
                    c['match_score'] = similarity
                    c['match_method'] = 'fuzzy_85'
                    matched_candidates.append(c)
                    seen_ids.add(c['id'])
            
            # Tier 3: Contains/Substring - add candidates not in tier 1 or 2
            for c in all_candidates:
                if c['id'] in seen_ids:
                    continue  # Already matched
                master_name = (c.get('normalized_name') or c.get('name') or '').upper().strip()
                # Check if input contains master OR master contains input
                if college_name in master_name or master_name in college_name:
                    c['match_tier'] = 3
                    c['match_score'] = fuzz.token_set_ratio(college_name, master_name)
                    c['match_method'] = 'substring'
                    matched_candidates.append(c)
                    seen_ids.add(c['id'])
            
            if not matched_candidates:
                logger.debug(f"Hybrid: No name matches for '{college_name[:40]}' in {len(all_candidates)} candidates")
                return []
            
            # STEP 3: Address Disambiguation (only if multiple candidates)
            if len(matched_candidates) > 1 and address:
                # Extract unique keywords from input address (≥3 chars)
                STOPWORDS = {
                    'DISTRICT', 'CITY', 'TOWN', 'VILLAGE', 'TEHSIL', 'TALUK', 'MANDAL',
                    'BLOCK', 'WARD', 'SECTOR', 'PHASE', 'ROAD', 'STREET', 'LANE',
                    'NAGAR', 'PURAM', 'PURA', 'GANJ', 'PUR', 'ABAD', 'GRAM', 'PADA',
                    'NEAR', 'OPP', 'OPPOSITE', 'BEHIND', 'NEXT', 'BESIDE', 'ADJACENT',
                    'HOSPITAL', 'MEDICAL', 'COLLEGE', 'INSTITUTE', 'AREA', 'GOVERNMENT',
                    'THE', 'AND', 'FOR', 'WITH', 'FROM',
                    'NAN', 'NONE', 'NULL', 'NA', 'N/A',
                }
                
                # Clean and extract keywords from input address
                addr_clean = re.sub(r'[^\w\s]', ' ', address)
                input_keywords = set()
                for word in addr_clean.split():
                    word = word.strip()
                    if len(word) >= 3 and word not in STOPWORDS and not word.isdigit():
                        input_keywords.add(word)
                
                if input_keywords:
                    # Score each candidate by keyword overlap
                    for c in matched_candidates:
                        master_addr = (c.get('normalized_address') or c.get('address') or '').upper()
                        master_addr_clean = re.sub(r'[^\w\s]', ' ', master_addr)
                        master_keywords = set()
                        for word in master_addr_clean.split():
                            word = word.strip()
                            if len(word) >= 3 and word not in STOPWORDS and not word.isdigit():
                                master_keywords.add(word)
                        
                        # Calculate keyword overlap
                        overlap = input_keywords & master_keywords
                        c['address_overlap'] = len(overlap)
                        c['address_keywords'] = list(overlap)[:5]  # Store first 5 for debugging
                    
                    # Filter to only candidates with at least 1 keyword overlap
                    with_overlap = [c for c in matched_candidates if c.get('address_overlap', 0) >= 1]
                    if with_overlap:
                        matched_candidates = with_overlap
                        # Sort by overlap count (highest first) then match score
                        matched_candidates.sort(key=lambda x: (-x.get('address_overlap', 0), -x.get('match_score', 0)))
            
            # Sort by tier (lower is better) then score (higher is better)
            matched_candidates.sort(key=lambda x: (x.get('match_tier', 9), -x.get('match_score', 0)))
            
            # Log results
            if matched_candidates:
                best = matched_candidates[0]
                logger.debug(
                    f"Hybrid: Found {len(matched_candidates)} candidates for '{college_name[:30]}' "
                    f"(best: {best.get('name', '')[:30]} @ tier {best.get('match_tier')} {best.get('match_score', 0):.0f}%)"
                )
            
            return matched_candidates[:top_n]
            
        except Exception as e:
            logger.warning(f"Hybrid filter failed: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return []
    
    def _get_adaptive_batch_size(self, model: str, default: int = 15, total_records: int = 0) -> int:
        """
        Get CONSERVATIVE batch size to minimize hallucinations.
        
        Philosophy: Accuracy > Speed
        - Smaller batches = less context confusion
        - LLM focuses better on fewer records
        - Guardian/Council catches mistakes, but prevention is better
        
        Returns:
            Conservative batch size (5-25 range)
        """
        # Get model config for context window
        import yaml
        try:
            config_path = Path(__file__).parent / 'config.yaml'
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            model_config = config.get('agentic_matcher', {}).get('models', {}).get(model, {})
            context_window = model_config.get('max_tokens', 8192)
        except Exception:
            context_window = 8192
        
        # Conservative context calculation
        # ~200 tokens per record, use only 40% of context (safer margin)
        tokens_per_record = 200
        usable_context = int(context_window * 0.4)  # Conservative 40%
        max_by_context = max(5, usable_context // tokens_per_record)
        
        # Get performance recommendation (with FLOOR of 15 to prevent over-conservatism)
        perf_tracker = get_performance_tracker()
        recommended = perf_tracker.get_recommended_batch_size(model, default=default)
        recommended = max(15, recommended)  # Floor: don't let tracker go below 15
        
        # CONSERVATIVE: Take minimum, cap at 25 to prevent hallucinations
        final_size = min(max_by_context, recommended, 25)  # Hard cap at 25
        
        logger.debug(f"Conservative batch for {model}: context={max_by_context}, perf={recommended}, final={final_size}")
        
        return max(15, final_size)  # Minimum 15, Maximum 25
    
    def get_master_summary(self, course_types: List[str] = None, states: List[str] = None, cities: List[str] = None) -> str:
        """Build a compact summary of master colleges for the LLM.
        
        Args:
            course_types: Filter by course type (medical, dental, dnb, diploma)
            states: Filter to only include colleges from these states (prevents cross-state matches!)
            cities: Filter to only include colleges from these cities/addresses (prevents cross-city matches!)
        """
        conn = sqlite3.connect(self.master_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Load diploma course classification from config
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            diploma_config = config.get('diploma_courses', {})
            dnb_only_diplomas = [d.upper() for d in diploma_config.get('dnb_only', [])]
            overlapping_diplomas = [d.upper() for d in diploma_config.get('overlapping', [])]
        except:
            dnb_only_diplomas = []
            overlapping_diplomas = []
        
        # Determine which tables to search based on course types
        tables = set()
        if course_types:
            for ct in course_types:
                ct_upper = (ct or '').upper()
                
                if 'medical' in ct.lower() or 'mbbs' in ct.lower():
                    tables.add(('medical_colleges', 'MED'))
                elif 'dental' in ct.lower() or 'bds' in ct.lower():
                    tables.add(('dental_colleges', 'DEN'))
                elif 'dnb' in ct.lower():
                    tables.add(('dnb_colleges', 'DNB'))
                elif 'diploma' in ct.lower():
                    # Normalize diploma name: remove 'IN' which may or may not be present
                    # e.g., 'DIPLOMA IN FAMILY MEDICINE' → 'DIPLOMA FAMILY MEDICINE'
                    ct_normalized = ct_upper.replace(' IN ', ' ').strip()
                    
                    # Check against normalized config lists
                    dnb_match = any(
                        ct_normalized == d.replace(' IN ', ' ').strip() 
                        for d in dnb_only_diplomas
                    )
                    overlap_match = any(
                        ct_normalized == d.replace(' IN ', ' ').strip() 
                        for d in overlapping_diplomas
                    )
                    
                    if dnb_match:
                        # DNB-only diploma (e.g., Diploma in Family Medicine)
                        tables.add(('dnb_colleges', 'DNB'))
                    elif overlap_match:
                        # Overlapping diploma - search both MED and DNB
                        tables.add(('medical_colleges', 'MED'))
                        tables.add(('dnb_colleges', 'DNB'))
                    else:
                        # Default: Medical-only diploma
                        tables.add(('medical_colleges', 'MED'))
                else:
                    # Unknown course type - search all
                    tables.add(('medical_colleges', 'MED'))
                    tables.add(('dental_colleges', 'DEN'))
                    tables.add(('dnb_colleges', 'DNB'))
        
        if not tables:
            tables = [
                ('medical_colleges', 'MED'),
                ('dental_colleges', 'DEN'),
                ('dnb_colleges', 'DNB'),
            ]
        else:
            tables = list(tables)
        
        # States are already normalized in the data, just uppercase for comparison
        normalized_states = None
        if states:
            normalized_states = [s.upper().strip() for s in states if s]
        
        summary_lines = []
        for table, prefix in tables:
            try:
                if normalized_states:
                    # Filter by normalized_state - only send colleges from matching states
                    placeholders = ','.join('?' * len(normalized_states))
                    cursor.execute(f"""
                        SELECT id, 
                               COALESCE(normalized_name, name) as name,
                               COALESCE(normalized_state, state) as state, 
                               COALESCE(normalized_address, address) as address 
                        FROM {table}
                        WHERE UPPER(TRIM(COALESCE(normalized_state, state))) IN ({placeholders})
                        ORDER BY name
                    """, normalized_states)
                else:
                    cursor.execute(f"""
                        SELECT id, 
                               COALESCE(normalized_name, name) as name,
                               COALESCE(normalized_state, state) as state, 
                               COALESCE(normalized_address, address) as address 
                        FROM {table}
                        ORDER BY name
                    """)
                    
                for row in cursor.fetchall():
                    # Full format: ID|Name|State|Address (no truncation)
                    address = row["address"] or ""
                    # Include full address for better LLM context
                    summary_lines.append(
                        f"{row['id']}|{row['name'][:60]}|{row['state']}|{address}"
                    )
            except sqlite3.OperationalError as e:
                logger.debug(f"Table {table} query failed: {e}")
                continue
        
        conn.close()
        
        # Log filtering info
        if normalized_states:
            logger.debug(f"Master summary filtered to {len(summary_lines)} colleges from states: {normalized_states[:3]}")
        
        return "\n".join(summary_lines)
    
    def get_master_colleges_list(self, course_types: List[str] = None, states: List[str] = None) -> List[Dict]:
        """
        Get master colleges as a list of dicts (for pre-filtering).
        
        Args:
            course_types: Filter by course type (medical, dental, dnb, diploma)
            states: Filter to only include colleges from these states
            
        Returns:
            List of dicts with keys: id, name, state, address
        """
        conn = sqlite3.connect(self.master_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Determine which tables to query based on course types
        tables = set()
        if course_types:
            for ct in course_types:
                if 'medical' in ct.lower() or 'mbbs' in ct.lower():
                    tables.add(('medical_colleges', 'MED'))
                elif 'dental' in ct.lower() or 'bds' in ct.lower():
                    tables.add(('dental_colleges', 'DEN'))
                elif 'dnb' in ct.lower() or 'diploma' in ct.lower():
                    tables.add(('dnb_colleges', 'DNB'))
        
        if not tables:
            tables = [('medical_colleges', 'MED'), ('dental_colleges', 'DEN'), ('dnb_colleges', 'DNB')]
        else:
            tables = list(tables)
        
        normalized_states = None
        if states:
            normalized_states = [s.upper().strip() for s in states if s]
        
        colleges = []
        for table, prefix in tables:
            try:
                if normalized_states:
                    placeholders = ','.join('?' * len(normalized_states))
                    cursor.execute(f"""
                        SELECT id, 
                               COALESCE(normalized_name, name) as name,
                               COALESCE(normalized_state, state) as state, 
                               COALESCE(normalized_address, address) as address 
                        FROM {table}
                        WHERE UPPER(TRIM(COALESCE(normalized_state, state))) IN ({placeholders})
                    """, normalized_states)
                else:
                    cursor.execute(f"""
                        SELECT id, 
                               COALESCE(normalized_name, name) as name,
                               COALESCE(normalized_state, state) as state, 
                               COALESCE(normalized_address, address) as address 
                        FROM {table}
                    """)
                    
                for row in cursor.fetchall():
                    colleges.append({
                        'id': row['id'],
                        'name': row['name'],
                        'state': row['state'],
                        'address': row['address'] or ''
                    })
            except sqlite3.OperationalError:
                continue
        
        conn.close()
        return colleges
    
    def resolve_unmatched(
        self,
        table: str = 'seat_data',
        batch_size: int = 15,  # Moderate batch size for balance between speed and accuracy
        batch_delay: float = 60.0,
        parallel: bool = True,
        max_rounds: int = 2,  # Multiple rounds to retry unmatched
        round_delay: float = 30.0,  # Wait between rounds
        dry_run: bool = False,
        limit: int = 500,  # Current limit for processing (default 500)
    ) -> Tuple[int, int, List[MatchDecision]]:
        """
        Resolve all unmatched records using the agentic LLM.
        
        Args:
            table: Table to process (seat_data or counselling_records)
            batch_size: Records per API call (for very large datasets)
            parallel: Use parallel processing (requires multiple API keys)
            max_rounds: Number of retry rounds for unmatched records
            round_delay: Delay between rounds in seconds
            dry_run: If True, don't apply changes to database
            limit: Maximum number of records to process
        
        Returns:
            Tuple of (matched_count, unresolved_count, decisions)
        """
        import time as time_module
        
        num_workers = len(self.clients)
        mode = f"PARALLEL ({num_workers} workers)" if parallel and num_workers > 1 else "SEQUENTIAL"
        
        console.print(Panel.fit(
            "[bold cyan]🤖 AGENTIC LLM MATCHER[/bold cyan]\n"
            f"Mode: {mode}\n"
            f"Rounds: {max_rounds} (retry unmatched)\n"
            f"Table: {table}\n"
            f"Limit: {limit} records",
            border_style="cyan"
        ))
        
        # Step 1: Get unmatched records
        all_unmatched = self.get_unmatched_records(table, limit=limit)
        if not all_unmatched:
            console.print("[green]✅ No unmatched records found![/green]")
            return 0, 0, []
        
        console.print(f"[yellow]📋 Found {len(all_unmatched)} unmatched records[/yellow]")
        
        # Step 1.5: Check cache for previously matched records (reduces API calls)
        cached_decisions = []
        uncached_records = all_unmatched
        
        if self.cache:
            cached_count = 0
            uncached_records = []
            
            for record in all_unmatched:
                cache_entry = self.cache.get(
                    college_name=record.get('college_name', ''),
                    state=record.get('state', ''),
                    address=record.get('address', ''),
                    course_type=record.get('type'),
                )
                
                if cache_entry and cache_entry.matched_college_id:
                    # Use cached result
                    cached_decisions.append(MatchDecision(
                        record_id=record.get('record_id'),
                        matched_college_id=cache_entry.matched_college_id,
                        confidence=cache_entry.confidence,
                        reason=f"[CACHED] {cache_entry.reason}",
                        model=f"cache:{cache_entry.model_name}",
                    ))
                    cached_count += 1
                else:
                    uncached_records.append(record)
            
            if cached_count > 0:
                console.print(f"[green]✓ Cache hit: {cached_count}/{len(all_unmatched)} records from cache[/green]")
            
            # Update stats display
            cache_stats = self.cache.get_stats()
            console.print(f"[dim]Cache: {cache_stats['hit_rate']} hit rate, {cache_stats['total_entries']} entries[/dim]")
            
            if not uncached_records:
                console.print("[green]✅ All records matched from cache![/green]")
                return len(cached_decisions), 0, cached_decisions
        
        # Step 2: Get unique course types and STATES for targeted master data
        # Use uncached_records for LLM processing, all_unmatched for lookup
        course_types = list(set(r.get('type') for r in uncached_records if r.get('type')))
        # Extract unique states from uncached records - prevents cross-state matches!
        states = list(set(r.get('state') for r in uncached_records if r.get('state')))
        
        # Build lookup for state validation in response parsing (includes all for cache merge)
        unmatched_lookup = {r.get('record_id'): r for r in uncached_records}
        
        # Step 3: Build master summary (FILTERED by state + course_type)
        with console.status("[bold green]Building master data summary (state-filtered)..."):
            master_summary = self.get_master_summary(course_types, states=states)
        
        console.print(f"[yellow]📚 Master summary: {len(master_summary.split(chr(10)))} colleges (filtered to {len(states)} states)[/yellow]")
        
        # Load model configuration from config.yaml
        import yaml
        import os
        
        config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
        MODEL_CONFIG = {}
        
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            # Load models from agentic_matcher section
            if 'agentic_matcher' in config and 'models' in config['agentic_matcher']:
                MODEL_CONFIG = config['agentic_matcher']['models']
                console.print(f"[green]✅ Loaded {len(MODEL_CONFIG)} models from config.yaml[/green]")
            else:
                console.print("[yellow]⚠️ No agentic_matcher.models in config.yaml, using defaults[/yellow]")
                # Fallback to minimal defaults if config not found
                MODEL_CONFIG = {
                    "google/gemini-2.0-flash-exp:free": {
                        "max_tokens": 8192,
                        "batch_size": 50,
                        "timeout": 300,
                        "priority": 1
                    }
                }
        except Exception as e:
            console.print(f"[red]❌ Error loading config.yaml: {e}[/red]")
            # Fallback to minimal defaults
            MODEL_CONFIG = {
                "google/gemini-2.0-flash-exp:free": {
                    "max_tokens": 8192,
                    "batch_size": 50,
                    "timeout": 300,
                    "priority": 1
                }
            }
        
        # Get ordered list of models (sorted by priority: 0 first, then 1, then 2)
        WORKER_MODELS = sorted(
            MODEL_CONFIG.keys(),
            key=lambda m: MODEL_CONFIG[m].get('priority', 99)
        )
        
        # Track overall results
        all_decisions = []
        total_matched = 0
        current_unmatched = all_unmatched.copy()
        matched_ids = set()  # Track which records we've matched
        consecutive_zero_rounds = 0  # Smart early exit counter
        
        # =====================
        # MULTI-ROUND PROCESSING
        # =====================
        for round_num in range(1, max_rounds + 1):
            if not current_unmatched:
                break
            
            console.print(f"\n[bold magenta]{'='*50}[/bold magenta]")
            console.print(f"[bold magenta]🔄 ROUND {round_num}/{max_rounds} - {len(current_unmatched)} records to process[/bold magenta]")
            console.print(f"[bold magenta]{'='*50}[/bold magenta]")
            
            # Split into SINGLE-STATE batches
            # This ensures each batch only contains records from ONE state
            # which means the per-batch master summary filtering is effective
            from collections import defaultdict
            
            # Group records by state + course_type for better matching
            state_course_groups = defaultdict(list)
            for record in current_unmatched:
                state = record.get('state', 'UNKNOWN')
                course_type = record.get('type') or record.get('course_type') or record.get('sample_course_type') or 'medical'
                group_key = (state, course_type)
                state_course_groups[group_key].append(record)
            
            # ADAPTIVE BATCH SIZING: Use performance data for first model
            if WORKER_MODELS:
                first_model = WORKER_MODELS[0]
                adaptive_batch_size = self._get_adaptive_batch_size(
                    first_model, 
                    default=batch_size, 
                    total_records=len(current_unmatched)
                )
                console.print(f"[dim]   Adaptive batch size: {adaptive_batch_size} (based on {first_model.split('/')[-1].split(':')[0]}, {len(current_unmatched)} records)[/dim]")
            else:
                adaptive_batch_size = batch_size
            
            # Create batches from each state+course_type group
            batches = []
            for (state, course_type), records in state_course_groups.items():
                for i in range(0, len(records), adaptive_batch_size):
                    batches.append(records[i:i + adaptive_batch_size])
            
            total_batches = len(batches)
            console.print(f"[cyan]📦 Split into {total_batches} batches of ~{adaptive_batch_size} records (state+course_type grouped)[/cyan]")
            
            round_decisions = []
            round_matched = 0
            
            # Validation summary counters (displayed at end of round)
            validation_stats = {
                'null_addr_ok': 0,
                'null_addr_reject': 0,
                'city_reject': 0,
                'name_warn': 0,
            }

            
            if parallel and num_workers > 1:
                # PARALLEL PROCESSING with IMMEDIATE PARALLEL FALLBACK
                # Failed batches get re-dispatched instantly to available workers
                from concurrent.futures import ThreadPoolExecutor, as_completed, Future
                import threading
                import queue
                
                results_lock = threading.Lock()
                failed_queue = queue.Queue()  # Queue for failed batches to retry
                
                console.print(f"[green]🔄 Using PARALLEL FALLBACK (failed → instant retry on other workers)[/green]")
                
                def process_single_batch(batch_idx, batch, model, client_idx):
                    """Process a single batch with ONE model (no sequential fallback)."""
                    client = self.clients[client_idx % num_workers]
                    
                    # PER-BATCH STATE FILTERING: Get master colleges for THIS batch's states only
                    batch_states = list(set(r.get('state') for r in batch if r.get('state')))
                    batch_course_types = list(set(r.get('type') for r in batch if r.get('type')))
                    primary_course_type = batch_course_types[0] if batch_course_types else 'medical'
                    
                    # ADVANCED PRE-FILTERING: Use FTS5 (Primary) with Rapidfuzz (Fallback)
                    # NEW: Store candidates PER RECORD to prevent cross-matching
                    per_record_candidates = {}  # Dict[record_id] -> List[candidate_tuples]
                    fts_success_count = 0
                    fallback_count = 0
                    
                    for record in batch:
                        record_id = record.get('record_id') or record.get('id') or record.get('group_id') or str(hash(str(record)))
                        
                        # Use HYBRID FILTER (SQL + rapidfuzz with 3-tier matching)
                        record_course_type = record.get('type') or record.get('course_type') or record.get('sample_course_type') or primary_course_type
                        record_state = record.get('normalized_state') or record.get('state') or ''
                        record_college = record.get('normalized_college_name') or record.get('college_name') or ''
                        record_address = record.get('normalized_address') or record.get('address') or ''
                        
                        candidates = self._filter_candidates_hybrid(record, course_type=record_course_type, top_n=10)
                        
                        # NEW: TF-IDF PREFILTER - Add as secondary candidate source
                        # TF-IDF uses cosine similarity with strict state filtering (prevents cross-state matches)
                        if self.tfidf_enabled and self.tfidf_matrix is not None:
                            tfidf_query = f"{record_college} {record_address}"
                            tfidf_candidates = self._tfidf_prefilter(
                                tfidf_query, 
                                state=record_state, 
                                course_type=record_course_type, 
                                top_k=5
                            )
                            
                            # Merge TF-IDF candidates with hybrid candidates (avoid duplicates)
                            existing_ids = {c['id'] for c in candidates}
                            for tc in tfidf_candidates:
                                if tc['id'] not in existing_ids:
                                    # Convert TF-IDF candidate to hybrid format
                                    tc['match_score'] = tc['tfidf_score'] * 100  # Convert to percentage
                                    tc['match_method'] = 'tfidf'
                                    tc['normalized_state'] = tc['state']
                                    tc['normalized_address'] = tc['address']
                                    candidates.append(tc)
                        
                        # NEW: QUALITY FILTER - Skip records with no good candidates
                        # This prevents LLM from making false matches on generic names like "DISTRICT HOSPITAL"
                        MIN_CANDIDATE_QUALITY = 70.0  # Minimum match_score to consider valid
                        
                        # GENERIC NAME DETECTION - these need address matching too
                        college_name_upper = (record.get('college_name') or '').upper()
                        GENERIC_NAMES = ['AREA HOSPITAL', 'DISTRICT HOSPITAL', 'GENERAL HOSPITAL', 
                                        'CIVIL HOSPITAL', 'GOVERNMENT HOSPITAL', 'TALUK HOSPITAL']
                        is_generic_name = any(gn in college_name_upper for gn in GENERIC_NAMES)
                        
                        if candidates:
                            # Filter to only high-quality candidates
                            quality_candidates = [c for c in candidates if c.get('match_score', 0) >= MIN_CANDIDATE_QUALITY]
                            
                            # EXTRA FILTER: For generic names, also require address overlap
                            if is_generic_name and quality_candidates:
                                import re
                                seat_addr = (record.get('normalized_address') or record.get('address') or '').upper()
                                seat_addr_clean = re.sub(r'[^A-Z0-9]', '', seat_addr)
                                
                                def has_address_overlap(candidate):
                                    cand_addr = (candidate.get('normalized_address') or candidate.get('address') or '').upper()
                                    cand_addr_clean = re.sub(r'[^A-Z0-9]', '', cand_addr)
                                    
                                    # Check for any 4+ char word overlap (relaxed from 5 to handle PUNE, AGRA, etc.)
                                    seat_words = set(re.findall(r'[A-Z]{4,}', seat_addr))
                                    cand_words = set(re.findall(r'[A-Z]{4,}', cand_addr)) - {'HOSPITAL', 'DISTRICT', 'GOVERNMENT', 'GENERAL', 'AREA'}
                                    
                                    if seat_words & cand_words:
                                        return True
                                    # Check substring without spaces
                                    for cw in cand_words:
                                        if len(cw) >= 4 and cw in seat_addr_clean:
                                            return True
                                    # Also check if seat address is a substring of candidate address or vice versa
                                    if len(seat_addr_clean) >= 4 and (seat_addr_clean in cand_addr_clean or cand_addr_clean in seat_addr_clean):
                                        return True
                                    return False
                                
                                quality_candidates = [c for c in quality_candidates if has_address_overlap(c)]
                                if not quality_candidates:
                                    logger.debug(f"GENERIC NAME '{college_name_upper[:30]}' - no candidates with address overlap")
                            
                            if quality_candidates:
                                fts_success_count += 1
                                per_record_candidates[record_id] = [
                                    (c['id'], c['name'][:60], c.get('normalized_state', c.get('state', '')), 
                                     c.get('normalized_address', c.get('address', ''))[:80] if c.get('normalized_address') or c.get('address') else '')
                                    for c in quality_candidates
                                ]
                            else:
                                # No quality candidates - skip sending to LLM
                                college_name = record.get('college_name', '')[:40]
                                logger.debug(f"SKIPPED: '{college_name}' - no candidates with score >= {MIN_CANDIDATE_QUALITY}%")
                                # Don't add to per_record_candidates - this record will be marked "NO_MATCH"
                        else:
                            # FALLBACK: Use rapidfuzz Unique Identifier method
                            # BUG FIX: Use record_state (individual) NOT batch_states (all states)
                            fallback_count += 1
                            # Ensure record_state is a string (could be int state_id in some cases)
                            record_state_str = str(record_state) if record_state else ''
                            record_master_colleges = self.get_master_colleges_list([record_course_type], states=[record_state_str] if record_state_str else batch_states)
                            fallback_candidates = self._prefilter_candidates(record, record_master_colleges, top_n=10, min_similarity=MIN_CANDIDATE_QUALITY)
                            
                            if fallback_candidates:
                                per_record_candidates[record_id] = [
                                    (c['id'], c['name'][:60], c['state'], c['address'][:80] if c.get('address') else '')
                                    for c in fallback_candidates
                                ]
                            else:
                                # No quality fallback candidates either - skip
                                college_name = record.get('college_name', '')[:40]
                                logger.debug(f"SKIPPED (fallback): '{college_name}' - no candidates with score >= {MIN_CANDIDATE_QUALITY}%")
                    
                    # Build prompt with PER-RECORD candidates
                    if per_record_candidates:
                        logger.debug(f"Batch {batch_idx}: {sum(len(v) for v in per_record_candidates.values())} total candidates (FTS: {fts_success_count}, Fallback: {fallback_count})")
                        user_prompt = self._build_prompt_per_record(batch, per_record_candidates)
                    else:
                        # FIX: NO LONGER FALL BACK TO FULL LIST - This caused gross mismatches!
                        # When no quality candidates found, mark ALL records as NO_MATCH instead
                        # of sending them to LLM with all colleges in state (which allowed false matches)
                        logger.warning(f"Batch {batch_idx}: No quality candidates for any record - returning NO_MATCH for all {len(batch)} records")
                        no_match_decisions = []
                        for record in batch:
                            record_id = record.get('record_id') or record.get('id') or record.get('group_id') or str(hash(str(record)))
                            no_match_decisions.append(MatchDecision(
                                record_id=str(record_id),
                                matched_college_id=None,
                                confidence=0.0,
                                reason="No quality candidates (score >= 70%) found - skipped LLM",
                                model="quality_filter",
                            ))
                        return batch_idx, no_match_decisions, len(batch), {"model": "quality_filter", "success": True}
                    
                    model_config = MODEL_CONFIG.get(model, {})
                    model_max_tokens = model_config.get("max_tokens", 8192)
                    model_timeout = model_config.get("timeout", None)
                    
                    # Performance tracking
                    perf_tracker = get_performance_tracker()
                    import time as time_module
                    start_time = time_module.time()
                    
                    try:
                        response = client.complete(
                            messages=[
                                {"role": "system", "content": self.SYSTEM_PROMPT},
                                {"role": "user", "content": user_prompt},
                            ],
                            model=model,
                            temperature=0.1,
                            max_tokens=model_max_tokens,
                            timeout=model_timeout,
                        )
                        
                        # Record successful call
                        elapsed = time_module.time() - start_time
                        perf_tracker.record_call(
                            model=model,
                            success=True,
                            response_time=elapsed,
                            batch_size=len(batch),
                        )
                        
                        # Circuit breaker: record success
                        circuit_breaker = get_circuit_breaker()
                        circuit_breaker.record_success(model)
                        
                        # Cost tracking: record token usage
                        cost_tracker = get_cost_tracker()
                        usage = response.usage if hasattr(response, 'usage') else {}
                        cost_tracker.record_usage(
                            model=model,
                            prompt_tokens=usage.get('prompt_tokens', 0),
                            completion_tokens=usage.get('completion_tokens', 0),
                        )
                        
                        decisions = self._parse_response(response.content, unmatched_lookup, model=model)
                        return batch_idx, decisions, len(batch), {"model": model, "success": True}
                    except Exception as e:
                        elapsed = time_module.time() - start_time
                        error_code = None
                        if "429" in str(e):
                            error_code = "rate_limit"
                        elif "timeout" in str(e).lower() or "503" in str(e):
                            error_code = "timeout"
                        
                        # Record failed call
                        perf_tracker.record_call(
                            model=model,
                            success=False,
                            response_time=elapsed,
                            error_type=error_code,
                            batch_size=len(batch),
                        )
                        
                        # Circuit breaker: record failure (may trip)
                        circuit_breaker = get_circuit_breaker()
                        circuit_breaker.record_failure(model)
                        
                        return batch_idx, batch, len(batch), {"model": model, "error": error_code or "error", "success": False}
                
                # Process ALL batches with immediate parallel fallback
                all_batches = [(i, batch) for i, batch in enumerate(batches)]
                pending_batches = all_batches.copy()
                completed_results = {}
                models_tried = {i: set() for i in range(len(batches))}  # Track which models tried per batch
                
                console.print(f"\n[cyan]🚀 Processing {len(batches)} batches with {num_workers} parallel workers[/cyan]")
                
                max_attempts = min(len(WORKER_MODELS), 5)  # Max models to try per batch
                
                with ThreadPoolExecutor(max_workers=num_workers) as executor:
                    # Submit initial jobs - one per batch, different models
                    # ROUND-ROBIN ROTATION: Each round starts with a different model
                    # This ensures unmatched records get different "perspectives"
                    round_offset = (round_num - 1) % len(WORKER_MODELS)
                    starting_model = WORKER_MODELS[round_offset].split("/")[-1].split(":")[0]
                    console.print(f"[dim]   Round {round_num} starting model: {starting_model}[/dim]")
                    
                    futures = {}
                    for i, (batch_idx, batch) in enumerate(pending_batches):
                        # Rotate model based on both batch index AND round number
                        model_idx = (round_offset + i) % len(WORKER_MODELS)
                        model = WORKER_MODELS[model_idx]
                        models_tried[batch_idx].add(model)
                        future = executor.submit(process_single_batch, batch_idx, batch, model, i)
                        futures[future] = (batch_idx, batch)
                    
                    # Initialize SmartRetryQueue for intelligent model selection
                    retry_queue = get_retry_queue()
                    
                    # Progress bar for batch completion
                    completed_count = 0
                    matched_total = 0
                    
                    with Progress(
                        SpinnerColumn(),
                        TextColumn("[progress.description]{task.description}"),
                        BarColumn(),
                        TextColumn("{task.completed}/{task.total}"),
                        TextColumn("•"),
                        TextColumn("[green]{task.fields[matched]} matched[/green]"),
                        console=console,
                    ) as progress:
                        batch_task = progress.add_task(
                            f"Round {round_num} batches", 
                            total=total_batches, 
                            matched=0
                        )
                        
                        while futures:
                            # Wait for any batch to complete
                            done_futures = []
                            pending_retries = []  # Collect retries here, submit AFTER for loop
                            
                            for future in as_completed(futures):
                                batch_idx, result, batch_len, info = future.result()
                                
                                if info.get("success"):
                                    # Success! Record result and notify retry queue
                                    is_new_completion = batch_idx not in completed_results
                                    completed_results[batch_idx] = (result, info)
                                    batch_matched = sum(1 for d in result if d.matched_college_id)
                                    matched_total += batch_matched
                                    retry_queue.on_success(info["model"])  # Reduce backoff
                                    
                                    # Only advance progress for NEW batch completions, not retries
                                    if is_new_completion:
                                        completed_count += 1
                                        progress.update(batch_task, advance=1, matched=matched_total)


                                else:
                                    # Failed - notify retry queue and get next best model
                                    batch = futures[future][1]
                                    tried = models_tried[batch_idx]
                                    error_type = info.get("error")
                                    failed_model = info.get("model")
                                    
                                    # Record error in retry queue (applies cooldown/backoff)
                                    retry_queue.on_error(failed_model, error_type)
                                    
                                    # Skip retry if already completed by another attempt
                                    if batch_idx in completed_results:
                                        done_futures.append(future)
                                        continue
                                    
                                    # Use SmartRetryQueue to get best available model
                                    if len(tried) < max_attempts:
                                        next_model = retry_queue.get_next_model(WORKER_MODELS, tried)
                                        
                                        if next_model:
                                            models_tried[batch_idx].add(next_model)
                                            # Queue for retry AFTER this for loop completes
                                            pending_retries.append((batch_idx, batch, next_model, len(tried)))
                                        else:
                                            # All models exhausted or on cooldown
                                            fallback_decisions = self._hybrid_fallback_batch(batch)
                                            fallback_matched = sum(1 for d in fallback_decisions if d.matched_college_id)
                                            completed_results[batch_idx] = (fallback_decisions, {"model": "hybrid_fallback", "success": True})
                                            matched_total += fallback_matched
                                            completed_count += 1
                                            progress.update(batch_task, advance=1, matched=matched_total)
                                            # Removed verbose fallback log
                                    else:
                                        # GRACEFUL DEGRADATION: Use hybrid scoring fallback
                                        fallback_decisions = self._hybrid_fallback_batch(batch)
                                        fallback_matched = sum(1 for d in fallback_decisions if d.matched_college_id)
                                        completed_results[batch_idx] = (fallback_decisions, {"model": "hybrid_fallback", "success": True})
                                        matched_total += fallback_matched
                                        completed_count += 1
                                        progress.update(batch_task, advance=1, matched=matched_total)
                                        # Removed verbose fallback log
                                
                                done_futures.append(future)

                        
                            # Remove completed futures - AFTER for loop, safe to modify dict now
                            for f in done_futures:
                                if f in futures:
                                    del futures[f]
                            
                            # Submit pending retries AFTER modifying futures dict
                            for batch_idx, batch, next_model, client_idx in pending_retries:
                                # Small delay before retry
                                import time
                                time.sleep(0.5)  # Reduced from 1.5s for efficiency
                                
                                new_future = executor.submit(
                                    process_single_batch, 
                                    batch_idx, 
                                    batch, 
                                    next_model, 
                                    client_idx
                                )
                                futures[new_future] = (batch_idx, batch)

                
                # Aggregate results
                for batch_idx in range(len(batches)):
                    result, info = completed_results.get(batch_idx, ([], {}))
                    if isinstance(result, list) and result and hasattr(result[0], 'matched_college_id'):
                        round_decisions.extend(result)
                        round_matched += sum(1 for d in result if d.matched_college_id)
                        
                        # Cache LLM suggestions (unverified) - Guardian will mark_verified() or invalidate()
                        if self.cache:
                            for d in result:
                                if d.matched_college_id and d.record_id in unmatched_lookup:
                                    record = unmatched_lookup[d.record_id]
                                    self.cache.set(
                                        college_name=record.get('college_name', ''),
                                        state=record.get('state', ''),
                                        address=record.get('address', ''),
                                        matched_college_id=d.matched_college_id,
                                        confidence=d.confidence,
                                        reason=d.reason,
                                        model_name=d.model or info.get('model', 'unknown'),
                                        course_type=record.get('type'),
                                        verified=False,  # Will be verified by Guardian
                                    )
            else:
                # Sequential mode (with pre-filtering)
                for i, batch in enumerate(batches):
                    # STAGE 1: Get all master colleges for batch states
                    batch_states = list(set(r.get('state') for r in batch if r.get('state')))
                    batch_course_types = list(set(r.get('type') for r in batch if r.get('type')))
                    all_master_colleges = self.get_master_colleges_list(batch_course_types, states=batch_states)
                    
                    # STAGE 2: Pre-filter candidates per record using HYBRID FILTER
                    per_record_candidates = {}
                    for record in batch:
                        record_id = record.get('record_id') or record.get('id') or record.get('group_id') or str(hash(str(record)))
                        # Use HYBRID FILTER (SQL + rapidfuzz with 3-tier matching)
                        record_course_type = record.get('type') or record.get('course_type') or record.get('sample_course_type') or 'medical'
                        candidates = self._filter_candidates_hybrid(record, course_type=record_course_type, top_n=10)
                        
                        # QUALITY FILTER - Same as parallel path
                        MIN_CANDIDATE_QUALITY = 70.0
                        if candidates:
                            quality_candidates = [c for c in candidates if c.get('match_score', 0) >= MIN_CANDIDATE_QUALITY]
                            if quality_candidates:
                                per_record_candidates[record_id] = [
                                    (c['id'], c['name'][:60], c.get('normalized_state', c.get('state', '')), 
                                     c.get('normalized_address', c.get('address', ''))[:80] if c.get('normalized_address') or c.get('address') else '')
                                    for c in quality_candidates
                                ]
                            # else: no quality candidates → record will be NO_MATCH
                    
                    # Build focused prompt with PER-RECORD candidates
                    if per_record_candidates:
                        user_prompt = self._build_prompt_per_record(batch, per_record_candidates)
                    else:
                        user_prompt = self._build_prompt(batch, master_summary)
                    # Get config for default primary model (or use defaults)
                    default_model = self.client.MODELS["primary"]
                    model_config = MODEL_CONFIG.get(default_model, {})
                    
                    try:
                        response = self.client.complete_with_retry(
                            messages=[
                                {"role": "system", "content": self.SYSTEM_PROMPT},
                                {"role": "user", "content": user_prompt},
                            ],
                            temperature=0.1,
                            max_tokens=model_config.get("max_tokens", 16384),
                            timeout=model_config.get("timeout", None),
                        )
                        decisions = self._parse_response(response.content, unmatched_lookup, model=default_model)
                        round_decisions.extend(decisions)
                        batch_matched = sum(1 for d in decisions if d.matched_college_id)
                        round_matched += batch_matched
                        console.print(f"   [green]✓ Batch {i+1}: {batch_matched}/{len(batch)} (candidates: {len(prefiltered_candidates)})[/green]")
                    except Exception as e:
                        console.print(f"[red]❌ Batch {i+1} failed: {e}[/red]")
                    
                    if i < len(batches) - 1 and batch_delay > 0:
                        time_module.sleep(batch_delay)
            
            # Update matched records
            all_decisions.extend(round_decisions)
            total_matched += round_matched
            
            # Find records that are still unmatched for next round
            for d in round_decisions:
                if d.matched_college_id:
                    matched_ids.add(d.record_id)
            
            current_unmatched = [r for r in current_unmatched if r.get('record_id') not in matched_ids]
            
            console.print(f"\n[bold green]📊 Round {round_num} Complete:[/bold green]")
            console.print(f"   Matched this round: {round_matched}")
            console.print(f"   Total matched: {total_matched}")
            console.print(f"   Remaining unmatched: {len(current_unmatched)}")
            
            # Validation summary (only show if any validations occurred)
            if any(validation_stats.values()):
                console.print(f"   [dim]Validations: ✅ NULL_OK={validation_stats['null_addr_ok']} "
                              f"❌ NULL_REJ={validation_stats['null_addr_reject']} "
                              f"❌ CITY_REJ={validation_stats['city_reject']} "
                              f"⚠️ NAME_WARN={validation_stats['name_warn']}[/dim]")

            
            # SMART EARLY EXIT: Track consecutive zero-match rounds
            if round_matched == 0:
                consecutive_zero_rounds += 1
                if consecutive_zero_rounds >= 3:
                    console.print(f"\n[yellow]⚠️ SMART EXIT: 3 consecutive rounds with 0 new matches[/yellow]")
                    console.print(f"[yellow]   Exiting early to save API calls. {len(current_unmatched)} records unmatchable.[/yellow]")
                    break
            else:
                consecutive_zero_rounds = 0  # Reset counter on successful round
            
            # Wait between rounds
            if round_num < max_rounds and current_unmatched and round_delay > 0:
                console.print(f"\n[yellow]⏳ Waiting {round_delay}s before Round {round_num + 1}...[/yellow]")
                time_module.sleep(round_delay)
        
        # Step 5: Apply to database (if not dry run)
        if not dry_run and total_matched > 0:
            self._apply_decisions(table, all_decisions)
            console.print(f"\n[green]✅ Applied {total_matched} matches to database[/green]")
        elif dry_run:
            console.print(f"\n[yellow]⚠️  Dry run - no changes applied[/yellow]")
        
        # UNMATCHABLE FLAGGING: Mark remaining records
        if current_unmatched and not dry_run:
            self._flag_unmatchable(table, current_unmatched)
            console.print(f"\n[yellow]🏷️ Flagged {len(current_unmatched)} records as 'unmatchable_by_agentic'[/yellow]")
        
        # Summary - merge cached and LLM decisions
        all_final_decisions = cached_decisions + all_decisions
        total_matched_with_cache = total_matched + len(cached_decisions)
        unresolved = len(all_unmatched) - total_matched_with_cache
        
        # Report cache contribution
        if cached_decisions:
            console.print(f"\n[green]📦 Cache contributed {len(cached_decisions)} matches[/green]")
        
        if self.cache:
            cache_stats = self.cache.get_stats()
            console.print(f"[dim]Cache session: {cache_stats['session_writes']} writes, {cache_stats['hit_rate']} hit rate[/dim]")
        
        self._print_summary(all_final_decisions, total_matched_with_cache, unresolved)
        
        return total_matched_with_cache, unresolved, all_final_decisions
    
    def _build_prompt(self, unmatched: List[Dict], master_summary: str) -> str:
        """Build the user prompt for the LLM (legacy pooled candidates version)."""
        unmatched_json = json.dumps(unmatched, indent=2, ensure_ascii=False)
        
        return f"""UNMATCHED RECORDS ({len(unmatched)} total):
{unmatched_json}

MASTER COLLEGE DATABASE (format: ID|Name|State|Full_Address):
{master_summary}

Analyze each unmatched record and find the best matching master college.
Return your decisions as a JSON array."""
    
    def _build_prompt_per_record(self, unmatched: List[Dict], per_record_candidates: Dict[str, List[tuple]]) -> str:
        """
        Build the user prompt with PER-RECORD candidates.
        
        This prevents cross-matching by clearly associating each record with ONLY its candidates.
        Uses COMBINED "name, address" format for better matching accuracy.
        
        Args:
            unmatched: List of unmatched records
            per_record_candidates: Dict mapping record_id -> List of (id, name, state, address) tuples
        """
        records_with_candidates = []
        
        for record in unmatched:
            record_id = record.get('record_id') or record.get('id') or record.get('group_id') or str(hash(str(record)))
            candidates = per_record_candidates.get(str(record_id), [])
            
            # Get record fields
            college_name = record.get('normalized_college_name') or record.get('college_name', '')
            address = record.get('normalized_address') or record.get('address', '')
            state = record.get('normalized_state') or record.get('state', '')
            course_type = record.get('sample_course_type') or record.get('course_type') or record.get('type', '')
            
            # Create COMBINED string for better matching
            input_combined = f"{college_name}, {address}" if address else college_name
            
            # Format candidates with COMBINED format
            # Format: ID | Name | State | Address | Combined (Name, Address)
            if candidates:
                candidates_lines = []
                for c in candidates:
                    cand_id, cand_name, cand_state, cand_addr = c[0], c[1], c[2], c[3] if len(c) > 3 else ''
                    cand_combined = f"{cand_name}, {cand_addr}" if cand_addr else cand_name
                    candidates_lines.append(f"{cand_id} | {cand_combined} | State: {cand_state}")
                candidates_str = "\n    ".join(candidates_lines)
            else:
                candidates_str = "(No candidates found - mark as unmatched)"
            
            records_with_candidates.append(
                f"""RECORD: {record_id}
  Combined: {input_combined}
  College Name: {college_name}
  Address: {address}
  State: {state}
  Course Type: {course_type}
  
  CANDIDATES FOR THIS RECORD (ID | Combined Name+Address | State):
    {candidates_str}
"""
        )
        
        # NEGATIVE EXAMPLE INJECTION: Add warnings based on batch content
        negative_examples = self._get_negative_examples(unmatched)
        
        return f"""MATCH EACH RECORD TO ITS CANDIDATES ONLY.

CRITICAL: Each record has its OWN candidate list. DO NOT use candidates from other records!
If a record's candidate list is empty or shows "(No candidates found)", set matched_college_id to null.

MATCHING TIP: Compare the COMBINED "Name, Address" strings for best accuracy.
The "Combined" field merges name and address for easier comparison.
{negative_examples}
{chr(10).join(records_with_candidates)}

For each record, analyze its candidates and pick the BEST match (or null if none match).
IMPORTANT: Only pick from that record's OWN candidates - cross-matching is FORBIDDEN.

Return your decisions as a JSON array with format:
[{{"record_id": "...", "matched_college_id": "..." or null, "matched_state": "...", "confidence": 0.0-1.0, "reason": "..."}}]"""
    
    def _parse_response(self, content: str, unmatched_lookup: Dict[str, Dict] = None, model: str = "") -> List[MatchDecision]:
        """Parse LLM response into MatchDecision objects.
        
        Args:
            content: Raw LLM response
            unmatched_lookup: Dict mapping record_id -> original record data (for state validation)
            model: Name of the LLM model that produced this response
        """
        decisions = []
        
        # State comparison - use config-based normalization for aliases like DELHI → DELHI (NCT)
        def normalize_state(s):
            if not s:
                return ''
            s_upper = s.upper().strip()
            # Apply state name mappings from config
            state_mappings = {
                'DELHI': 'DELHI (NCT)',
                'NEW DELHI': 'DELHI (NCT)',
                'ORISSA': 'ODISHA',
            }
            return state_mappings.get(s_upper, s_upper)
        
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_str = content
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()
            
            data = json.loads(json_str)
            
            if isinstance(data, list):
                for item in data:
                    record_id = item.get("record_id", "")
                    matched_college_id = item.get("matched_college_id")
                    matched_state = item.get("matched_state", "")
                    confidence = float(item.get("confidence", 0))
                    reason = item.get("reason", "")
                    
                    # STATE VALIDATION: Compare matched_state with original record's state
                    if matched_college_id and unmatched_lookup and record_id in unmatched_lookup:
                        original_record = unmatched_lookup[record_id]
                        # FIXED: Use normalized_state first (already has config-based normalization)
                        original_state = original_record.get('normalized_state') or original_record.get('state', '')
                        
                        if matched_state and original_state:
                            # Apply same normalization to matched_state (from LLM response)
                            norm_original = normalize_state(original_state)
                            norm_matched = normalize_state(matched_state)
                            
                            if norm_original != norm_matched:
                                logger.warning(
                                    f"STATE MISMATCH REJECTED: {record_id} - "
                                    f"Original: {original_state} != Matched: {matched_state}"
                                )
                                console.print(
                                    f"[red]❌ STATE REJECTED (in response): {record_id} - "
                                    f"{original_state} ≠ {matched_state}[/red]"
                                )
                                matched_college_id = None  # Reject the match
                                reason = f"State mismatch rejected: {original_state} != {matched_state}"
                    
                    # NAME VALIDATION: Compare college name with matched college name
                    # Catches LLM hallucinations where completely different colleges are matched
                    # PRIORITY: corrected_college_name (from Name Fixer) > normalized > original
                    if matched_college_id and unmatched_lookup and record_id in unmatched_lookup:
                        original_record = unmatched_lookup[record_id]
                        original_college_name = (
                            original_record.get('corrected_college_name') or 
                            original_record.get('normalized_college_name') or 
                            original_record.get('college_name', '')
                        )
                        
                        if original_college_name and matched_college_id:
                            try:
                                # Fetch matched college name from master DB
                                conn = sqlite3.connect(self.master_db_path)
                                conn.row_factory = sqlite3.Row
                                cursor = conn.cursor()
                                
                                # Determine table based on matched_college_id prefix
                                if matched_college_id.startswith('MED'):
                                    table = 'medical_colleges'
                                elif matched_college_id.startswith('DEN'):
                                    table = 'dental_colleges'
                                else:
                                    table = 'dnb_colleges'
                                
                                cursor.execute(f"""
                                    SELECT COALESCE(normalized_name, name) as name 
                                    FROM {table} 
                                    WHERE id = ?
                                """, (matched_college_id,))
                                row = cursor.fetchone()
                                conn.close()
                                
                                if row:
                                    matched_college_name = row['name']
                                    
                                    # Calculate name similarity using rapidfuzz
                                    from rapidfuzz import fuzz
                                    name_similarity = fuzz.token_set_ratio(
                                        original_college_name.upper(),
                                        matched_college_name.upper()
                                    )
                                    
                                    # STRICT: Reject if similarity < 65% (was 50%)
                                    # Common words like MEDICAL, INSTITUTE inflate scores
                                    if name_similarity < 65:
                                        logger.warning(
                                            f"NAME MISMATCH REJECTED: {record_id} - "
                                            f"Original: '{original_college_name[:40]}' vs Matched: '{matched_college_name[:40]}' "
                                            f"(similarity: {name_similarity}%)"
                                        )
                                        console.print(
                                            f"[red]❌ NAME REJECTED: {record_id} - "
                                            f"'{original_college_name[:30]}' ≠ '{matched_college_name[:30]}' "
                                            f"({name_similarity:.1f}% similar)[/red]"
                                        )
                                        # AUDIT LOG: Capture for review
                                        audit = get_audit_logger()
                                        audit.log_match(
                                            record_id=record_id,
                                            seat_college_name=original_college_name,
                                            seat_state=original_record.get('state', '') if 'original_record' in dir() else '',
                                            seat_address=original_record.get('address', '') if 'original_record' in dir() else '',
                                            matched_college_id=matched_college_id,
                                            master_college_name=matched_college_name,
                                            master_state=None,
                                            master_address=None,
                                            confidence=item.get('confidence', 0),
                                            name_similarity=name_similarity / 100.0,
                                            status='NAME_REJECTED',
                                            reason=f"Similarity {name_similarity:.1f}% < 65% threshold",
                                            model=model,
                                        )
                                        matched_college_id = None
                                        reason = f"Name mismatch: '{original_college_name[:30]}' != '{matched_college_name[:30]}' ({name_similarity:.1f}%)"
                                    elif name_similarity < 80:
                                        # Warn for 65-80% similarity (borderline)
                                        console.print(
                                            f"[yellow]⚠️ NAME WARN: {record_id} - "
                                            f"'{original_college_name[:30]}' ~ '{matched_college_name[:30]}' "
                                            f"({name_similarity:.1f}%)[/yellow]"
                                        )
                                        # AUDIT LOG: Capture for review
                                        audit = get_audit_logger()
                                        audit.log_match(
                                            record_id=record_id,
                                            seat_college_name=original_college_name,
                                            seat_state=original_record.get('state', '') if 'original_record' in dir() else '',
                                            seat_address=original_record.get('address', '') if 'original_record' in dir() else '',
                                            matched_college_id=matched_college_id,
                                            master_college_name=matched_college_name,
                                            master_state=None,
                                            master_address=None,
                                            confidence=item.get('confidence', 0),
                                            name_similarity=name_similarity / 100.0,
                                            status='NAME_WARN',
                                            reason=f"Borderline similarity {name_similarity:.1f}% (65-80%)",
                                            model=model,
                                        )
                            except Exception as e:
                                logger.debug(f"Name validation failed for {record_id}: {e}")
                    
                    # CITY/ADDRESS VALIDATION: Compare matched_city with original record's address
                    if matched_college_id and unmatched_lookup and record_id in unmatched_lookup:
                        original_record = unmatched_lookup[record_id]
                        # FIXED: Use normalized_address first (consistent with hybrid filter)
                        original_address = original_record.get('normalized_address') or original_record.get('address', '')
                        college_name = original_record.get('normalized_college_name') or original_record.get('college_name', '')
                        matched_city = item.get("matched_city", "")
                        
                        # Get state early for validation check
                        original_state = original_record.get('state', '')
                        original_state_norm = original_state.upper().strip() if original_state else ''
                        
                        # Skip city validation if matched_city is invalid (NAN, NULL, empty, numeric)
                        invalid_city_values = {'NAN', 'NULL', 'NONE', 'N/A', 'NA', ''}
                        matched_city_clean = matched_city.upper().strip() if matched_city else ''
                        
                        skip_city_validation = (
                            matched_city_clean in invalid_city_values or
                            matched_city_clean.replace('.', '').isdigit() or # Skip if just numbers
                            matched_city_clean == original_state_norm or # Skip if City == State (redundant check)
                            matched_city_clean in ('INDIA', 'BHARAT')    # Skip country names
                        )
                        
                        # Dynamic multi-campus detection: Query within SAME STATE as unmatched record
                        # FIXED: Exclude generic short names like "DENTAL COLLEGE" which exist everywhere
                        is_multi_campus = False
                        if matched_college_id and not skip_city_validation:
                            try:
                                # Determine table based on matched_college_id prefix
                                if matched_college_id.startswith('MED'):
                                    table = 'medical_colleges'
                                elif matched_college_id.startswith('DEN'):
                                    table = 'dental_colleges'
                                else:
                                    table = 'dnb_colleges'
                                
                                master_conn = sqlite3.connect(self.master_db_path)
                                master_cursor = master_conn.cursor()
                                
                                # Get the normalized_name of the matched college
                                master_cursor.execute(f"""
                                    SELECT COALESCE(normalized_name, name) as norm_name 
                                    FROM {table} WHERE id = ?
                                """, (matched_college_id,))
                                row = master_cursor.fetchone()
                                
                                if row and original_state_norm:
                                    matched_norm_name = row[0]
                                    
                                    # BUGFIX: Generic short names should NOT trigger multi-campus
                                    # "DENTAL COLLEGE", "MEDICAL COLLEGE" exist everywhere but aren't multi-campus
                                    GENERIC_NAMES = {
                                        'DENTAL COLLEGE', 'MEDICAL COLLEGE', 'HOSPITAL',
                                        'GOVERNMENT HOSPITAL', 'DISTRICT HOSPITAL',
                                        'GENERAL HOSPITAL', 'CIVIL HOSPITAL'
                                    }
                                    
                                    is_generic_name = (
                                        matched_norm_name.upper().strip() in GENERIC_NAMES or
                                        len(matched_norm_name) < 25  # Short names are likely generic
                                    )
                                    
                                    if not is_generic_name:
                                        # Only check for multi-campus if name is specific enough
                                        master_cursor.execute(f"""
                                            SELECT COUNT(*) FROM {table} 
                                            WHERE COALESCE(normalized_name, name) = ?
                                            AND UPPER(TRIM(COALESCE(normalized_state, state))) = ?
                                        """, (matched_norm_name, original_state_norm))
                                        campus_count = master_cursor.fetchone()[0]
                                        is_multi_campus = campus_count > 1
                                
                                master_conn.close()
                            except Exception as e:
                                logger.debug(f"Multi-campus check failed: {e}")
                        
                        # NULL ADDRESS VALIDATION: Stricter rules when no address available
                        # For NULL address records, require: (1) single-campus AND (2) high name match
                        original_addr_norm = (original_address or '').upper().strip()
                        is_null_address = original_addr_norm in ('', 'NULL', 'NAN', 'NONE', 'N/A', 'NA', '-')
                        
                        if matched_college_id and is_null_address:
                            # Calculate name similarity if not already done
                            try:
                                from rapidfuzz import fuzz
                                match_college_name = ''
                                # Determine table based on matched_college_id prefix
                                if matched_college_id.startswith('MED'):
                                    null_check_table = 'medical_colleges'
                                elif matched_college_id.startswith('DEN'):
                                    null_check_table = 'dental_colleges'
                                else:
                                    null_check_table = 'dnb_colleges'
                                
                                null_conn = sqlite3.connect(self.master_db_path)
                                null_cursor = null_conn.cursor()
                                null_cursor.execute(f"""
                                    SELECT COALESCE(normalized_name, name) as name 
                                    FROM {null_check_table} WHERE id = ?
                                """, (matched_college_id,))
                                null_row = null_cursor.fetchone()
                                null_conn.close()
                                
                                if null_row:
                                    match_college_name = null_row[0]
                                    null_name_sim = fuzz.token_set_ratio(
                                        college_name.upper(), 
                                        match_college_name.upper()
                                    )
                                    # Also check substring match
                                    is_substring = (college_name.upper() in match_college_name.upper() or 
                                                   match_college_name.upper() in college_name.upper())
                                    
                                    # For NULL address: single-campus + (exact OR ≥90% fuzzy OR substring)
                                    is_high_name_match = (null_name_sim == 100 or null_name_sim >= 90 or is_substring)
                                    
                                    if is_multi_campus:
                                        # CONDITION 1 FAILED: Multi-campus with NULL address → REJECT
                                        logger.warning(
                                            f"NULL ADDRESS REJECTED (multi-campus): {record_id} - "
                                            f"Multi-campus college '{match_college_name[:40]}' requires address to disambiguate"
                                        )
                                        console.print(
                                            f"[red]❌ NULL ADDR REJECTED (multi-campus): {record_id} - "
                                            f"'{college_name[:25]}' → multi-campus, needs address[/red]"
                                        )
                                        # AUDIT LOG
                                        audit = get_audit_logger()
                                        audit.log_match(
                                            record_id=record_id,
                                            seat_college_name=college_name,
                                            seat_state=original_state,
                                            seat_address='',
                                            matched_college_id=matched_college_id,
                                            master_college_name=match_college_name,
                                            master_state=None,
                                            master_address=None,
                                            confidence=item.get('confidence', 0),
                                            name_similarity=null_name_sim / 100.0,
                                            status='NULL_ADDR_REJECTED',
                                            reason=f"Multi-campus college needs address to disambiguate",
                                            model=model,
                                        )
                                        matched_college_id = None
                                        reason = f"Multi-campus college with NULL address cannot be verified"
                                    elif not is_high_name_match:
                                        # CONDITION 2 FAILED: Not high enough name match
                                        logger.warning(
                                            f"NULL ADDRESS REJECTED (low name match): {record_id} - "
                                            f"Name similarity {null_name_sim:.0f}% < 90% required for NULL address"
                                        )
                                        console.print(
                                            f"[red]❌ NULL ADDR REJECTED (name): {record_id} - "
                                            f"'{college_name[:20]}' ~ '{match_college_name[:20]}' ({null_name_sim:.0f}% < 90%)[/red]"
                                        )
                                        # AUDIT LOG
                                        audit = get_audit_logger()
                                        audit.log_match(
                                            record_id=record_id,
                                            seat_college_name=college_name,
                                            seat_state=original_state,
                                            seat_address='',
                                            matched_college_id=matched_college_id,
                                            master_college_name=match_college_name,
                                            master_state=None,
                                            master_address=None,
                                            confidence=item.get('confidence', 0),
                                            name_similarity=null_name_sim / 100.0,
                                            status='NULL_ADDR_REJECTED',
                                            reason=f"NULL address + low name match ({null_name_sim:.0f}% < 90%)",
                                            model=model,
                                        )
                                        validation_stats['null_addr_reject'] += 1
                                        matched_college_id = None
                                        reason = f"NULL address + low name match ({null_name_sim:.0f}% < 90%)"
                                    else:
                                        # Both conditions passed - silently log, summary at end

                                        # AUDIT LOG (approved)
                                        audit = get_audit_logger()
                                        audit.log_match(
                                            record_id=record_id,
                                            seat_college_name=college_name,
                                            seat_state=original_state,
                                            seat_address='',
                                            matched_college_id=matched_college_id,
                                            master_college_name=match_college_name,
                                            master_state=None,
                                            master_address=None,
                                            confidence=item.get('confidence', 0),
                                            name_similarity=null_name_sim / 100.0,
                                            status='NULL_ADDR_OK',
                                            reason=f"Single-campus + {null_name_sim:.0f}% name match",
                                            model=model,
                                        )
                                        validation_stats['null_addr_ok'] += 1
                            except Exception as e:
                                logger.debug(f"NULL address validation failed: {e}")
                        
                        # Combine college name + address for city search
                        # Master: "GOVT MEDICAL COLLEGE" + "PATIALA" 
                        # Seat: "GOVT MEDICAL COLLEGE PATIALA" + "PUNJAB, 147001"
                        # City "PATIALA" is in seat college name, not address
                        if not skip_city_validation and matched_college_id:
                            # FIXED: Fetch ACTUAL address from master DB instead of trusting LLM's matched_city
                            # LLM may invent cities (e.g., "MUMBAI" for INHS Aswini) that cause false rejections
                            try:
                                if matched_college_id.startswith('MED'):
                                    addr_table = 'medical_colleges'
                                elif matched_college_id.startswith('DEN'):
                                    addr_table = 'dental_colleges'
                                else:
                                    addr_table = 'dnb_colleges'
                                
                                addr_conn = sqlite3.connect(self.master_db_path)
                                addr_cursor = addr_conn.cursor()
                                addr_cursor.execute(f"""
                                    SELECT COALESCE(normalized_address, address, '') as address
                                    FROM {addr_table} WHERE id = ?
                                """, (matched_college_id,))
                                addr_row = addr_cursor.fetchone()
                                addr_conn.close()
                                
                                # Use actual master address (not LLM's invented city)
                                master_address = addr_row[0] if addr_row else ''  # Empty if not found
                            except Exception as e:
                                logger.debug(f"Failed to fetch master address: {e}")
                                master_address = ''  # Empty fallback (validation will be lenient)
                            
                            # Combine college name + address (city may be in either)
                            seat_combined = f"{college_name or ''} {original_address or ''}".strip().upper()
                            original_words = {w.upper() for w in seat_combined.replace(',', ' ').split() if len(w) > 2}
                            address_text = original_address.strip() if original_address else ''  # For display only
                            master_addr_upper = master_address.upper().strip() if master_address else ''
                            
                            # COLLEGE CODE & PINCODE EXTRACTION
                            import re
                            
                            # College codes are 6-digit numbers INSIDE brackets (strongest identifier)
                            seat_college_codes = set(re.findall(r'\((\d{6})\)', original_address))
                            master_college_codes = set(re.findall(r'\((\d{6})\)', master_address))
                            
                            # Pincodes are 6-digit numbers OUTSIDE brackets (starting with 1-9)
                            # First remove bracketed numbers, then find pincodes
                            seat_addr_no_brackets = re.sub(r'\([^)]*\)', '', original_address)
                            master_addr_no_brackets = re.sub(r'\([^)]*\)', '', master_address)
                            seat_pincodes = set(re.findall(r'\b[1-9][0-9]{5}\b', seat_addr_no_brackets))
                            master_pincodes = set(re.findall(r'\b[1-9][0-9]{5}\b', master_addr_no_brackets))
                            
                            # College code match is STRONGEST (unique identifier)
                            college_code_match = bool(seat_college_codes & master_college_codes) if seat_college_codes and master_college_codes else None
                            college_code_mismatch = (seat_college_codes and master_college_codes and not (seat_college_codes & master_college_codes))
                            
                            # Pincode match is secondary
                            pincode_match = bool(seat_pincodes & master_pincodes) if seat_pincodes and master_pincodes else None
                            pincode_mismatch = (seat_pincodes and master_pincodes and not (seat_pincodes & master_pincodes))
                            
                            # Direct substring check
                            city_found = master_addr_upper in address_text.upper() or address_text.upper() in master_addr_upper
                            
                            # Word overlap check
                            master_addr_words = {w.upper() for w in master_address.replace(',', ' ').split() if len(w) > 2}
                            word_overlap = original_words & master_addr_words
                            
                            # FUZZY MATCHING for spelling variations
                            # Handles: MUZAFFARPUR vs MUZZAFARPUR, THIRUVANANTHAP URAM vs THIRUVANANTHAPURAM
                            fuzzy_match = False
                            if not city_found and not word_overlap:
                                try:
                                    from rapidfuzz import fuzz
                                    # Remove spaces and compare (handles "THIRUVANANTHAP URAM" vs "THIRUVANANTHAPURAM")
                                    address_no_space = address_text.upper().replace(' ', '').replace(',', '')
                                    city_no_space = master_addr_upper.replace(' ', '').replace(',', '')
                                    
                                    # Check if city (without spaces) is in address (without spaces)
                                    if city_no_space in address_no_space:
                                        fuzzy_match = True
                                    else:
                                        # Check each address word for fuzzy match with city
                                        for word in original_words:
                                            if len(word) >= 5:  # Only check substantial words
                                                similarity = fuzz.ratio(word, master_addr_upper)
                                                if similarity >= 85:  # 85% similar
                                                    fuzzy_match = True
                                                    break
                                except Exception:
                                    pass
                            
                            # VALIDATION HIERARCHY (strongest to weakest):
                            # 1. College code match → ALLOW (unique identifier)
                            # 2. College code mismatch → REJECT (strong negative)
                            # 3. Pincode match → ALLOW (good signal)
                            # 4. Pincode mismatch + multi-campus → REJECT
                            # 5. City/word match → ALLOW
                            # 6. No match + multi-campus → REJECT
                            # 7. No match + single-campus → WARN but ALLOW
                            
                            if college_code_match:
                                # College codes match! This is the STRONGEST positive signal
                                console.print(
                                    f"[green]✅ COLLEGE CODE MATCH: {record_id} - "
                                    f"Code {seat_college_codes & master_college_codes} matched[/green]"
                                )
                            elif college_code_mismatch:
                                # College codes don't match - this is a strong negative signal
                                logger.warning(
                                    f"COLLEGE CODE MISMATCH REJECTED: {record_id} - "
                                    f"Seat codes: {seat_college_codes} != Master codes: {master_college_codes}"
                                )
                                console.print(
                                    f"[red]❌ CODE REJECTED: {record_id} - "
                                    f"{seat_college_codes} ≠ {master_college_codes}[/red]"
                                )
                                matched_college_id = None
                                reason = f"College code mismatch: {seat_college_codes} != {master_college_codes}"
                            elif pincode_match:
                                # Pincodes match - good secondary signal
                                console.print(
                                    f"[green]✅ PINCODE MATCH: {record_id} - "
                                    f"Pincode {seat_pincodes & master_pincodes} matched[/green]"
                                )
                            elif pincode_mismatch and is_multi_campus:
                                # Pincodes mismatch + multi-campus → reject
                                logger.warning(
                                    f"PINCODE MISMATCH REJECTED: {record_id} - "
                                    f"Seat pincodes: {seat_pincodes} != Master pincodes: {master_pincodes}"
                                )
                                console.print(
                                    f"[red]❌ PINCODE REJECTED (multi-campus): {record_id} - "
                                    f"{seat_pincodes} ≠ {master_pincodes}[/red]"
                                )
                                matched_college_id = None
                                reason = f"Multi-campus pincode mismatch: {seat_pincodes} != {master_pincodes}"
                            elif not city_found and not word_overlap and not fuzzy_match:
                                if is_multi_campus:
                                    # Multi-campus MUST have city match (if no code/pincode info)
                                    logger.warning(
                                        f"MULTI-CAMPUS CITY MISMATCH: {record_id} - "
                                        f"Seat address: {address_text[:50]} != Master address: {master_address[:50]}"
                                    )
                                    console.print(
                                        f"[red]❌ CITY REJECTED (multi-campus): {record_id} - "
                                        f"'{address_text[:30]}' ≠ '{master_address[:30]}'[/red]"
                                    )
                                    matched_college_id = None
                                    reason = f"Multi-campus address mismatch: {original_address[:30]} != {master_address[:30]}"
                                else:
                                    # Single-campus: validation failed (no code, no pincode, no city/word/fuzzy match)
                                    # STRICTER: REJECT instead of WARN to prevent false matches (e.g. Jaipur vs Bedwas)
                                    logger.warning(
                                        f"CITY MISMATCH REJECTED (strict): {record_id} - "
                                        f"Seat address: {address_text[:50]} != Master address: {master_address[:50]}"
                                    )
                                    console.print(
                                        f"[red]❌ CITY REJECTED (strict): {record_id} - "
                                        f"'{address_text[:30]}' ≠ '{master_address[:30]}'[/red]"
                                    )
                                    matched_college_id = None
                                    reason = f"Address validation failed: {original_address[:30]} != {master_address[:30]}"                    
                    decisions.append(MatchDecision(
                        record_id=record_id,
                        matched_college_id=matched_college_id,
                        confidence=confidence,
                        reason=reason,
                        model=model,
                    ))
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            logger.debug(f"Raw content: {content[:500]}")
        
        return decisions
    
    def _single_record_match(
        self, 
        record: Dict, 
        candidates: List[tuple], 
        model: str,
        client_idx: int = 0,
    ) -> Optional[MatchDecision]:
        """
        Query a single model for one record match.
        
        Args:
            record: The unmatched record
            candidates: List of (id, name, state, address) tuples
            model: Model to use
            client_idx: Which client to use
            
        Returns:
            MatchDecision or None if failed
        """
        if not candidates:
            return None
        
        record_id = record.get('record_id') or record.get('id') or str(hash(str(record)))
        
        # Format candidates
        candidates_str = "\n".join(
            f"{c[0]}|{c[1]}|{c[2]}|{c[3]}" for c in candidates
        )
        
        prompt = f"""Match this record to ONE candidate (or null if no match):

RECORD:
  Name: {record.get('normalized_college_name') or record.get('college_name', '')}
  State: {record.get('normalized_state') or record.get('state', '')}
  Address: {record.get('normalized_address') or record.get('address', '')}
  Course Type: {record.get('course_type') or record.get('type', '')}

CANDIDATES (ID|Name|State|Address):
{candidates_str}

Return JSON: {{"matched_college_id": "..." or null, "confidence": 0.0-1.0, "reason": "..."}}"""
        
        try:
            client = self.clients[client_idx % len(self.clients)]
            response = client.complete(
                messages=[
                    {"role": "system", "content": "Match to the best candidate or return null. Be conservative."},
                    {"role": "user", "content": prompt},
                ],
                model=model,
                temperature=0.1,
                max_tokens=500,
            )
            
            # Parse response
            content = response.content
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                if data.get('matched_college_id'):
                    return MatchDecision(
                        record_id=record_id,
                        matched_college_id=data['matched_college_id'],
                        confidence=data.get('confidence', 0.8),
                        reason=data.get('reason', 'Ensemble vote'),
                        model=model,
                    )
        except Exception as e:
            logger.debug(f"Single record match failed ({model}): {e}")
        
        return None
    
    def _ensemble_match(
        self,
        record: Dict,
        candidates: List[tuple],
        num_models: int = 3,
    ) -> Optional[MatchDecision]:
        """
        Multi-model ensemble for hard matches.
        
        Queries multiple models and uses majority voting to determine the match.
        Use this for records where initial confidence is 60-80% (uncertain).
        
        Args:
            record: The unmatched record
            candidates: List of (id, name, state, address) tuples
            num_models: Number of models to query (default 3)
            
        Returns:
            MatchDecision if consensus reached, None otherwise
        """
        from collections import Counter
        
        # Get top models by performance
        perf_tracker = get_performance_tracker()
        ranked_models = perf_tracker.get_ranked_models(WORKER_MODELS)
        models_to_use = ranked_models[:num_models]
        
        if len(models_to_use) < 2:
            return None
        
        votes = []
        decisions = {}
        
        for i, model in enumerate(models_to_use):
            result = self._single_record_match(record, candidates, model, client_idx=i)
            if result and result.matched_college_id:
                votes.append(result.matched_college_id)
                decisions[result.matched_college_id] = result
        
        if not votes:
            return None
        
        # Majority voting
        vote_counts = Counter(votes)
        winner, count = vote_counts.most_common(1)[0]
        
        # Require at least 2/3 or 2/2 agreement
        min_votes = 2 if len(models_to_use) >= 2 else 1
        
        if count >= min_votes:
            result = decisions[winner]
            result.reason = f"Ensemble consensus ({count}/{len(votes)} models agree): {result.reason}"
            result.confidence = min(0.95, result.confidence + 0.1)  # Boost confidence for consensus
            return result
        
        return None  # No consensus
    
    def _stream_batch_response(
        self,
        batch: List[Dict],
        model: str,
        candidates_per_record: Dict[str, List[tuple]],
        client_idx: int = 0,
    ):
        """
        Stream LLM response and yield match decisions as they complete.
        
        Uses streaming API to parse JSON records progressively, allowing
        real-time progress updates before the full response completes.
        
        Args:
            batch: List of unmatched records
            model: Model to use
            candidates_per_record: Dict mapping record_id -> candidates
            client_idx: Which client to use
            
        Yields:
            MatchDecision: Decisions as they are parsed from stream
        """
        import re
        
        if not self.clients:
            return
        
        client = self.clients[client_idx % len(self.clients)]
        
        # Build prompt
        prompt = self._build_prompt_per_record(batch, candidates_per_record)
        
        # Stream response
        partial_content = ""
        yielded_record_ids = set()
        
        try:
            for chunk in client.complete_stream(
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                model=model,
                temperature=0.1,
                max_tokens=8192,
            ):
                partial_content += chunk
                
                # Try to extract complete JSON objects as they stream
                # Look for complete record entries: {"record_id": "...", ...}
                pattern = r'\{\s*"record_id"\s*:\s*"([^"]+)"[^}]+\}'
                
                for match in re.finditer(pattern, partial_content):
                    record_json = match.group(0)
                    record_id = match.group(1)
                    
                    # Skip already yielded
                    if record_id in yielded_record_ids:
                        continue
                    
                    try:
                        data = json.loads(record_json)
                        
                        if data.get('matched_college_id'):
                            decision = MatchDecision(
                                record_id=str(data['record_id']),
                                matched_college_id=data['matched_college_id'],
                                confidence=data.get('confidence', 0.8),
                                reason=data.get('reason', 'Streamed match'),
                                model=model,
                            )
                            yielded_record_ids.add(record_id)
                            yield decision
                        else:
                            # No match - still yield for tracking
                            decision = MatchDecision(
                                record_id=str(data['record_id']),
                                matched_college_id=None,
                                confidence=0.0,
                                reason=data.get('reason', 'No match'),
                                model=model,
                            )
                            yielded_record_ids.add(record_id)
                            yield decision
                            
                    except json.JSONDecodeError:
                        continue  # Wait for more content
                        
        except Exception as e:
            logger.warning(f"Streaming failed, falling back to regular call: {e}")
            # Fall back to regular parsing
            return
    
    def stream_resolve_batch(
        self,
        batch: List[Dict],
        candidates_per_record: Dict[str, List[tuple]],
        model: str = None,
        on_decision=None,
    ) -> List[MatchDecision]:
        """
        Resolve a batch using streaming with real-time callbacks.
        
        Args:
            batch: Unmatched records
            candidates_per_record: Candidates per record
            model: Model to use
            on_decision: Callback(decision) called for each streamed decision
            
        Returns:
            List of all decisions
        """
        model = model or WORKER_MODELS[0] if WORKER_MODELS else None
        if not model:
            return []
        
        decisions = []
        
        for decision in self._stream_batch_response(batch, model, candidates_per_record):
            decisions.append(decision)
            
            if on_decision:
                on_decision(decision)
            
            # Log progress
            if decision.matched_college_id:
                logger.debug(f"[Stream] {decision.record_id} → {decision.matched_college_id}")
        
        return decisions
    
    def _hybrid_fallback_batch(self, batch: List[Dict]) -> List[MatchDecision]:
        """
        GRACEFUL DEGRADATION: Hybrid scoring fallback when all LLM models fail.
        
        Uses local rapidfuzz matching + state validation to produce matches
        without requiring any API calls.
        
        Thresholds:
        - name_score >= 90 AND state matches → Match
        - Otherwise → No match (better to miss than false match)
        """
        from rapidfuzz import fuzz
        
        decisions = []
        
        for record in batch:
            record_id = record.get('record_id') or record.get('id') or str(hash(str(record)))
            college_name = (record.get('college_name') or '').upper().strip()
            state = (record.get('state') or '').upper().strip()
            course_type = record.get('type') or record.get('course_type') or 'medical'
            address = record.get('address', '')
            
            # Get candidates using hybrid filter
            candidates = self._filter_candidates_hybrid(record, course_type=course_type, top_n=5)
            
            best_match = None
            best_score = 0
            
            for c in candidates:
                master_name = (c.get('normalized_name') or c.get('name') or '').upper()
                master_state = (c.get('state') or '').upper()
                
                # Must match state
                if master_state != state:
                    continue
                
                # Calculate name score using UNIQUE IDENTIFIERS (not token_set_ratio)
                # Token_set_ratio gives false 90%+ for names sharing "MEDICAL COLLEGE"
                # Extract unique parts of names (remove generic words)
                GENERIC_WORDS = {
                    'MEDICAL', 'DENTAL', 'COLLEGE', 'HOSPITAL', 'UNIVERSITY', 'INSTITUTE',
                    'AND', 'OF', 'THE', 'SCIENCES', 'SCIENCE', 'HEALTH', 'CENTRE', 'CENTER',
                    'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'TRUST', 'SOCIETY', 'GENERAL',
                    'DISTRICT', 'STATE', 'NATIONAL', 'REGIONAL', 'SUPER', 'SPECIALTY',
                    'MULTI', 'RESEARCH', 'TEACHING', 'POST', 'GRADUATE', 'POSTGRADUATE',
                }
                source_words = set(college_name.split()) - GENERIC_WORDS
                master_words_unique = set(master_name.split()) - GENERIC_WORDS
                
                # If both have unique words, compare them (stricter)
                if source_words and master_words_unique:
                    # Use fuzz.ratio on unique parts only (much stricter than token_set_ratio)
                    source_unique = ' '.join(sorted(source_words))
                    master_unique = ' '.join(sorted(master_words_unique))
                    name_score = fuzz.ratio(source_unique, master_unique)
                else:
                    # One or both are fully generic - use token_set_ratio but with lower confidence
                    name_score = fuzz.token_set_ratio(college_name, master_name) * 0.7  # Penalize generic matches
                
                # Address bonus (unchanged)
                addr_bonus = 0
                master_addr = (c.get('address') or '').upper()
                if address and master_addr:
                    addr_words = set(address.upper().split())
                    master_words = set(master_addr.split())
                    overlap = len(addr_words & master_words)
                    if overlap > 0:
                        addr_bonus = min(5, overlap)  # Up to 5 bonus points
                
                total_score = name_score + addr_bonus
                
                if total_score > best_score:
                    best_score = total_score
                    best_match = c
            
            # Only match if very confident (>=90) - now based on UNIQUE words, much stricter
            if best_match and best_score >= 90:
                decisions.append(MatchDecision(
                    record_id=record_id,
                    matched_college_id=best_match['id'],
                    confidence=best_score / 100.0,
                    reason=f"[HYBRID FALLBACK] Score: {best_score}",
                    model="hybrid_fallback",
                ))
            else:
                decisions.append(MatchDecision(
                    record_id=record_id,
                    matched_college_id=None,
                    confidence=0.0,
                    reason=f"[HYBRID FALLBACK] No match (best: {best_score})",
                    model="hybrid_fallback",
                ))
        
        return decisions
    
    def _apply_decisions(self, table: str, decisions: List[MatchDecision]):
        """Apply match decisions to the database."""
        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()
        
        updated_count = 0
        
        # Define column mapping based on table
        if table == 'group_matching_queue':
            id_col = 'group_id'
            match_col = 'matched_college_id'
            score_col = 'match_score'
            method_col = 'match_method'
        else:
            id_col = 'id'
            match_col = 'master_college_id'
            score_col = 'college_match_score'
            method_col = 'college_match_method'

        # Helper: Mark rejected records as processed to prevent re-fetching
        def mark_rejected_as_processed(record_ids: list, rejection_reason: str):
            nonlocal updated_count
            for rid in record_ids:
                rid = rid.strip()
                if rid and table == 'group_matching_queue':
                    cursor.execute(f"""
                        UPDATE {table}
                        SET is_processed = 1,
                            match_method = ?
                        WHERE {id_col} = ?
                    """, (rejection_reason, rid))
                    updated_count += cursor.rowcount

        # PRE-VALIDATION: Load master college addresses for validation
        master_conn = sqlite3.connect(self.master_db_path)
        master_conn.row_factory = sqlite3.Row
        master_cursor = master_conn.cursor()
        
        rejected_count = 0

        for decision in decisions:
            if decision.matched_college_id:
                college_id = decision.matched_college_id
                
                # Determine which master table to query
                if college_id.startswith('MED'):
                    master_table = 'medical_colleges'
                    expected_stream = 'medical'
                elif college_id.startswith('DEN'):
                    master_table = 'dental_colleges'
                    expected_stream = 'dental'
                else:
                    master_table = 'dnb_colleges'
                    expected_stream = 'dnb'
                
                # Get master college info - use normalized columns for fair comparison
                master_cursor.execute(f"""
                    SELECT name, 
                           COALESCE(normalized_address, address) as address, 
                           COALESCE(normalized_state, state) as state 
                    FROM {master_table} WHERE id = ?
                """, (college_id,))
                master_row = master_cursor.fetchone()
                master_address = master_row['address'] if master_row else ''
                master_state = master_row['state'] if master_row else ''
                
                # Get seat record info (from the first record_id)
                # IMPORTANT: Use normalized_address and normalized_state for fair comparison
                record_ids = decision.record_id.split(',') if decision.record_id else []
                seat_address = ''
                seat_state = ''
                seat_course_type = ''
                seat_college_name = ''
                
                if record_ids:
                    first_rid = record_ids[0].strip()
                    if first_rid and table == 'group_matching_queue':
                        # group_matching_queue uses normalized columns
                        cursor.execute(f"SELECT normalized_address, normalized_state, sample_course_type, normalized_college_name FROM {table} WHERE group_id = ?", (first_rid,))
                    elif first_rid:
                        # seat_data - use normalized columns for fair comparison
                        cursor.execute(f"SELECT COALESCE(normalized_address, address), COALESCE(normalized_state, state), course_type, COALESCE(normalized_college_name, college_name) FROM {table} WHERE id = ?", (first_rid,))
                    seat_row = cursor.fetchone()
                    if seat_row:
                        seat_address = seat_row[0] or ''
                        seat_state = seat_row[1] or ''
                        seat_course_type = seat_row[2] or ''
                        seat_college_name = seat_row[3] or '' if len(seat_row) > 3 else ''
                
                # ==========================================
                # VALIDATION 1: STREAM CHECK (Cross-Stream Block)
                # ==========================================
                # DNB courses should NOT match MED/DEN colleges
                if seat_course_type:
                    seat_stream = seat_course_type.lower()
                    if 'dnb' in seat_stream and expected_stream != 'dnb':
                        console.print(f"[red]❌ STREAM BLOCKED: {decision.record_id} → {college_id} (DNB course → {expected_stream.upper()} college)[/red]")
                        # AUDIT LOG
                        audit = get_audit_logger()
                        audit.log_match(
                            group_id=decision.record_id,
                            seat_college_name=seat_college_name,
                            seat_state=seat_state,
                            seat_address=seat_address,
                            matched_college_id=college_id,
                            master_college_name=master_row['name'] if master_row else '',
                            master_state=master_state,
                            master_address=master_address,
                            confidence=decision.confidence or 0,
                            name_similarity=0,
                            status='STREAM_BLOCKED',
                            reason=f"DNB course matched to {expected_stream.upper()} college",
                            model=decision.model or '',
                            record_count=len(record_ids),
                        )
                        mark_rejected_as_processed(record_ids, 'stream_blocked')
                        rejected_count += 1
                        continue
                    
                    # MEDICAL course should not match DNB college
                    # EXCEPT for overlapping diploma courses (from config.yaml)
                    if ('mbbs' in seat_stream or 'medical' in seat_stream) and expected_stream == 'dnb':
                        # Check if this is a diploma that CAN be at DNB hospitals
                        is_overlapping_diploma = False
                        if 'diploma' in seat_stream:
                            import yaml
                            try:
                                with open('config.yaml', 'r') as f:
                                    cfg = yaml.safe_load(f)
                                diploma_cfg = cfg.get('diploma_courses', {})
                                dnb_only = [d.upper().replace(' IN ', ' ') for d in diploma_cfg.get('dnb_only', [])]
                                overlapping = [d.upper().replace(' IN ', ' ') for d in diploma_cfg.get('overlapping', [])]
                                
                                ct_norm = seat_course_type.upper().replace(' IN ', ' ')
                                if any(k in ct_norm for k in dnb_only) or any(k in ct_norm for k in overlapping):
                                    is_overlapping_diploma = True
                            except:
                                pass
                        
                        if not is_overlapping_diploma:
                            console.print(f"[red]❌ STREAM BLOCKED: {decision.record_id} → {college_id} (MEDICAL course → DNB college)[/red]")
                            # AUDIT LOG
                            audit = get_audit_logger()
                            audit.log_match(
                                group_id=decision.record_id,
                                seat_college_name=seat_college_name,
                                seat_state=seat_state,
                                seat_address=seat_address,
                                matched_college_id=college_id,
                                master_college_name=master_row['name'] if master_row else '',
                                master_state=master_state,
                                master_address=master_address,
                                confidence=decision.confidence or 0,
                                name_similarity=0,
                                status='STREAM_BLOCKED',
                                reason=f"MEDICAL course matched to DNB college",
                                model=decision.model or '',
                                record_count=len(record_ids),
                            )
                            mark_rejected_as_processed(record_ids, 'stream_blocked')
                            rejected_count += 1
                            continue
                
                # ==========================================
                # VALIDATION 2: STATE CHECK (Cross-State Block)
                # ==========================================
                if seat_state and master_state:
                    # Both seat_state and master_state are already normalized (via COALESCE)
                    # Just compare directly - no alias mapping needed
                    seat_state_norm = seat_state.upper().strip()
                    master_state_norm = master_state.upper().strip()
                    
                    if seat_state_norm != master_state_norm:
                        console.print(f"[red]❌ STATE BLOCKED: {decision.record_id} → {college_id} ({seat_state} → {master_state})[/red]")
                        # AUDIT LOG
                        audit = get_audit_logger()
                        audit.log_match(
                            group_id=decision.record_id,
                            seat_college_name=seat_college_name,
                            seat_state=seat_state,
                            seat_address=seat_address,
                            matched_college_id=college_id,
                            master_college_name=master_row['name'] if master_row else '',
                            master_state=master_state,
                            master_address=master_address,
                            confidence=decision.confidence or 0,
                            name_similarity=0,
                            status='STATE_BLOCKED',
                            reason=f"Cross-state mismatch: {seat_state} → {master_state}",
                            model=decision.model or '',
                            record_count=len(record_ids),
                        )
                        mark_rejected_as_processed(record_ids, 'state_blocked')
                        rejected_count += 1
                        continue
                
                # ==========================================
                # VALIDATION 3: ADDRESS MISMATCH CHECK (MULTI-CAMPUS)
                # ==========================================
                # RE-ENABLED for multi-campus colleges where address is the ONLY differentiator
                # Example: AUTONOMOUS STATE MEDICAL COLLEGE exists in 15+ districts
                # AKBARPUR (MED0734) vs GHAZIPUR (MED0744) are DIFFERENT colleges!
                
                if seat_address and master_address:
                    # Check if this is a multi-campus college (same name in same state)
                    try:
                        master_cursor.execute(f"""
                            SELECT COALESCE(normalized_name, name) as norm_name 
                            FROM {master_table} WHERE id = ?
                        """, (college_id,))
                        name_row = master_cursor.fetchone()
                        if name_row:
                            master_name = name_row['norm_name']
                            # Count colleges with same name in same state
                            master_cursor.execute(f"""
                                SELECT COUNT(*) FROM {master_table} 
                                WHERE COALESCE(normalized_name, name) = ?
                                AND UPPER(TRIM(COALESCE(normalized_state, state))) = ?
                            """, (master_name, master_state.upper().strip()))
                            same_name_count = master_cursor.fetchone()[0]
                            
                            if same_name_count > 1:
                                # MULTI-CAMPUS: Address MUST match!
                                # Extract district/city from both addresses
                                import re
                                # FIXED: Normalize addresses before comparison
                                # - Remove @ symbols (email-based identifiers: CHHSP1234@GMAIL → CHHSP1234GMAIL)
                                # - Use alphanumeric regex to match codes like CHHSP1234
                                seat_addr_norm = re.sub(r'[@.]', '', seat_address.upper())  # Remove @ and .
                                master_addr_norm = re.sub(r'[@.]', '', master_address.upper())
                                
                                # Extract alphanumeric words (4+ chars) - includes codes like CHHSP1234
                                seat_words = set(re.findall(r'\b([A-Z0-9]{4,})\b', seat_addr_norm))
                                master_words = set(re.findall(r'\b([A-Z0-9]{4,})\b', master_addr_norm))
                                
                                # Remove common stopwords
                                stopwords = {'HOSPITAL', 'COLLEGE', 'MEDICAL', 'DENTAL', 'INSTITUTE', 
                                           'GOVT', 'GOVERNMENT', 'STATE', 'AUTONOMOUS', 'SOCIETY',
                                           'DISTRICT', 'TALUK', 'POST', 'OFFICE', 'ROAD', 'STREET'}
                                seat_words -= stopwords
                                master_words -= stopwords
                                
                                overlap = seat_words & master_words
                                
                                # FUZZY MATCHING: Handle OCR issues like "ANANTA PURAM" vs "ANANTHAPURAM"
                                fuzzy_match = False
                                if len(overlap) == 0:
                                    # Method 1: Check without spaces (handles "ANANTA PURAM" → "ANANTHAPURAM")
                                    seat_no_space = re.sub(r'[^A-Z0-9]', '', seat_addr_norm)
                                    master_no_space = re.sub(r'[^A-Z0-9]', '', master_addr_norm)
                                    
                                    # Check if master location is in seat (without spaces)
                                    # e.g., "NANDYAL" in "PRINCIPALGMCNANDYALAGMAILCOM518501"
                                    for mw in master_words:
                                        if len(mw) >= 5 and mw in seat_no_space:
                                            fuzzy_match = True
                                            break
                                    
                                    # Method 2: Check fuzzy similarity of each word pair
                                    if not fuzzy_match:
                                        from rapidfuzz import fuzz
                                        for sw in seat_words:
                                            for mw in master_words:
                                                if len(sw) >= 5 and len(mw) >= 5:
                                                    # Check if 80% similar
                                                    if fuzz.ratio(sw, mw) >= 80:
                                                        fuzzy_match = True
                                                        break
                                            if fuzzy_match:
                                                break
                                    
                                    # Method 3: Check pincode match (6-digit codes)
                                    if not fuzzy_match:
                                        seat_pincodes = set(re.findall(r'\b[1-9][0-9]{5}\b', seat_address))
                                        master_pincodes = set(re.findall(r'\b[1-9][0-9]{5}\b', master_address))
                                        if seat_pincodes and master_pincodes and (seat_pincodes & master_pincodes):
                                            fuzzy_match = True
                                
                                if seat_words and master_words and len(overlap) == 0 and not fuzzy_match:
                                    # NO overlap between addresses - this is a FALSE MATCH!
                                    console.print(f"[red]❌ MULTI-CAMPUS ADDRESS BLOCKED: {decision.record_id} → {college_id}[/red]")
                                    console.print(f"   [red]Seat: {seat_address[:40]}... vs Master: {master_address[:40]}...[/red]")
                                    console.print(f"   [red]College '{master_name}' has {same_name_count} campuses - address must match![/red]")
                                    # AUDIT LOG
                                    audit = get_audit_logger()
                                    audit.log_match(
                                        group_id=decision.record_id,
                                        seat_college_name=seat_college_name,
                                        seat_state=seat_state,
                                        seat_address=seat_address,
                                        matched_college_id=college_id,
                                        master_college_name=master_name,
                                        master_state=master_state,
                                        master_address=master_address,
                                        confidence=decision.confidence or 0,
                                        name_similarity=0,
                                        status='MULTI_CAMPUS_BLOCKED',
                                        reason=f"Multi-campus college '{master_name}' has {same_name_count} campuses - addresses don't match",
                                        model=decision.model or '',
                                        record_count=len(record_ids),
                                    )
                                    mark_rejected_as_processed(record_ids, 'multi_campus_blocked')
                                    rejected_count += 1
                                    continue
                    except Exception as e:
                        logger.debug(f"Multi-campus address check failed: {e}")
                
                # ==========================================
                # VALIDATION 4: ENSEMBLE VOTE (Post-LLM Check)
                # ==========================================
                # Use ensemble voting to catch false matches LLM might have made
                try:
                    from ensemble_validator import get_ensemble_validator
                    ensemble_validator = get_ensemble_validator()
                    
                    master_name = master_row['name'] if master_row else ''
                    
                    result = ensemble_validator.postvalidate_match(
                        input_name=seat_college_name,
                        input_address=seat_address,
                        master_id=college_id,
                        master_name=master_name,
                        master_address=master_address
                    )
                    
                    if not result.is_valid:
                        console.print(f"[red]❌ ENSEMBLE BLOCKED: {decision.record_id} → {college_id}[/red]")
                        console.print(f"   [red]{result.reasons[0]}[/red]")
                        # AUDIT LOG
                        audit = get_audit_logger()
                        audit.log_match(
                            group_id=decision.record_id,
                            seat_college_name=seat_college_name,
                            seat_state=seat_state,
                            seat_address=seat_address,
                            matched_college_id=college_id,
                            master_college_name=master_name,
                            master_state=master_state,
                            master_address=master_address,
                            confidence=decision.confidence or 0,
                            name_similarity=result.scores.weighted_total,
                            status='ENSEMBLE_BLOCKED',
                            reason='; '.join(result.reasons),
                            model=decision.model or '',
                            record_count=len(record_ids),
                        )
                        mark_rejected_as_processed(record_ids, 'ensemble_blocked')
                        rejected_count += 1
                        continue
                except ImportError:
                    pass  # Ensemble validator not available, skip check
                except Exception as e:
                    logger.debug(f"Ensemble validation failed: {e}")
                
                # Apply decision to all record IDs
                for rid in record_ids:
                    rid = rid.strip()
                    if rid:
                        # Include model in UPDATE for tracking
                        if table == 'group_matching_queue':
                            # CRITICAL: Set is_processed = 1 so auto-retry loop fetches next batch
                            cursor.execute(f"""
                                UPDATE {table}
                                SET {match_col} = ?,
                                    {score_col} = ?,
                                    {method_col} = 'agentic_llm',
                                    match_model = ?,
                                    is_processed = 1
                                WHERE {id_col} = ?
                            """, (
                                decision.matched_college_id,
                                decision.confidence,
                                decision.model,
                                rid,
                            ))
                        else:
                            # Other tables may not have match_model column
                            cursor.execute(f"""
                                UPDATE {table}
                                SET {match_col} = ?,
                                    {score_col} = ?,
                                    {method_col} = ?
                                WHERE {id_col} = ?
                            """, (
                                decision.matched_college_id,
                                decision.confidence,
                                f'agentic_llm:{decision.model}' if decision.model else 'agentic_llm',
                                rid,
                            ))
                        updated_count += cursor.rowcount
            else:
                # FIX: Mark records with NULL match as processed too!
                # This prevents them from being re-counted as "remaining unprocessed"
                record_ids = decision.record_id.split(',') if decision.record_id else []
                for rid in record_ids:
                    rid = rid.strip()
                    if rid and table == 'group_matching_queue':
                        cursor.execute(f"""
                            UPDATE {table}
                            SET is_processed = 1,
                                match_method = 'no_match_by_agentic'
                            WHERE {id_col} = ?
                        """, (rid,))
                        updated_count += cursor.rowcount
        
        master_conn.close()
        conn.commit()
        conn.close()
        console.print(f"[dim]📝 Updated {updated_count} individual records ({rejected_count} blocked by pre-validation)[/dim]")
    
    def _flag_unmatchable(self, table: str, unmatched_records: List[Dict]):
        """Flag records that couldn't be matched after all rounds.
        
        Marks them with match_method = 'unmatchable_by_agentic' so they can be:
        1. Identified for manual review
        2. Skipped in future runs
        3. Exported for investigation
        """
        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()
        
        # Define column mapping based on table
        if table == 'group_matching_queue':
            id_col = 'group_id'
            method_col = 'match_method'
            # Also set is_processed = 1 so they don't get re-fetched
            extra_set = ', is_processed = 1'
        else:
            id_col = 'id'
            method_col = 'college_match_method'
            extra_set = ''
        
        flagged_count = 0
        for record in unmatched_records:
            record_id = str(record.get('record_id', ''))  # Convert to string to handle int IDs
            # record_id may be comma-separated (for grouped records)
            if ',' in record_id:
                # For grouped records, flag all individual IDs
                for rid in record_id.split(','):
                    rid = rid.strip()
                    if rid:
                        cursor.execute(f"""
                            UPDATE {table}
                            SET {method_col} = 'unmatchable_by_agentic'{extra_set}
                            WHERE {id_col} = ?
                            AND (matched_college_id IS NULL OR matched_college_id = '')
                        """, (rid,))
                        flagged_count += cursor.rowcount
            else:
                cursor.execute(f"""
                    UPDATE {table}
                    SET {method_col} = 'unmatchable_by_agentic'{extra_set}
                    WHERE {id_col} = ?
                    AND (matched_college_id IS NULL OR matched_college_id = '')
                """, (record_id,))
                flagged_count += cursor.rowcount
        
        conn.commit()
        conn.close()
        logger.info(f"Flagged {flagged_count} records as unmatchable")
    
    def _print_summary(
        self,
        decisions: List[MatchDecision],
        matched: int,
        unresolved: int,
    ):
        """Print summary table of decisions."""
        table = Table(title="🤖 Agentic Matcher Results")
        table.add_column("Record ID", style="cyan")
        table.add_column("Match ID", style="green")
        table.add_column("Confidence", justify="right")
        table.add_column("Reason", style="dim")
        
        # Show first 10 decisions
        for decision in decisions[:10]:
            match_id = decision.matched_college_id or "[red]None[/red]"
            conf = f"{decision.confidence:.2f}" if decision.matched_college_id else "-"
            table.add_row(
                decision.record_id[:20],
                match_id,
                conf,
                decision.reason[:40],
            )
        
        if len(decisions) > 10:
            table.add_row("...", f"({len(decisions)-10} more)", "", "")
        
        console.print(table)
        
        # Final stats
        console.print(Panel.fit(
            f"[bold]Matched:[/bold] [green]{matched}[/green]\n"
            f"[bold]Unresolved:[/bold] [yellow]{unresolved}[/yellow]\n"
            f"[bold]API Calls:[/bold] [cyan]1[/cyan]",
            title="📊 Summary",
            border_style="blue"
        ))


def run_agentic_matching(
    table: str = 'seat_data',
    db_path: str = 'data/sqlite/seat_data.db',
    dry_run: bool = False,
) -> Tuple[int, int]:
    """
    Convenience function to run agentic matching.
    
    Returns:
        Tuple of (matched_count, unresolved_count)
    """
    matcher = AgenticMatcher(seat_db_path=db_path)
    matched, unresolved, _ = matcher.resolve_unmatched(table=table, dry_run=dry_run)
    return matched, unresolved


if __name__ == "__main__":
    # Test run
    import sys
    
    dry_run = "--dry-run" in sys.argv
    
    matched, unresolved = run_agentic_matching(dry_run=dry_run)
    print(f"\nFinal: {matched} matched, {unresolved} unresolved")
