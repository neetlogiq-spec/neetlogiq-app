#!/usr/bin/env python3
"""Comprehensive performance audit of the college matching system"""

import sqlite3
import pandas as pd
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Connect to databases
seat_db = sqlite3.connect('data/sqlite/seat_data.db')
master_db = sqlite3.connect('data/sqlite/master_data.db')

seat_db.row_factory = sqlite3.Row
master_db.row_factory = sqlite3.Row

logger.info("\n" + "="*120)
logger.info("COMPREHENSIVE COLLEGE MATCHING AUDIT")
logger.info("="*120)

# 1. Overall matching statistics
logger.info("\n📊 1. OVERALL MATCHING STATISTICS")
logger.info("-" * 120)

total_records = pd.read_sql("SELECT COUNT(*) as count FROM seat_data", seat_db)['count'].iloc[0]
matched_records = pd.read_sql("SELECT COUNT(*) as count FROM seat_data WHERE master_college_id IS NOT NULL AND master_college_id != ''", seat_db)['count'].iloc[0]
unmatched_records = total_records - matched_records
match_percentage = (matched_records / total_records * 100) if total_records > 0 else 0

logger.info(f"Total seat_data records: {total_records:,}")
logger.info(f"✅ Matched records: {matched_records:,} ({match_percentage:.1f}%)")
logger.info(f"❌ Unmatched records: {unmatched_records:,} ({100-match_percentage:.1f}%)")

# 2. Unmatched records by state
logger.info("\n📍 2. UNMATCHED RECORDS BY STATE")
logger.info("-" * 120)

unmatched_by_state = pd.read_sql("""
    SELECT normalized_state, COUNT(*) as count
    FROM seat_data
    WHERE master_college_id IS NULL OR master_college_id = ''
    GROUP BY normalized_state
    ORDER BY count DESC
    LIMIT 15
""", seat_db)

for idx, row in unmatched_by_state.iterrows():
    logger.info(f"  {row['normalized_state']:<20} {row['count']:>6} unmatched records")

# 3. Unmatched records by college name
logger.info("\n🏥 3. TOP 20 UNMATCHED COLLEGES")
logger.info("-" * 120)

unmatched_by_college = pd.read_sql("""
    SELECT normalized_college_name, normalized_state, COUNT(*) as count
    FROM seat_data
    WHERE master_college_id IS NULL OR master_college_id = ''
    GROUP BY normalized_college_name, normalized_state
    ORDER BY count DESC
    LIMIT 20
""", seat_db)

for idx, row in unmatched_by_college.iterrows():
    logger.info(f"  {row['normalized_college_name']:<50} ({row['normalized_state']:<20}) {row['count']:>4} records")

# 4. False matches (wrong college_id assigned)
logger.info("\n⚠️  4. POTENTIAL FALSE MATCHES (MULTI-CAMPUS COLLEGES)")
logger.info("-" * 120)

# Find colleges with multiple addresses
multi_campus = pd.read_sql("""
    SELECT
        college_name,
        state,
        COUNT(DISTINCT address) as address_count,
        COUNT(*) as total_records,
        COUNT(DISTINCT CASE WHEN master_college_id IS NULL OR master_college_id = '' THEN 1 END) as unmatched_count
    FROM seat_data
    WHERE college_name IN (
        SELECT college_name FROM seat_data GROUP BY college_name HAVING COUNT(DISTINCT address) > 1
    )
    GROUP BY college_name, state
    HAVING COUNT(DISTINCT address) > 1
    ORDER BY total_records DESC
    LIMIT 15
""", seat_db)

for idx, row in multi_campus.iterrows():
    logger.info(f"\n  {row['college_name']} ({row['state']})")
    logger.info(f"    Addresses: {row['address_count']}, Total: {row['total_records']}, Unmatched: {row['unmatched_count']}")

    # Show matching breakdown by address
    breakdown = pd.read_sql("""
        SELECT address, master_college_id, COUNT(*) as count
        FROM seat_data
        WHERE college_name = ? AND state = ?
        GROUP BY address, master_college_id
        ORDER BY address
    """, seat_db, params=(row['college_name'], row['state']))

    for _, addr_row in breakdown.iterrows():
        match_status = "✅" if addr_row['master_college_id'] else "❌"
        logger.info(f"    {match_status} {addr_row['address']:<20} → {addr_row['master_college_id'] or 'UNMATCHED':<10} ({addr_row['count']} records)")

# 5. Course matching issues
logger.info("\n📚 5. COURSE MATCHING ISSUES")
logger.info("-" * 120)

