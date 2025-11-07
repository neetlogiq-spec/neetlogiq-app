#!/usr/bin/env python3
"""
Export counselling data from SQLite to optimized Parquet format with hybrid schema.
Handles missing columns gracefully with fallbacks.

Schema: Aggregated records with pre-calculated ranks + all_ranks array
"""

import sqlite3
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Mapping for missing master IDs (fallback logic)
SOURCE_MAPPING = {
    'AIQ': 'SRC001',
    'KEA': 'SRC002',
}

LEVEL_MAPPING = {
    'UG': 'LVL001',
    'PG': 'LVL002',
    'DEN': 'LVL003',
    'DENTAL': 'LVL003',
}


class CounsellingDataExporter:
    def __init__(self, sqlite_path: str, output_dir: str):
        self.sqlite_path = Path(sqlite_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def get_schema(self) -> pa.Schema:
        """Define optimized Parquet schema with LIST type for ranks"""
        return pa.schema([
            pa.field('master_source_id', pa.string()),
            pa.field('master_level_id', pa.string()),
            pa.field('year', pa.int32()),
            
            # College/Course info
            pa.field('master_college_id', pa.string()),
            pa.field('college_name', pa.string()),
            pa.field('master_course_id', pa.string()),
            pa.field('course_name', pa.string()),
            
            # Round and quota/category
            pa.field('round', pa.string()),
            pa.field('round_normalized', pa.int32()),
            pa.field('quota', pa.string()),
            pa.field('category', pa.string()),
            pa.field('master_quota_id', pa.string()),
            pa.field('master_category_id', pa.string()),
            
            # Pre-calculated aggregates
            pa.field('opening_rank', pa.int32()),
            pa.field('closing_rank', pa.int32()),
            pa.field('seat_count', pa.int32()),
            
            # Raw ranks array (LIST<INT32>)
            pa.field('all_ranks', pa.list_(pa.int32())),
            
            # Additional metadata
            pa.field('state', pa.string()),
            pa.field('master_state_id', pa.string()),
            pa.field('calculated_at', pa.timestamp('ms')),
            pa.field('data_source', pa.string()),
        ])
    
    def get_source_id(self, row: pd.Series) -> str:
        """Get master_source_id with fallback logic"""
        # Priority 1: master_source_id column
        if 'master_source_id' in row.index and pd.notna(row.get('master_source_id')):
            return str(row['master_source_id'])
        
        # Priority 2: Source column (capitalized)
        if 'Source' in row.index and pd.notna(row.get('Source')):
            return SOURCE_MAPPING.get(str(row['Source']).upper(), None)
        
        # Priority 3: source_normalized
        if 'source_normalized' in row.index and pd.notna(row.get('source_normalized')):
            normalized = str(row['source_normalized']).upper()
            return SOURCE_MAPPING.get(normalized, None)
        
        # Default: Unknown
        logger.warning(f"Could not determine source_id for record {row.get('id', 'unknown')}")
        return None
    
    def get_level_id(self, row: pd.Series) -> str:
        """Get master_level_id with fallback logic"""
        # Priority 1: master_level_id column
        if 'master_level_id' in row.index and pd.notna(row.get('master_level_id')):
            return str(row['master_level_id'])
        
        # Priority 2: Level column (capitalized)
        if 'Level' in row.index and pd.notna(row.get('Level')):
            return LEVEL_MAPPING.get(str(row['Level']).upper(), None)
        
        # Priority 3: level_normalized
        if 'level_normalized' in row.index and pd.notna(row.get('level_normalized')):
            normalized = str(row['level_normalized']).upper()
            return LEVEL_MAPPING.get(normalized, None)
        
        # Default: Unknown
        logger.warning(f"Could not determine level_id for record {row.get('id', 'unknown')}")
        return None
    
    def load_from_sqlite(self) -> pd.DataFrame:
        """Load data from SQLite with column existence checks"""
        logger.info(f"📊 Loading data from {self.sqlite_path}")
        
        conn = sqlite3.connect(str(self.sqlite_path))
        
        # Check which columns exist
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(counselling_records)")
        columns = [col[1] for col in cursor.fetchall()]
        
        logger.info(f"   Found {len(columns)} columns in counselling_records table")
        
        # Build query with all available columns
        query = "SELECT * FROM counselling_records"
        
        # Optional: Add filter for matched records only (if needed)
        # query += " WHERE is_matched = TRUE"
        
        df = pd.read_sql(query, conn)
        conn.close()
        
        logger.info(f"✅ Loaded {len(df):,} records")
        return df
    
    def process_to_aggregated_format(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform raw records to aggregated format with rank arrays"""
        logger.info("🔄 Processing to aggregated format...")
        
        # Add master IDs if missing (for grouping)
        if 'master_source_id' not in df.columns or df['master_source_id'].isna().all():
            logger.info("   Adding master_source_id using fallback logic...")
            df['master_source_id'] = df.apply(self.get_source_id, axis=1)
        
        if 'master_level_id' not in df.columns or df['master_level_id'].isna().all():
            logger.info("   Adding master_level_id using fallback logic...")
            df['master_level_id'] = df.apply(self.get_level_id, axis=1)
        
        # Filter out records without source/level IDs
        before_filter = len(df)
        df = df[df['master_source_id'].notna() & df['master_level_id'].notna()].copy()
        after_filter = len(df)
        
        if before_filter != after_filter:
            logger.warning(f"   Filtered out {before_filter - after_filter:,} records without source/level IDs")
        
        # Group by dimensions
        group_cols = [
            'master_source_id', 'master_level_id', 'year',
            'master_college_id', 'master_course_id',
            'round_raw', 'quota', 'category'
        ]
        
        # Use available columns
        available_group_cols = [col for col in group_cols if col in df.columns]
        
        logger.info(f"   Grouping by: {', '.join(available_group_cols)}")
        
        grouped = df.groupby(available_group_cols, dropna=False)
        
        aggregated_records = []
        
        for group_key, group_df in grouped:
            if len(group_df) == 0:
                continue
            
            # Extract group values
            if len(available_group_cols) == len(group_key):
                group_dict = dict(zip(available_group_cols, group_key))
            else:
                # Handle case where some columns might be missing
                group_dict = {}
                for i, col in enumerate(available_group_cols):
                    if i < len(group_key):
                        group_dict[col] = group_key[i]
            
            # Get ranks
            ranks = group_df['all_india_rank'].dropna().tolist()
            
            if len(ranks) == 0:
                continue
            
            ranks.sort()  # Sort for easier debugging
            
            # Get representative values (first non-null value)
            first_row = group_df.iloc[0]
            
            # Get college/course names (use normalized or raw)
            college_name = (
                first_row.get('college_institute_normalized') or
                first_row.get('college_institute_raw') or
                'Unknown'
            )
            
            course_name = (
                first_row.get('course_normalized') or
                first_row.get('course_raw') or
                'Unknown'
            )
            
            # Round handling
            round_value = group_dict.get('round_raw') or first_row.get('round_raw') or first_row.get('round_normalized') or 'Unknown'
            round_normalized = first_row.get('round_normalized')
            
            aggregated_records.append({
                'master_source_id': group_dict.get('master_source_id'),
                'master_level_id': group_dict.get('master_level_id'),
                'year': group_dict.get('year'),
                
                'master_college_id': group_dict.get('master_college_id') or first_row.get('master_college_id'),
                'college_name': college_name,
                'master_course_id': group_dict.get('master_course_id') or first_row.get('master_course_id'),
                'course_name': course_name,
                
                'round': str(round_value),
                'round_normalized': int(round_normalized) if pd.notna(round_normalized) else None,
                'quota': group_dict.get('quota') or first_row.get('quota'),
                'category': group_dict.get('category') or first_row.get('category'),
                'master_quota_id': first_row.get('master_quota_id'),
                'master_category_id': first_row.get('master_category_id'),
                
                # Pre-calculated aggregates
                'opening_rank': int(min(ranks)),
                'closing_rank': int(max(ranks)),
                'seat_count': len(ranks),
                
                # Raw ranks array
                'all_ranks': ranks,
                
                # Additional metadata
                'state': first_row.get('state_normalized') or first_row.get('state_raw'),
                'master_state_id': first_row.get('master_state_id'),
                'calculated_at': datetime.now(),
                'data_source': first_row.get('partition_key') or f"source={group_dict.get('master_source_id')}_level={group_dict.get('master_level_id')}_year={group_dict.get('year')}",
            })
        
        result_df = pd.DataFrame(aggregated_records)
        
        logger.info(f"✅ Aggregated {len(df):,} raw records → {len(result_df):,} aggregated records")
        logger.info(f"   Compression ratio: {len(df) / len(result_df):.1f}x")
        
        return result_df
    
    def write_partitioned_parquet(self, df: pd.DataFrame):
        """Write data to partitioned Parquet files by source/level/year"""
        logger.info("📦 Writing partitioned Parquet files...")
        
        if df.empty:
            logger.warning("   No data to write")
            return
        
        # Partition by source, level, year
        partitions = df.groupby(['master_source_id', 'master_level_id', 'year'])
        
        partition_info = []
        
        for (source_id, level_id, year), partition_df in partitions:
            if partition_df.empty:
                continue
            
            # Create partition filename (Hive-style)
            filename = f"source={source_id}_level={level_id}_year={year}.parquet"
            filepath = self.output_dir / filename
            
            # Convert DataFrame to PyArrow Table with proper schema
            # Handle all_ranks array conversion
            table_data = []
            
            for _, row in partition_df.iterrows():
                record = {}
                for field in self.get_schema():
                    field_name = field.name
                    
                    if field_name == 'all_ranks':
                        # Convert list to PyArrow array
                        record[field_name] = row.get(field_name, [])
                    elif field_name == 'calculated_at':
                        # Convert timestamp
                        record[field_name] = pd.Timestamp(row.get(field_name, datetime.now()))
                    else:
                        record[field_name] = row.get(field_name)
                
                table_data.append(record)
            
            # Create PyArrow Table
            table = pa.Table.from_pylist(table_data, schema=self.get_schema())
            
            # Write to Parquet
            pq.write_table(
                table,
                str(filepath),
                compression='snappy',
                use_dictionary=True,  # Enable dictionary encoding for better compression
                write_statistics=True,  # Enable statistics for query optimization
            )
            
            file_size_mb = filepath.stat().st_size / (1024 * 1024)
            
            partition_info.append({
                'filename': filename,
                'records': len(partition_df),
                'size_mb': round(file_size_mb, 2),
                'source_id': source_id,
                'level_id': level_id,
                'year': year,
            })
            
            logger.info(f"   ✅ {filename}: {len(partition_df):,} records, {file_size_mb:.2f} MB")
        
        # Create manifest
        manifest = {
            'created_at': datetime.now().isoformat(),
            'source_database': str(self.sqlite_path),
            'total_partitions': len(partition_info),
            'total_records': len(df),
            'partitions': partition_info,
        }
        
        manifest_path = self.output_dir / 'manifest.json'
        import json
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"✅ Created {len(partition_info)} partition files")
        logger.info(f"   Manifest: {manifest_path}")
    
    def export(self):
        """Main export process"""
        logger.info("🚀 Starting export process...")
        logger.info(f"   Input: {self.sqlite_path}")
        logger.info(f"   Output: {self.output_dir}")
        
        # Load data
        df = self.load_from_sqlite()
        
        if df.empty:
            logger.error("❌ No data found in database")
            return
        
        # Process to aggregated format
        aggregated_df = self.process_to_aggregated_format(df)
        
        if aggregated_df.empty:
            logger.error("❌ No data after aggregation")
            return
        
        # Write partitioned Parquet
        self.write_partitioned_parquet(aggregated_df)
        
        logger.info("✅ Export complete!")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Export counselling data to optimized Parquet format')
    parser.add_argument(
        'sqlite_path',
        type=str,
        default='data/sqlite/counselling_data_partitioned.db',
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default='output/counselling_data_optimized',
        help='Output directory for Parquet files'
    )
    
    args = parser.parse_args()
    
    exporter = CounsellingDataExporter(args.sqlite_path, args.output_dir)
    exporter.export()


if __name__ == '__main__':
    main()

