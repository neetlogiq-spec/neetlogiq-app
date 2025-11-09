#!/usr/bin/env python3
"""
Stage 1: Hierarchical SQL Matching
Pure PostgreSQL native matching using hierarchical joins.

Algorithm:
1. Join seat_data with state_college_link (by state)
2. Join with colleges (by normalized name)
3. Verify state-course-college relationship exists
4. Filter by address if available
5. Update master_college_id for matched records
"""

import logging
import time
from typing import Dict, List
from .base_matcher import BaseMatcher, MatchResult
from lib.database import PostgreSQLManager

logger = logging.getLogger(__name__)


class Stage1HierarchicalMatcher(BaseMatcher):
    """Hierarchical SQL-based matching (Stage 1)"""

    def __init__(self, db_manager: PostgreSQLManager, config: Dict = None):
        """
        Initialize Stage 1 matcher.

        Args:
            db_manager: PostgreSQLManager instance
            config: Configuration dictionary
        """
        super().__init__(config)
        self.db = db_manager
        self.stage = 1
        self.name = "Stage1-Hierarchical"
        self.use_address_filter = self.config.get('stage1', {}).get('address_filter', True)

    def match(self, table_name: str = 'seat_data') -> Dict:
        """
        Execute Stage 1 hierarchical matching.

        Args:
            table_name: Name of table to match

        Returns:
            Dictionary with matching statistics
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"STAGE 1: Hierarchical SQL Matching")
        logger.info(f"Table: {table_name}")
        logger.info(f"{'='*100}\n")

        start_time = time.time()

        # Count unmatched before
        unmatched_before = self._count_unmatched(table_name)
        logger.info(f"Unmatched records before Stage 1: {unmatched_before:,}")

        # Execute matching SQL
        matched_count = self._execute_stage1_sql(table_name)

        # Count unmatched after
        unmatched_after = self._count_unmatched(table_name)
        stage1_matched = unmatched_before - unmatched_after

        execution_time = time.time() - start_time

        # Calculate statistics
        total = self._count_total(table_name)
        total_matched = total - unmatched_after
        accuracy = (total_matched / total * 100) if total > 0 else 0

        result = {
            'stage': 1,
            'name': self.name,
            'stage1_matched': stage1_matched,
            'stage1_new': matched_count,
            'total_matched': total_matched,
            'unmatched': unmatched_after,
            'accuracy': accuracy,
            'execution_time': execution_time
        }

        logger.info(f"\n✓ Stage 1 Results:")
        logger.info(f"  • New matches this stage: {matched_count:,}")
        logger.info(f"  • Total matched: {total_matched:,} ({accuracy:.2f}%)")
        logger.info(f"  • Still unmatched: {unmatched_after:,}")
        logger.info(f"  • Execution time: {execution_time:.1f}s\n")

        return result

    def _execute_stage1_sql(self, table_name: str) -> int:
        """Execute the Stage 1 SQL matching query"""

        # Build the hierarchical matching SQL
        sql = f"""
        UPDATE {table_name}
        SET master_college_id = subquery.college_id,
            updated_at = CURRENT_TIMESTAMP
        FROM (
            SELECT DISTINCT ON (sd.id)
                sd.id,
                c.id as college_id
            FROM {table_name} sd
            JOIN state_college_link scl
                ON sd.master_state_id = scl.state_id
            JOIN colleges c
                ON c.id = scl.college_id
                AND c.normalized_name = sd.normalized_college_name
            JOIN state_course_college_link sccl
                ON sccl.college_id = c.id
                AND sccl.state_id = sd.master_state_id
                AND sccl.course_id = sd.master_course_id
            WHERE sd.master_state_id IS NOT NULL
              AND sd.master_course_id IS NOT NULL
              AND sd.master_college_id IS NULL
              AND sd.normalized_college_name IS NOT NULL
              {self._get_address_filter_clause(table_name)}
            ORDER BY sd.id, scl.address IS NOT NULL DESC
        ) subquery
        WHERE {table_name}.id = subquery.id
        """

        try:
            logger.info("Executing Stage 1 SQL matching...")
            self.db.execute_query(sql)

            # Get count of matched records
            count_sql = f"""
            SELECT COUNT(*) FROM {table_name}
            WHERE master_college_id IS NOT NULL
            """
            result = self.db.fetch_one(count_sql)
            matched = result[0] if result else 0

            logger.info(f"✓ Stage 1 SQL executed successfully")
            return matched

        except Exception as e:
            logger.error(f"✗ Error executing Stage 1 SQL: {e}")
            raise

    def _get_address_filter_clause(self, table_name: str) -> str:
        """Get WHERE clause for address filtering"""

        if not self.use_address_filter:
            return ""

        # Address filter: allow match if address is NULL or matches
        return f"""
              AND (sd.normalized_address IS NULL
                   OR scl.address IS NULL
                   OR STRPOS(UPPER(scl.address), UPPER(sd.normalized_address)) > 0)
        """

    def _count_total(self, table_name: str) -> int:
        """Count total records in table"""
        result = self.db.fetch_one(f"SELECT COUNT(*) FROM {table_name}")
        return result[0] if result else 0

    def _count_unmatched(self, table_name: str) -> int:
        """Count unmatched records in table"""
        sql = f"""
        SELECT COUNT(*) FROM {table_name}
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND master_course_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
        """
        result = self.db.fetch_one(sql)
        return result[0] if result else 0

    def get_unmatched_sample(self, table_name: str, limit: int = 10) -> List[Dict]:
        """Get sample of unmatched records for debugging"""
        sql = f"""
        SELECT id, normalized_college_name, master_state_id, master_course_id, normalized_address
        FROM {table_name}
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND master_course_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
        LIMIT {limit}
        """

        return self.db.fetch_dict(sql)
