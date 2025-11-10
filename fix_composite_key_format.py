#!/usr/bin/env python3
"""
Fix composite_college_key format from 'name | address' to 'name, address'
"""

import sqlite3
import pandas as pd

db_path = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

print("=" * 80)
print("FIX: composite_college_key format - FROM 'name | address' TO 'name, address'")
print("=" * 80)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Fix all three college tables
for table_name in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
    print(f"\n1️⃣  Fixing {table_name}...")

    try:
        # Read all records
        df = pd.read_sql_query(f"SELECT id, name, address FROM {table_name}", conn)
        print(f"   Total records: {len(df)}")

        # Create correct format
        for idx, row in df.iterrows():
            key = f"{row['name']}, {row['address']}" if row['address'] else row['name']
            cursor.execute(
                f"UPDATE {table_name} SET composite_college_key = ? WHERE id = ?",
                (key, row['id'])
            )
            if (idx + 1) % 200 == 0:
                print(f"   Updated {idx + 1}/{len(df)}")

        conn.commit()
        print(f"   ✅ Fixed all {len(df)} records")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        conn.rollback()

# Verify
print(f"\n2️⃣  Verifying format...")
cursor.execute("SELECT id, name, address, composite_college_key FROM medical_colleges LIMIT 3")
for row in cursor.fetchall():
    print(f"   ID: {row[0]}")
    print(f"   CompositeKey: {row[3]}")
    expected = f"{row[1]}, {row[2]}"
    if row[3] == expected:
        print(f"   ✅ Format is correct")
    else:
        print(f"   ❌ Format mismatch!")
        print(f"      Expected: {expected}")
        print(f"      Got: {row[3]}")

conn.close()

print("\n" + "=" * 80)
print("✅ FIX COMPLETE")
print("=" * 80)
