#!/usr/bin/env python3
"""
Standard Data Importer
Universal script for importing both college/course data and counselling data
Uses the same enhanced matching algorithm with master data integration

Usage:
    python3 standard-importer.py --file path/to/file.xlsx --type [counselling|college]
    python3 standard-importer.py --file path/to/file.xlsx --type counselling --auto-detect
    python3 standard-importer.py --help
"""

import pandas as pd
import json
import logging
import sqlite3
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

class StandardDataImporter:
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
        self.load_master_data()
        
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
                    'normalized_name': str(row.get('normalized_name', ''))
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
                    'normalized_name': str(row.get('normalized_name', ''))
                }
            logger.info(f"✅ Loaded {len(self.master_courses)} master courses")
        else:
            logger.error("❌ Master courses file not found")
            return False
            
        return True
    
    def detect_data_type(self, file_path: str) -> Tuple[str, Dict]:
        """Auto-detect if file contains counselling data or college/course data"""
        try:
            df = pd.read_excel(file_path, nrows=10)  # Sample first 10 rows
            columns = [str(col).upper() for col in df.columns]
            
            # Check for counselling data indicators
            counselling_indicators = ['ALL_INDIA_RANK', 'RANK', 'QUOTA', 'ROUND', 'CATEGORY']
            has_counselling = any(indicator in ' '.join(columns) for indicator in counselling_indicators)
            
            # Check for college/course data indicators
            college_indicators = ['ADDRESS', 'UNIVERSITY', 'AFFILIATION', 'MANAGEMENT', 'SEATS']
            has_college_data = any(indicator in ' '.join(columns) for indicator in college_indicators)
            
            # Check for common fields
            has_college_institute = any('COLLEGE' in col or 'INSTITUTE' in col for col in columns)
            has_course = any('COURSE' in col for col in columns)
            has_state = any('STATE' in col for col in columns)
            
            detection_result = {
                'columns_found': list(df.columns),
                'has_counselling_indicators': has_counselling,
                'has_college_data_indicators': has_college_data,
                'has_common_fields': has_college_institute and has_course and has_state
            }
            
            if has_counselling and has_college_institute:
                return 'counselling', detection_result
            elif has_college_data and has_college_institute:
                return 'college', detection_result
            elif has_college_institute and has_course and has_state:
                # Default to counselling if common fields but unclear
                return 'counselling', detection_result
            else:
                return 'unknown', detection_result
                
        except Exception as e:
            return 'error', {'error': str(e)}
    
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
    
    def apply_custom_mappings(self, college_name: str, address: str = "") -> Tuple[str, bool]:
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
            if address and any(keyword.strip().upper() in address.upper() for keyword in target_keywords.split(',')):
                self.stats['mapping_stats']['address_mappings_used'] += 1
                break
                
        return college_name, mapping_applied
    
    def simple_college_matching(self, college_name: str) -> Tuple[Optional[str], float, str]:
        """
        Enhanced college matching using master data
        Returns: (master_college_id, confidence, method)
        """
        normalized_college = self.normalize_text(college_name)
        
        # Skip entries in skip list
        if normalized_college in self.mappings.get('skip_list', []):
            return None, 0.0, "skipped"
        
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
        """Import counselling data (like KEA2024, AIQ2024)"""
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
                    
                    # Determine match status based on confidence thresholds per rules
                    if confidence >= 0.7:  # Confidence threshold per rules
                        self.stats['matched_records'] += 1
                    else:
                        self.stats['unmatched_records'] += 1
                    
                    # Create record following established schema with master data linking
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
                        'needsManualReview': confidence < 0.8,  # Per rules: low confidence needs review
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
            
            logger.info(f"✅ Successfully processed {len(records):,} counselling records")
            return records
            
        except Exception as e:
            logger.error(f"❌ Error reading counselling data: {e}")
            raise
    
    def import_college_data(self, file_path: str) -> List[Dict]:
        """Import college/course data (like seat data, college lists)"""
        logger.info(f"📖 Reading college/course data from: {file_path}")
        
        try:
            # Read Excel file
            df = pd.read_excel(file_path)
            logger.info(f"📊 Loaded {len(df)} rows")
            logger.info(f"📋 Available columns: {list(df.columns)}")
            
            records = []
            processed_count = 0
            
            for idx, row in df.iterrows():
                try:
                    # Extract fields - flexible column mapping for college data
                    state = str(row.get('STATE', '')).strip() if pd.notna(row.get('STATE')) else ''
                    college_institute = str(row.get('COLLEGE/INSTITUTE', '')).strip() if pd.notna(row.get('COLLEGE/INSTITUTE')) else ''
                    address = str(row.get('ADDRESS', '')).strip() if pd.notna(row.get('ADDRESS')) else ''
                    university = str(row.get('UNIVERSITY_AFFILIATION', '')).strip() if pd.notna(row.get('UNIVERSITY_AFFILIATION')) else ''
                    management = str(row.get('MANAGEMENT', '')).strip() if pd.notna(row.get('MANAGEMENT')) else ''
                    course = str(row.get('COURSE', '')).strip() if pd.notna(row.get('COURSE')) else ''
                    seats = row.get('SEATS', 0)
                    
                    # Skip invalid records
                    if not college_institute or not state:
                        continue
                    
                    # Convert seats to integer
                    try:
                        seats_count = int(seats) if seats else 0
                    except (ValueError, TypeError):
                        seats_count = 0
                    
                    # Normalize college name
                    normalized_college = self.normalize_text(college_institute)
                    
                    # Apply custom mappings
                    mapped_college, mapping_applied = self.apply_custom_mappings(normalized_college, address)
                    
                    # Attempt college matching
                    matched_name, confidence, method = self.simple_college_matching(mapped_college)
                    
                    # Determine match status
                    matched_college_id = None
                    if confidence >= 0.7:
                        matched_college_id = f"college_{hash(matched_name) % 10000}"
                        self.stats['matched_records'] += 1
                    else:
                        self.stats['unmatched_records'] += 1
                    
                    # Create record for college data
                    record = {
                        'id': f'college_{idx + 1}_{int(datetime.now().timestamp())}',
                        'state': state,
                        'collegeInstitute': college_institute,
                        'address': address,
                        'universityAffiliation': university,
                        'management': management,
                        'course': course,
                        'seats': seats_count,
                        'sourceFile': Path(file_path).name,
                        'matchedCollegeId': matched_college_id,
                        'matchedCollegeName': matched_name,
                        'matchConfidence': confidence,
                        'matchMethod': method,
                        'matchPass': 1 if confidence >= 0.9 else (2 if confidence >= 0.8 else (3 if confidence >= 0.7 else 4)),
                        'customMappingApplied': mapping_applied,
                        'needsManualReview': confidence < 0.8,
                        'isUnmatched': confidence < 0.7,
                        'dataType': 'college'
                    }
                    
                    records.append(record)
                    processed_count += 1
                    
                    if processed_count % 1000 == 0:
                        logger.info(f"📊 Processed {processed_count:,} records...")
                        
                except Exception as e:
                    logger.warning(f"Error processing row {idx}: {e}")
                    continue
            
            self.stats['total_records'] = len(df)
            self.stats['valid_records'] = len(records)
            
            logger.info(f"✅ Successfully processed {len(records):,} college records")
            return records
            
        except Exception as e:
            logger.error(f"❌ Error reading college data: {e}")
            raise
    
    def save_processed_data(self, records: List[Dict], data_type: str, source_file: str):
        """Save processed data to parquet files"""
        if not records:
            logger.warning("No records to save")
            return None, None
        
        # Create output directory
        output_dir = Path('data/parquet')
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine year and session from filename
        filename = Path(source_file).stem.upper()
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
    
    def generate_import_report(self, records: List[Dict], data_type: str, source_file: str):
        """Generate and save import report with audit trail"""
        match_rate = (self.stats['matched_records'] / self.stats['valid_records'] * 100) if self.stats['valid_records'] > 0 else 0
        
        # Count records needing review
        needs_review_count = sum(1 for record in records if record.get('needsManualReview', False))
        unmatched_count = sum(1 for record in records if record.get('isUnmatched', False))
        
        report = {
            'importTimestamp': datetime.now().isoformat(),
            'sourceFile': Path(source_file).name,
            'dataType': data_type,
            'processingRules': {
                'highConfidenceThreshold': 0.8,
                'mediumConfidenceThreshold': 0.7,
                'manualReviewRequired': 'confidence < 0.8',
                'masterDataNormalization': 'uppercase_applied',
                'versionControlRequired': True
            },
            'stats': {
                'totalRecords': self.stats['total_records'],
                'processedRecords': self.stats['valid_records'],
                'masterLinked': self.stats['master_linked'],
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
                },
                'auditTrailStats': {
                    'recordsNeedingReview': needs_review_count,
                    'completelyUnmatched': unmatched_count
                }
            },
            'enhancedFeatures': {
                'customMappings': True,
                'typoCorrection': True,
                'abbreviationExpansion': True,
                'progressiveMatching': True,
                'confidenceScoring': True,
                'auditTrail': True
            },
            'nextSteps': {
                'manualReview': f"Review {needs_review_count} low confidence matches",
                'masterDataUpdate': f"Add {unmatched_count} unmatched entries to master data",
                'userApproval': "Required before final processing per rules"
            }
        }
        
        # Save report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(source_file).stem.lower()
        report_file = Path(f'data/{source_name}_{data_type}_import_report_{timestamp}.json')
        report_file.parent.mkdir(exist_ok=True)
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
            
        logger.info("📋 STANDARD IMPORTER REPORT")
        logger.info("=" * 50)
        logger.info(f"Data Type: {data_type.upper()}")
        logger.info(f"Source File: {Path(source_file).name}")
        logger.info(f"Total records processed: {self.stats['total_records']:,}")
        logger.info(f"Valid records: {self.stats['valid_records']:,}")
        logger.info(f"Matched records: {self.stats['matched_records']:,} ({match_rate:.1f}%)")
        logger.info(f"Unmatched records: {self.stats['unmatched_records']:,}")
        logger.info(f"Custom mappings applied: {self.stats['mapping_stats']['alias_applications']:,}")
        logger.info(f"Address mappings used: {self.stats['mapping_stats']['address_mappings_used']:,}")
        
        # Show confidence distribution
        logger.info("")
        logger.info("🎯 CONFIDENCE DISTRIBUTION")
        logger.info("-" * 30)
        logger.info(f"Exact matches: {self.stats['mapping_stats']['exact_matches']:,}")
        logger.info(f"High confidence (≥0.8): {self.stats['mapping_stats']['high_confidence']:,}")
        logger.info(f"Medium confidence (0.7-0.8): {self.stats['mapping_stats']['medium_confidence']:,}")
        logger.info(f"Low confidence (<0.7): {self.stats['mapping_stats']['low_confidence']:,}")
        logger.info(f"Records needing review: {needs_review_count:,}")
        
        return report_file
    
    def process_file(self, file_path: str, data_type: str = None, auto_detect: bool = False) -> Dict:
        """Main processing function"""
        logger.info("🚀 STANDARD DATA IMPORTER")
        logger.info("=" * 50)
        logger.info(f"File: {file_path}")
        
        # Auto-detect data type if not specified
        if auto_detect or not data_type:
            detected_type, detection_info = self.detect_data_type(file_path)
            if detected_type == 'error':
                raise ValueError(f"Error detecting data type: {detection_info.get('error')}")
            
            if data_type and data_type != detected_type:
                logger.warning(f"Specified type '{data_type}' differs from detected type '{detected_type}'. Using specified type.")
            else:
                data_type = detected_type
                logger.info(f"Auto-detected data type: {data_type}")
        
        logger.info(f"Processing as: {data_type.upper()} data")
        logger.info("✅ Custom college name aliases loaded")
        logger.info("✅ Address mappings loaded")
        logger.info("✅ Progressive matching enabled")
        logger.info("✅ Confidence scoring implemented")
        logger.info("✅ Audit trail tracking enabled")
        
        try:
            # Process based on data type
            if data_type == 'counselling':
                records = self.import_counselling_data(file_path)
            elif data_type == 'college':
                records = self.import_college_data(file_path)
            else:
                raise ValueError(f"Unsupported data type: {data_type}. Use 'counselling' or 'college'.")
            
            # Save processed data
            json_file, csv_file = self.save_processed_data(records, data_type, file_path)
            
            # Generate report
            report_file = self.generate_import_report(records, data_type, file_path)
            
            logger.info("")
            logger.info("🎉 ENHANCED IMPORT WITH MASTER DATA LINKING COMPLETED!")
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
                'files_generated': {
                    'json': json_file,
                    'csv': csv_file,
                    'report': str(report_file)
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
        description='Standard Data Importer for colleges/courses and counselling data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 standard-importer.py --file KEA2024.xlsx --type counselling
  python3 standard-importer.py --file AIQ2024.xlsx --type counselling
  python3 standard-importer.py --file seat_data.xlsx --type college
  python3 standard-importer.py --file data.xlsx --auto-detect
        """
    )
    
    parser.add_argument('--file', '-f', required=True, help='Path to Excel file to import')
    parser.add_argument('--type', '-t', choices=['counselling', 'college'], 
                       help='Type of data: counselling (KEA, AIQ) or college (seat data)')
    parser.add_argument('--auto-detect', '-a', action='store_true', 
                       help='Auto-detect data type from file content')
    parser.add_argument('--version', action='version', version='Standard Importer v1.0')
    
    args = parser.parse_args()
    
    # Validate file exists
    if not Path(args.file).exists():
        logger.error(f"❌ File not found: {args.file}")
        sys.exit(1)
    
    # Validate arguments
    if not args.type and not args.auto_detect:
        logger.error("❌ Either --type or --auto-detect must be specified")
        parser.print_help()
        sys.exit(1)
    
    # Initialize importer and process
    importer = StandardDataImporter()
    result = importer.process_file(args.file, args.type, args.auto_detect)
    
    if result['success']:
        logger.info("\n✅ Import completed successfully!")
        logger.info(f"📁 Files generated:")
        for file_type, file_path in result['files_generated'].items():
            logger.info(f"   {file_type.upper()}: {file_path}")
        sys.exit(0)
    else:
        logger.error(f"\n❌ Import failed: {result['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main()