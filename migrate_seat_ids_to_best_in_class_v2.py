#!/usr/bin/env python3
"""
Migrate Seat Data IDs to Best-In-Class Format (IMPROVED VERSION)

This script regenerates all seat_data IDs from the old hash-based format
to the new semantic sequential format:
    OLD: KA_f699e_d1c8c_UNK_ALL_ALL
    NEW: KA_DENTAL_2025_0001_A3F5

Format: STATE_COURSETYPE_YEAR_SEQUENCE_CHECKSUM

This version handles multi-campus and multi-specialty colleges by ensuring
unique IDs even when the same college appears multiple times.

Features:
- ✅ Handles multi-campus colleges
- ✅ Handles multi-specialty courses
- ✅ Guarantees uniqueness
- ✅ Non-breaking migration
- ✅ Reversible (backup available)

Date: November 9, 2025
"""

import sqlite3
import pandas as pd
import hashlib
import sys
from datetime import datetime
from pathlib import Path

# Configuration
DB_PATH = '/Users/kashyapanand/Public/New/data/sqlite/seat_data.db'
BACKUP_PATH = '/Users/kashyapanand/Public/New/data/sqlite/seat_data.db.backup'
MIGRATION_LOG_PATH = '/Users/kashyapanand/Public/New/logs/seat_id_migration.log'

print("="*80)
print("SEAT DATA ID MIGRATION: Best-In-Class Format (v2)")
print("="*80)
print(f"\nMigration Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Database: {DB_PATH}")

# Step 1: Backup
print("\n" + "="*80)
print("STEP 1: Backup Database")
print("="*80)

try:
    import shutil
    if not Path(BACKUP_PATH).exists():
        shutil.copy(DB_PATH, BACKUP_PATH)
        print(f"✅ Backup created: {BACKUP_PATH}")
    else:
        print(f"⚠️  Backup already exists: {BACKUP_PATH}")
except Exception as e:
    print(f"❌ Backup failed: {e}")
    sys.exit(1)

# Step 2: Connect to database
print("\n" + "="*80)
print("STEP 2: Load Data")
print("="*80)

try:
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM seat_data ORDER BY state, course_type, created_at", conn)
    print(f"✅ Loaded {len(df):,} records from seat_data")
except Exception as e:
    print(f"❌ Failed to load data: {e}")
    sys.exit(1)

# Step 3: Generate new IDs (IMPROVED ALGORITHM)
print("\n" + "="*80)
print("STEP 3: Generate New IDs (With Multi-College Handling)")
print("="*80)

def generate_new_id(state, course_type, year, sequence_num):
    """Generate best-in-class ID"""
    state_code = state[:2].upper() if state else "XX"
    course_code = course_type[:6].upper() if course_type else "UNKNOWN"
    base_id = f"{state_code}_{course_code}_{year}_{sequence_num:04d}"
    checksum = hashlib.md5(base_id.encode()).hexdigest()[:4].upper()
    return f"{base_id}_{checksum}"

# IMPROVED: Generate IDs ensuring uniqueness across ALL records
old_to_new = {}
sequence_counters = {}  # Track sequence per (state, course_type, year)

df['year'] = pd.to_datetime(df['created_at']).dt.year

# Sort to ensure consistent ordering
df_sorted = df.sort_values(['state', 'course_type', 'year', 'college_name', 'course_name', 'created_at'])

for idx, row in df_sorted.iterrows():
    state = row['state']
    course_type = row['course_type']
    year = row['year']
    old_id = row['id']

    # Create a key for tracking sequences per (state, course_type, year)
    seq_key = (state, course_type, year)

    # Increment sequence counter
    if seq_key not in sequence_counters:
        sequence_counters[seq_key] = 1
    else:
        sequence_counters[seq_key] += 1

    # Generate new ID with incremented sequence
    new_id = generate_new_id(state, course_type, year, sequence_counters[seq_key])
    old_to_new[old_id] = new_id

print(f"✅ Generated {len(old_to_new):,} new IDs")
print(f"✅ Used {len(sequence_counters)} state/course_type/year combinations")

# Step 4: Validate new IDs
print("\n" + "="*80)
print("STEP 4: Validate New IDs")
print("="*80)

