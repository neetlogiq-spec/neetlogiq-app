#!/usr/bin/env python3
"""
Rebuild link tables from matched seat_data and run integrity checks.

This script:
1. Builds state_college_link from matched seat_data
2. Builds state_course_college_link from matched seat_data
3. Builds college_course_link from matched seat_data
4. Runs comprehensive integrity checks
5. Reports violations and false match patterns
"""

import sys
sys.path.insert(0, '/Users/kashyapanand/Public/New')

from lib.database import PostgreSQLManager
import yaml

# Load config
with open('config.yaml') as f:
    config = yaml.safe_load(f)

pg_urls = config['database']['postgresql_urls']
seat_db = PostgreSQLManager(pg_urls['seat_data'])
master_db = PostgreSQLManager(pg_urls['master_data'])

print("=" * 100)
print("🔗 REBUILDING LINK TABLES FROM MATCHED SEAT_DATA")
print("=" * 100)

# ============================================================================
# STEP 0: CREATE MISSING TABLES
# ============================================================================

print("\n📋 Step 0: Creating missing tables...")
print("-" * 100)

# Create college_course_link if it doesn't exist
try:
    sql = """
    CREATE TABLE IF NOT EXISTS college_course_link (
        college_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        occurrence_count INTEGER DEFAULT 1,
        PRIMARY KEY (college_id, course_id)
    )
    """
    master_db.execute_query(sql)
    print("   ✅ college_course_link table ready")
except Exception as e:
    print(f"   ℹ️  college_course_link: {str(e)[:80]}")

# Create state_course_college_link if it doesn't exist
try:
    sql = """
    CREATE TABLE IF NOT EXISTS state_course_college_link (
        state_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        college_id TEXT,
        occurrence_count INTEGER DEFAULT 1,
        master_address TEXT,
        seat_address_normalized TEXT,
        PRIMARY KEY (state_id, course_id, college_id),
        FOREIGN KEY (state_id) REFERENCES states(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
    )
    """
    master_db.execute_query(sql)
    print("   ✅ state_course_college_link table ready")
except Exception as e:
    print(f"   ℹ️  state_course_college_link: {str(e)[:80]}")

# ============================================================================
# STEP 1: BUILD LINK TABLES FROM MATCHED RECORDS
# ============================================================================

print("\n📚 Step 1: Building link tables from matched records...")
print("-" * 100)

# Count matched records
result = seat_db.fetch_one("SELECT COUNT(*) FROM seat_data WHERE master_college_id IS NOT NULL")
matched_count = result[0] if result else 0
print(f"\n✅ Matched seat_data records: {matched_count:,}")

# Build state_college_link
print("\n1️⃣  Building state_college_link...")
master_db.execute_query("DELETE FROM state_college_link")

sql = """
  SELECT DISTINCT
    s.master_state_id as state_id,
    s.master_college_id as college_id,
    s.college_name,
    UPPER(TRIM(s.normalized_state)) as state_name,
    s.address
  FROM seat_data s
  WHERE s.master_college_id IS NOT NULL
    AND s.master_state_id IS NOT NULL
"""

results = seat_db.fetch_dict(sql)
print(f"   Found {len(results):,} unique state-college combinations")

inserted = 0
for row in results:
    try:
        college_name_esc = row['college_name'].replace("'", "''") if row['college_name'] else 'UNKNOWN'
        address_esc = row['address'].replace("'", "''") if row['address'] else ''
        state_esc = row['state_name'].replace("'", "''") if row['state_name'] else ''

        master_db.execute_query(f"""
          INSERT INTO state_college_link
          (state_id, college_id, college_name, state, address)
          VALUES ('{row['state_id']}', '{row['college_id']}', '{college_name_esc}', '{state_esc}', '{address_esc}')
          ON CONFLICT DO NOTHING
        """)
        inserted += 1
    except Exception as e:
        pass

print(f"   ✅ Inserted {inserted:,} rows into state_college_link")

# Build college_course_link
print("\n2️⃣  Building college_course_link...")
master_db.execute_query("DELETE FROM college_course_link")

sql = """
  SELECT DISTINCT
    s.master_college_id as college_id,
    s.master_course_id as course_id,
    COUNT(*) as occurrence_count
  FROM seat_data s
  WHERE s.master_college_id IS NOT NULL
    AND s.master_course_id IS NOT NULL
  GROUP BY s.master_college_id, s.master_course_id
"""

results = seat_db.fetch_dict(sql)
print(f"   Found {len(results):,} unique college-course combinations")

inserted = 0
for row in results:
    try:
        master_db.execute_query(f"""
          INSERT INTO college_course_link
          (college_id, course_id, occurrence_count)
          VALUES ('{row['college_id']}', '{row['course_id']}', {row['occurrence_count']})
          ON CONFLICT DO NOTHING
        """)
        inserted += 1
    except:
        pass

