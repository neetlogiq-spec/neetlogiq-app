#!/usr/bin/env python3
"""Debug script to check course type classification"""

import logging
from recent import AdvancedSQLiteMatcher

logging.basicConfig(level=logging.DEBUG, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

matcher = AdvancedSQLiteMatcher()

# Check course classification
course_name = "BDS"
normalized_course = matcher.normalize_text(course_name)
logger.warning(f"\n✓ Normalized course: '{course_name}' → '{normalized_course}'")

course_type = matcher.classify_course_type(normalized_course)
logger.warning(f"✓ Course type classification: '{normalized_course}' → {course_type}")

# Check master data courses
matcher.load_master_data()
logger.warning(f"\n✓ Available courses in master data:")
for course in list(matcher.dental_courses)[:20]:
    print(f"  - {course}")

# Check if BDS exists in dental_courses
logger.warning(f"\n✓ Is 'BDS' in dental_courses? {matcher.normalize_text('BDS') in matcher.dental_courses}")
logger.warning(f"✓ Is 'BDS' in medical_courses? {matcher.normalize_text('BDS') in matcher.medical_courses}")
logger.warning(f"✓ Is 'BDS' in dnb_courses? {matcher.normalize_text('BDS') in matcher.dnb_courses}")

# List courses starting with 'B'
logger.warning(f"\n✓ Dental courses starting with 'B':")
for course in matcher.dental_courses:
    if course.startswith('B'):
        print(f"  - {course}")
