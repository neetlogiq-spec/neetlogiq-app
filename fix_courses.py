#!/usr/bin/env python3
"""Fix course normalization issues to achieve 100% matching"""

import sqlite3
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

master_db = sqlite3.connect('data/sqlite/master_data.db')

logger.info("\n" + "="*120)
logger.info("FIXING COURSE NORMALIZATION ISSUES")
logger.info("="*120)

# Course name fixes - normalize "AND" keywords
course_fixes = {
    # MDS courses - fix missing/inconsistent "AND"
    'MDS IN CONSERVATIVE DENTISTRY ENDODONTICS': 'MDS IN CONSERVATIVE DENTISTRY AND ENDODONTICS',
    'MDS IN ORTHODONITICS DENTOFACIAL ORTHOPEDICS': 'MDS IN ORTHODONITICS AND DENTOFACIAL ORTHOPEDICS',
    'MDS IN PROSTHODONTICS AND CROWN BRIDGE': 'MDS IN PROSTHODONTICS AND CROWN AND BRIDGE',
    'MDS IN ORAL MEDICINE RADIOLOGY': 'MDS IN ORAL MEDICINE AND RADIOLOGY',
    'MDS IN ORAL MAXILLOFACIAL PATHOLOGY AND ORAL MICROBIOLOGY': 'MDS IN ORAL AND MAXILLOFACIAL PATHOLOGY AND ORAL MICROBIOLOGY',
    'MDS IN PERIODONTOLOGY AND IMPLANTOLOGY': 'MDS IN PERIODONTOLOGY AND IMPLANTOLOGY',
    'MDS IN PEDIATRIC AND PREVENTIVE DENTISTRY': 'MDS IN PEDIATRIC AND PREVENTIVE DENTISTRY',
    'MDS IN PUBLIC HEALTH DENTISTRY': 'MDS IN PUBLIC HEALTH DENTISTRY',

    # PG Diploma courses - fix inconsistencies
    'PG DIPLOMA IN ORTHODONTICS DENTOFACIAL ORTHOPEDICS': 'PG DIPLOMA IN ORTHODONITICS AND DENTOFACIAL ORTHOPEDICS',
    'DIPLOMA IN CONSERVATIVE DENTISTRY': 'DIPLOMA IN CONSERVATIVE DENTISTRY',
    'DIPLOMA IN ORTHODONTICS AND DENTOFACIAL ORTHOPEDICS': 'DIPLOMA IN ORTHODONITICS AND DENTOFACIAL ORTHOPEDICS',
}

logger.info("\n📝 UPDATING COURSE NAMES IN MASTER DATA")
logger.info("-" * 120)

cur = master_db.cursor()

# Get current course mappings
for old_name, new_name in course_fixes.items():
    try:
        # Check if old name exists
        result = cur.execute("""
            SELECT id, normalized_name FROM courses WHERE normalized_name = ?
        """, (old_name,)).fetchall()

        if result:
            for course_id, current_normalized in result:
                if current_normalized != new_name:
                    logger.info(f"\n  Updating course ID {course_id}:")
                    logger.info(f"    FROM: {current_normalized}")
                    logger.info(f"    TO:   {new_name}")

                    cur.execute("""
                        UPDATE courses
                        SET normalized_name = ?
                        WHERE id = ?
                    """, (new_name, course_id))

                    logger.info(f"    ✅ Updated")
    except Exception as e:
        logger.warning(f"Error updating {old_name}: {e}")

master_db.commit()

logger.info("\n✅ COURSE UPDATES COMPLETED")
logger.info("-" * 120)

# Verify updates
logger.info("\n🔍 VERIFYING UPDATES")
logger.info("-" * 120)

for old_name, new_name in course_fixes.items():
    result = cur.execute("""
        SELECT COUNT(*) as count FROM courses WHERE normalized_name = ?
    """, (new_name,)).fetchone()

    if result and result[0] > 0:
        logger.info(f"✅ {new_name}: {result[0]} course(s)")
    else:
        # Check if old name still exists
        result_old = cur.execute("""
            SELECT COUNT(*) as count FROM courses WHERE normalized_name = ?
        """, (old_name,)).fetchone()

        if result_old and result_old[0] > 0:
            logger.warning(f"❌ {old_name}: Still exists ({result_old[0]} courses)")

logger.info("\n" + "="*120)
logger.info("COURSE FIX COMPLETE")
logger.info("="*120)

master_db.close()
