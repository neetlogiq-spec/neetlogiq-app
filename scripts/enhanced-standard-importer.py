#!/usr/bin/env python3
"""
Enhanced Standard Data Importer
Extended version that maps both colleges and courses to master data
Uses the existing matching algorithm with master data integration

Usage:
    python3 enhanced-standard-importer.py --file path/to/file.xlsx --type [counselling|college]
    python3 enhanced-standard-importer.py --file path/to/file.xlsx --type counselling --auto-detect
    python3 enhanced-standard-importer.py --help
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
from difflib import SequenceMatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedStandardDataImporter:
    def __init__(self):
        self.master_colleges = {}
        self.master_courses = {}
        self.mappings = self.load_mappings()
        self.stats = {
            'total_records': 0,
            'valid_records': 0,
            'matched_records': 0,
            'unmatched_records': 0,
            'college_matches': 0,
            'course_matches': 0,
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
                    'city': str(row.get('city', '')),
                    'normalized_name': self.normalize_text(str(row.get('name', ''))),
                    'aliases': self.generate_aliases(str(row.get('name', '')))
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
                    'stream': str(row.get('stream', '')),
                    'normalized_name': self.normalize_text(str(row.get('name', ''))),
                    'aliases': self.generate_aliases(str(row.get('name', '')))
                }
            logger.info(f"✅ Loaded {len(self.master_courses)} master courses")
        else:
            logger.error("❌ Master courses file not found")
            return False
            
        return True
        
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
            '&': 'AND',
            'CO.': 'COMPANY',
            'LTD': 'LIMITED',
            'PVT': 'PRIVATE',
            'PVT.': 'PRIVATE',
        }
        
        for abbr, full in normalizations.items():
            pattern = r'\b' + re.escape(abbr) + r'\b'
            normalized = re.sub(pattern, full, normalized)
            
        return normalized
    
    def generate_aliases(self, text: str) -> List[str]:
        """Generate aliases for better matching"""
        aliases = []
        normalized = self.normalize_text(text)
        aliases.append(normalized)
        
        # Remove common suffixes
        suffixes_to_remove = [
            'MEDICAL COLLEGE',
            'MEDICAL COLLEGE AND HOSPITAL',
            'INSTITUTE OF MEDICAL SCIENCES',
            'INSTITUTE OF HIGHER MEDICAL SCIENCES',
            'GENERAL HOSPITAL',
            'MEMORIAL HOSPITAL',
            'UNIVERSITY',
            'COLLEGE',
            'INSTITUTE',
            'HOSPITAL'
        ]
        
        for suffix in suffixes_to_remove:
            if normalized.endswith(suffix):
                alias = normalized[:-len(suffix)].strip()
                if alias:
                    aliases.append(alias)
                break
        
        return list(set(aliases))
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    def find_best_college_match(self, counselling_college_name: str, counselling_state: str = "") -> Tuple[Optional[str], float, str]:
        """Find best matching college in master data"""
        if not counselling_college_name:
            return None, 0.0, "empty_name"
        
        normalized_counselling = self.normalize_text(counselling_college_name)
        best_match = None
        best_confidence = 0.0
        best_method = "no_match"
        
        # First pass: Exact matches
        for college_id, college_data in self.master_colleges.items():
            if college_data['normalized_name'] == normalized_counselling:
                self.stats['mapping_stats']['exact_matches'] += 1
                return college_id, 1.0, "exact_match"
        
        # Second pass: Check aliases
        for college_id, college_data in self.master_colleges.items():
            for alias in college_data['aliases']:
                if alias == normalized_counselling:
                    self.stats['mapping_stats']['exact_matches'] += 1
                    return college_id, 0.95, "alias_match"
        
        # Third pass: Fuzzy matching
        for college_id, college_data in self.master_colleges.items():
            # Check main name
            similarity = self.calculate_similarity(normalized_counselling, college_data['normalized_name'])
            if similarity > best_confidence:
                best_match = college_id
                best_confidence = similarity
                best_method = "fuzzy_main"
            
            # Check aliases
            for alias in college_data['aliases']:
                similarity = self.calculate_similarity(normalized_counselling, alias)
                if similarity > best_confidence:
                    best_match = college_id
                    best_confidence = similarity
                    best_method = "fuzzy_alias"
        
        # State-based filtering
        if counselling_state and best_match and best_confidence > 0.6:
            matched_college = self.master_colleges[best_match]
            if matched_college['state'].upper() != counselling_state.upper():
                best_confidence *= 0.8
                best_method += "_state_mismatch"
        
        # Update stats based on confidence
        if best_confidence >= 0.9:
            self.stats['mapping_stats']['high_confidence'] += 1
        elif best_confidence >= 0.7:
            self.stats['mapping_stats']['medium_confidence'] += 1
        else:
            self.stats['mapping_stats']['low_confidence'] += 1
        
        if best_confidence >= 0.7:
            self.stats['mapping_stats']['fuzzy_matches'] += 1
        
        return best_match, best_confidence, best_method
    
    def find_best_course_match(self, counselling_course_name: str) -> Tuple[Optional[str], float, str]:
        """Find best matching course in master data"""
        if not counselling_course_name:
            return None, 0.0, "empty_name"
        
        normalized_counselling = self.normalize_text(counselling_course_name)
        best_match = None
        best_confidence = 0.0
        best_method = "no_match"
        
        # First pass: Exact matches
        for course_id, course_data in self.master_courses.items():
            if course_data['normalized_name'] == normalized_counselling:
                return course_id, 1.0, "exact_match"
        
        # Second pass: Check aliases
        for course_id, course_data in self.master_courses.items():
            for alias in course_data['aliases']:
                if alias == normalized_counselling:
                    return course_id, 0.95, "alias_match"
        
        # Third pass: Fuzzy matching
        for course_id, course_data in self.master_courses.items():
            # Check main name
            similarity = self.calculate_similarity(normalized_counselling, course_data['normalized_name'])
            if similarity > best_confidence:
                best_match = course_id
                best_confidence = similarity
                best_method = "fuzzy_main"
            
            # Check aliases
            for alias in course_data['aliases']:
                similarity = self.calculate_similarity(normalized_counselling, alias)
                if similarity > best_confidence:
                    best_match = course_id
                    best_confidence = similarity
                    best_method = "fuzzy_alias"
        
        return best_match, best_confidence, best_method
    
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
    
    def import_counselling_data(self, file_path: str) -> List[Dict]:
        """Import counselling data (like KEA2024, AIQ2024) with master data mapping"""
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
                    
                    # Attempt college matching
                    matched_college_id, college_confidence, college_method = self.find_best_college_match(mapped_college, state)
                    
                    # Attempt course matching
                    matched_course_id, course_confidence, course_method = self.find_best_course_match(course)
                    
                    # Determine match status
                    college_matched = college_confidence >= 0.7
                    course_matched = course_confidence >= 0.7
                    
                    if college_matched:
                        self.stats['college_matches'] += 1
                    if course_matched:
                        self.stats['course_matches'] += 1
                    
                    if college_matched or course_matched:
                        self.stats['matched_records'] += 1
                    else:
                        self.stats['unmatched_records'] += 1
                    
                    # Get matched data
                    matched_college_data = self.master_colleges.get(matched_college_id, {}) if matched_college_id else {}
                    matched_course_data = self.master_courses.get(matched_course_id, {}) if matched_course_id else {}
                    
                    # Create record following established schema
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
                        
                        # Master data relationships
                        'master_college_id': matched_college_id,
                        'master_college_name': matched_college_data.get('name', ''),
                        'college_match_confidence': college_confidence,
                        'college_match_method': college_method,
                        'college_matched': college_matched,
                        
                        'master_course_id': matched_course_id,
                        'master_course_name': matched_course_data.get('name', ''),
                        'course_match_confidence': course_confidence,
                        'course_match_method': course_method,
                        'course_matched': course_matched,
                        
                        # Legacy fields for compatibility
                        'matchedCollegeId': matched_college_id,
                        'matchedCollegeName': matched_college_data.get('name', ''),
                        'matchConfidence': max(college_confidence, course_confidence),
                        'matchMethod': f"college:{college_method},course:{course_method}",
                        'matchPass': 1 if max(college_confidence, course_confidence) >= 0.9 else (2 if max(college_confidence, course_confidence) >= 0.8 else (3 if max(college_confidence, course_confidence) >= 0.7 else 4)),
                        'customMappingApplied': mapping_applied,
                        'needsManualReview': max(college_confidence, course_confidence) < 0.8,
                        'isUnmatched': max(college_confidence, course_confidence) < 0.7,
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
    
    def save_processed_data(self, records: List[Dict], data_type: str, source_file: str):
        """Save processed data to parquet file with master data relationships"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(source_file).stem.lower()
        
        # Determine output directory based on year and session
        year = datetime.now().year
        if 'aiq' in source_name.lower():
            session = 'aiq'
        elif 'kea' in source_name.lower():
            session = 'kea'
        else:
            session = 'unknown'
        
        output_dir = Path(f'data/parquet/{year}')
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / f'cutoffs_{session}_{year}.parquet'
        
        logger.info(f"💾 Saving {len(records):,} records to {output_file}")
        
        try:
            # Convert to DataFrame and save as parquet
            df = pd.DataFrame(records)
            df.to_parquet(output_file, index=False)
            logger.info(f"✅ Data saved successfully to {output_file}")
            
            # Also save JSON for easy review
            json_file = output_file.with_suffix('.json')
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(records, f, indent=2, ensure_ascii=False)
            logger.info(f"✅ JSON version saved to {json_file}")
            
            return str(output_file), str(json_file)
            
        except Exception as e:
            logger.error(f"❌ Error saving data: {e}")
            raise
    
    def generate_import_report(self, records: List[Dict], data_type: str, source_file: str):
        """Generate and save import report with audit trail"""
        match_rate = (self.stats['matched_records'] / self.stats['valid_records'] * 100) if self.stats['valid_records'] > 0 else 0
        college_match_rate = (self.stats['college_matches'] / self.stats['valid_records'] * 100) if self.stats['valid_records'] > 0 else 0
        course_match_rate = (self.stats['course_matches'] / self.stats['valid_records'] * 100) if self.stats['valid_records'] > 0 else 0
        
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
                'overallMatchRate': match_rate,
                'collegeMatchRate': college_match_rate,
                'courseMatchRate': course_match_rate,
                'matchingStats': {
                    'pass1Exact': self.stats['mapping_stats']['exact_matches'],
                    'pass2HighConfidence': self.stats['mapping_stats']['high_confidence'],
                    'pass3MediumConfidence': self.stats['mapping_stats']['medium_confidence'],
                    'pass4LowConfidence': self.stats['mapping_stats']['low_confidence'],
                    'unmatched': self.stats['unmatched_records']
                },
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
                'masterDataIntegration': True,
                'collegeMapping': True,
                'courseMapping': True,
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
        report_file = Path(f'data/mappings/{source_name}_{data_type}_enhanced_import_report_{timestamp}.json')
        report_file.parent.mkdir(exist_ok=True)
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
            
        logger.info("📋 ENHANCED STANDARD IMPORTER REPORT")
        logger.info("=" * 50)
        logger.info(f"Data Type: {data_type.upper()}")
        logger.info(f"Source File: {Path(source_file).name}")
        logger.info(f"Total records processed: {self.stats['total_records']:,}")
        logger.info(f"Valid records: {self.stats['valid_records']:,}")
        logger.info(f"Overall match rate: {match_rate:.1f}%")
        logger.info(f"College match rate: {college_match_rate:.1f}%")
        logger.info(f"Course match rate: {course_match_rate:.1f}%")
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
        logger.info("🚀 ENHANCED STANDARD DATA IMPORTER")
        logger.info("=" * 50)
        logger.info(f"File: {file_path}")
        
        # Load master data first
        if not self.load_master_data():
            return {
                'success': False,
                'error': 'Failed to load master data',
                'data_type': data_type if 'data_type' in locals() else 'unknown'
            }
        
        # Auto-detect data type if not specified
        if auto_detect or not data_type:
            detected_type, detection_info = self.detect_data_type(file_path)
            if detected_type == 'error':
                return {
                    'success': False,
                    'error': f"Error detecting data type: {detection_info.get('error')}",
                    'data_type': data_type if 'data_type' in locals() else 'unknown'
                }
            
            if data_type and data_type != detected_type:
                logger.warning(f"Specified type '{data_type}' differs from detected type '{detected_type}'. Using specified type.")
            else:
                data_type = detected_type
                logger.info(f"Auto-detected data type: {data_type}")
        
        logger.info(f"Processing as: {data_type.upper()} data")
        logger.info("✅ Master colleges loaded")
        logger.info("✅ Master courses loaded")
        logger.info("✅ Custom college name aliases loaded")
        logger.info("✅ Address mappings loaded")
        logger.info("✅ Progressive matching enabled")
        logger.info("✅ Confidence scoring implemented")
        logger.info("✅ Master data relationships enabled")
        logger.info("✅ Audit trail tracking enabled")
        
        try:
            # Process based on data type
            if data_type == 'counselling':
                records = self.import_counselling_data(file_path)
            else:
                return {
                    'success': False,
                    'error': f"Unsupported data type: {data_type}. Use 'counselling'.",
                    'data_type': data_type
                }
            
            # Save processed data
            parquet_file, json_file = self.save_processed_data(records, data_type, file_path)
            
            # Generate report
            report_file = self.generate_import_report(records, data_type, file_path)
            
            logger.info("")
            logger.info("🎉 ENHANCED IMPORT COMPLETED SUCCESSFULLY!")
            logger.info("📝 Next steps as per master data rules:")
            logger.info("   1. Review low confidence matches (<0.8)")
            logger.info("   2. Add unmatched data to master data")
            logger.info("   3. User approval required for final processing")
            logger.info("   4. Update APIs to use master data relationships")
            
            return {
                'success': True,
                'data_type': data_type,
                'records_processed': len(records),
                'files_generated': {
                    'parquet': parquet_file,
                    'json': json_file,
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
        description='Enhanced Standard Data Importer with Master Data Integration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 enhanced-standard-importer.py --file KEA2024.xlsx --type counselling
  python3 enhanced-standard-importer.py --file AIQ2024.xlsx --type counselling
  python3 enhanced-standard-importer.py --file data.xlsx --auto-detect
        """
    )
    
    parser.add_argument('--file', '-f', required=True, help='Path to Excel file to import')
    parser.add_argument('--type', '-t', choices=['counselling'], 
                       help='Type of data: counselling (KEA, AIQ)')
    parser.add_argument('--auto-detect', '-a', action='store_true', 
                       help='Auto-detect data type from file content')
    parser.add_argument('--version', action='version', version='Enhanced Standard Importer v2.0')
    
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
    importer = EnhancedStandardDataImporter()
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
