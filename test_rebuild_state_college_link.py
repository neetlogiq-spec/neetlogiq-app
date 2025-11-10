#!/usr/bin/env python3
"""
Test that rebuild_state_college_link function works after composite_college_key migration
"""

import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from recent3 import AdvancedSQLiteMatcher
import sqlite3
from pathlib import Path

db_path = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

print("=" * 80)
print("TESTING: Rebuild State-College Link (with composite_college_key fix)")
print("=" * 80)

# Initialize matcher
print("\n1️⃣  Creating matcher...")
try:
    matcher = AdvancedSQLiteMatcher(db_path)
    print("✅ Matcher created successfully")
except Exception as e:
    print(f"❌ Error creating matcher: {e}")
    exit(1)

# Test rebuild_state_college_link
print("\n2️⃣  Testing rebuild_state_college_link function...")
try:
    print("   Calling rebuild_state_college_link()...")
    matcher.rebuild_state_college_link()
    print("   ✅ Function executed successfully!")
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Verify state_college_link table
print("\n3️⃣  Verifying state_college_link table...")
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM state_college_link")
    total_records = cursor.fetchone()[0]
    print(f"   ✅ Total records in state_college_link: {total_records}")

    # Check columns
    cursor.execute("PRAGMA table_info(state_college_link)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"   ✅ Columns: {', '.join(columns[:5])}...")

    # Sample data
    cursor.execute("""
        SELECT college_id, state, normalized_state, composite_college_key
        FROM state_college_link
        LIMIT 3
    """)

    print(f"\n   Sample records:")
    for row in cursor.fetchall():
        print(f"      College: {row[0]} | State: {row[1]} | Normalized: {row[2]}")

    conn.close()
except Exception as e:
    print(f"   ❌ Error verifying table: {e}")
    exit(1)

print("\n" + "=" * 80)
print("✅ ALL TESTS PASSED!")
print("=" * 80)
