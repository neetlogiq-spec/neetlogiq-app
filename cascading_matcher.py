#!/usr/bin/env python3
"""
Cascading Matcher - Independent hierarchical matching without complex logic

Architecture:
- LEVEL 1: State matching (independent) → assigns master_state_id
- LEVEL 2: Course matching (independent) → assigns master_course_id
- LEVEL 3: College matching (cascaded/state-filtered) → assigns master_college_id

Each level assigns IDs immediately when matched, NULL otherwise.
Validation skips incomplete records (any NULL at any level).

This is a SEPARATE wrapper that runs independently from the existing matching logic.
"""

import sqlite3
import pandas as pd
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class CascadingMatcher:
    """Implements clean cascading/hierarchical matching"""

    def __init__(self, seat_db_path='data/sqlite/seat_data.db', master_db_path='data/sqlite/master_data.db'):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path

    def run_cascading_match(self, table_name='seat_data', dry_run=False):
        """Run the complete cascading matching pipeline"""

        print("\n" + "="*100)
        print("🎯 CASCADING MATCHER - Independent Hierarchical Matching")
        print("="*100)
        print()

        results = {
            'level_1_states': 0,
            'level_2_courses': 0,
            'level_3_colleges': 0,
            'complete_matches': 0,
            'violations': []
        }

        conn = sqlite3.connect(self.seat_db_path)

        try:
            # LEVEL 1: Match states independently
            print("LEVEL 1: State Matching (Independent)")
            print("-" * 100)
            level_1_count = self._match_states(conn, table_name, dry_run)
            results['level_1_states'] = level_1_count
            print(f"✓ Matched {level_1_count:,} records to states")
            print()

            # LEVEL 2: Match courses independently
            print("LEVEL 2: Course Matching (Independent)")
            print("-" * 100)
            level_2_count = self._match_courses(conn, table_name, dry_run)
            results['level_2_courses'] = level_2_count
            print(f"✓ Matched {level_2_count:,} records to courses")
            print()

            # LEVEL 3: Match colleges (cascaded/state-filtered)
            print("LEVEL 3: College Matching (State-Filtered/Cascaded)")
            print("-" * 100)
            level_3_count = self._match_colleges_cascaded(conn, table_name, dry_run)
            results['level_3_colleges'] = level_3_count
            print(f"✓ Matched {level_3_count:,} records to colleges (within matched states)")
            print()

            if not dry_run:
                conn.commit()

            # Statistics
            self._print_statistics(conn, table_name)

            # Validation
            print()
            print("VALIDATION: Checking data integrity")
            print("-" * 100)
            self._validate_matches(conn, table_name)

            conn.close()

            print()
            print("="*100)
            print("✅ CASCADING MATCHER COMPLETE")
            print("="*100)

            return results

        except Exception as e:
            logger.error(f"Error in cascading matching: {e}")
            import traceback
            traceback.print_exc()
            conn.close()
            return results

    def _match_states(self, conn, table_name, dry_run):
        """LEVEL 1: Match states independently"""
        cur = conn.cursor()

        # Attach master database
        cur.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))

        # Update master_state_id by matching normalized_state to master state names
        update_query = f"""
        UPDATE {table_name}
        SET master_state_id = (
            SELECT id FROM masterdb.states
            WHERE normalized_name = {table_name}.normalized_state
            LIMIT 1
        )
        WHERE normalized_state IS NOT NULL AND master_state_id IS NULL;
        """

        if dry_run:
            # Just count what would be updated
            check_query = f"""
            SELECT COUNT(*) FROM {table_name}
            WHERE normalized_state IS NOT NULL AND master_state_id IS NULL
            AND EXISTS (
                SELECT 1 FROM masterdb.states
                WHERE normalized_name = {table_name}.normalized_state
            )
            """
            cur.execute(check_query)
            return cur.fetchone()[0]
        else:
            cur.execute(update_query)
            return cur.rowcount

    def _match_courses(self, conn, table_name, dry_run):
        """LEVEL 2: Match courses independently"""
        cur = conn.cursor()

        # Attach master database if not already attached
        cur.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))

        # Update master_course_id by matching normalized_course_name to master course names
        update_query = f"""
        UPDATE {table_name}
        SET master_course_id = (
            SELECT id FROM masterdb.courses
            WHERE normalized_name = {table_name}.normalized_course_name
            LIMIT 1
        )
        WHERE normalized_course_name IS NOT NULL AND master_course_id IS NULL;
        """

        if dry_run:
            # Just count what would be updated
            check_query = f"""
            SELECT COUNT(*) FROM {table_name}
            WHERE normalized_course_name IS NOT NULL AND master_course_id IS NULL
            AND EXISTS (
                SELECT 1 FROM masterdb.courses
                WHERE normalized_name = {table_name}.normalized_course_name
            )
            """
            cur.execute(check_query)
            return cur.fetchone()[0]
        else:
            cur.execute(update_query)
            return cur.rowcount

    def _match_colleges_cascaded(self, conn, table_name, dry_run):
        """LEVEL 3: Match colleges with state filtering (cascaded)

        KEY: Only match colleges where master_state_id IS NOT NULL
        This prevents matching "GOVERNMENT MEDICAL COLLEGE" across different states
        """
        cur = conn.cursor()

        # Attach master database
        cur.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))

        # Exact name match within matched state
        exact_query = f"""
        UPDATE {table_name}
        SET master_college_id = (
            SELECT c.id
            FROM masterdb.state_college_link scl
            JOIN masterdb.colleges c ON c.id = scl.college_id
            JOIN masterdb.states s ON s.id = scl.state_id
            WHERE c.normalized_name = {table_name}.normalized_college_name
            AND s.id = {table_name}.master_state_id
            LIMIT 1
        )
        WHERE master_state_id IS NOT NULL
        AND master_college_id IS NULL
        AND normalized_college_name IS NOT NULL;
        """

        if not dry_run:
            cur.execute(exact_query)
            exact_count = cur.rowcount
        else:
            # Count dry run
            check_query = f"""
            SELECT COUNT(*) FROM {table_name}
            WHERE master_state_id IS NOT NULL
            AND master_college_id IS NULL
            AND normalized_college_name IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM masterdb.state_college_link scl
                JOIN masterdb.colleges c ON c.id = scl.college_id
                WHERE c.normalized_name = {table_name}.normalized_college_name
                AND scl.state_id = {table_name}.master_state_id
            )
            """
            cur.execute(check_query)
            exact_count = cur.fetchone()[0]

        # Primary name match (before parentheses) within matched state
        primary_query = f"""
        UPDATE {table_name}
        SET master_college_id = (
            SELECT c.id
            FROM masterdb.state_college_link scl
            JOIN masterdb.colleges c ON c.id = scl.college_id
            WHERE TRIM(UPPER(SUBSTR(c.name, 1,
                CASE WHEN INSTR(c.name, '(') > 0
                     THEN INSTR(c.name, '(') - 1
                     ELSE LENGTH(c.name)
                END))) = {table_name}.normalized_college_name
            AND scl.state_id = {table_name}.master_state_id
            LIMIT 1
        )
        WHERE master_state_id IS NOT NULL
        AND master_college_id IS NULL
        AND normalized_college_name IS NOT NULL;
        """

        if not dry_run:
            cur.execute(primary_query)
            primary_count = cur.rowcount
        else:
            # Count dry run
            check_query = f"""
            SELECT COUNT(*) FROM {table_name}
            WHERE master_state_id IS NOT NULL
            AND master_college_id IS NULL
            AND normalized_college_name IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM masterdb.state_college_link scl
                JOIN masterdb.colleges c ON c.id = scl.college_id
                WHERE TRIM(UPPER(SUBSTR(c.name, 1,
                    CASE WHEN INSTR(c.name, '(') > 0
                         THEN INSTR(c.name, '(') - 1
                         ELSE LENGTH(c.name)
                    END))) = {table_name}.normalized_college_name
                AND scl.state_id = {table_name}.master_state_id
            )
            """
            cur.execute(check_query)
            primary_count = cur.fetchone()[0]

        logger.info(f"  Exact matches: {exact_count:,}")
        logger.info(f"  Primary name matches: {primary_count:,}")

        return exact_count + primary_count

    def _print_statistics(self, conn, table_name):
        """Print matching statistics"""
        cur = conn.cursor()

        cur.execute(f"""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN master_state_id IS NOT NULL THEN 1 END) as state_m,
            COUNT(CASE WHEN master_course_id IS NOT NULL THEN 1 END) as course_m,
            COUNT(CASE WHEN master_college_id IS NOT NULL THEN 1 END) as college_m,
            COUNT(CASE WHEN master_state_id IS NOT NULL
                       AND master_course_id IS NOT NULL
                       AND master_college_id IS NOT NULL THEN 1 END) as complete
        FROM {table_name}
        """)

        total, state_m, course_m, college_m, complete = cur.fetchone()

        print()
        print("📊 STATISTICS:")
        print(f"  Total Records:      {total:,}")
        print(f"  State Matched:      {state_m:,} ({state_m/total*100:.1f}%)")
        print(f"  Course Matched:     {course_m:,} ({course_m/total*100:.1f}%)")
        print(f"  College Matched:    {college_m:,} ({college_m/total*100:.1f}%)")
        print(f"  Complete (all 3):   {complete:,} ({complete/total*100:.1f}%)")

    def _validate_matches(self, conn, table_name):
        """Validate with NULL-aware skipping"""
        cur = conn.cursor()

        # Check 1: College-State uniqueness (only complete matches)
        print("  Check 1: College-State Uniqueness (only complete matches)...")
        cur.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT master_college_id, COUNT(DISTINCT master_state_id)
            FROM {table_name}
            WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
            GROUP BY master_college_id
            HAVING COUNT(DISTINCT master_state_id) > 1
        )""")
        violations_cs = cur.fetchone()[0]

        if violations_cs == 0:
            print("    ✅ PASS: No college matched to multiple states")
        else:
            print(f"    ⚠️  FAIL: {violations_cs} colleges matched to multiple states")

        # Check 2: College-Address uniqueness (only complete matches with address)
        print("  Check 2: College-Address Uniqueness (only complete matches)...")
        cur.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT master_college_id, master_state_id, COUNT(DISTINCT address)
            FROM {table_name}
            WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
              AND address IS NOT NULL
            GROUP BY master_college_id, master_state_id
            HAVING COUNT(DISTINCT address) > 1
        )""")
        violations_ca = cur.fetchone()[0]

        if violations_ca == 0:
            print("    ✅ PASS: Each college in each state has unique address")
        else:
            print(f"    ⚠️  WARNING: {violations_ca} college-state combos have multiple addresses")

        print()
        print(f"Summary: {2 if violations_cs == 0 and violations_ca == 0 else violations_cs + violations_ca} checks passed")


if __name__ == '__main__':
    matcher = CascadingMatcher()
    results = matcher.run_cascading_match()
    print(f"\nResults: {results}")
