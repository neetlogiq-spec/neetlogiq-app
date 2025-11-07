#!/usr/bin/env python3
"""
Comprehensive College Import System
Handles multiple data types:
1. Master Data: STATE, COLLEGE/INSTITUTE, ADDRESS
2. College/Course Data: STATE, COLLEGE/INSTITUTE, ADDRESS, MANAGEMENT, UNIVERSITY_AFFILIATION, COURSE, SEATS
3. Counselling Data: STATE, COLLEGE/INSTITUTE, YEAR, ROUND, COURSE, QUOTA, CATEGORY, ALL_INDIA_RANK

Supports both hierarchical (pivot table) and flat formats
Integrates with master data for normalization
Follows user rules: STATE + COLLEGE + ADDRESS = UNIQUE
"""

import pandas as pd
import os
from typing import List, Dict, Tuple, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import json
from enum import Enum

from hierarchical_data_parser import HierarchicalDataParser, HierarchicalRecord
from flat_format_reader import FlatFormatReader, FlatRecord
from master_data_integration import MasterDataIntegration


class DataType(Enum):
    MASTER = "master"
    COLLEGE_COURSE = "college_course"
    COUNSELLING = "counselling"
    UNKNOWN = "unknown"


@dataclass
class ImportResult:
    """Result of import operation"""
    success: bool
    data_type: DataType
    total_records: int
    processed_records: int
    errors: List[str]
    warnings: List[str]
    data: Optional[pd.DataFrame] = None
    audit_report: Optional[str] = None
    validation_results: Optional[Dict] = None


