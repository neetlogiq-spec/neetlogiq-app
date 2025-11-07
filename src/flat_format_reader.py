#!/usr/bin/env python3
"""
Flat Format Reader for College Import System
Handles standard Excel sheets with columns: STATE, COLLEGE/INSTITUTE, ADDRESS
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class FlatRecord:
    """Represents a record from flat format data"""
    state: str
    college: str
    address: str
    category: str = ""
    row_number: int = 0
    issues: List[str] = None
    
    def __post_init__(self):
        if self.issues is None:
            self.issues = []


class FlatFormatReader:
    """
    Reads flat format data where each row contains:
    - STATE: State name
    - COLLEGE/INSTITUTE: College name
    - ADDRESS: Address/Location
    
    Follows the rule: STATE + COLLEGE + ADDRESS = UNIQUE
    """
    
    def __init__(self):
        self.expected_columns = [
            'STATE', 'COLLEGE', 'INSTITUTE', 'ADDRESS', 'LOCATION', 'CITY'
        ]
        
    def detect_column_mapping(self, df: pd.DataFrame) -> Dict[str, str]:
        """
        Auto-detect which columns map to STATE, COLLEGE, ADDRESS
        """
        columns = [col.upper().strip() for col in df.columns]
        mapping = {}
        
        # State column detection
        for col in columns:
            if any(keyword in col for keyword in ['STATE', 'PROVINCIA', 'REGION']):
                mapping['state'] = col
                break
        
        # College column detection
        for col in columns:
            if any(keyword in col for keyword in ['COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'SCHOOL']):
                mapping['college'] = col
                break
        
        # Address column detection
        for col in columns:
            if any(keyword in col for keyword in ['ADDRESS', 'LOCATION', 'CITY', 'PLACE']):
                mapping['address'] = col
                break
        
        return mapping
    
    def standardize_column_names(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Standardize column names to STATE, COLLEGE, ADDRESS
        """
        df_copy = df.copy()
        
        # Auto-detect column mapping
        mapping = self.detect_column_mapping(df_copy)
        
        # If auto-detection failed, try positional mapping
        if len(mapping) < 3:
            columns = list(df_copy.columns)
            if len(columns) >= 3:
                mapping = {
                    'state': columns[0],
                    'college': columns[1], 
                    'address': columns[2]
                }
        
        # Rename columns
        if 'state' in mapping:
            df_copy = df_copy.rename(columns={mapping['state']: 'STATE'})
        if 'college' in mapping:
            df_copy = df_copy.rename(columns={mapping['college']: 'COLLEGE'})
        if 'address' in mapping:
            df_copy = df_copy.rename(columns={mapping['address']: 'ADDRESS'})
            
        return df_copy
    
    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and standardize the data
        """
        df_clean = df.copy()
        
        # Convert to uppercase and strip whitespace
        for col in ['STATE', 'COLLEGE', 'ADDRESS']:
            if col in df_clean.columns:
                df_clean[col] = df_clean[col].astype(str).str.upper().str.strip()
                
        # Replace 'NAN' strings with actual NaN
        df_clean = df_clean.replace(['NAN', 'NONE', 'NULL', ''], np.nan)
        
        # Remove rows where all main columns are empty
        df_clean = df_clean.dropna(subset=['STATE', 'COLLEGE'], how='all')
        
        return df_clean
    
    def validate_data_quality(self, df: pd.DataFrame) -> Dict[str, any]:
        """
        Validate data quality and identify issues
        """
        issues = []
        
        # Check for required columns
        required_cols = ['STATE', 'COLLEGE', 'ADDRESS']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            issues.append(f"Missing required columns: {missing_cols}")
        
        # Check for empty values
        empty_states = df['STATE'].isna().sum() if 'STATE' in df.columns else 0
        empty_colleges = df['COLLEGE'].isna().sum() if 'COLLEGE' in df.columns else 0
        empty_addresses = df['ADDRESS'].isna().sum() if 'ADDRESS' in df.columns else 0
        
        if empty_states > 0:
            issues.append(f"{empty_states} records with missing STATE")
        if empty_colleges > 0:
            issues.append(f"{empty_colleges} records with missing COLLEGE")
        if empty_addresses > 0:
            issues.append(f"{empty_addresses} records with missing ADDRESS")
        
        # Check for duplicates
        duplicates = df.duplicated(subset=['STATE', 'COLLEGE', 'ADDRESS'], keep=False)
        duplicate_count = duplicates.sum()
        
        if duplicate_count > 0:
            issues.append(f"{duplicate_count} duplicate records found")
        
        return {
            'total_records': len(df),
            'valid_records': len(df) - empty_states - empty_colleges,
            'empty_states': empty_states,
            'empty_colleges': empty_colleges,
            'empty_addresses': empty_addresses,
            'duplicate_count': duplicate_count,
            'issues': issues,
            'quality_score': max(0, (len(df) - empty_states - empty_colleges - duplicate_count) / len(df)) if len(df) > 0 else 0
        }
    
    def read_flat_data(self, file_path: str, sheet_name: str = None) -> Tuple[pd.DataFrame, Dict]:
        """
        Read flat format data from Excel file
        
        Args:
            file_path: Path to Excel file
            sheet_name: Name of sheet to read (None for first sheet)
            
        Returns:
            Tuple of (DataFrame, validation_results)
        """
        try:
            # Read Excel file
            if sheet_name:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            else:
                df = pd.read_excel(file_path)
            
            # Standardize column names
            df = self.standardize_column_names(df)
            
            # Clean data
            df = self.clean_data(df)
            
            # Add category if not present (infer from filename or default)
            if 'CATEGORY' not in df.columns:
                category = 'UNKNOWN'
                if 'dental' in file_path.lower():
                    category = 'DENTAL'
                elif 'medical' in file_path.lower():
                    category = 'MEDICAL'
                elif 'engineering' in file_path.lower():
                    category = 'ENGINEERING'
                    
                df['CATEGORY'] = category
            
            # Add row numbers for tracking
            df['SOURCE_ROW'] = range(1, len(df) + 1)
            
            # Validate data quality
            validation = self.validate_data_quality(df)
            
            return df, validation
            
        except Exception as e:
            raise Exception(f"Error reading flat format data: {str(e)}")
    
    def convert_to_records(self, df: pd.DataFrame) -> List[FlatRecord]:
        """
        Convert DataFrame to list of FlatRecord objects
        """
        records = []
        
        for idx, row in df.iterrows():
            issues = []
            
            # Check for missing values
            state = str(row.get('STATE', '')).strip() if pd.notna(row.get('STATE')) else ''
            college = str(row.get('COLLEGE', '')).strip() if pd.notna(row.get('COLLEGE')) else ''
            address = str(row.get('ADDRESS', '')).strip() if pd.notna(row.get('ADDRESS')) else ''
            category = str(row.get('CATEGORY', 'UNKNOWN')).strip()
            
            if not state:
                issues.append("Missing state")
            if not college:
                issues.append("Missing college")
            if not address:
                issues.append("Missing address")
            
            record = FlatRecord(
                state=state,
                college=college,
                address=address,
                category=category,
                row_number=row.get('SOURCE_ROW', idx + 1),
                issues=issues
            )
            
            records.append(record)
        
        return records
    
    def validate_unique_identifiers(self, df: pd.DataFrame) -> Dict[str, any]:
        """
        Validate the STATE + COLLEGE + ADDRESS = UNIQUE rule
        """
        if not all(col in df.columns for col in ['STATE', 'COLLEGE', 'ADDRESS']):
            return {'validation_passed': False, 'error': 'Missing required columns'}
        
        # Create unique identifier
        df['UNIQUE_ID'] = df['STATE'] + ' | ' + df['COLLEGE'] + ' | ' + df['ADDRESS']
        
        # Check for duplicates
        duplicates = df[df.duplicated(subset=['STATE', 'COLLEGE', 'ADDRESS'], keep=False)]
        
        # Statistics
        stats = {
            'total_records': len(df),
            'unique_identifiers': df['UNIQUE_ID'].nunique(),
            'duplicate_count': len(duplicates),
            'unique_states': df['STATE'].nunique(),
            'unique_colleges': df['COLLEGE'].nunique(),
            'unique_addresses': df['ADDRESS'].nunique(),
            'colleges_multiple_states': len(df.groupby('COLLEGE')['STATE'].nunique()[df.groupby('COLLEGE')['STATE'].nunique() > 1]),
            'colleges_multiple_addresses': len(df.groupby(['STATE', 'COLLEGE'])['ADDRESS'].nunique()[df.groupby(['STATE', 'COLLEGE'])['ADDRESS'].nunique() > 1])
        }
        
        return {
            'statistics': stats,
            'duplicates': duplicates,
            'validation_passed': len(duplicates) == 0
        }


if __name__ == "__main__":
    # Test with the dental file
    reader = FlatFormatReader()
    
    try:
        file_path = "/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental ad.xlsx"
        
        # Read Sheet1 (flat format)
        df, validation = reader.read_flat_data(file_path, sheet_name='Sheet1')
        
        print(f"Read flat format data: {df.shape}")
        print(f"Columns: {list(df.columns)}")
        
        print(f"\nData quality validation:")
        for key, value in validation.items():
            print(f"  {key}: {value}")
        
        print(f"\nFirst 5 records:")
        print(df.head())
        
        # Convert to records
        records = reader.convert_to_records(df)
        print(f"\nConverted to {len(records)} record objects")
        
        # Show first record details
        if records:
            print(f"First record: {records[0]}")
        
        # Validate unique identifiers
        unique_validation = reader.validate_unique_identifiers(df)
        print(f"\nUnique identifier validation:")
        for key, value in unique_validation['statistics'].items():
            print(f"  {key}: {value}")
        
        if not unique_validation['validation_passed']:
            print(f"\nDuplicates found:")
            print(unique_validation['duplicates'])
            
    except Exception as e:
        print(f"Error: {e}")