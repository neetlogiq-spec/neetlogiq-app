#!/usr/bin/env python3
"""
Cache Utility Functions

Provides functions for cache management, especially invalidation when master data changes.
This prevents false matches caused by stale cached college IDs after master data rebuild.
"""

import os
import shutil
import hashlib
import json
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Cache directories and files
# NOTE: Vector search cache is EXCLUDED - it's managed by vector_index.py singleton
# and shared across all modes (counselling, match & link, validation)
CACHE_LOCATIONS = {
    # 'vector_search': 'models/vector_search',  # EXCLUDED - shared singleton
    'embeddings': 'data/embeddings',
    'mmap_cache': 'data/mmap_cache',  # Memory-mapped master data cache
}

# Cache files to clear when master data changes
# NOTE: Vector index (faiss_flat.index, metadata_flat.pkl) is EXCLUDED
#       because it only contains name embeddings, not college IDs
CACHE_FILES = [
    # 'models/vector_search/faiss_flat.index',  # EXCLUDED - shared singleton
    # 'models/vector_search/metadata_flat.pkl',  # EXCLUDED - shared singleton
    '.llm_normalize_cache.json',  # LLM normalization cache
    'data/college_metadata_faiss.pkl',  # FAISS metadata with college IDs
    'data/college_index.faiss',  # FAISS index with 5034 vectors (Phase 16)
    'data/embeddings/college_embeddings.json',  # 886 cached college embeddings
]

# CRITICAL: SQLite caches that store college IDs (must clear on master rebuild!)
LLM_CACHE_DBS = [
    'data/sqlite/llm_cache.db',  # Agentic matcher cache - stores matched_college_id!
]

# Tables with cached college IDs that need clearing (in seat_data.db and counselling_data.db)
QUEUE_TABLES = [
    ('data/sqlite/seat_data.db', 'group_matching_queue', 'matched_college_id'),
    ('data/sqlite/counselling_data_partitioned.db', 'group_matching_queue', 'matched_college_id'),
]

# Master data version tracking file
MASTER_VERSION_FILE = 'data/sqlite/.master_data_version'


def get_master_data_hash(master_db_path: str = 'data/sqlite/master_data.db') -> str:
    """
    Calculate hash of master_data.db to detect ACTUAL DATA changes.
    
    Uses row counts from core tables (not derived tables) to avoid false triggers
    from FTS rebuilds or embedding cache clears which don't change actual data.
    """
    try:
        path = Path(master_db_path)
        if not path.exists():
            return "missing"
        
        import sqlite3
        conn = sqlite3.connect(master_db_path)
        cursor = conn.cursor()
        
        # Core tables that define "master data" - changes here should trigger cache clear
        # Excludes: master_embeddings, FTS tables (derived/cached data)
        core_tables = ['medical_colleges', 'dental_colleges', 'dnb_colleges', 
                       'courses', 'states', 'quotas', 'categories']
        
        hash_parts = []
        for table in core_tables:
            try:
                # Get row count and max id (detects inserts/deletes)
                cursor.execute(f"SELECT COUNT(*), MAX(ROWID) FROM {table}")
                count, max_id = cursor.fetchone()
                hash_parts.append(f"{table}:{count}:{max_id or 0}")
            except Exception:
                # Table might not exist
                hash_parts.append(f"{table}:0:0")
        
        conn.close()
        
        # Create hash from core table stats
        hash_input = "|".join(hash_parts)
        return hashlib.md5(hash_input.encode()).hexdigest()[:16]
        
    except Exception as e:
        logger.error(f"Error getting master data hash: {e}")
        return "error"


def get_stored_master_version() -> Optional[str]:
    """Get the stored master data version."""
    try:
        if Path(MASTER_VERSION_FILE).exists():
            with open(MASTER_VERSION_FILE, 'r') as f:
                data = json.load(f)
                return data.get('hash')
    except Exception as e:
        logger.warning(f"Error reading master version: {e}")
    return None


def store_master_version(hash_value: str):
    """Store the current master data version."""
    try:
        Path(MASTER_VERSION_FILE).parent.mkdir(parents=True, exist_ok=True)
        with open(MASTER_VERSION_FILE, 'w') as f:
            json.dump({
                'hash': hash_value,
                'updated_at': datetime.now().isoformat(),
            }, f)
    except Exception as e:
        logger.error(f"Error storing master version: {e}")


