#!/usr/bin/env python3
"""
Test script for pincode validation and extraction functionality

Tests:
1. Pincode extraction from various address formats
2. State pincode range validation
3. Pincode match boost calculation
4. Integration with match scoring
"""

import sys
import sqlite3
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from recent3 import AdvancedSQLiteMatcher

def test_pincode_extraction():
    """Test pincode extraction from various address formats"""
    print("\n" + "="*80)
    print("TEST 1: Pincode Extraction")
    print("="*80)

    matcher = AdvancedSQLiteMatcher()

    test_cases = [
        # (address, expected_pincode)
        ("AREA HOSPITAL VICTORIAPET ADONI 518301", "518301"),
        ("SADAR HOSPITAL, KASHIPUR, UTTARAKHAND 244713", "244713"),
        ("GOVERNMENT MEDICAL COLLEGE, DELHI 110001", "110001"),
        ("HOSPITAL WITHOUT PINCODE", None),
        ("123456 INVALID LEADING PINCODE", "123456"),  # Valid extraction but invalid range
        ("HOSPITAL, INDIA 100000", "100000"),  # Edge case: min valid
        ("HOSPITAL, INDIA 999999", "999999"),  # Edge case: max valid
        ("HOSPITAL 099999 INVALID", None),  # Too many leading zeros
        ("", None),  # Empty
        ("NULL", None),  # NULL-like
    ]

    passed = 0
    failed = 0

    for address, expected in test_cases:
        result = matcher.extract_pincode(address)
        status = "✅" if result == expected else "❌"

        if result == expected:
            passed += 1
        else:
            failed += 1

        print(f"{status} Address: '{address}'")
        print(f"   Expected: {expected}, Got: {result}")

    print(f"\n📊 Extraction Test Results: {passed} passed, {failed} failed")
    return failed == 0


def test_pincode_state_validation():
    """Test if extracted pincodes match expected state ranges"""
    print("\n" + "="*80)
    print("TEST 2: Pincode State Validation")
    print("="*80)

    matcher = AdvancedSQLiteMatcher()

    test_cases = [
        # (pincode, state, should_be_valid)
        ("518301", "ANDHRA PRADESH", True),   # Adoni, AP
        ("244713", "UTTARAKHAND", True),      # Kashipur, Uttarakhand
        ("110001", "DELHI", True),            # Delhi
        ("560001", "KARNATAKA", True),        # Bangalore, Karnataka
        ("244713", "ANDHRA PRADESH", False),  # UT pincode in AP
        ("518301", "KARNATAKA", False),       # AP pincode in Karnataka
        ("123456", "DELHI", False),           # Invalid pincode
        ("", "DELHI", False),                 # Empty pincode
        ("NOTAPIN", "DELHI", False),          # Non-numeric
    ]

    passed = 0
    failed = 0

    for pincode, state, should_be_valid in test_cases:
        result = matcher.validate_pincode_for_state(pincode, state)
        status = "✅" if result == should_be_valid else "❌"

        if result == should_be_valid:
            passed += 1
        else:
            failed += 1

        validity_str = "VALID" if should_be_valid else "INVALID"
        print(f"{status} Pincode {pincode} in {state}: Expected {validity_str}, Got {'VALID' if result else 'INVALID'}")

    print(f"\n📊 Validation Test Results: {passed} passed, {failed} failed")
    return failed == 0


