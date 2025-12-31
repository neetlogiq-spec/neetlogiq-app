#!/usr/bin/env python3
"""
Detailed trace of WHY LLM/TF-IDF pre-filter rejects group 1341 candidates
"""

import sqlite3
import sys
import logging
sys.path.insert(0, '.')

# Enable DEBUG logging for agentic matcher
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s - %(name)s - %(message)s'
)

print("="*100)
print("🔍 LLM PRE-FILTER TRACE: Group 1341 (KASHIBAI)")
print("="*100)

# Group 1341 data
COLLEGE_NAME = "SMT KASHIBAI NAVALE MEDICAL COLLEGE AND GENERAL HOSPITAL"
STATE = "MAHARASHTRA"
ADDRESS = "PUNE"
COURSE_TYPE = "medical"

seat_db = 'data/sqlite/seat_data.db'
master_db = 'data/sqlite/master_data.db'

# ============================================================
# TEST 1: Direct SQL query - does MED0444 exist and match?
# ============================================================
print("\n" + "-"*80)
print("🔍 TEST 1: Direct SQL Query for MAHARASHTRA Medical Colleges")
print("-"*80)

conn = sqlite3.connect(master_db)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Query exactly how agentic matcher does it
cursor.execute("""
    SELECT id, name, COALESCE(normalized_name, name) as normalized_name,
           state, COALESCE(normalized_state, state) as normalized_state,
           address, COALESCE(normalized_address, address) as normalized_address
    FROM medical_colleges
    WHERE UPPER(COALESCE(normalized_state, state)) = ?
""", (STATE,))

maharashtra_colleges = cursor.fetchall()
print(f"  Found {len(maharashtra_colleges)} medical colleges in {STATE}")

# Check if MED0444 is in there
med0444 = [c for c in maharashtra_colleges if c['id'] == 'MED0444']
if med0444:
    print(f"  ✅ MED0444 IS in the query results!")
    print(f"     name: {med0444[0]['name']}")
    print(f"     normalized_name: {med0444[0]['normalized_name']}")
else:
    print(f"  ❌ MED0444 NOT in query results!")
    # Print sample IDs
    print(f"     Sample IDs: {[c['id'] for c in list(maharashtra_colleges)[:5]]}")

conn.close()

# ============================================================
# TEST 2: Rapidfuzz matching - what score does MED0444 get?
# ============================================================
print("\n" + "-"*80)
print("🔍 TEST 2: Rapidfuzz Matching Scores")
print("-"*80)

from rapidfuzz import fuzz

if med0444:
    master_name = med0444[0]['normalized_name']
    
    # Test different rapidfuzz methods
    print(f"  Seat college: '{COLLEGE_NAME}'")
    print(f"  Master name:  '{master_name}'")
    print()
    
    ratio = fuzz.ratio(COLLEGE_NAME.upper(), master_name.upper())
    partial = fuzz.partial_ratio(COLLEGE_NAME.upper(), master_name.upper())
    token_sort = fuzz.token_sort_ratio(COLLEGE_NAME.upper(), master_name.upper())
    token_set = fuzz.token_set_ratio(COLLEGE_NAME.upper(), master_name.upper())
    
    print(f"  fuzz.ratio:           {ratio}")
    print(f"  fuzz.partial_ratio:   {partial}")
    print(f"  fuzz.token_sort_ratio: {token_sort}")
    print(f"  fuzz.token_set_ratio:  {token_set}")
    
    print()
    print(f"  MIN_CANDIDATE_QUALITY = 70.0")
    if max(ratio, partial, token_sort, token_set) >= 70:
        print(f"  ✅ Should PASS quality filter!")
    else:
        print(f"  ❌ Will FAIL quality filter!")

# ============================================================
# TEST 3: Check the _filter_candidates_hybrid function directly
# ============================================================
print("\n" + "-"*80)
print("🔍 TEST 3: Testing _filter_candidates_hybrid")
print("-"*80)

try:
    import yaml
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    agentic_config = config.get('agentic_matcher', {})
    api_keys = agentic_config.get('api_keys', [])
    
    if api_keys:
        # Import agentic matcher
        from agentic_matcher import AgenticMatcher
        
        # Create with minimal settings
        agentic = AgenticMatcher(
            seat_db_path=seat_db,
            master_db_path=master_db,
            api_keys=api_keys[:1],
        )
        
        # Create test record
        unmatched_record = {
            'record_id': '1341',
            'group_id': 1341,
            'normalized_college_name': COLLEGE_NAME,
            'normalized_state': STATE,
            'normalized_address': ADDRESS,
            'college_name': COLLEGE_NAME,
            'state': STATE,
            'address': ADDRESS,
            'course_type': COURSE_TYPE,
            'sample_course_type': COURSE_TYPE,
            'type': COURSE_TYPE,
        }
        
        print(f"  Testing with record: {unmatched_record}")
        
        # Call the hybrid filter
        candidates = agentic._filter_candidates_hybrid(unmatched_record, course_type='medical', top_n=10)
        
        print(f"\n  Found {len(candidates)} candidates")
        
        if candidates:
            print(f"\n  Candidates:")
            for i, c in enumerate(candidates[:5]):
                print(f"    {i+1}. {c.get('id')}: {c.get('name', '')[:50]}")
                print(f"       match_score: {c.get('match_score')}")
                print(f"       match_tier: {c.get('match_tier')}")
            
            # Check for MED0444
            med0444_cand = [c for c in candidates if c.get('id') == 'MED0444']
            if med0444_cand:
                print(f"\n  ✅ MED0444 IS in candidates!")
                print(f"     match_score: {med0444_cand[0].get('match_score')}")
            else:
                print(f"\n  ❌ MED0444 NOT in candidates!")
        else:
            print(f"\n  ❌ NO CANDIDATES - This is the bug!")
            print(f"     The hybrid filter returned 0 candidates for this exact record")
            print(f"     This is why it was marked 'unmatchable_by_agentic'")
    else:
        print(f"  ⚠️  No API keys - skipping")
        
except Exception as e:
    print(f"  ❌ Error: {e}")
    import traceback
    traceback.print_exc()

# ============================================================
# TEST 4: Check college_aliases table for KASHIBAI
# ============================================================
print("\n" + "-"*80)
print("🔍 TEST 4: Check college_aliases for KASHIBAI")
print("-"*80)

conn = sqlite3.connect(master_db)
cursor = conn.cursor()

# Check if there's an alias for KASHIBAI
cursor.execute("""
    SELECT * FROM college_aliases 
    WHERE UPPER(alias_name) LIKE '%KASHIBAI%' 
       OR UPPER(original_name) LIKE '%KASHIBAI%'
    LIMIT 5
""")
aliases = cursor.fetchall()
print(f"  Found {len(aliases)} aliases matching KASHIBAI")
for a in aliases:
    print(f"    {a}")

conn.close()

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "="*100)
print("📊 ANALYSIS SUMMARY")
print("="*100)

print("""
Key Questions:
1. Is MED0444 in the SQL query result? → Need to verify above
2. What rapidfuzz score does MED0444 get? → Need to verify above
3. Does _filter_candidates_hybrid return MED0444? → Need to verify above
4. If not, WHERE is it being filtered out?
""")

print("\n" + "="*100)
print("🔍 TRACE COMPLETE")
print("="*100)