print(f"   ✅ Inserted {inserted:,} rows into college_course_link")

# Build state_course_college_link
print("\n3️⃣  Building state_course_college_link...")
master_db.execute_query("DELETE FROM state_course_college_link")

sql = """
  SELECT DISTINCT
    s.master_state_id as state_id,
    s.master_course_id as course_id,
    s.master_college_id as college_id,
    COUNT(*) as occurrence_count
  FROM seat_data s
  WHERE s.master_college_id IS NOT NULL
    AND s.master_course_id IS NOT NULL
    AND s.master_state_id IS NOT NULL
  GROUP BY s.master_state_id, s.master_course_id, s.master_college_id
"""

results = seat_db.fetch_dict(sql)
print(f"   Found {len(results):,} unique state-course-college combinations")

inserted = 0
for row in results:
    try:
        master_db.execute_query(f"""
          INSERT INTO state_course_college_link
          (state_id, course_id, college_id)
          VALUES ('{row['state_id']}', '{row['course_id']}', '{row['college_id']}')
          ON CONFLICT DO NOTHING
        """)
        inserted += 1
    except:
        pass

print(f"   ✅ Inserted {inserted:,} rows into state_course_college_link")

# ============================================================================
# STEP 2: RUN INTEGRITY CHECKS
# ============================================================================

print("\n" + "=" * 100)
print("✅ INTEGRITY CHECKS")
print("=" * 100)

violations = []

# Check 1: College ID + State ID Uniqueness
print("\nCheck 1: College ID + State ID Uniqueness")
print("   Constraint: Each college_id should exist in ONLY ONE state")
print("-" * 100)

sql = """
  SELECT college_id, COUNT(DISTINCT state_id) as state_count
  FROM state_college_link
  GROUP BY college_id
  HAVING COUNT(DISTINCT state_id) > 1
  ORDER BY state_count DESC
"""

results = master_db.fetch_dict(sql)

if results:
    violations.append('college_state_uniqueness')
    print(f"   ❌ FAILED: {len(results)} colleges exist in MULTIPLE states")

    total_affected = 0
    for i, row in enumerate(results[:5]):
        college_id = row['college_id']
        states_count = row['state_count']

        # Get all states and record counts
        states_sql = f"""
          SELECT DISTINCT state, COUNT(*) as count
          FROM state_college_link
          WHERE college_id = '{college_id}'
          GROUP BY state
        """
        state_results = master_db.fetch_dict(states_sql)

        total_records = sum(s['count'] for s in state_results)
        total_affected += total_records

        state_names = ', '.join([f"{s['state']}" for s in state_results])
        print(f"      • {college_id}: {states_count} states ({state_names})")
        print(f"        {total_records} records affected")

    if len(results) > 5:
        print(f"      ... and {len(results) - 5} more colleges")

    print(f"      Total records affected: {total_affected}")
else:
    print(f"   ✅ PASSED: Each college exists in only ONE state")

# Check 2: College ID + Address Uniqueness (per state)
print("\nCheck 2: College ID + Address Uniqueness")
print("   Constraint: Each college_id should have ONLY ONE address per state")
print("-" * 100)

sql = """
  SELECT state_id, college_id, COUNT(DISTINCT address) as addr_count, COUNT(*) as record_count
  FROM state_college_link
  GROUP BY state_id, college_id
  HAVING COUNT(DISTINCT address) > 1
  ORDER BY record_count DESC
"""

results = master_db.fetch_dict(sql)

if results:
    violations.append('college_address_uniqueness')
    print(f"   ❌ FAILED: {len(results)} colleges have MULTIPLE addresses in same state")
    total_records = sum(r['record_count'] for r in results)
    print(f"      This is the FALSE MATCH problem! Affecting {total_records:,} records")

    for row in results[:3]:
        state_id = row['state_id']
        college_id = row['college_id']
        addr_count = row['addr_count']

        # Get state name
        state_sql = f"SELECT DISTINCT state FROM state_college_link WHERE state_id = '{state_id}' LIMIT 1"
        state_res = master_db.fetch_one(state_sql)
        state_name = state_res[0] if state_res else state_id

        # Get addresses
        addr_sql = f"""
          SELECT DISTINCT address, COUNT(*) as count
          FROM state_college_link
          WHERE state_id = '{state_id}' AND college_id = '{college_id}'
          GROUP BY address
          ORDER BY count DESC
        """
        addr_results = master_db.fetch_dict(addr_sql)

        print(f"\n      • {college_id} in {state_name}")
        print(f"        {addr_count} DIFFERENT addresses ({row['record_count']} records)")
        for i, addr_row in enumerate(addr_results[:3], 1):
            addr_short = addr_row['address'][:50] if addr_row['address'] else 'NULL'
            print(f"          {i}. {addr_short}... ({addr_row['count']} records)")
        if len(addr_results) > 3:
            remaining_count = sum(a['count'] for a in addr_results[3:])
            print(f"          ... and {len(addr_results) - 3} more addresses ({remaining_count} records)")

    if len(results) > 3:
        print(f"\n      ... and {len(results) - 3} more colleges with multiple addresses")
