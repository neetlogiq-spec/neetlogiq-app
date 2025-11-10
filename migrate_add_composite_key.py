#!/usr/bin/env python3
"""
Migration script to add composite_college_key column to existing college tables
"""

import sqlite3
import pandas as pd
import sys
from pathlib import Path

# Add recent3.py to path to use functions
sys.path.insert(0, '/Users/kashyapanand/Public/New')
from recent3 import AdvancedSQLiteMatcher

db_path = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

print("=" * 80)
print("MIGRATION: Adding composite_college_key to existing college tables")
print("=" * 80)

# Initialize matcher to get normalization functions
matcher = AdvancedSQLiteMatcher(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check and fix medical_colleges
print("\n1️⃣  Processing medical_colleges...")
cursor.execute("PRAGMA table_info(medical_colleges)")
columns = [col[1] for col in cursor.fetchall()]

if 'composite_college_key' not in columns:
    print("   Adding composite_college_key column...")
    try:
        cursor.execute("ALTER TABLE medical_colleges ADD COLUMN composite_college_key TEXT")
        conn.commit()
        print("   ✓ Column added")
    except Exception as e:
        print(f"   ✗ Error adding column: {e}")
        conn.close()
        exit(1)
else:
    print("   ✓ Column already exists")

# Populate composite_college_key for medical_colleges
print("   Populating composite_college_key values...")
try:
    df = pd.read_sql_query(
        "SELECT id, name, address FROM medical_colleges WHERE composite_college_key IS NULL OR composite_college_key = ''",
        conn
    )

    if len(df) > 0:
        print(f"   Found {len(df)} records without composite_college_key")

        for idx, row in df.iterrows():
            # Use RAW name + comma + RAW address format (matches load_master_data and state_college_link)
            key = f"{row['name']}, {row['address']}" if row['address'] else row['name']
            cursor.execute(
                "UPDATE medical_colleges SET composite_college_key = ? WHERE id = ?",
                (key, row['id'])
            )
            if (idx + 1) % 100 == 0:
                print(f"   Processed {idx + 1}/{len(df)}")

        conn.commit()
        print(f"   ✅ Updated {len(df)} records")
    else:
        print("   ✓ All records already have composite_college_key")

except Exception as e:
    print(f"   ✗ Error populating values: {e}")
    conn.rollback()
    conn.close()
    exit(1)

# Check and fix dental_colleges
print("\n2️⃣  Processing dental_colleges...")
cursor.execute("PRAGMA table_info(dental_colleges)")
columns = [col[1] for col in cursor.fetchall()]

if 'composite_college_key' not in columns:
    print("   Adding composite_college_key column...")
    try:
        cursor.execute("ALTER TABLE dental_colleges ADD COLUMN composite_college_key TEXT")
        conn.commit()
        print("   ✓ Column added")
    except Exception as e:
        print(f"   ✗ Error adding column: {e}")
        conn.close()
        exit(1)
else:
    print("   ✓ Column already exists")

# Populate composite_college_key for dental_colleges
print("   Populating composite_college_key values...")
try:
    df = pd.read_sql_query(
        "SELECT id, name, address FROM dental_colleges WHERE composite_college_key IS NULL OR composite_college_key = ''",
        conn
    )

    if len(df) > 0:
        print(f"   Found {len(df)} records without composite_college_key")

        for idx, row in df.iterrows():
            # Use RAW name + comma + RAW address format (matches load_master_data and state_college_link)
            key = f"{row['name']}, {row['address']}" if row['address'] else row['name']
            cursor.execute(
                "UPDATE dental_colleges SET composite_college_key = ? WHERE id = ?",
                (key, row['id'])
            )
            if (idx + 1) % 100 == 0:
                print(f"   Processed {idx + 1}/{len(df)}")

        conn.commit()
        print(f"   ✅ Updated {len(df)} records")
    else:
        print("   ✓ All records already have composite_college_key")

except Exception as e:
    print(f"   ✗ Error populating values: {e}")
    conn.rollback()
    conn.close()
    exit(1)

# Verify all tables now have the column with values
print("\n3️⃣  Verifying migration...")
for table_name in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
    cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE composite_college_key IS NOT NULL AND composite_college_key != ''")
    count = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    total = cursor.fetchone()[0]

    if count == total:
        print(f"   ✅ {table_name}: {count}/{total} records have composite_college_key")
    else:
        print(f"   ⚠️  {table_name}: {count}/{total} records have composite_college_key")

# Test the colleges view
print("\n4️⃣  Testing colleges view...")
try:
    cursor.execute("SELECT COUNT(*) FROM colleges")
    count = cursor.fetchone()[0]
    print(f"   ✅ colleges view works! Total colleges: {count}")

    # Test sample query
    cursor.execute("SELECT id, name, composite_college_key FROM colleges LIMIT 3")
    print(f"   ✅ Sample query successful")
except Exception as e:
    print(f"   ❌ Error with colleges view: {e}")

conn.close()

print("\n" + "=" * 80)
print("✅ MIGRATION COMPLETE")
print("=" * 80)