def clear_matching_caches(base_path: str = '.'):
    """
    Clear all matching-related caches.
    Call this when master data is rebuilt/reimported.
    """
    import sqlite3
    base = Path(base_path)
    cleared = []
    
    # Clear cache files
    for cache_file in CACHE_FILES:
        file_path = base / cache_file
        if file_path.exists():
            try:
                os.remove(file_path)
                cleared.append(str(file_path))
                logger.info(f"Cleared cache: {file_path}")
            except Exception as e:
                logger.error(f"Failed to clear {file_path}: {e}")
    
    # Clear cache directories (only the contents, not the directory)
    for cache_name, cache_dir in CACHE_LOCATIONS.items():
        dir_path = base / cache_dir
        if dir_path.exists() and dir_path.is_dir():
            for item in dir_path.iterdir():
                if item.is_file() and item.suffix in ['.index', '.pkl', '.npy', '.json']:
                    try:
                        os.remove(item)
                        cleared.append(str(item))
                        logger.info(f"Cleared cache file: {item}")
                    except Exception as e:
                        logger.error(f"Failed to clear {item}: {e}")
    
    # CRITICAL: Invalidate SQLite caches that store college IDs
    # Strategy: Set verified=0 so cached matches go through Guardian again
    # Also clear entries entirely to ensure fresh lookups
    for db_file in LLM_CACHE_DBS:
        db_path = base / db_file
        if db_path.exists():
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                
                # First: Reset verified flag so Guardian re-validates all matches
                cursor.execute("UPDATE llm_cache SET verified = 0")
                unverified_count = cursor.rowcount
                
                # Second: Clear the entire cache to force fresh LLM lookups
                # (IDs have shifted, cached IDs are completely wrong)
                cursor.execute("DELETE FROM llm_cache")
                deleted_count = cursor.rowcount
                
                conn.commit()
                conn.execute("VACUUM")
                conn.close()
                cleared.append(f"{db_path} (unverified: {unverified_count}, deleted: {deleted_count})")
                logger.info(f"Invalidated LLM cache: {db_path} (set verified=0: {unverified_count}, deleted: {deleted_count})")
            except Exception as e:
                logger.error(f"Failed to clear {db_path}: {e}")
    
    # CRITICAL: Clear group_matching_queue tables (they cache matched_college_id!)
    for db_file, table_name, id_column in QUEUE_TABLES:
        db_path = base / db_file
        if db_path.exists():
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                # Reset the cached college IDs - force re-matching
                cursor.execute(f"UPDATE {table_name} SET {id_column} = NULL, is_processed = 0")
                count = cursor.rowcount
                conn.commit()
                conn.close()
                cleared.append(f"{db_path}:{table_name} ({count} rows reset)")
                logger.info(f"Reset queue cache: {db_path}:{table_name} ({count} rows)")
            except Exception as e:
                logger.warning(f"Could not clear {db_path}:{table_name}: {e}")
    
    # CRITICAL: Rebuild FTS5 indexes in master_data.db
    # Stale FTS indexes cause cross-state matches (FTS query returns wrong colleges!)
    rebuild_fts_indexes(base_path)
    
    return cleared


def rebuild_fts_indexes(base_path: str = '.', master_db: str = 'data/sqlite/master_data.db'):
    """
    Rebuild FTS5 (Full Text Search) indexes in master_data.db.
    
    CRITICAL: FTS tables are separate from base tables - must rebuild after master import!
    Otherwise: FTS query returns STALE data causing cross-state false matches.
    """
    fts_tables = [
        'medical_colleges_fts',
        'dental_colleges_fts', 
        'dnb_colleges_fts',
    ]
    
    db_path = Path(base_path) / master_db
    if not db_path.exists():
        logger.warning(f"Master database not found: {db_path}")
        return
    
    try:
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        for fts_table in fts_tables:
            try:
                # FTS5 content-linked tables: rebuild by special INSERT command
                cursor.execute(f"INSERT INTO {fts_table}({fts_table}) VALUES('rebuild')")
                logger.info(f"Rebuilt FTS5 index: {fts_table}")
            except Exception as e:
                # Table might not exist - not critical
                logger.debug(f"FTS rebuild skipped for {fts_table}: {e}")
        
        conn.commit()
        conn.close()
        logger.info(f"FTS5 indexes rebuilt successfully in {db_path}")
        print(f"✅ Rebuilt FTS5 indexes (medical, dental, dnb)")
        
        # Also clear derived tables that need regeneration
        # state_college_link: Links colleges to states - user must rebuild via menu option 7
        # master_embeddings: Embeddings for colleges - stale after import
        clear_derived_tables(base_path, master_db)
        
    except Exception as e:
        logger.error(f"FTS rebuild failed: {e}")


