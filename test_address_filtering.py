import sys
import logging
from rich.console import Console
from agentic_matcher import AgenticMatcher

# Configure logging
logging.basicConfig(level=logging.DEBUG)
console = Console()

matcher = AgenticMatcher()

test_cases = [
    {
        "course_type": "medical",
        "record": {
            "college_name": "GOVERNMENT MEDICAL COLLEGE",
            "state": "MAHARASHTRA",
            "address": "GOVT MEDICAL COLLEGE, NANAL PETH, PARBHANI"
        },
        "expected_keyword": "PARBHANI"
    },
    {
        "course_type": "dental",
        "record": {
            "college_name": "GOVERNMENT DENTAL COLLEGE & HOSPITAL",
            "state": "MAHARASHTRA",
            "address": "GOVERNMENT DENTAL COLLEGE & HOSPITAL, P.D.MELLO ROAD, FORT, MUMBAI"
        },
        "expected_keyword": "MUMBAI"
    },
    # The tricky DNB case
    {
        "course_type": "dnb",
        "record": {
            "college_name": "AREA HOSPITAL",  # Generic name
            "state": "ANDHRA PRADESH",
            "address": "AREA HOSPITAL, AMALAPURAM, EAST GODAVARI DIST., ANDHRA PRADESH"
        },
        "expected_keyword": "AMALAPURAM"
    },
    # Complex address
    {
        "course_type": "medical",
        "record": {
            "college_name": "ESIC MEDICAL COLLEGE",
            "state": "TAMIL NADU",
            "address": "ESIC Medical College and PGIMSR, Ashok Pillar Road, K. K. Nagar, Chennai - 600 078"
        },
        "expected_keyword": "CHENNAI"
    }
]

print("\nRunning Address Filtering Tests...\n")

for i, test in enumerate(test_cases):
    print(f"Test Case {i+1}: {test['record']['college_name']} ({test['course_type']})")
    print(f"Address: {test['record']['address']}")
    
    candidates = matcher._prefilter_with_fts(
        test['record'], 
        course_type=test['course_type'],
        top_n=10
    )
    
    found = False
    
    if not candidates:
        print("❌ No candidates found via FTS.")
    else:
        print(f"Found {len(candidates)} candidates.")
        for idx, c in enumerate(candidates):
            # Check if expected keyword is in candidate address
            master_addr = c.get('address', '').upper()
            keyword = test['expected_keyword'].upper()
            
            is_match = keyword in master_addr
            status = "✅ MATCH" if is_match else "❌"
            
            if is_match: found = True
            
            print(f"  [{idx+1}] {c['name']} | {c['state']} | {c['address']} -> {status}")

    if found:
        print(f"✅ Test Passed: Found match for '{test['expected_keyword']}'")
    else:
        print(f"❌ Test Failed: Could not find candidate matching '{test['expected_keyword']}'")
    print("-" * 50)
