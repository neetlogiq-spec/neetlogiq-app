#!/usr/bin/env python3
"""
Hierarchical Data Parser for College Import System
Handles pivot table format with hierarchical structure: Category -> State -> College -> Address
"""

import pandas as pd
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class HierarchyLevel(Enum):
    CATEGORY = "category"
    STATE = "state" 
    COLLEGE = "college"
    ADDRESS = "address"
    UNKNOWN = "unknown"


@dataclass
class HierarchicalRecord:
    """Represents a parsed record from hierarchical data"""
    category: str
    state: str
    college: str
    address: str
    row_number: int
    confidence: float = 1.0
    issues: List[str] = None
    
    def __post_init__(self):
        if self.issues is None:
            self.issues = []


class HierarchicalDataParser:
    """
    Parses hierarchical/pivot table format data where:
    - Category (DENTAL, MEDICAL, etc.)
    - State (ANDHRA PRADESH, GUJARAT, etc.)
    - College (college names with COLLEGE, INSTITUTE, UNIVERSITY keywords)
    - Address (location names)
    
    Follows the rule: STATE + COLLEGE + ADDRESS = UNIQUE
    """
    
    def __init__(self):
        self.state_patterns = [
            'PRADESH', 'NADU', 'BENGAL', 'DELHI', 'MUMBAI', 'GUJARAT', 
            'MAHARASHTRA', 'KARNATAKA', 'KERALA', 'PUNJAB', 'HARYANA',
            'RAJASTHAN', 'BIHAR', 'JHARKHAND', 'ODISHA', 'ASSAM',
            'TRIPURA', 'MANIPUR', 'MIZORAM', 'NAGALAND', 'MEGHALAYA',
            'SIKKIM', 'ARUNACHAL', 'GOA', 'HIMACHAL', 'UTTARAKHAND',
            'CHHATTISGARH', 'TELANGANA', 'JAMMU', 'KASHMIR', 'CHANDIGARH',
            'PONDICHERRY', 'PUDUCHERRY', 'LAKSHADWEEP', 'ANDAMAN',
            'DADRA', 'NAGAR', 'HAVELI', 'DAMAN', 'DIU'
        ]
        
        self.college_keywords = [
            'COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'SCHOOL', 'ACADEMY',
            'FOUNDATION', 'CENTRE', 'CENTER', 'MEDICAL', 'DENTAL',
            'ENGINEERING', 'MANAGEMENT', 'HOSPITAL'
        ]
        
        self.category_keywords = ['DENTAL', 'MEDICAL', 'ENGINEERING', 'MANAGEMENT']
    
    def detect_hierarchy_level(self, value: str) -> Tuple[HierarchyLevel, float]:
        """
        Detect the hierarchy level of a given value
        Returns (level, confidence_score)
        """
        if not value or pd.isna(value):
            return HierarchyLevel.UNKNOWN, 0.0
            
        value = str(value).strip().upper()
        
        # Category detection - must be exact match
        if value in self.category_keywords:
            return HierarchyLevel.CATEGORY, 1.0
        
        # State detection - ONLY exact state names to avoid confusion
        exact_states = {
            'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
            'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND', 
            'KARNATAKA', 'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR',
            'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'ORISSA', 'PUNJAB', 'RAJASTHAN',
            'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH',
            'UTTARAKHAND', 'UTTRAKHAND', 'WEST BENGAL', 'DELHI', 'JAMMU & KASHMIR', 
            'LADAKH', 'CHANDIGARH', 'DADRA & NAGAR HAVELI', 'DAMAN & DIU', 'LAKSHADWEEP',
            'PUDUCHERRY', 'ANDAMAN & NICOBAR ISLANDS', 'PONDICHERRY', 'NEW DELHI'
        }
        
        # Check for exact state match ONLY - be very strict
        if value in exact_states:
            return HierarchyLevel.STATE, 1.0
        
        # College detection - look for college keywords
        college_matches = sum(1 for keyword in self.college_keywords if keyword in value)
        if college_matches > 0:
            confidence = min(0.9, 0.7 + (college_matches * 0.05))
            return HierarchyLevel.COLLEGE, confidence
        
        # Everything else is considered an address (including cities that might contain state-like words)
        # This is safer than trying to detect addresses, since addresses can be anything
        return HierarchyLevel.ADDRESS, 0.6
    
    def parse_hierarchical_data(self, file_path: str, sheet_name: str = 'Sheet2') -> List[HierarchicalRecord]:
        """
        Parse hierarchical data from Excel sheet using improved algorithm
        
        Args:
            file_path: Path to Excel file
            sheet_name: Name of sheet containing hierarchical data
            
        Returns:
            List of HierarchicalRecord objects
        """
        try:
            # Read the sheet without headers
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
            
            records = []
            current_category = ""
            current_state = ""
            i = 0
            
            # Define metadata entries to skip
            metadata_entries = {
                'DENTAL', 'MEDICAL', 'ENGINEERING', 'MANAGEMENT',
                'GRAND TOTAL', 'TOTAL', 'SUB TOTAL', 'SUBTOTAL'
            }
            
            while i < len(df):
                value = df.iloc[i, 0]
                
                # Skip empty rows
                if pd.isna(value) or not str(value).strip():
                    i += 1
                    continue
                
                value_str = str(value).strip().upper()
                
                # Skip metadata entries that should not be records
                if value_str in metadata_entries:
                    if value_str in ['DENTAL', 'MEDICAL', 'ENGINEERING', 'MANAGEMENT']:
                        current_category = value_str
                        current_state = ""
                    i += 1
                    continue
                    
                level, confidence = self.detect_hierarchy_level(value_str)
                
                if level == HierarchyLevel.CATEGORY:
                    current_category = value_str
                    current_state = ""
                    i += 1
                    
                elif level == HierarchyLevel.STATE:
                    current_state = value_str
                    i += 1
                    
                elif level == HierarchyLevel.COLLEGE:
                    current_college = value_str
                    
                    # Look ahead for addresses after this college
                    addresses = []
                    j = i + 1
                    
                    while j < len(df):
                        next_value = df.iloc[j, 0]
                        
                        # Handle empty rows - these could be blank addresses (unknown location)
                        if pd.isna(next_value) or not str(next_value).strip():
                            # Check if this is a meaningful empty address or just formatting
                            # Look ahead to see if there's more content
                            has_more_content = False
                            for k in range(j + 1, min(j + 3, len(df))):
                                if pd.notna(df.iloc[k, 0]) and str(df.iloc[k, 0]).strip():
                                    has_more_content = True
                                    break
                            
                            if not has_more_content:
                                # This seems to be the end, might be a blank address
                                addresses.append('')  # Unknown location
                                j += 1
                                break
                            else:
                                j += 1
                                continue
                        
                        next_str = str(next_value).strip().upper()
                        
                        # Skip metadata entries
                        if next_str in metadata_entries:
                            j += 1
                            continue
                            
                        next_level, _ = self.detect_hierarchy_level(next_str)
                        
                        # If we hit another category, state, or college, stop
                        if next_level in [HierarchyLevel.CATEGORY, HierarchyLevel.STATE, HierarchyLevel.COLLEGE]:
                            break
                        
                        # This is an address (including blank ones)
                        if next_str == '(BLANK)' or next_str == 'BLANK' or not next_str:
                            addresses.append('')  # Unknown location
                        else:
                            addresses.append(next_str)
                        j += 1
                    
                    # Only create records if we have valid category and state context
                    if current_category and current_state:
                        # Create records for this college with all its addresses
                        if not addresses:
                            # No addresses found, create record with empty address
                            issues = ["No address found for college"]
                            record = HierarchicalRecord(
                                category=current_category,
                                state=current_state,
                                college=current_college,
                                address="",
                                row_number=i + 1,
                                confidence=confidence,
                                issues=issues
                            )
                            records.append(record)
                        else:
                            # Create a record for each address
                            for addr in addresses:
                                issues = []
                                if not addr:
                                    issues.append("Empty address")
                                
                                record = HierarchicalRecord(
                                    category=current_category,
                                    state=current_state,
                                    college=current_college,
                                    address=addr,
                                    row_number=i + 1,
                                    confidence=confidence,
                                    issues=issues
                                )
                                records.append(record)
                    
                    # Skip to after the addresses we processed
                    i = j
                else:
                    # Unknown level, skip
                    i += 1
            
            return records
            
        except Exception as e:
            raise Exception(f"Error parsing hierarchical data: {str(e)}")
    
    def convert_to_flat_format(self, records: List[HierarchicalRecord]) -> pd.DataFrame:
        """
        Convert hierarchical records to flat DataFrame format
        """
        data = []
        for record in records:
            data.append({
                'CATEGORY': record.category,
                'STATE': record.state,
                'COLLEGE': record.college,
                'ADDRESS': record.address,
                'SOURCE_ROW': record.row_number,
                'CONFIDENCE': record.confidence,
                'ISSUES': '; '.join(record.issues) if record.issues else ''
            })
        
        return pd.DataFrame(data)
    
    def validate_unique_identifiers(self, df: pd.DataFrame) -> Dict[str, any]:
        """
        Validate the STATE + COLLEGE + ADDRESS = UNIQUE rule
        """
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


