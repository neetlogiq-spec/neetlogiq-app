#!/usr/bin/env python3
"""
PIPELINE INTEGRATION TRACE: Group 1341 (KASHIBAI)

This script instantiates the full Integrated5PassOrchestrator and forces it to 
process Group 1341. This replicates the EXACT environment (threading, flags, 
shared state) that fails in production.
"""

import sys
import logging
import sqlite3
import shutil
from pathlib import Path

sys.path.insert(0, '.')

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger('trace_integration')

print("="*100)
print("🔍 PIPELINE INTEGRATION TRACE: Group 1341")
print("="*100)

# 1. Reset group_matching_queue status for 1341 so it gets picked up
print("\n🔧 Resetting group 1341 status in DB...")
conn = sqlite3.connect('data/sqlite/seat_data.db')
conn.execute("""
    UPDATE group_matching_queue 
    SET is_processed = 0, 
        matched_college_id = NULL, 
        match_method = NULL, 
        match_score = NULL 
    WHERE group_id = 1341
""")
if conn.total_changes == 0:
    print("⚠️  Group 1341 not updated (maybe needed insert?)")
else:
    print("✅ Group 1341 reset for processing")
conn.commit()
conn.close()

# 2. Initialize Orchestrator
print("\n🔧 Initializing Integrated5PassOrchestrator...")
from integrated_5pass_orchestrator import Integrated5PassOrchestrator

try:
    # Use config that enables Pass 1
    # FIX: Initialize with proper DB paths (defaults are fine), NOT config path
    orchestrator = Integrated5PassOrchestrator()
    
    # 3. Find the group using fetch_unmatched_groups logic
    print("\n📋 Fetching unmatched groups manually...")
    conn = sqlite3.connect('data/sqlite/seat_data.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM group_matching_queue WHERE group_id = 1341")
    row = c.fetchone()
    conn.close()
    
    target_group = dict(row) if row else None
    
    if target_group:
        print(f"✅ Found Group 1341 in DB!")
        print(f"   Name: {target_group['college_name']}")
        print(f"   Address: {target_group['address']}")
        
        # DEBUG ORCHESTRATOR STATE
        import integrated_5pass_orchestrator as iso
        print("\n🔍 ORCHESTRATOR STATE:")
        print(f"   PASS_1_AVAILABLE: {iso.PASS_1_STREAM_FILTERING_AVAILABLE}")
        print(f"   pass1_matcher: {orchestrator.pass1_matcher}")
        print(f"   stream_mapper: {orchestrator.stream_mapper}")
        print(f"   Is 'PUNE' corrupted? {orchestrator._is_corrupted_address('PUNE')}")
        
        # 4. Process JUST this group using the internal method
        print("\n🚀 running _match_group(1341)...")
        # Ensure Pass 1 class has our debug logging loaded
        
        orchestrator._match_group(target_group)
        print("\n🧹 Flushing update queue...")
        orchestrator._flush_update_queue()
        
        # 5. Check Result
        print("\n📊 Checking Final Status...")
        conn = sqlite3.connect('data/sqlite/seat_data.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM group_matching_queue WHERE group_id = 1341")
        res = c.fetchone()
        conn.close()
        
        if res['matched_college_id']:
            print(f"✅ MATCHED via Pipeline!")
            print(f"   ID: {res['matched_college_id']}")
            print(f"   Method: {res['match_method']}")
            print(f"   Score: {res['match_score']}")
        else:
            print(f"❌ FAILED to Match via Pipeline")
            print(f"   Method: {res['match_method']}")
            
    else:
        print("❌ Group 1341 NOT found in unmatched groups list! (Is is_processed=0?)")

except Exception as e:
    print(f"❌ Integration Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*100)
print("🏁 TRACE COMPLETE")
print("="*100)
