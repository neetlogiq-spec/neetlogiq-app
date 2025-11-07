#!/usr/bin/env python3
"""
Comprehensive College Import System
Handles both hierarchical (pivot table) and flat formats
Integrates with master data for normalization
Follows user rules for data processing and validation
"""

import pandas as pd
import os
from typing import List, Dict, Tuple, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import json

from hierarchical_data_parser import HierarchicalDataParser, HierarchicalRecord
from flat_format_reader import FlatFormatReader, FlatRecord
from master_data_integration import MasterDataIntegration


@dataclass
class ImportResult:
    """Result of import operation"""
    success: bool
    total_records: int
    processed_records: int
    errors: List[str]
    warnings: List[str]
    data: Optional[pd.DataFrame] = None
    audit_report: Optional[str] = None
    validation_results: Optional[Dict] = None


class CollegeImportSystem:
    """
    Comprehensive import system for college data
    
    Supports:
    1. Hierarchical format (Category -> State -> College -> Address)
    2. Flat format (STATE, COLLEGE, ADDRESS columns)
    3. Master data integration and normalization
    4. Unique identifier validation (STATE + COLLEGE + ADDRESS = UNIQUE)
    5. Quality validation and error reporting
    6. Audit trails and manual review queues
    """
    
    def __init__(self, master_mappings_file: str = "data/master-mappings.csv"):
        self.hierarchical_parser = HierarchicalDataParser()
        self.flat_reader = FlatFormatReader()
        self.master_integration = MasterDataIntegration(master_mappings_file)
        
    def detect_format(self, file_path: str, sheet_name: str = None) -> Tuple[str, Dict]:
        """
        Detect if the sheet contains hierarchical or flat format data
        Returns (format_type, sheet_info)
        """
        try:
            # Try reading as Excel
            xl_file = pd.ExcelFile(file_path)
            
            if sheet_name:
                if sheet_name not in xl_file.sheet_names:
                    return 'error', {'error': f'Sheet {sheet_name} not found'}
                sheets_to_check = [sheet_name]
            else:
                sheets_to_check = xl_file.sheet_names
            
            format_analysis = {}
            
            for sheet in sheets_to_check:
                df = pd.read_excel(file_path, sheet_name=sheet, nrows=50)  # Sample first 50 rows
                
                analysis = {
                    'rows': len(df),
                    'columns': len(df.columns),
                    'column_names': list(df.columns),
                    'format_type': 'unknown'
                }
                
                # Check for flat format indicators
                col_names_upper = [str(col).upper() for col in df.columns]
                has_state_col = any('STATE' in col for col in col_names_upper)
                has_college_col = any(any(keyword in col for keyword in ['COLLEGE', 'INSTITUTE']) for col in col_names_upper)
                has_address_col = any(any(keyword in col for keyword in ['ADDRESS', 'LOCATION', 'CITY']) for col in col_names_upper)
                
                if has_state_col and has_college_col and (has_address_col or len(df.columns) >= 3):
                    analysis['format_type'] = 'flat'
                    analysis['confidence'] = 0.9
                
                # Check for hierarchical format indicators
                elif len(df.columns) == 1 or (len(df.columns) <= 3 and df.iloc[:, 0].notna().sum() > df.iloc[:, 1].notna().sum() if len(df.columns) > 1 else True):
                    # Single column or first column has most data
                    first_col_values = df.iloc[:, 0].dropna().astype(str).str.upper()
                    
                    # Look for category/hierarchy patterns
                    has_category = any(cat in first_col_values.values for cat in ['DENTAL', 'MEDICAL', 'ENGINEERING'])
                    has_states = any(any(pattern in val for pattern in ['PRADESH', 'NADU', 'DELHI', 'GUJARAT']) for val in first_col_values.values)
                    has_colleges = any('COLLEGE' in val or 'INSTITUTE' in val for val in first_col_values.values)
                    
                    if (has_category or has_states) and has_colleges:
                        analysis['format_type'] = 'hierarchical'
                        analysis['confidence'] = 0.8
                
                format_analysis[sheet] = analysis
            
            # Determine best format
            if sheet_name:
                return format_analysis[sheet_name]['format_type'], format_analysis
            else:
                # Return format with highest confidence
                best_sheet = max(format_analysis.keys(), 
                               key=lambda s: format_analysis[s].get('confidence', 0))
                return format_analysis[best_sheet]['format_type'], format_analysis
                
        except Exception as e:
            return 'error', {'error': str(e)}
    
    def import_hierarchical_data(self, file_path: str, sheet_name: str = 'Sheet2') -> ImportResult:
        """Import data from hierarchical format"""
        try:
            print(f"Importing hierarchical data from {file_path}, sheet: {sheet_name}")
            
            # Parse hierarchical data
            records = self.hierarchical_parser.parse_hierarchical_data(file_path, sheet_name)
            
            if not records:
                return ImportResult(
                    success=False,
                    total_records=0,
                    processed_records=0,
                    errors=["No records found in hierarchical format"],
                    warnings=[]
                )
            
            # Convert to DataFrame
            df = self.hierarchical_parser.convert_to_flat_format(records)
            
            # Validate unique identifiers
            validation = self.hierarchical_parser.validate_unique_identifiers(df)
            
            # Integrate with master data
            df_normalized, audit_results = self.master_integration.normalize_dataframe(df)
            audit_report = self.master_integration.generate_audit_report(audit_results)
            
            warnings = []
            if not validation['validation_passed']:
                warnings.append(f"Found {validation['statistics']['duplicate_count']} duplicate records")
            
            if audit_results['new_data_for_review']:
                warnings.append(f"Found {len(audit_results['new_data_for_review'])} new items requiring manual review")
            
            return ImportResult(
                success=True,
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
                total_records=0,
                processed_records=0,
                errors=[f"Error importing hierarchical data: {str(e)}"],
                warnings=[]
            )
    
    def import_flat_data(self, file_path: str, sheet_name: str = None) -> ImportResult:
        """Import data from flat format"""
        try:
            print(f"Importing flat data from {file_path}, sheet: {sheet_name or 'default'}")
            
            # Read flat data
            df, quality_validation = self.flat_reader.read_flat_data(file_path, sheet_name)
            
            if df.empty:
                return ImportResult(
                    success=False,
                    total_records=0,
                    processed_records=0,
                    errors=["No valid records found in flat format"],
                    warnings=[]
                )
            
            # Validate unique identifiers
            validation = self.flat_reader.validate_unique_identifiers(df)
            
            # Integrate with master data
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
                total_records=0,
                processed_records=0,
                errors=[f"Error importing flat data: {str(e)}"],
                warnings=[]
            )
    
    def import_from_file(self, file_path: str, sheet_name: str = None, force_format: str = None) -> ImportResult:
        """
        Import data from file, auto-detecting format
        
        Args:
            file_path: Path to Excel file
            sheet_name: Specific sheet name (None for auto-detect)
            force_format: Force specific format ('flat' or 'hierarchical')
        """
        try:
            if not os.path.exists(file_path):
                return ImportResult(
                    success=False,
                    total_records=0,
                    processed_records=0,
                    errors=[f"File not found: {file_path}"],
                    warnings=[]
                )
            
            print(f"\\n=== COLLEGE IMPORT SYSTEM ===\")\n            print(f\"File: {file_path}\")\n            print(f\"Sheet: {sheet_name or 'auto-detect'}\")\n            \n            # Detect format if not forced\n            if force_format:\n                detected_format = force_format\n                print(f\"Format: {detected_format} (forced)\")\n            else:\n                detected_format, format_info = self.detect_format(file_path, sheet_name)\n                print(f\"Format detected: {detected_format}\")\n                \n                if detected_format == 'error':\n                    return ImportResult(\n                        success=False,\n                        total_records=0,\n                        processed_records=0,\n                        errors=[f\"Error detecting format: {format_info.get('error', 'Unknown error')}\"],\n                        warnings=[]\n                    )\n            \n            # Import based on detected format\n            if detected_format == 'hierarchical':\n                return self.import_hierarchical_data(file_path, sheet_name or 'Sheet2')\n            elif detected_format == 'flat':\n                return self.import_flat_data(file_path, sheet_name)\n            else:\n                return ImportResult(\n                    success=False,\n                    total_records=0,\n                    processed_records=0,\n                    errors=[f\"Unknown or unsupported format: {detected_format}\"],\n                    warnings=[]\n                )\n                \n        except Exception as e:\n            return ImportResult(\n                success=False,\n                total_records=0,\n                processed_records=0,\n                errors=[f\"Unexpected error during import: {str(e)}\"],\n                warnings=[]\n            )\n    \n    def import_both_formats(self, file_path: str) -> Dict[str, ImportResult]:\n        \"\"\"\n        Import both hierarchical and flat formats from the same file\n        Useful when file contains both Sheet1 (flat) and Sheet2 (hierarchical)\n        \"\"\"\n        results = {}\n        \n        try:\n            xl_file = pd.ExcelFile(file_path)\n            \n            # Try importing flat format (typically Sheet1)\n            if 'Sheet1' in xl_file.sheet_names:\n                print(\"\\n--- Importing Sheet1 (Flat Format) ---\")\n                results['flat'] = self.import_flat_data(file_path, 'Sheet1')\n            \n            # Try importing hierarchical format (typically Sheet2)\n            if 'Sheet2' in xl_file.sheet_names:\n                print(\"\\n--- Importing Sheet2 (Hierarchical Format) ---\")\n                results['hierarchical'] = self.import_hierarchical_data(file_path, 'Sheet2')\n                \n        except Exception as e:\n            results['error'] = ImportResult(\n                success=False,\n                total_records=0,\n                processed_records=0,\n                errors=[f\"Error importing both formats: {str(e)}\"],\n                warnings=[]\n            )\n        \n        return results\n    \n    def save_results(self, result: ImportResult, output_dir: str = \"output\") -> Dict[str, str]:\n        \"\"\"\n        Save import results to files\n        Returns dictionary of saved file paths\n        \"\"\"\n        os.makedirs(output_dir, exist_ok=True)\n        timestamp = datetime.now().strftime(\"%Y%m%d_%H%M%S\")\n        \n        saved_files = {}\n        \n        try:\n            # Save main data\n            if result.data is not None:\n                data_file = os.path.join(output_dir, f\"imported_data_{timestamp}.csv\")\n                result.data.to_csv(data_file, index=False)\n                saved_files['data'] = data_file\n                \n                # Save normalized data separately\n                normalized_file = os.path.join(output_dir, f\"normalized_data_{timestamp}.csv\")\n                normalized_cols = [col for col in result.data.columns if 'NORMALIZED' in col or col in ['STATE', 'COLLEGE', 'ADDRESS', 'CATEGORY']]\n                if normalized_cols:\n                    result.data[normalized_cols].to_csv(normalized_file, index=False)\n                    saved_files['normalized'] = normalized_file\n            \n            # Save audit report\n            if result.audit_report:\n                audit_file = os.path.join(output_dir, f\"audit_report_{timestamp}.txt\")\n                with open(audit_file, 'w') as f:\n                    f.write(result.audit_report)\n                saved_files['audit'] = audit_file\n            \n            # Save validation results\n            if result.validation_results:\n                validation_file = os.path.join(output_dir, f\"validation_results_{timestamp}.json\")\n                # Convert numpy types to native Python types for JSON serialization\n                validation_json = {}\n                for key, value in result.validation_results.items():\n                    if key == 'statistics':\n                        validation_json[key] = {k: int(v) if hasattr(v, 'dtype') else v for k, v in value.items()}\n                    elif key == 'duplicates':\n                        validation_json[key] = value.to_dict('records') if hasattr(value, 'to_dict') else str(value)\n                    else:\n                        validation_json[key] = value\n                \n                with open(validation_file, 'w') as f:\n                    json.dump(validation_json, f, indent=2)\n                saved_files['validation'] = validation_file\n                \n        except Exception as e:\n            print(f\"Error saving results: {e}\")\n            \n        return saved_files\n    \n    def generate_summary_report(self, result: ImportResult) -> str:\n        \"\"\"\n        Generate a comprehensive summary report\n        \"\"\"\n        report = []\n        report.append(\"\\n\" + \"=\" * 60)\n        report.append(\"COLLEGE DATA IMPORT SUMMARY REPORT\")\n        report.append(\"=\" * 60)\n        report.append(f\"Import Status: {'SUCCESS' if result.success else 'FAILED'}\")\n        report.append(f\"Total Records: {result.total_records}\")\n        report.append(f\"Processed Records: {result.processed_records}\")\n        report.append(f\"Processing Rate: {(result.processed_records/result.total_records*100):.1f}%\" if result.total_records > 0 else \"N/A\")\n        \n        if result.errors:\n            report.append(f\"\\nERRORS ({len(result.errors)}):\")\n            for error in result.errors:\n                report.append(f\"  • {error}\")\n        \n        if result.warnings:\n            report.append(f\"\\nWARNINGS ({len(result.warnings)}):\")\n            for warning in result.warnings:\n                report.append(f\"  • {warning}\")\n        \n        if result.validation_results:\n            stats = result.validation_results.get('statistics', {})\n            report.append(f\"\\nDATA VALIDATION:\")\n            report.append(f\"  Unique Identifiers: {stats.get('unique_identifiers', 'N/A')}\")\n            report.append(f\"  Unique States: {stats.get('unique_states', 'N/A')}\")\n            report.append(f\"  Unique Colleges: {stats.get('unique_colleges', 'N/A')}\")\n            report.append(f\"  Colleges in Multiple States: {stats.get('colleges_multiple_states', 'N/A')}\")\n            report.append(f\"  Colleges with Multiple Addresses: {stats.get('colleges_multiple_addresses', 'N/A')}\")\n            report.append(f\"  Duplicate Records: {stats.get('duplicate_count', 'N/A')}\")\n            report.append(f\"  Validation Status: {'PASSED' if result.validation_results.get('validation_passed', False) else 'FAILED'}\")\n        \n        if result.audit_report:\n            report.append(f\"\\nMASTER DATA NORMALIZATION:\")\n            report.append(\"  (See detailed audit report for complete analysis)\")\n        \n        report.append(\"\\n\" + \"=\" * 60)\n        report.append(f\"Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\")\n        report.append(\"=\" * 60)\n        \n        return \"\\n\".join(report)\n\n\nif __name__ == \"__main__\":\n    # Test the comprehensive import system\n    import_system = CollegeImportSystem()\n    \n    # Test file\n    test_file = \"/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental ad.xlsx\"\n    \n    print(\"Testing comprehensive import system...\")\n    \n    # Test format detection\n    format_type, format_info = import_system.detect_format(test_file)\n    print(f\"\\nDetected format: {format_type}\")\n    print(f\"Format info: {format_info}\")\n    \n    # Test importing both formats\n    print(\"\\n\" + \"=\" * 80)\n    print(\"IMPORTING BOTH FORMATS FROM FILE\")\n    print(\"=\" * 80)\n    \n    results = import_system.import_both_formats(test_file)\n    \n    for format_name, result in results.items():\n        print(f\"\\n--- {format_name.upper()} FORMAT RESULTS ---\")\n        summary = import_system.generate_summary_report(result)\n        print(summary)\n        \n        # Save results\n        if result.success and result.data is not None:\n            saved_files = import_system.save_results(result, f\"output/{format_name}\")\n            print(f\"\\nSaved files: {saved_files}\")\n            \n            # Show sample of normalized data\n            print(f\"\\nSample normalized data ({format_name}):\")\n            cols_to_show = ['STATE', 'COLLEGE', 'ADDRESS']\n            if 'STATE_NORMALIZED' in result.data.columns:\n                cols_to_show.extend(['STATE_NORMALIZED', 'COLLEGE_NORMALIZED'])\n            print(result.data[cols_to_show].head(3))"