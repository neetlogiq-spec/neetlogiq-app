#!/usr/bin/env python3
"""
PASS 4A: Single Campus Path with Stream Awareness

Implementation of stream filtering for PASS 4A in integrated_5pass_orchestrator.py

Used when PASS 3 detects that a college has only ONE campus/location.
This pass validates the address matches before accepting the college.
"""

import logging
from typing import Dict, Optional, Tuple, List
from course_stream_mapper import CourseStreamMapper

logger = logging.getLogger(__name__)


class Pass4AStreamFiltering:
    """
    PASS 4A implementation with stream filtering.

    Single Campus Path: When a college has only one campus/location,
    validate that the address matches before accepting the match.

    Key Behavior:
    - Searches colleges in the appropriate stream only
    - For single-campus colleges, validates address match
    - Returns match only if address validation passes
    - Falls through to PASS 4B or PASS 5 if address validation fails

    Benefits:
    - Prevents matching wrong college just because it has matching name
    - Ensures address aligns with the single campus
    - Maintains stream filtering (no cross-stream matches)
    """

    def __init__(self, recent3_matcher, address_matcher, stream_mapper: CourseStreamMapper):
        """
        Initialize PASS 4A with stream mapper and address matcher.

        Args:
            recent3_matcher: AdvancedSQLiteMatcher instance with master data
            address_matcher: AddressBasedMatcher for address validation
            stream_mapper: CourseStreamMapper for course→stream mapping
        """
        self.recent3_matcher = recent3_matcher
        self.address_matcher = address_matcher
        self.stream_mapper = stream_mapper
        self.stats = {
            'pass4a_attempts': 0,
            'pass4a_matches': 0,
            'pass4a_stream_filtered': 0,
            'pass4a_address_validated': 0,
            'pass4a_address_failed': 0,
        }

    def match_group(self,
                    college_name: str,
                    state: str,
                    address: str,
                    course_name: str,
                    course_type: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 4A: Single Campus Path with Stream Awareness

        Algorithm:
        1. Get primary stream for course
        2. Find colleges in that stream matching name + state
        3. For each candidate:
           a. Validate address matches
           b. If address valid, return candidate
        4. If no match passes validation, return None

        Args:
            college_name: College name to match (normalized)
            state: State to filter by
            address: Address from seat data (for validation)
            course_name: Course name (for stream filtering)
            course_type: Course type backup (medical/dental/dnb)

        Returns:
            (matched_college, confidence, method) tuple
        """
        self.stats['pass4a_attempts'] += 1

        logger.debug(f"PASS 4A: Single campus match for '{college_name}' "
                    f"in {state} with address '{address[:50]}...' "
                    f"for course '{course_name}'")

        # Step 1: Get primary stream for this course
        primary_stream = self.stream_mapper.get_primary_stream(course_name)
        logger.debug(f"PASS 4A: Primary stream: {primary_stream}")

        # Step 2: Find candidates in primary stream only
        candidates = self._find_candidates_in_stream(
            college_name, state, primary_stream
        )

        if not candidates:
            logger.debug(f"PASS 4A: No candidates found in {primary_stream} stream")
            return None, 0.0, 'pass4a_no_candidates'

        logger.debug(f"PASS 4A: Found {len(candidates)} candidate(s) in {primary_stream} stream")

        # Step 3: Validate address for each candidate
        best_match = None
        best_score = 0.0

        for candidate in candidates:
            # Validate address using address_matcher
            address_score = self._validate_address(
                address, candidate.get('address', '')
            )

            logger.debug(f"PASS 4A: Address validation for {candidate['name']}: "
                        f"score {address_score:.2f}")

            if address_score >= 0.75:  # Address validation threshold - INCREASED from 0.60 to match Pass 1
                self.stats['pass4a_address_validated'] += 1

                # Found a candidate with valid address
                if address_score > best_score:
                    best_match = candidate
                    best_score = address_score

        if best_match:
            self.stats['pass4a_matches'] += 1
            self.stats['pass4a_stream_filtered'] += 1

            logger.info(f"✅ PASS 4A: Single campus match for '{college_name}' → "
                       f"{best_match['name']} ({best_match['id']}) "
                       f"in {primary_stream} pool (address score: {best_score:.2f})")

            return best_match, best_score, 'pass4a_single_campus_address_validated'

        # Address validation failed for all candidates
        self.stats['pass4a_address_failed'] += len(candidates)
        logger.debug(f"PASS 4A: Address validation failed for all {len(candidates)} candidates")

        return None, 0.0, 'pass4a_address_validation_failed'

    def _find_candidates_in_stream(self,
                                   college_name: str,
                                   state: str,
                                   stream: str) -> List[Dict]:
        """
        Find colleges in a specific stream matching name + state.

        Args:
            college_name: College name to match (normalized)
            state: State to filter by
            stream: College stream (MEDICAL, DENTAL, DNB)

        Returns:
            List of matching colleges
        """
        candidates = []

        try:
            stream_to_course_type = {
                'MEDICAL': 'medical',
                'DENTAL': 'dental',
                'DNB': 'dnb'
            }
            course_type = stream_to_course_type.get(stream, '')

            if not course_type:
                return []

            # Get colleges in this stream and state
            colleges = self.recent3_matcher.get_colleges_by_state(state, course_type)

            # Match by name (allow partial matches)
            for college in colleges:
                college_name_normalized = college.get('normalized_name', college.get('name', '')).upper()
                query_name_normalized = college_name.upper()

                # Check if names match (exact or contain relationship)
                if college_name_normalized == query_name_normalized or \
                   (len(college_name_normalized) > len(query_name_normalized) and
                    query_name_normalized in college_name_normalized) or \
                   (len(query_name_normalized) > len(college_name_normalized) and
                    college_name_normalized in query_name_normalized):
                    candidates.append({
                        'id': college.get('id'),
                        'name': college.get('name', ''),
                        'normalized_name': college.get('normalized_name', ''),
                        'address': college.get('address', ''),
                        'state': college.get('state', ''),
                        'type': stream,
                        'college_type': stream,
                    })

        except Exception as e:
            logger.debug(f"Error finding candidates in {stream} stream: {e}")

        return candidates

    def _validate_address(self, seat_address: str, master_address: str) -> float:
        """
        Validate if seat data address matches master data address.

        Uses word-based overlap calculation (Jaccard similarity).

        Args:
            seat_address: Address from seat data
            master_address: Address from master data

        Returns:
            float: Similarity score (0.0-1.0)
        """
        if not seat_address or not master_address:
            return 0.0

        try:
            # Extract significant words from both addresses
            def extract_words(address_str):
                """Extract significant words from address"""
                if not address_str:
                    return set()

                # Normalize and split
                words = address_str.upper().split()

                # Remove common stopwords and short words
                stopwords = {'OF', 'AND', 'THE', 'WITH', 'FOR', 'IN', 'AT', 'TO', 'A', 'AN'}
                significant = {w for w in words if w not in stopwords and len(w) > 2}

                return significant

            seat_words = extract_words(seat_address)
            master_words = extract_words(master_address)

            if not seat_words or not master_words:
                return 0.0

            # Calculate Jaccard similarity
            intersection = len(seat_words & master_words)
            union = len(seat_words | master_words)

            if union == 0:
                return 0.0

            similarity = intersection / union
            return similarity

        except Exception as e:
            logger.debug(f"Error validating address: {e}")
            return 0.0

    def get_stats(self) -> Dict:
        """Get PASS 4A statistics"""
        return self.stats


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    print("\n" + "="*80)
    print("PASS 4A: SINGLE CAMPUS PATH WITH STREAM FILTERING")
    print("="*80)
    print("\nBehavior:")
    print("  - Used when PASS 3 detects a college has only 1 campus")
    print("  - Validates address match within appropriate stream")
    print("  - Prevents matching wrong college with same name")
    print("\nExample:")
    print("  College: GOVT MEDICAL COLLEGE")
    print("  Seat Address: KOTA, RAJASTHAN")
    print("  Master Address: KOTA")
    print("  → Validates word overlap (KOTA in both)")
    print("  → Returns match if validation passes")
    print("\nNote: Requires orchestrator context to run.")