def clear_derived_tables(base_path: str = '.', master_db: str = 'data/sqlite/master_data.db'):
    """
    Clear derived/cached tables in master_data.db that become stale after import.
    
    Tables cleared:
    - master_embeddings: Cached college embeddings (need regeneration)
    - state_college_link: NOT cleared (user must rebuild via Option 7)
    """
    import sqlite3
    
    db_path = Path(base_path) / master_db
    if not db_path.exists():
        return
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Clear master_embeddings (embeddings for search - regenerated on first use)
        try:
            cursor.execute("DELETE FROM master_embeddings")
            count = cursor.rowcount
            if count > 0:
                logger.info(f"Cleared master_embeddings: {count} rows")
                print(f"✅ Cleared master_embeddings ({count} cached embeddings)")
        except Exception as e:
            logger.debug(f"master_embeddings clear skipped: {e}")
        
        # NOTE: state_college_link is managed by Menu Option 7
        # No warning needed - cache_utils is called AFTER rebuild, not before
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.warning(f"Derived table clear failed: {e}")


def check_and_invalidate_cache(master_db_path: str = 'data/sqlite/master_data.db', 
                                base_path: str = '.') -> bool:
    """
    Check if master data has changed and invalidate caches if needed.
    
    Returns:
        True if caches were invalidated, False otherwise
    """
    current_hash = get_master_data_hash(master_db_path)
    stored_hash = get_stored_master_version()
    
    if stored_hash is None:
        # First run - store version but don't clear (no previous cache to worry about)
        logger.info("First run - storing master data version")
        store_master_version(current_hash)
        return False
    
    if current_hash != stored_hash:
        logger.warning(f"Master data changed! Old: {stored_hash}, New: {current_hash}")
        logger.warning("Clearing stale caches...")
        
        cleared = clear_matching_caches(base_path)
        store_master_version(current_hash)
        
        if cleared:
            logger.warning(f"Cleared {len(cleared)} cache files: {cleared}")
            print(f"\n⚠️  Master data changed! Cleared {len(cleared)} stale cache files.")
            print("   Re-run matching to use updated master data.\n")
        
        return True
    
    logger.debug(f"Master data unchanged (hash: {current_hash})")
    return False


if __name__ == "__main__":
    # CLI for manual cache management
    import argparse
    
    parser = argparse.ArgumentParser(description="Cache management utility")
    parser.add_argument('--clear', action='store_true', help="Force clear all caches")
    parser.add_argument('--check', action='store_true', help="Check if master data changed")
    parser.add_argument('--status', action='store_true', help="Show cache status")
    
    args = parser.parse_args()
    
    logging.basicConfig(level=logging.INFO)
    
    if args.clear:
        print("Clearing all matching caches...")
        cleared = clear_matching_caches()
        print(f"Cleared {len(cleared)} files: {cleared}")
        
    elif args.check:
        changed = check_and_invalidate_cache()
        if changed:
            print("Caches were invalidated due to master data change")
        else:
            print("Master data unchanged, caches are valid")
            
    elif args.status:
        current = get_master_data_hash()
        stored = get_stored_master_version()
        print(f"Current master hash: {current}")
        print(f"Stored master hash:  {stored}")
        print(f"Match: {current == stored}")
        
        # List existing caches
        print("\nExisting cache files:")
        for cf in CACHE_FILES:
            if Path(cf).exists():
                print(f"  ✓ {cf}")
            else:
                print(f"  ✗ {cf} (missing)")
    else:
        parser.print_help()
