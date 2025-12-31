#!/usr/bin/env python3
"""
PRE-PROCESSING STEP: Group seat_data by exact (state, college_name, address) match

This is just grouping/organization - NOT changing the matching algorithm.

Flow:
1. Read seat_data
2. Group by exact (state, college_name, address) match
3. Create group_matching_queue with one representative record per group
4. Process only 2,439 groups instead of 16,280 records
5. Bulk propagate results back

Performance:
- Old: 16,280 records × 7.3ms = 118 seconds + overhead = ~2 minutes
- New: 2,439 groups × 7.3ms = 18 seconds + overhead = ~30-60 seconds
- Reduction: 6.7x fewer records to process
"""

import sqlite3
import logging
from collections import defaultdict
from datetime import datetime
import re

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def extract_address_keywords(address, include_generic=True):
    """
    Extract keywords from address.

    Args:
        address: Address to extract keywords from
        include_generic: If True, keep generic terms like HOSPITAL, COLLEGE, DISTRICT
                        If False, remove generic terms (matches master_data format)

    RULE #1: Use NORMALIZED address keywords for matching
    """
    if not address or address == 'NO_ADDRESS':
        return ''

    # Normalize to uppercase
    address_upper = str(address).upper().strip()

    # Split by comma first to get comma-separated keywords/phrases
    comma_separated = [part.strip() for part in address_upper.split(',')]

    # Keep ALL meaningful keywords - don't filter generics
    # Some "generic" terms are actually meaningful location identifiers:
    # - EAST/WEST/NORTH/SOUTH: part of place names (EAST GODHAVARI vs WEST GODHAVARI)
    # - SECTOR/BLOCK: location identifiers (SECTOR 16, BLOCK 5)
    # - DISTRICT: differentiates locations (TUMAKURU DISTRICT)
    # Let the matcher handle disambiguation using keyword overlap
    excluded_terms = set()  # No exclusion - keep all keywords

    meaningful_keywords = set()

    # Process each comma-separated part
    for part in comma_separated:
        if not part:
            continue

        # Split by spaces and other delimiters
        words = re.split(r'[\s.@]+', part)

        # Extract meaningful words
        for word in words:
            word = word.strip('.,;:()[]{}')
            # Keep words >= 3 chars
            if len(word) >= 3:
                # Skip if it's a number or mostly numbers
                if not word.replace('-', '').replace('/', '').isdigit():
                    # Skip excluded terms only if include_generic=False
                    if word not in excluded_terms:
                        meaningful_keywords.add(word)

    # Join keywords with spaces (matching master_data format)
    return ' '.join(sorted(meaningful_keywords))


def create_composite_college_key(normalized_college_name, normalized_address):
    """
    Create composite college key from NORMALIZED name and EXTRACTED keywords from address.

    RULE #1: Always use NORMALIZED fields with generic keywords removed

    Format: "COLLEGE_NAME, EXTRACTED_KEYWORDS"
    Matches master_data's composite_college_key format exactly.
    """
    if not normalized_college_name:
        return None

    # Use normalized college name
    clean_name = normalized_college_name.strip().upper()

    if not normalized_address or normalized_address == 'NO_ADDRESS':
        return clean_name

    # Extract meaningful keywords from address (removes generic terms)
    keywords = extract_address_keywords(normalized_address, include_generic=False)

    if not keywords:
        return clean_name

    # Create composite key: COLLEGE_NAME, EXTRACTED_KEYWORDS (matching master_data format)
    composite_key = f"{clean_name}, {keywords}"
    return composite_key


