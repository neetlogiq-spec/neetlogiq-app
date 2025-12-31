#!/usr/bin/env python3
"""
COMPREHENSIVE DEBUG TRACE: Group 1341 (KASHIBAI)

This script traces group 1341 through every pass of the matching pipeline
to identify exactly where and why it fails to match.
"""

import sqlite3
import sys
import logging
import os
sys.path.insert(0, '.')

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger('trace_1341')

print("="*100)
print("🔍 COMPREHENSIVE DEBUG TRACE: Group 1341 (SMT KASHIBAI NAVALE MEDICAL COLLEGE)")
print("="*100)

# ============================================================
# SECTION 1: DATABASE STATE CHECK
# ============================================================
print("\n" + "="*80)
print("📊 SECTION 1: DATABASE STATE CHECK")
print("="*80)

seat_db = 'data/sqlite/seat_data.db'
master_db = 'data/sqlite/master_data.db'

# Check seat_data records
conn = sqlite3.connect(seat_db)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("\n📋 seat_data records for KASHIBAI:")
cursor.execute("""
    SELECT id, college_id, master_college_id, college_match_method, 
           normalized_college_name, normalized_state, normalized_address,
           course_type, created_at, updated_at
    FROM seat_data 
    WHERE normalized_college_name LIKE '%KASHIBAI%'
""")
kashibai_records = cursor.fetchall()
for r in kashibai_records[:3]:
    print(f"  ID: {r['id']}")
    print(f"    college_id: '{r['college_id']}'")
    print(f"    master_college_id: '{r['master_college_id']}'")
    print(f"    college_match_method: '{r['college_match_method']}'")
    print(f"    course_type: '{r['course_type']}'")
    print(f"    created_at: {r['created_at']}")
    print(f"    updated_at: {r['updated_at']}")
    print()

print(f"  Total KASHIBAI records: {len(kashibai_records)}")

# Check group_matching_queue
print("\n📋 group_matching_queue for group 1341:")
cursor.execute("""
    SELECT * FROM group_matching_queue WHERE group_id = 1341
""")
queue_row = cursor.fetchone()
if queue_row:
    print(f"  group_id: {queue_row['group_id']}")
    print(f"  normalized_state: '{queue_row['normalized_state']}'")
    print(f"  normalized_college_name: '{queue_row['normalized_college_name']}'")
    print(f"  normalized_address: '{queue_row['normalized_address']}'")
    print(f"  sample_course_type: '{queue_row['sample_course_type']}'")
    print(f"  matched_college_id: '{queue_row['matched_college_id']}'")
    print(f"  match_method: '{queue_row['match_method']}'")
    print(f"  match_score: '{queue_row['match_score']}'")
    print(f"  is_processed: {queue_row['is_processed']}")

# Check if MED0444 exists in master
print("\n📋 MED0444 in master_data:")
master_conn = sqlite3.connect(master_db)
master_conn.row_factory = sqlite3.Row
master_cursor = master_conn.cursor()

master_cursor.execute("SELECT * FROM colleges WHERE id = 'MED0444'")
med0444 = master_cursor.fetchone()
if med0444:
    print(f"  ✅ MED0444 EXISTS!")
    print(f"  name: {med0444['name']}")
    print(f"  state: {med0444['state']}")
    print(f"  address: {med0444['address']}")
else:
    print(f"  ❌ MED0444 NOT FOUND!")

conn.close()
master_conn.close()

# ============================================================
# SECTION 2: TRACE THROUGH PASSES
# ============================================================
print("\n" + "="*80)
print("🔄 SECTION 2: TRACE THROUGH EACH PASS")
print("="*80)

# Extract group data
COLLEGE_NAME = "SMT KASHIBAI NAVALE MEDICAL COLLEGE AND GENERAL HOSPITAL"
STATE = "MAHARASHTRA"
ADDRESS = "PUNE"
COURSE_NAME = "MBBS"
COURSE_TYPE = "medical"

# Create group dict simulating queue record
group = {
    'group_id': 1341,
    'normalized_state': STATE,
    'normalized_college_name': COLLEGE_NAME,
    'normalized_address': ADDRESS,
    'sample_course_type': COURSE_TYPE,
    'sample_course_name': COURSE_NAME,
    'state': STATE,
    'college_name': COLLEGE_NAME,
    'address': ADDRESS,
    'course_type': COURSE_TYPE,
    'course_name': COURSE_NAME,
    'composite_college_key': None,
}

# Load matchers
print("\n🔧 Loading matchers (this may take a minute)...")
try:
    from match_and_link_sqlite_seat_data import AdvancedSQLiteMatcher
    from course_stream_mapper import CourseStreamMapper
    from pass_1_stream_filtering import Pass1StreamFiltering
    
    matcher = AdvancedSQLiteMatcher(
        config_path='config.yaml', 
        enable_parallel=False, 
        data_type='seat'
    )
    matcher.load_master_data()
    
    stream_mapper = CourseStreamMapper('config.yaml')
    pass1_matcher = Pass1StreamFiltering(matcher, stream_mapper)
    print("  ✅ Matchers loaded successfully")