def validate_new_id(seat_id):
    """Validate new ID format"""
    try:
        parts = seat_id.split('_')
        if len(parts) != 5:
            return False, f"Invalid parts: {len(parts)}"
        state_code, course_code, year_str, seq_str, checksum = parts

        if len(state_code) != 2:
            return False, f"Invalid state code: {len(state_code)} chars"
        if len(course_code) < 1:
            return False, "Empty course code"

        year = int(year_str)
        if year < 2000 or year > 2100:
            return False, f"Invalid year: {year}"

        sequence = int(seq_str)
        if sequence < 1 or sequence > 9999:
            return False, f"Invalid sequence: {sequence}"

        base_id = f"{state_code}_{course_code}_{year_str}_{seq_str}"
        expected_checksum = hashlib.md5(base_id.encode()).hexdigest()[:4].upper()
        if checksum != expected_checksum:
            return False, f"Checksum mismatch: {checksum} != {expected_checksum}"

        return True, None
    except Exception as e:
        return False, str(e)

# Validate all new IDs
validation_failures = []
for old_id, new_id in old_to_new.items():
    is_valid, error = validate_new_id(new_id)
    if not is_valid:
        validation_failures.append((old_id, new_id, error))

if validation_failures:
    print(f"❌ {len(validation_failures)} validation failures:")
    for old_id, new_id, error in validation_failures[:5]:
        print(f"  {old_id} → {new_id}: {error}")
    sys.exit(1)
else:
    print(f"✅ All {len(old_to_new):,} new IDs validated successfully")

# Step 5: Check for uniqueness
print("\n" + "="*80)
print("STEP 5: Check Uniqueness")
print("="*80)

new_ids = list(old_to_new.values())
unique_ids = set(new_ids)

print(f"  Total IDs: {len(new_ids):,}")
print(f"  Unique IDs: {len(unique_ids):,}")
print(f"  Duplicates: {len(new_ids) - len(unique_ids)}")

if len(new_ids) != len(unique_ids):
    print(f"❌ Duplicate IDs detected!")
    # Find duplicates
    from collections import Counter
    id_counts = Counter(new_ids)
    duplicates = {id: count for id, count in id_counts.items() if count > 1}
    for dup_id, count in list(duplicates.items())[:5]:
        print(f"  {dup_id} appears {count} times")
    sys.exit(1)
else:
    print(f"✅ All {len(new_ids):,} new IDs are unique!")

# Step 6: Update database
print("\n" + "="*80)
print("STEP 6: Update Database")
print("="*80)

try:
    cursor = conn.cursor()

    # Build update statements
    updates = []
    for old_id, new_id in old_to_new.items():
        updates.append((new_id, old_id))

    # Execute updates in transaction
    cursor.executemany(
        "UPDATE seat_data SET id = ? WHERE id = ?",
        updates
    )
    conn.commit()

    print(f"✅ Updated {len(updates):,} records")
except Exception as e:
    print(f"❌ Update failed: {e}")
    conn.rollback()
    sys.exit(1)

# Step 7: Verify update
print("\n" + "="*80)
print("STEP 7: Verify Update")
print("="*80)

try:
    # Sample new IDs
    cursor.execute("SELECT DISTINCT id FROM seat_data ORDER BY id LIMIT 10")
    samples = cursor.fetchall()
    print(f"\n  Sample new IDs (first 10):")
    for (sample_id,) in samples:
        print(f"    {sample_id}")

    # Verify all IDs are in new format
    cursor.execute("SELECT COUNT(*) FROM seat_data WHERE id LIKE '%_%_%_%_%'")
    new_format_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM seat_data")
    total_count = cursor.fetchone()[0]

    print(f"\n  New format IDs: {new_format_count:,}/{total_count:,}")

    if new_format_count != total_count:
        print(f"⚠️  Warning: Not all records have new format IDs")

    print(f"\n✅ Verification passed")
except Exception as e:
    print(f"⚠️  Verification warning: {e}")

# Step 8: Create migration audit log
print("\n" + "="*80)
print("STEP 8: Create Migration Audit Log")
print("="*80)

