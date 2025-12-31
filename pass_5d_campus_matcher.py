#!/usr/bin/env python3
"""
Pass 5D: Campus-Specific Fuzzy Matching

When unmatched records have campus indicators (BEMINA, SOURA, etc.),
strip those campus words and try matching on filtered address.
"""

import re
import sqlite3
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher
import logging

logger = logging.getLogger(__name__)

class CampusSpecificMatcher:
    """
    Matches unmatched records to master data by handling campus indicators.

    Key insight: Campus indicators (BEMINA, SOURA) pollute word overlap calculations.
    By filtering them out, we can match multi-campus college records successfully.
    """

    # Known campus/wing names in Indian medical colleges
    CAMPUS_INDICATORS = {
        # SKIMS - Srinagar
        'BEMINA', 'SOURA',

        # AIIMS - New Delhi
        'GOPAL DAS ROAD', 'ANSARI NAGAR',

        # Other major medical colleges
        'KALYANI', 'LODI ROAD', 'SAFDARJUNG', 'CHAMARAJANAGAR',
        'EAST', 'WEST', 'NORTH', 'SOUTH',

        # Zone indicators
        'LUCKNOW ZONE', 'KANPUR ZONE', 'ZONE',

        # Office/Admin locations
        'PRINCIPAL OFFICE', 'PRINCIPAL', 'HEADQUARTER', 'HEADQUARTERS',
        'MAIN CAMPUS', 'CAMPUS', 'WING', 'CENTER', 'CENTRE',

        # Building names (common in large institutions)
        'BUILDING', 'BLOCK', 'WARD', 'DEPARTMENT',

        # Direction/Area modifiers (less specific)
        'ROAD', 'STREET', 'LANE', 'AVENUE', 'PLAZA'
    }

    def __init__(self, master_db_path: str = None, seat_db_path: str = None):
        """
        Initialize campus matcher.

        Args:
            master_db_path: Path to master_data.db
            seat_db_path: Path to seat_data.db (for debugging)
        """
        self.master_db = master_db_path or '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'
        self.seat_db = seat_db_path or '/Users/kashyapanand/Public/New/data/sqlite/seat_data.db'

        # Cache for college lookups
        self._college_cache = {}
        self._load_master_colleges()

    def _load_master_colleges(self):
        """Load all master colleges into cache organized by college_type for stream filtering."""
        try:
            conn = sqlite3.connect(self.master_db)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Initialize college_type-specific caches
            self._college_cache = {
                'MEDICAL': {},
                'DENTAL': {},
                'DNB': {}
            }

            # Load medical colleges
            cursor.execute("SELECT id, name, address, state, normalized_address FROM medical_colleges")
            for row in cursor.fetchall():
                college_id = row['id']
                self._college_cache['MEDICAL'][college_id] = {
                    'id': college_id,
                    'name': row['name'],
                    'address': row['address'],
                    'state': row['state'],
                    'normalized_address': row['normalized_address'],
                    'college_type': 'MEDICAL'
                }

            # Load dental colleges
            cursor.execute("SELECT id, name, address, state, normalized_address FROM dental_colleges")
            for row in cursor.fetchall():
                college_id = row['id']
                self._college_cache['DENTAL'][college_id] = {
                    'id': college_id,
                    'name': row['name'],
                    'address': row['address'],
                    'state': row['state'],
                    'normalized_address': row['normalized_address'],
                    'college_type': 'DENTAL'
                }

            # Load DNB colleges
            cursor.execute("SELECT id, name, address, state, normalized_address FROM dnb_colleges")
            for row in cursor.fetchall():
                college_id = row['id']
                self._college_cache['DNB'][college_id] = {
                    'id': college_id,
                    'name': row['name'],
                    'address': row['address'],
                    'state': row['state'],
                    'normalized_address': row['normalized_address'],
                    'college_type': 'DNB'
                }

            total = sum(len(colleges) for colleges in self._college_cache.values())
            logger.debug(f"Loaded {total} colleges into cache (MEDICAL: {len(self._college_cache['MEDICAL'])}, "
                        f"DENTAL: {len(self._college_cache['DENTAL'])}, DNB: {len(self._college_cache['DNB'])})")
            conn.close()
        except Exception as e:
            logger.error(f"Error loading master colleges: {e}")

    def _extract_campus_indicators(self, address: str) -> List[str]:
        """
        Extract campus indicators from address.

        Examples:
            "BEMINA SRINAGAR" → ["BEMINA"]
            "SKIMS SOURA SRINAGAR KASHMIR" → ["SOURA"]
            "PRINCIPAL SKIMS HOSPITAL BEMINA" → ["PRINCIPAL", "BEMINA"]

        Args:
            address: Full address string

        Returns:
            List of campus indicators found
        """
        if not address:
            return []

        found_indicators = []
        address_upper = address.upper()

        # Check for exact matches (case-insensitive)
        for indicator in self.CAMPUS_INDICATORS:
            if indicator in address_upper:
                found_indicators.append(indicator)

        # Also check for CAMPUS/WING patterns: "CAMPUS NAME" or "WING NAME"
        # E.g., "BEMINA CAMPUS" or "EAST WING"
        campus_pattern = r'\b([A-Z][A-Z\s]{0,20}?)\s+(CAMPUS|WING|CENTER|CENTRE)\b'
        for match in re.finditer(campus_pattern, address_upper):
            campus_name = match.group(1).strip()
            if campus_name and len(campus_name) <= 30:  # Reasonable campus name length
                found_indicators.append(campus_name)

        return list(set(found_indicators))  # Remove duplicates

    def _remove_campus_words(self, address: str, campus_indicators: List[str]) -> str:
        """
        Remove campus indicator words from address.

        Args:
            address: Full address
            campus_indicators: List of indicators to remove

        Returns:
            Address with campus words removed
        """
        filtered = address

        # Remove each campus indicator
        for indicator in campus_indicators:
            # Case-insensitive removal
            pattern = r'\b' + re.escape(indicator) + r'\b'
            filtered = re.sub(pattern, '', filtered, flags=re.IGNORECASE)

        # Clean up multiple spaces
        filtered = re.sub(r'\s+', ' ', filtered).strip()

        return filtered

    def _extract_words(self, text: str) -> set:
        """
        Extract significant words from text (length > 2).

        Args:
            text: Input text

        Returns:
            Set of words
        """
        if not text:
            return set()

        # Convert to uppercase for consistency
        text_upper = text.upper()

        # Remove punctuation and split by whitespace
        # Simple approach: remove non-alphanumeric except spaces, then split
        text_cleaned = re.sub(r'[^A-Z\s]', '', text_upper)
        words = text_cleaned.split()

        # Filter: words with length > 2
        return {w for w in words if len(w) > 2}

    def _calculate_word_overlap(self, text1: str, text2: str) -> float:
        """
        Calculate Jaccard similarity based on word overlap.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Jaccard similarity (0.0-1.0)
        """
        words1 = self._extract_words(text1)
        words2 = self._extract_words(text2)

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0

    def _fuzzy_match_college_name(self, name1: str, name2: str) -> float:
        """
        Fuzzy match two college names.

        Args:
            name1: First college name
            name2: Second college name

        Returns:
            Similarity score (0.0-1.0)
        """
        # Normalize: remove hyphens, multiple spaces
        n1 = re.sub(r'[-\s]+', ' ', name1.upper().strip())
        n2 = re.sub(r'[-\s]+', ' ', name2.upper().strip())

        # Use SequenceMatcher for string similarity
        matcher = SequenceMatcher(None, n1, n2)
        return matcher.ratio()

    def _find_candidates_by_name_state(self, college_name: str, state: str, course_type: str = None) -> List[Dict]:
        """
        Find candidate colleges by name, state, and STREAM/COURSE TYPE.

        Args:
            college_name: College name to match
            state: State to filter by
            course_type: Course type (MEDICAL, DENTAL, DNB) for stream filtering

        Returns:
            List of matching colleges
        """
        candidates = []

        # Normalize inputs
        college_upper = college_name.upper()
        state_upper = state.upper()

        # Map course_type to college pool
        college_pools = self._get_college_pools(course_type)

        # Search through relevant college pools
        for pool_name in college_pools:
            if pool_name not in self._college_cache:
                continue

            for college_id, college_data in self._college_cache[pool_name].items():
                # Filter by state first
                if college_data['state'].upper() != state_upper:
                    continue

                # Fuzzy match college name
                name_similarity = self._fuzzy_match_college_name(
                    college_name,
                    college_data['name']
                )

                # Accept if similarity > 0.80
                if name_similarity >= 0.80:
                    candidates.append(college_data)

        return candidates

    def _get_college_pools(self, course_type: str) -> List[str]:
        """
        Map course_type to college pools to search.

        Args:
            course_type: Course type from seat_data

        Returns:
            List of pool names to search (MEDICAL, DENTAL, DNB)
        """
        if not course_type:
            return ['MEDICAL', 'DENTAL', 'DNB']  # Search all if no course type

        course_upper = course_type.upper()

        # Map course types to college pools
        if 'MEDICAL' in course_upper or 'MBBS' in course_upper:
            return ['MEDICAL']
        elif 'DENTAL' in course_upper or 'BDS' in course_upper:
            return ['DENTAL']
        elif 'DNB' in course_upper:
            return ['DNB']
        else:
            return ['MEDICAL', 'DENTAL', 'DNB']  # Fallback to all

    def _exact_match_by_college_state(self, college_name: str, state: str, course_type: str = None) -> Tuple[Optional[Dict], float, str]:
        """
        Try exact match on college name + state (no address needed).

        Args:
            college_name: College name
            state: State
            course_type: Course type for stream filtering

        Returns:
            (matched_college, confidence, method) tuple
        """
        candidates = self._find_candidates_by_name_state(college_name, state, course_type)

        if len(candidates) == 1:
            # Perfect: only one match
            return candidates[0], 1.0, 'pass5d_exact_match'
        elif len(candidates) > 1:
            # Ambiguous: multiple candidates, but college+state matched
            # Return the first one with note about ambiguity
            logger.debug(f"Pass 5D: Multiple candidates for {college_name} in {state}")
            return None, 0.0, 'pass5d_ambiguous'

        return None, 0.0, 'pass5d_no_match'

    def match_unmatched_record(self,
                               college_name: str,
                               state: str,
                               address: str,
                               course_type: str = None) -> Tuple[Optional[Dict], float, str]:
        """
        Main matching function for Pass 5D with STREAM FILTERING.

        Algorithm:
        1. Filter colleges by course_type (MEDICAL, DENTAL, DNB)
        2. Extract campus indicators from address
        3. If no indicators found, try exact match on college+state
        4. If indicators found, filter them out and retry with lower threshold

        Args:
            college_name: College name from unmatched record
            state: State from unmatched record
            address: Address from unmatched record
            course_type: Course type for STREAM FILTERING (MEDICAL, DENTAL, DNB)

        Returns:
            (matched_college, confidence, method) tuple
        """
        logger.debug(f"Pass 5D: Processing {college_name} in {state}, course_type: {course_type}")

        # Step 1: Extract campus indicators
        campus_indicators = self._extract_campus_indicators(address)

        if not campus_indicators:
            # No campus indicators: try exact match
            logger.debug(f"Pass 5D: No campus indicators found, trying exact match")
            return self._exact_match_by_college_state(college_name, state, course_type)

        # Step 2: Campus indicators found, filter them out
        logger.debug(f"Pass 5D: Found campus indicators: {campus_indicators}")
        filtered_address = self._remove_campus_words(address, campus_indicators)
        logger.debug(f"Pass 5D: Filtered address: '{filtered_address}'")

        # Step 3: Find candidates by name + state + COURSE TYPE
        candidates = self._find_candidates_by_name_state(college_name, state, course_type)

        if not candidates:
            logger.debug(f"Pass 5D: No candidates found for {college_name} in {state}")
            return None, 0.0, 'pass5d_no_match'

        # Step 4: Try CAMPUS-SPECIFIC MATCH first
        # Check if any candidate has the campus indicator in their address
        campus_specific_matches = []
        for candidate in candidates:
            # CRITICAL: Also check name similarity to prevent "ZOI" matching "AIG"
            name_similarity = self._fuzzy_match_college_name(college_name, candidate['name'])
            
            for indicator in campus_indicators:
                if indicator.upper() in candidate['address'].upper():
                    # This candidate matches the campus indicator!
                    overlap = self._calculate_word_overlap(
                        filtered_address,
                        candidate['address']
                    )
                    
                    # CRITICAL VALIDATION: Campus indicator alone is NOT enough!
                    # Require BOTH:
                    # 1. Name similarity >= 0.70 (prevents "ZOI" → "AIG")
                    # 2. Address overlap >= 0.30 (not just "ROAD" match)
                    if name_similarity >= 0.70 and overlap >= 0.30:
                        campus_specific_matches.append((candidate, overlap, indicator))
                        logger.debug(f"Pass 5D: Campus-specific match - {candidate['name']} has campus '{indicator}' (name sim: {name_similarity:.2f}, overlap: {overlap:.2f})")
                    else:
                        logger.debug(f"Pass 5D: Rejected campus match - {candidate['name']} (name sim: {name_similarity:.2f}, overlap: {overlap:.2f}) - thresholds not met")

        if campus_specific_matches:
            # Sort by overlap score (descending)
            campus_specific_matches.sort(key=lambda x: x[1], reverse=True)
            best_match, best_score, matched_campus = campus_specific_matches[0]
            logger.info(f"✅ Pass 5D: Matched '{college_name}' → {best_match['name']} "
                       f"(campus-specific: {matched_campus}, overlap: {best_score:.2f})")
            return best_match, best_score, 'pass5d_campus_specific'  # Return actual score, not inflated

        # Step 5: Fall back to GENERIC matching on filtered address
        best_match = None
        best_score = 0.0

        for candidate in candidates:
            # CRITICAL: Check name similarity FIRST
            name_similarity = self._fuzzy_match_college_name(college_name, candidate['name'])
            
            # Calculate overlap on FILTERED address
            overlap = self._calculate_word_overlap(
                filtered_address,
                candidate['address']
            )

            logger.debug(f"Pass 5D: {candidate['name']} - name sim: {name_similarity:.2f}, overlap: {overlap:.2f}")

            # STRICT VALIDATION: Require BOTH name similarity >= 0.70 AND overlap >= 0.30
            # This prevents "ZOI" matching "KIMS" or other unrelated hospitals
            if name_similarity >= 0.70 and overlap >= 0.30 and overlap > best_score:
                best_match = candidate
                best_score = overlap

        if best_match:
            logger.info(f"✅ Pass 5D: Matched '{college_name}' → {best_match['name']} "
                       f"(campus-filtered, overlap: {best_score:.2f})")
            return best_match, best_score, 'pass5d_campus_filtered'

        logger.debug(f"Pass 5D: No match found for {college_name} (validation failed)")
        return None, 0.0, 'pass5d_no_match'


