#!/usr/bin/env python3
"""
Database Triggers Utility

Manages SQLite triggers for automatic synchronization FROM
master_*_id TO *_id columns in seat_data table.

DIRECTION: master_*_id → *_id (master is source of truth)
- master_college_id → college_id
- master_state_id → state_id  
- master_course_id → course_id

The master_*_id columns are set by the matching pipeline and are authoritative.
The *_id columns are kept in sync for compatibility with legacy code.

Usage:
    from db_triggers import ensure_triggers
    ensure_triggers(db_path)
"""

import sqlite3
import logging

logger = logging.getLogger(__name__)


def ensure_id_sync_triggers(db_path: str, table_name: str = 'seat_data') -> dict:
    """
    Create triggers for automatic sync FROM master_*_id TO *_id columns.
    
    Direction: master_*_id → *_id (master is source of truth)
    - When master_*_id is updated → *_id is synced
    - On INSERT → sync master values to legacy columns
    
    Args:
        db_path: Path to SQLite database
        table_name: Name of table to add triggers to (default: seat_data)
        
    Returns:
        dict with trigger creation stats
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get column names for this table
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = {row[1] for row in cursor.fetchall()}
    
    # Column pairs to sync (master → base)
    id_pairs = [
        ('master_college_id', 'college_id'),
        ('master_state_id', 'state_id'),
        ('master_course_id', 'course_id'),
    ]
    
    # Filter to only pairs where both columns exist
    valid_pairs = [(m, b) for m, b in id_pairs if m in columns and b in columns]
    
    if not valid_pairs:
        logger.info(f"No legacy *_id columns found in {table_name} - skipping trigger creation")
        conn.close()
        return {'created': 0, 'skipped': 0, 'reason': 'no_legacy_columns'}
    
    created = 0
    skipped = 0
    
    for master_id, base_id in valid_pairs:
        # Trigger: Sync master_id → base_id on UPDATE of master
        trigger_name = f"sync_{master_id}_to_{base_id}"
        try:
            cursor.execute(f"""
                CREATE TRIGGER IF NOT EXISTS {trigger_name}
                AFTER UPDATE OF {master_id} ON {table_name}
                FOR EACH ROW
                WHEN NEW.{master_id} IS NOT NULL 
                  AND NEW.{master_id} != '' 
                  AND (NEW.{base_id} IS NULL OR NEW.{base_id} = '' OR NEW.{base_id} != NEW.{master_id})
                BEGIN
                  UPDATE {table_name} 
                  SET {base_id} = NEW.{master_id} 
                  WHERE id = NEW.id;
                END
            """)
            created += 1
        except sqlite3.OperationalError as e:
            if "already exists" in str(e):
                skipped += 1
            else:
                logger.warning(f"Failed to create trigger {trigger_name}: {e}")
    
    # Trigger: Sync on INSERT (only for columns that exist)
    if valid_pairs:
        trigger_name = f"sync_master_ids_on_insert_{table_name}"
        
        # Build dynamic WHEN clause
        when_clauses = []
        set_clauses = []
        for master_id, base_id in valid_pairs:
            when_clauses.append(f"(NEW.{master_id} IS NOT NULL AND NEW.{master_id} != '' AND (NEW.{base_id} IS NULL OR NEW.{base_id} = ''))")
            set_clauses.append(f"{base_id} = COALESCE(NULLIF({base_id}, ''), {master_id})")
        
        try:
            cursor.execute(f"""
                CREATE TRIGGER IF NOT EXISTS {trigger_name}
                AFTER INSERT ON {table_name}
                FOR EACH ROW
                WHEN ({' OR '.join(when_clauses)})
                BEGIN
                  UPDATE {table_name} 
                  SET {', '.join(set_clauses)}
                  WHERE id = NEW.id;
                END
            """)
            created += 1
        except sqlite3.OperationalError as e:
            if "already exists" in str(e):
                skipped += 1
            else:
                logger.warning(f"Failed to create trigger {trigger_name}: {e}")
    
    conn.commit()
    conn.close()
    
    return {'created': created, 'skipped': skipped}


def sync_existing_ids(db_path: str, table_name: str = 'seat_data') -> dict:
    """
    One-time sync of existing data FROM master_*_id TO *_id columns.
    
    Direction: master_*_id → *_id (master is source of truth)
    
    Args:
        db_path: Path to SQLite database
        table_name: Name of table to sync
        
    Returns:
        dict with sync stats
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get column names for this table
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = {row[1] for row in cursor.fetchall()}
    
    stats = {}
    
    # Column pairs to sync (master → base)
    id_pairs = [
        ('master_college_id', 'college_id'),
        ('master_state_id', 'state_id'),
        ('master_course_id', 'course_id'),
    ]
    
    for master_id, base_id in id_pairs:
        # Skip if either column doesn't exist in this table
        if master_id not in columns or base_id not in columns:
            logger.debug(f"Skipping {master_id} → {base_id} sync: columns not in {table_name}")
            continue
            
        # Sync master_id → base_id where base is empty or different
        cursor.execute(f"""
            UPDATE {table_name}
            SET {base_id} = {master_id}
            WHERE {master_id} IS NOT NULL AND {master_id} != ''
            AND ({base_id} IS NULL OR {base_id} = '' OR {base_id} != {master_id})
        """)
        synced = cursor.rowcount
        stats[f'{master_id}_to_{base_id}'] = synced
    
    conn.commit()
    conn.close()
    
    return stats


