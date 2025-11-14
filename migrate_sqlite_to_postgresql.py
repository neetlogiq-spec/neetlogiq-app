#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script
Migrates all SQLite databases to PostgreSQL with all tables, columns, and data.
"""

import sqlite3
import psycopg2
import psycopg2.extras
import yaml
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any
from tqdm import tqdm
import re

class SQLiteToPostgreSQLMigrator:
    def __init__(self, config_path: str = "config.yaml", postgresql_url: str = None):
        """Initialize the migrator with configuration."""
        self.config = self.load_config(config_path)
        self.sqlite_path = self.config.get('database', {}).get('sqlite_path', 'data/sqlite')
        self.postgresql_url = postgresql_url or self.config.get('database', {}).get('local_postgresql_url')
        
        if not self.postgresql_url:
            raise ValueError("PostgreSQL URL not found in config. Please provide postgresql_url parameter.")
        
        # Parse PostgreSQL connection string
        self.pg_conn_params = self.parse_postgresql_url(self.postgresql_url)
        
        # SQLite to PostgreSQL type mapping
        self.type_mapping = {
            'INTEGER': 'INTEGER',
            'TEXT': 'TEXT',
            'REAL': 'REAL',
            'BLOB': 'BYTEA',
            'NUMERIC': 'NUMERIC',
            'BOOLEAN': 'BOOLEAN',
            'DATE': 'DATE',
            'DATETIME': 'TIMESTAMP',
            'TIMESTAMP': 'TIMESTAMP',
        }
        
    def load_config(self, config_path: str) -> Dict:
        """Load configuration from YAML file."""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            print(f"Warning: Config file {config_path} not found. Using defaults.")
            return {}
    
    def parse_postgresql_url(self, url: str) -> Dict[str, str]:
        """Parse PostgreSQL connection URL into parameters."""
        # Format: postgresql://user:password@host:port/database
        # or: postgresql://user@host:port/database
        # Handle URL with optional password
        pattern = r'postgresql://(?:([^:@]+)(?::([^@]+))?@)?([^:/]+)(?::(\d+))?/(.+)'
        match = re.match(pattern, url)
        
        if not match:
            raise ValueError(f"Invalid PostgreSQL URL format: {url}")
        
        user, password, host, port, database = match.groups()
        
        params = {
            'host': host or 'localhost',
            'port': port or '5432',
            'database': database,
        }
        
        if user:
            params['user'] = user
        if password:
            params['password'] = password
        
        return params
    
    def get_base_postgresql_params(self) -> Dict[str, str]:
        """Get base PostgreSQL connection parameters (without database name)."""
        base_params = self.pg_conn_params.copy()
        # Remove database name to connect to default 'postgres' database for admin operations
        base_params['database'] = 'postgres'
        return base_params
    
    def create_postgresql_database(self, database_name: str) -> bool:
        """Create a PostgreSQL database if it doesn't exist."""
        base_params = self.get_base_postgresql_params()
        
        # Connect to 'postgres' database to create new database
        conn = psycopg2.connect(**base_params)
        conn.autocommit = True  # Required for CREATE DATABASE
        
        try:
            cursor = conn.cursor()
            # Check if database exists
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (database_name,)
            )
            exists = cursor.fetchone() is not None
            
            if not exists:
                # Create database
                cursor.execute(f'CREATE DATABASE "{database_name}"')
                print(f"Created PostgreSQL database: {database_name}")
                return True
            else:
                print(f"PostgreSQL database already exists: {database_name}")
                return True
        except Exception as e:
            print(f"Error creating database {database_name}: {e}")
            return False
        finally:
            conn.close()
    
    def get_sqlite_databases(self) -> List[str]:
        """Get all SQLite database files from the sqlite directory."""
        sqlite_dir = Path(self.sqlite_path)
        if not sqlite_dir.exists():
            raise FileNotFoundError(f"SQLite directory not found: {self.sqlite_path}")
        
        # Get all .db files (excluding .db-shm and .db-wal)
        db_files = [str(f) for f in sqlite_dir.glob("*.db") 
                   if not f.name.endswith('-shm') and not f.name.endswith('-wal')]
        
        return sorted(db_files)
    
    def get_table_schema(self, sqlite_conn: sqlite3.Connection, table_name: str) -> str:
        """Get the CREATE TABLE statement for a table."""
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'")
        result = cursor.fetchone()
        return result[0] if result else None
    
    def get_view_schema(self, sqlite_conn: sqlite3.Connection, view_name: str) -> str:
        """Get the CREATE VIEW statement for a view."""
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='view' AND name='{view_name}'")
        result = cursor.fetchone()
        return result[0] if result else None
    
    def get_indexes(self, sqlite_conn: sqlite3.Connection, table_name: str) -> List[Dict[str, str]]:
        """Get all indexes for a table."""
        cursor = sqlite_conn.cursor()
        cursor.execute(f"""
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='index' 
            AND tbl_name='{table_name}'
            AND sql IS NOT NULL
        """)
        indexes = []
        for row in cursor.fetchall():
            indexes.append({'name': row[0], 'sql': row[1]})
        return indexes
    
    def convert_sqlite_type_to_postgresql(self, sqlite_type: str) -> str:
        """Convert SQLite data type to PostgreSQL equivalent."""
        sqlite_type = sqlite_type.upper().strip()
        
        # Handle common SQLite types
        if 'INTEGER' in sqlite_type or 'INT' in sqlite_type:
            return 'INTEGER'
        elif 'TEXT' in sqlite_type:
            return 'TEXT'
        elif 'REAL' in sqlite_type or 'FLOAT' in sqlite_type or 'DOUBLE' in sqlite_type:
            return 'REAL'
        elif 'BLOB' in sqlite_type:
            return 'BYTEA'
        elif 'NUMERIC' in sqlite_type or 'DECIMAL' in sqlite_type:
            return 'NUMERIC'
        elif 'BOOLEAN' in sqlite_type or 'BOOL' in sqlite_type:
            return 'BOOLEAN'
        elif 'DATE' in sqlite_type:
            return 'DATE'
        elif 'DATETIME' in sqlite_type or 'TIMESTAMP' in sqlite_type:
            return 'TIMESTAMP'
        else:
            # Default to TEXT for unknown types
            return 'TEXT'
    
    def convert_sqlite_view_to_postgresql(self, sqlite_view: str, view_name: str) -> str:
        """Convert SQLite CREATE VIEW statement to PostgreSQL."""
        if not sqlite_view:
            return None
        
        if not sqlite_view.strip().upper().startswith('CREATE VIEW'):
            return None
        
        # PostgreSQL views are mostly compatible with SQLite views
        # Just need to ensure proper quoting
        pg_view = sqlite_view
        
        # Remove SQLite-specific comments
        pg_view = re.sub(r'/\*.*?\*/', '', pg_view, flags=re.DOTALL)
        
        # Ensure view name is properly quoted if needed
        if not view_name.startswith('"') and not view_name.startswith("'"):
            if re.search(r'[^a-zA-Z0-9_]', view_name):
                pg_view = re.sub(
                    r'\bCREATE\s+VIEW\s+' + re.escape(view_name) + r'\b',
                    f'CREATE VIEW "{view_name}"',
                    pg_view,
                    flags=re.IGNORECASE
                )
        
        return pg_view
    
    def convert_sqlite_schema_to_postgresql(self, sqlite_schema: str, table_name: str) -> str:
        """Convert SQLite CREATE TABLE statement to PostgreSQL."""
        if not sqlite_schema:
            return None
        
        # Skip views (handled separately)
        if sqlite_schema.strip().upper().startswith('CREATE VIEW'):
            return None
        
        # Remove SQLite-specific syntax
        pg_schema = sqlite_schema
        
        # Replace INTEGER PRIMARY KEY with SERIAL or keep as INTEGER PRIMARY KEY
        # PostgreSQL uses SERIAL for auto-increment, but we'll keep INTEGER PRIMARY KEY
        # and handle it during data migration
        
        # Convert data types
        # Match column definitions: column_name TYPE constraints
        def replace_type(match):
            col_def = match.group(0)
            # Extract type
            type_match = re.search(r'\b(\w+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)\s*)\b', col_def, re.IGNORECASE)
            if type_match:
                sqlite_type = type_match.group(1).strip()
                pg_type = self.convert_sqlite_type_to_postgresql(sqlite_type)
                # Replace the type in the column definition
                col_def = re.sub(r'\b' + re.escape(sqlite_type) + r'\b', pg_type, col_def, flags=re.IGNORECASE)
            return col_def
        
        # Handle column definitions more carefully
        # Split by commas, but be careful with parentheses
        lines = pg_schema.split('\n')
        result_lines = []
        in_parens = False
        parens_depth = 0
        
        for line in lines:
            # Track parentheses depth
            parens_depth += line.count('(') - line.count(')')
            
            # Convert types in column definitions
            if '(' in line or ')' in line or any(keyword in line.upper() for keyword in ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC']):
                # Replace SQLite types with PostgreSQL types
                line = re.sub(r'\bINTEGER\b', 'INTEGER', line, flags=re.IGNORECASE)
                line = re.sub(r'\bTEXT\b', 'TEXT', line, flags=re.IGNORECASE)
                line = re.sub(r'\bREAL\b', 'REAL', line, flags=re.IGNORECASE)
                line = re.sub(r'\bBLOB\b', 'BYTEA', line, flags=re.IGNORECASE)
                line = re.sub(r'\bNUMERIC\b', 'NUMERIC', line, flags=re.IGNORECASE)
            
            result_lines.append(line)
        
        pg_schema = '\n'.join(result_lines)
        
        # Remove SQLite-specific clauses
        pg_schema = re.sub(r'\bWITHOUT\s+ROWID\b', '', pg_schema, flags=re.IGNORECASE)
        
        # Ensure table name is properly quoted if needed
        if not table_name.startswith('"') and not table_name.startswith("'"):
            # Quote table name if it contains special characters
            if re.search(r'[^a-zA-Z0-9_]', table_name):
                pg_schema = re.sub(
                    r'\bCREATE\s+TABLE\s+' + re.escape(table_name) + r'\b',
                    f'CREATE TABLE "{table_name}"',
                    pg_schema,
                    flags=re.IGNORECASE
                )
        
        return pg_schema
    
    def get_table_columns(self, sqlite_conn: sqlite3.Connection, table_name: str) -> List[Tuple[str, str]]:
        """Get column names and types for a table."""
        cursor = sqlite_conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        # Return list of (name, type) tuples
        return [(col[1], col[2]) for col in columns]
    
    def get_table_row_count(self, sqlite_conn: sqlite3.Connection, table_name: str) -> int:
        """Get the number of rows in a table."""
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cursor.fetchone()[0]
    
    def migrate_table_schema(self, pg_conn, table_name: str, pg_schema: str) -> bool:
        """Create table in PostgreSQL from schema."""
        if not pg_schema:
            return False
        
        cursor = pg_conn.cursor()
        try:
            # Drop table if exists (optional - comment out if you want to preserve existing data)
            cursor.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
            
            # Create table
            cursor.execute(pg_schema)
            pg_conn.commit()
            return True
        except Exception as e:
            pg_conn.rollback()
            print(f"Error creating table {table_name}: {e}")
            print(f"Schema: {pg_schema}")
            return False
    
    def migrate_view(self, pg_conn, view_name: str, pg_view_schema: str) -> bool:
        """Create view in PostgreSQL from schema."""
        if not pg_view_schema:
            return False
        
        cursor = pg_conn.cursor()
        try:
            # Drop view if exists
            cursor.execute(f'DROP VIEW IF EXISTS "{view_name}" CASCADE')
            
            # Create view
            cursor.execute(pg_view_schema)
            pg_conn.commit()
            return True
        except Exception as e:
            pg_conn.rollback()
            print(f"Error creating view {view_name}: {e}")
            print(f"View schema: {pg_view_schema}")
            return False
    
    def migrate_indexes(self, pg_conn, table_name: str, indexes: List[Dict[str, str]]) -> int:
        """Migrate indexes for a table."""
        if not indexes:
            return 0
        
        cursor = pg_conn.cursor()
        migrated_count = 0
        
        for index in indexes:
            index_name = index['name']
            index_sql = index['sql']
            
            # Convert SQLite index to PostgreSQL
            # SQLite: CREATE INDEX name ON table(columns)
            # PostgreSQL: CREATE INDEX name ON table(columns)
            # Mostly compatible, but need to handle quoting
            
            try:
                # Drop index if exists
                cursor.execute(f'DROP INDEX IF EXISTS "{index_name}"')
                
                # Convert index SQL
                pg_index_sql = index_sql
                # Ensure table name is quoted if needed
                if f'"{table_name}"' not in pg_index_sql and f"'{table_name}'" not in pg_index_sql:
                    # Replace unquoted table name with quoted version
                    pg_index_sql = re.sub(
                        r'\bON\s+' + re.escape(table_name) + r'\b',
                        f'ON "{table_name}"',
                        pg_index_sql,
                        flags=re.IGNORECASE
                    )
                
                # Create index
                cursor.execute(pg_index_sql)
                pg_conn.commit()
                migrated_count += 1
            except Exception as e:
                pg_conn.rollback()
                print(f"  Warning: Could not migrate index {index_name}: {e}")
                # Continue with other indexes
        
        return migrated_count
    
    def migrate_table_data(self, sqlite_conn: sqlite3.Connection, pg_conn, 
                          table_name: str, batch_size: int = 1000) -> int:
        """Migrate data from SQLite table to PostgreSQL table."""
        sqlite_cursor = sqlite_conn.cursor()
        pg_cursor = pg_conn.cursor()
        
        # Get column names
        columns = self.get_table_columns(sqlite_conn, table_name)
        column_names = [col[0] for col in columns]
        
        if not column_names:
            return 0
        
        # Get row count for progress bar
        total_rows = self.get_table_row_count(sqlite_conn, table_name)
        
        if total_rows == 0:
            return 0
        
        # Build INSERT statement
        placeholders = ', '.join(['%s'] * len(column_names))
        columns_str = ', '.join([f'"{col}"' for col in column_names])
        insert_sql = f'INSERT INTO "{table_name}" ({columns_str}) VALUES ({placeholders})'
        
        # Fetch and insert data in batches
        sqlite_cursor.execute(f"SELECT * FROM {table_name}")
        
        rows_migrated = 0
        batch = []
        
        with tqdm(total=total_rows, desc=f"Migrating {table_name}", unit="rows") as pbar:
            while True:
                rows = sqlite_cursor.fetchmany(batch_size)
                if not rows:
                    break
                
                for row in rows:
                    # Convert None to None (PostgreSQL handles NULL)
                    # Convert bytes to bytes for BYTEA
                    processed_row = []
                    for i, value in enumerate(row):
                        if value is None:
                            processed_row.append(None)
                        elif isinstance(value, bytes):
                            processed_row.append(psycopg2.Binary(value))
                        else:
                            processed_row.append(value)
                    
                    batch.append(tuple(processed_row))
                    
                    if len(batch) >= batch_size:
                        try:
                            psycopg2.extras.execute_batch(pg_cursor, insert_sql, batch)
                            pg_conn.commit()
                            rows_migrated += len(batch)
                            pbar.update(len(batch))
                            batch = []
                        except Exception as e:
                            pg_conn.rollback()
                            print(f"Error inserting batch into {table_name}: {e}")
                            # Try inserting row by row to identify problematic row
                            for single_row in batch:
                                try:
                                    pg_cursor.execute(insert_sql, single_row)
                                    pg_conn.commit()
                                    rows_migrated += 1
                                    pbar.update(1)
                                except Exception as row_error:
                                    print(f"Error inserting row into {table_name}: {row_error}")
                                    print(f"Row data: {single_row[:5]}...")  # Print first 5 columns
                            batch = []
                
                # Insert remaining batch
                if batch:
                    try:
                        psycopg2.extras.execute_batch(pg_cursor, insert_sql, batch)
                        pg_conn.commit()
                        rows_migrated += len(batch)
                        pbar.update(len(batch))
                        batch = []
                    except Exception as e:
                        pg_conn.rollback()
                        print(f"Error inserting final batch into {table_name}: {e}")
        
        return rows_migrated
    
    def migrate_database(self, sqlite_db_path: str) -> Dict[str, Any]:
        """Migrate a single SQLite database to PostgreSQL.
        
        Creates a separate PostgreSQL database for each SQLite database.
        """
        db_name = Path(sqlite_db_path).stem
        print(f"\n{'='*60}")
        print(f"Migrating database: {db_name}")
        print(f"{'='*60}")
        
        # Create a separate PostgreSQL database for this SQLite database
        pg_database_name = db_name  # Use the same name as SQLite database
        if not self.create_postgresql_database(pg_database_name):
            return {'database': db_name, 'tables': 0, 'views': 0, 'rows': 0, 'error': 'Failed to create PostgreSQL database'}
        
        # Connect to SQLite
        sqlite_conn = sqlite3.connect(sqlite_db_path)
        
        # Connect to the specific PostgreSQL database
        pg_params = self.pg_conn_params.copy()
        pg_params['database'] = pg_database_name
        pg_conn = psycopg2.connect(**pg_params)
        pg_conn.autocommit = False
        
        try:
            # Get all tables
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in sqlite_cursor.fetchall()]
            
            # Get all views
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
            views = [row[0] for row in sqlite_cursor.fetchall()]
            
            if not tables and not views:
                print(f"No tables or views found in {db_name}")
                return {'database': db_name, 'tables': 0, 'views': 0, 'rows': 0}
            
            print(f"Found {len(tables)} tables: {', '.join(tables) if tables else 'none'}")
            if views:
                print(f"Found {len(views)} views: {', '.join(views)}")
            
            total_rows = 0
            successful_tables = []
            failed_tables = []
            
            # Migrate each table
            for table_name in tables:
                print(f"\nProcessing table: {table_name}")
                
                try:
                    # Get schema
                    sqlite_schema = self.get_table_schema(sqlite_conn, table_name)
                    
                    if not sqlite_schema:
                        print(f"  Skipping {table_name} (no schema found)")
                        continue
                    
                    # Skip views
                    if sqlite_schema.strip().upper().startswith('CREATE VIEW'):
                        print(f"  Skipping {table_name} (view, not a table)")
                        continue
                    
                    # Convert schema
                    pg_schema = self.convert_sqlite_schema_to_postgresql(sqlite_schema, table_name)
                    
                    if not pg_schema:
                        print(f"  Skipping {table_name} (could not convert schema)")
                        continue
                    
                    # Create table in PostgreSQL
                    print(f"  Creating table structure...")
                    if not self.migrate_table_schema(pg_conn, table_name, pg_schema):
                        print(f"  Failed to create table {table_name}")
                        failed_tables.append(table_name)
                        continue
                    
                    print(f"  Table structure created successfully")
                    
                    # Migrate data
                    print(f"  Migrating data...")
                    rows_migrated = self.migrate_table_data(sqlite_conn, pg_conn, table_name)
                    total_rows += rows_migrated
                    print(f"  Migrated {rows_migrated} rows")
                    
                    # Migrate indexes
                    indexes = self.get_indexes(sqlite_conn, table_name)
                    if indexes:
                        print(f"  Migrating {len(indexes)} indexes...")
                        indexes_migrated = self.migrate_indexes(pg_conn, table_name, indexes)
                        print(f"  Migrated {indexes_migrated} indexes")
                    
                    successful_tables.append(table_name)
                    
                except Exception as e:
                    print(f"  Error migrating table {table_name}: {e}")
                    import traceback
                    traceback.print_exc()
                    failed_tables.append(table_name)
            
            # Migrate views (after all tables are migrated)
            successful_views = []
            failed_views = []
            
            for view_name in views:
                print(f"\nProcessing view: {view_name}")
                
                try:
                    # Get view schema
                    sqlite_view = self.get_view_schema(sqlite_conn, view_name)
                    
                    if not sqlite_view:
                        print(f"  Skipping {view_name} (no schema found)")
                        continue
                    
                    # Convert view
                    pg_view = self.convert_sqlite_view_to_postgresql(sqlite_view, view_name)
                    
                    if not pg_view:
                        print(f"  Skipping {view_name} (could not convert schema)")
                        continue
                    
                    # Create view in PostgreSQL
                    print(f"  Creating view...")
                    if self.migrate_view(pg_conn, view_name, pg_view):
                        print(f"  View created successfully")
                        successful_views.append(view_name)
                    else:
                        print(f"  Failed to create view {view_name}")
                        failed_views.append(view_name)
                    
                except Exception as e:
                    print(f"  Error migrating view {view_name}: {e}")
                    import traceback
                    traceback.print_exc()
                    failed_views.append(view_name)
            
            result = {
                'database': db_name,
                'postgresql_database': pg_database_name,
                'tables': len(successful_tables),
                'views': len(successful_views),
                'rows': total_rows,
                'successful_tables': successful_tables,
                'failed_tables': failed_tables,
                'successful_views': successful_views,
                'failed_views': failed_views
            }
            
            print(f"\n{'='*60}")
            print(f"Migration Summary for {db_name}:")
            print(f"  PostgreSQL Database: {pg_database_name}")
            print(f"  Tables migrated: {len(successful_tables)}")
            print(f"  Views migrated: {len(successful_views)}")
            print(f"  Total rows: {total_rows}")
            if failed_tables:
                print(f"  Failed tables: {', '.join(failed_tables)}")
            if failed_views:
                print(f"  Failed views: {', '.join(failed_views)}")
            print(f"{'='*60}")
            
            return result
            
        finally:
            sqlite_conn.close()
            pg_conn.close()
    
    def migrate_all(self) -> List[Dict[str, Any]]:
        """Migrate all SQLite databases to PostgreSQL."""
        db_files = self.get_sqlite_databases()
        
        if not db_files:
            print("No SQLite databases found!")
            return []
        
        print(f"Found {len(db_files)} SQLite database(s):")
        for db_file in db_files:
            print(f"  - {Path(db_file).name}")
        
        results = []
        for db_file in db_files:
            result = self.migrate_database(db_file)
            results.append(result)
        
        # Print final summary
        print(f"\n{'='*60}")
        print("FINAL MIGRATION SUMMARY")
        print(f"{'='*60}")
        total_tables = sum(r['tables'] for r in results)
        total_views = sum(r.get('views', 0) for r in results)
        total_rows = sum(r['rows'] for r in results)
        print(f"Total SQLite databases migrated: {len(results)}")
        print(f"PostgreSQL databases created:")
        for r in results:
            print(f"  - {r.get('postgresql_database', r['database'])} ({r['tables']} tables, {r.get('views', 0)} views, {r['rows']} rows)")
        print(f"Total tables migrated: {total_tables}")
        print(f"Total views migrated: {total_views}")
        print(f"Total rows migrated: {total_rows}")
        print(f"{'='*60}")
        
        return results


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate SQLite databases to PostgreSQL')
    parser.add_argument('--config', default='config.yaml', help='Path to config file')
    parser.add_argument('--postgresql-url', help='PostgreSQL connection URL (overrides config)')
    parser.add_argument('--database', help='Migrate only a specific database file')
    
    args = parser.parse_args()
    
    try:
        migrator = SQLiteToPostgreSQLMigrator(
            config_path=args.config,
            postgresql_url=args.postgresql_url
        )
        
        if args.database:
            # Migrate single database
            result = migrator.migrate_database(args.database)
            print(f"\nMigration completed: {result}")
        else:
            # Migrate all databases
            results = migrator.migrate_all()
            print(f"\nAll migrations completed!")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

