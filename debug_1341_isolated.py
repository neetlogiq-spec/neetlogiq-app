#!/usr/bin/env python3
"""
ISOLATED DEBUG SCRIPT FOR GROUP 1341 (KASHIBAI)
"""

import sqlite3
import sys
import logging
sys.path.insert(0, '.')

# Configure logging to show our debug messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger('debug_1341')

print("="*80)
print("🔍 ISOLATED DEBUG: Group 1341")
print("="*80)

# 1. Fetch the EXACT record from the queue
conn = sqlite3.connect('data/sqlite/seat_data.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
cursor.execute("SELECT * FROM group_matching_queue WHERE group_id = 1341")
row = cursor.fetchone()
conn.close()

if not row:
    print("❌ Group 1341 not found in queue!")
    sys.exit(1)

# TEST ORCHESTRATOR LOGIC: _is_corrupted_address
def _is_corrupted_address(address):
    """Copied from integrated_5pass_orchestrator.py"""
    if not address: return False
    address_upper = address.upper()
    if '@' in address and ('GMAIL' in address_upper or 'YAHOO' in address_upper or 'EMAIL' in address_upper):
        parts = address.split(',')
        email_parts = [p for p in parts if '@' in p]
        if len(email_parts) >= len(parts) * 0.5:
            return True
    return False

print(f"\n🔍 Check: _is_corrupted_address('{row['normalized_address']}') = {_is_corrupted_address(row['normalized_address'])}")

print(f"📋 Record Data:")
print(f"   Name:    {row['normalized_college_name']}")
print(f"   State:   {row['normalized_state']}")
print(f"   Address: {row['normalized_address']}")
print(f"   Course:  {row['sample_course_name']}")
print(f"   Type:    {row['sample_course_type']}")

# 2. Instantiate the Orchestrator's dependencies exactly as it does
print("\n🔧 Initializing Matcher components...")
from match_and_link_sqlite_seat_data import AdvancedSQLiteMatcher
from course_stream_mapper import CourseStreamMapper
from pass_1_stream_filtering import Pass1StreamFiltering

# Initialize base matcher
matcher = AdvancedSQLiteMatcher(config_path='config.yaml', enable_parallel=False, data_type='seat')
matcher.load_master_data()

# Initialize stream mapper
stream_mapper = CourseStreamMapper('config.yaml')

# Initialize Pass 1 matcher
pass1 = Pass1StreamFiltering(matcher, stream_mapper)

# 3. Check for check_name_conflict method
has_conflict = hasattr(matcher, 'check_name_conflict')
print(f"\n🔍 Check: hasattr(matcher, 'check_name_conflict') = {has_conflict}")

# 4. Run match_group
print("\n🚀 Running pass1.match_group()...")
matched_college, score, method = pass1.match_group(
    college_name=row['normalized_college_name'],
    state=row['normalized_state'],
    course_name=row['sample_course_name'],
    course_type=row['sample_course_type'],
    address=row['normalized_address']
)

print("\n" + "="*80)
print("🏁 RESULT")
print("="*80)
if matched_college:
    print(f"✅ MATCHED!")
    print(f"   ID:     {matched_college.get('id')}")
    print(f"   Name:   {matched_college.get('name')}")
    print(f"   Score:  {score}")
    print(f"   Method: {method}")
else:
    print(f"❌ NOT MATCHED")
    print(f"   Score:  {score}")
    print(f"   Method: {method}")
    
    # If not matched, try to debug why by calling internal methods
    print("\n🔍 Deep Dive:")
    try:
        candidates = pass1._find_candidates_in_stream(
            row['normalized_college_name'], 
            row['normalized_state'], 
            'MEDICAL', 
            row['normalized_address']
        )
        print(f"   Candidates found: {len(candidates)}")
        for c in candidates:
            print(f"     - {c['name']} (score: {c.get('match_score')})")
    except Exception as e:
        print(f"   Error finding candidates: {e}")
