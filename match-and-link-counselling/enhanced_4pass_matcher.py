#!/usr/bin/env python3
"""
Enhanced 4-Pass College Matching Algorithm
Optimized implementation that properly utilizes each pass for maximum accuracy
"""

import re
from typing import Dict, List, Tuple, Optional
from rapidfuzz import fuzz, process
from enhanced_normalization import EnhancedNormalizer

class Enhanced4PassMatcher:
    """Enhanced 4-pass college matching algorithm with optimized strategies"""
    
    def __init__(self, master_data, config=None):
        self.master_data = master_data
        self.config = config or self._default_config()
        self.normalizer = EnhancedNormalizer(self.config.get('normalization', {}))
        
        # Cache for performance
        self._state_cache = {}
        self._match_cache = {}
    
    def _default_config(self):
        """Default configuration for matching"""
        return {
            'normalization': {
                'to_uppercase': True,
                'handle_hyphens_dots': True,
                'normalize_whitespace': True,
                'preserve_brackets': True,
                'preserve_commas': True,
                'preserve_slashes': True
            },
            'matching': {
                'exact_threshold': 100,
                'high_threshold': 95,
                'medium_threshold': 85,
                'low_threshold': 75,
                'min_confidence': 70
            },
            'strategies': {
                'try_exact_first': True,
                'use_primary_secondary': True,
                'fuzzy_algorithm': 'WRatio',
                'max_candidates': 10
            }
        }
    
    def match_college(self, record: Dict) -> Dict:
        """
        Enhanced 4-pass college matching algorithm
        
        Args:
            record: Dictionary containing college information
                - college_institute_raw: Raw college name
                - state_raw: Raw state name
                - course_raw: Raw course name
                - quota: Quota type
        
        Returns:
            Dictionary with match results
        """
        # Extract data from record
        raw_college = record.get('college_institute_raw', '')
        raw_state = record.get('state_raw', '')
        raw_course = record.get('course_raw', '')
        
        # Preprocess data
        college_components = self.normalizer.normalize_with_components(raw_college)
        normalized_state = self._normalize_state(raw_state)
        course_type = self._detect_course_type(raw_course)
        
        if not college_components['primary']:
            return self._no_match_result('Empty college name')
        
        # PASS 1: State-based filtering
        state_filtered = self._pass1_state_filtering(course_type, normalized_state)
        
        # PASS 2: Course type filtering (already done above)
        # This is implicit in how we select the college list
        
        # PASS 3: College name matching with multiple strategies
        matches = self._pass3_enhanced_name_matching(
            college_components, 
            state_filtered, 
            course_type
        )
        
        if not matches:
            return self._no_match_result('No matches found')
        
        # Single match - return directly
        if len(matches) == 1:
            match = matches[0]
            if self._validate_course_stream(match['candidate'], course_type, raw_course):
                return self._format_match_result(match)
            return self._no_match_result('Course stream validation failed')
        
        # PASS 4: Address-based disambiguation for multiple matches
        if len(matches) > 1:
            disambiguated = self._pass4_enhanced_disambiguation(
                matches, 
                raw_college, 
                college_components
            )
            
            if disambiguated and self._validate_course_stream(
                disambiguated['candidate'], 
                course_type, 
                raw_course
            ):
                return self._format_match_result(disambiguated)
            
            # If disambiguation fails, return best match
            best_match = max(matches, key=lambda x: x['score'])
            if self._validate_course_stream(
                best_match['candidate'], 
                course_type, 
                raw_course
            ):
                return self._format_match_result(best_match)
        
        return self._no_match_result('No valid matches found')
    
    def _pass1_state_filtering(self, course_type: str, normalized_state: str) -> List[Dict]:
        """
        PASS 1: State-based filtering with fallback strategies
        """
        # Get colleges of the right type
        if course_type not in self.master_data:
            return []
        
        colleges = self.master_data[course_type]['colleges']
        
        # If no state provided, return all colleges
        if not normalized_state:
            return colleges
        
        # Try exact state match first
        state_matches = [
            college for college in colleges
            if college.get('state', '').upper() == normalized_state.upper()
        ]
        
        if state_matches:
            return state_matches
        
        # Try fuzzy state match
        state_names = list(set(college.get('state', '') for college in colleges))
        state_result = process.extractOne(
            normalized_state,
            state_names,
            scorer=fuzz.WRatio
        )
        
        if state_result and state_result[1] >= 85:
            matched_state = state_result[0]
            return [
                college for college in colleges
                if college.get('state', '') == matched_state
            ]
        
        # If no good state match, return all colleges
        return colleges
    
    def _pass3_enhanced_name_matching(
        self, 
        college_components: Dict, 
        candidates: List[Dict], 
        course_type: str
    ) -> List[Dict]:
        """
        PASS 3: Enhanced college name matching with multiple strategies
        """
        if not candidates:
            return []
        
        matches = []
        
        # Strategy 1: Exact match on full name
        if self.config['strategies']['try_exact_first']:
            exact_matches = self._try_exact_match(
                college_components['full'], 
                candidates
            )
            if exact_matches:
                matches.extend(exact_matches)
        
        # Strategy 2: Primary name matching
        if self.config['strategies']['use_primary_secondary']:
            primary_matches = self._try_primary_name_matching(
                college_components['primary'], 
                candidates
            )
            if primary_matches:
                matches.extend(primary_matches)
        
        # Strategy 3: Fuzzy matching on full name
        fuzzy_matches = self._try_fuzzy_matching(
            college_components['full'], 
            candidates
        )
        if fuzzy_matches:
            matches.extend(fuzzy_matches)
        
        # Strategy 4: Secondary name matching (if available)
        if (college_components['has_secondary'] and 
            self.config['strategies']['use_primary_secondary']):
            secondary_matches = self._try_secondary_name_matching(
                college_components['secondary'], 
                candidates
            )
            if secondary_matches:
                matches.extend(secondary_matches)
        
        # Remove duplicates and sort by score
        unique_matches = {}
        for match in matches:
            candidate_id = match['candidate']['id']
            if (candidate_id not in unique_matches or 
                match['score'] > unique_matches[candidate_id]['score']):
                unique_matches[candidate_id] = match
        
        # Sort by score (descending)
        return sorted(unique_matches.values(), key=lambda x: x['score'], reverse=True)
    
    def _try_exact_match(self, college_name: str, candidates: List[Dict]) -> List[Dict]:
        """Try exact matching with conservative normalization"""
        matches = []
        normalized_input = self.normalizer.normalize_for_exact_match(college_name)
        
        for candidate in candidates:
            normalized_candidate = self.normalizer.normalize_for_exact_match(
                candidate.get('name', '')
            )
            
            if normalized_input == normalized_candidate:
                matches.append({
                    'candidate': candidate,
                    'score': 100,
                    'method': 'exact_match'
                })
        
        return matches
    
    def _try_primary_name_matching(self, primary_name: str, candidates: List[Dict]) -> List[Dict]:
        """Try matching on primary name only"""
        matches = []
        
        for candidate in candidates:
            candidate_name = candidate.get('name', '')
            candidate_primary = self.normalizer.extract_primary_name(candidate_name)
            
            # Exact match on primary names
            if primary_name == candidate_primary:
                matches.append({
                    'candidate': candidate,
                    'score': 98,
                    'method': 'primary_exact'
                })
            else:
                # Fuzzy match on primary names
                score = fuzz.WRatio(primary_name, candidate_primary)
                if score >= self.config['matching']['high_threshold']:
                    matches.append({
                        'candidate': candidate,
                        'score': score,
                        'method': 'primary_fuzzy'
                    })
        
        return matches
    
    def _try_fuzzy_matching(self, college_name: str, candidates: List[Dict]) -> List[Dict]:
        """Try fuzzy matching on full name"""
        matches = []
        
        # Get fuzzy matches
        candidate_names = [c.get('name', '') for c in candidates]
        results = process.extract(
            college_name,
            candidate_names,
            scorer=fuzz.WRatio,
            limit=self.config['strategies']['max_candidates']
        )
        
        for name, score, idx in results:
            if score >= self.config['matching']['medium_threshold']:
                matches.append({
                    'candidate': candidates[idx],
                    'score': score,
                    'method': 'fuzzy_match'
                })
        
        return matches
    
    def _try_secondary_name_matching(self, secondary_name: str, candidates: List[Dict]) -> List[Dict]:
        """Try matching on secondary name (in brackets)"""
        matches = []
        
        for candidate in candidates:
            candidate_name = candidate.get('name', '')
            candidate_secondary = self.normalizer.extract_secondary_name(candidate_name)
            
            if candidate_secondary:
                # Exact match on secondary names
                if secondary_name == candidate_secondary:
                    matches.append({
                        'candidate': candidate,
                        'score': 95,
                        'method': 'secondary_exact'
                    })
                else:
                    # Fuzzy match on secondary names
                    score = fuzz.WRatio(secondary_name, candidate_secondary)
                    if score >= self.config['matching']['medium_threshold']:
                        matches.append({
                            'candidate': candidate,
                            'score': score,
                            'method': 'secondary_fuzzy'
                        })
        
        return matches
    
    def _pass4_enhanced_disambiguation(
        self, 
        matches: List[Dict], 
        raw_college: str, 
        college_components: Dict
    ) -> Optional[Dict]:
        """
        PASS 4: Enhanced address-based disambiguation
        """
        # If we have a very high confidence match, return it
        high_confidence = [
            m for m in matches 
            if m['score'] >= self.config['matching']['high_threshold']
        ]
        
        if len(high_confidence) == 1:
            return high_confidence[0]
        
        # Try to extract location information from raw college name
        location_keywords = self._extract_location_keywords(raw_college)
        
        if location_keywords:
            # Score matches based on location keywords
            scored_matches = []
            for match in matches:
                candidate_name = match['candidate'].get('name', '').upper()
                location_score = sum(
                    5 for keyword in location_keywords
                    if keyword in candidate_name
                )
                
                scored_match = match.copy()
                scored_match['score'] += location_score
                scored_matches.append(scored_match)
            
            # Return match with highest location score
            if scored_matches:
                best_match = max(scored_matches, key=lambda x: x['score'])
                if best_match['score'] >= self.config['matching']['high_threshold']:
                    return best_match
        
        # If all else fails, return the highest scoring match
        return max(matches, key=lambda x: x['score'])
    
    def _extract_location_keywords(self, text: str) -> List[str]:
        """Extract potential location keywords from college name"""
        # Common location indicators
        location_indicators = [
            'DELHI', 'MUMBAI', 'BANGALORE', 'CHENNAI', 'KOLKATA', 'HYDERABAD',
            'PUNE', 'AHMEDABAD', 'JAIPUR', 'LUCKNOW', 'KANPUR', 'NAGPUR',
            'INDORE', 'THANE', 'BHOPAL', 'VISAKHAPATNAM', 'PATNA', 'VADODARA',
            'AGRA', 'NASHIK', 'FARIDABAD', 'MEERUT', 'RAJKOT', 'KOLHAPUR',
            'VAPI', 'SOLAPUR', 'RANCHI', 'COIMBATORE', 'KOZHIKODE',
            'TRIVANDRUM', 'GUWAHATI', 'HUBLI', 'DHARWAD', 'RAIPUR',
            'TRICHY', 'JALANDHAR', 'TIRUPUR', 'GURGAON', 'NOIDA',
            'VIJAYAWADA', 'MADURAI', 'RAJKOT', 'WARANGAL'
        ]
        
        text_upper = text.upper()
        return [loc for loc in location_indicators if loc in text_upper]
    
    def _normalize_state(self, raw_state: str) -> str:
        """Normalize state name"""
        if not raw_state:
            return ''
        
        # Remove pin codes (6 digits)
        state = re.sub(r'\b\d{6}\b', '', str(raw_state))
        
        # Normalize whitespace
        state = re.sub(r'\s+', ' ', state).strip()
        
        return state.upper()
    
    def _detect_course_type(self, course_name: str) -> str:
        """Detect course type from course name"""
        if not course_name:
            return 'unknown'
        
        course_upper = course_name.upper()
        
        # DNB patterns (most specific)
        if any(pattern in course_upper for pattern in ['DNB-', 'DNB ']):
            return 'dnb'
        
        # Dental patterns
        if any(pattern in course_upper for pattern in ['BDS', 'MDS', 'PG DIPLOMA', 'DENTAL']):
            return 'dental'
        
        # Medical patterns (includes DIPLOMA)
        if any(pattern in course_upper for pattern in [
            'MBBS', 'MD', 'MS', 'MD/MS', 'MPH', 'DIPLOMA', 
            'POST MBBS', 'DM', 'MCH', 'ALL PG COURSES'
        ]):
            return 'medical'
        
        return 'unknown'
    
    def _validate_course_stream(self, candidate: Dict, course_type: str, course_name: str) -> bool:
        """Validate that the candidate college offers the course type"""
        # For now, assume all colleges can offer all course types
        # This can be enhanced with actual course offerings data
        return True
    
    def _format_match_result(self, match: Dict) -> Dict:
        """Format the match result"""
        return {
            'college_id': match['candidate'].get('id'),
            'college_name': match['candidate'].get('name'),
            'state': match['candidate'].get('state'),
            'confidence': match['score'],
            'method': match['method'],
            'is_matched': True
        }
    
    def _no_match_result(self, reason: str) -> Dict:
        """Return a no-match result with reason"""
        return {
            'college_id': None,
            'college_name': None,
            'state': None,
            'confidence': 0,
            'method': reason,
            'is_matched': False
        }

# Example usage
if __name__ == "__main__":
    # This would be initialized with actual master data
    matcher = Enhanced4PassMatcher({})
    
    # Example record
    test_record = {
        'college_institute_raw': 'GOVT. MEDICAL COLLEGE, KOTTAYAM',
        'state_raw': 'KERALA',
        'course_raw': 'MD GENERAL MEDICINE'
    }
    
    result = matcher.match_college(test_record)
    print("Match Result:", result)
