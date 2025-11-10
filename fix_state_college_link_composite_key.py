#!/usr/bin/env python3
"""
Fix state_college_link composite_college_key column by populating it from college data
"""

import sqlite3
import pandas as pd

db_path = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

print("=" * 80)
print("FIX: Populate composite_college_key in state_college_link")
print("=" * 80)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n1️⃣  Checking state_college_link structure...")

# Get current state_college_link data
cursor.execute("""
    SELECT college_id, college_name, address, state
    FROM state_college_link
    WHERE composite_college_key IS NULL OR composite_college_key = ''
    LIMIT 5
""")

null_records = cursor.fetchall()
print(f"   Found {len(null_records)} records with NULL composite_college_key")

if null_records:
    print(f"   Sample: {null_records[0]}")

# Get all records that need updating
cursor.execute("""
    SELECT COUNT(*)
    FROM state_college_link
    WHERE composite_college_key IS NULL OR composite_college_key = ''
""")

total_null = cursor.fetchone()[0]
print(f"   Total records to update: {total_null}")

if total_null > 0:
    print("\n2️⃣  Updating composite_college_key...")

    # Create composite_college_key from college_name and address
    cursor.execute("""
        UPDATE state_college_link
        SET composite_college_key = college_name || ', ' || address
        WHERE composite_college_key IS NULL OR composite_college_key = ''
    """)

    conn.commit()
    print(f"   ✅ Updated {cursor.rowcount} records")

    # Verify
    print("\n3️⃣  Verifying update...")

    cursor.execute("""
        SELECT COUNT(*)
        FROM state_college_link
        WHERE composite_college_key IS NOT NULL AND composite_college_key != ''
    """)

    updated_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM state_college_link")
    total_count = cursor.fetchone()[0]

    if updated_count == total_count:
        print(f"   ✅ All {total_count} records have composite_college_key")
    else:
        print(f"   ⚠️  {updated_count}/{total_count} records have composite_college_key")

    # Show sample
    print("\n4️⃣  Sample data after update...")
    cursor.execute("""
        SELECT college_id, college_name, address, composite_college_key
        FROM state_college_link
        LIMIT 3
    """)

    for row in cursor.fetchall():
        print(f"   ID: {row[0]}")
        print(f"   CompositeKey: {row[3]}")
        print()
else:
    print("   ✓ All records already have composite_college_key")

conn.close()

print("=" * 80)
print("✅ FIX COMPLETE")
print("=" * 80)
