#!/usr/bin/env python3
"""
Test unified normalization consistency between matching and import functions
"""

import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from recent3 import AdvancedSQLiteMatcher

print("="*80)
print("TESTING: Unified Normalization Consistency")
print("="*80)

# Initialize matcher
matcher = AdvancedSQLiteMatcher(data_type='dental')

print("\n✅ Matcher initialized\n")

# Test cases with special characters
test_cases = [
    ("ADESH INSTITUTE OF DENTAL SCIENCES & RESEARCH",
     "Tests & character (should become AND)"),

    ("ADHIPARASAKTHI DENTAL COLLEGE & HOSPITAL",
     "Tests & in middle (should become AND)"),

    ("JOHN'S DENTAL COLLEGE",
     "Tests apostrophe (should be preserved)"),

    ("POST-GRADUATE DENTAL INSTITUTE",
     "Tests hyphen (should be preserved)"),

    ("GOVT. DENTAL COLLEGE, BANGALORE",
     "Tests abbreviated GOVT and dots"),
]

print("[bold cyan]Test Cases:[/bold cyan]")
print("-" * 80)

for college_name, description in test_cases:
    normalized = matcher.normalize_text(college_name)
    print(f"\n{description}")
    print(f"  Original:   {college_name}")
    print(f"  Normalized: {normalized}")

print("\n" + "="*80)
print("VERIFICATION")
print("="*80)

# Verify specific transformations
checks = [
    ("ADESH INSTITUTE OF DENTAL SCIENCES & RESEARCH",
     "AND",
     "& should become AND"),

    ("ADHIPARASAKTHI DENTAL COLLEGE & HOSPITAL",
     "AND",
     "& should become AND"),

    ("JOHN'S DENTAL COLLEGE",
     "'",
     "Apostrophe should be preserved"),

    ("POST-GRADUATE INSTITUTE",
     "-",
     "Hyphen should be preserved"),
]

print("\nSpecific checks:")
print("-" * 80)

all_passed = True
for college, expected_substring, description in checks:
    normalized = matcher.normalize_text(college)
    has_expected = expected_substring in normalized
    status = "✅ PASS" if has_expected else "❌ FAIL"
    all_passed = all_passed and has_expected

    print(f"\n{description}")
    print(f"  Expected: '{expected_substring}' in normalized result")
    print(f"  Result: {status}")
    if not has_expected:
        print(f"  Got: {normalized}")

print("\n" + "="*80)
if all_passed:
    print("✅ ALL TESTS PASSED - Unified normalization is working correctly!")
else:
    print("❌ SOME TESTS FAILED - Check normalization configuration")
print("="*80)

