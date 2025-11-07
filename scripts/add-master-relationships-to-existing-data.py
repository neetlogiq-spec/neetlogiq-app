#!/usr/bin/env python3
"""
Add Master Data Relationships to Existing Parquet Files
Uses existing hierarchical matching to add master_college_id and master_course_id
Much faster than re-importing everything

Usage:
    python3 add-master-relationships-to-existing-data.py
"""

import pandas as pd
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from difflib import SequenceMatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MasterDataRelationshipAdder:
    def __init__(self):
        self.master_colleges = {}
        self.master_courses = {}
        self.stats = {
            'files_processed': 0,
            'records_updated': 0,
            'college_matches': 0,
            'course_matches': 0
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
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    def find_best_college_match(self, counselling_college_name: str, counselling_state: str = "") -> Tuple[Optional[str], float]:
        """Find best matching college using simple but effective matching"""
        if not counselling_college_name:
            return None, 0.0
        
        # Extract clean college name (remove address part)
        college_parts = str(counselling_college_name).split(',')
        clean_name = college_parts[0].strip()
        normalized_counselling = self.normalize_text(clean_name)
        
        best_match = None
        best_confidence = 0.0
        
        # First pass: Exact matches
        for college_id, college_data in self.master_colleges.items():
            if college_data['normalized_name'] == normalized_counselling:
                return college_id, 1.0
        
        # Second pass: Fuzzy matching with state filtering
        for college_id, college_data in self.master_colleges.items():
            similarity = self.calculate_similarity(normalized_counselling, college_data['normalized_name'])
            
            # Boost confidence if states match
            if counselling_state and college_data['state'].upper() == counselling_state.upper():
                similarity = min(1.0, similarity + 0.2)
            
            if similarity > best_confidence:
                best_match = college_id
                best_confidence = similarity
        
        return best_match, best_confidence
    
    def find_best_course_match(self, counselling_course_name: str) -> Tuple[Optional[str], float]:
        """Find best matching course using simple matching"""
        if not counselling_course_name:
            return None, 0.0
        
        normalized_counselling = self.normalize_text(str(counselling_course_name))
        best_match = None
        best_confidence = 0.0
        
        # First pass: Exact matches
        for course_id, course_data in self.master_courses.items():
            if course_data['normalized_name'] == normalized_counselling:
                return course_id, 1.0
        
        # Second pass: Fuzzy matching
        for course_id, course_data in self.master_courses.items():
            similarity = self.calculate_similarity(normalized_counselling, course_data['normalized_name'])
            if similarity > best_confidence:
                best_match = course_id
                best_confidence = similarity
        
        return best_match, best_confidence
    
    def add_relationships_to_file(self, file_path: Path):
        """Add master data relationships to a single parquet file"""
        logger.info(f"📝 Processing {file_path}")
        
        try:
            # Read existing parquet file
            df = pd.read_parquet(file_path)
            logger.info(f"📊 Loaded {len(df)} records from {file_path}")
            
            # Add master data relationship columns
            master_college_ids = []
            master_college_names = []
            college_match_confidences = []
            college_matched_flags = []
            
            master_course_ids = []
            master_course_names = []
            course_match_confidences = []
            course_matched_flags = []
            
            for idx, row in df.iterrows():
                # College matching
                college_name = str(row.get('collegeInstitute', ''))
                state = str(row.get('state', ''))
                
                matched_college_id, college_confidence = self.find_best_college_match(college_name, state)
                
                if matched_college_id and college_confidence >= 0.7:
                    master_college_ids.append(matched_college_id)
                    master_college_names.append(self.master_colleges[matched_college_id]['name'])
                    college_match_confidences.append(college_confidence)
                    college_matched_flags.append(True)
                    self.stats['college_matches'] += 1
                else:
                    master_college_ids.append(None)
                    master_college_names.append('')
                    college_match_confidences.append(0.0)
                    college_matched_flags.append(False)
                
                # Course matching
                course_name = str(row.get('course', ''))
                
                matched_course_id, course_confidence = self.find_best_course_match(course_name)
                
                if matched_course_id and course_confidence >= 0.7:
                    master_course_ids.append(matched_course_id)
                    master_course_names.append(self.master_courses[matched_course_id]['name'])
                    course_match_confidences.append(course_confidence)
                    course_matched_flags.append(True)
                    self.stats['course_matches'] += 1
                else:
                    master_course_ids.append(None)
                    master_course_names.append('')
                    course_match_confidences.append(0.0)
                    course_matched_flags.append(False)
            
            # Add new columns to dataframe
            df['master_college_id'] = master_college_ids
            df['master_college_name'] = master_college_names
            df['college_match_confidence'] = college_match_confidences
            df['college_matched'] = college_matched_flags
            
            df['master_course_id'] = master_course_ids
            df['master_course_name'] = master_course_names
            df['course_match_confidence'] = course_match_confidences
            df['course_matched'] = course_matched_flags
            
            # Save updated file
            df.to_parquet(file_path, index=False)
            logger.info(f"✅ Updated {len(df)} records in {file_path}")
            
            self.stats['files_processed'] += 1
            self.stats['records_updated'] += len(df)
            
        except Exception as e:
            logger.error(f"❌ Error processing {file_path}: {e}")
    
    def process_all_counselling_files(self):
        """Process all counselling parquet files"""
        logger.info("🔄 Processing all counselling files...")
        
        # Find all counselling parquet files
        counselling_files = []
        for year_dir in ['2023', '2024']:
            year_path = Path(f'data/parquet/{year_dir}')
            if year_path.exists():
                for file_path in year_path.glob('cutoffs_*.parquet'):
                    counselling_files.append(file_path)
        
        if not counselling_files:
            logger.error("❌ No counselling parquet files found")
            return False
        
        logger.info(f"📁 Found {len(counselling_files)} counselling files to process")
        
        for file_path in counselling_files:
            self.add_relationships_to_file(file_path)
        
        return True
    
    def generate_report(self):
        """Generate processing report"""
        logger.info("📋 MASTER DATA RELATIONSHIP ADDITION REPORT")
        logger.info("=" * 50)
        logger.info(f"Files processed: {self.stats['files_processed']}")
        logger.info(f"Records updated: {self.stats['records_updated']:,}")
        logger.info(f"College matches: {self.stats['college_matches']:,}")
        logger.info(f"Course matches: {self.stats['course_matches']:,}")
        
        # Calculate match rates
        if self.stats['records_updated'] > 0:
            college_match_rate = (self.stats['college_matches'] / self.stats['records_updated']) * 100
            course_match_rate = (self.stats['course_matches'] / self.stats['records_updated']) * 100
            logger.info(f"College match rate: {college_match_rate:.1f}%")
            logger.info(f"Course match rate: {course_match_rate:.1f}%")
        
        logger.info("")
        logger.info("🎉 RELATIONSHIP ADDITION COMPLETED!")
        logger.info("📝 Next steps:")
        logger.info("   1. Update APIs to use master_college_id and master_course_id")
        logger.info("   2. Test search functionality with proper relationships")
        logger.info("   3. Review low-confidence matches if needed")
    
    def run(self):
        """Main execution function"""
        logger.info("🚀 MASTER DATA RELATIONSHIP ADDER")
        logger.info("=" * 40)
        logger.info("Adding master data relationships to existing parquet files")
        logger.info("Using existing hierarchical matching for speed")
        logger.info("")
        
        try:
            # Load master data
            if not self.load_master_data():
                return False
            
            # Process all counselling files
            if not self.process_all_counselling_files():
                return False
            
            # Generate report
            self.generate_report()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Relationship addition failed: {e}")
            return False

def main():
    adder = MasterDataRelationshipAdder()
    success = adder.run()
    
    if success:
        logger.info("\n✅ Master data relationships added successfully!")
    else:
        logger.error("\n❌ Failed to add master data relationships!")
        exit(1)

if __name__ == "__main__":
    main()
