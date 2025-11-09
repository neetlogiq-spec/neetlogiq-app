#!/usr/bin/env python3
"""
Stage 2: Fuzzy Matching Fallback
For records unmatched in Stage 1, use RapidFuzz for fuzzy name/address matching.

Algorithm:
1. Get unmatched records from seat_data/counselling_data
2. Load candidate colleges from master_data
3. For each unmatched record:
   - Find candidates with same state and course
   - Use RapidFuzz token_set_ratio for fuzzy name matching
   - Validate address similarity
   - Update master_college_id if match found
"""

import logging
import time
import pandas as pd
from typing import Dict, List, Optional
from rapidfuzz import fuzz
from .base_matcher import BaseMatcher
from lib.database import PostgreSQLManager

logger = logging.getLogger(__name__)


class Stage2FuzzyMatcher(BaseMatcher):
    """Fuzzy matching fallback for Stage 1 unmatched records (Stage 2)"""

    def __init__(
        self,
        seat_db: PostgreSQLManager,
        master_db: PostgreSQLManager,
        config: Dict = None
    ):
        """
        Initialize Stage 2 fuzzy matcher.

        Args:
            seat_db: PostgreSQLManager for seat_data database
            master_db: PostgreSQLManager for master_data database
            config: Configuration dictionary
        """
        super().__init__(config)
        self.seat_db = seat_db
        self.master_db = master_db
        self.stage = 2
        self.name = "Stage2-Fuzzy"

        # Get thresholds from config
        self.name_threshold = self.config.get('stage2', {}).get('name_threshold', 80)
        self.address_threshold = self.config.get('stage2', {}).get('address_threshold', 75)

        logger.info(f"Stage 2 Config: name_threshold={self.name_threshold}, address_threshold={self.address_threshold}")

    def match(self, table_name: str = 'seat_data') -> Dict:
        """
        Execute Stage 2 fuzzy matching on unmatched records.

        Args:
            table_name: Name of table to match

        Returns:
            Dictionary with matching statistics
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"STAGE 2: Fuzzy Matching Fallback")
        logger.info(f"Table: {table_name}")
        logger.info(f"{'='*100}\n")

        start_time = time.time()

        # Get unmatched records
        unmatched_df = self._get_unmatched_records(table_name)

        if unmatched_df.empty:
            logger.info("No unmatched records for Stage 2")
            return {
                'stage': 2,
                'name': self.name,
                'stage2_matched': 0,
                'execution_time': 0
            }

        logger.info(f"Processing {len(unmatched_df):,} unmatched records...")

        # Load candidates from master
        candidates_df = self._get_candidates()

        # Perform fuzzy matching
        matched_count = self._fuzzy_match_records(table_name, unmatched_df, candidates_df)

        execution_time = time.time() - start_time

        # Get updated counts
        total = self._count_total(table_name)
        unmatched_after = self._count_unmatched(table_name)
        total_matched = total - unmatched_after
        accuracy = (total_matched / total * 100) if total > 0 else 0

        result = {
            'stage': 2,
            'name': self.name,
            'stage2_matched': matched_count,
            'total_matched': total_matched,
            'unmatched': unmatched_after,
            'accuracy': accuracy,
            'execution_time': execution_time
        }

        logger.info(f"\n✓ Stage 2 Results:")
        logger.info(f"  • New matches this stage: {matched_count:,}")
        logger.info(f"  • Total matched: {total_matched:,} ({accuracy:.2f}%)")
        logger.info(f"  • Still unmatched: {unmatched_after:,}")
        logger.info(f"  • Execution time: {execution_time:.1f}s\n")

        return result

    def _get_unmatched_records(self, table_name: str) -> pd.DataFrame:
        """Get unmatched records from seat_data"""
        sql = f"""
        SELECT id, normalized_college_name, normalized_address,
               master_state_id, master_course_id
        FROM {table_name}
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND master_course_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
        LIMIT 10000
        """

        try:
            # Using pandas for easier data manipulation
            df = pd.read_sql(sql, self.seat_db.connection_pool.getconn())
            return df
        except Exception as e:
            logger.error(f"Error getting unmatched records: {e}")
            return pd.DataFrame()

    def _get_candidates(self) -> pd.DataFrame:
        """Get candidate colleges from master_data"""
        sql = """
        SELECT c.id, c.normalized_name, scl.address, scl.state_id,
               sccl.course_id
        FROM colleges c
        JOIN state_college_link scl ON c.id = scl.college_id
        JOIN state_course_college_link sccl ON c.id = sccl.college_id
             AND scl.state_id = sccl.state_id
        """

        try:
            conn = self.master_db.connection_pool.getconn()
            df = pd.read_sql(sql, conn)
            return df
        except Exception as e:
            logger.error(f"Error getting candidates: {e}")
            return pd.DataFrame()

    def _fuzzy_match_records(
        self,
        table_name: str,
        unmatched_df: pd.DataFrame,
        candidates_df: pd.DataFrame
    ) -> int:
        """
        Perform fuzzy matching for unmatched records.

        Returns:
            Number of records matched
        """
        matched_count = 0

        for idx, row in unmatched_df.iterrows():
            # Filter candidates by state and course
            state_course_matches = candidates_df[
                (candidates_df['state_id'] == row['master_state_id']) &
                (candidates_df['course_id'] == row['master_course_id'])
            ]

            if state_course_matches.empty:
                continue

            # Get unique college names for fuzzy matching
            candidate_names = state_course_matches['normalized_name'].unique()

            # Find best fuzzy name match
            best_match = self._find_best_fuzzy_match(
                row['normalized_college_name'],
                candidate_names
            )

            if best_match is None:
                continue

            matched_colleges = state_course_matches[
                state_course_matches['normalized_name'] == best_match['name']
            ]

            # Try to match by address
            for _, college in matched_colleges.iterrows():
                addr_sim = self._calculate_address_similarity(
                    row['normalized_address'],
                    college['address']
                )

                if addr_sim >= self.address_threshold:
                    # Update record in database
                    self._update_record(table_name, row['id'], college['id'])
                    matched_count += 1
                    break

        logger.info(f"Stage 2 fuzzy matched {matched_count} records")
        return matched_count

    def _find_best_fuzzy_match(self, name: str, candidates: List[str]) -> Optional[Dict]:
        """Find best fuzzy match using RapidFuzz"""
        if not candidates or not name:
            return None

        # Use token_set_ratio for flexible matching
        scores = [
            (candidate, fuzz.token_set_ratio(name, candidate))
            for candidate in candidates
        ]

        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)

        best_name, best_score = scores[0]

        if best_score >= self.name_threshold:
            return {'name': best_name, 'score': best_score}

        return None

    def _calculate_address_similarity(self, addr1: Optional[str], addr2: Optional[str]) -> float:
        """Calculate address similarity score"""
        if not addr1 or not addr2:
            return 100.0  # Consider match if either address is missing

        # Use token_set_ratio for address matching
        score = fuzz.token_set_ratio(
            str(addr1).upper(),
            str(addr2).upper()
        )

        return score

    def _update_record(self, table_name: str, record_id: int, college_id: int):
        """Update record with matched college_id"""
        sql = f"""
        UPDATE {table_name}
        SET master_college_id = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """

        try:
            self.seat_db.execute_query(sql, (college_id, record_id))
        except Exception as e:
            logger.warning(f"Error updating record {record_id}: {e}")

    def _count_total(self, table_name: str) -> int:
        """Count total records"""
        result = self.seat_db.fetch_one(f"SELECT COUNT(*) FROM {table_name}")
        return result[0] if result else 0

    def _count_unmatched(self, table_name: str) -> int:
        """Count unmatched records"""
        sql = f"""
        SELECT COUNT(*) FROM {table_name}
        WHERE master_college_id IS NULL
        """
        result = self.seat_db.fetch_one(sql)
        return result[0] if result else 0
