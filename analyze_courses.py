#!/usr/bin/env python3
"""Analyze course matching issues"""

import sqlite3
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

seat_db = sqlite3.connect('data/sqlite/seat_data.db')
master_db = sqlite3.connect('data/sqlite/master_data.db')

logger.info("\n" + "="*120)
logger.info("COURSE MATCHING ANALYSIS")
logger.info("="*120)

# Get all unique courses in seat_data
seat_courses = pd.read_sql("""
    SELECT DISTINCT normalized_course_name
    FROM seat_data
    ORDER BY normalized_course_name
""", seat_db)

logger.info(f"\nTotal unique normalized courses in seat_data: {len(seat_courses)}")

# Get all unique courses in master_data
master_courses = pd.read_sql("""
    SELECT DISTINCT normalized_name
    FROM courses
    ORDER BY normalized_name
""", master_db)

logger.info(f"Total unique normalized courses in master_data: {len(master_courses)}")

# Find courses in seat_data that don't exist in master_data
seat_courses_set = set(seat_courses['normalized_course_name'])
master_courses_set = set(master_courses['normalized_name'])

missing_courses = seat_courses_set - master_courses_set

logger.info(f"\n❌ Courses in seat_data but NOT in master_data: {len(missing_courses)}")
logger.info("-" * 120)

# Get record counts for missing courses
missing_course_counts = pd.read_sql(f"""
    SELECT normalized_course_name, COUNT(*) as count
    FROM seat_data
    WHERE normalized_course_name IN ({','.join(['?']*len(missing_courses))})
    GROUP BY normalized_course_name
    ORDER BY count DESC
""", seat_db, params=list(missing_courses))

total_missing_records = missing_course_counts['count'].sum()
logger.info(f"Total records with missing courses: {total_missing_records:,}")

for idx, row in missing_course_counts.iterrows():
    logger.info(f"  {row['normalized_course_name']:<70} {row['count']:>5} records")

# Find close matches (courses that might be the same but with slight differences)
logger.info(f"\n🔍 FINDING CLOSE MATCHES")
logger.info("-" * 120)

from difflib import SequenceMatcher

def string_similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

# For each missing course, find close matches in master data
close_matches = {}
for missing in missing_courses:
    best_match = None
    best_ratio = 0

    for master in master_courses_set:
        ratio = string_similarity(missing, master)
        if ratio > 0.85 and ratio > best_ratio:  # 85% similarity threshold
            best_ratio = ratio
            best_match = master

    if best_match:
        close_matches[missing] = (best_match, best_ratio)

logger.info(f"Found {len(close_matches)} close matches (>85% similarity):")
for missing, (match, ratio) in sorted(close_matches.items(), key=lambda x: x[1][1], reverse=True):
    seat_count = missing_course_counts[missing_course_counts['normalized_course_name'] == missing]['count'].sum()
    logger.info(f"\n  Seat data: {missing}")
    logger.info(f"  Master:    {match}")
    logger.info(f"  Similarity: {ratio:.1%}")
    logger.info(f"  Records affected: {seat_count}")

# Check for courses in master_data not in seat_data
logger.info(f"\n\n✅ Courses in master_data but NOT in seat_data: {len(master_courses_set - seat_courses_set)}")

# Get sample courses from master_data
sample_missing_master = list(master_courses_set - seat_courses_set)[:20]
logger.info(f"Sample courses only in master_data (first 20):")
for course in sample_missing_master:
    logger.info(f"  {course}")

logger.info("\n" + "="*120)
