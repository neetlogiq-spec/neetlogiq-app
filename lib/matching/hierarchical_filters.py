#!/usr/bin/env python3
"""
Hierarchical Filters
Core filtering logic for cascading hierarchical matching.

Implements the hierarchy:
  STATE (2,443 → ~240)
    ↓
  STREAM/COURSE (240 → ~47)
    ↓
  COLLEGE NAME (47 → ~4)
    ↓
  ADDRESS (4 → 1)
"""

import logging
import pandas as pd
import numpy as np
from typing import Optional, List, Callable
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


class HierarchicalFilters:
    """Implements hierarchical narrowing filters"""

    def __init__(self, config: dict = None):
        """Initialize filters with configuration"""
        self.config = config or {}

    # ============================================================================
    # LEVEL 1: STATE FILTERING
    # ============================================================================

    def filter_by_state(
        self,
        colleges_df: pd.DataFrame,
        state_id: str
    ) -> pd.DataFrame:
        """
        LEVEL 1: STATE filter
        Narrows from 2,443 colleges to ~240 in the target state.

        Args:
            colleges_df: Master colleges dataframe
            state_id: State ID to filter by

        Returns:
            Colleges in the specified state
        """
        if colleges_df.empty or not state_id:
            return colleges_df.iloc[:0]

        filtered = colleges_df[colleges_df['state_id'] == state_id]
        logger.debug(f"STATE filter: {len(colleges_df)} → {len(filtered)} colleges in {state_id}")

        return filtered

    # ============================================================================
    # LEVEL 2: STREAM/COURSE FILTERING
    # ============================================================================

    def filter_by_stream(
        self,
        colleges_df: pd.DataFrame,
        stream: str
    ) -> pd.DataFrame:
        """
        LEVEL 2: STREAM filter
        Narrows from ~240 to ~47 colleges offering the required stream/type.

        Args:
            colleges_df: Filtered colleges dataframe
            stream: Stream/type (MEDICAL, DENTAL, DNB, ENGINEERING, etc.)

        Returns:
            Colleges offering the specified stream
        """
        if colleges_df.empty or not stream:
            return colleges_df.iloc[:0]

        # Normalize stream for comparison
        stream_upper = stream.upper().strip()

        filtered = colleges_df[
            colleges_df['stream'].str.upper() == stream_upper
        ]

        logger.debug(f"STREAM filter: {len(colleges_df)} → {len(filtered)} colleges offering {stream}")

        return filtered

    def filter_by_course(
        self,
        colleges_df: pd.DataFrame,
        state_id: str,
        course_id: str,
        course_availability_df: Optional[pd.DataFrame] = None
    ) -> pd.DataFrame:
        """
        LEVEL 2: COURSE filter
        Verifies course is offered in state+stream+college combination.

        Args:
            colleges_df: Filtered colleges dataframe
            state_id: State ID
            course_id: Course ID
            course_availability_df: Available courses per state/college combo

        Returns:
            Colleges offering the specified course
        """
        if colleges_df.empty or not course_id:
            return colleges_df.iloc[:0]

        if course_availability_df is None:
            # If no availability data, return all (fallback)
            return colleges_df

        # Filter to colleges that have this course in this state
        available = course_availability_df[
            (course_availability_df['state_id'] == state_id) &
            (course_availability_df['course_id'] == course_id)
        ]['college_id'].unique()

        filtered = colleges_df[colleges_df['college_id'].isin(available)]

        logger.debug(f"COURSE filter: {len(colleges_df)} → {len(filtered)} colleges offering {course_id} in {state_id}")

        return filtered

    # ============================================================================
    # LEVEL 3: COLLEGE NAME FILTERING (with Composite Key Disambiguation)
    # ============================================================================

    def filter_by_college_name(
        self,
        colleges_df: pd.DataFrame,
        input_name: str,
        fallback_method: Optional[str] = None,
        name_threshold: int = 80
    ) -> pd.DataFrame:
        """
        LEVEL 3: COLLEGE NAME filter
        Narrows from ~47 to ~4 colleges with matching names.
        Uses composite key (COLLEGE_NAME, ADDRESS format) to disambiguate colleges with identical names.

        Attempts (in order):
        1. Composite key match (name + address) - disambiguates identical college names
        2. Exact match on normalized_name
        3. Fuzzy match (85%+)
        4. RapidFuzz fallback (if fallback_method='rapidfuzz')
        5. Transformer fallback (if fallback_method='ensemble')

        Args:
            colleges_df: Filtered colleges dataframe
            input_name: Input college composite key (format: COLLEGE_NAME, ADDRESS)
            fallback_method: None (stage1), 'rapidfuzz' (stage2), 'ensemble' (stage3)
            name_threshold: RapidFuzz threshold (80-90)

        Returns:
            Colleges matching the name
        """
        if colleges_df.empty or not input_name:
            return colleges_df.iloc[:0]

        input_name = input_name.strip().upper()

        # ===== ATTEMPT 1: Composite key match (COLLEGE_NAME, ADDRESS) =====
        # If input has composite key format, use it to narrow down
        if ',' in input_name and 'composite_key' in colleges_df.columns:
            # Extract address part from input (after comma)
            input_parts = input_name.split(',', 1)
            input_college_name = input_parts[0].strip().upper() if len(input_parts) > 0 else ''
            input_address_part = input_parts[1].strip().upper() if len(input_parts) > 1 else ''

            # Find colleges where composite_key contains both college name and address part
            if input_address_part:
                composite_match = colleges_df[
                    (colleges_df['composite_key'].str.upper().str.contains(input_college_name, na=False)) &
                    (colleges_df['composite_key'].str.upper().str.contains(input_address_part, na=False))
                ]
                if not composite_match.empty:
                    logger.debug(f"NAME filter: Composite key match found {len(composite_match)} colleges")
                    return composite_match

        # ===== ATTEMPT 2: Exact match on normalized_name =====
        exact = colleges_df[
            colleges_df['normalized_name'].str.upper() == input_name
        ]
        if not exact.empty:
            logger.debug(f"NAME filter: Exact match on normalized_name found {len(exact)} colleges")
            return exact

        # ===== ATTEMPT 2: Fuzzy match 85%+ (all stages) =====
        fuzzy = colleges_df[
            colleges_df['normalized_name'].apply(
                lambda x: fuzz.ratio(input_name, x.upper()) >= 85
            )
        ]
        if not fuzzy.empty:
            logger.debug(f"NAME filter: Fuzzy match found {len(fuzzy)} colleges")
            return fuzzy

        # ===== ATTEMPT 3: RapidFuzz fallback (stage 2+) =====
        if fallback_method in ('rapidfuzz', 'ensemble'):
            rapidfuzz_matches = colleges_df[
                colleges_df['normalized_name'].apply(
                    lambda x: fuzz.token_set_ratio(input_name, x.upper()) >= name_threshold
                )
            ]
            if not rapidfuzz_matches.empty:
                logger.debug(f"NAME filter: RapidFuzz fallback found {len(rapidfuzz_matches)} colleges")
                return rapidfuzz_matches

        # ===== ATTEMPT 4: TF-IDF fallback (stage 3 only) =====
        if fallback_method == 'ensemble':
            tfidf_matches = self.tfidf_match_college_name(
                colleges_df,
                input_name,
                threshold=0.35  # Further lowered for better recall
            )
            if not tfidf_matches.empty:
                logger.debug(f"NAME filter: TF-IDF fallback found {len(tfidf_matches)} colleges")
                return tfidf_matches

        # No match found
        logger.debug(f"NAME filter: No match found for '{input_name}'")
        return colleges_df.iloc[:0]

    # ============================================================================
    # LEVEL 4: ADDRESS FILTERING
    # ============================================================================

    def filter_by_address(
        self,
        colleges_df: pd.DataFrame,
        input_address: str,
        fallback_method: Optional[str] = None,
        address_threshold: int = 75
    ) -> pd.DataFrame:
        """
        LEVEL 4: ADDRESS filter
        Narrows from ~4 to 1 college with matching address (composite key with name).

        Attempts (in order):
        1. Keyword containment (all stages)
        2. RapidFuzz fallback (if fallback_method='rapidfuzz')
        3. TF-IDF fallback (if fallback_method='ensemble')

        Args:
            colleges_df: Filtered colleges dataframe
            input_address: Input address (should be normalized)
            fallback_method: None (stage1), 'rapidfuzz' (stage2), 'ensemble' (stage3)
            address_threshold: RapidFuzz threshold (75)

        Returns:
            Colleges matching the address
        """
        if colleges_df.empty or not input_address:
            # No address to filter by, return all
            return colleges_df

        input_address_upper = input_address.strip().upper()

        # ===== ATTEMPT 1: Keyword containment (all stages) =====
        keyword = colleges_df[
            colleges_df['address'].apply(
                lambda x: input_address_upper in str(x).upper()
                if pd.notna(x) else False
            )
        ]
        if not keyword.empty:
            logger.debug(f"ADDRESS filter: Keyword match found {len(keyword)} colleges")
            return keyword

        # ===== ATTEMPT 2: RapidFuzz fallback (stage 2+) =====
        if fallback_method in ('rapidfuzz', 'ensemble'):
            rapidfuzz = colleges_df[
                colleges_df['address'].apply(
                    lambda x: fuzz.token_set_ratio(input_address_upper, str(x).upper()) >= address_threshold
                    if pd.notna(x) else False
                )
            ]
            if not rapidfuzz.empty:
                logger.debug(f"ADDRESS filter: RapidFuzz fallback found {len(rapidfuzz)} colleges")
                return rapidfuzz

        # ===== ATTEMPT 3: TF-IDF fallback (stage 3 only) =====
        if fallback_method == 'ensemble':
            tfidf = self.tfidf_match_address(
                colleges_df,
                input_address,
                threshold=0.25  # Further lowered for better recall
            )
            if not tfidf.empty:
                logger.debug(f"ADDRESS filter: TF-IDF fallback found {len(tfidf)} colleges")
                return tfidf

        # No address match, but return original set
        # (address is optional - missing address doesn't mean no match)
        logger.debug(f"ADDRESS filter: No address match, returning all {len(colleges_df)} candidates")
        return colleges_df

    # ============================================================================
    # COMBINED HIERARCHICAL MATCHING
    # ============================================================================

    def match_record_hierarchical(
        self,
        record: dict,
        colleges_df: pd.DataFrame,
        course_availability_df: Optional[pd.DataFrame] = None,
        fallback_method: Optional[str] = None
    ) -> Optional[dict]:
        """
        Execute complete hierarchical matching for a single record.

        Args:
            record: Input record with state_id, stream, course_id, college_name, address
            colleges_df: Master colleges dataframe
            course_availability_df: Available courses per college/state
            fallback_method: None (stage1), 'rapidfuzz' (stage2), 'ensemble' (stage3)

        Returns:
            Matched college record or None
        """
        # Load master colleges into memory (if not already)
        if colleges_df.empty:
            return None

        try:
            # LEVEL 1: STATE filter
            state_colleges = self.filter_by_state(
                colleges_df,
                record.get('state_id')
            )
            if state_colleges.empty:
                logger.debug(f"No colleges in state {record.get('state_id')}")
                return None

            # LEVEL 2: STREAM filter
            stream_colleges = self.filter_by_stream(
                state_colleges,
                record.get('stream')
            )
            if stream_colleges.empty:
                logger.debug(f"No {record.get('stream')} colleges in state {record.get('state_id')}")
                return None

            # LEVEL 3: COURSE filter
            course_colleges = self.filter_by_course(
                stream_colleges,
                record.get('state_id'),
                record.get('course_id'),
                course_availability_df
            )
            if course_colleges.empty:
                logger.debug(f"No colleges offering {record.get('course_id')} in state {record.get('state_id')}")
                return None

            # LEVEL 4: COLLEGE NAME filter (using composite key for disambiguation)
            # Use seat_composite_key (COLLEGE_NAME, ADDRESS format) if available
            # This disambiguates colleges with identical names by including address
            college_name_to_match = record.get('seat_composite_key') or record.get('normalized_college_name')

            name_colleges = self.filter_by_college_name(
                course_colleges,
                college_name_to_match,
                fallback_method=fallback_method
            )
            if name_colleges.empty:
                logger.debug(f"No college named '{record.get('normalized_college_name')}'")
                return None

            # LEVEL 5: ADDRESS filter (with fallback if specified)
            address_colleges = self.filter_by_address(
                name_colleges,
                record.get('normalized_address'),
                fallback_method=fallback_method
            )

            if address_colleges.empty:
                # Return first name match if address didn't narrow it down
                return name_colleges.iloc[0].to_dict() if not name_colleges.empty else None

            # Return best address match
            return address_colleges.iloc[0].to_dict()

        except Exception as e:
            logger.error(f"Error matching record: {e}")
            return None

    # ============================================================================
    # LEVEL 6: TF-IDF MATCHING (Stage 3 Ensemble Fallback)
    # ============================================================================

    def tfidf_match_college_name(
        self,
        colleges_df: pd.DataFrame,
        input_name: str,
        threshold: float = 0.6
    ) -> pd.DataFrame:
        """
        TF-IDF based college name matching.
        Uses Term Frequency-Inverse Document Frequency similarity.

        Args:
            colleges_df: Candidate colleges dataframe
            input_name: Input college name to match
            threshold: Similarity threshold (0.0-1.0)

        Returns:
            Colleges with TF-IDF similarity above threshold, sorted by similarity
        """
        if colleges_df.empty or not input_name:
            return colleges_df.iloc[:0]

        try:
            # Get college names
            college_names = colleges_df['normalized_name'].fillna('').tolist()
            if not college_names:
                return colleges_df.iloc[:0]

            # Create TF-IDF vectorizer with character-level n-grams
            vectorizer = TfidfVectorizer(
                analyzer='char',
                ngram_range=(2, 3),
                lowercase=True,
                min_df=1
            )

            # Fit on all colleges + input
            all_texts = college_names + [input_name]
            tfidf_matrix = vectorizer.fit_transform(all_texts)

            # Calculate similarity with input (last row)
            similarities = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1])[0]

            # Filter by threshold
            matches = similarities >= threshold

            if not matches.any():
                return colleges_df.iloc[:0]

            # Return matching colleges sorted by similarity (highest first)
            result_df = colleges_df.iloc[matches].copy()
            result_df['tfidf_similarity'] = similarities[matches]
            result_df = result_df.sort_values('tfidf_similarity', ascending=False)

            logger.debug(f"TF-IDF match: {len(result_df)} colleges matched with threshold {threshold}")
            return result_df.drop(columns=['tfidf_similarity'])

        except Exception as e:
            logger.debug(f"Error in TF-IDF matching: {e}")
            return colleges_df.iloc[:0]

    def tfidf_match_address(
        self,
        colleges_df: pd.DataFrame,
        input_address: str,
        threshold: float = 0.5
    ) -> pd.DataFrame:
        """
        TF-IDF based address matching.
        Uses Term Frequency-Inverse Document Frequency similarity for addresses.

        Args:
            colleges_df: Candidate colleges dataframe
            input_address: Input address to match
            threshold: Similarity threshold (0.0-1.0)

        Returns:
            Colleges with TF-IDF address similarity above threshold
        """
        if colleges_df.empty or not input_address:
            return colleges_df.iloc[:0]

        try:
            # Get addresses
            addresses = colleges_df['address'].fillna('').tolist()
            if not addresses:
                return colleges_df.iloc[:0]

            # Create TF-IDF vectorizer with word-level n-grams
            vectorizer = TfidfVectorizer(
                analyzer='word',
                ngram_range=(1, 2),
                lowercase=True,
                min_df=1,
                stop_words='english'
            )

            # Fit on all addresses + input
            all_texts = addresses + [input_address]
            tfidf_matrix = vectorizer.fit_transform(all_texts)

            # Calculate similarity with input (last row)
            similarities = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1])[0]

            # Filter by threshold
            matches = similarities >= threshold

            if not matches.any():
                return colleges_df.iloc[:0]

            # Return matching colleges sorted by similarity (highest first)
            result_df = colleges_df.iloc[matches].copy()
            result_df['tfidf_similarity'] = similarities[matches]
            result_df = result_df.sort_values('tfidf_similarity', ascending=False)

            logger.debug(f"TF-IDF address match: {len(result_df)} colleges matched with threshold {threshold}")
            return result_df.drop(columns=['tfidf_similarity'])

        except Exception as e:
            logger.debug(f"Error in TF-IDF address matching: {e}")
            return colleges_df.iloc[:0]

    # ============================================================================
    # STATISTICS & DEBUGGING
    # ============================================================================

    def get_filter_stats(self, colleges_df: pd.DataFrame) -> dict:
        """Get statistics about the master colleges data"""
        return {
            'total_colleges': len(colleges_df),
            'unique_states': colleges_df['state_id'].nunique() if 'state_id' in colleges_df else 0,
            'unique_streams': colleges_df['stream'].nunique() if 'stream' in colleges_df else 0,
            'colleges_with_address': colleges_df['address'].notna().sum() if 'address' in colleges_df else 0
        }
