#!/usr/bin/env python3
"""
PASS 4B: Multi Campus Path with Stream Awareness

Implementation of stream filtering for PASS 4B in integrated_5pass_orchestrator.py

Used when PASS 3 detects that a college has MULTIPLE campuses/locations.
This pass does ADDRESS-PRIMARY matching to disambiguate between campuses.
"""

import logging
import re
from typing import Dict, Optional, Tuple, List
from course_stream_mapper import CourseStreamMapper

logger = logging.getLogger(__name__)


class Pass4BStreamFiltering:
    """
    PASS 4B implementation with stream filtering.

    Multi Campus Path: When a college has multiple campuses/locations,
    match using ADDRESS-PRIMARY strategy to disambiguate.

    Key Behavior:
    - Searches colleges in the appropriate stream only
    - Uses address as PRIMARY matching criterion
    - College name is SECONDARY criterion
    - Extracts campus indicators (BEMINA, SOURA, etc.) to match specific campus
    - Returns most specific match (campus-level, not college-level)

    Benefits:
    - Correctly matches specific campus for multi-campus colleges
    - Example: "BEMINA SRINAGAR" matches DNB0318, not DNB0319
    - Maintains stream filtering (no cross-stream matches)
    - Handles address variations (KOTA vs KOTA, RAJASTHAN)

    Example:
      SHER-I-KASHMIR has 3 distinct locations:
      - MEDICAL pool: MED0757 (SRINAGAR)
      - DNB pool: DNB0318 (BEMINA, SRINAGAR)
      - DNB pool: DNB0319 (SOURA, SRINAGAR)

      PASS 4B for MBBS:
      1. Searches MEDICAL stream only
      2. Finds MED0757 (single campus in MEDICAL)
      3. Returns MED0757

      PASS 4B for DNB course:
      1. Searches DNB stream only
      2. Finds DNB0318 (BEMINA) and DNB0319 (SOURA)
      3. Uses address to disambiguate
      4. If address says "BEMINA", returns DNB0318
      5. If address says "SOURA", returns DNB0319
    """

    def __init__(self, recent3_matcher, stream_mapper: CourseStreamMapper):
        """
        Initialize PASS 4B with stream mapper.

        Args:
            recent3_matcher: AdvancedSQLiteMatcher instance with master data
            stream_mapper: CourseStreamMapper for course→stream mapping
        """
        self.recent3_matcher = recent3_matcher
        self.stream_mapper = stream_mapper
        self.stats = {
            'pass4b_attempts': 0,
            'pass4b_matches': 0,
            'pass4b_stream_filtered': 0,
            'pass4b_address_matched': 0,
            'pass4b_college_name_fallback': 0,
        }

    def match_group(self,
                    college_name: str,
                    state: str,
                    address: str,
                    course_name: str,
                    course_type: str) -> Tuple[Optional[Dict], float, str]:
        """
        PASS 4B: Multi Campus Path with Stream Awareness

        Algorithm:
        1. Get primary stream for course
        2. Find all colleges in that stream matching name
        3. Try ADDRESS-PRIMARY matching:
           a. Extract campus indicators from seat address
           b. For each candidate college:
              - Check if campus indicator appears in master address
              - Calculate address overlap score
        4. Return best address match
        5. If no address match, fall back to college name match

        Args:
            college_name: College name to match (normalized)
            state: State to filter by
            address: Address from seat data (PRIMARY criterion)
            course_name: Course name (for stream filtering)
            course_type: Course type backup (medical/dental/dnb)

        Returns:
            (matched_college, confidence, method) tuple
        """
        self.stats['pass4b_attempts'] += 1

        logger.debug(f"PASS 4B: Multi-campus match for '{college_name}' "
                    f"in {state} with address '{address[:50]}...' "
                    f"for course '{course_name}'")

        # Step 1: Get primary stream for this course
        primary_stream = self.stream_mapper.get_primary_stream(course_name)
        logger.debug(f"PASS 4B: Primary stream: {primary_stream}")

        # Step 2: Find all candidates in primary stream
        candidates = self._find_candidates_in_stream(
            college_name, state, primary_stream
        )

        if not candidates:
            logger.debug(f"PASS 4B: No candidates found in {primary_stream} stream")
            return None, 0.0, 'pass4b_no_candidates'

        logger.debug(f"PASS 4B: Found {len(candidates)} candidate(s) in {primary_stream} stream")

        # Step 3: Try ADDRESS-PRIMARY matching
        best_match = None
        best_score = 0.0

        # Extract campus indicators from seat data address
        campus_indicators = self._extract_campus_indicators(address)
        logger.debug(f"PASS 4B: Campus indicators from seat address: {campus_indicators}")

        # Try to match candidates using address
        for candidate in candidates:
            master_address = candidate.get('address', '').upper()

            # Check for campus-specific match
            if campus_indicators:
                for indicator in campus_indicators:
                    if indicator.upper() in master_address:
                        # Found exact campus indicator match!
                        logger.debug(f"PASS 4B: Found campus indicator '{indicator}' in {candidate['name']}")
                        return candidate, 0.95, 'pass4b_campus_indicator_match'

            # Fall back to address overlap matching
            address_score = self._calculate_address_overlap(address, master_address)
            logger.debug(f"PASS 4B: Address overlap for {candidate['name']}: {address_score:.2f}")

            if address_score >= 0.75 and address_score > best_score:  # THRESHOLD INCREASED from 0.50 to 0.75 to prevent false matches
                best_match = candidate
                best_score = address_score

        if best_match and best_score >= 0.50:
            self.stats['pass4b_matches'] += 1
            self.stats['pass4b_stream_filtered'] += 1
            self.stats['pass4b_address_matched'] += 1

            logger.info(f"✅ PASS 4B: Multi-campus match for '{college_name}' → "
                       f"{best_match['name']} ({best_match['id']}) "
                       f"in {primary_stream} pool (address score: {best_score:.2f})")

            return best_match, best_score, 'pass4b_multi_campus_address_match'

        # Step 4: Fall back to college name match if address matching fails
        logger.debug(f"PASS 4B: Address matching failed, falling back to college name match")

        if candidates:
            self.stats['pass4b_matches'] += 1
            self.stats['pass4b_stream_filtered'] += 1
            self.stats['pass4b_college_name_fallback'] += 1

            # Return first candidate as fallback
            best_candidate = candidates[0]
            logger.info(f"⚠️  PASS 4B: Multi-campus fallback for '{college_name}' → "
                       f"{best_candidate['name']} ({best_candidate['id']}) "
                       f"(name-based fallback)")

            return best_candidate, 0.75, 'pass4b_multi_campus_name_fallback'

        return None, 0.0, 'pass4b_no_match'

    def _find_candidates_in_stream(self,
                                   college_name: str,
                                   state: str,
                                   stream: str) -> List[Dict]:
        """
        Find all colleges in a specific stream matching name + state.

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

            # Match by name
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

    def _extract_campus_indicators(self, address: str) -> List[str]:
        """
        Extract campus location indicators from address.

        Examples:
        - "BEMINA SRINAGAR" → ["BEMINA"]
        - "SOURA, SRINAGAR" → ["SOURA"]
        - "PRINCIPAL'S RESIDENCE" → ["PRINCIPAL"]

        Args:
            address: Address string to extract from

        Returns:
            List of campus indicators
        """
        if not address:
            return []

        indicators = []

        # List of known campus indicators
        campus_keywords = [
            'BEMINA', 'SOURA', 'PRINCIPAL', 'CAMPUS', 'BRANCH',
            'CENTRE', 'CENTER', 'UNIT', 'BLOCK', 'BUILDING',
            'WING', 'SECTION', 'DIVISION', 'SATELLITE', 'ANNEX'
        ]

        address_upper = address.upper()

        # Extract first significant word(s) that might be campus indicator
        words = re.sub(r'[^A-Z\s]', '', address_upper).split()

        for word in words:
            if len(word) > 2:  # Only consider words with 3+ characters
                for keyword in campus_keywords:
                    if keyword in word or word in keyword:
                        indicators.append(word)
                        break

        # Remove duplicates while preserving order
        seen = set()
        unique_indicators = []
        for indicator in indicators:
            if indicator not in seen:
                seen.add(indicator)
                unique_indicators.append(indicator)

        return unique_indicators

    def _calculate_address_overlap(self, seat_address: str, master_address: str) -> float:
        """
        Calculate address overlap using word-based Jaccard similarity.

        Args:
            seat_address: Address from seat data
            master_address: Address from master data

        Returns:
            float: Similarity score (0.0-1.0)
        """
        if not seat_address or not master_address:
            return 0.0

        try:
            def extract_words(address_str):
                """Extract significant words from address"""
                if not address_str:
                    return set()

                words = address_str.upper().split()
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
            logger.debug(f"Error calculating address overlap: {e}")
            return 0.0

    def get_stats(self) -> Dict:
        """Get PASS 4B statistics"""
        return self.stats


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    print("\n" + "="*80)
    print("PASS 4B: MULTI CAMPUS PATH WITH STREAM FILTERING")
    print("="*80)
    print("\nBehavior:")
    print("  - Used when PASS 3 detects a college has MULTIPLE campuses")
    print("  - Uses ADDRESS-PRIMARY matching to disambiguate")
    print("  - Extracts campus indicators (BEMINA, SOURA, etc.)")
    print("  - Falls back to college name if address matching fails")
    print("\nExample:")
    print("  College: SHER-I-KASHMIR (multi-campus)")
    print("  Seat Address: BEMINA SRINAGAR")
    print("  Master Addresses:")
    print("    - DNB0318: BEMINA, SRINAGAR")
    print("    - DNB0319: SOURA, SRINAGAR")
    print("  → Extracts campus indicator: BEMINA")
    print("  → Matches to DNB0318 (has BEMINA in address)")
    print("\nNote: Requires orchestrator context to run.")
