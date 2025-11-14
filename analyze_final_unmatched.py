#!/usr/bin/env python3
"""
Analyze the 4,922 remaining unmatched records to understand bottlenecks
"""

import psycopg2
import logging
from collections import Counter

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def analyze():
    """Analyze unmatched records"""

    conn = psycopg2.connect("postgresql://kashyapanand@localhost:5432/seat_data")
    cursor = conn.cursor()

    print("\n" + "="*120)
    print("🔍 ANALYSIS: Why are 4,922 records still unmatched?")
    print("="*120)

    # 1. Basic stats
    print("\n📊 PHASE 1: Unmatched Records Statistics")
    print("-" * 120)

    cursor.execute("SELECT COUNT(*) FROM seat_data WHERE master_college_id IS NULL")
    unmatched_total = cursor.fetchone()[0]
    logger.info(f"Total unmatched records: {unmatched_total:,}")

    # Check prerequisites
    cursor.execute("""
        SELECT COUNT(*) FROM seat_data
        WHERE master_college_id IS NULL
          AND master_state_id IS NULL
    """)
    no_state = cursor.fetchone()[0]
    logger.info(f"  • No master_state_id: {no_state:,}")

    cursor.execute("""
        SELECT COUNT(*) FROM seat_data
        WHERE master_college_id IS NULL
          AND master_course_id IS NULL
    """)
    no_course = cursor.fetchone()[0]
    logger.info(f"  • No master_course_id: {no_course:,}")

    cursor.execute("""
        SELECT COUNT(*) FROM seat_data
        WHERE master_college_id IS NULL
          AND normalized_college_name IS NULL
    """)
    no_name = cursor.fetchone()[0]
    logger.info(f"  • No normalized_college_name: {no_name:,}")

    # Records with ALL prerequisites but still unmatched
    cursor.execute("""
        SELECT COUNT(*) FROM seat_data
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND master_course_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
    """)
    all_prereq = cursor.fetchone()[0]
    logger.info(f"  • WITH all prerequisites: {all_prereq:,}")

    print()
    print("🔎 PHASE 2: College Name Analysis")
    print("-" * 120)

    # Check if college names exist in colleges table
    cursor.execute("""
        SELECT COUNT(DISTINCT normalized_college_name) FROM seat_data
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
    """)
    unique_unmatched_names = cursor.fetchone()[0]
    logger.info(f"Unique college names in unmatched: {unique_unmatched_names:,}")

    # How many of these exist in colleges table?
    cursor.execute("""
        SELECT COUNT(DISTINCT sd.normalized_college_name)
        FROM seat_data sd
        WHERE sd.master_college_id IS NULL
          AND sd.master_state_id IS NOT NULL
          AND sd.normalized_college_name IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM colleges c
            WHERE c.normalized_name = sd.normalized_college_name
          )
    """)
    names_in_master = cursor.fetchone()[0]
    logger.info(f"  • Exist in master colleges table: {names_in_master:,}")

    cursor.execute("""
        SELECT COUNT(DISTINCT sd.normalized_college_name)
        FROM seat_data sd
        WHERE sd.master_college_id IS NULL
          AND sd.master_state_id IS NOT NULL
          AND sd.normalized_college_name IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM colleges c
            WHERE c.normalized_name = sd.normalized_college_name
          )
    """)
    names_NOT_in_master = cursor.fetchone()[0]
    logger.info(f"  • DO NOT exist in master (unfixable): {names_NOT_in_master:,} unique names")

    print()
    print("🔗 PHASE 3: State-College Link Analysis")
    print("-" * 120)

    # For records with college names that DO exist in master
    cursor.execute("""
        SELECT COUNT(*)
        FROM seat_data sd
        WHERE sd.master_college_id IS NULL
          AND sd.master_state_id IS NOT NULL
          AND sd.normalized_college_name IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM colleges c
            WHERE c.normalized_name = sd.normalized_college_name
          )
          AND EXISTS (
            SELECT 1 FROM state_college_link scl
            JOIN colleges c ON c.id = scl.college_id
            WHERE c.normalized_name = sd.normalized_college_name
              AND scl.state_id = sd.master_state_id
          )
    """)
    with_state_link = cursor.fetchone()[0]
    logger.info(f"Colleges that exist in both name + state: {with_state_link:,}")

    # Why didn't they match then? Check state-course link
    cursor.execute("""
        SELECT COUNT(*)
        FROM seat_data sd
        WHERE sd.master_college_id IS NULL
          AND sd.master_state_id IS NOT NULL
          AND sd.master_course_id IS NOT NULL
          AND sd.normalized_college_name IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM colleges c
            WHERE c.normalized_name = sd.normalized_college_name
          )
          AND EXISTS (
            SELECT 1 FROM state_college_link scl
            JOIN colleges c ON c.id = scl.college_id
            WHERE c.normalized_name = sd.normalized_college_name
              AND scl.state_id = sd.master_state_id
          )
          AND NOT EXISTS (
            SELECT 1 FROM state_course_college_link sccl
            JOIN colleges c ON c.id = sccl.college_id
            WHERE c.normalized_name = sd.normalized_college_name
              AND sccl.state_id = sd.master_state_id
              AND sccl.course_id = sd.master_course_id
          )
    """)
    missing_course_link = cursor.fetchone()[0]
    logger.info(f"  • College+State exist but course link missing: {missing_course_link:,}")

    print()
    print("🛑 PHASE 4: Address Filter Analysis")
    print("-" * 120)

    # Check if address filter is blocking matches
    cursor.execute("""
        SELECT COUNT(*)
        FROM seat_data sd
        WHERE sd.master_college_id IS NULL
          AND sd.master_state_id IS NOT NULL
          AND sd.master_course_id IS NOT NULL
          AND sd.normalized_college_name IS NOT NULL
          AND (
            SELECT COUNT(*)
            FROM state_college_link scl
            JOIN colleges c ON c.id = scl.college_id
            WHERE c.normalized_name = sd.normalized_college_name
              AND scl.state_id = sd.master_state_id
              AND sccl.course_id = sd.master_course_id
              AND (sd.normalized_address IS NULL
                   OR scl.address IS NULL
                   OR STRPOS(UPPER(scl.address), UPPER(sd.normalized_address)) > 0)
          ) = 0
    """)
    try:
        blocked_by_address = cursor.fetchone()[0]
        logger.info(f"Records blocked by address filter: {blocked_by_address:,}")
    except Exception as e:
        logger.warning(f"Could not analyze address filter: {e}")

    print()
    print("📈 PHASE 5: Sample Unmatched Records")
    print("-" * 120)

    cursor.execute("""
        SELECT
            id,
            normalized_college_name,
            master_state_id,
            master_course_id,
            normalized_address
        FROM seat_data
        WHERE master_college_id IS NULL
          AND master_state_id IS NOT NULL
          AND master_course_id IS NOT NULL
          AND normalized_college_name IS NOT NULL
        LIMIT 20
    """)

    print("Sample unmatched records (with all prerequisites):")
    for i, (rec_id, name, state, course, addr) in enumerate(cursor.fetchall(), 1):
        # Check why it didn't match
        cursor.execute("""
            SELECT COUNT(*) FROM colleges c
            WHERE c.normalized_name = %s
        """, (name,))
        exists_in_master = cursor.fetchone()[0] > 0

        if exists_in_master:
            cursor.execute("""
                SELECT COUNT(*) FROM state_college_link scl
                JOIN colleges c ON c.id = scl.college_id
                WHERE c.normalized_name = %s AND scl.state_id = %s
            """, (name, state))
            state_exists = cursor.fetchone()[0] > 0

            if state_exists:
                cursor.execute("""
                    SELECT COUNT(*) FROM state_course_college_link sccl
                    JOIN colleges c ON c.id = sccl.college_id
                    WHERE c.normalized_name = %s AND sccl.state_id = %s AND sccl.course_id = %s
                """, (name, state, course))
                course_exists = cursor.fetchone()[0] > 0

                status = "✓ Course link found" if course_exists else "✗ Course link missing"
            else:
                status = "✗ State link missing"
        else:
            status = "✗ Name not in master"

        logger.info(f"  {i:2d}. {name[:50]:50s} | {status}")

    print()
    print("="*120)
    print("✅ ANALYSIS COMPLETE")
    print("="*120)

    cursor.close()
    conn.close()


if __name__ == "__main__":
    analyze()
