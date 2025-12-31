from recent3 import AdvancedSQLiteMatcher
import pandas as pd

print("Initializing AdvancedSQLiteMatcher...")
# Initialize with config_path to ensure config.yaml is loaded
neet = AdvancedSQLiteMatcher(config_path='config.yaml')

# Check if abbreviations are loaded correctly in existing instance
print("Checking loaded abbreviations in instance...")
abbrevs = neet.abbreviations
print(f"Loaded {len(abbrevs)} abbreviations.")

# Verify specific keys from config.yaml
expected_keys = ['GOVT', 'ESIC', 'AIIMS']
for k in expected_keys:
    if k in abbrevs:
        print(f"✅ Found {k}: {abbrevs[k]}")
    else:
        print(f"❌ Missing {k} in loaded abbreviations!")

# Test normalization
test_cases = [
    ("GOVT MEDICAL COLLEGE", "GOVERNMENT MEDICAL COLLEGE"),
    ("ESIC MEDICAL COLLEGE", "EMPLOYEES STATE INSURANCE CORPORATION MEDICAL COLLEGE"),
    ("AIIMS DELHI", "ALL INDIA INSTITUTE OF MEDICAL SCIENCES DELHI")
]

print("\nTesting Normalization...")
for input_text, expected in test_cases:
    result = neet.normalize_text_for_import(input_text)
    print(f"Input: '{input_text}'")
    print(f"Output: '{result}'")
    print(f"Expected: '{expected}'")
    
    if result == expected:
        print("✅ MATCH")
        # Double check that we aren't just getting lucky (e.g. input == output if no expansion happened)
        if input_text != result:
             print("   (Expansion occurred)")
    else:
        print("❌ MISMATCH")
    print("-" * 30)
