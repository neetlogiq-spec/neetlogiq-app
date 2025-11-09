#!/usr/bin/env python3
"""
Matcher Pipeline
Orchestrates all matching stages and handles validation.

Pipeline Flow:
1. Stage 1: Hierarchical SQL matching
2. Stage 2: Fuzzy matching fallback
3. Stage 3: Semantic matching (optional)
4. Validation: Remove false matches
5. Report: Generate statistics
"""

import logging
import time
from typing import Dict, Optional
from datetime import datetime
from .stage1_hierarchical import Stage1HierarchicalMatcher
from .stage2_fuzzy import Stage2FuzzyMatcher
from lib.database import PostgreSQLManager

logger = logging.getLogger(__name__)


class MatcherPipeline:
    """Orchestrates the complete matching pipeline"""

    def __init__(
        self,
        seat_db: PostgreSQLManager,
        master_db: PostgreSQLManager,
        config: Dict = None
    ):
        """
        Initialize matcher pipeline.

        Args:
            seat_db: PostgreSQLManager for seat_data
            master_db: PostgreSQLManager for master_data
            config: Configuration dictionary
        """
        self.seat_db = seat_db
        self.master_db = master_db
        self.config = config or {}

        # Initialize matchers
        self.stage1 = Stage1HierarchicalMatcher(seat_db, config)
        self.stage2 = Stage2FuzzyMatcher(seat_db, master_db, config)

        self.results = {}

    def run(self, table_name: str = 'seat_data', validate: bool = True) -> Dict:
        """
        Execute complete matching pipeline.

        Args:
            table_name: Table to match (seat_data or counselling_data)
            validate: Whether to run validation after matching

        Returns:
            Complete results dictionary
        """
        print("\n" + "="*120)
        print("🎯 MATCHING PIPELINE: PostgreSQL Native Matching")
        print(f"Table: {table_name}")
        print("="*120 + "\n")

        pipeline_start = time.time()

        # Get initial counts
        total = self._count_total(table_name)
        initial_unmatched = self._count_unmatched(table_name)

        logger.info(f"Starting matching pipeline:")
        logger.info(f"  • Total records: {total:,}")
        logger.info(f"  • Unmatched: {initial_unmatched:,}\n")

        # Stage 1: Hierarchical SQL Matching
        if self.config.get('stage1', {}).get('enabled', True):
            self.results['stage1'] = self.stage1.match(table_name)
        else:
            logger.info("Stage 1 disabled")

        # Stage 2: Fuzzy Matching
        if self.config.get('stage2', {}).get('enabled', True):
            self.results['stage2'] = self.stage2.match(table_name)
        else:
            logger.info("Stage 2 disabled")

        # Validation
        if validate:
            false_matches = self._validate_matches(table_name)
            self.results['validation'] = {
                'false_matches_found': false_matches,
                'false_matches_cleared': false_matches
            }
        else:
            logger.info("Validation skipped")

        # Final statistics
        final_matched = self._count_matched(table_name)
        final_unmatched = self._count_unmatched(table_name)
        final_accuracy = (final_matched / total * 100) if total > 0 else 0

        pipeline_time = time.time() - pipeline_start

        # Compile final results
        final_results = {
            'table': table_name,
            'timestamp': datetime.now().isoformat(),
            'total_records': total,
            'initial_unmatched': initial_unmatched,
            'final_matched': final_matched,
            'final_unmatched': final_unmatched,
            'accuracy': final_accuracy,
            'execution_time': pipeline_time,
            'stages': self.results
        }

        # Print summary
        self._print_summary(final_results)

        return final_results

    def _count_total(self, table_name: str) -> int:
        """Count total records"""
        result = self.seat_db.fetch_one(f"SELECT COUNT(*) FROM {table_name}")
        return result[0] if result else 0

    def _count_matched(self, table_name: str) -> int:
        """Count matched records"""
        sql = f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL"
        result = self.seat_db.fetch_one(sql)
        return result[0] if result else 0

    def _count_unmatched(self, table_name: str) -> int:
        """Count unmatched records"""
        sql = f"""
        SELECT COUNT(*) FROM {table_name}
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND master_course_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
        """
        result = self.seat_db.fetch_one(sql)
        return result[0] if result else 0

    def _validate_matches(self, table_name: str) -> int:
        """
        Validate matches - remove college matches that don't exist in assigned state.

        Returns:
            Number of false matches cleared
        """
        logger.info("\n" + "="*120)
        logger.info("VALIDATION: Checking for false matches")
        logger.info("="*120 + "\n")

        # Find false matches
        sql = f"""
        SELECT COUNT(*) FROM {table_name}
        WHERE master_college_id IS NOT NULL
          AND master_state_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM state_college_link
            WHERE college_id = {table_name}.master_college_id
              AND state_id = {table_name}.master_state_id
          )
        """

        result = self.seat_db.fetch_one(sql)
        false_count = result[0] if result else 0

        if false_count > 0:
            logger.warning(f"Found {false_count} false matches - clearing them")

            # Clear false matches
            clear_sql = f"""
            UPDATE {table_name}
            SET master_college_id = NULL
            WHERE master_college_id IS NOT NULL
              AND master_state_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM state_college_link
                WHERE college_id = {table_name}.master_college_id
                  AND state_id = {table_name}.master_state_id
              )
            """

            try:
                self.seat_db.execute_query(clear_sql)
                logger.info(f"✓ Cleared {false_count} false matches")
            except Exception as e:
                logger.error(f"Error clearing false matches: {e}")

        else:
            logger.info("✓ No false matches found")

        return false_count

    def _print_summary(self, results: Dict):
        """Print final summary report"""
        print("\n" + "="*120)
        print("📊 FINAL RESULTS SUMMARY")
        print("="*120)
        print(f"\nTable: {results['table']}")
        print(f"Total Records: {results['total_records']:,}")
        print(f"\nMatching Results:")
        print(f"  ✅ Matched: {results['final_matched']:,} ({results['accuracy']:.2f}%)")
        print(f"  ⏳ Unmatched: {results['final_unmatched']:,}")
        print(f"\nPerformance:")
        print(f"  ⏱️  Total Time: {results['execution_time']:.1f}s")

        print(f"\nStage Breakdown:")
        for stage_name, stage_result in results['stages'].items():
            if isinstance(stage_result, dict):
                if 'stage' in stage_result:
                    print(f"  {stage_name.upper()}: {stage_result.get('stage2_matched', stage_result.get('stage1_matched', 0)):,} matches "
                          f"({stage_result.get('execution_time', 0):.1f}s)")

        print(f"\nValidation:")
        if 'validation' in results['stages']:
            validation = results['stages']['validation']
            print(f"  False Matches Cleared: {validation.get('false_matches_cleared', 0)}")

        print("\n" + "="*120 + "\n")

    def get_results(self) -> Dict:
        """Get last run results"""
        return self.results