class ComprehensiveImportSystem:
    """
    Comprehensive import system for all college data types
    
    Data Types Supported:
    1. Master Data - Reference data for normalization
    2. College/Course Data - College information with courses and seats
    3. Counselling Data - Admission data with ranks and quotas
    
    Key Features:
    - Auto-detection of data type and format
    - Hierarchical and flat format support
    - Master data integration and normalization
    - Unique identifier validation (STATE + COLLEGE + ADDRESS = UNIQUE)
    - Comprehensive audit trails
    """
    
    def __init__(self, master_mappings_file: str = "data/master-mappings.csv"):
        self.hierarchical_parser = HierarchicalDataParser()
        self.flat_reader = FlatFormatReader()
        self.master_integration = MasterDataIntegration(master_mappings_file)
        
        # Define expected columns for each data type
        self.data_type_columns = {
            DataType.MASTER: ['STATE', 'COLLEGE', 'ADDRESS'],
            DataType.COLLEGE_COURSE: ['STATE', 'COLLEGE', 'ADDRESS', 'MANAGEMENT', 'UNIVERSITY_AFFILIATION', 'COURSE', 'SEATS'],
            DataType.COUNSELLING: ['STATE', 'COLLEGE', 'YEAR', 'ROUND', 'COURSE', 'QUOTA', 'CATEGORY', 'ALL_INDIA_RANK']
        }
    
    def detect_data_type(self, df: pd.DataFrame) -> DataType:
        """
        Detect the type of data based on column structure
        """
        if df.empty:
            return DataType.UNKNOWN
        
        # Normalize column names for comparison
        columns = [str(col).upper().strip() for col in df.columns]
        
        # Check for counselling data indicators
        counselling_indicators = ['YEAR', 'ROUND', 'QUOTA', 'CATEGORY', 'ALL_INDIA_RANK', 'RANK']
        has_counselling_cols = sum(1 for indicator in counselling_indicators 
                                 for col in columns if indicator in col)
        
        if has_counselling_cols >= 2:
            return DataType.COUNSELLING
        
        # Check for college/course data indicators
        course_indicators = ['MANAGEMENT', 'UNIVERSITY', 'AFFILIATION', 'COURSE', 'SEATS']
        has_course_cols = sum(1 for indicator in course_indicators 
                            for col in columns if indicator in col)
        
        if has_course_cols >= 2:
            return DataType.COLLEGE_COURSE
        
        # Check for basic master data structure
        basic_indicators = ['STATE', 'COLLEGE', 'ADDRESS']
        has_basic_cols = sum(1 for indicator in basic_indicators 
                           for col in columns if indicator in col)
        
        if has_basic_cols >= 2:
            return DataType.MASTER
        
        return DataType.UNKNOWN
    
    def detect_format(self, file_path: str, sheet_name: str = None) -> Tuple[str, DataType, Dict]:
        """
        Detect format (hierarchical/flat) and data type
        Returns (format_type, data_type, analysis_info)
        """
        try:
            xl_file = pd.ExcelFile(file_path)
            
            if sheet_name:
                if sheet_name not in xl_file.sheet_names:
                    return 'error', DataType.UNKNOWN, {'error': f'Sheet {sheet_name} not found'}
                sheets_to_check = [sheet_name]
            else:
                sheets_to_check = xl_file.sheet_names
            
            analysis_info = {}
            
            for sheet in sheets_to_check:
                df = pd.read_excel(file_path, sheet_name=sheet, nrows=50)
                
                # Detect data type
                data_type = self.detect_data_type(df)
                
                analysis = {
                    'rows': len(df),
                    'columns': len(df.columns),
                    'column_names': list(df.columns),
                    'data_type': data_type,
                    'format_type': 'unknown',
                    'confidence': 0.0
                }
                
                # Check for flat format indicators
                col_names_upper = [str(col).upper() for col in df.columns]
                has_state_col = any('STATE' in col for col in col_names_upper)
                has_college_col = any(any(keyword in col for keyword in ['COLLEGE', 'INSTITUTE']) for col in col_names_upper)
                has_address_col = any(any(keyword in col for keyword in ['ADDRESS', 'LOCATION', 'CITY']) for col in col_names_upper)
                
                if has_state_col and has_college_col and len(df.columns) >= 3:
                    analysis['format_type'] = 'flat'
                    analysis['confidence'] = 0.9
                
                # Check for hierarchical format indicators
                elif len(df.columns) == 1 or (len(df.columns) <= 3 and df.iloc[:, 0].notna().sum() > (df.iloc[:, 1].notna().sum() if len(df.columns) > 1 else 0)):
                    first_col_values = df.iloc[:, 0].dropna().astype(str).str.upper()
                    
                    # Look for hierarchy patterns
                    has_category = any(cat in first_col_values.values for cat in ['DENTAL', 'MEDICAL', 'ENGINEERING'])
                    has_states = any(any(pattern in val for pattern in ['PRADESH', 'NADU', 'DELHI', 'GUJARAT']) for val in first_col_values.values)
                    has_colleges = any('COLLEGE' in val or 'INSTITUTE' in val for val in first_col_values.values)
                    
                    if (has_category or has_states) and has_colleges:
                        analysis['format_type'] = 'hierarchical'
                        analysis['confidence'] = 0.8
                
                analysis_info[sheet] = analysis
            
            # Return best match
            if sheet_name:
                sheet_analysis = analysis_info[sheet_name]
                return sheet_analysis['format_type'], sheet_analysis['data_type'], analysis_info
            else:
                best_sheet = max(analysis_info.keys(), 
                               key=lambda s: analysis_info[s].get('confidence', 0))
                best_analysis = analysis_info[best_sheet]
                return best_analysis['format_type'], best_analysis['data_type'], analysis_info
                
        except Exception as e:
            return 'error', DataType.UNKNOWN, {'error': str(e)}
    
    def validate_data_structure(self, df: pd.DataFrame, data_type: DataType) -> Dict:
        """
        Validate that the data structure matches expected format for data type
        """
        validation = {
            'is_valid': False,
            'missing_columns': [],
            'unexpected_columns': [],
            'structure_score': 0.0,
            'recommendations': []
        }
        
        if data_type == DataType.UNKNOWN:
            validation['recommendations'].append("Unable to determine data type - please verify column structure")
            return validation
        
        expected_cols = self.data_type_columns.get(data_type, [])
        actual_cols = [str(col).upper().strip() for col in df.columns]
        
        # Find missing required columns
        for expected_col in expected_cols:
            if not any(expected_col in actual_col for actual_col in actual_cols):
                validation['missing_columns'].append(expected_col)
        
        # Calculate structure score
        matched_cols = len(expected_cols) - len(validation['missing_columns'])
        validation['structure_score'] = matched_cols / len(expected_cols) if expected_cols else 0.0
        
        # Validation passes if we have core columns (STATE, COLLEGE)
        core_cols = ['STATE', 'COLLEGE']
        has_core = all(any(core in actual for actual in actual_cols) for core in core_cols)
        
        validation['is_valid'] = has_core and validation['structure_score'] >= 0.5
        
        if not validation['is_valid']:
            if not has_core:
                validation['recommendations'].append("Missing core columns: STATE and COLLEGE/INSTITUTE are required")
            if validation['structure_score'] < 0.5:
                validation['recommendations'].append(f"Data structure mismatch for {data_type.value} type")
        
        return validation
    
    def import_data(self, file_path: str, sheet_name: str = None, force_format: str = None, force_data_type: DataType = None) -> ImportResult:
        """
        Import data with auto-detection of format and data type
        """
        try:
            if not os.path.exists(file_path):
                return ImportResult(
                    success=False,
                    data_type=DataType.UNKNOWN,
                    total_records=0,
                    processed_records=0,
                    errors=[f"File not found: {file_path}"],
                    warnings=[]
                )
            
            print(f"\n=== COMPREHENSIVE COLLEGE IMPORT SYSTEM ===")
            print(f"File: {file_path}")
            print(f"Sheet: {sheet_name or 'auto-detect'}")
            
            # Detect format and data type
            if force_format and force_data_type:
                detected_format = force_format
                detected_data_type = force_data_type
                print(f"Format: {detected_format} (forced)")
                print(f"Data Type: {detected_data_type.value} (forced)")
            else:
                detected_format, detected_data_type, format_info = self.detect_format(file_path, sheet_name)
                print(f"Format detected: {detected_format}")
                print(f"Data type detected: {detected_data_type.value}")
                
                if detected_format == 'error':
                    return ImportResult(
                        success=False,
                        data_type=DataType.UNKNOWN,
                        total_records=0,
                        processed_records=0,
                        errors=[f"Error detecting format: {format_info.get('error', 'Unknown error')}"],
                        warnings=[]
                    )
            
            # Import based on detected format
            if detected_format == 'hierarchical':
                result = self.import_hierarchical_data(file_path, sheet_name or 'Sheet2')
            elif detected_format == 'flat':
                result = self.import_flat_data(file_path, sheet_name)
            else:
                return ImportResult(
                    success=False,
                    data_type=DataType.UNKNOWN,
                    total_records=0,
                    processed_records=0,
                    errors=[f"Unknown or unsupported format: {detected_format}"],
                    warnings=[]
                )
            
            # Update result with detected data type
            result.data_type = detected_data_type
            
            # Validate data structure if import was successful
            if result.success and result.data is not None:
                structure_validation = self.validate_data_structure(result.data, detected_data_type)
                
                if not structure_validation['is_valid']:
                    result.warnings.extend(structure_validation['recommendations'])
                    result.warnings.append(f"Data structure validation failed (score: {structure_validation['structure_score']:.2f})")
            
            return result
                
        except Exception as e:
            return ImportResult(
                success=False,
                data_type=DataType.UNKNOWN,
                total_records=0,
                processed_records=0,
                errors=[f"Unexpected error during import: {str(e)}"],
                warnings=[]
            )
    
    def import_hierarchical_data(self, file_path: str, sheet_name: str = 'Sheet2') -> ImportResult:
        """Import data from hierarchical format"""
        try:
            print(f"Importing hierarchical data from {file_path}, sheet: {sheet_name}")
            
            records = self.hierarchical_parser.parse_hierarchical_data(file_path, sheet_name)
            
            if not records:
                return ImportResult(
                    success=False,
                    data_type=DataType.UNKNOWN,
                    total_records=0,
                    processed_records=0,
                    errors=["No records found in hierarchical format"],
                    warnings=[]
                )
            
            df = self.hierarchical_parser.convert_to_flat_format(records)
            validation = self.hierarchical_parser.validate_unique_identifiers(df)
            
            df_normalized, audit_results = self.master_integration.normalize_dataframe(df)
            audit_report = self.master_integration.generate_audit_report(audit_results)
            
            warnings = []
            if not validation['validation_passed']:
                warnings.append(f"Found {validation['statistics']['duplicate_count']} duplicate records")
            
            if audit_results['new_data_for_review']:
                warnings.append(f"Found {len(audit_results['new_data_for_review'])} new items requiring manual review")
            
            return ImportResult(
                success=True,
                data_type=DataType.UNKNOWN,  # Will be updated by caller
                total_records=len(records),
                processed_records=len(df_normalized),
                errors=[],
                warnings=warnings,
                data=df_normalized,
                audit_report=audit_report,
                validation_results=validation
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                data_type=DataType.UNKNOWN,
                total_records=0,
                processed_records=0,
                errors=[f"Error importing hierarchical data: {str(e)}"],
                warnings=[]
            )
    
    def import_flat_data(self, file_path: str, sheet_name: str = None) -> ImportResult:
        """Import data from flat format"""
        try:
            print(f"Importing flat data from {file_path}, sheet: {sheet_name or 'default'}")
            
            df, quality_validation = self.flat_reader.read_flat_data(file_path, sheet_name)
            
            if df.empty:
                return ImportResult(
                    success=False,
                    data_type=DataType.UNKNOWN,
                    total_records=0,
                    processed_records=0,
                    errors=["No valid records found in flat format"],
                    warnings=[]
                )
            
            validation = self.flat_reader.validate_unique_identifiers(df)
            
            df_normalized, audit_results = self.master_integration.normalize_dataframe(df)
            audit_report = self.master_integration.generate_audit_report(audit_results)
            
            warnings = []
            if quality_validation['issues']:
                warnings.extend(quality_validation['issues'])
            
            if not validation['validation_passed']:
                warnings.append(f"Found {validation['statistics']['duplicate_count']} duplicate records")
            
            if audit_results['new_data_for_review']:
                warnings.append(f"Found {len(audit_results['new_data_for_review'])} new items requiring manual review")
            
            return ImportResult(
                success=True,
                data_type=DataType.UNKNOWN,  # Will be updated by caller
                total_records=quality_validation['total_records'],
                processed_records=len(df_normalized),
                errors=[],
                warnings=warnings,
                data=df_normalized,
                audit_report=audit_report,
                validation_results=validation
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                data_type=DataType.UNKNOWN,
                total_records=0,
                processed_records=0,
                errors=[f"Error importing flat data: {str(e)}"],
                warnings=[]
            )
    
    def save_results(self, result: ImportResult, output_dir: str = "output") -> Dict[str, str]:
        """Save import results to files"""
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        data_type_suffix = result.data_type.value if result.data_type != DataType.UNKNOWN else "unknown"
        
        saved_files = {}
        
        try:
            if result.data is not None:
                # Save main data
                data_file = os.path.join(output_dir, f"{data_type_suffix}_data_{timestamp}.csv")
                result.data.to_csv(data_file, index=False)
                saved_files['data'] = data_file
                
                # Save normalized data separately
                normalized_cols = [col for col in result.data.columns 
                                 if 'NORMALIZED' in col or col in ['STATE', 'COLLEGE', 'ADDRESS', 'CATEGORY']]
                if normalized_cols:
                    normalized_file = os.path.join(output_dir, f"{data_type_suffix}_normalized_{timestamp}.csv")
                    result.data[normalized_cols].to_csv(normalized_file, index=False)
                    saved_files['normalized'] = normalized_file
            
            # Save audit report
            if result.audit_report:
                audit_file = os.path.join(output_dir, f"{data_type_suffix}_audit_{timestamp}.txt")
                with open(audit_file, 'w') as f:
                    f.write(result.audit_report)
                saved_files['audit'] = audit_file
            
            # Save validation results
            if result.validation_results:
                validation_file = os.path.join(output_dir, f"{data_type_suffix}_validation_{timestamp}.json")
                validation_json = {}
                for key, value in result.validation_results.items():
                    if key == 'statistics':
                        validation_json[key] = {k: int(v) if hasattr(v, 'dtype') else v for k, v in value.items()}
                    elif key == 'duplicates':
                        validation_json[key] = value.to_dict('records') if hasattr(value, 'to_dict') else str(value)
                    else:
                        validation_json[key] = value
                
                with open(validation_file, 'w') as f:
                    json.dump(validation_json, f, indent=2)
                saved_files['validation'] = validation_file
                
        except Exception as e:
            print(f"Error saving results: {e}")
            
        return saved_files
    
    def generate_summary_report(self, result: ImportResult) -> str:
        """Generate comprehensive summary report"""
        report = []
        report.append("\n" + "=" * 70)
        report.append("COMPREHENSIVE COLLEGE DATA IMPORT SUMMARY")
        report.append("=" * 70)
        report.append(f"Data Type: {result.data_type.value.upper()}")
        report.append(f"Import Status: {'SUCCESS' if result.success else 'FAILED'}")
        report.append(f"Total Records: {result.total_records}")
        report.append(f"Processed Records: {result.processed_records}")
        report.append(f"Processing Rate: {(result.processed_records/result.total_records*100):.1f}%" if result.total_records > 0 else "N/A")
        
        if result.errors:
            report.append(f"\nERRORS ({len(result.errors)}):")
            for error in result.errors:
                report.append(f"  • {error}")
        
        if result.warnings:
            report.append(f"\nWARNINGS ({len(result.warnings)}):")
            for warning in result.warnings:
                report.append(f"  • {warning}")
        
        if result.validation_results:
            stats = result.validation_results.get('statistics', {})
            report.append(f"\nDATA VALIDATION:")
            report.append(f"  Unique Identifiers: {stats.get('unique_identifiers', 'N/A')}")
            report.append(f"  Unique States: {stats.get('unique_states', 'N/A')}")
            report.append(f"  Unique Colleges: {stats.get('unique_colleges', 'N/A')}")
            report.append(f"  Validation Status: {'PASSED' if result.validation_results.get('validation_passed', False) else 'FAILED'}")
        
        if result.audit_report:
            report.append(f"\nMASTER DATA NORMALIZATION:")
            report.append("  (See detailed audit report for complete analysis)")
        
        report.append("\n" + "=" * 70)
        report.append(f"Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 70)
        
        return "\n".join(report)


if __name__ == "__main__":
    # Test the comprehensive import system
    import_system = ComprehensiveImportSystem()
    
    # Test with dental file
    test_file = "/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental ad.xlsx"
    
    print("=== TESTING COMPREHENSIVE IMPORT SYSTEM ===")
    
    # Test format and data type detection
    format_type, data_type, format_info = import_system.detect_format(test_file)
    print(f"Detected format: {format_type}")
    print(f"Detected data type: {data_type.value}")
    print(f"Format analysis: {format_info}")
    
    # Test full import
    result = import_system.import_data(test_file)
    
    # Display results
    summary = import_system.generate_summary_report(result)
    print(summary)
    
    if result.success and result.data is not None:
        # Save results
        saved_files = import_system.save_results(result)
        print(f"\nSaved files: {saved_files}")
        
        # Show data preview
        print(f"\nData Preview ({result.data_type.value}):")
        print(f"Shape: {result.data.shape}")
        print(f"Columns: {list(result.data.columns)}")
        print("\nFirst 5 records:")
        display_cols = ['STATE', 'COLLEGE', 'ADDRESS', 'CATEGORY']
        available_cols = [col for col in display_cols if col in result.data.columns]
        print(result.data[available_cols].head())