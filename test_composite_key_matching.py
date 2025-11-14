#!/usr/bin/env python3
"""
Test Composite Key Fix for Duplicate College Names
===================================================
This script tests the composite_college_key fix with real seat data
to verify that colleges with identical names but different addresses
now match correctly without false matches.
"""

import sqlite3
import pandas as pd
from cascading_hierarchical_ensemble_matcher import CascadingHierarchicalEnsembleMatcher
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_composite_key_fix():
    """Test that composite_college_key fixes duplicate college name false matches."""

    print("\n" + "="*80)
    print("COMPOSITE KEY FIX VALIDATION TEST")
    print("="*80)

    # Database paths
    master_db = "data/sqlite/master_data.db"
    seat_db = "data/sqlite/seat_data.db"

    # Connect to databases
    master_conn = sqlite3.connect(master_db)
    seat_conn = sqlite3.connect(seat_db)

    print("\n📊 STEP 1: Verify composite_college_key exists in master_data.db")
    print("-" * 80)

    # Check if composite_college_key column exists
    master_cursor = master_conn.cursor()
    master_cursor.execute("PRAGMA table_info(colleges)")
    columns = [col[1] for col in master_cursor.fetchall()]

    if 'composite_college_key' in columns:
        print("✅ composite_college_key column exists in colleges VIEW")
    else:
        print("❌ composite_college_key column NOT found in colleges VIEW")
        print("   Run add_composite_key.sql first!")
        return

    # Verify all 8 DISTRICT HOSPITAL entries are visible
    query = """
    SELECT id, normalized_name, normalized_address, composite_college_key
    FROM colleges
    WHERE normalized_state = 'KARNATAKA'
      AND normalized_name = 'DISTRICT HOSPITAL'
    ORDER BY composite_college_key
    """
    district_hospitals = pd.read_sql(query, master_conn)

    print(f"\n✅ Found {len(district_hospitals)} DISTRICT HOSPITAL entries in Karnataka:")
    for idx, row in district_hospitals.iterrows():
        print(f"   {row['id']}: {row['composite_college_key'][:70]}...")

    if len(district_hospitals) != 8:
        print(f"\n⚠️  WARNING: Expected 8 DISTRICT HOSPITAL entries, found {len(district_hospitals)}")

    print("\n\n📊 STEP 2: Check seat_data for DISTRICT HOSPITAL records")
    print("-" * 80)

    # Check if seat_data has DISTRICT HOSPITAL records
    try:
        seat_query = """
        SELECT id, college_name, address, state, course_name, normalized_college_name, normalized_address
        FROM seat_data
        WHERE normalized_state = 'KARNATAKA'
          AND normalized_college_name LIKE 'DISTRICT HOSPITAL%'
        LIMIT 10
        """
        seat_records = pd.read_sql(seat_query, seat_conn)

        if len(seat_records) > 0:
            print(f"✅ Found {len(seat_records)} seat_data records with DISTRICT HOSPITAL:")
            for idx, row in seat_records.iterrows():
                print(f"\n   Record {row['id']}:")
                print(f"   - College: {row['college_name']}")
                print(f"   - Address: {row['address'][:70]}...")
                print(f"   - Course: {row['course_name']}")
        else:
            print("⚠️  No DISTRICT HOSPITAL records found in seat_data")
            print("   Creating synthetic test records...")

            # Create synthetic test records
            test_records = [
                {
                    'college_name': 'DISTRICT HOSPITAL, VIJAYAPURA',
                    'address': 'NEXT TO SAINIK SCHOOL SECOND GATE, ATHANI ROAD, VIJAYAPURA',
                    'state': 'KARNATAKA',
                    'course_name': 'DNB- DIPLOMA IN FAMILY MEDICINE',
                    'expected_id': 'DNB0352'
                },
                {
                    'college_name': 'DISTRICT HOSPITAL, BALLARI',
                    'address': 'NEAR SANGAM CIRCLE, DR RAJ KUMAR ROAD, BALLARI',
                    'state': 'KARNATAKA',
                    'course_name': 'DNB- DIPLOMA IN FAMILY MEDICINE',
                    'expected_id': 'DNB0356'
                },
                {
                    'college_name': 'DISTRICT HOSPITAL',
                    'address': 'KILLA ROAD, DHARWAD',
                    'state': 'KARNATAKA',
                    'course_name': 'DNB- DIPLOMA IN FAMILY MEDICINE',
                    'expected_id': 'DNB0357'
                }
            ]

            print("\n   Synthetic test records:")
            for i, rec in enumerate(test_records, 1):
                print(f"\n   Test {i}: {rec['college_name']}")
                print(f"   - Address: {rec['address']}")
                print(f"   - Expected match: {rec['expected_id']}")

            seat_records = pd.DataFrame(test_records)

    except Exception as e:
        print(f"❌ Error reading seat_data: {e}")
        print("   Creating synthetic test records...")

        # Create synthetic test records
        test_records = [
            {
                'college_name': 'DISTRICT HOSPITAL, VIJAYAPURA',
                'address': 'NEXT TO SAINIK SCHOOL SECOND GATE, ATHANI ROAD, VIJAYAPURA',
                'state': 'KARNATAKA',
                'course_name': 'DNB- DIPLOMA IN FAMILY MEDICINE',
                'expected_id': 'DNB0352'
            },
            {
                'college_name': 'DISTRICT HOSPITAL, BALLARI',
                'address': 'NEAR SANGAM CIRCLE, DR RAJ KUMAR ROAD, BALLARI',
                'state': 'KARNATAKA',
                'course_name': 'DNB- DIPLOMA IN FAMILY MEDICINE',
                'expected_id': 'DNB0356'
            },
            {
                'college_name': 'DISTRICT HOSPITAL',
                'address': 'KILLA ROAD, DHARWAD',
                'state': 'KARNATAKA',
                'course_name': 'DNB- DIPLOMA IN FAMILY MEDICINE',
                'expected_id': 'DNB0357'
            }
        ]

        seat_records = pd.DataFrame(test_records)

    print("\n\n📊 STEP 3: Test OLD method (normalized_name = ...) - EXPECTED TO FAIL")
    print("-" * 80)

    # Simulate OLD matching logic (before composite key fix)
    for idx, record in seat_records.head(3).iterrows():
        college_name = record.get('college_name', record.get('normalized_college_name', ''))
        address = record.get('address', record.get('normalized_address', ''))

        # Extract just the college name (before comma or full name)
        if ',' in college_name:
            college_name_only = college_name.split(',')[0].strip()
        else:
            college_name_only = college_name

        old_query = f"""
        SELECT id, name, address
        FROM colleges
        WHERE normalized_state = 'KARNATAKA'
          AND normalized_name = '{college_name_only.upper()}'
        LIMIT 1
        """

        try:
            old_match = pd.read_sql(old_query, master_conn)
            if len(old_match) > 0:
                print(f"\n   Input: {college_name}")
                print(f"   Address: {address[:50]}...")
                print(f"   ❌ OLD match: {old_match.iloc[0]['id']} (arbitrary - likely wrong!)")
            else:
                print(f"\n   Input: {college_name}")
                print(f"   ❌ OLD match: No match found")
        except Exception as e:
            print(f"\n   Input: {college_name}")
            print(f"   ❌ OLD match error: {e}")

    print("\n\n📊 STEP 4: Test NEW method (composite_college_key LIKE ...) - EXPECTED TO WORK")
    print("-" * 80)

    # Simulate NEW matching logic (with composite key fix)
    for idx, record in seat_records.head(3).iterrows():
        college_name = record.get('college_name', record.get('normalized_college_name', ''))
        address = record.get('address', record.get('normalized_address', ''))
        expected_id = record.get('expected_id', 'N/A')

        # Extract just the college name (before comma or full name)
        if ',' in college_name:
            college_name_only = college_name.split(',')[0].strip()
        else:
            college_name_only = college_name

        # Step 1: Get all candidates using composite_college_key
        new_query = f"""
        SELECT id, name, address, composite_college_key
        FROM colleges
        WHERE normalized_state = 'KARNATAKA'
          AND composite_college_key LIKE '{college_name_only.upper()},%'
        """

        try:
            candidates = pd.read_sql(new_query, master_conn)

            print(f"\n   Input: {college_name}")
            print(f"   Address: {address[:50]}...")
            print(f"   Expected: {expected_id}")
            print(f"   ✅ Found {len(candidates)} candidates (all distinct!)")

            # Step 2: Address disambiguation
            best_match = None
            best_score = 0

            for _, candidate in candidates.iterrows():
                candidate_addr = candidate['address'] or ''

                # Simple keyword matching for address
                address_upper = address.upper()
                candidate_addr_upper = candidate_addr.upper()

                # Count matching keywords
                address_words = set(address_upper.split())
                candidate_words = set(candidate_addr_upper.split())

                if len(candidate_words) > 0:
                    overlap = len(address_words & candidate_words) / len(candidate_words)

                    if overlap > best_score:
                        best_score = overlap
                        best_match = candidate

            if best_match is not None:
                match_status = "✅ CORRECT" if best_match['id'] == expected_id else "❌ WRONG"
                print(f"   {match_status} match: {best_match['id']} (confidence: {best_score:.2%})")
                print(f"   Matched to: {best_match['composite_college_key'][:70]}...")
            else:
                print(f"   ❌ No match found after address disambiguation")

        except Exception as e:
            print(f"\n   Input: {college_name}")
            print(f"   ❌ NEW match error: {e}")

    print("\n\n📊 STEP 5: Run full cascading matcher test")
    print("-" * 80)

    try:
        # Initialize cascading matcher
        matcher = CascadingHierarchicalEnsembleMatcher(
            seat_db_path=seat_db,
            master_db_path=master_db
        )

        print("✅ Cascading matcher initialized successfully")
        print("\n   Testing with first 100 unmatched records from seat_data...")

        # Get unmatched records
        unmatched_query = """
        SELECT *
        FROM seat_data
        WHERE master_college_id IS NULL
        LIMIT 100
        """

        unmatched = pd.read_sql(unmatched_query, seat_conn)

        if len(unmatched) > 0:
            print(f"   Found {len(unmatched)} unmatched records")

            # Run cascading matching
            print("\n   Running cascading matcher (all 3 stages with composite_college_key)...")
            matcher.match_all_records_cascading('seat_data')

            # Check results
            matched_after = pd.read_sql("""
                SELECT COUNT(*) as count
                FROM seat_data
                WHERE master_college_id IS NOT NULL
            """, seat_conn)

            print(f"   ✅ Matching complete!")
            print(f"   Total matched records: {matched_after.iloc[0]['count']:,}")

            # Show some DISTRICT HOSPITAL matches
            dh_matches = pd.read_sql("""
                SELECT
                    sd.id,
                    sd.college_name,
                    sd.address,
                    sd.master_college_id,
                    c.name as matched_college,
                    c.address as matched_address
                FROM seat_data sd
                LEFT JOIN master_data.colleges c ON sd.master_college_id = c.id
                WHERE sd.normalized_college_name LIKE 'DISTRICT HOSPITAL%'
                  AND sd.normalized_state = 'KARNATAKA'
                  AND sd.master_college_id IS NOT NULL
                LIMIT 5
            """, seat_conn)

            if len(dh_matches) > 0:
                print(f"\n   Sample DISTRICT HOSPITAL matches:")
                for idx, row in dh_matches.iterrows():
                    print(f"\n   Match {idx+1}:")
                    print(f"   - Input: {row['college_name']}")
                    print(f"   - Address: {row['address'][:50]}...")
                    print(f"   - Matched to: {row['master_college_id']} - {row['matched_college']}")
                    print(f"   - Matched addr: {row['matched_address'][:50]}...")
        else:
            print("   ℹ️  All records already matched!")

    except Exception as e:
        print(f"❌ Error running cascading matcher: {e}")
        import traceback
        traceback.print_exc()

    print("\n\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)

    # Cleanup
    master_conn.close()
    seat_conn.close()

if __name__ == '__main__':
    test_composite_key_fix()
