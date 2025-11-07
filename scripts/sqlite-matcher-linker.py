#!/usr/bin/env python3
"""
SQLite Matcher and Linker
Uses the fast hierarchical matching algorithm to match and link data in SQLite staging database

Usage:
    python3 sqlite-matcher-linker.py
"""

import pandas as pd
import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SQLiteMatcherLinker:
    def __init__(self):
        self.staging_db = 'data/staging.db'
        self.mappings = self.load_mappings()
        self.master_colleges = {}
        self.master_courses = {}
        self.stats = {
            'total_records': 0,
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
    
    def normalize_text(self, text: str) -> str:
        """Normalize text for matching"""
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
    
    def apply_custom_mappings(self, college_name: str, address: str = "") -> Tuple[str, bool]:
        """Apply custom mappings to college name"""
        original_college = college_name
        mapping_applied = False
        
        # Apply college name aliases
        if college_name in self.mappings['aliases']:
            college_name = self.mappings['aliases'][college_name]
            self.stats['mapping_stats']['alias_applications'] += 1
            mapping_applied = True
        
        # Apply address mappings
        if address and address in self.mappings['address_mappings']:
            college_name = self.mappings['address_mappings'][address]
            self.stats['mapping_stats']['address_mappings_used'] += 1
            mapping_applied = True
        
        return college_name, mapping_applied
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        
        from difflib import SequenceMatcher
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    def find_master_college_match(self, college_name: str, state: str = "") -> Tuple[Optional[str], float, str]:
        """Find matching college in master data using fast hierarchical matching"""
        normalized_college = self.normalize_text(college_name)
        
        # Skip entries in skip list
        if normalized_college in self.mappings.get('skip_list', []):
            return None, 0.0, "skipped"
        
        # First pass: Exact matches in master data
        for college_id, college_data in self.master_colleges.items():
            if college_data['normalized_name'] == normalized_college:
                self.stats['mapping_stats']['exact_matches'] += 1
                return college_id, 1.0, "exact_match"
        
        # Second pass: Fuzzy matching with state boost
        best_match = None
        best_confidence = 0.0
        best_method = "no_match"
        
        for college_id, college_data in self.master_colleges.items():
            similarity = self.calculate_similarity(normalized_college, college_data['normalized_name'])
            
            # Boost confidence if states match
            if state and state.upper() in college_data['state'].upper():
                similarity = min(1.0, similarity + 0.2)
            
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
    
    def process_all_records(self):
        """Process all records in SQLite database"""
        logger.info("🔄 Processing all records in SQLite database...")
        
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Get all records that need processing
        cursor.execute('''
            SELECT id, college_institute, state, course 
            FROM counselling_data 
            WHERE is_unmatched = 1 OR is_unmatched IS NULL
        ''')
        
        records = cursor.fetchall()
        logger.info(f"📊 Found {len(records)} records to process")
        
        processed_count = 0
        
        for record_id, college_institute, state, course in records:
            try:
                # Extract college name
                college_parts = college_institute.split(',')
                college_name = college_parts[0].strip()
                address = college_institute if len(college_parts) > 1 else ""
                
                # Normalize college name
                normalized_college = self.normalize_text(college_name)
                
                # Apply custom mappings
                mapped_college, mapping_applied = self.apply_custom_mappings(normalized_college, address)
                
                # Find master college match
                master_college_id, confidence, method = self.find_master_college_match(mapped_college, state)
                
                # Get master college name
                master_college_name = ""
                if master_college_id and master_college_id in self.master_colleges:
                    master_college_name = self.master_colleges[master_college_id]['name']
                    self.stats['master_linked'] += 1
                
                # Find master course match
                master_course_id, course_confidence = self.find_master_course_match(course)
                
                # Get master course name
                master_course_name = ""
                if master_course_id and master_course_id in self.master_courses:
                    master_course_name = self.master_courses[master_course_id]['name']
                
                # Determine match status
                is_matched = confidence >= 0.7
                needs_review = confidence < 0.8
                
                # Update record in database
                cursor.execute('''
                    UPDATE counselling_data SET
                        matched_college_id = ?,
                        matched_college_name = ?,
                        match_confidence = ?,
                        match_method = ?,
                        match_pass = ?,
                        custom_mapping_applied = ?,
                        needs_manual_review = ?,
                        is_unmatched = ?,
                        master_college_id = ?,
                        master_college_name = ?,
                        master_course_id = ?,
                        master_course_name = ?,
                        course_match_confidence = ?,
                        course_matched = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    master_college_id,
                    master_college_name,
                    confidence,
                    method,
                    1 if confidence >= 0.9 else (2 if confidence >= 0.8 else (3 if confidence >= 0.7 else 4)),
                    mapping_applied,
                    needs_review,
                    not is_matched,
                    master_college_id,
                    master_college_name,
                    master_course_id,
                    master_course_name,
                    course_confidence,
                    course_confidence >= 0.7,
                    record_id
                ))
                
                if is_matched:
                    self.stats['matched_records'] += 1
                else:
                    self.stats['unmatched_records'] += 1
                
                processed_count += 1
                
                if processed_count % 1000 == 0:
                    logger.info(f"📊 Processed {processed_count:,} records...")
                    conn.commit()  # Commit periodically
                    
            except Exception as e:
                logger.warning(f"Error processing record {record_id}: {e}")
                continue
        
        conn.commit()
        conn.close()
        
        self.stats['total_records'] = processed_count
        logger.info(f"✅ Processed {processed_count:,} records")
    
    def get_processing_stats(self) -> dict:
        """Get processing statistics from SQLite database"""
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Get total records
        cursor.execute('SELECT COUNT(*) FROM counselling_data')
        total_records = cursor.fetchone()[0]
        
        # Get matched records
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 0')
        matched_records = cursor.fetchone()[0]
        
        # Get unmatched records
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 1')
        unmatched_records = cursor.fetchone()[0]
        
        # Get records needing review
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE needs_manual_review = 1')
        needs_review = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'total_records': total_records,
            'matched_records': matched_records,
            'unmatched_records': unmatched_records,
            'needs_review': needs_review,
            'match_rate': (matched_records / total_records * 100) if total_records > 0 else 0
        }
    
    def run(self):
        """Main execution function"""
        logger.info("🚀 SQLITE MATCHER AND LINKER")
        logger.info("=" * 40)
        logger.info("Using fast hierarchical matching algorithm")
        logger.info("Processing records in SQLite staging database")
        logger.info("")
        
        try:
            # Process all records
            self.process_all_records()
            
            # Get final statistics
            stats = self.get_processing_stats()
            
            logger.info("")
            logger.info("🎉 MATCHING AND LINKING COMPLETED!")
            logger.info("📊 Final Statistics:")
            logger.info(f"   - Total records: {stats['total_records']:,}")
            logger.info(f"   - Matched records: {stats['matched_records']:,}")
            logger.info(f"   - Unmatched records: {stats['unmatched_records']:,}")
            logger.info(f"   - Needs review: {stats['needs_review']:,}")
            logger.info(f"   - Match rate: {stats['match_rate']:.1f}%")
            logger.info(f"   - Master data linked: {self.stats['master_linked']:,}")
            logger.info("")
            
            if stats['unmatched_records'] > 0:
                logger.info("📝 Next steps:")
                logger.info("   1. Use interactive mode for unmatched records")
                logger.info("   2. Review low confidence matches")
                logger.info("   3. Convert to parquet after 100% matching")
            else:
                logger.info("🎉 100% matching achieved!")
                logger.info("📝 Ready to convert to parquet files")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Processing failed: {e}")
            return False

def main():
    matcher = SQLiteMatcherLinker()
    success = matcher.run()
    
    if success:
        logger.info("\n✅ Matching and linking completed successfully!")
    else:
        logger.error("\n❌ Matching and linking failed!")
        exit(1)

if __name__ == "__main__":
    main()
