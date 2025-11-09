#!/usr/bin/env python3
"""
FIX STAGE 1 ACCURACY: Copy required tables from master_data to seat_data

This enables PostgreSQL native JOINs and should improve accuracy from 69% → 95%+
"""

import psycopg2
from io import StringIO
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def copy_tables():
    """Copy required tables from master_data to seat_data"""

    seat_conn = psycopg2.connect("postgresql://kashyapanand@localhost:5432/seat_data")
    master_conn = psycopg2.connect("postgresql://kashyapanand@localhost:5432/master_data")

    print("\n" + "="*100)
    print("🔧 FIXING STAGE 1: Copying master_data tables to seat_data database")
    print("="*100)
    print()

    # Tables to copy
    tables_to_copy = [
        'state_college_link',
        'colleges',
        'state_course_college_link'
    ]

    seat_cursor = seat_conn.cursor()
    master_cursor = master_conn.cursor()

    try:
        for table_name in tables_to_copy:
            print(f"📋 Copying table: {table_name}")

            # Drop table if exists
            try:
                seat_cursor.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE")
                seat_conn.commit()
                logger.info(f"  ✓ Dropped existing {table_name} (if any)")
            except Exception as e:
                logger.warning(f"  ⚠️  Could not drop {table_name}: {e}")
                seat_conn.rollback()

            try:
                # Get table structure from master
                master_cursor.execute(f"""
                    SELECT
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position
                """, (table_name,))

                columns = master_cursor.fetchall()
                if not columns:
                    logger.warning(f"  ⚠️  Table {table_name} not found in master_data")
                    continue

                # Build CREATE TABLE statement
                col_defs = []
                col_names = []
                for col_name, col_type, is_nullable, col_default in columns:
                    col_names.append(col_name)

                    # Handle special types
                    if col_type.startswith('character varying'):
                        col_type = 'VARCHAR'

                    nullable = '' if is_nullable == 'NO' else 'NULL'
                    col_def = f"{col_name} {col_type} {nullable}".strip()
                    col_defs.append(col_def)

                create_sql = f"CREATE TABLE {table_name} ({', '.join(col_defs)})"
                seat_cursor.execute(create_sql)
                seat_conn.commit()
                logger.info(f"  ✓ Created {table_name} schema in seat_data")

                # Copy data row by row
                master_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                total_rows = master_cursor.fetchone()[0]

                if total_rows == 0:
                    logger.info(f"  ✓ Table {table_name} is empty (0 rows)")
                    continue

                # Fetch and insert in batches
                master_cursor.execute(f"SELECT {', '.join(col_names)} FROM {table_name}")

                placeholders = ', '.join(['%s'] * len(col_names))
                insert_sql = f"INSERT INTO {table_name} ({', '.join(col_names)}) VALUES ({placeholders})"

                batch_size = 1000
                rows_inserted = 0

                while True:
                    rows = master_cursor.fetchmany(batch_size)
                    if not rows:
                        break

                    for row in rows:
                        seat_cursor.execute(insert_sql, row)
                        rows_inserted += 1

                    seat_conn.commit()

                logger.info(f"  ✓ Copied {rows_inserted:,} rows from {table_name}")

            except Exception as e:
                logger.error(f"  ✗ Error copying {table_name}: {e}")
                seat_conn.rollback()
                raise

            print()

        print("="*100)
        print("✅ TABLE COPY COMPLETE")
        print("="*100)
        print()
        print("📊 Verification:")

        # Verify tables exist and count rows
        seat_cursor.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('state_college_link', 'colleges', 'state_course_college_link')
            ORDER BY table_name
        """)

        for row in seat_cursor.fetchall():
            table_name = row[0]
            seat_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = seat_cursor.fetchone()[0]
            logger.info(f"  ✓ {table_name}: {count:,} rows in seat_data")

        print()
        print("🎯 NEXT STEP:")
        print("  Run: python3 cascading_hierarchical_ensemble_matcher_pg.py")
        print("  Expected accuracy: 95%+ (was 69.5%)")
        print()

    finally:
        seat_cursor.close()
        master_cursor.close()
        seat_conn.close()
        master_conn.close()


if __name__ == "__main__":
    copy_tables()