class GroupPreprocessor:
    """Create exact match groups from seat_data or other source table"""

    def __init__(self, seat_db_path='data/sqlite/seat_data.db', table_name='seat_data'):
        self.seat_db_path = seat_db_path
        self.table_name = table_name  # Allow custom table name to avoid VIEW overhead

    def create_groups(self):
        """
        Group seat_data by exact (state, college_name, address) match.

        Creates group_matching_queue table with one record per unique combination.
        """
        logger.info("\n" + "="*80)
        logger.info("📋 PRE-PROCESSING: Creating exact match groups")
        logger.info("="*80 + "\n")

        # Ensure ID sync triggers exist (master_*_id ↔ *_id)
        try:
            from db_triggers import ensure_triggers
            trigger_stats = ensure_triggers(self.seat_db_path, self.table_name)
            synced = sum(trigger_stats.get('sync', {}).values())
            if synced > 0:
                logger.info(f"🔄 Synced {synced} records (master_*_id ↔ *_id)")
        except ImportError:
            logger.warning("db_triggers not found - skipping ID sync triggers")

        conn = sqlite3.connect(self.seat_db_path)
        cursor = conn.cursor()

        # STEP 1: Drop and recreate group_matching_queue table with new schema
        # RULE #1: Store NORMALIZED fields for matching
        logger.info("Dropping and recreating group_matching_queue table...")
        cursor.execute("DROP TABLE IF EXISTS group_matching_queue")

        cursor.execute("""
        CREATE TABLE group_matching_queue (
            group_id INTEGER PRIMARY KEY AUTOINCREMENT,
            normalized_state TEXT NOT NULL,
            normalized_college_name TEXT NOT NULL,
            normalized_address TEXT,
            state TEXT,
            college_name TEXT,
            address TEXT,
            composite_college_key TEXT,
            sample_course_type TEXT,
            sample_course_name TEXT,
            record_count INTEGER DEFAULT 1,
            matched_college_id TEXT,
            match_score REAL,
            match_method TEXT,
            match_model TEXT,
            is_processed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # STEP 3: Read all source data and group by NORMALIZED (state, college_name, address) + COURSE_TYPE
        # RULE #1: Always use normalized fields for matching
        logger.info(f"Reading {self.table_name} and grouping by NORMALIZED (state, college_name, address) + COURSE_TYPE...")
        cursor.execute(f"""
        SELECT id, normalized_state, normalized_college_name, normalized_address,
               course_type, course_name, state, college_name, address
        FROM {self.table_name}
        ORDER BY normalized_state, normalized_college_name, normalized_address, course_type
        """)

        records = cursor.fetchall()
        logger.info(f"Total records in {self.table_name}: {len(records):,}")

        # Group by exact (NORMALIZED state, college_name, address, course_type) match
        groups = defaultdict(list)
        for (record_id, norm_state, norm_college_name, norm_address,
             course_type, course_name, raw_state, raw_college_name, raw_address) in records:
            # Use NORMALIZED tuple + COURSE_TYPE as key for exact matching
            # CRITICAL FIX: Add course_type to prevent cross-stream contamination
            group_key = (norm_state, norm_college_name, norm_address or 'NO_ADDRESS', course_type)
            groups[group_key].append({
                'id': record_id,
                'normalized_state': norm_state,
                'normalized_college_name': norm_college_name,
                'normalized_address': norm_address,
                'raw_state': raw_state,
                'raw_college_name': raw_college_name,
                'raw_address': raw_address,
                'course_type': course_type,
                'course_name': course_name
            })

        logger.info(f"Created {len(groups):,} unique groups")

        # STEP 4: Insert one representative record per group into group_matching_queue
        # RULE #1: Use NORMALIZED fields as primary, keep RAW fields for reference
        logger.info("Inserting groups into group_matching_queue...")

        inserted_count = 0
        for (norm_state, norm_college_name, norm_address, course_type), group_records in groups.items():
            # Take first record as representative
            representative = group_records[0]

            # Create composite college key for direct matching
            # RULE #1: Use NORMALIZED fields
            composite_key = create_composite_college_key(
                norm_college_name,
                norm_address if norm_address != 'NO_ADDRESS' else None
            )

            cursor.execute("""
            INSERT INTO group_matching_queue
            (normalized_state, normalized_college_name, normalized_address,
             state, college_name, address, composite_college_key,
             sample_course_type, sample_course_name, record_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                norm_state,
                norm_college_name,
                norm_address if norm_address != 'NO_ADDRESS' else None,
                representative['raw_state'],
                representative['raw_college_name'],
                representative['raw_address'],
                composite_key,
                representative['course_type'],
                representative['course_name'],
                len(group_records)
            ))

            inserted_count += 1

            if inserted_count % 500 == 0:
                logger.info(f"  Inserted {inserted_count:,} groups...")

        conn.commit()

        # STEP 5: Verify and print statistics
        cursor.execute("SELECT COUNT(*) FROM group_matching_queue")
        total_groups = cursor.fetchone()[0]

        cursor.execute("""
        SELECT SUM(record_count)
        FROM group_matching_queue
        """)
        total_records = cursor.fetchone()[0]

        conn.close()

        logger.info("\n" + "="*80)
        logger.info("✅ PRE-PROCESSING COMPLETE")
        logger.info("="*80)
        logger.info(f"\n📊 GROUP STATISTICS:")
        logger.info(f"   Total records in seat_data:  {len(records):,}")
        logger.info(f"   Unique groups created:       {total_groups:,}")
        logger.info(f"   Total records in groups:     {total_records:,}")
        logger.info(f"   Reduction ratio:             {len(records)/total_groups:.1f}x")
        logger.info(f"   Average records per group:   {total_records/total_groups:.1f}")

        logger.info(f"\n⏱️  EXPECTED PERFORMANCE:")
        logger.info(f"   Old method: {len(records):,} × 7.3ms = ~{len(records)*7.3/1000:.0f}s")
        logger.info(f"   New method: {total_groups:,} × 7.3ms = ~{total_groups*7.3/1000:.0f}s")
        logger.info(f"   Time saved: ~{(len(records)-total_groups)*7.3/1000:.0f}s")

        logger.info(f"\n{'='*80}\n")

        return total_groups, total_records