else:
    print(f"   ✅ PASSED: Each college has ONE address per state")

# Check 3: College ID + Course ID Uniqueness (per state)
print("\nCheck 3: College ID + Course ID Uniqueness")
print("   Constraint: Each college_id should have ONLY ONE course per state")
print("-" * 100)

sql = """
  SELECT state_id, college_id, course_id, COUNT(DISTINCT address) as addr_count, COUNT(*) as record_count
  FROM (
    SELECT DISTINCT
      master_state_id as state_id,
      master_college_id as college_id,
      master_course_id as course_id,
      address,
      COUNT(*) as cnt
    FROM seat_data
    WHERE master_college_id IS NOT NULL
      AND master_state_id IS NOT NULL
      AND master_course_id IS NOT NULL
    GROUP BY master_state_id, master_college_id, master_course_id, address
  ) sub
  GROUP BY state_id, college_id, course_id
  HAVING COUNT(DISTINCT address) > 1
  ORDER BY record_count DESC
"""

results = seat_db.fetch_dict(sql)

if results:
    violations.append('college_course_address_uniqueness')
    total_affected = sum(r['record_count'] for r in results)
    print(f"   ❌ CRITICAL DATA QUALITY ISSUE: Found {len(results)} FALSE MATCH patterns!")
    print(f"      Pattern: Same college_id matched to DIFFERENT physical locations")
    print(f"      Affecting {total_affected:,} total records")

    for row in results[:3]:
        state_id = row['state_id']
        college_id = row['college_id']
        course_id = row['course_id']
        addr_count = row['addr_count']

        # Get state name
        state_sql = f"SELECT DISTINCT state FROM state_college_link WHERE state_id = '{state_id}' LIMIT 1"
        state_res = master_db.fetch_one(state_sql)
        state_name = state_res[0] if state_res else state_id

        # Get addresses for this combination
        addr_sql = f"""
          SELECT DISTINCT address, COUNT(*) as count
          FROM seat_data
          WHERE master_college_id = '{college_id}'
            AND master_state_id = '{state_id}'
            AND master_course_id = '{course_id}'
          GROUP BY address
          ORDER BY count DESC
        """
        addr_results = seat_db.fetch_dict(addr_sql)

        print(f"\n      ❌ {college_id} + {course_id} in {state_name}")
        print(f"         ⚠️  {len(addr_results)} DIFFERENT addresses → {row['record_count']} records")
        for i, addr_row in enumerate(addr_results[:5], 1):
            addr_short = addr_row['address'][:40] if addr_row['address'] else 'NULL'
            print(f"         {i}. ({addr_row['count']} records) {addr_short}...")
        if len(addr_results) > 5:
            remaining_count = sum(a['count'] for a in addr_results[5:])
            print(f"         ... and {len(addr_results) - 5} more addresses ({remaining_count} records)")

    if len(results) > 3:
        print(f"\n      ... and {len(results) - 3} more false match patterns")
else:
    print(f"   ✅ PASSED: Each college has ONE address per state")

# Check 4: Expected Row Counts
print("\nCheck 4: Expected Row Counts")
print("-" * 100)

result = master_db.fetch_one("SELECT COUNT(*) FROM college_course_link")
ccl_count = result[0] if result else 0

result = master_db.fetch_one("SELECT COUNT(*) FROM state_course_college_link")
sccl_count = result[0] if result else 0

result = master_db.fetch_one("SELECT COUNT(DISTINCT (college_id, state_id)) FROM state_college_link")
unique_cs = result[0] if result else 0

print(f"   seat_data matched records:        {matched_count:,}")
print(f"   college_course_link:              {ccl_count:,} rows")
print(f"   state_course_college_link:        {sccl_count:,} rows")
print(f"   Unique (college_id + state_id):   {unique_cs:,}")

if sccl_count > matched_count * 0.8:
    extra = sccl_count - matched_count
    print(f"\n   ⚠️  WARNING: Link table has {extra:,} extra rows")
    print(f"      This indicates false matches (multiple addresses per college)")
else:
    print(f"\n   ✅ Row counts look reasonable")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "=" * 100)
if violations:
    print(f"❌ INTEGRITY VIOLATIONS DETECTED!")
    print(f"   Violations found: {', '.join(violations)}")
    print("=" * 100)
    print(f"\n⚠️  These violations indicate FALSE MATCHES in the seat_data matching!")
    print(f"   These should be reviewed before using for counselling matching.")
else:
    print(f"✅ ALL INTEGRITY CHECKS PASSED!")
    print(f"   Link tables are ready for counselling data matching.")
    print("=" * 100)

seat_db.close()
master_db.close()
