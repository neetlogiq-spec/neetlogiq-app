#!/usr/bin/env python3
"""
Create a unified 'colleges' view combining all college types
This allows scripts expecting a single 'colleges' table to work
"""

import sqlite3
from pathlib import Path

DB_PATH = "data/sqlite/master_data.db"

def create_unified_view():
    """Create a unified colleges view from separate tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop view if it exists
    cursor.execute("DROP VIEW IF EXISTS colleges")

    # Create unified view
    create_view_sql = """
    CREATE VIEW colleges AS
    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        'MEDICAL' as source_table
    FROM medical_colleges

    UNION ALL

    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        'DENTAL' as source_table
    FROM dental_colleges

    UNION ALL

    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        'DNB' as source_table
    FROM dnb_colleges
    """

    cursor.execute(create_view_sql)
    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM colleges")
    count = cursor.fetchone()[0]

    print(f"✅ Created unified 'colleges' view with {count:,} colleges")

    # Show breakdown
    cursor.execute("""
        SELECT source_table, COUNT(*) as count
        FROM colleges
        GROUP BY source_table
    """)

    print("\nBreakdown:")
    for row in cursor.fetchall():
        print(f"  • {row[0]}: {row[1]:,} colleges")

    conn.close()

if __name__ == "__main__":
    print("Creating unified colleges view...")
    create_unified_view()
    print("\n✅ Done! Scripts can now query 'colleges' table/view")