def test_pincode_match_boost():
    """Test pincode match boost calculation"""
    print("\n" + "="*80)
    print("TEST 3: Pincode Match Boost Calculation")
    print("="*80)

    matcher = AdvancedSQLiteMatcher()

    test_cases = [
        # (master_pin, seat_pin, master_state, seat_state, expected_boost_range)
        ("518301", "518301", "ANDHRA PRADESH", "ANDHRA PRADESH", (0.20, 0.25)),  # Exact match
        ("244713", "244713", "UTTARAKHAND", "UTTARAKHAND", (0.20, 0.25)),         # Exact match
        ("518301", None, "ANDHRA PRADESH", "ANDHRA PRADESH", (0.00, 0.10)),       # One missing
        (None, "518301", "ANDHRA PRADESH", "ANDHRA PRADESH", (0.00, 0.10)),       # One missing
        (None, None, "ANDHRA PRADESH", "ANDHRA PRADESH", (-0.05, 0.05)),          # Both missing
        ("518301", "560001", "ANDHRA PRADESH", "KARNATAKA", (-0.20, 0.0)),        # Different pincodes, diff states
    ]

    passed = 0
    failed = 0

    for master_pin, seat_pin, master_state, seat_state, (min_expected, max_expected) in test_cases:
        result = matcher.get_pincode_match_boost(master_pin, seat_pin, master_state, seat_state)
        boost = result['confidence_boost']

        is_in_range = min_expected <= boost <= max_expected
        status = "✅" if is_in_range else "❌"

        if is_in_range:
            passed += 1
        else:
            failed += 1

        print(f"{status} Master: {master_pin}, Seat: {seat_pin}")
        print(f"   Expected boost in [{min_expected:+.2f}, {max_expected:+.2f}], Got: {boost:+.2f}")
        print(f"   Reason: {result['reason']}")

    print(f"\n📊 Boost Test Results: {passed} passed, {failed} failed")
    return failed == 0


def test_address_pincode_extraction_real_data():
    """Test pincode extraction from real-world master data"""
    print("\n" + "="*80)
    print("TEST 4: Real-World Address Pincode Extraction")
    print("="*80)

    try:
        conn = sqlite3.connect("/Users/kashyapanand/Public/New/data/sqlite/master_data.db")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        matcher = AdvancedSQLiteMatcher()

        # Get some real addresses from medical colleges
        cursor.execute("SELECT name, address FROM medical_colleges LIMIT 5")
        rows = cursor.fetchall()

        if not rows:
            print("⚠️  No medical colleges found in database")
            return True

        print(f"Testing pincode extraction from {len(rows)} real addresses:\n")

        for row in rows:
            address = row['address']
            pincode = matcher.extract_pincode(address)

            status = "✅" if pincode else "⚠️"
            print(f"{status} College: {row['name']}")
            print(f"   Address: {address}")
            print(f"   Pincode: {pincode if pincode else 'NOT FOUND'}")
            print()

        conn.close()
        return True

    except Exception as e:
        print(f"❌ Error reading database: {e}")
        return False


def test_state_pincode_ranges():
    """Verify state pincode ranges are defined for all states"""
    print("\n" + "="*80)
    print("TEST 5: State Pincode Ranges Coverage")
    print("="*80)

    matcher = AdvancedSQLiteMatcher()
    ranges = matcher.get_state_pincode_ranges()

    print(f"Defined pincode ranges for {len(ranges)} states/UTs:\n")

    for state in sorted(ranges.keys()):
        range_list = ranges[state]
        print(f"  ✅ {state:30} → {len(range_list)} range(s)")
        for start, end in range_list:
            print(f"     {start:6} - {end:6}")

    return True


def run_all_tests():
    """Run all tests and print summary"""
    print("\n" + "="*80)
    print("PINCODE VALIDATION TEST SUITE")
    print("="*80)

    results = []

    # Test 1: Extraction
    results.append(("Pincode Extraction", test_pincode_extraction()))

    # Test 2: State Validation
    results.append(("Pincode State Validation", test_pincode_state_validation()))

    # Test 3: Boost Calculation
    results.append(("Pincode Match Boost", test_pincode_match_boost()))

    # Test 4: Real Data
    results.append(("Real-World Extraction", test_address_pincode_extraction_real_data()))

    # Test 5: Coverage
    results.append(("State Pincode Ranges", test_state_pincode_ranges()))

    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    passed_count = sum(1 for _, result in results if result)
    failed_count = len(results) - passed_count

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\n📊 Overall: {passed_count}/{len(results)} test groups passed")

    if failed_count == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {failed_count} test group(s) failed")
        return 1


if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)
