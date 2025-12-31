#!/usr/bin/env python3
"""
Sync SQLite Master Data to Supabase

This script syncs data from local SQLite databases to Supabase.
SQLite is the source of truth for master data tables.

Usage:
    python sync_sqlite_to_supabase.py [--tables TABLE1,TABLE2] [--dry-run]
"""

import os
import sqlite3
import json
import argparse
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Try to import supabase client
try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    print("Warning: supabase-py not installed. Install with: pip install supabase")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
SQLITE_MASTER_DB = "data/sqlite/master_data.db"
SQLITE_SEAT_DB = "data/sqlite/seat_data.db"
SQLITE_COUNSELLING_DB = "data/sqlite/counselling_data_partitioned.db"

# Table configurations: SQLite table -> Supabase table
TABLE_CONFIG = {
    "medical_colleges": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "state", "address", "college_type", 
                   "normalized_name", "normalized_state", "normalized_address",
                   "composite_college_key"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "dental_colleges": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "state", "address", "college_type",
                   "normalized_name", "normalized_state", "normalized_address",
                   "composite_college_key"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "dnb_colleges": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "state", "address", "college_type",
                   "normalized_name", "normalized_state", "normalized_address",
                   "composite_college_key"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "courses": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "normalized_name"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "states": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "normalized_name", "created_at", "updated_at"],
        "primary_key": "id",
        "type_conversions": {
            "created_at": "timestamp",
            "updated_at": "timestamp"
        }
    },
    "categories": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "normalized_name", "created_at", "updated_at"],
        "primary_key": "id",
        "type_conversions": {
            "created_at": "timestamp",
            "updated_at": "timestamp"
        }
    },
    "quotas": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "name", "normalized_name", "created_at", "updated_at"],
        "primary_key": "id",
        "type_conversions": {
            "created_at": "timestamp",
            "updated_at": "timestamp"
        }
    },
    "state_college_link": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["college_id", "state_id", "address", "college_name", "composite_college_key"],
        "primary_key": ["college_id", "state_id"],
        "type_conversions": {}
    },
    "state_course_college_link": {
        "source_db": SQLITE_SEAT_DB,
        "source_table": "state_course_college_link_text",
        "columns": ["state_id", "normalized_state", "course_id", "college_id", 
                   "seat_address_normalized", "occurrences", "last_seen_ts"],
        "primary_key": ["state_id", "course_id", "college_id"],
        "type_conversions": {}
    },
    "state_aliases": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "original_name", "alias_name", "state_id", "created_at"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "college_aliases": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "original_name", "alias_name", "master_college_id",
                   "state_normalized", "address_normalized", "confidence", "created_at"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "course_aliases": {
        "source_db": SQLITE_MASTER_DB,
        "columns": ["id", "original_name", "alias_name", "course_id", "confidence", "created_at"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "seat_data": {
        "source_db": SQLITE_SEAT_DB,
        "columns": ["id", "college_name", "course_name", "seats", "state", "address",
                   "management", "university_affiliation", "normalized_college_name",
                   "normalized_course_name", "normalized_state", "normalized_address",
                   "course_type", "source_file", "created_at", "updated_at",
                   "master_college_id", "master_course_id", "master_state_id",
                   "college_match_score", "course_match_score", "college_match_method",
                   "course_match_method", "is_linked", "state_id", "college_id", "course_id"],
        "primary_key": "id",
        "type_conversions": {}
    },
    "college_course_link": {
        "source_db": SQLITE_SEAT_DB,
        "columns": ["college_id", "course_id", "stream", "occurrences", "last_seen_ts"],
        "primary_key": ["college_id", "course_id"],
        "type_conversions": {}
    },
    "counselling_records": {
        "source_db": SQLITE_COUNSELLING_DB,
        "columns": ["id", "all_india_rank", "quota", "college_name", "address",
                   "normalized_address", "state", "course_name", "category", "round_raw",
                   "year", "normalized_college_name", "normalized_state", "normalized_course_name",
                   "course_type", "source_normalized", "level_normalized", "round_normalized",
                   "master_college_id", "master_course_id", "master_state_id", "master_quota_id",
                   "master_category_id", "master_source_id", "master_level_id",
                   "college_match_score", "college_match_method", "course_match_score",
                   "course_match_method", "is_matched", "needs_manual_review", "partition_key",
                   "created_at", "updated_at"],
        "primary_key": "id",
        "type_conversions": {}
    }
}


def get_supabase_client() -> Optional[Client]:
    """Initialize Supabase client from environment variables."""
    if not HAS_SUPABASE:
        return None
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        return None
    
    return create_client(url, key)


def convert_value(value: Any, conversion_type: str) -> Any:
    """Convert value based on type specification."""
    if value is None:
        return None
    
    if conversion_type == "boolean":
        # SQLite INTEGER (0/1) to boolean
        return bool(value)
    elif conversion_type == "timestamp":
        # TEXT timestamp to proper format
        if isinstance(value, str) and value:
            try:
                # Try parsing ISO format
                return value
            except:
                return None
        return value
    
    return value


def read_sqlite_table(db_path: str, table_name: str, columns: List[str]) -> List[Dict]:
    """Read data from SQLite table."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check which columns exist
    cursor.execute(f"PRAGMA table_info({table_name})")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    # Filter to only existing columns
    valid_columns = [c for c in columns if c in existing_columns]
    
    if not valid_columns:
        logger.warning(f"No valid columns found for {table_name}")
        return []
    
    query = f"SELECT {', '.join(valid_columns)} FROM {table_name}"
    cursor.execute(query)
    
    rows = []
    for row in cursor.fetchall():
        row_dict = {}
        for col in valid_columns:
            value = row[col]
            # Handle bytes (BLOB) columns - convert to string or None
            if isinstance(value, bytes):
                try:
                    value = value.decode('utf-8')
                except:
                    value = None  # Skip binary data that can't be decoded
            row_dict[col] = value
        rows.append(row_dict)
    
    conn.close()
    return rows


def apply_type_conversions(row: Dict, type_conversions: Dict[str, str]) -> Dict:
    """Apply type conversions to row data."""
    converted = {}
    for key, value in row.items():
        if key in type_conversions:
            converted[key] = convert_value(value, type_conversions[key])
        else:
            converted[key] = value
    return converted


def generate_seat_id(row: Dict) -> str:
    """Generate a unique ID for seat_data using state + college_name + address + course_name.
    
    This ensures records for the same course at different college locations
    (e.g., same college name in different cities) get unique IDs.
    """
    # Combine unique fields
    state = row.get('state', '') or ''
    college_name = row.get('college_name', '') or ''
    address = row.get('address', '') or ''
    course_name = row.get('course_name', '') or ''
    
    unique_str = f"{state}|{college_name}|{address}|{course_name}"
    
    # Create short hash (8 chars for readability)
    hash_suffix = hashlib.md5(unique_str.encode()).hexdigest()[:8]
    
    # State prefix (first 2 chars of normalized state)
    normalized_state = row.get('normalized_state', '') or state
    state_prefix = normalized_state[:2].upper() if normalized_state else 'XX'
    
    return f"{state_prefix}_{hash_suffix}"


def sync_table_to_supabase(
    supabase: Client,
    table_name: str,
    config: Dict,
    dry_run: bool = False,
    batch_size: int = 500
) -> Dict[str, int]:
    """Sync a single table from SQLite to Supabase."""
    stats = {"inserted": 0, "updated": 0, "errors": 0}
    
    # Read from SQLite (use source_table if specified, otherwise use table_name)
    source_table = config.get("source_table", table_name)
    logger.info(f"Reading {source_table} from SQLite...")
    rows = read_sqlite_table(config["source_db"], source_table, config["columns"])

    
    if not rows:
        logger.warning(f"No data found in {table_name}")
        return stats
    
    logger.info(f"Found {len(rows)} rows in {table_name}")
    
    # Apply type conversions
    converted_rows = [apply_type_conversions(row, config.get("type_conversions", {})) for row in rows]
    
    # Special handling for seat_data: regenerate unique IDs to fix duplicates
    if table_name == "seat_data":
        logger.info("Regenerating unique IDs for seat_data...")
        for row in converted_rows:
            row['id'] = generate_seat_id(row)
        
        # Deduplicate by keeping last occurrence per ID
        seen = {}
        for row in converted_rows:
            seen[row['id']] = row
        converted_rows = list(seen.values())
        logger.info(f"After deduplication: {len(converted_rows)} unique rows")
    
    if dry_run:
        logger.info(f"[DRY RUN] Would upsert {len(converted_rows)} rows to {table_name}")
        return {"would_upsert": len(converted_rows)}
    
    # Upsert in batches
    for i in range(0, len(converted_rows), batch_size):
        batch = converted_rows[i:i + batch_size]
        try:
            # Use upsert to handle both inserts and updates
            primary_key = config["primary_key"]
            if isinstance(primary_key, list):
                pk_str = ",".join(primary_key)
            else:
                pk_str = primary_key
            
            result = supabase.table(table_name).upsert(
                batch,
                on_conflict=pk_str
            ).execute()
            
            stats["inserted"] += len(batch)
            logger.info(f"Upserted batch {i//batch_size + 1}: {len(batch)} rows")
            
        except Exception as e:
            logger.error(f"Error upserting batch to {table_name}: {e}")
            stats["errors"] += len(batch)
    
    return stats


def refresh_consolidated_colleges(supabase: Client) -> bool:
    """Refresh the consolidated colleges table from source tables."""
    logger.info("Refreshing consolidated colleges table...")
    try:
        # We run these as separate statements to be safe
        statements = [
            """
            INSERT INTO colleges (
                id, name, state, address, college_type, 
                normalized_name, normalized_state, normalized_address, 
                composite_college_key, tfidf_vector, source_table
            )
            SELECT 
                id, name, state, address, college_type, 
                normalized_name, normalized_state, normalized_address, 
                composite_college_key, tfidf_vector, 'medical'
            FROM medical_colleges
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                state = EXCLUDED.state,
                address = EXCLUDED.address,
                college_type = EXCLUDED.college_type,
                normalized_name = EXCLUDED.normalized_name,
                normalized_state = EXCLUDED.normalized_state,
                normalized_address = EXCLUDED.normalized_address,
                composite_college_key = EXCLUDED.composite_college_key,
                tfidf_vector = EXCLUDED.tfidf_vector,
                source_table = EXCLUDED.source_table;
            """,
            """
            INSERT INTO colleges (
                id, name, state, address, college_type, 
                normalized_name, normalized_state, normalized_address, 
                composite_college_key, tfidf_vector, source_table
            )
            SELECT 
                id, name, state, address, college_type, 
                normalized_name, normalized_state, normalized_address, 
                composite_college_key, tfidf_vector, 'dental'
            FROM dental_colleges
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                state = EXCLUDED.state,
                address = EXCLUDED.address,
                college_type = EXCLUDED.college_type,
                normalized_name = EXCLUDED.normalized_name,
                normalized_state = EXCLUDED.normalized_state,
                normalized_address = EXCLUDED.normalized_address,
                composite_college_key = EXCLUDED.composite_college_key,
                tfidf_vector = EXCLUDED.tfidf_vector,
                source_table = EXCLUDED.source_table;
            """,
            """
            INSERT INTO colleges (
                id, name, state, address, college_type, 
                normalized_name, normalized_state, normalized_address, 
                composite_college_key, tfidf_vector, source_table
            )
            SELECT 
                id, name, state, address, college_type, 
                normalized_name, normalized_state, normalized_address, 
                composite_college_key, tfidf_vector, 'dnb'
            FROM dnb_colleges
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                state = EXCLUDED.state,
                address = EXCLUDED.address,
                college_type = EXCLUDED.college_type,
                normalized_name = EXCLUDED.normalized_name,
                normalized_state = EXCLUDED.normalized_state,
                normalized_address = EXCLUDED.normalized_address,
                composite_college_key = EXCLUDED.composite_college_key,
                tfidf_vector = EXCLUDED.tfidf_vector,
                source_table = EXCLUDED.source_table;
            """
        ]
        
        for stmt in statements:
            supabase.rpc('execute_sql', {'query': stmt.strip()}).execute()
        
        logger.info("Successfully refreshed consolidated colleges table.")
        return True
    except Exception as e:
        logger.error(f"Error refreshing colleges table: {e}")
        return False


def sync_all_tables(supabase: Client, tables: Optional[List[str]] = None, dry_run: bool = False):
    """Sync all configured tables or specified subset."""
    target_tables = tables if tables else list(TABLE_CONFIG.keys())
    
    all_stats = {}
    for table_name in target_tables:
        if table_name not in TABLE_CONFIG:
            logger.warning(f"Unknown table: {table_name}")
            continue
        
        logger.info(f"\n{'='*50}")
        logger.info(f"Syncing {table_name}...")
        logger.info(f"{'='*50}")
        
        stats = sync_table_to_supabase(
            supabase,
            table_name,
            TABLE_CONFIG[table_name],
            dry_run=dry_run
        )
        all_stats[table_name] = stats
    
    return all_stats


def get_row_counts(supabase: Client) -> Dict[str, int]:
    """Get current row counts from Supabase tables."""
    counts = {}
    for table_name in TABLE_CONFIG.keys():
        try:
            result = supabase.table(table_name).select("*", count="exact").limit(0).execute()
            counts[table_name] = result.count if hasattr(result, 'count') else 0
        except Exception as e:
            counts[table_name] = f"Error: {e}"
    return counts


def main():
    parser = argparse.ArgumentParser(description="Sync SQLite data to Supabase")
    parser.add_argument("--tables", type=str, help="Comma-separated list of tables to sync")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--count", action="store_true", help="Show current row counts")
    args = parser.parse_args()
    
    # Initialize Supabase client
    supabase = get_supabase_client()
    
    if not supabase:
        logger.error("Failed to initialize Supabase client")
        logger.info("Set environment variables:")
        logger.info("  export SUPABASE_URL='https://your-project.supabase.co'")
        logger.info("  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
        return
    
    # Show counts if requested
    if args.count:
        counts = get_row_counts(supabase)
        print("\nCurrent Supabase row counts:")
        print("-" * 40)
        for table, count in counts.items():
            print(f"  {table}: {count}")
        return
    
    # Parse table list
    tables = args.tables.split(",") if args.tables else None
    
    # Run sync
    logger.info("Starting SQLite → Supabase sync...")
    if args.dry_run:
        logger.info("[DRY RUN MODE]")
    
    stats = sync_all_tables(supabase, tables, dry_run=args.dry_run)
    
    # Refresh consolidated colleges table if master tables were synced
    if not args.dry_run and (not tables or any(t in tables for t in ["medical_colleges", "dental_colleges", "dnb_colleges"])):
        refresh_consolidated_colleges(supabase)
    
    # Print summary
    print("\n" + "=" * 50)
    print("SYNC SUMMARY")
    print("=" * 50)
    for table, table_stats in stats.items():
        print(f"\n{table}:")
        for key, value in table_stats.items():
            print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
