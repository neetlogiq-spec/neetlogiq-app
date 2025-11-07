#!/usr/bin/env python3
"""
Add master_source_id and master_level_id to counselling data
Maps source_normalized to master source IDs and level_normalized to master level IDs
"""

import pandas as pd
import sys
from pathlib import Path

# Master source and level mappings (from master data service defaults)
SOURCE_MAPPING = {
    'AIQ': 'SRC001',  # AIQ maps to MCC (Medical Counseling Committee)
    'MCC': 'SRC001',  # Direct MCC mapping
    'KEA': 'SRC002',
}

LEVEL_MAPPING = {
    'UG': 'LVL001',
    'PG': 'LVL002',
    'DEN': 'LVL003',
}

def add_source_level_ids(input_file: str, output_file: str = None):
    """
    Add master_source_id and master_level_id columns to counselling data
    
    Args:
        input_file: Path to counselling data parquet file
        output_file: Path to output file (if None, overwrites input)
    """
    print(f"📊 Loading counselling data from: {input_file}")
    df = pd.read_parquet(input_file)
    
    print(f"   Total records: {len(df)}")
    
    # Check existing columns
    has_source_id = 'master_source_id' in df.columns
    has_level_id = 'master_level_id' in df.columns
    
    print(f"\n📋 Current state:")
    print(f"   Has master_source_id: {has_source_id}")
    print(f"   Has master_level_id: {has_level_id}")
    
    # Add master_source_id if not present
    if not has_source_id:
        if 'source_normalized' not in df.columns:
            print("⚠️  Warning: source_normalized column not found!")
            df['master_source_id'] = None
        else:
            print(f"\n🔗 Mapping sources...")
            df['master_source_id'] = df['source_normalized'].map(SOURCE_MAPPING)
            
            # Show mapping statistics
            mapped_sources = df['master_source_id'].notna().sum()
            print(f"   Mapped: {mapped_sources}/{len(df)} records")
            
            # Show unmapped sources
            unmapped = df[df['master_source_id'].isna()]['source_normalized'].unique() if 'source_normalized' in df.columns else []
            if len(unmapped) > 0:
                print(f"   ⚠️  Unmapped sources: {list(unmapped)}")
    else:
        print("✅ master_source_id already exists")
    
    # Add master_level_id if not present
    if not has_level_id:
        if 'level_normalized' not in df.columns:
            print("⚠️  Warning: level_normalized column not found!")
            df['master_level_id'] = None
        else:
            print(f"\n🔗 Mapping levels...")
            df['master_level_id'] = df['level_normalized'].map(LEVEL_MAPPING)
            
            # Show mapping statistics
            mapped_levels = df['master_level_id'].notna().sum()
            print(f"   Mapped: {mapped_levels}/{len(df)} records")
            
            # Show unmapped levels
            unmapped = df[df['master_level_id'].isna()]['level_normalized'].unique() if 'level_normalized' in df.columns else []
            if len(unmapped) > 0:
                print(f"   ⚠️  Unmapped levels: {list(unmapped)}")
    else:
        print("✅ master_level_id already exists")
    
    # Update if IDs exist but need refresh
    if has_source_id and 'source_normalized' in df.columns:
        print(f"\n🔄 Refreshing master_source_id...")
        df['master_source_id'] = df['source_normalized'].map(SOURCE_MAPPING)
        mapped_sources = df['master_source_id'].notna().sum()
        print(f"   Refreshed: {mapped_sources}/{len(df)} records")
    
    if has_level_id and 'level_normalized' in df.columns:
        print(f"\n🔄 Refreshing master_level_id...")
        df['master_level_id'] = df['level_normalized'].map(LEVEL_MAPPING)
        mapped_levels = df['master_level_id'].notna().sum()
        print(f"   Refreshed: {mapped_levels}/{len(df)} records")
    
    # Summary
    print(f"\n📊 Summary:")
    print(f"   Total records: {len(df)}")
    if 'master_source_id' in df.columns:
        source_stats = df['master_source_id'].value_counts()
        print(f"   Source IDs: {len(source_stats)} unique values")
        for source_id, count in source_stats.items():
            if pd.notna(source_id):
                source_code = [k for k, v in SOURCE_MAPPING.items() if v == source_id]
                print(f"      {source_id} ({source_code[0] if source_code else 'unknown'}): {count} records")
    
    if 'master_level_id' in df.columns:
        level_stats = df['master_level_id'].value_counts()
        print(f"   Level IDs: {len(level_stats)} unique values")
        for level_id, count in level_stats.items():
            if pd.notna(level_id):
                level_code = [k for k, v in LEVEL_MAPPING.items() if v == level_id]
                print(f"      {level_id} ({level_code[0] if level_code else 'unknown'}): {count} records")
    
    # Save
    output_path = output_file or input_file
    print(f"\n💾 Saving to: {output_path}")
    df.to_parquet(output_path, compression='snappy', index=False)
    
    print(f"✅ Successfully added master_source_id and master_level_id!")
    return df

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Add master_source_id and master_level_id to counselling data')
    parser.add_argument('input_file', help='Path to counselling data parquet file')
    parser.add_argument('-o', '--output', help='Output file path (default: overwrites input)')
    parser.add_argument('--backup', action='store_true', help='Create backup before modifying')
    
    args = parser.parse_args()
    
    # Create backup if requested
    if args.backup:
        backup_path = args.input_file.replace('.parquet', '_backup.parquet')
        print(f"📦 Creating backup: {backup_path}")
        import shutil
        shutil.copy2(args.input_file, backup_path)
        print(f"✅ Backup created")
    
    # Process file
    try:
        df = add_source_level_ids(args.input_file, args.output)
        print(f"\n🎉 Done! File updated successfully.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

