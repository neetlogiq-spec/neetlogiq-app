#!/usr/bin/env python3
"""
XLSX to SQLite Importer
Simple script to import Excel files to SQLite staging database

Usage:
    python3 xlsx-to-sqlite-importer.py --file path/to/file.xlsx --type counselling
"""

import pandas as pd
import sqlite3
import logging
import argparse
import sys
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class XLSXToSQLiteImporter:
    def __init__(self):
        self.staging_db = 'data/staging.db'
        self.setup_database()
    
    def setup_database(self):
        """Create SQLite database with proper schema"""
        logger.info("🗄️ Setting up SQLite staging database...")
        
        # Create data directory
        Path('data').mkdir(exist_ok=True)
        
        # Connect to SQLite database
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Create counselling data table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS counselling_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                all_india_rank INTEGER,
                quota TEXT,
                college_institute TEXT,
                state TEXT,
                course TEXT,
                category TEXT,
                round TEXT,
                year INTEGER,
                source_file TEXT,
                
                -- Matching fields (to be filled by standard-importer)
                matched_college_id TEXT,
                matched_college_name TEXT,
                match_confidence REAL,
                match_method TEXT,
                match_pass INTEGER,
                custom_mapping_applied BOOLEAN,
                needs_manual_review BOOLEAN,
                is_unmatched BOOLEAN,
                
                -- Master data linking (to be filled by standard-importer)
                master_college_id TEXT,
                master_college_name TEXT,
                master_course_id TEXT,
                master_course_name TEXT,
                course_match_confidence REAL,
                course_matched BOOLEAN,
                
                data_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for faster queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_college ON counselling_data(college_institute)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_course ON counselling_data(course)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_state ON counselling_data(state)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_year ON counselling_data(year)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_round ON counselling_data(round)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_unmatched ON counselling_data(is_unmatched)')
        
        conn.commit()
        conn.close()
        
        logger.info("✅ SQLite staging database setup complete")
    
    def import_counselling_data(self, file_path: str) -> int:
        """Import counselling data from Excel to SQLite"""
        logger.info(f"📖 Reading counselling data from: {file_path}")
        
        try:
            # Read Excel file
            df = pd.read_excel(file_path)
            logger.info(f"📊 Loaded {len(df)} rows")
            logger.info(f"📋 Available columns: {list(df.columns)}")
            
            conn = sqlite3.connect(self.staging_db)
            cursor = conn.cursor()
            
            # Clear existing data for this file
            cursor.execute('DELETE FROM counselling_data WHERE source_file = ?', (Path(file_path).name,))
            
            processed_count = 0
            
            for idx, row in df.iterrows():
                try:
                    # Extract fields - flexible column mapping
                    all_india_rank = row.get('ALL_INDIA_RANK', 0)
                    quota = str(row.get('QUOTA', '')).strip() if pd.notna(row.get('QUOTA')) else ''
                    college_institute = str(row.get('COLLEGE/INSTITUTE', '')).strip() if pd.notna(row.get('COLLEGE/INSTITUTE')) else ''
                    state = str(row.get('STATE', '')).strip() if pd.notna(row.get('STATE')) else ''
                    course = str(row.get('COURSE', '')).strip() if pd.notna(row.get('COURSE')) else ''
                    category = str(row.get('CATEGORY', '')).strip() if pd.notna(row.get('CATEGORY')) else ''
                    round_info = str(row.get('ROUND', '')).strip() if pd.notna(row.get('ROUND')) else ''
                    year = row.get('YEAR', datetime.now().year)
                    
                    # Skip invalid records
                    if not college_institute or not course:
                        continue
                        
                    # Convert rank to integer
                    try:
                        rank = int(all_india_rank) if all_india_rank else 0
                    except (ValueError, TypeError):
                        rank = 0
                    
                    # Insert into SQLite database
                    cursor.execute('''
                        INSERT INTO counselling_data (
                            all_india_rank, quota, college_institute, state, course, category, 
                            round, year, source_file, data_type
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        rank, quota, college_institute, state, course, category, 
                        round_info, int(year), Path(file_path).name, 'counselling'
                    ))
                    
                    processed_count += 1
                    
                    if processed_count % 5000 == 0:
                        logger.info(f"📊 Processed {processed_count:,} records...")
                        conn.commit()  # Commit periodically
                        
                except Exception as e:
                    logger.warning(f"Error processing row {idx}: {e}")
                    continue
            
            conn.commit()
            conn.close()
            
            logger.info(f"✅ Imported {processed_count:,} records to SQLite staging database")
            return processed_count
            
        except Exception as e:
            logger.error(f"❌ Error reading file: {e}")
            return 0
    
    def get_import_stats(self) -> dict:
        """Get import statistics from SQLite database"""
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Get total records
        cursor.execute('SELECT COUNT(*) FROM counselling_data')
        total_records = cursor.fetchone()[0]
        
        # Get unmatched records
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 1 OR is_unmatched IS NULL')
        unmatched_records = cursor.fetchone()[0]
        
        # Get matched records
        matched_records = total_records - unmatched_records
        
        conn.close()
        
        return {
            'total_records': total_records,
            'matched_records': matched_records,
            'unmatched_records': unmatched_records,
            'match_rate': (matched_records / total_records * 100) if total_records > 0 else 0
        }
    
    def process_file(self, file_path: str, data_type: str) -> dict:
        """Main processing function"""
        logger.info("🚀 XLSX TO SQLITE IMPORTER")
        logger.info("=" * 40)
        logger.info(f"File: {file_path}")
        logger.info(f"Type: {data_type}")
        
        try:
            if data_type == 'counselling':
                records_processed = self.import_counselling_data(file_path)
            else:
                raise ValueError(f"Unsupported data type: {data_type}")
            
            # Get statistics
            stats = self.get_import_stats()
            
            logger.info("")
            logger.info("🎉 XLSX TO SQLITE IMPORT COMPLETED!")
            logger.info(f"📊 Records imported: {records_processed:,}")
            logger.info(f"📊 Total in database: {stats['total_records']:,}")
            logger.info("")
            logger.info("📝 Next steps:")
            logger.info("   1. Run standard-importer-with-linking.py to match and link")
            logger.info("   2. Use interactive mode for unmatched records")
            logger.info("   3. Convert to parquet after 100% matching")
            
            return {
                'success': True,
                'records_processed': records_processed,
                'statistics': stats
            }
            
        except Exception as e:
            logger.error(f"❌ Import failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

def main():
    parser = argparse.ArgumentParser(
        description='XLSX to SQLite Importer for staging database',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 xlsx-to-sqlite-importer.py --file KEA2024.xlsx --type counselling
  python3 xlsx-to-sqlite-importer.py --file AIQ2024.xlsx --type counselling
        """
    )
    
    parser.add_argument('--file', '-f', required=True, help='Path to Excel file to import')
    parser.add_argument('--type', '-t', choices=['counselling'], 
                       help='Type of data: counselling (KEA, AIQ)')
    parser.add_argument('--version', action='version', version='XLSX to SQLite Importer v1.0')
    
    args = parser.parse_args()
    
    if not Path(args.file).exists():
        logger.error(f"File not found: {args.file}")
        sys.exit(1)
    
    importer = XLSXToSQLiteImporter()
    result = importer.process_file(args.file, args.type)
    
    if result['success']:
        logger.info(f"\n✅ Success! Imported {result['records_processed']:,} records to SQLite")
        sys.exit(0)
    else:
        logger.error(f"\n❌ Failed: {result['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main()
