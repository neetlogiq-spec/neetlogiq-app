#!/usr/bin/env python3
"""
Pass 5E: NER-Based Address and Entity Matching

Uses Named Entity Recognition to extract semantic entities (ORG, LOC, CAMPUS)
and match based on entity-level similarity rather than word overlap.
"""

import sqlite3
import re
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher
import logging

logger = logging.getLogger(__name__)

# Try to import NER extractor, but don't fail if not available
try:
    from advanced_ner_extractor import EducationNER
    NER_AVAILABLE = True
except ImportError:
    logger.warning("EducationNER not available, NER matching will use fallback mode")
    NER_AVAILABLE = False


class NERBasedMatcher:
    """
    Matches unmatched records to master data using Named Entity Recognition.

    Key insight: Entity-level matching understands semantic relationships.
    E.g., "BEMINA SRINAGAR" recognizes:
    - ORG: SHER-I-KASHMIR
    - LOC_PRIMARY: SRINAGAR
    - LOC_SECONDARY: JAMMU AND KASHMIR
    - CAMPUS: BEMINA (secondary, can be ignored)
    """

    def __init__(self, master_db_path: str = None):
        """
        Initialize NER-based matcher.

        Args:
            master_db_path: Path to master_data.db
        """
        self.master_db = master_db_path or '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

        # Initialize NER
        if NER_AVAILABLE:
            try:
                self.ner = EducationNER()
                logger.info("NER model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load NER: {e}, using fallback mode")
                self.ner = None
        else:
            self.ner = None

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

    def _extract_entities_ner(self, text: str) -> Dict:
        """
        Extract entities using NER.

        Args:
            text: Input text

        Returns:
            Dictionary with extracted entities
        """
        if not self.ner:
            return self._extract_entities_fallback(text)

        try:
            # Use EducationNER's extract_all method
            entities = self.ner.extract_all(text)

            return {
                'organizations': [e['text'] for e in entities.get('colleges', [])],
                'locations': [e['text'] for e in entities.get('locations', [])],
                'quota': entities.get('quota'),
                'category': entities.get('category'),
                'raw_entities': entities
            }
        except Exception as e:
            logger.debug(f"NER extraction error: {e}, using fallback")
            return self._extract_entities_fallback(text)

    def _extract_entities_fallback(self, text: str) -> Dict:
        """
        Fallback entity extraction using heuristics.

        Args:
            text: Input text

        Returns:
            Dictionary with extracted entities
        """
        if not text:
            return {
                'organizations': [],
                'locations': [],
                'quota': None,
                'category': None,
                'raw_entities': {}
            }

        # Extract institutions/colleges (uppercase sequences > 3 words)
        org_pattern = r'\b([A-Z][A-Z\s]{5,}(?:COLLEGE|HOSPITAL|INSTITUTE|UNIVERSITY))\b'
        organizations = re.findall(org_pattern, text.upper())

        # Extract locations (known Indian states and major cities)
        locations = self._extract_locations_heuristic(text)

        return {
            'organizations': organizations,
            'locations': locations,
            'quota': None,
            'category': None,
            'raw_entities': {}
        }

    def _extract_locations_heuristic(self, text: str) -> List[str]:
        """
        Extract locations using keyword matching.

        Args:
            text: Input text

        Returns:
            List of location strings
        """
        # Common Indian states and major cities
        state_keywords = {
            'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR',
            'CHHATTISGARH', 'GOVA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH',
            'JHARKHAND', 'KARNATAKA', 'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA',
            'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA',
            'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA',
            'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL',
            'JAMMU AND KASHMIR', 'LADAKH', 'DELHI', 'PUDUCHERRY'
        }

        city_keywords = {
            'DELHI', 'MUMBAI', 'BANGALORE', 'KOLKATA', 'CHENNAI', 'HYDERABAD',
            'PUNE', 'AHMEDABAD', 'SURAT', 'JAIPUR', 'LUCKNOW', 'KANPUR',
            'NAGPUR', 'INDORE', 'SRINAGAR', 'CHANDIGARH', 'KOCHI', 'VISAKHAPATNAM'
        }

        text_upper = text.upper()
        locations = []

        # Look for state keywords
        for state in state_keywords:
            if state in text_upper:
                locations.append(state)

        # Look for city keywords
        for city in city_keywords:
            if city in text_upper and city not in locations:
                locations.append(city)

        return locations

    def _match_organization(self, unmatched_orgs: List[str], master_names: List[str]) -> float:
        """
        Match organizations using fuzzy matching.

        Args:
            unmatched_orgs: Extracted organizations from unmatched record
            master_names: Master college names to match against

        Returns:
            Match score (0.0-1.0)
        """
        if not unmatched_orgs or not master_names:
            return 0.0

        best_score = 0.0

        for unmatched_org in unmatched_orgs:
            for master_name in master_names:
                # Normalize both
                org_norm = re.sub(r'[-\s]+', ' ', unmatched_org.upper().strip())
                name_norm = re.sub(r'[-\s]+', ' ', master_name.upper().strip())

                # Fuzzy match
                matcher = SequenceMatcher(None, org_norm, name_norm)
                score = matcher.ratio()

                best_score = max(best_score, score)

        return best_score

    def _match_locations(self, unmatched_locs: List[str], master_locs: List[str]) -> float:
        """
        Match locations - check if unmatched locations are contained in master.

        Args:
            unmatched_locs: Extracted locations from unmatched record
            master_locs: Master locations (state, city)

        Returns:
            Match score (0.0-1.0)
        """
        if not unmatched_locs or not master_locs:
            return 0.0

        # If ANY unmatched location matches ANY master location, it's a hit
        for unmatched_loc in unmatched_locs:
            for master_loc in master_locs:
                # Exact match (case-insensitive)
                if unmatched_loc.upper() == master_loc.upper():
                    return 1.0

        # Partial match (substring)
        for unmatched_loc in unmatched_locs:
            for master_loc in master_locs:
                if unmatched_loc.upper() in master_loc.upper() or \
                   master_loc.upper() in unmatched_loc.upper():
                    return 0.8

        return 0.0

    def _find_candidates_by_name(self, college_name: str, course_type: str = None) -> List[Dict]:
        """
        Find candidate colleges by name (fuzzy) with STREAM FILTERING.

        Args:
            college_name: College name to match
            course_type: Course type for STREAM FILTERING

        Returns:
            List of matching colleges
        """
        exact_candidates = []
        fuzzy_candidates = []

        college_norm = re.sub(r'[-\s]+', ' ', college_name.upper().strip())

        # Get relevant college pools based on course type
        college_pools = self._get_college_pools(course_type)

        for pool_name in college_pools:
            if pool_name not in self._college_cache:
                continue

            for college_id, college_data in self._college_cache[pool_name].items():
                master_norm = re.sub(r'[-\s]+', ' ', college_data['name'].upper().strip())

                # Check for exact match FIRST
                if college_norm == master_norm:
                    exact_candidates.append((college_data, 1.0))  # Perfect score for exact match
                else:
                    # Fuzzy match college name
                    matcher = SequenceMatcher(None, college_norm, master_norm)
                    similarity = matcher.ratio()

                    # Accept if similarity >= 0.70
                    if similarity >= 0.70:
                        fuzzy_candidates.append((college_data, similarity))

        # CRITICAL: Exact matches come first, then fuzzy matches
        # This ensures "MAX SMART" exact match beats "MAX SUPER" fuzzy match
        exact_candidates.sort(key=lambda x: x[1], reverse=True)
        fuzzy_candidates.sort(key=lambda x: x[1], reverse=True)
        
        all_candidates = exact_candidates + fuzzy_candidates

        return [c[0] for c in all_candidates]

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

    def match_unmatched_record(self,
                               college_name: str,
                               state: str,
                               address: str,
                               course_type: str = None) -> Tuple[Optional[Dict], float, str]:
        """
        Main matching function for Pass 5E using NER with STREAM FILTERING.

        Algorithm:
        1. Filter colleges by course_type (MEDICAL, DENTAL, DNB)
        2. Extract entities from unmatched address
        3. Find candidates by fuzzy college name match
        4. For each candidate, extract master address entities
        5. Match entity-by-entity:
           - ORG match (college name): weight 0.5
           - LOC match (state/city): weight 0.5
        6. Accept if combined confidence >= 0.70

        Args:
            college_name: College name from unmatched record
            state: State from unmatched record
            address: Address from unmatched record
            course_type: Course type for STREAM FILTERING (MEDICAL, DENTAL, DNB)

        Returns:
            (matched_college, confidence, method) tuple
        """
        logger.debug(f"Pass 5E: Processing {college_name} in {state}, course_type: {course_type}")

        # Step 1: Extract entities from unmatched record
        unmatched_entities = self._extract_entities_ner(address)
        logger.debug(f"Pass 5E: Unmatched entities - Orgs: {unmatched_entities['organizations']}, "
                    f"Locs: {unmatched_entities['locations']}")

        # Step 2: Find candidates by college name with STREAM FILTERING
        candidates = self._find_candidates_by_name(college_name, course_type)

        if not candidates:
            logger.debug(f"Pass 5E: No candidates found for {college_name}")
            return None, 0.0, 'pass5e_no_match'

        # Step 3: Match against each candidate
        best_match = None
        best_confidence = 0.0

        for candidate in candidates:
            # CRITICAL FIX 1: Stream Validation - verify college_type matches course_type
            candidate_type = candidate.get('college_type', '').upper()
            if course_type:
                course_upper = course_type.upper()
                # Map course_type to expected college_type
                expected_types = []
                if 'MEDICAL' in course_upper or 'MBBS' in course_upper:
                    expected_types = ['MEDICAL']
                elif 'DENTAL' in course_upper or 'BDS' in course_upper:
                    expected_types = ['DENTAL']
                elif 'DNB' in course_upper:
                    expected_types = ['DNB']
                
                if expected_types and candidate_type not in expected_types:
                    logger.debug(f"Pass 5E: Stream mismatch - {candidate['name']} is {candidate_type}, expected {expected_types}")
                    continue  # Skip this candidate

            # Extract entities from master address
            master_entities = self._extract_entities_ner(
                f"{candidate['name']} {candidate['address']}"
            )

            # Match organizations (college name)
            org_score = self._match_organization(
                unmatched_entities['organizations'] + [college_name],
                [candidate['name']]
            )

            # Match locations (state/city)
            loc_score = self._match_locations(
                unmatched_entities['locations'] + [state],
                master_entities['locations'] + [candidate['state']]
            )

            # Combined confidence (weighted)
            confidence = (org_score * 0.5) + (loc_score * 0.5)

            # CRITICAL FIX 2: Exact Match Priority
            # If names match exactly (case-insensitive), boost score significantly
            college_norm = re.sub(r'[-\s]+', ' ', college_name.upper().strip())
            candidate_norm = re.sub(r'[-\s]+', ' ', candidate['name'].upper().strip())
            is_exact_match = (college_norm == candidate_norm)
            
            if is_exact_match:
                # Exact match gets confidence boost to 0.95 minimum
                confidence = max(confidence, 0.95)
                logger.debug(f"Pass 5E: EXACT MATCH BOOST - {candidate['name']} (confidence: {confidence:.2f})")

            logger.debug(f"Pass 5E: {candidate['name']} - ORG: {org_score:.2f}, "
                        f"LOC: {loc_score:.2f}, Combined: {confidence:.2f}, Exact: {is_exact_match}")

            # Accept if confidence >= 0.85 AND org_score >= 0.80
            # This prevents generic matches like "DISTRICT HOSPITAL" matching "BISHNUPUR DISTRICT HOSPITAL"
            # EXACT matches take priority due to boosted confidence
            if confidence >= 0.85 and org_score >= 0.80 and confidence > best_confidence:
                best_match = candidate
                best_confidence = confidence

        if best_match:
            logger.debug(f"Pass 5E: Candidate Found '{college_name}' → {best_match['name']} "
                       f"(NER-based, confidence: {best_confidence:.2f})")
            return best_match, best_confidence, 'pass5e_ner_based'

        logger.debug(f"Pass 5E: No match found for {college_name} (confidence < 0.70)")
        return None, 0.0, 'pass5e_no_match'


if __name__ == "__main__":
    # Test the matcher
    matcher = NERBasedMatcher()

    test_cases = [
        {
            'college_name': 'SHER-I-KASHMIR INSTITUTE OF MEDICAL SCIENCES',
            'state': 'JAMMU AND KASHMIR',
            'address': 'PRINCIPAL SKIMS MEDICAL COLLEGE HOSPITAL BEMINA SRINAGAR'
        },
        {
            'college_name': 'GOVT MEDICAL COLLEGE',
            'state': 'RAJASTHAN',
            'address': 'KOTA RAJASTHAN'
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
