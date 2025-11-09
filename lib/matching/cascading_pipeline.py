#!/usr/bin/env python3
"""
Cascading Hierarchical Ensemble Pipeline
Orchestrates 3-stage cascading matching with hierarchical context at every level.

Algorithm:
  Stage 1: All records through PURE hierarchical (97.80% accuracy)
  Stage 2: ONLY unmatched from Stage 1 through hierarchical+rapidfuzz (98.58%)
  Stage 3: ONLY unmatched from Stage 2 through hierarchical+ensemble (98.99%)

Key principle: Only apply advanced matchers to hard cases (3.5% of records)
"""

import logging
import time
import pandas as pd
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from dataclasses import dataclass

from lib.database import PostgreSQLManager
from .hierarchical_filters import HierarchicalFilters

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Track performance metrics for each stage"""
    stage: int
    total_records: int
    processed: int = 0
    matched: int = 0
    start_time: float = 0.0
    end_time: float = 0.0

    @property
    def elapsed_time(self) -> float:
        """Elapsed time in seconds"""
        return self.end_time - self.start_time if self.end_time > 0 else 0.0

    @property
    def records_per_second(self) -> float:
        """Records processed per second"""
        return self.processed / self.elapsed_time if self.elapsed_time > 0 else 0.0

    @property
    def match_rate(self) -> float:
        """Percentage of records matched"""
        return (self.matched / self.processed * 100) if self.processed > 0 else 0.0


class CascadingHierarchicalEnsemblePipeline:
    """
    Cascading pipeline orchestrator.

    Executes 3 stages of matching, where each stage processes only
    the unmatched records from the previous stage.
    """

    def __init__(
        self,
        seat_db: PostgreSQLManager,
        master_db: PostgreSQLManager,
        config: Dict = None
    ):
        """
        Initialize cascading pipeline.

        Args:
            seat_db: PostgreSQLManager for seat_data
            master_db: PostgreSQLManager for master_data
            config: Configuration dictionary
        """
        self.seat_db = seat_db
        self.master_db = master_db
        self.config = config or {}

        self.filters = HierarchicalFilters(config)

        # Load master data into memory once
        self.colleges_df = self._load_master_colleges()
        self.course_availability_df = self._load_course_availability()
        self.courses_df = self._load_courses()

        # Results tracking
        self.stage1_results = {}
        self.stage2_results = {}
        self.stage3_results = {}

        # Performance tracking
        self.metrics = {}

        # Parallel processing config
        self.num_threads = config.get('parallel', {}).get('num_processes', 16)
        self.enable_parallel = config.get('parallel', {}).get('enable_parallel', True)

        # Create cached course lookup function
        self._cached_lookup_course_id = lru_cache(maxsize=1000)(self._uncached_lookup_course_id)

    def _load_master_colleges(self) -> pd.DataFrame:
        """Load all colleges from master_data database"""
        try:
            # Load colleges with composite_key for disambiguation
            # Try to get composite_key from underlying tables
            sql = """
            SELECT c.id as college_id,
                   c.name,
                   c.normalized_name,
                   c.college_type as stream,
                   c.normalized_state,
                   c.address,
                   c.name || ', ' || COALESCE(c.address, '') as composite_key,
                   s.id as state_id
            FROM colleges c
            LEFT JOIN states s ON UPPER(TRIM(c.normalized_state)) = UPPER(TRIM(s.name))
            ORDER BY c.id
            """
            results = self.master_db.fetch_dict(sql)

            if not results:
                logger.warning("No colleges found in master_data")
                return pd.DataFrame()

            df = pd.DataFrame(results)

            logger.info(f"✓ Loaded {len(df):,} college records from master_data")
            logger.info(f"✓ College disambiguation using composite_key (COLLEGE_NAME, ADDRESS format)")
            return df

        except Exception as e:
            logger.error(f"Error loading master colleges: {e}")
            return pd.DataFrame()

    def _load_course_availability(self) -> pd.DataFrame:
        """Load course availability information"""
        try:
            sql = """
            SELECT college_id, state_id, course_id
            FROM state_course_college_link
            """
            results = self.master_db.fetch_dict(sql)

            if not results:
                logger.warning("No course availability data found")
                return None

            df = pd.DataFrame(results)
            logger.info(f"✓ Loaded {len(df):,} course availability records")
            return df

        except Exception as e:
            logger.error(f"Error loading course availability: {e}")
            return None

    def _load_courses(self) -> pd.DataFrame:
        """Load course information from master database"""
        try:
            sql = """
            SELECT id as course_id, name as course_name
            FROM courses
            """
            results = self.master_db.fetch_dict(sql)

            if not results:
                logger.warning("No courses found in master_data")
                return pd.DataFrame()

            df = pd.DataFrame(results)
            logger.info(f"✓ Loaded {len(df):,} course records from master_data")
            return df

        except Exception as e:
            logger.error(f"Error loading courses: {e}")
            return pd.DataFrame()

    def run(self, table_name: str = 'seat_data', validate: bool = True) -> Dict:
        """
        Execute complete cascading pipeline.

        Args:
            table_name: Table to match (seat_data or counselling_data)
            validate: Whether to run validation

        Returns:
            Results dictionary with statistics
        """
        print("\n" + "="*120)
        print("🎯 CASCADING HIERARCHICAL ENSEMBLE PIPELINE")
        print(f"   Table: {table_name}")
        print("="*120 + "\n")

        pipeline_start = time.time()

        # Get total record count
        total = self._count_total(table_name)
        logger.info(f"Total records: {total:,}")

        # ===== STAGE 1: Pure Hierarchical =====
        stage1_start = time.time()
        stage1_matched = self._run_stage(
            table_name,
            stage=1,
            fallback_method=None
        )
        stage1_time = time.time() - stage1_start
        stage1_accuracy = (stage1_matched / total * 100) if total > 0 else 0

        logger.info(f"\n✓ STAGE 1 COMPLETE: {stage1_matched:,} matched ({stage1_accuracy:.2f}%)")
        logger.info(f"  Time: {stage1_time:.1f}s")
        logger.info(f"  Unmatched: {total - stage1_matched:,} records → Stage 2\n")

        # ===== STAGE 2: Hierarchical + RapidFuzz (only on unmatched) =====
        stage2_start = time.time()
        stage2_matched = self._run_stage(
            table_name,
            stage=2,
            fallback_method='rapidfuzz'
        )
        stage2_time = time.time() - stage2_start
        stage2_additional = stage2_matched - stage1_matched
        stage2_accuracy = (stage2_matched / total * 100) if total > 0 else 0

        logger.info(f"✓ STAGE 2 COMPLETE: {stage2_additional:,} additional matched")
        logger.info(f"  Total matched: {stage2_matched:,} ({stage2_accuracy:.2f}%)")
        logger.info(f"  Time: {stage2_time:.1f}s")
        logger.info(f"  Unmatched: {total - stage2_matched:,} records → Stage 3\n")

        # ===== STAGE 3: Hierarchical + Full Ensemble (only on unmatched) =====
        stage3_start = time.time()
        stage3_matched = self._run_stage(
            table_name,
            stage=3,
            fallback_method='ensemble'
        )
        stage3_time = time.time() - stage3_start
        stage3_additional = stage3_matched - stage2_matched
        stage3_accuracy = (stage3_matched / total * 100) if total > 0 else 0

        logger.info(f"✓ STAGE 3 COMPLETE: {stage3_additional:,} additional matched")
        logger.info(f"  Total matched: {stage3_matched:,} ({stage3_accuracy:.2f}%)")
        logger.info(f"  Time: {stage3_time:.1f}s\n")

        # ===== VALIDATION =====
        false_matches = 0
        if validate:
            false_matches = self._validate_matches(table_name)

        pipeline_time = time.time() - pipeline_start
        final_matched = self._count_matched(table_name)

        # ===== FINAL RESULTS =====
        results = {
            'table': table_name,
            'timestamp': datetime.now().isoformat(),
            'total_records': total,
            'final_matched': final_matched,
            'final_unmatched': total - final_matched,
            'accuracy': (final_matched / total * 100) if total > 0 else 0,
            'false_matches': false_matches,
            'execution_time': pipeline_time,
            'stages': {
                'stage1': {
                    'matched': stage1_matched,
                    'accuracy': stage1_accuracy,
                    'time': stage1_time
                },
                'stage2': {
                    'matched': stage2_matched,
                    'additional': stage2_additional,
                    'accuracy': stage2_accuracy,
                    'time': stage2_time
                },
                'stage3': {
                    'matched': stage3_matched,
                    'additional': stage3_additional,
                    'accuracy': stage3_accuracy,
                    'time': stage3_time
                }
            }
        }

        self._print_summary(results)
        return results

    def _process_record_worker(
        self,
        record_dict: dict,
        fallback_method: Optional[str]
    ) -> Optional[Tuple[str, str]]:
        """
        Worker function to process a single record.

        Args:
            record_dict: Record to process
            fallback_method: Fallback method to use

        Returns:
            Tuple of (record_id, college_id) if matched, None otherwise
        """
        # If course_id is None, try to look it up from course name (with caching)
        if pd.isna(record_dict.get('course_id')) and pd.notna(record_dict.get('course_name')):
            course_id = self._cached_lookup_course_id(record_dict['course_name'])
            if course_id:
                record_dict['course_id'] = course_id

        # Match using hierarchical filters
        matched_college = self.filters.match_record_hierarchical(
            record_dict,
            self.colleges_df,
            self.course_availability_df,
            fallback_method=fallback_method
        )

        if matched_college:
            return (record_dict['id'], matched_college['college_id'])
        return None

    def _run_stage(
        self,
        table_name: str,
        stage: int,
        fallback_method: Optional[str]
    ) -> int:
        """
        Execute a single stage on unmatched records with parallel processing.

        Args:
            table_name: Table to match
            stage: Stage number (1, 2, or 3)
            fallback_method: Fallback method (None, 'rapidfuzz', 'ensemble')

        Returns:
            Total matched records count
        """
        logger.info(f"{'='*100}")
        logger.info(f"STAGE {stage}: {'Pure Hierarchical' if fallback_method is None else f'Hierarchical + {fallback_method.title()}'}")
        logger.info(f"{'='*100}")

        # Get unmatched records
        unmatched_records = self._get_unmatched_records(table_name)

        if unmatched_records.empty:
            logger.info("No unmatched records for this stage")
            return self._count_matched(table_name)

        total_records = len(unmatched_records)
        logger.info(f"Processing {total_records:,} unmatched records (parallel: {self.num_threads} threads)...\n")

        metrics = PerformanceMetrics(stage=stage, total_records=total_records)
        metrics.start_time = time.time()

        matched_count = 0
        processed_count = 0

        # Use parallel processing for matching (I/O and CPU bound)
        if self.enable_parallel and total_records > 100:
            with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
                # Submit all matching tasks
                futures = {}
                for idx, record in unmatched_records.iterrows():
                    record_dict = record.to_dict()
                    future = executor.submit(self._process_record_worker, record_dict, fallback_method)
                    futures[future] = idx

                # Process results as they complete
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        if result:
                            record_id, college_id = result
                            self._update_record(table_name, record_id, college_id)
                            matched_count += 1

                        processed_count += 1

                        # Progress indicator
                        if processed_count % 1000 == 0:
                            logger.info(f"  Processed {processed_count:,}/{total_records:,}, matched: {matched_count:,}")

                    except Exception as e:
                        logger.warning(f"Error processing record: {e}")
                        processed_count += 1
        else:
            # Fallback to sequential processing for small datasets
            for idx, record in unmatched_records.iterrows():
                record_dict = record.to_dict()
                result = self._process_record_worker(record_dict, fallback_method)

                if result:
                    record_id, college_id = result
                    self._update_record(table_name, record_id, college_id)
                    matched_count += 1

                processed_count += 1

                # Progress indicator
                if (processed_count) % 1000 == 0:
                    logger.info(f"  Processed {processed_count:,}/{total_records:,}, matched: {matched_count:,}")

        metrics.end_time = time.time()
        metrics.processed = processed_count
        metrics.matched = matched_count
        self.metrics[f'stage_{stage}'] = metrics

        logger.info(f"Stage {stage} matched {matched_count:,} records in {metrics.elapsed_time:.1f}s ({metrics.records_per_second:.0f} records/sec)\n")
        return self._count_matched(table_name)

    def _get_unmatched_records(self, table_name: str) -> pd.DataFrame:
        """Get unmatched records from the table"""
        sql = f"""
        SELECT id, master_state_id as state_id,
               course_type as stream, master_course_id as course_id,
               normalized_college_name, course_name,
               normalized_address
        FROM {table_name}
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
        ORDER BY id
        """

        try:
            results = self.seat_db.fetch_dict(sql)
            if not results:
                return pd.DataFrame()

            return pd.DataFrame(results)

        except Exception as e:
            logger.error(f"Error getting unmatched records: {e}")
            return pd.DataFrame()

    def _uncached_lookup_course_id(self, course_name: str) -> Optional[str]:
        """
        Look up course ID by course name (uncached - used by cached wrapper).

        Args:
            course_name: Name of course to look up

        Returns:
            Course ID if found, None otherwise
        """
        if self.courses_df.empty or not course_name:
            return None

        try:
            # Normalize course name
            course_upper = str(course_name).upper().strip()

            # Exact match first
            exact = self.courses_df[
                self.courses_df['course_name'].str.upper() == course_upper
            ]
            if not exact.empty:
                return exact.iloc[0]['course_id']

            # Partial match (if exact not found)
            partial = self.courses_df[
                self.courses_df['course_name'].str.upper().str.contains(course_upper[:10], na=False)
            ]
            if not partial.empty:
                return partial.iloc[0]['course_id']

            return None
        except Exception as e:
            logger.debug(f"Error looking up course {course_name}: {e}")
            return None

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

    def _count_matched(self, table_name: str) -> int:
        """Count matched records"""
        sql = f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL"
        result = self.seat_db.fetch_one(sql)
        return result[0] if result else 0

    def _validate_matches(self, table_name: str) -> int:
        """
        Validate matches and remove false ones.

        Returns:
            Number of false matches cleared
        """
        logger.info("\n" + "="*100)
        logger.info("VALIDATION: Checking for false matches")
        logger.info("="*100 + "\n")

        # Find false matches (college not in assigned state)
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
                logger.info(f"✓ Cleared {false_count} false matches\n")
            except Exception as e:
                logger.error(f"Error clearing false matches: {e}")

        else:
            logger.info("✓ No false matches found\n")

        return false_count

    def _print_summary(self, results: Dict):
        """Print final summary report"""
        print("\n" + "="*120)
        print("📊 CASCADING PIPELINE RESULTS SUMMARY")
        print("="*120)
        print(f"\nTable: {results['table']}")
        print(f"Total Records: {results['total_records']:,}")

        print(f"\nMatching Results:")
        print(f"  ✅ Final Matched: {results['final_matched']:,} ({results['accuracy']:.2f}%)")
        print(f"  ⏳ Final Unmatched: {results['final_unmatched']:,}")
        print(f"  🔒 False Matches Cleared: {results['false_matches']}")

        print(f"\nStage Breakdown:")
        s1 = results['stages']['stage1']
        s2 = results['stages']['stage2']
        s3 = results['stages']['stage3']

        print(f"  Stage 1 (Pure Hierarchical):")
        print(f"    • Matched: {s1['matched']:,} ({s1['accuracy']:.2f}%)")
        print(f"    • Time: {s1['time']:.1f}s")

        print(f"  Stage 2 (+ RapidFuzz):")
        print(f"    • Additional: {s2['additional']:,}")
        print(f"    • Total: {s2['matched']:,} ({s2['accuracy']:.2f}%)")
        print(f"    • Time: {s2['time']:.1f}s")

        print(f"  Stage 3 (+ Full Ensemble):")
        print(f"    • Additional: {s3['additional']:,}")
        print(f"    • Total: {s3['matched']:,} ({s3['accuracy']:.2f}%)")
        print(f"    • Time: {s3['time']:.1f}s")

        print(f"\nTotal Execution Time: {results['execution_time']:.1f}s")
        print("="*120 + "\n")
