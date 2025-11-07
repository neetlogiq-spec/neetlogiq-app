#!/usr/bin/env python3
"""
Complete Workflow Script
Orchestrates the entire process: XLSX → SQLite → Match → Link → Convert to Parquet

Usage:
    python3 complete-workflow.py --file path/to/file.xlsx --type counselling
"""

import subprocess
import sys
import logging
from pathlib import Path
import sqlite3

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CompleteWorkflow:
    def __init__(self):
        self.staging_db = 'data/staging.db'
    
    def step1_import_xlsx_to_sqlite(self, file_path: str, data_type: str) -> bool:
        """Step 1: Import XLSX to SQLite"""
        logger.info("🔄 STEP 1: Importing XLSX to SQLite...")
        
        try:
            result = subprocess.run([
                'python3', 'scripts/xlsx-to-sqlite-importer.py',
                '--file', file_path,
                '--type', data_type
            ], capture_output=True, text=True, check=True)
            
            logger.info("✅ Step 1 completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Step 1 failed: {e}")
            logger.error(f"Error output: {e.stderr}")
            return False
    
    def step2_match_and_link(self) -> bool:
        """Step 2: Match and link using hierarchical algorithm"""
        logger.info("🔄 STEP 2: Matching and linking data...")
        
        try:
            result = subprocess.run([
                'python3', 'scripts/sqlite-matcher-linker.py'
            ], capture_output=True, text=True, check=True)
            
            logger.info("✅ Step 2 completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Step 2 failed: {e}")
            logger.error(f"Error output: {e.stderr}")
            return False
    
    def check_matching_status(self) -> dict:
        """Check current matching status"""
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Get statistics
        cursor.execute('SELECT COUNT(*) FROM counselling_data')
        total = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 0')
        matched = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 1')
        unmatched = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'total': total,
            'matched': matched,
            'unmatched': unmatched,
            'match_rate': (matched / total * 100) if total > 0 else 0
        }
    
    def step3_interactive_mode(self) -> bool:
        """Step 3: Interactive mode for unmatched records"""
        logger.info("🔄 STEP 3: Interactive mode for unmatched records...")
        
        stats = self.check_matching_status()
        
        if stats['unmatched'] == 0:
            logger.info("✅ No unmatched records found!")
            return True
        
        logger.info(f"📊 Found {stats['unmatched']} unmatched records")
        logger.info("📝 Please run the interactive mode script to handle unmatched records")
        logger.info("   Command: python3 scripts/interactive-college-mapper.py")
        
        # Ask user if they want to continue
        response = input("\nHave you completed the interactive mode? (y/n): ").lower().strip()
        
        if response == 'y':
            # Check if matching is now 100%
            new_stats = self.check_matching_status()
            if new_stats['unmatched'] == 0:
                logger.info("✅ 100% matching achieved!")
                return True
            else:
                logger.warning(f"Still {new_stats['unmatched']} unmatched records. Please continue with interactive mode.")
                return False
        else:
            logger.info("⏸️ Interactive mode not completed. Please run it manually.")
            return False
    
    def step4_convert_to_parquet(self) -> bool:
        """Step 4: Convert to Parquet files"""
        logger.info("🔄 STEP 4: Converting to Parquet files...")
        
        # Check if 100% matching is achieved
        stats = self.check_matching_status()
        
        if stats['unmatched'] > 0:
            logger.error(f"❌ Cannot convert to Parquet: {stats['unmatched']} unmatched records remaining")
            logger.error("Please complete interactive mode first")
            return False
        
        # Ask for permission
        logger.info("🎯 100% matching achieved!")
        response = input("Do you want to convert to Parquet files? (y/n): ").lower().strip()
        
        if response != 'y':
            logger.info("⏸️ Conversion cancelled by user")
            return False
        
        try:
            # Create conversion script
            conversion_script = '''
import pandas as pd
import sqlite3
from pathlib import Path
from datetime import datetime

# Connect to SQLite
conn = sqlite3.connect('data/staging.db')
df = pd.read_sql_query('SELECT * FROM counselling_data', conn)
conn.close()

# Create output directory
output_dir = Path('data/parquet')
output_dir.mkdir(parents=True, exist_ok=True)

# Group by year and session
for (year, session), group in df.groupby(['year', 'source_file']):
    session_name = 'unknown'
    if 'KEA' in session.upper():
        session_name = 'kea'
    elif 'AIQ' in session.upper():
        session_name = 'aiq'
    
    year_dir = output_dir / str(year)
    year_dir.mkdir(exist_ok=True)
    
    parquet_file = year_dir / f'cutoffs_{session_name}_{year}.parquet'
    group.to_parquet(parquet_file, index=False)
    print(f"✅ Saved {len(group):,} records to {parquet_file}")

print("🎉 Conversion to Parquet completed!")
'''
            
            # Write and run conversion script
            with open('temp_conversion.py', 'w') as f:
                f.write(conversion_script)
            
            result = subprocess.run(['python3', 'temp_conversion.py'], 
                                  capture_output=True, text=True, check=True)
            
            # Clean up
            Path('temp_conversion.py').unlink()
            
            logger.info("✅ Step 4 completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Step 4 failed: {e}")
            logger.error(f"Error output: {e.stderr}")
            return False
    
    def run_complete_workflow(self, file_path: str, data_type: str) -> bool:
        """Run the complete workflow"""
        logger.info("🚀 COMPLETE WORKFLOW")
        logger.info("=" * 50)
        logger.info(f"File: {file_path}")
        logger.info(f"Type: {data_type}")
        logger.info("")
        
        # Step 1: Import XLSX to SQLite
        if not self.step1_import_xlsx_to_sqlite(file_path, data_type):
            return False
        
        # Step 2: Match and link
        if not self.step2_match_and_link():
            return False
        
        # Check initial status
        stats = self.check_matching_status()
        logger.info(f"📊 Initial matching status: {stats['match_rate']:.1f}% ({stats['matched']}/{stats['total']})")
        
        # Step 3: Interactive mode if needed
        if stats['unmatched'] > 0:
            if not self.step3_interactive_mode():
                logger.info("⏸️ Workflow paused for interactive mode")
                return False
        
        # Step 4: Convert to Parquet
        if not self.step4_convert_to_parquet():
            return False
        
        logger.info("")
        logger.info("🎉 COMPLETE WORKFLOW FINISHED SUCCESSFULLY!")
        logger.info("📝 All data has been processed and converted to Parquet files")
        
        return True

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Complete Workflow: XLSX → SQLite → Match → Link → Parquet',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 complete-workflow.py --file KEA2024.xlsx --type counselling
  python3 complete-workflow.py --file AIQ2024.xlsx --type counselling
        """
    )
    
    parser.add_argument('--file', '-f', required=True, help='Path to Excel file to import')
    parser.add_argument('--type', '-t', choices=['counselling'], 
                       help='Type of data: counselling (KEA, AIQ)')
    
    args = parser.parse_args()
    
    if not Path(args.file).exists():
        logger.error(f"File not found: {args.file}")
        sys.exit(1)
    
    workflow = CompleteWorkflow()
    success = workflow.run_complete_workflow(args.file, args.type)
    
    if success:
        logger.info("\n✅ Workflow completed successfully!")
        sys.exit(0)
    else:
        logger.error("\n❌ Workflow failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
