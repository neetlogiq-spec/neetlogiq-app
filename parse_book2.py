#!/usr/bin/env python3
"""
Script to parse Book2.xlsx hierarchical data and save to CSV
Ignores first and last rows as requested
"""

import pandas as pd
import os
from src.hierarchical_data_parser import parse_book2_hierarchical

def main():
    # File paths
    input_file = "/Users/kashyapanand/Desktop/EXPORT/Book2.xlsx"
    output_file = "/Users/kashyapanand/Public/New/book2_parsed.csv"
    
    print("Parsing Book2.xlsx hierarchical data...")
    
    try:
        # Parse the hierarchical data
        df = parse_book2_hierarchical(input_file)
        
        # Add unique identifier
        df['UNIQUE_ID'] = df['STATE'] + ' | ' + df['COLLEGE'] + ' | ' + df['ADDRESS']
        
        # Save to CSV
        df.to_csv(output_file, index=False)
        
        print(f"✅ Successfully parsed {len(df)} records")
        print(f"📊 Statistics:")
        print(f"   - Unique states: {df['STATE'].nunique()}")
        print(f"   - Unique colleges: {df['COLLEGE'].nunique()}")
        print(f"   - Unique identifiers: {df['UNIQUE_ID'].nunique()}")
        print(f"💾 Saved to: {output_file}")
        
        # Show first few records
        print(f"\n📋 Sample records:")
        for i in range(min(5, len(df))):
            row = df.iloc[i]
            print(f"   {row['STATE']} | {row['COLLEGE']} | {row['ADDRESS']}")
            
        # Show state distribution
        print(f"\n🌍 State distribution (top 10):")
        state_counts = df['STATE'].value_counts().head(10)
        for state, count in state_counts.items():
            print(f"   {state}: {count}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()