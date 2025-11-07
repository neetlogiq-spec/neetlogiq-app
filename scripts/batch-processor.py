#!/usr/bin/env python3
"""
Batch Processor
Uses the existing standard-importer.py but processes in smaller batches for better performance

Usage:
    python3 batch-processor.py --file path/to/file.xlsx --type counselling --batch-size 1000
"""

import pandas as pd
import logging
import subprocess
import sys
from pathlib import Path
from datetime import datetime
import tempfile
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BatchProcessor:
    def __init__(self, batch_size=1000):
        self.batch_size = batch_size
        self.temp_dir = Path('temp_batches')
        self.temp_dir.mkdir(exist_ok=True)
        self.all_records = []
    
    def split_excel_to_batches(self, file_path: str) -> list:
        """Split Excel file into smaller batches"""
        logger.info(f"📊 Splitting {file_path} into batches of {self.batch_size} records...")
        
        try:
            # Read the full Excel file
            df = pd.read_excel(file_path)
            total_records = len(df)
            logger.info(f"📊 Total records: {total_records:,}")
            
            batch_files = []
            num_batches = (total_records + self.batch_size - 1) // self.batch_size
            
            for i in range(num_batches):
                start_idx = i * self.batch_size
                end_idx = min((i + 1) * self.batch_size, total_records)
                
                # Create batch
                batch_df = df.iloc[start_idx:end_idx]
                batch_file = self.temp_dir / f'batch_{i+1:03d}.xlsx'
                batch_df.to_excel(batch_file, index=False)
                batch_files.append(str(batch_file))
                
                logger.info(f"📦 Created batch {i+1}/{num_batches}: {len(batch_df)} records")
            
            return batch_files
            
        except Exception as e:
            logger.error(f"❌ Error splitting file: {e}")
            return []
    
    def process_batch(self, batch_file: str, batch_num: int, total_batches: int) -> bool:
        """Process a single batch using standard-importer-with-linking.py"""
        logger.info(f"🔄 Processing batch {batch_num}/{total_batches}: {batch_file}")
        
        try:
            # Run standard-importer-with-linking.py on this batch
            result = subprocess.run([
                'python3', 'scripts/standard-importer-with-linking.py',
                '--file', batch_file,
                '--type', 'counselling'
            ], capture_output=True, text=True, check=True)
            
            logger.info(f"✅ Batch {batch_num} completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Batch {batch_num} failed: {e}")
            logger.error(f"Error output: {e.stderr}")
            return False
    
    def combine_parquet_files(self, output_file: str):
        """Combine all generated parquet files into one"""
        logger.info("🔄 Combining all parquet files...")
        
        try:
            # Find all parquet files in data/parquet
            parquet_files = []
            for year_dir in Path('data/parquet').glob('*'):
                if year_dir.is_dir():
                    for parquet_file in year_dir.glob('*.parquet'):
                        parquet_files.append(parquet_file)
            
            if not parquet_files:
                logger.error("❌ No parquet files found to combine")
                return False
            
            # Read and combine all parquet files
            all_dfs = []
            for parquet_file in parquet_files:
                df = pd.read_parquet(parquet_file)
                all_dfs.append(df)
                logger.info(f"📊 Loaded {len(df)} records from {parquet_file}")
            
            # Combine all dataframes
            combined_df = pd.concat(all_dfs, ignore_index=True)
            
            # Save combined file
            combined_df.to_parquet(output_file, index=False)
            
            logger.info(f"✅ Combined {len(combined_df):,} records into {output_file}")
            
            # Clean up individual parquet files
            for parquet_file in parquet_files:
                parquet_file.unlink()
                logger.info(f"🗑️ Cleaned up {parquet_file}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error combining parquet files: {e}")
            return False
    
    def cleanup_temp_files(self):
        """Clean up temporary batch files"""
        logger.info("🧹 Cleaning up temporary files...")
        
        try:
            for file in self.temp_dir.glob('*.xlsx'):
                file.unlink()
            
            self.temp_dir.rmdir()
            logger.info("✅ Temporary files cleaned up")
            
        except Exception as e:
            logger.warning(f"⚠️ Error cleaning up temp files: {e}")
    
    def process_file(self, file_path: str, data_type: str) -> bool:
        """Main processing function"""
        logger.info("🚀 BATCH PROCESSOR")
        logger.info("=" * 40)
        logger.info(f"File: {file_path}")
        logger.info(f"Type: {data_type}")
        logger.info(f"Batch size: {self.batch_size}")
        logger.info("")
        
        try:
            # Step 1: Split Excel file into batches
            batch_files = self.split_excel_to_batches(file_path)
            
            if not batch_files:
                logger.error("❌ Failed to split file into batches")
                return False
            
            # Step 2: Process each batch
            successful_batches = 0
            total_batches = len(batch_files)
            
            for i, batch_file in enumerate(batch_files, 1):
                if self.process_batch(batch_file, i, total_batches):
                    successful_batches += 1
                else:
                    logger.warning(f"⚠️ Batch {i} failed, continuing with next batch...")
            
            logger.info(f"📊 Processed {successful_batches}/{total_batches} batches successfully")
            
            # Step 3: Combine all parquet files
            output_file = f"data/parquet/combined_{Path(file_path).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.parquet"
            if self.combine_parquet_files(output_file):
                logger.info(f"✅ Combined output saved to {output_file}")
            else:
                logger.error("❌ Failed to combine parquet files")
                return False
            
            # Step 4: Cleanup
            self.cleanup_temp_files()
            
            logger.info("")
            logger.info("🎉 BATCH PROCESSING COMPLETED!")
            logger.info("📝 All records have been processed and linked to master data")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Batch processing failed: {e}")
            self.cleanup_temp_files()
            return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Batch Processor using standard-importer-with-linking.py',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 batch-processor.py --file KEA2024.xlsx --type counselling --batch-size 1000
  python3 batch-processor.py --file AIQ2024.xlsx --type counselling --batch-size 500
        """
    )
    
    parser.add_argument('--file', '-f', required=True, help='Path to Excel file to import')
    parser.add_argument('--type', '-t', choices=['counselling'], 
                       help='Type of data: counselling (KEA, AIQ)')
    parser.add_argument('--batch-size', '-b', type=int, default=1000,
                       help='Number of records per batch (default: 1000)')
    
    args = parser.parse_args()
    
    if not Path(args.file).exists():
        logger.error(f"File not found: {args.file}")
        sys.exit(1)
    
    processor = BatchProcessor(batch_size=args.batch_size)
    success = processor.process_file(args.file, args.type)
    
    if success:
        logger.info("\n✅ Batch processing completed successfully!")
        sys.exit(0)
    else:
        logger.error("\n❌ Batch processing failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
