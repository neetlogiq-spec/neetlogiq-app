#!/usr/bin/env python3
"""
Import from Excel to PostgreSQL
Reads Excel files and imports data into PostgreSQL with normalization.

Usage:
    python3 scripts/import_from_excel.py --file master_data.xlsx --table master_data --type master
    python3 scripts/import_from_excel.py --file seat_data.xlsx --table seat_data --type seat
    python3 scripts/import_from_excel.py --file counselling_data.xlsx --table counselling_data --type counselling
"""

import argparse
import logging
import sys
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


class ExcelImporter:
    """Imports Excel data to PostgreSQL with normalization"""

    def __init__(self, config_path: str = 'config.yaml'):
        """Initialize importer with configuration"""
        self.config = self._load_config(config_path)
        self.normalizer = DataNormalizer(self.config)
        self.db = None

    def _load_config(self, config_path: str) -> dict:
        """Load configuration from YAML"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"✓ Loaded config from {config_path}")
            return config
        except FileNotFoundError:
            logger.error(f"Config file not found: {config_path}")
            sys.exit(1)

    def _initialize_database(self, table_name: str):
        """Initialize database connection for target table"""
        pg_config = self.config.get('database', {})

        if not pg_config.get('use_postgresql', False):
            logger.error("PostgreSQL not enabled in config")
            sys.exit(1)

        pg_urls = pg_config.get('postgresql_urls', {})

        # Determine which database to use
        if 'seat_data' in table_name:
            db_url = pg_urls.get('seat_data')
        elif 'counselling_data' in table_name:
            db_url = pg_urls.get('counselling_data')
        else:  # master_data or other
            db_url = pg_urls.get('master_data')

        if not db_url:
            logger.error(f"Database URL not found for {table_name}")
            sys.exit(1)

        try:
            self.db = PostgreSQLManager(db_url)
            logger.info(f"✓ Connected to PostgreSQL for {table_name}")
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            sys.exit(1)

    def import_from_excel(
        self,
        excel_file: str,
        table_name: str,
        data_type: str = 'master'
    ):
        """
        Import Excel file to PostgreSQL table.

        Args:
            excel_file: Path to Excel file
            table_name: Target table name
            data_type: Type of data ('master', 'seat', 'counselling')
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"IMPORTING FROM EXCEL: {excel_file} → {table_name}")
        logger.info(f"{'='*100}\n")

        # Verify file exists
        if not Path(excel_file).exists():
            logger.error(f"File not found: {excel_file}")
            sys.exit(1)

        # Initialize database
        self._initialize_database(table_name)

        # Read Excel file
        logger.info(f"Reading Excel file: {excel_file}")
        try:
            df = pd.read_excel(excel_file)
            logger.info(f"✓ Read {len(df):,} rows, {len(df.columns)} columns")
        except Exception as e:
            logger.error(f"Error reading Excel: {e}")
            sys.exit(1)

        # Clean and normalize data
        logger.info("\nNormalizing data...")
        df = self._normalize_dataframe(df, data_type)
        logger.info(f"✓ Data normalized")

        # Validate data
        logger.info("\nValidating data...")
        self._validate_dataframe(df, data_type)
        logger.info(f"✓ Data validation passed")

        # Clear existing data (optional - prompt user)
        print(f"\nTable: {table_name}")
        response = input(f"Clear existing data in {table_name}? (y/n): ").strip().lower()

        if response == 'y':
            self._clear_table(table_name)

        # Insert data
        logger.info(f"\nInserting {len(df):,} rows into {table_name}...")
        self._insert_dataframe(df, table_name)
        logger.info(f"✓ Import complete!")

        # Verify
        self._verify_import(table_name)

    def _normalize_dataframe(self, df: pd.DataFrame, data_type: str) -> pd.DataFrame:
        """Normalize columns in dataframe"""
        df = df.copy()

        # Convert column names to lowercase with underscores
        df.columns = [col.lower().replace(' ', '_') for col in df.columns]

        # Handle different data types
        if data_type == 'master':
            # Master data: state, college/institute, address
            if 'college' in df.columns or 'institute' in df.columns:
                college_col = 'college' if 'college' in df.columns else 'institute'
                df['normalized_college_name'] = df[college_col].apply(
                    self.normalizer.normalize_college_name
                )

            if 'address' in df.columns:
                df['normalized_address'] = df['address'].apply(
                    self.normalizer.normalize_address
                )

        elif data_type == 'seat':
            # Seat data: state, college, course, seats
            if 'college' in df.columns or 'institute' in df.columns:
                college_col = 'college' if 'college' in df.columns else 'institute'
                df['normalized_college_name'] = df[college_col].apply(
                    self.normalizer.normalize_college_name
                )

            if 'address' in df.columns:
                df['normalized_address'] = df['address'].apply(
                    self.normalizer.normalize_address
                )

        elif data_type == 'counselling':
            # Counselling data: state, college, course, quota, category
            if 'college' in df.columns or 'institute' in df.columns:
                college_col = 'college' if 'college' in df.columns else 'institute'
                df['normalized_college_name'] = df[college_col].apply(
                    self.normalizer.normalize_college_name
                )

            if 'address' in df.columns:
                df['normalized_address'] = df['address'].apply(
                    self.normalizer.normalize_address
                )

        return df

    def _validate_dataframe(self, df: pd.DataFrame, data_type: str):
        """Validate data in dataframe"""
        # Check for required columns
        required_cols = {
            'master': ['state', 'college'],
            'seat': ['state', 'college', 'course'],
            'counselling': ['state', 'college', 'course', 'quota']
        }

        required = required_cols.get(data_type, [])
        missing = [col for col in required if col not in df.columns]

        if missing:
            logger.warning(f"Missing columns: {missing}")

        # Check for null values in key columns
        for col in required:
            if col in df.columns:
                null_count = df[col].isna().sum()
                if null_count > 0:
                    logger.warning(f"Column '{col}' has {null_count} null values")

    def _clear_table(self, table_name: str):
        """Clear all data from table"""
        try:
            sql = f"DELETE FROM {table_name}"
            self.db.execute_query(sql)
            logger.info(f"✓ Cleared {table_name}")
        except Exception as e:
            logger.error(f"Error clearing table: {e}")

    def _insert_dataframe(self, df: pd.DataFrame, table_name: str):
        """Insert dataframe into PostgreSQL"""
        # Convert NaN to None for SQL NULL
        df = df.where(pd.notna(df), None)

        # Get column names
        columns = df.columns.tolist()
        placeholders = ', '.join(['%s'] * len(columns))
        col_str = ', '.join(columns)

        sql = f"INSERT INTO {table_name} ({col_str}) VALUES ({placeholders})"

        # Convert to list of tuples
        data = [tuple(row) for row in df.values]

        try:
            # Insert in batches
            batch_size = 1000
            for i in range(0, len(data), batch_size):
                batch = data[i:i+batch_size]
                self.db.execute_many(sql, batch)
                logger.info(f"  Inserted {min(i + batch_size, len(data)):,}/{len(data):,} rows")

            logger.info(f"✓ Inserted {len(data):,} rows")

        except Exception as e:
            logger.error(f"Error inserting data: {e}")
            raise

    def _verify_import(self, table_name: str):
        """Verify import was successful"""
        try:
            result = self.db.fetch_one(f"SELECT COUNT(*) FROM {table_name}")
            count = result[0] if result else 0
            logger.info(f"\n✓ Verification: {count:,} rows in {table_name}")
        except Exception as e:
            logger.error(f"Error verifying import: {e}")

    def close(self):
        """Close database connection"""
        if self.db:
            self.db.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Import Excel data to PostgreSQL',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Import master data
  python3 scripts/import_from_excel.py --file master_data.xlsx --table master_data --type master

  # Import seat data
  python3 scripts/import_from_excel.py --file seat_data.xlsx --table seat_data --type seat

  # Import counselling data
  python3 scripts/import_from_excel.py --file counselling_data.xlsx --table counselling_data --type counselling
        '''
    )

    parser.add_argument(
        '--file',
        required=True,
        help='Path to Excel file'
    )

    parser.add_argument(
        '--table',
        required=True,
        help='Target table name (master_data, seat_data, counselling_data)'
    )

    parser.add_argument(
        '--type',
        choices=['master', 'seat', 'counselling'],
        default='master',
        help='Data type (default: master)'
    )

    parser.add_argument(
        '--config',
        default='config.yaml',
        help='Path to config.yaml'
    )

    args = parser.parse_args()

    # Run import
    importer = ExcelImporter(args.config)
    try:
        importer.import_from_excel(args.file, args.table, args.type)
    finally:
        importer.close()


if __name__ == '__main__':
    main()
