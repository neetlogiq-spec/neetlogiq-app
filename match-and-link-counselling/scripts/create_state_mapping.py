#!/usr/bin/env python3
"""
Create State Normalization Mapping Table
Maps messy state names from Excel files to canonical master database state names
"""

import sqlite3
import re
from pathlib import Path

# Define canonical state names (from master database)
CANONICAL_STATES = {
    'ANDAMAN AND NICOBAR ISLANDS': 'ANDAMAN AND NICOBAR ISLANDS',
    'ANDHRA PRADESH': 'ANDHRA PRADESH',
    'ARUNACHAL PRADESH': 'ARUNACHAL PRADESH',
    'ASSAM': 'ASSAM',
    'BIHAR': 'BIHAR',
    'CHANDIGARH': 'CHANDIGARH',
    'CHHATTISGARH': 'CHHATTISGARH',
    'DADRA AND NAGAR HAVELI': 'DADRA AND NAGAR HAVELI',
    'DAMAN AND DIU': 'DAMAN AND DIU',
    'DELHI': 'DELHI',
    'GOA': 'GOA',
    'GUJARAT': 'GUJARAT',
    'HARYANA': 'HARYANA',
    'HIMACHAL PRADESH': 'HIMACHAL PRADESH',
    'JAMMU AND KASHMIR': 'JAMMU AND KASHMIR',
    'JHARKHAND': 'JHARKHAND',
    'KARNATAKA': 'KARNATAKA',
    'KERALA': 'KERALA',
    'LADAKH': 'LADAKH',
    'MADHYA PRADESH': 'MADHYA PRADESH',
    'MAHARASHTRA': 'MAHARASHTRA',
    'MANIPUR': 'MANIPUR',
    'MEGHALAYA': 'MEGHALAYA',
    'MIZORAM': 'MIZORAM',
    'NAGALAND': 'NAGALAND',
    'ODISHA': 'ODISHA',
    'PUDUCHERRY': 'PUDUCHERRY',
    'PUNJAB': 'PUNJAB',
    'RAJASTHAN': 'RAJASTHAN',
    'SIKKIM': 'SIKKIM',
    'TAMIL NADU': 'TAMIL NADU',
    'TELANGANA': 'TELANGANA',
    'TRIPURA': 'TRIPURA',
    'UTTAR PRADESH': 'UTTAR PRADESH',
    'UTTARAKHAND': 'UTTARAKHAND',
    'WEST BENGAL': 'WEST BENGAL',
}

def normalize_state(raw_state: str) -> str:
    """
    Normalize messy state name to canonical form

    Handles:
    - Pin codes: "GUJARAT- 363641" → "GUJARAT"
    - Addresses: "BAGALKOT – 587103 KARNATAKA" → "KARNATAKA"
    - Typos: "DEL HI" → "DELHI"
    - Variations: "DELHI (NCT)" → "DELHI", "NEW DELHI" → "DELHI"
    - Extra text: "SAFDARJUNG HOSPITAL CAMPUS... DELHI" → "DELHI"
    """

    if not raw_state or str(raw_state).strip() == '':
        return None

    raw = str(raw_state).strip().upper()

    # Remove pin codes (6 digits) and hyphens
    raw = re.sub(r'-?\s*\d{6}', '', raw)
    raw = re.sub(r'-', ' ', raw)

    # Check if any canonical state name is mentioned
    for canonical in CANONICAL_STATES.keys():
        if canonical in raw:
            return canonical

    # Handle special cases
    if 'DELHI' in raw or 'DEL HI' in raw:
        return 'DELHI'

    if 'CHATTISGARH' in raw:
        return 'CHHATTISGARH'

    if 'PONDICHERRY' in raw:
        return 'PUDUCHERRY'

    if 'ORISSA' in raw:
        return 'ODISHA'

    if 'UTTRAKHAND' in raw:
        return 'UTTARAKHAND'

    if 'JAMMU' in raw and 'KASHMIR' in raw:
        return 'JAMMU AND KASHMIR'

    if 'DAMAN' in raw and 'DIU' in raw:
        return 'DAMAN AND DIU'

    if 'ANDAMAN' in raw:
        return 'ANDAMAN AND NICOBAR ISLANDS'

    # If still not found, try exact match after cleanup
    cleaned = raw.strip()
    if cleaned in CANONICAL_STATES:
        return CANONICAL_STATES[cleaned]

    # Return None if no match (will need manual review)
    return None