def bulk_propagate_results(seat_db_path='data/sqlite/seat_data.db', table_name='seat_data'):
    """
    Propagate matched results from group_matching_queue back to source table.

    After processing groups through the matcher, bulk update all records
    with their group's matched college_id.
    """
    logger.info("\n" + "="*80)
    logger.info(f"📤 BULK PROPAGATING: Copying group results to all {table_name} records")
    logger.info("="*80 + "\n")

    conn = sqlite3.connect(seat_db_path)
    cursor = conn.cursor()

    # Update source table with matched results from group_matching_queue
    # RULE #1: Match on NORMALIZED fields + COURSE_TYPE (Stream)
    cursor.execute(f"""
    UPDATE {table_name}
    SET master_college_id = (
        SELECT matched_college_id
        FROM group_matching_queue gmq
        WHERE {table_name}.normalized_state = gmq.normalized_state
        AND {table_name}.normalized_college_name = gmq.normalized_college_name
        AND COALESCE({table_name}.normalized_address, 'NO_ADDRESS') = COALESCE(gmq.normalized_address, 'NO_ADDRESS')
        AND {table_name}.course_type = gmq.sample_course_type
    ),
    college_match_score = (
        SELECT match_score
        FROM group_matching_queue gmq
        WHERE {table_name}.normalized_state = gmq.normalized_state
        AND {table_name}.normalized_college_name = gmq.normalized_college_name
        AND COALESCE({table_name}.normalized_address, 'NO_ADDRESS') = COALESCE(gmq.normalized_address, 'NO_ADDRESS')
        AND {table_name}.course_type = gmq.sample_course_type
    ),
    college_match_method = (
        SELECT match_method
        FROM group_matching_queue gmq
        WHERE {table_name}.normalized_state = gmq.normalized_state
        AND {table_name}.normalized_college_name = gmq.normalized_college_name
        AND COALESCE({table_name}.normalized_address, 'NO_ADDRESS') = COALESCE(gmq.normalized_address, 'NO_ADDRESS')
        AND {table_name}.course_type = gmq.sample_course_type
    )
    WHERE EXISTS (
        SELECT 1
        FROM group_matching_queue gmq
        WHERE {table_name}.normalized_state = gmq.normalized_state
        AND {table_name}.normalized_college_name = gmq.normalized_college_name
        AND COALESCE({table_name}.normalized_address, 'NO_ADDRESS') = COALESCE(gmq.normalized_address, 'NO_ADDRESS')
        AND {table_name}.course_type = gmq.sample_course_type
    )
    """)

    conn.commit()

    # Count results
    cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE master_college_id IS NOT NULL")
    matched_records = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    total_records = cursor.fetchone()[0]

    match_rate = (matched_records / total_records * 100) if total_records > 0 else 0

    conn.close()

    logger.info(f"📊 BULK PROPAGATION RESULTS:")
    logger.info(f"   Total {table_name} records:  {total_records:,}")
    logger.info(f"   Matched records:          {matched_records:,} ({match_rate:.1f}%)")
    logger.info(f"   Unmatched records:        {total_records - matched_records:,} ({100-match_rate:.1f}%)")

    logger.info(f"\n{'='*80}\n")

    return matched_records, total_records


if __name__ == "__main__":
    preprocessor = GroupPreprocessor()
    total_groups, total_records = preprocessor.create_groups()

    print("\nNow run the matcher on group_matching_queue:")
    print("- Process each group through recent3.py match_college()")
    print("- Store matched_college_id, match_score, match_method in group_matching_queue")
    print("\nThen bulk propagate with:")
    print("  bulk_propagate_results()")