def ensure_triggers(db_path: str, table_name: str = 'seat_data') -> dict:
    """
    Main entry point: Ensure all database triggers exist and data is synced.
    
    This is safe to call multiple times (idempotent).
    
    Args:
        db_path: Path to SQLite database
        table_name: Name of table to manage triggers for
        
    Returns:
        dict with combined stats from sync and trigger creation
    """
    logger.info(f"Ensuring ID sync triggers for {table_name}...")
    
    # First: Sync existing data (master → base)
    sync_stats = sync_existing_ids(db_path, table_name)
    
    total_synced = sum(sync_stats.values())
    if total_synced > 0:
        logger.info(f"  ✅ Synced {total_synced} existing records (master_*_id → *_id)")
        for key, count in sync_stats.items():
            if count > 0:
                logger.info(f"     - {key}: {count}")
    
    # Second: Create triggers
    trigger_stats = ensure_id_sync_triggers(db_path, table_name)
    
    if trigger_stats['created'] > 0:
        logger.info(f"  ✅ Created {trigger_stats['created']} triggers")
    
    return {
        'sync': sync_stats,
        'triggers': trigger_stats
    }


def list_triggers(db_path: str) -> list:
    """List all triggers in the database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='trigger'")
    triggers = cursor.fetchall()
    conn.close()
    return triggers


def drop_id_sync_triggers(db_path: str, table_name: str = 'seat_data'):
    """Drop all ID sync triggers (for cleanup/reset)."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    trigger_names = [
        'sync_master_college_id_to_college_id',
        'sync_master_state_id_to_state_id',
        'sync_master_course_id_to_course_id',
        'sync_master_ids_on_insert',
        # Old trigger names (cleanup)
        'sync_college_id_to_master',
        'sync_master_college_id_to_base',
        'sync_state_id_to_master',
        'sync_master_state_id_to_base',
        'sync_course_id_to_master',
        'sync_master_course_id_to_base',
        'sync_ids_on_insert',
    ]
    
    for name in trigger_names:
        cursor.execute(f"DROP TRIGGER IF EXISTS {name}")
    
    conn.commit()
    conn.close()
    logger.info(f"Dropped all ID sync triggers from {table_name}")


if __name__ == "__main__":
    import sys
    
    # Default path
    db_path = 'data/sqlite/seat_data.db'
    
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    print(f"\n📊 Ensuring ID sync triggers for: {db_path}")
    print("=" * 60)
    print("Direction: master_*_id → *_id (master is source of truth)")
    print("=" * 60)
    
    # First drop old triggers
    drop_id_sync_triggers(db_path)
    
    stats = ensure_triggers(db_path)
    
    print(f"\n✅ Complete!")
    print(f"   Synced records: {sum(stats['sync'].values())}")
    print(f"   Triggers created: {stats['triggers']['created']}")
    
    print(f"\n📋 Active triggers:")
    for name, sql in list_triggers(db_path):
        print(f"   - {name}")
