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
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from openrouter_client import OpenRouterClient, OpenRouterResponse

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

MANDATORY REASON FORMAT:
- For matches: "Name and state matched. Best candidate from list."
- For non-matches: "No suitable candidate in list" or "Name mismatch"

IMPORTANT:
- If address/city doesn't match, set matched_college_id to null
- Always include ALL records in your response
- Prefer precision over recall (better to miss a match than create a false match)
- SAME-NAME colleges are DIFFERENT if in DIFFERENT locations!"""

    def __init__(
        self,
        seat_db_path: str = 'data/sqlite/seat_data.db',
        master_db_path: str = 'data/sqlite/master_data.db',
        api_keys: Optional[List[str]] = None,
        api_key: Optional[str] = None,  # Legacy single key support
        timeout: float = 300.0,
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
                    "college_name": row["normalized_college_name"],
                    "state": row["normalized_state"],
                    "address": row["normalized_address"] or "",
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
        college_name = (unmatched_record.get('normalized_college_name') or unmatched_record.get('college_name') or '').upper().strip()
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
        
        # Map course type to table
        table_map = {
            'medical': 'medical_colleges',
            'dental': 'dental_colleges',
            'dnb': 'dnb_colleges',
        }
        table = table_map.get(course_type, 'medical_colleges')
        
        # Extract record fields
        college_name = (unmatched_record.get('normalized_college_name') or 
                       unmatched_record.get('college_name') or '').upper().strip()
        state = (unmatched_record.get('normalized_state') or 
                unmatched_record.get('state') or '').upper().strip()
        address = (unmatched_record.get('normalized_address') or 
                  unmatched_record.get('address') or '').upper().strip()
        
        if not college_name:
            return []
        
        # Normalize address - handle NAN/None/empty
        if address in ('', 'NAN', 'NONE', 'NULL', 'NA', 'N/A', '-'):
            address = ''
        
        try:
            conn = sqlite3.connect(self.master_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # STEP 1: SQL filter by state
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
            
            all_candidates = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            if not all_candidates:
                logger.debug(f"Hybrid: No candidates in {table} for state '{state}'")
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
        
        # Step 2: Get unique course types and STATES for targeted master data
        course_types = list(set(r.get('type') for r in all_unmatched if r.get('type')))
        # Extract unique states from unmatched records - prevents cross-state matches!
        states = list(set(r.get('state') for r in all_unmatched if r.get('state')))
        
        # Build lookup for state validation in response parsing
        unmatched_lookup = {r.get('record_id'): r for r in all_unmatched}
        
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
            
            # Create batches from each state+course_type group
            batches = []
            for (state, course_type), records in state_course_groups.items():
                for i in range(0, len(records), batch_size):
                    batches.append(records[i:i + batch_size])
            
            total_batches = len(batches)
            console.print(f"[cyan]📦 Split into {total_batches} batches of ~{batch_size} records (state+course_type grouped)[/cyan]")
            
            round_decisions = []
            round_matched = 0
            
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
                        candidates = self._filter_candidates_hybrid(record, course_type=record_course_type, top_n=10)
                        
                        if candidates:
                            fts_success_count += 1
                            per_record_candidates[record_id] = [
                                (c['id'], c['name'][:60], c.get('normalized_state', c.get('state', '')), 
                                 c.get('normalized_address', c.get('address', ''))[:80] if c.get('normalized_address') or c.get('address') else '')
                                for c in candidates
                            ]
                        else:
                            # FALLBACK: Use rapidfuzz Unique Identifier method
                            fallback_count += 1
                            record_master_colleges = self.get_master_colleges_list([record_course_type], states=batch_states)
                            fallback_candidates = self._prefilter_candidates(record, record_master_colleges, top_n=10, min_similarity=70.0)
                            per_record_candidates[record_id] = [
                                (c['id'], c['name'][:60], c['state'], c['address'][:80] if c.get('address') else '')
                                for c in fallback_candidates
                            ]
                    
                    # Build prompt with PER-RECORD candidates
                    if per_record_candidates:
                        logger.debug(f"Batch {batch_idx}: {sum(len(v) for v in per_record_candidates.values())} total candidates (FTS: {fts_success_count}, Fallback: {fallback_count})")
                        user_prompt = self._build_prompt_per_record(batch, per_record_candidates)
                    else:
                        # Last resort fallback to full list (legacy behavior)
                        batch_master_summary = self.get_master_summary(batch_course_types, states=batch_states)
                        user_prompt = self._build_prompt(batch, batch_master_summary)
                    
                    model_config = MODEL_CONFIG.get(model, {})
                    model_max_tokens = model_config.get("max_tokens", 8192)
                    model_timeout = model_config.get("timeout", None)
                    
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
                        decisions = self._parse_response(response.content, unmatched_lookup, model=model)
                        return batch_idx, decisions, len(batch), {"model": model, "success": True}
                    except Exception as e:
                        error_code = "429" if "429" in str(e) else ("503" if "503" in str(e) else "error")
                        return batch_idx, batch, len(batch), {"model": model, "error": error_code, "success": False}
                
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
                    
                    while futures:
                        # Wait for any batch to complete
                        done_futures = []
                        for future in as_completed(futures):
                            batch_idx, result, batch_len, info = future.result()
                            
                            if info.get("success"):
                                # Success! Record result
                                completed_results[batch_idx] = (result, info)
                                model_name = info["model"].split("/")[-1].split(":")[0]
                                batch_matched = sum(1 for d in result if d.matched_college_id)
                                console.print(f"   [green]✓ Batch {batch_idx+1}/{total_batches}: {batch_matched}/{batch_len} ({model_name})[/green]")
                            else:
                                # Failed - immediately re-submit with different model
                                batch = futures[future][1]
                                tried = models_tried[batch_idx]
                                
                                # Find untried models and pick RANDOMLY (not sequentially!)
                                untried_models = [m for m in WORKER_MODELS if m not in tried]
                                
                                if untried_models and len(tried) < max_attempts:
                                    # RANDOMIZE: Pick a random untried model instead of first in list
                                    import random
                                    next_model = random.choice(untried_models)
                                    
                                    # Re-submit with new model match_unmatched_records
                                    # Add delay to prevent rate limit hammering
                                    import time
                                    time.sleep(2.0)
                                    
                                    models_tried[batch_idx].add(next_model)
                                    new_future = executor.submit(
                                        process_single_batch, 
                                        batch_idx, 
                                        batch, 
                                        next_model, 
                                        len(tried)  # Use different client
                                    )
                                    futures[new_future] = (batch_idx, batch)
                                    console.print(f"   [yellow]↻ Batch {batch_idx+1} retry with {next_model.split('/')[-1].split(':')[0]}[/yellow]")
                                else:
                                    # Exhausted all models for this batch
                                    completed_results[batch_idx] = ([], {"error": "All models failed"})
                                    console.print(f"   [red]✗ Batch {batch_idx+1}: All models failed[/red]")
                            
                            done_futures.append(future)
                        
                        # Remove completed futures
                        for f in done_futures:
                            del futures[f]
                
                # Aggregate results
                for batch_idx in range(len(batches)):
                    result, info = completed_results.get(batch_idx, ([], {}))
                    if isinstance(result, list) and result and hasattr(result[0], 'matched_college_id'):
                        round_decisions.extend(result)
                        round_matched += sum(1 for d in result if d.matched_college_id)
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
                        per_record_candidates[record_id] = [
                            (c['id'], c['name'][:60], c.get('normalized_state', c.get('state', '')), 
                             c.get('normalized_address', c.get('address', ''))[:80] if c.get('normalized_address') or c.get('address') else '')
                            for c in candidates
                        ]
                    
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
        
        # Summary
        unresolved = len(all_unmatched) - total_matched
        self._print_summary(all_decisions, total_matched, unresolved)
        
        return total_matched, unresolved, all_decisions
    
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
        
        Args:
            unmatched: List of unmatched records
            per_record_candidates: Dict mapping record_id -> List of (id, name, state, address) tuples
        """
        records_with_candidates = []
        
        for record in unmatched:
            record_id = record.get('record_id') or record.get('id') or record.get('group_id') or str(hash(str(record)))
            candidates = per_record_candidates.get(str(record_id), [])
            
            # Format candidates for this record
            candidates_str = "\n    ".join(
                f"{c[0]}|{c[1]}|{c[2]}|{c[3]}" for c in candidates
            ) if candidates else "(No candidates found - mark as unmatched)"
            
            record_entry = {
                "record_id": record_id,
                "college_name": record.get('normalized_college_name') or record.get('college_name', ''),
                "state": record.get('normalized_state') or record.get('state', ''),
                "address": record.get('normalized_address') or record.get('address', ''),
                "course_type": record.get('sample_course_type') or record.get('course_type') or record.get('type', ''),
            }
            
            records_with_candidates.append(
                f"""RECORD: {record_id}
  College Name: {record_entry['college_name']}
  State: {record_entry['state']}
  Address: {record_entry['address']}
  Course Type: {record_entry['course_type']}
  
  CANDIDATES FOR THIS RECORD (ID|Name|State|Address):
    {candidates_str}
"""
            )
        
        return f"""MATCH EACH RECORD TO ITS CANDIDATES ONLY.

CRITICAL: Each record has its OWN candidate list. DO NOT use candidates from other records!
If a record's candidate list is empty or shows "(No candidates found)", set matched_college_id to null.

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
        
        # State comparison - data is already normalized, just uppercase for comparison
        def normalize_state(s):
            if not s:
                return ''
            return s.upper().strip()
        
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
                        original_state = original_record.get('state', '')
                        
                        if matched_state and original_state:
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
                    
                    # NAME VALIDATION: Compare original college name with matched college name
                    # Catches LLM hallucinations where completely different colleges are matched
                    if matched_college_id and unmatched_lookup and record_id in unmatched_lookup:
                        original_record = unmatched_lookup[record_id]
                        original_college_name = original_record.get('college_name', '')
                        
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
                                        matched_college_id = None
                                        reason = f"Name mismatch: '{original_college_name[:30]}' != '{matched_college_name[:30]}' ({name_similarity:.1f}%)"
                                    elif name_similarity < 80:
                                        # Warn for 65-80% similarity (borderline)
                                        console.print(
                                            f"[yellow]⚠️ NAME WARN: {record_id} - "
                                            f"'{original_college_name[:30]}' ~ '{matched_college_name[:30]}' "
                                            f"({name_similarity:.1f}%)[/yellow]"
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
                                        matched_college_id = None
                                        reason = f"NULL address + low name match ({null_name_sim:.0f}% < 90%)"
                                    else:
                                        # Both conditions passed
                                        console.print(
                                            f"[green]✅ NULL ADDR OK: {record_id} - "
                                            f"Single-campus + {null_name_sim:.0f}% name match[/green]"
                                        )
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
                
                if record_ids:
                    first_rid = record_ids[0].strip()
                    if first_rid and table == 'group_matching_queue':
                        # group_matching_queue uses normalized columns
                        cursor.execute(f"SELECT normalized_address, normalized_state, sample_course_type FROM {table} WHERE group_id = ?", (first_rid,))
                    elif first_rid:
                        # seat_data - use normalized columns for fair comparison
                        cursor.execute(f"SELECT COALESCE(normalized_address, address), COALESCE(normalized_state, state), course_type FROM {table} WHERE id = ?", (first_rid,))
                    seat_row = cursor.fetchone()
                    if seat_row:
                        seat_address = seat_row[0] or ''
                        seat_state = seat_row[1] or ''
                        seat_course_type = seat_row[2] or ''
                
                # ==========================================
                # VALIDATION 1: STREAM CHECK (Cross-Stream Block)
                # ==========================================
                # DNB courses should NOT match MED/DEN colleges
                if seat_course_type:
                    seat_stream = seat_course_type.lower()
                    if 'dnb' in seat_stream and expected_stream != 'dnb':
                        console.print(f"[red]❌ STREAM BLOCKED: {decision.record_id} → {college_id} (DNB course → {expected_stream.upper()} college)[/red]")
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
                                
                                if seat_words and master_words and len(overlap) == 0:
                                    # NO overlap between addresses - this is a FALSE MATCH!
                                    console.print(f"[red]❌ MULTI-CAMPUS ADDRESS BLOCKED: {decision.record_id} → {college_id}[/red]")
                                    console.print(f"   [red]Seat: {seat_address[:40]}... vs Master: {master_address[:40]}...[/red]")
                                    console.print(f"   [red]College '{master_name}' has {same_name_count} campuses - address must match![/red]")
                                    rejected_count += 1
                                    continue
                    except Exception as e:
                        logger.debug(f"Multi-campus address check failed: {e}")
                
                # Apply decision to all record IDs
                for rid in record_ids:
                    rid = rid.strip()
                    if rid:
                        # Include model in UPDATE for tracking
                        if table == 'group_matching_queue':
                            cursor.execute(f"""
                                UPDATE {table}
                                SET {match_col} = ?,
                                    {score_col} = ?,
                                    {method_col} = 'agentic_llm',
                                    match_model = ?
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
        else:
            id_col = 'id'
            method_col = 'college_match_method'
        
        flagged_count = 0
        for record in unmatched_records:
            record_id = record.get('record_id', '')
            # record_id may be comma-separated (for grouped records)
            if ',' in record_id:
                # For grouped records, flag all individual IDs
                for rid in record_id.split(','):
                    rid = rid.strip()
                    if rid:
                        cursor.execute(f"""
                            UPDATE {table}
                            SET {method_col} = 'unmatchable_by_agentic'
                            WHERE {id_col} = ?
                        """, (rid,))
                        flagged_count += cursor.rowcount
            else:
                cursor.execute(f"""
                    UPDATE {table}
                    SET {method_col} = 'unmatchable_by_agentic'
                    WHERE {id_col} = ?
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