def parse_book2_hierarchical(file_path):
    """
    Parse Book2.xlsx format ignoring first and last rows/cells
    This is a cleaner hierarchical format without metadata interference
    """
    df = pd.read_excel(file_path, sheet_name=0, header=None)
    
    # Ignore first row (index 0) and last row (index -1)
    df = df.iloc[1:-1]  # This removes first and last rows
    
    # Define exact states
    exact_states = {
        'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
        'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND', 
        'KARNATAKA', 'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR',
        'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'ORISSA', 'PUNJAB', 'RAJASTHAN',
        'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH',
        'UTTARAKHAND', 'UTTRAKHAND', 'WEST BENGAL', 'DELHI', 'JAMMU & KASHMIR', 
        'LADAKH', 'CHANDIGARH', 'DADRA & NAGAR HAVELI', 'DAMAN & DIU', 'LAKSHADWEEP',
        'PUDUCHERRY', 'ANDAMAN & NICOBAR ISLANDS', 'PONDICHERRY', 'NEW DELHI'
    }
    
    college_keywords = ['COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'SCHOOL', 'ACADEMY', 
                       'FOUNDATION', 'CENTRE', 'CENTER', 'MEDICAL', 'DENTAL', 'HOSPITAL']
    
    current_state = ''
    records = []
    i = 0
    
    # Reset index after slicing
    df = df.reset_index(drop=True)
    
    while i < len(df):
        value = df.iloc[i, 0]
        
        # Skip empty cells
        if pd.isna(value) or not str(value).strip():
            i += 1
            continue
            
        value_str = str(value).strip().upper()
        
        # Check if this is a state
        if value_str in exact_states:
            current_state = value_str
            i += 1
            continue
        
        # Check if this is a college
        has_college_keywords = any(keyword in value_str for keyword in college_keywords)
        if has_college_keywords and current_state:
            current_college = value_str
            
            # Look for addresses immediately following
            addresses = []
            j = i + 1
            
            while j < len(df):
                next_value = df.iloc[j, 0]
                
                # Skip empty cells
                if pd.isna(next_value) or not str(next_value).strip():
                    j += 1
                    continue
                    
                next_str = str(next_value).strip().upper()
                
                # Stop if we hit another state
                if next_str in exact_states:
                    break
                    
                # Stop if we hit another college
                if any(kw in next_str for kw in college_keywords):
                    break
                    
                # This is an address
                addresses.append(next_str)
                j += 1
            
            # Create records
            if not addresses:
                # No address found - unknown location
                records.append({
                    'STATE': current_state,
                    'COLLEGE': current_college,
                    'ADDRESS': ''
                })
            else:
                for addr in addresses:
                    records.append({
                        'STATE': current_state,
                        'COLLEGE': current_college,
                        'ADDRESS': addr
                    })
            
            # Move to next position after addresses
            i = j
        else:
            i += 1
    
    return pd.DataFrame(records)


if __name__ == "__main__":
    # Test with Book2.xlsx
    try:
        file_path = "/Users/kashyapanand/Desktop/EXPORT/Book2.xlsx"
        book2_df = parse_book2_hierarchical(file_path)
        
        print(f"Parsed {len(book2_df)} records from Book2 hierarchical format")
        print(f"Unique states: {book2_df['STATE'].nunique()}")
        print(f"Unique colleges: {book2_df['COLLEGE'].nunique()}")
        
        # Create unique identifier
        book2_df['UNIQUE_ID'] = book2_df['STATE'] + ' | ' + book2_df['COLLEGE'] + ' | ' + book2_df['ADDRESS']
        print(f"Unique identifiers: {book2_df['UNIQUE_ID'].nunique()}")
        
        # Show first few records
        print(f"\nFirst 5 records:")
        for i in range(min(5, len(book2_df))):
            row = book2_df.iloc[i]
            print(f"  {row['STATE']} | {row['COLLEGE']} | {row['ADDRESS']}")
            
    except Exception as e:
        print(f"Error: {e}")
