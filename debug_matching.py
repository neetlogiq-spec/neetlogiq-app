#!/usr/bin/env python3
"""Debug script to trace college matching issue for GOVERNMENT DENTAL COLLEGE"""

import sys
import logging
from recent import AdvancedSQLiteMatcher

# Setup logging to see debug output
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create matcher instance
matcher = AdvancedSQLiteMatcher()

# Load master data
logger.info("Loading master data...")
matcher.load_master_data()

# Test matching for GOVERNMENT DENTAL COLLEGE + KOTTAYAM
college_name = "GOVERNMENT DENTAL COLLEGE"
address = "KOTTAYAM"
state = "KERALA"
course_name = "BDS"
course_type = "dental"  # BDS is a dental course

logger.warning("\n" + "="*100)
logger.warning(f"TESTING: {college_name} + {address} + {state} + {course_name}")
logger.warning("="*100 + "\n")

# Call the matching function directly with correct signature:
# match_regular_course(college_name, state, course_type, address, course_name)
result = matcher.match_regular_course(college_name, state, course_type, address, course_name)

logger.warning("\n" + "="*100)
logger.warning(f"RESULT: {result}")
logger.warning("="*100 + "\n")

# Test with other addresses
for addr in ["ALAPPUZHA", "KOZHIKODE", "THRISSUR", "TRIVANDRUM"]:
    logger.warning(f"\n--- Testing {college_name} + {addr} + {state} ---")
    result = matcher.match_regular_course(college_name, state, course_type, addr, course_name)
    logger.warning(f"Result: {result}")

