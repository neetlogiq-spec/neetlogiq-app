#!/usr/bin/env python3
"""
Regenerate all record IDs in seat_data using BetterRecordIDGenerator
Updates the id column with the new best-in-class format
"""

import sqlite3
import pandas as pd
from better_record_id_generator import BetterRecordIDGenerator

def regenerate_record_ids():
    """Regenerate all record IDs in seat_data table"""

    print("="*100)
    print("REGENERATING RECORD IDs USING BEST-IN-CLASS GENERATOR")
    print("="*100)
    print()

    # Connect to database
    db_path = "data/sqlite/seat_data.db"
    conn = sqlite3.connect(db_path)

    print("📖 Loading all records from seat_data...")
    df = pd.read_sql("SELECT * FROM seat_data", conn)
    print(f"✓ Loaded {len(df):,} records")
    print()

    # Generate new record IDs
    print("🔄 Generating new record IDs using BetterRecordIDGenerator...")
    generator = BetterRecordIDGenerator()

    new_ids = []
    for idx, row in df.iterrows():
        new_id = generator.generate_record_id(
            state=row['state'] or 'UNKNOWN',
            college_name=row['college_name'] or '',
            course_name=row['course_name'] or '',
            address=row['address']
        )
        new_ids.append(new_id)

        if (idx + 1) % 2000 == 0:
            print(f"  ✓ Generated {idx + 1:,} IDs...")

    print(f"✓ Generated {len(new_ids):,} new IDs")
    print()

    # Show examples of old vs new IDs
    print("📊 Examples of ID transformation:")
    print("-" * 100)
    sample_indices = [0, len(df)//4, len(df)//2, 3*len(df)//4, -1]
    for idx in sample_indices:
        if idx < len(df):
            old_id = df.iloc[idx]['id']
            new_id = new_ids[idx]
            state = df.iloc[idx]['normalized_state']
            college = df.iloc[idx]['college_name'][:40]
            print(f"State: {state:15s} | College: {college:40s}")
            print(f"  Old: {old_id}")
            print(f"  New: {new_id}")
            print()

    # Update database
    print("💾 Updating seat_data table with new IDs...")
    cur = conn.cursor()

    for i, (old_id, new_id) in enumerate(zip(df['id'], new_ids)):
        cur.execute("UPDATE seat_data SET id = ? WHERE id = ?", (new_id, old_id))
        if (i + 1) % 2000 == 0:
            print(f"  ✓ Updated {i + 1:,} records...")

    conn.commit()
    print(f"✓ Updated {len(new_ids):,} records")
    print()

    # Verify the update
    print("✅ Verification:")
    result = pd.read_sql("SELECT id FROM seat_data LIMIT 1", conn)
    print(f"  Sample new ID format: {result.iloc[0]['id']}")

    # Check for any duplicates
    dup_count = pd.read_sql("SELECT COUNT(*) as count FROM (SELECT id FROM seat_data GROUP BY id HAVING COUNT(*) > 1)", conn).iloc[0]['count']
    if dup_count > 0:
        print(f"  ⚠️  Warning: {dup_count} duplicate IDs found")
    else:
        print(f"  ✓ No duplicate IDs")

    conn.close()

    print()
    print("="*100)
    print("✅ RECORD ID REGENERATION COMPLETE")
    print("="*100)
    print()

if __name__ == '__main__':
    regenerate_record_ids()
