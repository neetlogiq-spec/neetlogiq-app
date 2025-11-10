#!/usr/bin/env python3
"""
Test that all matching fixes work correctly
"""

import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from recent3 import AdvancedSQLiteMatcher
import sqlite3

db_path = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db'

print("=" * 80)
print("TESTING: Matching System Fixes")
print("=" * 80)

# Initialize matcher
print("\n1️⃣  Initializing matcher...")
try:
    matcher = AdvancedSQLiteMatcher(db_path)
    print("✅ Matcher initialized")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

# Test 1: Check composite_college_key format
print("\n2️⃣  Testing composite_college_key format...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
    SELECT id, name, address, composite_college_key
    FROM medical_colleges
    WHERE composite_college_key LIKE '%,%'
    LIMIT 3
""")

for row in cursor.fetchall():
    expected = f"{row[1]}, {row[2]}"
    actual = row[3]
    if actual == expected:
        print(f"   ✅ {row[0]}: {actual[:60]}...")
    else:
        print(f"   ❌ {row[0]}: Expected '{expected}', got '{actual}'")

# Test 2: State normalization
print("\n3️⃣  Testing state normalization...")
test_states = [
    ("DELHI", "DELHI (NCT)"),
    ("DELHI NCR", "DELHI (NCT)"),
    ("ORISSA", "ODISHA"),
    ("KARNATAKA", "KARNATAKA"),
    ("NEW DELHI", "DELHI (NCT)")
]

for input_state, expected_state in test_states:
    normalized = matcher.normalize_state_name_import(input_state)
    if normalized.upper() == expected_state.upper():
        print(f"   ✅ {input_state} → {normalized}")
    else:
        print(f"   ❌ {input_state} → Expected {expected_state}, got {normalized}")

# Test 3: Fast path composite_college_key lookup
print("\n4️⃣  Testing fast_path_composite_key_lookup...")

# Find a test college
cursor.execute("""
    SELECT name, address, state
    FROM colleges
    WHERE state = 'KARNATAKA'
    LIMIT 1
""")

result = cursor.fetchone()
if result:
    test_name, test_address, test_state = result
    print(f"   Testing with: {test_name[:50]} in {test_state}")

    lookup_result = matcher.fast_path_composite_key_lookup(test_name, test_address, test_state)
    if lookup_result:
        print(f"   ✅ Found: {lookup_result['name'][:50]} (ID: {lookup_result['id']})")
    else:
        print(f"   ❌ Not found using composite_college_key")
else:
    print("   ⚠️  No test data available")

# Test 4: Test colleges that were missing before
print("\n5️⃣  Testing colleges that had NO MATCH errors...")

test_colleges = [
    ("GOVERNMENT MEDICAL COLLEGE", "ANDHRA PRADESH"),
    ("KASTURBA MEDICAL COLLEGE", "KARNATAKA"),
    ("GOVERNMENT MEDICAL COLLEGE", "KERALA"),
]

for college_name, state in test_colleges:
    print(f"   Testing: {college_name} in {state}")

    # Try to find colleges matching this name in this state
    cursor.execute("""
        SELECT id, name, address, state
        FROM colleges
        WHERE state = ? AND name LIKE ?
        LIMIT 1
    """, (state, f"%{college_name.split()[0]}%{college_name.split()[-1]}%"))

    db_result = cursor.fetchone()
    if db_result:
        print(f"      ✅ Found in DB: {db_result[0]} - {db_result[1][:50]}")
    else:
        print(f"      ❌ Not found in DB")

conn.close()

print("\n" + "=" * 80)
print("✅ TEST COMPLETE")
print("=" * 80)
print("\nNext steps:")
print("1. Run full matching to verify colleges are matched correctly")
print("2. Validate that false matches are eliminated")
print("3. Run validation checks to verify data integrity")
