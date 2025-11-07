#!/usr/bin/env python3
"""
Partition counselling data by source, level, and year
Creates Hive-style partitioned parquet files for optimal query performance
"""

import pandas as pd
import os
from pathlib import Path
from typing import Dict, List, Tuple

def partition_counselling_data(
    input_file: str,
    output_dir: str = None,
    partition_style: str = 'hive'  # 'hive' or 'nested'
):
    """
    Partition counselling data by source, level, and year
    
    Args:
        input_file: Path to counselling data parquet file
        output_dir: Output directory (default: input_file's parent + '_partitioned')
        partition_style: 'hive' (flat with names) or 'nested' (directory structure)
    """
    input_path = Path(input_file)
    if output_dir is None:
        output_dir = input_path.parent / f"{input_path.stem}_partitioned"
    else:
        output_dir = Path(output_dir)
    
    print(f"📊 Loading counselling data from: {input_file}")
    df = pd.read_parquet(input_file)
    
    print(f"   Total records: {len(df):,}")
    print(f"   File size: {os.path.getsize(input_file) / (1024*1024):.2f} MB")
    
    # Validate required columns
    required_cols = ['master_source_id', 'master_level_id', 'year']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Group by partition keys
    partitions = df.groupby(['master_source_id', 'master_level_id', 'year'])
    
    print(f"\n📦 Creating partitions...")
    print(f"   Total partitions: {len(partitions)}")
    print(f"   Output directory: {output_dir}")
    print(f"   Style: {partition_style}\n")
    
    partition_info: List[Dict] = []
    total_size = 0
    
    for (source_id, level_id, year), group_df in partitions:
        # Create filename
        if partition_style == 'hive':
            filename = f"source={source_id}_level={level_id}_year={year}.parquet"
            filepath = output_dir / filename
        else:  # nested
            source_dir = output_dir / f"source={source_id}"
            level_dir = source_dir / f"level={level_id}"
            level_dir.mkdir(parents=True, exist_ok=True)
            filename = f"year={year}.parquet"
            filepath = level_dir / filename
        
        # Save partition
        group_df.to_parquet(filepath, compression='snappy', index=False)
        
        # Calculate stats
        file_size = os.path.getsize(filepath)
        total_size += file_size
        
        partition_info.append({
            'source_id': source_id,
            'level_id': level_id,
            'year': year,
            'records': len(group_df),
            'size_mb': file_size / (1024 * 1024),
            'filename': str(filepath.relative_to(output_dir)),
            'path': str(filepath)
        })
        
        print(f"   ✅ {filename}")
        print(f"      Records: {len(group_df):,}")
        print(f"      Size: {file_size / (1024 * 1024):.2f} MB")
    
    # Create manifest file
    manifest = {
        'total_partitions': len(partition_info),
        'total_records': len(df),
        'total_size_mb': total_size / (1024 * 1024),
        'partition_style': partition_style,
        'partitions': partition_info,
        'source': str(input_file),
        'created_at': pd.Timestamp.now().isoformat()
    }
    
    manifest_path = output_dir / 'manifest.json'
    import json
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"\n📋 Manifest created: {manifest_path}")
    
    # Summary
    print(f"\n📊 Partitioning Summary:")
    print(f"   Total partitions: {len(partition_info)}")
    print(f"   Total records: {len(df):,}")
    print(f"   Total size: {total_size / (1024 * 1024):.2f} MB")
    print(f"   Original size: {os.path.getsize(input_file) / (1024 * 1024):.2f} MB")
    print(f"   Size overhead: {(total_size - os.path.getsize(input_file)) / (1024 * 1024):.2f} MB")
    
    # Show partition distribution
    print(f"\n📈 Partition Distribution:")
    for info in sorted(partition_info, key=lambda x: x['records'], reverse=True):
        print(f"   {info['filename']}: {info['records']:,} records ({info['size_mb']:.2f} MB)")
    
    print(f"\n✅ Partitioning complete!")
    print(f"   Output: {output_dir}")
    print(f"   Manifest: {manifest_path}")
    
    return {
        'output_dir': str(output_dir),
        'manifest_path': str(manifest_path),
        'partitions': partition_info,
        'total_size_mb': total_size / (1024 * 1024)
    }

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Partition counselling data by source, level, and year')
    parser.add_argument('input_file', help='Path to counselling data parquet file')
    parser.add_argument('-o', '--output', help='Output directory (default: input_file_stem_partitioned)')
    parser.add_argument('--style', choices=['hive', 'nested'], default='hive',
                       help='Partition style: hive (flat) or nested (directories)')
    parser.add_argument('--keep-original', action='store_true',
                       help='Keep original file (default: not specified, keeps original)')
    
    args = parser.parse_args()
    
    try:
        result = partition_counselling_data(
            args.input_file,
            args.output,
            args.style
        )
        print(f"\n🎉 Success! Created {result['total_size_mb']:.2f} MB of partitioned data")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


