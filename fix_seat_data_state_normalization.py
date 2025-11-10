#!/usr/bin/env python3
"""
Fix seat data state normalization after reimport.

This script normalizes all state names in the seat_data table using the
normalize_state_name_import mapping. This ensures that:
- DELHI and DELHI (NCT) both become DELHI (NCT)
- ODISHA and ORISSA both become ODISHA
- All other state variants are normalized to canonical names

This fixes the uniqueness constraint violation on state_college_link.
"""

import sqlite3
import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from recent3 import AdvancedSQLiteMatcher

print("="*80)
print("FIX: Normalize seat_data state names after reimport")
print("="*80)

try:
    # Initialize matcher to get configuration
    matcher = AdvancedSQLiteMatcher(data_type='seat')
    matcher.load_master_data()

    # Get seat data path
    db_path = f"{matcher.config['database']['sqlite_path']}/{matcher.config['database']['seat_data_db']}"
    print(f"\n📂 Seat data database: {db_path}")

    # Connect to seat_data database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check current state of seat_data
    cursor.execute("SELECT COUNT(*) FROM seat_data")
    total_records = cursor.fetchone()[0]
    print(f"📊 Total records in seat_data: {total_records:,}")

    # Get unique state values currently in seat_data
    cursor.execute("""
        SELECT DISTINCT state, COUNT(*) as count
        FROM seat_data
        GROUP BY state
        ORDER BY count DESC
    """)
    states = cursor.fetchall()
    print(f"\n📋 States in seat_data (BEFORE normalization):")
    print("-" * 60)
    for state, count in states:
        print(f"  {state:30s} : {count:6,d} records")

    # Normalize each state using the matcher's normalization function
    print(f"\n🔄 Normalizing states...")
    print("-" * 60)

    # Create a mapping of raw state -> normalized state
    state_mapping = {}
    for raw_state, _ in states:
        if raw_state and str(raw_state).strip():
            normalized = matcher.normalize_state_name_import(raw_state)
            state_mapping[raw_state] = normalized
            if raw_state != normalized:
                print(f"  {raw_state:30s} → {normalized}")

    # Update seat_data with normalized state names
    print(f"\n💾 Updating normalized_state column...")

    for raw_state, normalized_state in state_mapping.items():
        if raw_state and normalized_state:
            cursor.execute("""
                UPDATE seat_data
                SET normalized_state = ?
                WHERE state = ?
            """, (normalized_state, raw_state))

            affected = cursor.rowcount
            if affected > 0:
                print(f"  Updated {affected:6,d} records: {raw_state} → {normalized_state}")

    conn.commit()

    # Verify the update
    cursor.execute("""
        SELECT DISTINCT normalized_state, COUNT(*) as count
        FROM seat_data
        GROUP BY normalized_state
        ORDER BY count DESC
    """)
    normalized_states = cursor.fetchall()
    print(f"\n✅ Normalized states (AFTER normalization):")
    print("-" * 60)
    for state, count in normalized_states:
        print(f"  {state:30s} : {count:6,d} records")

    # Check for NULL normalized_state
    cursor.execute("""
        SELECT COUNT(*) FROM seat_data WHERE normalized_state IS NULL
    """)
    null_count = cursor.fetchone()[0]
    if null_count > 0:
        print(f"\n⚠️  WARNING: {null_count:,d} records still have NULL normalized_state")
    else:
        print(f"\n✅ All records have normalized_state values")

    conn.close()

    print("\n" + "="*80)
    print("✅ STATE NORMALIZATION COMPLETE")
    print("="*80)
    print("\nThe seat_data table now has normalized state names.")
    print("The uniqueness constraint on state_college_link should be resolved.")
    print("\nYou can now run the matching process again.")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