except Exception as e:
    print(f"  ❌ Error loading matchers: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# ============================================================
# PASS 0.5: Code Match
# ============================================================
print("\n" + "-"*60)
print("🔍 PASS 0.5: CODE MATCH")
print("-"*60)

# Check if address contains college code
import re
raw_address = group.get('address', '')
code_pattern = r'\((\d{6})\)'
code_match = re.search(code_pattern, raw_address)
if code_match:
    print(f"  Found college code: {code_match.group(1)}")
else:
    print(f"  No college code in address: '{raw_address}'")
    print(f"  → PASS 0.5 will not match")

# ============================================================
# PASS 0: Composite Key Match
# ============================================================
print("\n" + "-"*60)
print("🔍 PASS 0: COMPOSITE KEY MATCH")
print("-"*60)

composite_key = group.get('composite_college_key')
print(f"  composite_college_key: '{composite_key}'")
if composite_key:
    print(f"  → Will try keyword-based matching")
else:
    print(f"  → PASS 0 will be SKIPPED (no composite key)")

# ============================================================
# PASS 1: Stream Filtered Matching
# ============================================================
print("\n" + "-"*60)
print("🔍 PASS 1: STREAM FILTERED MATCHING")
print("-"*60)

print(f"  Testing with:")
print(f"    college_name: {COLLEGE_NAME}")
print(f"    state: {STATE}")
print(f"    course_name: {COURSE_NAME}")
print(f"    course_type: {COURSE_TYPE}")
print(f"    address: {ADDRESS}")

try:
    result = pass1_matcher.match_group(
        college_name=COLLEGE_NAME,
        state=STATE,
        course_name=COURSE_NAME,
        course_type=COURSE_TYPE,
        address=ADDRESS
    )
    matched_college, score, method = result
    
    if matched_college:
        print(f"\n  ✅ PASS 1 MATCHED!")
        print(f"     ID: {matched_college.get('id')}")
        print(f"     Name: {matched_college.get('name')}")
        print(f"     Score: {score}")
        print(f"     Method: {method}")
    else:
        print(f"\n  ❌ PASS 1 DID NOT MATCH")
        print(f"     Method: {method}")
        print(f"     Score: {score}")
        
        # Debug why
        print("\n  🔍 Debugging _find_candidates_in_stream...")
        candidates = pass1_matcher._find_candidates_in_stream(
            college_name=COLLEGE_NAME,
            state=STATE,
            stream='MEDICAL',
            address=ADDRESS
        )
        print(f"     Found {len(candidates)} candidates")
        for c in candidates[:3]:
            print(f"       - {c['id']}: {c['name'][:50]} (score: {c.get('match_score', 'N/A')})")
        
except Exception as e:
    print(f"  ❌ PASS 1 ERROR: {e}")
    import traceback
    traceback.print_exc()

# ============================================================
# PASS 5-AGENTIC: Check TF-IDF Pre-filter
# ============================================================
print("\n" + "-"*60)
print("🔍 PASS 5-AGENTIC: TF-IDF PRE-FILTER CHECK")
print("-"*60)

try:
    from agentic_matcher import AgenticMatcher
    
    # Create agentic matcher with minimal setup
    import yaml
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    agentic_config = config.get('agentic_matcher', {})
    api_keys = agentic_config.get('api_keys', [])
    
    if api_keys:
        agentic = AgenticMatcher(
            seat_db_path=seat_db,
            master_db_path=master_db,
            api_keys=api_keys[:2],  # Just 2 for testing
            batch_size=10,
            max_rounds=1
        )
        
        # Test the hybrid filter
        print(f"  Testing _filter_candidates_hybrid...")
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
        }
        
        candidates = agentic._filter_candidates_hybrid(unmatched_record, course_type='medical', top_n=10)
        print(f"  Found {len(candidates)} candidates from hybrid filter")
        
        if candidates:
            print(f"  Top candidates:")
            for c in candidates[:3]:
                print(f"    - {c.get('id')}: {c.get('name', '')[:50]} (score: {c.get('match_score', 'N/A')})")
            
            # Check if MED0444 is in candidates
            med0444_found = any(c.get('id') == 'MED0444' for c in candidates)
            if med0444_found:
                print(f"  ✅ MED0444 IS in candidates!")
                med0444_cand = [c for c in candidates if c.get('id') == 'MED0444'][0]
                print(f"     Score: {med0444_cand.get('match_score')}")
            else:
                print(f"  ❌ MED0444 NOT in candidates!")
        else:
            print(f"  ❌ NO CANDIDATES - This is why it's marked 'unmatchable_by_agentic'!")
    else:
        print(f"  ⚠️  No API keys configured - skipping agentic test")
        
except Exception as e:
    print(f"  ❌ Error testing agentic: {e}")
    import traceback
    traceback.print_exc()

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "="*80)
print("📊 SUMMARY")
print("="*80)

print(f"""
Key Observations:
1. seat_data.college_id = MED0444 (from import)
2. seat_data.master_college_id = NULL (never set by pipeline)
3. seat_data records have NOT been updated since import (2025-12-23)
4. group_matching_queue.matched_college_id = NULL
5. group_matching_queue.match_method = 'unmatchable_by_agentic'

This means:
- The pipeline never matched this group
- Propagation has nothing to propagate (queue has no match)
- The sync master_*_id → *_id has nothing to sync (master is empty)

The real question:
- Why didn't PASS 1 (or any earlier pass) match group 1341?
- MED0444 EXISTS in master with EXACT same name and state!
""")

print("\n" + "="*100)
print("🔍 TRACE COMPLETE")
print("="*100)