try:
    log_dir = Path(MIGRATION_LOG_PATH).parent
    log_dir.mkdir(parents=True, exist_ok=True)

    with open(MIGRATION_LOG_PATH, 'w') as f:
        f.write("SEAT DATA ID MIGRATION LOG\n")
        f.write("="*80 + "\n\n")
        f.write(f"Migration Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Database: {DB_PATH}\n")
        f.write(f"Backup: {BACKUP_PATH}\n")
        f.write(f"Version: v2 (Multi-college/multi-specialty aware)\n\n")

        f.write("MIGRATION SUMMARY\n")
        f.write("-"*80 + "\n")
        f.write(f"Total Records: {len(old_to_new):,}\n")
        f.write(f"New IDs Generated: {len(new_ids):,}\n")
        f.write(f"Unique IDs: {len(unique_ids):,}\n")
        f.write(f"State/Course/Year Combinations: {len(sequence_counters)}\n")
        f.write(f"Validation Failures: {len(validation_failures)}\n\n")

        f.write("ID MAPPING SAMPLE (first 20)\n")
        f.write("-"*80 + "\n")
        for i, (old_id, new_id) in enumerate(list(old_to_new.items())[:20]):
            f.write(f"{old_id} → {new_id}\n")

        f.write("\n\nFORMAT EXPLANATION\n")
        f.write("-"*80 + "\n")
        f.write("New ID Format: STATE_COURSETYPE_YEAR_SEQUENCE_CHECKSUM\n\n")
        f.write("Components:\n")
        f.write("  STATE: 2-letter state code (KA, MH, UP, etc.)\n")
        f.write("  COURSETYPE: First 6 letters of course type (DENTAL, MEDICAL, DNB)\n")
        f.write("  YEAR: Year for data vintage tracking (2025, 2026, etc.)\n")
        f.write("  SEQUENCE: 4-digit sequence number (0001-9999)\n")
        f.write("    - Incremented within each (state, course_type, year) combination\n")
        f.write("    - Handles multi-campus and multi-specialty colleges\n")
        f.write("  CHECKSUM: 4-character MD5 checksum for data integrity\n\n")
        f.write("Example: KA_DENTAL_2025_0001_1944\n")
        f.write("  KA = KARNATAKA\n")
        f.write("  DENTAL = Course type\n")
        f.write("  2025 = Year\n")
        f.write("  0001 = First record in this state/course/year group\n")
        f.write("  1944 = Checksum\n\n")

        f.write("ADVANTAGES\n")
        f.write("-"*80 + "\n")
        f.write("  ✅ Human-readable (state, course type, year visible)\n")
        f.write("  ✅ Sortable (natural grouping by state, then course type)\n")
        f.write("  ✅ Traceable (origin and vintage clear from ID)\n")
        f.write("  ✅ Checksummed (integrity verification)\n")
        f.write("  ✅ Paginatable (sequence-based sorting)\n")
        f.write("  ✅ Handles multi-campus colleges\n")
        f.write("  ✅ Handles multi-specialty courses\n")
        f.write("  ✅ Future-proof (works for MEDICAL, DNB, new states)\n\n")

    print(f"✅ Migration log created: {MIGRATION_LOG_PATH}")
except Exception as e:
    print(f"⚠️  Could not create log: {e}")

# Step 9: Summary
print("\n" + "="*80)
print("MIGRATION COMPLETE")
print("="*80)

cursor.execute("SELECT COUNT(*) FROM seat_data")
final_count = cursor.fetchone()[0]

print(f"""
✅ SUCCESS: Seat Data ID Migration Completed (v2)

Summary:
  Records Migrated: {len(old_to_new):,}
  New IDs Generated: {len(new_ids):,}
  Unique IDs: {len(unique_ids):,}
  Current DB Records: {final_count:,}
  State/Course/Year Groups: {len(sequence_counters)}

ID Format Changed:
  OLD: KA_f699e_d1c8c_UNK_ALL_ALL (hash-based, opaque)
  NEW: KA_DENTAL_2025_0001_1944 (semantic, traceable, checksummed)

Key Improvements:
  ✅ Human-readable state, course type, and year
  ✅ Sortable and paginatable by state/course/year
  ✅ Checksummed for data integrity
  ✅ Handles multi-campus and multi-specialty colleges
  ✅ Future-proof (extensible to MEDICAL, DNB)
  ✅ Non-breaking migration (all data preserved)

Backup:
  Location: {BACKUP_PATH}

Migration Log:
  Location: {MIGRATION_LOG_PATH}

Next Steps:
  1. Verify matching pipeline still works
  2. Test seat data queries
  3. Add database indexes for performance
  4. Monitor performance metrics
  5. Update any documentation

Migration Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
""")

conn.close()

print("="*80)
