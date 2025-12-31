#!/usr/bin/env python3
"""
PASS 1: State + Course Filtering with Stream Awareness

Implementation of stream filtering for PASS 1 in integrated_5pass_orchestrator.py

This replaces the previous PASS 1-2 logic with proper stream filtering based on
course→stream mapping from config.yaml.
"""

import logging
import re
from typing import Dict, Optional, Tuple, List
from course_stream_mapper import CourseStreamMapper

logger = logging.getLogger(__name__)


class Pass1StreamFiltering:
    """
    PASS 1 implementation with stream filtering.

    Instead of searching all colleges (MEDICAL, DENTAL, DNB),
    search ONLY colleges in the appropriate stream(s) for the course.

    Benefits:
    - Eliminates 200-300 MBBS→DNB wrong matches
    - Reduces ambiguity in matching
    - Improves match confidence
    """

    def __init__(self, recent3_matcher, stream_mapper: CourseStreamMapper):
        """
        Initialize PASS 1 with stream mapper.

        Args:
            recent3_matcher: AdvancedSQLiteMatcher instance with master data
            stream_mapper: CourseStreamMapper for course→stream mapping
        """
        self.recent3_matcher = recent3_matcher
        self.stream_mapper = stream_mapper
        self.stats = {
            'pass1_attempts': 0,
            'pass1_matches': 0,
            'pass1_stream_filtered': 0,
        }

    def match_group(self,
                    college_name: str,
                    state: str,
                    course_name: str,
                    course_type: str,
                    address: str = '') -> Tuple[Optional[Dict], float, str]:
        """
        PASS 1: State + Course Filtering with Stream Awareness

        Algorithm:
        1. Map course_name to streams (MEDICAL, DENTAL, DNB)
        2. For each stream (in priority order):
           a. Find colleges by state + name
           b. If match found, return (don't search other streams)
        3. If no match in primary stream, try fallback stream
        4. If no match in any stream, return None

        Args:
            college_name: College name to match (normalized)
            state: State to filter by
            course_name: Course name (for stream filtering)
            course_type: Course type backup (medical/dental/dnb)
            address: Address (optional, for future validation)

        Returns:
            (matched_college, confidence, method) tuple
        """
        self.stats['pass1_attempts'] += 1

        # DEBUG LOGGING FOR KASHIBAI CASE
        if 'KASHIBAI' in college_name.upper():
            logger.info(f"🔍 DEBUG PASS 1: Matching '{college_name}'")
            logger.info(f"   State: {state}, Course: {course_name}, Address: {address}")

        logger.debug(f"PASS 1: Attempting to match '{college_name}' "
                    f"in {state} for course '{course_name}'")
        
        # Step 1: Get streams for this course
        streams = self.stream_mapper.get_all_streams(course_name)
        strategy = self.stream_mapper.get_strategy(course_name)
        logger.debug(f"PASS 1: Course '{course_name}' maps to streams: {streams} "
                    f"(strategy: {strategy})")

        # Step 2: Search each stream in order
        for stream in streams:
            logger.debug(f"PASS 1: Searching {stream} pool for '{college_name}' in {state}")

            # Find candidates in THIS stream only
            candidates = self._find_candidates_in_stream(
                college_name, state, stream, address
            )

            if candidates:
                # Sort by match quality
                candidates.sort(key=lambda c: c['match_score'], reverse=True)
                best_match = candidates[0]

                self.stats['pass1_matches'] += 1
                self.stats['pass1_stream_filtered'] += 1

                logger.info(f"✅ PASS 1: Matched '{college_name}' → "
                           f"{best_match['name']} ({best_match['id']}) "
                           f"in {stream} pool (score: {best_match['match_score']:.2f})")

                return best_match, best_match['match_score'], f'pass1_stream_{stream}'

        # Step 3: No match found in any stream
        logger.debug(f"PASS 1: No match found for '{college_name}' in {state} "
                    f"across streams: {streams}")

        return None, 0.0, 'pass1_no_match'

    def _find_candidates_in_stream(self,
                                   college_name: str,
                                   state: str,
                                   stream: str,
                                   address: str = '') -> List[Dict]:
        """
        Find colleges in a specific stream.

        This is the KEY CHANGE from original PASS 1:
        - Filter by stream (MEDICAL, DENTAL, DNB)
        - Only return colleges from that pool

        Args:
            college_name: College name to match (normalized)
            state: State to filter by
            stream: College stream (MEDICAL, DENTAL, DNB)

        Returns:
            List of matching colleges with scores
        """
        candidates = []

        try:
            # Get colleges from specific stream using recent3_matcher
            # Pass course_type corresponding to stream
            stream_to_course_type = {
                'MEDICAL': 'medical',
                'DENTAL': 'dental',
                'DNB': 'dnb'
            }
            course_type = stream_to_course_type.get(stream, '')

            if not course_type:
                logger.warning(f"Unknown stream: {stream}")
                return []

            # Get colleges in this stream and state
            colleges = self.recent3_matcher.get_colleges_by_state(state, course_type)

            # Match colleges in this stream
            for college in colleges:
                # Fuzzy match college names using keyword-based approach
                similarity = self._keyword_match(college_name, college.get('normalized_name', college.get('name', '')))

                if similarity >= 0.75:  # 75% threshold
                    # UNIVERSAL ADDRESS VALIDATION: Strict threshold for ALL colleges
                    # Even if name matches, address MUST match if provided
                    should_accept = True
                    address_score = 0.0
                    
                    if address and college.get('address'):
                        # Normalize addresses
                        normalized_seat_address = self.recent3_matcher.normalize_text(address).upper()
                        candidate_address = self.recent3_matcher.normalize_text(college.get('address', '')).upper()

                        # Extract meaningful keywords
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

                        # STRICT THRESHOLD: 0.75 (75%) - INCREASED from 0.50 to prevent false matches
                        # This prevents matches like "NAVI MUMBAI" vs "NERUL, NAVI MUMBAI"
                        # or "PRESS ENCLAVE ROAD" with different street numbers/buildings
                        if not common_keywords or address_score < 0.75:
                            logger.debug(f"❌ PASS 1 REJECTED: Address mismatch for {college_name} "
                                       f"(score: {address_score:.2f}, min: 0.75)")
                            should_accept = False

                    if should_accept:
                        # CRITICAL FIX: Check for Name Conflict (e.g. "Max Smart" vs "Max Super")
                        # Only if the method exists (some matchers don't have it)
                        has_conflict_method = hasattr(self.recent3_matcher, 'check_name_conflict')
                        
                        if 'KASHIBAI' in college_name.upper():
                            logger.info(f"   Candidate: {college.get('name')} (has_conflict_method={has_conflict_method})")

                        if has_conflict_method:
                            is_conflict, reason = self.recent3_matcher.check_name_conflict(college_name, college.get('name', ''))
                            if is_conflict:
                                logger.debug(f"❌ PASS 1 REJECTED (Name Conflict): {college_name} vs {college.get('name')} - {reason}")
                                continue

                        candidates.append({
                            'id': college.get('id'),
                            'name': college.get('name', ''),
                            'normalized_name': college.get('normalized_name', ''),
                            'address': college.get('address', ''),
                            'state': college.get('state', ''),
                            'type': stream,
                            'college_type': stream,
                            'match_score': similarity,
                        })

        except Exception as e:
            logger.debug(f"Error finding candidates in {stream} pool: {e}")

        return candidates

    def _keyword_match(self, name1: str, name2: str) -> float:
        """
        Match college names using keyword overlap (not fuzzy).

        This prevents false positives like "DISTRICT HOSPITAL" matching
        across different states.

        Args:
            name1: First college name (normalized)
            name2: Second college name (normalized)

        Returns:
            Similarity score (0.0-1.0)
        """
        # Normalize names
        n1 = name1.upper().replace('-', ' ').strip()
        n2 = name2.upper().replace('-', ' ').strip()

        # Extract significant words (remove stopwords)
        stopwords = {'OF', 'AND', 'THE', 'WITH', 'FOR', 'IN', 'AT'}

        def get_significant_words(text):
            words = set(text.split())
            return words - stopwords

        words1 = get_significant_words(n1)
        words2 = get_significant_words(n2)

        if not words1 or not words2:
            # If no significant words, fall back to exact match
            return 1.0 if n1 == n2 else 0.0

        # Calculate word overlap (Jaccard similarity)
        intersection = len(words1 & words2)
        union = len(words1 | words2)

        if union == 0:
            return 0.0

        return intersection / union

    def get_stats(self) -> Dict:
        """Get PASS 1 statistics"""
        return self.stats


if __name__ == "__main__":
    # Test the Pass1StreamFiltering
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    print("\n" + "="*80)
    print("PASS 1: STATE + COURSE FILTERING WITH STREAM FILTERING")
    print("="*80)
    print("\nNote: This is a test template. Actual testing requires orchestrator context.")
    print("See STREAM_FILTERING_VALIDATION_PLAN.md for comprehensive test harness.")
