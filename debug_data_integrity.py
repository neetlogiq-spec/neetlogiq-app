import sqlite3
import os

def debug_data_integrity():
    db_path = "data/sqlite/seat_data.db"
    
    if not os.path.exists(db_path):
        # Try data/seat_data.db (legacy path?)
        if os.path.exists("data/seat_data.db"):
            db_path = "data/seat_data.db"
            print(f"⚠️  Using {db_path} (data/sqlite/seat_data.db not found)")
        else:
            print("❌ No seat_data.db found!")
            return

    print(f"--- Checking Data Integrity in {db_path} ---")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Check seat_data for Grace Kennett
    print("\n1. Searching 'seat_data' table for 'GRACE':")
    try:
        cursor.execute("SELECT count(*) FROM seat_data WHERE college_name LIKE '%GRACE%'")
        count = cursor.fetchone()[0]
        print(f"   Found {count} records.")
        if count > 0:
            cursor.execute("SELECT id, college_name, address FROM seat_data WHERE college_name LIKE '%GRACE%' LIMIT 3")
            for row in cursor.fetchall():
                print(f"   - ID: {row['id']}, Name: {row['college_name']}")
    except sqlite3.OperationalError as e:
        print(f"   ❌ Error querying seat_data: {e}")

    # 2. Check group_matching_queue for Grace Kennett
    print("\n2. Searching 'group_matching_queue' table for 'GRACE':")
    try:
        cursor.execute("SELECT count(*) FROM group_matching_queue WHERE college_name LIKE '%GRACE%'")
        count = cursor.fetchone()[0]
        print(f"   Found {count} records.")
        if count > 0:
            cursor.execute("SELECT group_id, college_name, address FROM group_matching_queue WHERE college_name LIKE '%GRACE%' LIMIT 3")
            for row in cursor.fetchall():
                print(f"   - Group ID: {row['group_id']}, Name: {row['college_name']}")
    except sqlite3.OperationalError as e:
        print(f"   ❌ Error querying group_matching_queue: {e}")

    conn.close()

if __name__ == "__main__":
    debug_data_integrity()
