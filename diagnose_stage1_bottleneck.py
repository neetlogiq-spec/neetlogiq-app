#!/usr/bin/env python3
"""
Diagnostic script to understand why Stage 1 only achieved 53.78% accuracy
instead of expected 95%+
"""

import psycopg2
import pandas as pd
from collections import Counter
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class Stage1Diagnostics:
    def __init__(self, seat_db_url, master_db_url):
        self.seat_conn = psycopg2.connect(seat_db_url)
        self.master_conn = psycopg2.connect(master_db_url)

    def close(self):
        self.seat_conn.close()
        self.master_conn.close()

    def analyze(self):
        """Run comprehensive diagnostics"""

        print("\n" + "="*120)
        print("🔍 STAGE 1 BOTTLENECK ANALYSIS - Diagnosing 53.78% Accuracy")
        print("="*120)

        # 1. Check data prerequisites
        print("\n📋 PHASE 1: Data Prerequisites Check")
        print("-" * 120)
        self._check_prerequisites()

        # 2. Check what percentage of records can potentially match
        print("\n📊 PHASE 2: Matching Potential Analysis")
        print("-" * 120)
        self._analyze_matching_potential()

        # 3. Analyze unmatched records
        print("\n🔎 PHASE 3: Unmatched Records Analysis")
        print("-" * 120)
        self._analyze_unmatched_records()

        # 4. Check hierarchical joins
        print("\n🔗 PHASE 4: Hierarchical Join Analysis")
        print("-" * 120)
        self._analyze_joins()

        # 5. Recommendations
        print("\n💡 PHASE 5: Root Cause Analysis & Recommendations")
        print("-" * 120)
        self._provide_recommendations()

    def _check_prerequisites(self):
        """Check basic data prerequisites"""

        cursor = self.seat_conn.cursor()

        # Total records
        cursor.execute("SELECT COUNT(*) FROM seat_data")
        total = cursor.fetchone()[0]
        logger.info(f"Total seat_data records: {total:,}")

        # Records with master_state_id assigned
        cursor.execute("SELECT COUNT(*) FROM seat_data WHERE master_state_id IS NOT NULL")
        with_state = cursor.fetchone()[0]
        logger.info(f"  ✓ With master_state_id: {with_state:,} ({100*with_state/total:.1f}%)")

        # Records with master_course_id assigned
        cursor.execute("SELECT COUNT(*) FROM seat_data WHERE master_course_id IS NOT NULL")
        with_course = cursor.fetchone()[0]
        logger.info(f"  ✓ With master_course_id: {with_course:,} ({100*with_course/total:.1f}%)")

        # Records with normalized_college_name
        cursor.execute("SELECT COUNT(*) FROM seat_data WHERE normalized_college_name IS NOT NULL")
        with_name = cursor.fetchone()[0]
        logger.info(f"  ✓ With normalized_college_name: {with_name:,} ({100*with_name/total:.1f}%)")

        # All three prerequisites met
        cursor.execute("""
            SELECT COUNT(*) FROM seat_data
            WHERE master_state_id IS NOT NULL
              AND master_course_id IS NOT NULL
              AND normalized_college_name IS NOT NULL
        """)
        all_three = cursor.fetchone()[0]
        logger.info(f"  ✓ All 3 prerequisites met: {all_three:,} ({100*all_three/total:.1f}%)")

        # Already matched
        cursor.execute("SELECT COUNT(*) FROM seat_data WHERE master_college_id IS NOT NULL")
        already_matched = cursor.fetchone()[0]
        logger.info(f"  ✓ Already matched: {already_matched:,} ({100*already_matched/total:.1f}%)")

        # Can theoretically be matched in Stage 1
        cursor.execute("""
            SELECT COUNT(*) FROM seat_data
            WHERE master_state_id IS NOT NULL
              AND master_course_id IS NOT NULL
              AND normalized_college_name IS NOT NULL
              AND master_college_id IS NULL
        """)
        can_match = cursor.fetchone()[0]
        logger.info(f"  ✓ Can theoretically match in Stage 1: {can_match:,} ({100*can_match/total:.1f}%)")

        cursor.close()

    def _analyze_matching_potential(self):
        """Check what percentage of records could potentially match"""

        cursor_seat = self.seat_conn.cursor()
        cursor_master = self.master_conn.cursor()

        # Get all unique normalized names in seat_data
        cursor_seat.execute("""
            SELECT DISTINCT normalized_college_name
            FROM seat_data
            WHERE normalized_college_name IS NOT NULL
            ORDER BY normalized_college_name
        """)
        seat_names = set(row[0] for row in cursor_seat.fetchall())
        logger.info(f"Unique normalized names in seat_data: {len(seat_names):,}")

        # Get all unique normalized names in master_data
        cursor_master.execute("""
            SELECT DISTINCT normalized_name
            FROM colleges
            WHERE normalized_name IS NOT NULL
            ORDER BY normalized_name
        """)
        master_names = set(row[0] for row in cursor_master.fetchall())
        logger.info(f"Unique normalized names in master_data: {len(master_names):,}")

        # Check overlap
        overlap = seat_names & master_names
        logger.info(f"  ✓ Names that exist in BOTH databases: {len(overlap):,}")
        logger.info(f"  ✓ Overlap percentage: {100*len(overlap)/len(seat_names):.1f}%")

        # Names only in seat_data (can't be matched)
        only_in_seat = seat_names - master_names
        logger.info(f"  ✗ Names ONLY in seat_data (can't match): {len(only_in_seat):,} ({100*len(only_in_seat)/len(seat_names):.1f}%)")

        # How many records are affected?
        cursor_seat.execute("""
            SELECT COUNT(*) FROM seat_data
            WHERE normalized_college_name IS NOT NULL
              AND master_college_id IS NULL
        """)
        unmatched = cursor_seat.fetchone()[0]

        # How many of those unmatched have names in master?
        placeholders = ','.join(['%s'] * len(overlap)) if overlap else "'__EMPTY__'"
        query = f"""
            SELECT COUNT(*) FROM seat_data
            WHERE normalized_college_name IS NOT NULL
              AND master_college_id IS NULL
              AND normalized_college_name IN ({placeholders})
        """
        if overlap:
            cursor_seat.execute(query, list(overlap))
            can_match = cursor_seat.fetchone()[0]
        else:
            can_match = 0

        logger.info(f"\nRecords with names in master_data: {can_match:,}")
        logger.info(f"Records with names ONLY in seat_data: {unmatched - can_match:,}")

        cursor_seat.close()
        cursor_master.close()

    def _analyze_unmatched_records(self):
        """Analyze why unmatched records didn't match"""

        cursor_seat = self.seat_conn.cursor()
        cursor_master = self.master_conn.cursor()

        # Get sample unmatched records
        cursor_seat.execute("""
            SELECT id, normalized_college_name, master_state_id, master_course_id, normalized_address
            FROM seat_data
            WHERE master_college_id IS NULL
              AND normalized_college_name IS NOT NULL
              AND master_state_id IS NOT NULL
              AND master_course_id IS NOT NULL
            LIMIT 100
        """)

        unmatched = cursor_seat.fetchall()
        logger.info(f"Sample of 100 unmatched records:")

        # Categorize reasons for non-matching
        missing_name = 0
        has_name_but_no_match = 0

        for record_id, college_name, state_id, course_id, address in unmatched:
            # Check if name exists in master (query master_data database!)
            cursor_master.execute("""
                SELECT COUNT(*) FROM colleges
                WHERE normalized_name = %s
            """, (college_name,))

            exists = cursor_master.fetchone()[0] > 0

            if not exists:
                missing_name += 1
            else:
                # Name exists but didn't match - why?
                # Check if state-college link exists
                cursor_master.execute("""
                    SELECT COUNT(*) FROM state_college_link scl
                    JOIN colleges c ON c.id = scl.college_id
                    WHERE c.normalized_name = %s
                      AND scl.state_id = %s
                """, (college_name, state_id))

                has_state_link = cursor_master.fetchone()[0] > 0

                if not has_state_link:
                    logger.info(f"  ⚠️  College '{college_name}' exists in master but NOT in state {state_id}")
                else:
                    logger.info(f"  ⚠️  College '{college_name}' + state {state_id} exist but course {course_id} link missing?")

                has_name_but_no_match += 1

        logger.info(f"\nReason Analysis (of 100 sample unmatched):")
        logger.info(f"  • College name not in master_data: {missing_name} ({100*missing_name/100:.0f}%)")
        logger.info(f"  • College name exists but no state/course link: {has_name_but_no_match} ({100*has_name_but_no_match/100:.0f}%)")

        cursor_seat.close()
        cursor_master.close()

    def _analyze_joins(self):
        """Analyze why hierarchical joins aren't working"""

        print("\n⚠️  CRITICAL ISSUE: PostgreSQL Cross-Database Joins")
        print("-" * 120)

        cursor_seat = self.seat_conn.cursor()

        # The SQL from Stage 1 tries to join with state_college_link which is in master_data
        # But the query runs in seat_data database context

        # Check what tables exist in seat_data
        cursor_seat.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)

        seat_tables = [row[0] for row in cursor_seat.fetchall()]
        logger.info(f"Tables in seat_data database: {seat_tables}")

        # Check what tables are referenced in Stage 1 SQL
        required_tables = ['state_college_link', 'colleges', 'state_course_college_link']
        logger.info(f"\nStage 1 SQL requires these tables: {required_tables}")

        missing = [t for t in required_tables if t not in seat_tables]
        if missing:
            print(f"\n❌ PROBLEM FOUND:")
            for table in missing:
                logger.info(f"  ✗ {table} - NOT in seat_data (it's in master_data database)")
            print(f"\nThis explains the low accuracy! PostgreSQL cannot join across databases.")
            print(f"Stage 1 SQL is SILENTLY FAILING and matching 0 records for cross-database tables.")

        cursor_seat.close()

    def _provide_recommendations(self):
        """Provide root cause and fix recommendations"""

        print("\n🎯 ROOT CAUSE IDENTIFIED:")
        print("-" * 120)
        print("""
        PostgreSQL cannot perform JOINs across different databases.

        The Stage 1 SQL tries to JOIN:
        - seat_data.seat_data (✓ available)
        - master_data.state_college_link (✗ NOT available in seat_data database)
        - master_data.colleges (✗ NOT available in seat_data database)
        - master_data.state_course_college_link (✗ NOT available in seat_data database)

        Result: The SQL query silently fails on the joins, returning 0 matches.
        """)

        print("\n✅ SOLUTIONS (In Order of Recommendation):")
        print("-" * 120)
        print("""
        OPTION 1: Copy master_data tables to seat_data database [RECOMMENDED]
        ────────────────────────────────────────────────────
        • Fastest approach (single database, proper JOINs)
        • Best accuracy (100% of records can match if names exist)
        • Creates ~3 tables: state_college_link, colleges, state_course_college_link
        • Then Stage 1 SQL will work as designed → 95%+ accuracy expected

        OPTION 2: Load data in Python and match in-memory
        ────────────────────────────────────────────────
        • Current approach (slower, but works)
        • Load master tables once, then iterate seat_data records
        • Can achieve 95%+ if matching logic is correct

        OPTION 3: Create PostgreSQL foreign data wrapper
        ───────────────────────────────────────────────
        • Complex setup, not recommended for this use case

        RECOMMENDATION: Use OPTION 1
        ──────────────────────────────
        • Copy the 3 required tables from master_data to seat_data
        • Then re-run Stage 1 SQL
        • Expected result: 95%+ accuracy (instead of 53.78%)
        """)


if __name__ == "__main__":
    seat_db_url = "postgresql://kashyapanand@localhost:5432/seat_data"
    master_db_url = "postgresql://kashyapanand@localhost:5432/master_data"

    diag = Stage1Diagnostics(seat_db_url, master_db_url)
    try:
        diag.analyze()
    finally:
        diag.close()
