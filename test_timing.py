#!/usr/bin/env python3
"""Test the new batch propagation performance."""

import time
import sqlite3

print("=" * 60)
print("PROPAGATION PERFORMANCE TEST (NEW BATCH APPROACH)")
print("=" * 60)

# Create indexes first (one-time)
print("\n[SETUP] Creating indexes...")
conn = sqlite3.connect('data/sqlite/seat_data.db')
cursor = conn.cursor()

try:
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_gmq_composite 
        ON group_matching_queue(normalized_state, normalized_college_name, normalized_address, sample_course_type)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_seat_propagate 
        ON seat_data(normalized_state, normalized_college_name, normalized_address, course_type)
    """)
    conn.commit()
    print("✅ Indexes created")
except Exception as e:
    print(f"⚠️ Index creation: {e}")

# Test the new batch approach
print("\n[TEST] Running batch propagation...")
start = time.time()

# Step 1: Fetch all matched groups
cursor.execute("""
    SELECT 
        normalized_state,
        normalized_college_name,
        COALESCE(NULLIF(normalized_address, ''), 'NO_ADDRESS') as normalized_address,
        sample_course_type,
        matched_college_id,
        match_score,
        match_method
    FROM group_matching_queue
    WHERE matched_college_id IS NOT NULL AND matched_college_id != ''
""")
matched_groups = cursor.fetchall()
print(f"   Found {len(matched_groups)} matched groups in {time.time() - start:.2f}s")

# Step 2: Update seat_data in batches
update_start = time.time()
total_updated = 0
batch_size = 100

for i in range(0, len(matched_groups), batch_size):
    batch = matched_groups[i:i + batch_size]
    
    for group in batch:
        norm_state, norm_college, norm_addr, course_type, matched_id, score, method = group
        
        cursor.execute("""
            UPDATE seat_data
            SET master_college_id = ?,
                college_match_score = ?,
                college_match_method = ?
            WHERE normalized_state = ?
            AND normalized_college_name = ?
            AND COALESCE(NULLIF(normalized_address, ''), 'NO_ADDRESS') = ?
            AND course_type = ?
            AND (master_college_id IS NULL OR master_college_id = '')
        """, (matched_id, score, method, norm_state, norm_college, norm_addr, course_type))
        
        total_updated += cursor.rowcount
    
    conn.commit()
    
    if (i // batch_size) % 50 == 0:
        elapsed = time.time() - update_start
        rate = (i + len(batch)) / elapsed if elapsed > 0 else 0
        print(f"   Progress: {i + len(batch)}/{len(matched_groups)} groups ({rate:.1f} groups/sec)")

conn.close()

total_time = time.time() - start
print(f"\n⏱️  TOTAL TIME: {total_time:.1f}s")
print(f"   Groups processed: {len(matched_groups)}")
print(f"   Rows updated: {total_updated}")
print(f"   Rate: {len(matched_groups)/total_time:.1f} groups/sec")
