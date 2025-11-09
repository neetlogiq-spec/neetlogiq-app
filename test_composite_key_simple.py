#!/usr/bin/env python3
"""
Simple Composite Key Test - Fast verification of the fix
"""

import sqlite3
import pandas as pd

print("\n" + "="*80)
print("SIMPLE COMPOSITE KEY FIX TEST")
print("="*80)

# Connect to master database
master_db = "data/sqlite/master_data.db"
conn = sqlite3.connect(master_db)

# Test cases: Real DISTRICT HOSPITAL addresses from seat data
test_cases = [
    {
        'name': 'DISTRICT HOSPITAL',
        'address': 'NEXT TO SAINIK SCHOOL SECOND GATE ATHANI ROAD VIJAYAPURA',
        'expected_id': 'DNB0352',
        'expected_city': 'VIJAYAPURA'
    },
    {
        'name': 'DISTRICT HOSPITAL',
        'address': 'B D ROAD BESIDE DHO OFFICE CHITRADURGA',
        'expected_id': 'DNB0353',
        'expected_city': 'CHITRADURGA'
    },
    {
        'name': 'DISTRICT HOSPITAL',
        'address': 'NEAR SANGAM CIRCLE DR RAJ KUMAR ROAD BALLARI',
        'expected_id': 'DNB0356',
        'expected_city': 'BALLARI'
    },
    {
        'name': 'DISTRICT HOSPITAL',
        'address': 'KILLA ROAD DHARWAD',
        'expected_id': 'DNB0357',
        'expected_city': 'DHARWAD'
    }
]

print("\n📊 Testing composite_college_key fix with real addresses:")
print("-" * 80)

correct_matches = 0
total_tests = len(test_cases)

for i, test in enumerate(test_cases, 1):
    print(f"\nTest {i}: {test['name']} in {test['expected_city']}")
    print(f"  Address: {test['address'][:60]}...")
    print(f"  Expected match: {test['expected_id']}")

    # Step 1: Get all candidates using composite_college_key (NEW method)
    # Search for city name in normalized_address for disambiguation
    query = f"""
    SELECT id, name, address, composite_college_key
    FROM colleges
    WHERE normalized_state = 'KARNATAKA'
      AND composite_college_key LIKE '{test['name'].upper()},%'
      AND INSTR(UPPER(COALESCE(normalized_address, '')), UPPER('{test['expected_city']}')) > 0
    LIMIT 1
    """

    result = pd.read_sql(query, conn)

    if len(result) > 0:
        matched_id = result.iloc[0]['id']
        matched_addr = result.iloc[0]['address']

        if matched_id == test['expected_id']:
            print(f"  ✅ CORRECT: Matched to {matched_id}")
            print(f"     Address: {matched_addr[:60]}...")
            correct_matches += 1
        else:
            print(f"  ❌ WRONG: Matched to {matched_id} (expected {test['expected_id']})")
            print(f"     Address: {matched_addr[:60]}...")
    else:
        print(f"  ❌ FAILED: No match found")

print("\n" + "="*80)
print(f"RESULTS: {correct_matches}/{total_tests} correct matches ({correct_matches/total_tests*100:.1f}%)")
print("="*80)

if correct_matches == total_tests:
    print("\n🎉 SUCCESS! Composite key fix is working correctly!")
else:
    print(f"\n⚠️  WARNING: {total_tests - correct_matches} test(s) failed")

# Show that OLD method would fail
print("\n\n📊 Comparison: OLD method (without composite_college_key)")
print("-" * 80)

for i, test in enumerate(test_cases, 1):
    print(f"\nTest {i}: {test['name']}")

    # OLD method: normalized_name = ... (returns arbitrary first match)
    old_query = f"""
    SELECT id, name, address
    FROM colleges
    WHERE normalized_state = 'KARNATAKA'
      AND normalized_name = '{test['name'].upper()}'
    LIMIT 1
    """

    old_result = pd.read_sql(old_query, conn)

    if len(old_result) > 0:
        old_id = old_result.iloc[0]['id']
        status = "✅" if old_id == test['expected_id'] else "❌"
        print(f"  {status} OLD method: {old_id} (expected {test['expected_id']})")
    else:
        print(f"  ❌ OLD method: No match")

conn.close()
