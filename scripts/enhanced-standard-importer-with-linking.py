#!/usr/bin/env python3
"""
Enhanced Standard Data Importer with Master Data Linking
Extends the existing fast matching algorithm to link with master data

Usage:
    python3 enhanced-standard-importer-with-linking.py --file path/to/file.xlsx --type [counselling|college]
"""

import pandas as pd
import json
import logging
import argparse
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedStandardImporterWithLinking:
    def __init__(self):
        self.mappings = self.load_mappings()
        self.master_colleges = {}
        self.master_courses = {}
        self.stats = {
            'total_records': 0,
            'valid_records': 0,
            'matched_records': 0,
            'unmatched_records': 0,
            'master_linked': 0,
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
    
    def load_master_data(self):
        """Load master colleges and courses data"""
        logger.info("📖 Loading master data...")
        
        # Load master colleges
        colleges_path = Path('data/parquet/colleges.parquet')
        if colleges_path.exists():
            df_colleges = pd.read_parquet(colleges_path)
            for idx, row in df_colleges.iterrows():
                college_id = row.get('id', f'college_{idx}')
                self.master_colleges[college_id] = {
                    'id': college_id,
                    'name': str(row.get('name', '')),
                    'state': str(row.get('state', '')),
                    'normalized_name': self.normalize_text(str(row.get('name', '')))
                }
            logger.info(f"✅ Loaded {len(self.master_colleges)} master colleges")
        else:
            logger.error("❌ Master colleges file not found")
            return False
            
        # Load master courses
        courses_path = Path('data/parquet/courses.parquet')
        if courses_path.exists():
            df_courses = pd.read_parquet(courses_path)
            for idx, row in df_courses.iterrows():
                course_id = row.get('id', f'course_{idx}')
                self.master_courses[course_id] = {
                    'id': course_id,
                    'name': str(row.get('name', '')),
                    'normalized_name': self.normalize_text(str(row.get('name', '')))
                }
            logger.info(f"✅ Loaded {len(self.master_courses)} master courses")
        else:
            logger.error("❌ Master courses file not found")
            return False
            
        return True
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for matching - same as original"""
        if not text or pd.isna(text):
            return ""
        
        normalized = str(text).upper().strip()
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
            '&': 'AND',
        }
        
        for abbr, full in normalizations.items():
            pattern = r'\b' + re.escape(abbr) + r'\b'
            normalized = re.sub(pattern, full, normalized)
            
        return normalized
    
    def apply_custom_mappings(self, normalized_college: str, address: str = "") -> Tuple[str, bool]:
        """Apply custom mappings - same as original"""
        mapping_applied = False
        
        # Apply aliases
        if normalized_college in self.mappings['aliases']:
            normalized_college = self.mappings['aliases'][normalized_college]
            self.stats['mapping_stats']['alias_applications'] += 1
            mapping_applied = True
        
        # Apply address mappings
        if address and address in self.mappings['address_mappings']:
            normalized_college = self.mappings['address_mappings'][address]
            self.stats['mapping_stats']['address_mappings_used'] += 1
            mapping_applied = True
        
        return normalized_college, mapping_applied
    
    def simple_college_matching(self, normalized_college: str) -> Tuple[Optional[str], float, str]:
        """Enhanced college matching that links to master data"""
        if not normalized_college:
            return None, 0.0, "no_match"
        
        # First pass: Exact matches in master data
        for college_id, college_data in self.master_colleges.items():
            if college_data['normalized_name'] == normalized_college:
                self.stats['mapping_stats']['exact_matches'] += 1
                return college_id, 1.0, "exact_match"
        
        # Second pass: Fuzzy matching with master data
        best_match = None
        best_confidence = 0.0
        best_method = "no_match"
        
        for college_id, college_data in self.master_colleges.items():
            # Calculate similarity
            similarity = self.calculate_similarity(normalized_college, college_data['normalized_name'])
            
            if similarity > best_confidence:
                best_match = college_id
                best_confidence = similarity
                best_method = "fuzzy_match"
        
        # Apply confidence thresholds
        if best_confidence >= 0.9:
            self.stats['mapping_stats']['high_confidence'] += 1
            return best_match, best_confidence, "high_confidence"
        elif best_confidence >= 0.8:
            self.stats['mapping_stats']['medium_confidence'] += 1
            return best_match, best_confidence, "medium_confidence"
        elif best_confidence >= 0.7:
            self.stats['mapping_stats']['low_confidence'] += 1
            return best_match, best_confidence, "low_confidence"
                
        return None, 0.0, "no_match"
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        
        # Simple character-based similarity
        from difflib import SequenceMatcher
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    def find_master_course_match(self, course_name: str) -> Tuple[Optional[str], float]:
        """Find matching course in master data"""
        if not course_name:
            return None, 0.0
        
        normalized_course = self.normalize_text(course_name)
        
        # First pass: Exact matches
        for course_id, course_data in self.master_courses.items():
            if course_data['normalized_name'] == normalized_course:
                return course_id, 1.0
        
        # Second pass: Fuzzy matching
        best_match = None
        best_confidence = 0.0
        
        for course_id, course_data in self.master_courses.items():
            similarity = self.calculate_similarity(normalized_course, course_data['normalized_name'])
            if similarity > best_confidence:
                best_match = course_id
                best_confidence = similarity
        
        return best_match, best_confidence
    
    def import_counselling_data(self, file_path: str) -> List[Dict]:
        """Import counselling data with master data linking"""
        logger.info(f"📖 Reading counselling data from: {file_path}")
        
        try:
            # Read Excel file
            df = pd.read_excel(file_path)
            logger.info(f"📊 Loaded {len(df)} rows")
            logger.info(f"📋 Available columns: {list(df.columns)}")
            
            records = []
            processed_count = 0
            
            for idx, row in df.iterrows():
                try:
                    # Extract fields - flexible column mapping
                    all_india_rank = row.get('ALL_INDIA_RANK', 0)
                    quota = str(row.get('QUOTA', '')).strip() if pd.notna(row.get('QUOTA')) else ''
                    college_institute = str(row.get('COLLEGE/INSTITUTE', '')).strip() if pd.notna(row.get('COLLEGE/INSTITUTE')) else ''
                    state = str(row.get('STATE', '')).strip() if pd.notna(row.get('STATE')) else ''
                    course = str(row.get('COURSE', '')).strip() if pd.notna(row.get('COURSE')) else ''
                    category = str(row.get('CATEGORY', '')).strip() if pd.notna(row.get('CATEGORY')) else ''
                    round_info = str(row.get('ROUND', '')).strip() if pd.notna(row.get('ROUND')) else ''
                    year = row.get('YEAR', datetime.now().year)
                    
                    # Skip invalid records
                    if not college_institute or not course:
                        continue
                        
                    # Convert rank to integer if available
                    try:
                        rank = int(all_india_rank) if all_india_rank else 0
                    except (ValueError, TypeError):
                        rank = 0
                    
                    # Extract college name
                    college_parts = college_institute.split(',')
                    college_name = college_parts[0].strip()
                    address = college_institute if len(college_parts) > 1 else ""
                    
                    # Normalize college name
                    normalized_college = self.normalize_text(college_name)
                    
                    # Apply custom mappings
                    mapped_college, mapping_applied = self.apply_custom_mappings(normalized_college, address)
                    
                    # Attempt college matching with master data
                    matched_college_id, confidence, method = self.simple_college_matching(mapped_college)
                    
                    # Get master college name if matched
                    master_college_name = ""
                    if matched_college_id and matched_college_id in self.master_colleges:
                        master_college_name = self.master_colleges[matched_college_id]['name']
                        self.stats['master_linked'] += 1
                    
                    # Attempt course matching with master data
                    matched_course_id, course_confidence = self.find_master_course_match(course)
                    master_course_name = ""
                    if matched_course_id and matched_course_id in self.master_courses:
                        master_course_name = self.master_courses[matched_course_id]['name']
                    
                    # Determine match status
                    if confidence >= 0.7:
                        self.stats['matched_records'] += 1
                    else:
                        self.stats['unmatched_records'] += 1
                    
                    # Create record with master data linking
                    record = {
                        'id': f'counselling_{idx + 1}_{int(datetime.now().timestamp())}',
                        'allIndiaRank': rank,
                        'quota': quota,
                        'collegeInstitute': college_institute,
                        'state': state,
                        'course': course,
                        'category': category,
                        'round': round_info,
                        'year': int(year),
                        'sourceFile': Path(file_path).name,
                        
                        # Original matching fields
                        'matchedCollegeId': matched_college_id,
                        'matchedCollegeName': master_college_name,
                        'matchConfidence': confidence,
                        'matchMethod': method,
                        'matchPass': 1 if confidence >= 0.9 else (2 if confidence >= 0.8 else (3 if confidence >= 0.7 else 4)),
                        'customMappingApplied': mapping_applied,
                        'needsManualReview': confidence < 0.8,
                        'isUnmatched': confidence < 0.7,
                        
                        # Master data linking fields
                        'masterCollegeId': matched_college_id,
                        'masterCollegeName': master_college_name,
                        'masterCourseId': matched_course_id,
                        'masterCourseName': master_course_name,
                        'courseMatchConfidence': course_confidence,
                        'courseMatched': course_confidence >= 0.7,
                        
                        'dataType': 'counselling'
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
            
            logger.info(f"✅ Processed {len(records):,} valid records")
            return records
            
        except Exception as e:
            logger.error(f"❌ Error reading file: {e}")
            return []
    
    def save_processed_data(self, records: List[Dict], data_type: str, file_path: str) -> Tuple[str, str]:
        """Save processed data to parquet files"""
        if not records:
            logger.warning("No records to save")
            return None, None
        
        # Create output directory
        output_dir = Path('data/parquet')
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine year and session from filename
        filename = Path(file_path).stem.upper()
        year = datetime.now().year
        
        if '2023' in filename:
            year = 2023
        elif '2024' in filename:
            year = 2024
        
        session = 'unknown'
        if 'KEA' in filename:
            session = 'kea'
        elif 'AIQ' in filename:
            session = 'aiq'
        
        # Create year directory
        year_dir = output_dir / str(year)
        year_dir.mkdir(exist_ok=True)
        
        # Save to parquet
        parquet_file = year_dir / f'cutoffs_{session}_{year}.parquet'
        df = pd.DataFrame(records)
        df.to_parquet(parquet_file, index=False)
        
        logger.info(f"✅ Saved {len(records):,} records to {parquet_file}")
        
        return str(parquet_file), str(parquet_file)
    
    def generate_report(self, records: List[Dict], data_type: str, file_path: str) -> str:
        """Generate processing report"""
        report_file = Path(f'data/reports/import_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt')
        report_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_file, 'w') as f:
            f.write("ENHANCED STANDARD DATA IMPORTER REPORT\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"File: {file_path}\n")
            f.write(f"Data Type: {data_type}\n")
            f.write(f"Processed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("STATISTICS\n")
            f.write("-" * 20 + "\n")
            f.write(f"Total records: {self.stats['total_records']:,}\n")
            f.write(f"Valid records: {self.stats['valid_records']:,}\n")
            f.write(f"Matched records: {self.stats['matched_records']:,}\n")
            f.write(f"Unmatched records: {self.stats['unmatched_records']:,}\n")
            f.write(f"Master data linked: {self.stats['master_linked']:,}\n\n")
            
            f.write("CONFIDENCE DISTRIBUTION\n")
            f.write("-" * 25 + "\n")
            f.write(f"Exact matches: {self.stats['mapping_stats']['exact_matches']:,}\n")
            f.write(f"High confidence (≥0.9): {self.stats['mapping_stats']['high_confidence']:,}\n")
            f.write(f"Medium confidence (0.8-0.9): {self.stats['mapping_stats']['medium_confidence']:,}\n")
            f.write(f"Low confidence (0.7-0.8): {self.stats['mapping_stats']['low_confidence']:,}\n")
        
        logger.info(f"📋 Report saved to {report_file}")
        return str(report_file)
    
    def process_file(self, file_path: str, data_type: str = None) -> Dict:
        """Main processing function"""
        logger.info("🚀 ENHANCED STANDARD DATA IMPORTER WITH LINKING")
        logger.info("=" * 60)
        logger.info(f"File: {file_path}")
        
        # Load master data first
        if not self.load_master_data():
            return {'success': False, 'error': 'Failed to load master data'}
        
        logger.info(f"Processing as: {data_type.upper()} data")
        logger.info("✅ Master data loaded")
        logger.info("✅ Custom mappings loaded")
        logger.info("✅ Enhanced matching with linking enabled")
        
        try:
            # Process based on data type
            if data_type == 'counselling':
                records = self.import_counselling_data(file_path)
            else:
                raise ValueError(f"Unsupported data type: {data_type}. Use 'counselling'.")
            
            # Save processed data
            parquet_file, _ = self.save_processed_data(records, data_type, file_path)
            
            # Generate report
            report_file = self.generate_report(records, data_type, file_path)
            
            logger.info("")
            logger.info("🎉 ENHANCED IMPORT WITH LINKING COMPLETED!")
            logger.info("📝 Master data relationships added:")
            logger.info(f"   - College matches: {self.stats['master_linked']:,}")
            logger.info(f"   - Course matches: {sum(1 for r in records if r.get('courseMatched', False)):,}")
            logger.info("📝 Next steps:")
            logger.info("   1. APIs can now use master_college_id and master_course_id")
            logger.info("   2. Search functionality will work with proper relationships")
            logger.info("   3. Review low confidence matches if needed")
            
            return {
                'success': True,
                'data_type': data_type,
                'records_processed': len(records),
                'master_linked': self.stats['master_linked'],
                'files_generated': {
                    'parquet': parquet_file,
                    'report': report_file
                },
                'statistics': dict(self.stats)
            }
            
        except Exception as e:
            logger.error(f"❌ Import failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'data_type': data_type if 'data_type' in locals() else 'unknown'
            }

def main():
    parser = argparse.ArgumentParser(
        description='Enhanced Standard Data Importer with Master Data Linking',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 enhanced-standard-importer-with-linking.py --file KEA2024.xlsx --type counselling
  python3 enhanced-standard-importer-with-linking.py --file AIQ2024.xlsx --type counselling
        """
    )
    
    parser.add_argument('--file', '-f', required=True, help='Path to Excel file to import')
    parser.add_argument('--type', '-t', choices=['counselling'], 
                       help='Type of data: counselling (KEA, AIQ)')
    parser.add_argument('--version', action='version', version='Enhanced Standard Importer with Linking v1.0')
    
    args = parser.parse_args()
    
    if not Path(args.file).exists():
        logger.error(f"File not found: {args.file}")
        sys.exit(1)
    
    importer = EnhancedStandardImporterWithLinking()
    result = importer.process_file(args.file, args.type)
    
    if result['success']:
        logger.info(f"\n✅ Success! Processed {result['records_processed']:,} records")
        logger.info(f"📁 Master data linked: {result['master_linked']:,} colleges")
        sys.exit(0)
    else:
        logger.error(f"\n❌ Failed: {result['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main()
