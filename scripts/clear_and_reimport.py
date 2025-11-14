#!/usr/bin/env python3
"""
Clear and Reimport
Drops all data from PostgreSQL tables and reimports from source (SQLite or Excel).

Usage:
    # Reimport from SQLite (recommended)
    python3 scripts/clear_and_reimport.py --source sqlite

    # Reimport from Excel
    python3 scripts/clear_and_reimport.py --source excel --excel-dir ./excel_files

    # Clear tables only (no reimport)
    python3 scripts/clear_and_reimport.py --source none

    # Reimport specific table only
    python3 scripts/clear_and_reimport.py --source sqlite --table seat_data
"""

import argparse
import logging
import sys
import sqlite3
from pathlib import Path
import pandas as pd

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.database import PostgreSQLManager
from lib.utils.data_normalizer import DataNormalizer
import yaml

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ClearAndReimporter:
    """Clear and reimport data from SQLite or Excel"""

    def __init__(self, config_path: str = 'config.yaml'):
        """Initialize with configuration"""
        self.config = self._load_config(config_path)
        self.normalizer = DataNormalizer(self.config)
        self.seat_db = None
        self.master_db = None
        self.counselling_db = None

    def _load_config(self, config_path: str) -> dict:
        """Load configuration"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"✓ Loaded config from {config_path}")
            return config
        except FileNotFoundError:
            logger.error(f"Config file not found: {config_path}")
            sys.exit(1)

    def _initialize_databases(self):
        """Initialize all PostgreSQL connections"""
        pg_config = self.config.get('database', {})

        if not pg_config.get('use_postgresql', False):
            logger.error("PostgreSQL not enabled")
            sys.exit(1)

        pg_urls = pg_config.get('postgresql_urls', {})

        # Initialize connections
        try:
            self.seat_db = PostgreSQLManager(pg_urls.get('seat_data'))
            logger.info("✓ Connected to seat_data")

            self.master_db = PostgreSQLManager(pg_urls.get('master_data'))
            logger.info("✓ Connected to master_data")

            self.counselling_db = PostgreSQLManager(pg_urls.get('counselling_data'))
            logger.info("✓ Connected to counselling_data")

        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            sys.exit(1)

    def run(
        self,
        source: str = 'sqlite',
        table: str = None,
        excel_dir: str = None
    ):
        """
        Run clear and reimport process.

        Args:
            source: Source type ('sqlite', 'excel', 'none')
            table: Specific table to reimport (None = all)
            excel_dir: Directory containing Excel files (if source='excel')
        """
        print("\n" + "="*100)
        print("🔄 CLEAR AND REIMPORT DATA")
        print("="*100 + "\n")

        # Initialize databases
        self._initialize_databases()

        # Define tables
        tables = {
            'master_data': self.master_db,
            'seat_data': self.seat_db,
            'counselling_data': self.counselling_db
        }

        # Filter to specific table if specified
        if table:
            if table not in tables:
                logger.error(f"Unknown table: {table}")
                sys.exit(1)
            tables = {table: tables[table]}

        # Prompt confirmation
        table_list = ', '.join(tables.keys())
        print(f"Tables to clear: {table_list}")
        response = input("Are you sure? (type 'yes' to confirm): ").strip()

        if response != 'yes':
            print("Cancelled.")
            return

        print()

        # Step 1: Clear tables
        logger.info(f"STEP 1: Clearing tables...")
        logger.info("-" * 100)
        for table_name, db_manager in tables.items():
            self._clear_table(table_name, db_manager)

        print()

        # Step 2: Reimport (if source specified)
        if source == 'none':
            logger.info("Skipping reimport (source=none)")
        elif source == 'sqlite':
            logger.info(f"STEP 2: Reimporting from SQLite...")
            logger.info("-" * 100)
            self._reimport_from_sqlite(tables)
        elif source == 'excel':
            logger.info(f"STEP 2: Reimporting from Excel...")
            logger.info("-" * 100)
            self._reimport_from_excel(tables, excel_dir)
        else:
            logger.error(f"Unknown source: {source}")
            sys.exit(1)

        print()

        # Step 3: Verify
        logger.info(f"STEP 3: Verifying import...")
        logger.info("-" * 100)
        self._verify_import(tables)

        print("\n" + "="*100)
        print("✅ CLEAR AND REIMPORT COMPLETE")
        print("="*100 + "\n")

    def _clear_table(self, table_name: str, db_manager: PostgreSQLManager):
        """Clear all data from a table"""
        try:
            sql = f"DELETE FROM {table_name}"
            db_manager.execute_query(sql)
            logger.info(f"✓ Cleared {table_name}")
        except Exception as e:
            logger.error(f"Error clearing {table_name}: {e}")

    def _reimport_from_sqlite(self, tables: dict):
        """Reimport data from SQLite databases"""
        sqlite_path = self.config.get('database', {}).get('sqlite_path', 'data/sqlite')

        # Map table names to SQLite files
        sqlite_files = {
            'master_data': f'{sqlite_path}/master_data.db',
            'seat_data': f'{sqlite_path}/seat_data.db',
            'counselling_data': f'{sqlite_path}/counselling_data_partitioned.db'
        }

        for table_name, db_manager in tables.items():
            sqlite_file = sqlite_files.get(table_name)

            if not Path(sqlite_file).exists():
                logger.warning(f"SQLite file not found: {sqlite_file}")
                continue

            self._reimport_table_from_sqlite(table_name, sqlite_file, db_manager)

    def _reimport_table_from_sqlite(
        self,
        table_name: str,
        sqlite_file: str,
        target_db: PostgreSQLManager
    ):
        """Reimport single table from SQLite"""
        try:
            # Connect to SQLite
            sqlite_conn = sqlite3.connect(sqlite_file)
            sqlite_conn.row_factory = sqlite3.Row

            # Read data from SQLite
            logger.info(f"  Reading from {sqlite_file}...")
            query = f"SELECT * FROM {table_name}"
            df = pd.read_sql_query(query, sqlite_conn)
            sqlite_conn.close()

            logger.info(f"  ✓ Read {len(df):,} rows")

            if df.empty:
                logger.warning(f"  No data in {table_name}")
                return

            # Normalize data
            logger.info(f"  Normalizing {len(df):,} rows...")
            df = self._normalize_dataframe(df, table_name)

            # Insert to PostgreSQL
            logger.info(f"  Inserting into PostgreSQL...")
            self._insert_dataframe(df, table_name, target_db)

            logger.info(f"✓ Reimported {table_name}")

        except Exception as e:
            logger.error(f"Error reimporting {table_name}: {e}")
            raise

    def _reimport_from_excel(self, tables: dict, excel_dir: str):
        """Reimport data from Excel files"""
        if not excel_dir:
            logger.error("--excel-dir required for source=excel")
            sys.exit(1)

        excel_path = Path(excel_dir)
        if not excel_path.exists():
            logger.error(f"Excel directory not found: {excel_dir}")
            sys.exit(1)

        # Map table names to Excel files
        excel_files = {
            'master_data': 'master_data.xlsx',
            'seat_data': 'seat_data.xlsx',
            'counselling_data': 'counselling_data.xlsx'
        }

        for table_name, db_manager in tables.items():
            excel_file = excel_path / excel_files.get(table_name)

            if not excel_file.exists():
                logger.warning(f"Excel file not found: {excel_file}")
                continue

            self._reimport_table_from_excel(table_name, str(excel_file), db_manager)

    def _reimport_table_from_excel(
        self,
        table_name: str,
        excel_file: str,
        target_db: PostgreSQLManager
    ):
        """Reimport single table from Excel"""
        try:
            # Read Excel
            logger.info(f"  Reading {excel_file}...")
            df = pd.read_excel(excel_file)
            logger.info(f"  ✓ Read {len(df):,} rows")

            if df.empty:
                logger.warning(f"  No data in {excel_file}")
                return

            # Normalize data
            logger.info(f"  Normalizing {len(df):,} rows...")
            df = self._normalize_dataframe(df, table_name)

            # Insert to PostgreSQL
            logger.info(f"  Inserting into PostgreSQL...")
            self._insert_dataframe(df, table_name, target_db)

            logger.info(f"✓ Reimported {table_name}")

        except Exception as e:
            logger.error(f"Error reimporting {table_name}: {e}")
            raise

    def _normalize_dataframe(self, df: pd.DataFrame, table_name: str) -> pd.DataFrame:
        """Normalize dataframe columns"""
        df = df.copy()

        # Convert column names to lowercase with underscores
        df.columns = [col.lower().replace(' ', '_') for col in df.columns]

        # Normalize college name
        if 'college' in df.columns or 'institute' in df.columns:
            college_col = 'college' if 'college' in df.columns else 'institute'
            if college_col in df.columns:
                df['normalized_college_name'] = df[college_col].apply(
                    lambda x: self.normalizer.normalize_college_name(str(x)) if pd.notna(x) else None
                )

        # Normalize address
        if 'address' in df.columns:
            df['normalized_address'] = df['address'].apply(
                lambda x: self.normalizer.normalize_address(str(x)) if pd.notna(x) else None
            )

        return df

    def _insert_dataframe(
        self,
        df: pd.DataFrame,
        table_name: str,
        target_db: PostgreSQLManager
    ):
        """Insert dataframe into PostgreSQL"""
        # Convert NaN to None
        df = df.where(pd.notna(df), None)

        columns = df.columns.tolist()
        placeholders = ', '.join(['%s'] * len(columns))
        col_str = ', '.join(columns)

        sql = f"INSERT INTO {table_name} ({col_str}) VALUES ({placeholders})"

        data = [tuple(row) for row in df.values]

        # Insert in batches
        batch_size = 1000
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            target_db.execute_many(sql, batch)
            logger.info(f"  Inserted {min(i + batch_size, len(data)):,}/{len(data):,} rows")

    def _verify_import(self, tables: dict):
        """Verify import success"""
        for table_name, db_manager in tables.items():
            try:
                result = db_manager.fetch_one(f"SELECT COUNT(*) FROM {table_name}")
                count = result[0] if result else 0
                logger.info(f"✓ {table_name}: {count:,} rows")
            except Exception as e:
                logger.error(f"Error verifying {table_name}: {e}")

    def close(self):
        """Close all database connections"""
        if self.seat_db:
            self.seat_db.close()
        if self.master_db:
            self.master_db.close()
        if self.counselling_db:
            self.counselling_db.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Clear and reimport data to PostgreSQL',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Reimport all from SQLite
  python3 scripts/clear_and_reimport.py --source sqlite

  # Reimport only seat_data
  python3 scripts/clear_and_reimport.py --source sqlite --table seat_data

  # Reimport from Excel
  python3 scripts/clear_and_reimport.py --source excel --excel-dir ./excel_files

  # Clear tables only
  python3 scripts/clear_and_reimport.py --source none
        '''
    )

    parser.add_argument(
        '--source',
        choices=['sqlite', 'excel', 'none'],
        default='sqlite',
        help='Data source (default: sqlite)'
    )

    parser.add_argument(
        '--table',
        help='Specific table to reimport (master_data, seat_data, counselling_data)'
    )

    parser.add_argument(
        '--excel-dir',
        help='Directory containing Excel files (if source=excel)'
    )

    parser.add_argument(
        '--config',
        default='config.yaml',
        help='Path to config.yaml'
    )

    args = parser.parse_args()

    # Run
    reimporter = ClearAndReimporter(args.config)
    try:
        reimporter.run(args.source, args.table, args.excel_dir)
    finally:
        reimporter.close()


if __name__ == '__main__':
    main()
