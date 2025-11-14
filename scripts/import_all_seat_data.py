#!/usr/bin/env python3
"""
Import all seat data from Excel files to PostgreSQL.
Imports medical.xlsx, dental.xlsx, and DNB.xlsx in a single operation.

Usage:
    python3 scripts/import_all_seat_data.py
"""

import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from lib.database import PostgreSQLManager
from lib.utils.data_normalizer import DataNormalizer
import pandas as pd
import yaml
from pathlib import Path

# Load config
with open('config.yaml') as f:
    config = yaml.safe_load(f)

pg_urls = config['database']['postgresql_urls']
seat_db = PostgreSQLManager(pg_urls['seat_data'])
normalizer = DataNormalizer(config)

print("=" * 100)
print("🎓 IMPORTING ALL SEAT DATA FROM EXCEL FILES")
print("=" * 100)

# Define seat data files
seat_dir = '/Users/kashyapanand/Desktop/EXPORT/seat_data'
seat_files = [
    ('medical.xlsx', 'MEDICAL'),
    ('DENTAL.xlsx', 'DENTAL'),
    ('DNB.xlsx', 'DNB')
]

all_data = []
total_rows = 0

# Read all files
print("\n📖 Reading Excel files...")
print("-" * 100)

for file_name, course_type in seat_files:
    file_path = Path(seat_dir) / file_name

    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        continue

    print(f"\nReading {file_name}...")
    try:
        df = pd.read_excel(file_path)
        print(f"  ✓ Read {len(df):,} rows, {len(df.columns)} columns")

        # Add course type marker
        df['_import_type'] = course_type

        all_data.append(df)
        total_rows += len(df)
    except Exception as e:
        print(f"  ❌ Error: {e}")

print(f"\n📊 Combining {len(all_data)} files...")
combined_df = pd.concat(all_data, ignore_index=True)
print(f"  ✓ Total rows: {len(combined_df):,}")

print(f"\n✏️  Normalizing and preparing data...")

try:
    # Map Excel column names to database columns
    column_mapping = {
        'STATE': 'state',
        'COLLEGE/INSTITUTE': 'college_name',
        'COLLEGE/institute': 'college_name',
        'College/Institute': 'college_name',
        'ADDRESS': 'address',
        'MANAGEMENT': 'management',
        'UNIVERSITY_AFFILIATION': 'university_affiliation',
        'COURSE': 'course_name',
        'SEATS': 'seats'
    }

    # Rename columns using mapping
    rename_dict = {}
    for old_col in combined_df.columns:
        if old_col in column_mapping:
            rename_dict[old_col] = column_mapping[old_col]
        elif old_col == '_import_type':
            rename_dict[old_col] = 'course_type'
        else:
            # Convert to lowercase with underscores
            rename_dict[old_col] = old_col.lower().replace(' ', '_')

    combined_df.rename(columns=rename_dict, inplace=True)
    print(f"  ✓ Columns mapped")

    # Convert seats to integer (handle NaN)
    if 'seats' in combined_df.columns:
        combined_df['seats'] = pd.to_numeric(combined_df['seats'], errors='coerce').astype('Int64')
        print(f"  ✓ Converted seats to integers")

    # Normalize data
    print(f"  ✓ Normalizing college names...")
    combined_df['normalized_college_name'] = combined_df['college_name'].apply(
        lambda x: normalizer.normalize_college_name(str(x)) if pd.notna(x) else None
    )

    print(f"  ✓ Normalizing course names...")
    combined_df['normalized_course_name'] = combined_df['course_name'].apply(
        lambda x: normalizer.normalize_college_name(str(x)) if pd.notna(x) else None
    )

    print(f"  ✓ Normalizing states...")
    combined_df['normalized_state'] = combined_df['state'].apply(
        lambda x: normalizer.normalize_state(str(x)) if pd.notna(x) else None
    )

    print(f"  ✓ Normalizing addresses...")
    combined_df['normalized_address'] = combined_df['address'].apply(
        lambda x: normalizer.normalize_address(str(x)) if pd.notna(x) else None
    )

    # Add missing columns with defaults
    combined_df['source_file'] = 'Excel Import'
    combined_df['created_at'] = pd.Timestamp.now().isoformat()
    combined_df['updated_at'] = pd.Timestamp.now().isoformat()

    print(f"  ✓ Data normalized and classified")

    # Convert all NA types to None for PostgreSQL compatibility
    combined_df = combined_df.astype('object').where(pd.notna(combined_df), None)

    # Get all columns needed for seat_data table
    seat_columns = [
        'college_name', 'course_name', 'seats', 'state', 'address',
        'management', 'university_affiliation', 'normalized_college_name',
        'normalized_course_name', 'normalized_state', 'normalized_address',
        'course_type', 'source_file', 'created_at', 'updated_at'
    ]

    # Fill missing columns
    for col in seat_columns:
        if col not in combined_df.columns:
            combined_df[col] = None

    # Select only needed columns
    df_insert = combined_df[seat_columns].copy()

    # Add ID column
    df_insert.insert(0, 'id', [f"SEAT{str(i+1).zfill(6)}" for i in range(len(df_insert))])

    print(f"  ✓ Generated {len(df_insert):,} record IDs")

    # Clear existing data
    print(f"\n🗑️  Clearing existing seat_data...")
    seat_db.execute_query("DELETE FROM seat_data")

    # Insert data in batches
    columns = df_insert.columns.tolist()
    placeholders = ', '.join(['%s'] * len(columns))
    col_str = ', '.join(columns)
    sql = f"INSERT INTO seat_data ({col_str}) VALUES ({placeholders})"

    data = [tuple(row) for row in df_insert.values]
    batch_size = 1000

    print(f"\n📥 Inserting {len(data):,} rows...")
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        seat_db.execute_many(sql, batch)
        print(f"  Inserted {min(i + batch_size, len(data)):,}/{len(data):,} rows")

    # Verify
    result = seat_db.fetch_one("SELECT COUNT(*) FROM seat_data")
    count = result[0] if result else 0
    print(f"\n✅ seat_data: {count:,} rows imported")

    # Statistics
    print(f"\n📊 Import Statistics:")
    result = seat_db.fetch_dict("""
        SELECT course_type, COUNT(*) as count
        FROM seat_data
        GROUP BY course_type
        ORDER BY count DESC
    """)

    for row in result:
        course_type = row['course_type'] or 'NULL'
        print(f"  • {course_type}: {row['count']:,} records")
    print(f"  • Total: {count:,} records")

    # Sample records
    print(f"\n📋 Sample records:")
    sample_result = seat_db.fetch_dict("""
        SELECT id, college_name, course_name, state, seats, course_type
        FROM seat_data
        LIMIT 5
    """)
    for row in sample_result:
        print(f"  • ID: {row['id']}, Type: {row['course_type']}, College: {str(row['college_name'])[:40]}, Seats: {row['seats']}")

    print("\n" + "=" * 100)
    print(f"✅ SEAT DATA IMPORT COMPLETE - {count:,} records imported")
    print("=" * 100)

except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

seat_db.close()