# Find unmatched courses
unmatched_courses = pd.read_sql("""
    SELECT normalized_course_name, COUNT(*) as count
    FROM seat_data
    WHERE master_college_id IS NULL OR master_college_id = ''
    GROUP BY normalized_course_name
    ORDER BY count DESC
    LIMIT 20
""", seat_db)

if len(unmatched_courses) > 0:
    logger.info("Top 20 courses in unmatched records:")
    for idx, row in unmatched_courses.iterrows():
        logger.info(f"  {row['normalized_course_name']:<60} {row['count']:>4} records")
else:
    logger.info("All courses are being matched!")

# 6. Address normalization issues
logger.info("\n📮 6. ADDRESS NORMALIZATION ISSUES")
logger.info("-" * 120)

# Find colleges where address might not be normalizing correctly
address_issues = pd.read_sql("""
    SELECT
        college_name,
        address,
        normalized_address,
        COUNT(*) as count
    FROM seat_data
    WHERE (master_college_id IS NULL OR master_college_id = '')
    AND college_name IN (
        SELECT college_name FROM seat_data GROUP BY college_name HAVING COUNT(DISTINCT address) > 1
    )
    GROUP BY college_name, address
    ORDER BY count DESC
    LIMIT 20
""", seat_db)

if len(address_issues) > 0:
    logger.info("Address normalization patterns for unmatched multi-campus colleges:")
    for idx, row in address_issues.iterrows():
        logger.info(f"  {row['college_name']}")
        logger.info(f"    Original:    {row['address']}")
        logger.info(f"    Normalized:  {row['normalized_address']}")
        logger.info(f"    Count: {row['count']} records")
else:
    logger.info("No address normalization issues detected!")

# 7. Database integrity checks
logger.info("\n🔍 7. DATABASE INTEGRITY CHECKS")
logger.info("-" * 120)

# Check if referenced colleges exist in master data
try:
    master_colleges = pd.read_sql("SELECT id FROM master_data.colleges", master_db)
    missing_colleges = pd.read_sql("""
        SELECT DISTINCT master_college_id
        FROM seat_data
        WHERE master_college_id IS NOT NULL AND master_college_id != ''
    """, seat_db)

    if len(missing_colleges) > 0:
        missing_ids = set(missing_colleges['master_college_id']) - set(master_colleges['id'])
        if missing_ids:
            logger.warning(f"⚠️  {len(missing_ids)} college IDs in seat_data don't exist in master_data!")
            for mid in list(missing_ids)[:10]:
                logger.warning(f"  Missing: {mid}")
        else:
            logger.info("✅ All referenced college IDs exist in master_data")
    else:
        logger.info("✅ All referenced college IDs exist in master_data")
except Exception as e:
    logger.debug(f"Could not validate colleges: {e}")

# Check if referenced courses exist in master data
try:
    master_courses = pd.read_sql("SELECT id FROM master_data.courses", master_db)
    missing_courses = pd.read_sql("""
        SELECT DISTINCT master_course_id
        FROM seat_data
        WHERE master_course_id IS NOT NULL AND master_course_id != ''
    """, seat_db)

    if len(missing_courses) > 0:
        missing_ids = set(missing_courses['master_course_id']) - set(master_courses['id'])
        if missing_ids:
            logger.warning(f"⚠️  {len(missing_ids)} course IDs in seat_data don't exist in master_data!")
            for mid in list(missing_ids)[:10]:
                logger.warning(f"  Missing: {mid}")
        else:
            logger.info("✅ All referenced course IDs exist in master_data")
    else:
        logger.info("✅ All referenced course IDs exist in master_data")
except Exception as e:
    logger.debug(f"Could not validate courses: {e}")

# 8. Performance metrics
logger.info("\n⚡ 8. PERFORMANCE METRICS")
logger.info("-" * 120)

# Count by matching method
matching_methods = pd.read_sql("""
    SELECT college_match_method, COUNT(*) as count
    FROM seat_data
    WHERE master_college_id IS NOT NULL
    GROUP BY college_match_method
    ORDER BY count DESC
""", seat_db)

logger.info("Matched records by method:")
for idx, row in matching_methods.iterrows():
    pct = (row['count'] / matched_records * 100) if matched_records > 0 else 0
    logger.info(f"  {row['college_match_method']:<40} {row['count']:>6} ({pct:>5.1f}%)")

logger.info("\n" + "="*120)
logger.info("AUDIT COMPLETE")
logger.info("="*120)
