#!/usr/bin/env python3
"""
Import and process counselling data from KEA2024.xlsx
Following master data rules for normalization and validation
"""

import pandas as pd
import sys
from datetime import datetime
import os

def load_counselling_data(file_path):
    """Load counselling data from Excel file"""
    try:
        print(f"Loading counselling data from: {file_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        print(f"Successfully loaded {len(df)} records")
        print(f"Columns found: {list(df.columns)}")
        print(f"\nFirst few rows:")
        print(df.head())
        
        return df
        
    except Exception as e:
        print(f"Error loading data: {str(e)}")
        return None

def normalize_data(df):
    """
    Normalize data according to master data rules:
    - Convert to uppercase
    - Standardize names
    """
    if df is None:
        return None
    
    print("\nNormalizing data...")
    df_normalized = df.copy()
    
    # Convert string columns to uppercase as per master data rules
    for col in df_normalized.columns:
        if df_normalized[col].dtype == 'object':  # string columns
            df_normalized[col] = df_normalized[col].astype(str).str.upper().str.strip()
    
    print("Data normalization completed")
    return df_normalized

def detect_duplicates(df):
    """Detect duplicate records for reporting"""
    if df is None:
        return None
    
    print("\nDetecting duplicates...")
    
    # Check for exact duplicates
    duplicates = df.duplicated()
    duplicate_count = duplicates.sum()
    
    if duplicate_count > 0:
        print(f"Found {duplicate_count} duplicate records")
        duplicate_rows = df[duplicates]
        print("Duplicate records:")
        print(duplicate_rows)
    else:
        print("No exact duplicates found")
    
    return duplicate_count

def generate_import_report(df, original_df, duplicate_count, file_path):
    """Generate import report as required by rules"""
    print("\n" + "="*50)
    print("COUNSELLING DATA IMPORT REPORT")
    print("="*50)
    
    print(f"Source file: {file_path}")
    print(f"Import timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Total records loaded: {len(original_df) if original_df is not None else 0}")
    print(f"Records after processing: {len(df) if df is not None else 0}")
    print(f"Duplicate records found: {duplicate_count}")
    
    if df is not None:
        print(f"\nColumn summary:")
        for col in df.columns:
            print(f"  - {col}: {df[col].dtype}")
        
        print(f"\nData sample (first 3 records):")
        print(df.head(3).to_string())
        
        # Check for missing values
        print(f"\nMissing values by column:")
        missing_data = df.isnull().sum()
        for col, count in missing_data.items():
            if count > 0:
                print(f"  - {col}: {count} missing values")
    
    print("\n" + "="*50)
    print("NOTE: This data requires master data matching and manual review")
    print("as per established rules before final processing.")
    print("="*50)

def main():
    file_path = "/Users/kashyapanand/Desktop/EXPORT/KEA2024.xlsx"
    
    print("Starting KEA2024 Counselling Data Import")
    print("-" * 40)
    
    # Load data
    original_df = load_counselling_data(file_path)
    if original_df is None:
        print("Failed to load data. Exiting.")
        sys.exit(1)
    
    # Normalize data
    normalized_df = normalize_data(original_df)
    
    # Detect duplicates
    duplicate_count = detect_duplicates(normalized_df)
    
    # Generate report
    generate_import_report(normalized_df, original_df, duplicate_count, file_path)
    
    # Save processed data
    output_file = "kea2024_processed.csv"
    if normalized_df is not None:
        normalized_df.to_csv(output_file, index=False)
        print(f"\nProcessed data saved to: {output_file}")
    
    print("\nImport process completed.")

if __name__ == "__main__":
    main()