def create_state_mapping_table(db_path: str = 'data/sqlite/master_data.db'):
    """Create state normalization mapping table in database"""

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS state_mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_state TEXT UNIQUE NOT NULL,
            normalized_state TEXT NOT NULL,
            is_verified BOOLEAN DEFAULT TRUE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create index
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_state_mappings_raw
        ON state_mappings(raw_state)
    """)

    # Insert canonical mappings (identity mappings)
    canonical_mappings = [
        (state, state, True, 'Canonical state name')
        for state in CANONICAL_STATES.keys()
    ]

    cursor.executemany("""
        INSERT OR IGNORE INTO state_mappings (raw_state, normalized_state, is_verified, notes)
        VALUES (?, ?, ?, ?)
    """, canonical_mappings)

    # Insert common variations
    common_variations = [
        ('NEW DELHI', 'DELHI', True, 'Capital city → State'),
        ('DELHI (NCT)', 'DELHI', True, 'NCT variant'),
        ('DEL HI', 'DELHI', True, 'Typo'),
        ('CHATTISGARH', 'CHHATTISGARH', True, 'Spelling variant'),
        ('PONDICHERRY', 'PUDUCHERRY', True, 'Old name'),
        ('ORISSA', 'ODISHA', True, 'Old name'),
        ('UTTRAKHAND', 'UTTARAKHAND', True, 'Spelling variant'),
        ('ANDAMAN NICOBAR ISLANDS', 'ANDAMAN AND NICOBAR ISLANDS', True, 'Missing conjunction'),
        ('JAMMU & KASHMIR', 'JAMMU AND KASHMIR', True, 'Ampersand variant'),
        ('DAMAN & DIU', 'DAMAN AND DIU', True, 'Ampersand variant'),
    ]

    cursor.executemany("""
        INSERT OR IGNORE INTO state_mappings (raw_state, normalized_state, is_verified, notes)
        VALUES (?, ?, ?, ?)
    """, common_variations)

    conn.commit()

    # Print statistics
    total = cursor.execute("SELECT COUNT(*) FROM state_mappings").fetchone()[0]
    verified = cursor.execute("SELECT COUNT(*) FROM state_mappings WHERE is_verified = TRUE").fetchone()[0]

    print(f"✅ State mapping table created!")
    print(f"   Total mappings: {total}")
    print(f"   Verified: {verified}")

    conn.close()

def add_counselling_state_mappings(excel_path: str, db_path: str = 'data/sqlite/master_data.db'):
    """
    Read counselling Excel and add all unique states to mapping table
    Auto-normalize where possible, flag for manual review if uncertain
    """

    import pandas as pd

    # Read Excel
    df = pd.read_excel(excel_path)

    # Get unique states
    unique_states = df['STATE'].unique()
    unique_states = [str(s).strip() for s in unique_states if pd.notna(s)]

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    added = 0
    auto_normalized = 0
    needs_review = 0

    for raw_state in unique_states:
        # Check if already in table
        existing = cursor.execute(
            "SELECT normalized_state FROM state_mappings WHERE raw_state = ?",
            (raw_state,)
        ).fetchone()

        if existing:
            continue

        # Try to auto-normalize
        normalized = normalize_state(raw_state)

        if normalized:
            # Successfully normalized
            cursor.execute("""
                INSERT INTO state_mappings (raw_state, normalized_state, is_verified, notes)
                VALUES (?, ?, ?, ?)
            """, (raw_state, normalized, True, 'Auto-normalized from counselling data'))
            auto_normalized += 1
        else:
            # Could not normalize - needs manual review
            cursor.execute("""
                INSERT INTO state_mappings (raw_state, normalized_state, is_verified, notes)
                VALUES (?, ?, ?, ?)
            """, (raw_state, 'UNKNOWN', False, 'NEEDS MANUAL REVIEW - could not auto-normalize'))
            needs_review += 1

        added += 1

    conn.commit()
    conn.close()

    print(f"\n✅ Processed {len(unique_states)} states from counselling Excel:")
    print(f"   Added: {added}")
    print(f"   Auto-normalized: {auto_normalized}")
    print(f"   Needs manual review: {needs_review}")

    if needs_review > 0:
        print(f"\n⚠️  {needs_review} states need manual review!")
        print_unmapped_states(db_path)

def print_unmapped_states(db_path: str = 'data/sqlite/master_data.db'):
    """Print states that need manual review"""

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    unmapped = cursor.execute("""
        SELECT raw_state, notes
        FROM state_mappings
        WHERE is_verified = FALSE
        ORDER BY raw_state
    """).fetchall()

    if unmapped:
        print("\n=== STATES NEEDING MANUAL REVIEW ===")
        for raw_state, notes in unmapped:
            print(f"  - {raw_state}")
            print(f"    Reason: {notes}")

    conn.close()

def get_normalized_state(raw_state: str, db_path: str = 'data/sqlite/master_data.db') -> str:
    """
    Lookup normalized state from database
    Returns None if not found or needs manual review
    """

    if not raw_state:
        return None

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    result = cursor.execute("""
        SELECT normalized_state, is_verified
        FROM state_mappings
        WHERE raw_state = ?
    """, (str(raw_state).strip(),)).fetchone()

    conn.close()

    if result:
        normalized, is_verified = result
        if is_verified and normalized != 'UNKNOWN':
            return normalized

    return None

if __name__ == "__main__":
    print("🗺️  Creating State Normalization Mapping Table...\n")

    # Step 1: Create table with canonical states and common variations
    create_state_mapping_table()

    # Step 2: Add states from AIQ 2024 Excel
    print("\n📊 Processing AIQ 2024 Excel...")
    add_counselling_state_mappings('/Users/kashyapanand/Desktop/EXPORT/AIQ-2024.xlsx')

    print("\n✅ State mapping table ready!")
    print("\n💡 Tip: Use get_normalized_state(raw_state) to normalize states in matching script")