if __name__ == "__main__":
    # Test the matcher
    matcher = CampusSpecificMatcher()

    test_cases = [
        {
            'college_name': 'SHER-I-KASHMIR INSTITUTE OF MEDICAL SCIENCES',
            'state': 'JAMMU AND KASHMIR',
            'address': 'PRINCIPAL SKIMS MEDICAL COLLEGE HOSPITAL BEMINA SRINAGAR'
        },
        {
            'college_name': 'SHER-I-KASHMIR INSTITUTE OF MEDICAL SCIENCES',
            'state': 'JAMMU AND KASHMIR',
            'address': 'SKIMS SOURA SRINAGAR JAMMU AND KASHMIR'
        },
        {
            'college_name': 'GOVT DISTRICT HOSPITAL',
            'state': 'JAMMU AND KASHMIR',
            'address': 'SRINAGAR'
        }
    ]

    for i, test in enumerate(test_cases, 1):
        print(f"\n{'='*80}")
        print(f"Test Case {i}: {test['college_name']}")
        print(f"{'='*80}")

        matched, score, method = matcher.match_unmatched_record(
            test['college_name'],
            test['state'],
            test['address']
        )

        if matched:
            print(f"✅ MATCHED: {matched['name']} ({matched['id']})")
            print(f"   Score: {score:.2f}, Method: {method}")
        else:
            print(f"❌ NO MATCH: {method}")
