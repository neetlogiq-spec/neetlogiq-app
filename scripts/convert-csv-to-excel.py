#!/usr/bin/env python3

import pandas as pd
import os
import sys

def convert_csv_to_excel(csv_file):
    """Convert CSV file to Excel format for standard-importer.py"""
    if not os.path.exists(csv_file):
        print(f"❌ File not found: {csv_file}")
        return None
    
    # Read CSV file
    print(f"📖 Reading CSV file: {csv_file}")
    df = pd.read_csv(csv_file)
    print(f"  📊 Loaded {len(df)} records")
    print(f"  📋 Columns: {list(df.columns)}")
    
    # Create Excel filename
    excel_file = csv_file.replace('.csv', '.xlsx')
    
    # Save as Excel
    print(f"💾 Converting to Excel: {excel_file}")
    df.to_excel(excel_file, index=False)
    print(f"  ✅ Conversion completed")
    
    return excel_file

def main():
    """Convert all counselling CSV files to Excel format"""
    
    # List of CSV files to convert
    csv_files = [
        'kea2023_counselling_processed_20250926_213525.csv',
        'aiq2024_counselling_processed_20250926_223957.csv',
        'kea2024_counselling_processed_20250926_211850.csv',
        'keadental2024_counselling_processed_20250926_223649.csv'
    ]
    
    converted_files = []
    
    for csv_file in csv_files:
        if os.path.exists(csv_file):
            excel_file = convert_csv_to_excel(csv_file)
            if excel_file:
                converted_files.append(excel_file)
        else:
            print(f"⚠️  File not found: {csv_file}")
    
    print(f"\n📊 CONVERSION SUMMARY:")
    print(f"  Converted files: {len(converted_files)}")
    for file in converted_files:
        print(f"    ✅ {file}")
    
    return converted_files

if __name__ == '__main__':
    main()
