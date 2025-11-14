#!/usr/bin/env python3
"""Analyze college name matching issues"""

import sqlite3
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

seat_db = sqlite3.connect('data/sqlite/seat_data.db')
master_db = sqlite3.connect('data/sqlite/master_data.db')

logger.info("\n" + "="*120)
logger.info("COLLEGE NAME MATCHING ANALYSIS")
logger.info("="*120)

# Get all unique colleges in seat_data
seat_colleges = pd.read_sql("""
    SELECT DISTINCT normalized_college_name, normalized_state
    FROM seat_data
    ORDER BY normalized_college_name, normalized_state
""", seat_db)

logger.info(f"\nTotal unique colleges in seat_data: {len(seat_colleges)}")

# Get all colleges that don't match
unmatched_colleges = pd.read_sql("""
    SELECT DISTINCT normalized_college_name, normalized_state, COUNT(*) as records
    FROM seat_data
    WHERE master_college_id IS NULL OR master_college_id = ''
    GROUP BY normalized_college_name, normalized_state
    ORDER BY records DESC
    LIMIT 30
""", seat_db)

logger.info(f"\nTop 30 unmatched colleges:")
logger.info("-" * 120)

for idx, row in unmatched_colleges.iterrows():
    # Try to find similar names in master data
    search = f"%{row['normalized_college_name'].split()[0]}%"  # First word

    similar = pd.read_sql(f"""
        SELECT DISTINCT c.id, c.normalized_name, c.address
        FROM colleges c
        JOIN state_college_link scl ON scl.college_id = c.id
        JOIN states s ON s.id = scl.state_id
        WHERE c.normalized_name LIKE ?
        AND s.normalized_name = ?
        LIMIT 5
    """, master_db, params=(search, row['normalized_state']))

    logger.info(f"\n{idx+1}. {row['normalized_college_name']} ({row['normalized_state']}) - {row['records']} records")
    if len(similar) > 0:
        logger.info(f"   Similar colleges in master data:")
        for _, sim_row in similar.iterrows():
            logger.info(f"     - {sim_row['normalized_name']} ({sim_row['id']}) @ {sim_row['address']}")
    else:
        logger.info(f"   ❌ NO similar colleges found in master data!")

logger.info("\n" + "="*120)
