#!/usr/bin/env python3
"""
Populate master_state_id in seat_data for all records with master_college_id
"""

import sqlite3

def populate_master_state_id():
    """Populate master_state_id for all matched records"""

    print("="*100)
    print("POPULATING MASTER_STATE_ID FOR MATCHED RECORDS")
    print("="*100)
    print()

    # Connect to databases
    seat_db_path = "data/sqlite/seat_data.db"
    master_db_path = "data/sqlite/master_data.db"

    conn_seat = sqlite3.connect(seat_db_path)
    cur_seat = conn_seat.cursor()

    try:
        # Attach master database
        cur_seat.execute("ATTACH DATABASE ? AS masterdb", (master_db_path,))

        # Check current state
        cur_seat.execute("SELECT COUNT(*) FROM seat_data WHERE master_college_id IS NOT NULL AND master_state_id IS NULL")
        unmatched_count = cur_seat.fetchone()[0]

        print(f"📊 Records with master_college_id but no master_state_id: {unmatched_count:,}")
        print()

        if unmatched_count == 0:
            print("✓ All records already have master_state_id populated")
            conn_seat.close()
            return

        print("🔄 Populating master_state_id from state_college_link table...")
        print()

        # Update master_state_id by joining with state_college_link
        update_query = """
        UPDATE seat_data
        SET master_state_id = (
            SELECT scl.state_id
            FROM masterdb.state_college_link scl
            WHERE scl.college_id = seat_data.master_college_id
            LIMIT 1  -- Each college should exist in only one state in master data
        )
        WHERE master_college_id IS NOT NULL
          AND master_state_id IS NULL;
        """

        print("Executing update query...")
        cur_seat.execute(update_query)
        updated = cur_seat.rowcount
        conn_seat.commit()

        print(f"✓ Updated {updated:,} records with master_state_id")
        print()

        # Verify the update
        cur_seat.execute("SELECT COUNT(*) FROM seat_data WHERE master_college_id IS NOT NULL AND master_state_id IS NULL")
        remaining = cur_seat.fetchone()[0]

        print(f"✅ Verification:")
        print(f"  Records still missing master_state_id: {remaining:,}")

        if remaining > 0:
            print(f"  ⚠️  Warning: {remaining} records couldn't be matched (college not found in master data)")

        # Show some examples
        print()
        print("📋 Sample populated records:")
        cur_seat.execute("""
        SELECT college_name, normalized_state, master_college_id, master_state_id
        FROM seat_data
        WHERE master_college_id IS NOT NULL AND master_state_id IS NOT NULL
        LIMIT 5
        """)

        for row in cur_seat.fetchall():
            print(f"  {row[0][:40]:40s} | {row[1]:20s} | {row[2]:10s} | {row[3]}")

        conn_seat.close()

        print()
        print("="*100)
        print("✅ MASTER_STATE_ID POPULATION COMPLETE")
        print("="*100)
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        conn_seat.close()

if __name__ == '__main__':
    populate_master_state_id()
