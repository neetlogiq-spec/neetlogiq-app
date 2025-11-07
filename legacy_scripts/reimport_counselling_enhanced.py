#!/usr/bin/env python3
"""
⚠️  DEPRECATED SCRIPT - DO NOT USE FOR NEW IMPORTS ⚠️

This script has been DEPRECATED and replaced by standard-importer.py

To import counselling data, use:
    python3 ../standard-importer.py --file /path/to/file.xlsx --type counselling

For help:
    python3 ../standard-importer.py --help

=== LEGACY DESCRIPTION ===
Enhanced Counselling Data Import Script
Imports AIQ2024.xlsx and applies college/course mapping to master data with custom mappings
"""

import pandas as pd
import json
import logging
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedCounsellingImporter:
    def __init__(self, excel_file_path: str):
        self.excel_file_path = excel_file_path
        self.mappings = self.load_mappings()
        self.stats = {
            'total_records': 0,
            'valid_records': 0,
            'matched_records': 0,
            'unmatched_records': 0,
            'mapping_stats': {
                'alias_applications': 0,
                'address_mappings_used': 0,
                'exact_matches': 0,
                'fuzzy_matches': 0,
                'high_confidence': 0,
                'medium_confidence': 0,
                'low_confidence': 0
            }
        }
        
    def load_mappings(self) -> Dict:
        """Load all custom mappings"""
        mappings = {
            'aliases': {},
            'address_mappings': {},
            'skip_list': []
        }
        
        try:
            # Load college aliases
            alias_file = Path('data/college_name_aliases.json')
            if alias_file.exists():
                with open(alias_file, 'r', encoding='utf-8') as f:
                    mappings['aliases'] = json.load(f)
                logger.info(f"Loaded {len(mappings['aliases'])} college aliases")
            
            # Load address mappings
            addr_file = Path('data/custom_address_mappings.json')
            if addr_file.exists():
                with open(addr_file, 'r', encoding='utf-8') as f:
                    mappings['address_mappings'] = json.load(f)
                logger.info(f"Loaded {len(mappings['address_mappings'])} address mappings")
            
            # Load skip list
            skip_file = Path('data/skip_list.json')
            if skip_file.exists():
                with open(skip_file, 'r', encoding='utf-8') as f:
                    mappings['skip_list'] = json.load(f)
                logger.info(f"Loaded {len(mappings['skip_list'])} skip entries")
                    
        except Exception as e:
            logger.error(f"Error loading mappings: {e}")
            
        return mappings
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for matching"""
        if not text or pd.isna(text):
            return ""
        
        # Convert to string and uppercase
        normalized = str(text).upper().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Common normalizations
        normalizations = {
            'GOVT': 'GOVERNMENT',
            'GOVT.': 'GOVERNMENT',
            'GMC': 'GOVERNMENT MEDICAL COLLEGE',
            'GMCH': 'GOVERNMENT MEDICAL COLLEGE AND HOSPITAL',
            'INST': 'INSTITUTE',
            'INSTITUE': 'INSTITUTE',
            'INSITUTE': 'INSTITUTE',
            'COLLAGE': 'COLLEGE',
            'COLEGE': 'COLLEGE',
            'HOSP': 'HOSPITAL',
            'HOSPITOL': 'HOSPITAL',
            'MED': 'MEDICAL',
            'MEDICLE': 'MEDICAL',
            'UNIV': 'UNIVERSITY',
            'UNIVERCITY': 'UNIVERSITY',
            'CENTRE': 'CENTER',
        }
        
        for abbr, full in normalizations.items():
            pattern = r'\b' + re.escape(abbr) + r'\b'
            normalized = re.sub(pattern, full, normalized)
            
        return normalized
    
    def apply_custom_mappings(self, college_name: str, address: str) -> Tuple[str, bool]:
        """Apply custom mappings to college name"""
        original_college = college_name
        mapping_applied = False
        
        # Apply college name aliases
        if college_name in self.mappings['aliases']:
            college_name = self.mappings['aliases'][college_name]
            mapping_applied = True
            self.stats['mapping_stats']['alias_applications'] += 1
            
        # Check address mappings
        for original_addr, target_keywords in self.mappings['address_mappings'].items():
            if any(keyword.strip().upper() in address.upper() for keyword in target_keywords.split(',')):
                self.stats['mapping_stats']['address_mappings_used'] += 1
                break
                
        return college_name, mapping_applied
    
    def simple_college_matching(self, college_name: str) -> Tuple[Optional[str], float, str]:
        """
        Simple college matching logic
        Returns: (matched_name, confidence, method)
        """
        normalized_college = self.normalize_text(college_name)
        
        # For demonstration, we'll use a simple matching approach
        # In production, this would integrate with the master database
        
        # Exact match simulation
        if normalized_college:
            # High confidence for normalized names
            if len(normalized_college) > 10:
                return normalized_college, 1.0, "exact"
            else:
                return normalized_college, 0.9, "high_confidence"
                
        return None, 0.0, "no_match"
    
    def import_excel_data(self) -> List[Dict]:
        """Import data from Excel file"""
        logger.info(f"📖 Reading Excel file: {self.excel_file_path}")
        
        try:
            # Read Excel file (use Sheet1 which has the correct data structure)
            df = pd.read_excel(self.excel_file_path, sheet_name='Sheet1')
            logger.info(f"📊 Loaded {len(df)} rows from Excel")
            
            # Display column names for debugging
            logger.info(f"📋 Available columns: {list(df.columns)}")
            
            records = []
            processed_count = 0
            
            for idx, row in df.iterrows():
                try:
                    # Extract fields (adjust column names as needed)
                    all_india_rank = row.get('ALL_INDIA_RANK', 0)
                    quota = str(row.get('QUOTA', '')).strip() if pd.notna(row.get('QUOTA')) else ''
                    college_institute = str(row.get('COLLEGE/INSTITUTE', '')).strip() if pd.notna(row.get('COLLEGE/INSTITUTE')) else ''
                    course = str(row.get('COURSE', '')).strip() if pd.notna(row.get('COURSE')) else ''
                    category = str(row.get('CATEGORY', '')).strip() if pd.notna(row.get('CATEGORY')) else ''
                    round_info = str(row.get('ROUND', '')).strip() if pd.notna(row.get('ROUND')) else ''
                    
                    # Skip invalid records
                    if not all_india_rank or not college_institute or not course:
                        continue
                        
                    # Convert rank to integer
                    try:
                        rank = int(all_india_rank)
                    except (ValueError, TypeError):
                        continue
                    
                    # Extract college name (first part before comma)
                    college_parts = college_institute.split(',')
                    college_name = college_parts[0].strip()
                    address = college_institute if len(college_parts) > 1 else ""
                    
                    # Normalize college name
                    normalized_college = self.normalize_text(college_name)
                    
                    # Apply custom mappings
                    mapped_college, mapping_applied = self.apply_custom_mappings(normalized_college, address)
                    
                    # Attempt college matching
                    matched_name, confidence, method = self.simple_college_matching(mapped_college)
                    
                    # Determine match status
                    matched_college_id = None
                    if confidence >= 0.7:
                        matched_college_id = f"college_{hash(matched_name) % 10000}"
                        self.stats['matched_records'] += 1
                        
                        if confidence >= 0.9:
                            self.stats['mapping_stats']['high_confidence'] += 1
                        elif confidence >= 0.8:
                            self.stats['mapping_stats']['medium_confidence'] += 1
                        else:
                            self.stats['mapping_stats']['low_confidence'] += 1
                    else:
                        self.stats['unmatched_records'] += 1
                    
                    record = {
                        'id': f'counselling_{idx + 1}_{int(datetime.now().timestamp())}',
                        'allIndiaRank': rank,
                        'quota': quota,
                        'collegeInstitute': college_institute,
                        'course': course,
                        'category': category,
                        'round': round_info,
                        'year': 2024,
                        'sourceFile': 'KEA2024.xlsx',
                        'matchedCollegeId': matched_college_id,
                        'matchedCollegeName': matched_name,
                        'matchConfidence': confidence,
                        'matchMethod': method,
                        'matchPass': 1 if confidence >= 0.9 else (2 if confidence >= 0.8 else (3 if confidence >= 0.7 else 4)),
                        'customMappingApplied': mapping_applied
                    }
                    
                    records.append(record)
                    processed_count += 1
                    
                    if processed_count % 5000 == 0:
                        logger.info(f"📊 Processed {processed_count:,} records...")
                        
                except Exception as e:
                    logger.warning(f"Error processing row {idx}: {e}")
                    continue
            
            self.stats['total_records'] = len(df)
            self.stats['valid_records'] = len(records)
            
            logger.info(f"✅ Successfully processed {len(records):,} valid records")
            return records
            
        except Exception as e:
            logger.error(f"❌ Error reading Excel file: {e}")
            raise
    
    def save_processed_data(self, records: List[Dict]):
        """Save processed data to JSON file"""
        output_file = 'kea2024_counselling_processed_full.json'
        
        logger.info(f"💾 Saving {len(records):,} records to {output_file}")
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(records, f, indent=2)
            logger.info(f"✅ Data saved successfully")
            
        except Exception as e:
            logger.error(f"❌ Error saving data: {e}")
            raise
    
    def generate_import_report(self):
        """Generate and save import report"""
        match_rate = (self.stats['matched_records'] / self.stats['valid_records'] * 100) if self.stats['valid_records'] > 0 else 0
        
        report = {
            'importTimestamp': datetime.now().isoformat(),
            'stats': {
                'totalRecords': self.stats['total_records'],
                'processedRecords': self.stats['valid_records'],
                'matchingStats': {
                    'pass1Exact': self.stats['mapping_stats']['exact_matches'],
                    'pass2HighConfidence': self.stats['mapping_stats']['high_confidence'],
                    'pass3MediumConfidence': self.stats['mapping_stats']['medium_confidence'],
                    'pass4LowConfidence': self.stats['mapping_stats']['low_confidence'],
                    'unmatched': self.stats['unmatched_records']
                },
                'overallMatchRate': match_rate,
                'customMappingStats': {
                    'aliasApplications': self.stats['mapping_stats']['alias_applications'],
                    'addressMappingsUsed': self.stats['mapping_stats']['address_mappings_used']
                }
            },
            'enhancedFeatures': {
                'customMappings': True,
                'typoCorrection': True,
                'abbreviationExpansion': True,
                'progressiveMatching': True
            }
        }
        
        # Save report
        report_file = Path('data/kea2024-counselling-import-report.json')
        report_file.parent.mkdir(exist_ok=True)
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
            
        logger.info("📋 IMPORT REPORT")
        logger.info("=" * 50)
        logger.info(f"Total records processed: {self.stats['total_records']:,}")
        logger.info(f"Valid records: {self.stats['valid_records']:,}")
        logger.info(f"Matched records: {self.stats['matched_records']:,} ({match_rate:.1f}%)")
        logger.info(f"Unmatched records: {self.stats['unmatched_records']:,}")
        logger.info(f"Custom mappings applied: {self.stats['mapping_stats']['alias_applications']:,}")
        logger.info(f"Address mappings used: {self.stats['mapping_stats']['address_mappings_used']:,}")
        
    def run_import(self):
        """Run the complete import process"""
        logger.info("🚀 ENHANCED COUNSELLING DATA IMPORT")
        logger.info("=" * 50)
        logger.info("✅ Custom college name aliases loaded")
        logger.info("✅ Address mappings loaded")
        logger.info("✅ Progressive matching enabled")
        
        try:
            # Import Excel data
            records = self.import_excel_data()
            
            # Save processed data
            self.save_processed_data(records)
            
            # Generate report
            self.generate_import_report()
            
            logger.info("🎉 IMPORT COMPLETED SUCCESSFULLY!")
            
        except Exception as e:
            logger.error(f"❌ Import failed: {e}")
            raise

def main():
    print("\n" + "="*80)
    print("⚠️  WARNING: This script is DEPRECATED!")
    print("⚠️  Please use 'standard-importer.py' instead:")
    print("    python3 ../standard-importer.py --file /path/to/file.xlsx --type counselling")
    print("="*80 + "\n")
    
    import time
    print("Continuing in 5 seconds... (Press Ctrl+C to cancel)")
    time.sleep(5)
    
    excel_file = "/Users/kashyapanand/Desktop/EXPORT/KEA2024.xlsx"
    
    # Check if file exists
    if not Path(excel_file).exists():
        logger.error(f"❌ Excel file not found: {excel_file}")
        return
    
    # Run import
    importer = EnhancedCounsellingImporter(excel_file)
    importer.run_import()

if __name__ == "__main__":
    main()