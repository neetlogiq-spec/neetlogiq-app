#!/usr/bin/env python3
"""
Hierarchical Independent ID Assignment Matching System

Architecture:
- LEVEL 1: State matching (independent)
- LEVEL 2: Course matching (independent)
- LEVEL 3: College matching (state-filtered with address validation)

Each level assigns IDs immediately when matched, NULL otherwise.
Validation skips incomplete records (any NULL at any level).
"""

import sqlite3
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class HierarchicalMatcher:
    """Implements independent hierarchical matching with state-filtered college matching"""

    def __init__(self, seat_db_path, master_db_path):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path

    def match_states(self, table_name='seat_data'):
        """LEVEL 1: Match states independently"""
        logger.info("LEVEL 1: Matching states...")
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()
        try:
            cur.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))
            update_query = f"""
            UPDATE {table_name}
            SET master_state_id = (
                SELECT id FROM masterdb.states
                WHERE normalized_name = {table_name}.normalized_state
                LIMIT 1
            )
            WHERE normalized_state IS NOT NULL AND master_state_id IS NULL;
            """
            cur.execute(update_query)
            matched = cur.rowcount
            conn.commit()
            logger.info(f"✓ Matched {matched:,} records to states")
            return matched
        finally:
            conn.close()

    def match_courses(self, table_name='seat_data'):
        """LEVEL 2: Match courses independently"""
        logger.info("LEVEL 2: Matching courses...")
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()
        try:
            cur.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))
            update_query = f"""
            UPDATE {table_name}
            SET master_course_id = (
                SELECT id FROM masterdb.courses
                WHERE normalized_name = {table_name}.normalized_course_name
                LIMIT 1
            )
            WHERE normalized_course_name IS NOT NULL AND master_course_id IS NULL;
            """
            cur.execute(update_query)
            matched = cur.rowcount
            conn.commit()
            logger.info(f"✓ Matched {matched:,} records to courses")
            return matched
        finally:
            conn.close()

    def match_colleges(self, table_name='seat_data'):
        """LEVEL 3: Match colleges with state filtering - prevents cross-state false matches"""
        logger.info("LEVEL 3: Matching colleges (state-filtered)...")
        conn = sqlite3.connect(self.seat_db_path)
        try:
            conn.execute("ATTACH DATABASE ? AS masterdb", (self.master_db_path,))
            
            # Exact matches within matched states
            exact = self._match_colleges_exact(conn, table_name)
            logger.info(f"  ✓ Exact matches: {exact}")
            
            # Primary name matches within matched states
            primary = self._match_colleges_primary(conn, table_name)
            logger.info(f"  ✓ Primary matches: {primary}")
            
            return {'exact': exact, 'primary': primary, 'total': exact + primary}
        finally:
            conn.close()

    def _match_colleges_exact(self, conn, table_name):
        """Exact college matches only in already-matched states"""
        cur = conn.cursor()
        query = f"""
        UPDATE {table_name}
        SET master_college_id = (
            SELECT c.id
            FROM masterdb.state_college_link scl
            JOIN masterdb.colleges c ON c.id = scl.college_id
            JOIN masterdb.states s ON s.id = scl.state_id
            WHERE c.normalized_name = {table_name}.normalized_college_name
            AND s.normalized_name = {table_name}.normalized_state
            AND UPPER(c.source_table) = UPPER(COALESCE({table_name}.course_type, 'MEDICAL'))
            LIMIT 1
        )
        WHERE master_state_id IS NOT NULL
        AND master_college_id IS NULL
        AND normalized_college_name IS NOT NULL;
        """
        cur.execute(query)
        return cur.rowcount

    def _match_colleges_primary(self, conn, table_name):
        """Primary name (before parentheses) matches in matched states"""
        cur = conn.cursor()
        query = f"""
        UPDATE {table_name}
        SET master_college_id = (
            SELECT c.id
            FROM masterdb.state_college_link scl
            JOIN masterdb.colleges c ON c.id = scl.college_id
            JOIN masterdb.states s ON s.id = scl.state_id
            WHERE TRIM(UPPER(SUBSTR(c.name, 1,
                CASE WHEN INSTR(c.name, '(') > 0
                     THEN INSTR(c.name, '(') - 1
                     ELSE LENGTH(c.name)
                END))) = {table_name}.normalized_college_name
            AND s.normalized_name = {table_name}.normalized_state
            LIMIT 1
        )
        WHERE master_state_id IS NOT NULL
        AND master_college_id IS NULL
        AND normalized_college_name IS NOT NULL;
        """
        cur.execute(query)
        return cur.rowcount

    def validate_matches(self, table_name='seat_data'):
        """Validate with NULL-aware skipping - only complete matches"""
        logger.info("\n🔍 Validating Matches (NULL-Aware)...")
        conn = sqlite3.connect(self.seat_db_path)
        cur = conn.cursor()
        try:
            # Statistics
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
            result = cur.fetchone()
            total, state_m, course_m, college_m, complete = result

            logger.info(f"\n📊 Hierarchy Statistics:")
            logger.info(f"  Total:      {total:,}")
            logger.info(f"  State:      {state_m:,} ({state_m/total*100:.1f}%)")
            logger.info(f"  Course:     {course_m:,} ({course_m/total*100:.1f}%)")
            logger.info(f"  College:    {college_m:,} ({college_m/total*100:.1f}%)")
            logger.info(f"  Complete:   {complete:,} ({complete/total*100:.1f}%)")

            # Check 1: College-State uniqueness (only complete matches)
            logger.info(f"\n✓ Check 1: College-State Uniqueness...")
            cur.execute(f"""
            SELECT COUNT(*) FROM (
                SELECT master_college_id, COUNT(DISTINCT master_state_id)
                FROM {table_name}
                WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
                GROUP BY master_college_id
                HAVING COUNT(DISTINCT master_state_id) > 1
            )""")
            violations_cs = cur.fetchone()[0]
            logger.info(f"  {'✅ PASS' if violations_cs == 0 else f'⚠️  {violations_cs} violations'}")

            # Check 2: College-Address uniqueness (only complete matches with address)
            logger.info(f"\n✓ Check 2: College-Address Uniqueness...")
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
            logger.info(f"  {'✅ PASS' if violations_ca == 0 else f'⚠️  {violations_ca} violations'}")

            return {'complete': complete, 'violations_cs': violations_cs, 'violations_ca': violations_ca}

        finally:
            conn.close()
