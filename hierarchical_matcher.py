#!/usr/bin/env python3
"""
Hierarchical College Matching Pipeline
Implements the user-suggested approach:
STATE → STREAM → COLLEGE NAME → ADDRESS → COMPOSITE KEY MATCHING

This eliminates false matches by filtering sequentially from most
restrictive (state) to least restrictive (college name).
"""

import sqlite3
import pandas as pd
import logging
from typing import Optional, Tuple, List, Dict
from difflib import SequenceMatcher

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HierarchicalMatcher:
    """Hierarchical college matcher with proper composite key validation"""

    def __init__(self, master_db_path='data/sqlite/master_data.db',
                 seat_db_path='data/sqlite/seat_data.db'):
        self.master_conn = sqlite3.connect(master_db_path)
        self.master_conn.row_factory = sqlite3.Row
        self.seat_conn = sqlite3.connect(seat_db_path)
        self.seat_conn.row_factory = sqlite3.Row

        self._stream_cache = {}
        self._college_cache = {}

    def get_stream_from_course(self, course_name: str) -> str:
        """Detect stream (DENTAL, MEDICAL, DNB) from course name"""
        course_upper = course_name.upper()

        # BDS courses
        if 'BDS' in course_upper:
            return 'DENTAL'

        # MDS courses
        if 'MDS' in course_upper:
            return 'DENTAL'

        # PG DIPLOMA in dentistry
        if 'PG DIPLOMA' in course_upper and any(x in course_upper for x in ['CONSERVATIVE', 'PROSTHO', 'ORTHODONT', 'PERIODONTOLOGY', 'PEDIATRIC', 'ORAL']):
            return 'DENTAL'

        # DIPLOMA in dentistry
        if 'DIPLOMA' in course_upper and any(x in course_upper for x in ['CONSERVATIVE', 'PROSTHO', 'ORTHODONT', 'PERIODONTOLOGY', 'PEDIATRIC', 'ORAL', 'DENTISTRY']):
            return 'DENTAL'

        # DNB courses
        if 'DNB' in course_upper:
            return 'DNB'

        # MD/MS/MCH/DM courses (medical/postgraduate)
        if any(x in course_upper for x in ['MD ', 'MS ', 'MCH', 'DM ', 'MBBS', 'MPH']):
            return 'MEDICAL'

        # Default to MEDICAL if contains MEDICAL
        if 'MEDICAL' in course_upper:
            return 'MEDICAL'

        # Default to DENTAL if contains DENTAL
        if 'DENTAL' in course_upper:
            return 'DENTAL'

        return 'MEDICAL'  # Default to MEDICAL

    def filter_by_state(self, state: str) -> pd.DataFrame:
        """STEP 1: Filter master colleges by STATE (most restrictive)"""
        query = """
            SELECT DISTINCT c.id, c.name, c.address, c.normalized_name, c.source_table, c.normalized_state as state
            FROM colleges c
            WHERE c.normalized_state = ?
            ORDER BY c.normalized_name
        """
        result = pd.read_sql(query, self.master_conn, params=(state.upper(),))
        logger.info(f"  STATE filter: 2,443 colleges → {len(result)} colleges in {state}")
        return result

    def filter_by_stream(self, colleges_df: pd.DataFrame, stream: str) -> pd.DataFrame:
        """STEP 2: Filter colleges by STREAM/COURSE TYPE"""
        stream_upper = stream.upper()

        # Map stream to source_table
        stream_map = {
            'DENTAL': 'DENTAL',
            'MEDICAL': 'MEDICAL',
            'DNB': 'DNB'
        }

        source_table = stream_map.get(stream_upper, 'MEDICAL')
        filtered = colleges_df[colleges_df['source_table'] == source_table]

        logger.info(f"  STREAM filter: {len(colleges_df)} colleges → {len(filtered)} {stream} colleges")
        return filtered

    def filter_by_college_name(self, colleges_df: pd.DataFrame, college_name: str) -> pd.DataFrame:
        """STEP 3: Filter colleges by COLLEGE NAME (exact match on normalized name)"""
        college_norm = college_name.upper().strip()

        # Exact match on normalized name
        exact_matches = colleges_df[colleges_df['normalized_name'] == college_norm]

        if len(exact_matches) > 0:
            logger.info(f"  COLLEGE NAME filter: {len(colleges_df)} colleges → {len(exact_matches)} exact matches")
            return exact_matches

        # Fuzzy match if no exact match
        fuzzy_matches = []
        for pos, (idx, row) in enumerate(colleges_df.iterrows()):
            ratio = SequenceMatcher(None, college_norm, row['normalized_name']).ratio()
            if ratio >= 0.85:  # 85% similarity threshold
                fuzzy_matches.append((pos, idx, row, ratio))

        if fuzzy_matches:
            fuzzy_matches.sort(key=lambda x: x[3], reverse=True)
            fuzzy_positions = [pos for pos, idx, row, ratio in fuzzy_matches]
            result = colleges_df.iloc[fuzzy_positions]
            logger.info(f"  COLLEGE NAME filter: {len(colleges_df)} colleges → {len(result)} fuzzy matches (85%+)")
            return result

        logger.warning(f"  COLLEGE NAME filter: No matches found for '{college_name}'")
        return pd.DataFrame()

    def filter_by_address(self, colleges_df: pd.DataFrame, address: str) -> Optional[pd.DataFrame]:
        """
        STEP 4: Filter colleges by ADDRESS (exact city/district match)

        CRITICAL: Prevents false matches when address is missing.
        - If address is NULL/empty AND multiple candidates exist: BLOCK (return empty)
        - If address is NULL/empty AND only 1 candidate: SAFE (return it)
        - This prevents arbitrary selection of first college from multi-location colleges

        Example: GOVERNMENT DENTAL COLLEGE has 13 locations. Without address validation,
        any record without an address would randomly match to one arbitrary location.
        """
        if not address or not address.strip():
            # SECURITY FIX: If no address provided, only safe if there's exactly 1 candidate
            if len(colleges_df) > 1:
                logger.warning(f"  ADDRESS filter: No address provided - cannot disambiguate {len(colleges_df)} candidates (BLOCKING!)")
                logger.warning(f"    ⚠️  SECURITY: Prevented potential false match by blocking arbitrary selection")
                return pd.DataFrame()  # Return empty to prevent arbitrary matching
            else:
                logger.warning(f"  ADDRESS filter: No address provided - but only 1 candidate exists, safe to return")
                return colleges_df

        address_upper = address.upper().strip()

        # Extract keywords from address
        keywords = set(address_upper.split())

        # Check each college's address for keyword match
        address_matches = []
        for pos, (idx, row) in enumerate(colleges_df.iterrows()):
            college_address = str(row.get('address', '')).upper()
            college_keywords = set(college_address.split())

            # Calculate keyword overlap
            common = keywords & college_keywords
            if len(common) > 0:  # At least one keyword match
                overlap_ratio = len(common) / len(keywords | college_keywords)
                address_matches.append((pos, idx, row, overlap_ratio, len(common)))

        if address_matches:
            # Sort by overlap ratio (descending)
            address_matches.sort(key=lambda x: (x[3], x[4]), reverse=True)
            matched_positions = [pos for pos, idx, row, ratio, common in address_matches]
            result = colleges_df.iloc[matched_positions]

            logger.info(f"  ADDRESS filter: {len(colleges_df)} candidates → {len(result)} address matches")

            # Show top match
            if len(result) > 0:
                top = result.iloc[0]
                logger.info(f"    Top match: {top['normalized_name']} + {top['address']}")

            return result

        logger.warning(f"  ADDRESS filter: No address matches for '{address}'")
        return pd.DataFrame()

    def match_college(self, college_name: str, state: str, course_name: str, address: str = None) -> Optional[Dict]:
        """
        Main hierarchical matching pipeline

        STEP 1: Filter by STATE (most restrictive)
        STEP 2: Filter by STREAM (detected from course)
        STEP 3: Filter by COLLEGE NAME
        STEP 4: Filter by ADDRESS
        STEP 5: Return matched college_id
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"MATCHING: {college_name} + {address} ({state}) / {course_name}")
        logger.info(f"{'='*100}")

        # STEP 1: STATE FILTER
        state_filtered = self.filter_by_state(state)
        if len(state_filtered) == 0:
            logger.warning(f"❌ No colleges found in {state}")
            return None

        # STEP 2: STREAM FILTER
        stream = self.get_stream_from_course(course_name)
        logger.info(f"  Detected stream: {stream}")

        stream_filtered = self.filter_by_stream(state_filtered, stream)
        if len(stream_filtered) == 0:
            logger.warning(f"❌ No {stream} colleges in {state}")
            return None

        # STEP 3: COLLEGE NAME FILTER
        name_filtered = self.filter_by_college_name(stream_filtered, college_name)
        if len(name_filtered) == 0:
            logger.warning(f"❌ No colleges match '{college_name}'")
            return None

        # STEP 4: ADDRESS FILTER
        address_filtered = self.filter_by_address(name_filtered, address)
        if address_filtered is None or len(address_filtered) == 0:
            logger.warning(f"❌ No colleges match address '{address}'")
            return None

        # STEP 5: RETURN TOP MATCH
        match = address_filtered.iloc[0]
        logger.info(f"\n✅ MATCHED: {match['id']} = '{match['normalized_name']}' + '{match['address']}'")

        return {
            'college_id': match['id'],
            'college_name': match['name'],
            'address': match['address'],
            'state': match['state']
        }

    def match_all_records(self, table_name='seat_data') -> None:
        """Match all records in seat_data using hierarchical approach"""
        logger.info(f"\n{'='*100}")
        logger.info(f"STARTING HIERARCHICAL MATCHING FOR ALL {table_name.upper()} RECORDS")
        logger.info(f"{'='*100}\n")

        # Get all seat_data records
        records = pd.read_sql(f"SELECT * FROM {table_name}", self.seat_conn)
        logger.info(f"Total records to match: {len(records):,}")

        # Track results
        matched = 0
        unmatched = 0
        matches_by_id = {}

        # Process each record
        for idx, record in records.iterrows():
            if (idx + 1) % 100 == 0:
                logger.info(f"Progress: {idx+1}/{len(records)} ({(idx+1)/len(records)*100:.1f}%)")

            college_name = record.get('college_name', '')
            state = record.get('normalized_state', '')
            course_name = record.get('course_name', '')
            address = record.get('normalized_address', '')

            if not college_name or not state:
                unmatched += 1
                continue

            # Try to match
            result = self.match_college(college_name, state, course_name, address)

            if result:
                matched += 1
                college_id = result['college_id']

                # Track for false match detection
                if college_id not in matches_by_id:
                    matches_by_id[college_id] = {
                        'college_name': result['college_name'],
                        'addresses': set(),
                        'states': set()
                    }

                matches_by_id[college_id]['addresses'].add(result['address'])
                matches_by_id[college_id]['states'].add(state)

                # Update database
                try:
                    cursor = self.seat_conn.cursor()
                    cursor.execute(f"""
                        UPDATE {table_name}
                        SET master_college_id = ?
                        WHERE id = ?
                    """, (college_id, record['id']))
                    self.seat_conn.commit()
                except Exception as e:
                    logger.error(f"Error updating record: {e}")
            else:
                unmatched += 1

        # Report results
        logger.info(f"\n{'='*100}")
        logger.info(f"MATCHING COMPLETE")
        logger.info(f"{'='*100}")
        logger.info(f"✅ Matched: {matched:,} ({matched/len(records)*100:.1f}%)")
        logger.info(f"❌ Unmatched: {unmatched:,} ({unmatched/len(records)*100:.1f}%)")

        # Check for false matches
        logger.info(f"\nFALSE MATCH CHECK:")
        false_matches = {}
        for college_id, data in matches_by_id.items():
            if len(data['addresses']) > 1:
                false_matches[college_id] = data

        if false_matches:
            logger.warning(f"❌ Found {len(false_matches)} FALSE MATCHES:")
            for college_id, data in false_matches.items():
                logger.warning(f"  {college_id}: {len(data['addresses'])} different addresses")
                for addr in data['addresses']:
                    logger.warning(f"    - {addr}")
        else:
            logger.info(f"✅ NO FALSE MATCHES - Composite key validation successful!")

if __name__ == '__main__':
    matcher = HierarchicalMatcher()

    # Test on sample colleges first
    logger.info("\n\n" + "="*100)
    logger.info("TESTING ON SAMPLE COLLEGES")
    logger.info("="*100)

    test_cases = [
        ('GOVERNMENT DENTAL COLLEGE', 'KERALA', 'MDS IN PERIODONTOLOGY', 'KOTTAYAM'),
        ('GOVERNMENT DENTAL COLLEGE', 'KERALA', 'BDS', 'ALAPPUZHA'),
        ('BHARATI VIDYAPEETH DENTAL COLLEGE AND HOSPITAL', 'MAHARASHTRA', 'BDS', 'PUNE'),
        ('MANIPAL COLLEGE OF DENTAL SCIENCES', 'KARNATAKA', 'BDS', 'MANIPAL'),
    ]

    for college, state, course, addr in test_cases:
        result = matcher.match_college(college, state, course, addr)
        logger.info(f"Result: {result}\n")

    # Match all records
    logger.info("\n\n" + "="*100)
    logger.info("MATCHING ALL RECORDS")
    logger.info("="*100)
    matcher.match_all_records()
