#!/usr/bin/env python3
"""
Test that composite_college_key column is created during import and persists
"""

import sqlite3
import pandas as pd
from pathlib import Path

# Database path
db_path = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

print("=" * 80)
print("TESTING: Composite College Key Column Creation and Persistence")
print("=" * 80)

# Check if database exists
if not Path(db_path).exists():
    print(f"✗ Database not found: {db_path}")
    exit(1)

print("\n1️⃣  Checking composite_college_key column in college tables...")
print("-" * 80)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check each college table
tables_to_check = ['medical_colleges', 'dental_colleges', 'dnb_colleges', 'colleges']

for table_name in tables_to_check:
    try:
        # Get column info
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]

        if 'composite_college_key' in column_names:
            # Count non-null values
            cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE composite_college_key IS NOT NULL AND composite_college_key != ''")
            count = cursor.fetchone()[0]

            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total = cursor.fetchone()[0]

            print(f"✅ {table_name}")
            print(f"   ├─ Column exists: YES")
            print(f"   ├─ Total records: {total}")
            print(f"   └─ Records with composite_college_key: {count}/{total} ({100*count//max(total,1)}%)")
        else:
            print(f"❌ {table_name}")
            print(f"   └─ composite_college_key column MISSING")
            print(f"   └─ Available columns: {', '.join(column_names[:5])}...")
    except Exception as e:
        print(f"⚠️  {table_name}: {str(e)}")

print("\n2️⃣  Checking if rebuild_state_college_link function can work...")
print("-" * 80)

try:
    # Check if state_college_link table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='state_college_link'")
    result = cursor.fetchone()
    if result:
        cursor.execute("SELECT COUNT(*) FROM state_college_link")
        count = cursor.fetchone()[0]
        print(f"✅ state_college_link table exists with {count} records")
    else:
        print(f"ℹ️  state_college_link table doesn't exist yet (will be created by rebuild_state_college_link)")
except Exception as e:
    print(f"❌ Error checking state_college_link: {e}")

print("\n3️⃣  Sample data from medical_colleges...")
print("-" * 80)

try:
    df = pd.read_sql_query(
        "SELECT id, name, state, composite_college_key FROM medical_colleges LIMIT 3",
        conn
    )
    if len(df) > 0:
        print(df.to_string(index=False))
    else:
        print("No records in medical_colleges table")
except Exception as e:
    print(f"Error reading sample data: {e}")

conn.close()

print("\n" + "=" * 80)
print("✅ TEST COMPLETE")
print("=" * 80)
