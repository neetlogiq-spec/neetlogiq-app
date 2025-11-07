#!/usr/bin/env python3
"""
Create Master Data Relationships
Links all three data layers: Master Data → Colleges/Courses Data → Counselling Data
This should have been done during import but was missed.

Usage:
    python3 create-master-data-relationships.py
"""

import pandas as pd
import json
import logging
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from difflib import SequenceMatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MasterDataRelationshipBuilder:
    def __init__(self):
        self.master_colleges = {}
        self.master_courses = {}
        self.college_mappings = {}  # counselling college name -> master college id
        self.course_mappings = {}   # counselling course name -> master course id
        self.stats = {
            'master_colleges_loaded': 0,
            'master_courses_loaded': 0,
            'college_mappings_created': 0,
            'course_mappings_created': 0,
            'counselling_records_updated': 0
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
            self.stats['master_colleges_loaded'] = len(self.master_colleges)
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
            self.stats['master_courses_loaded'] = len(self.master_courses)
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
    
    def find_best_college_match(self, counselling_college_name: str, counselling_state: str = "") -> Tuple[Optional[str], float]:
        """Find best matching college in master data"""
        if not counselling_college_name:
            return None, 0.0
        
        normalized_counselling = self.normalize_text(counselling_college_name)
        best_match = None
        best_confidence = 0.0
        
        # First pass: Exact matches
        for college_id, college_data in self.master_colleges.items():
            if college_data['normalized_name'] == normalized_counselling:
                return college_id, 1.0
        
        # Second pass: Check aliases
        for college_id, college_data in self.master_colleges.items():
            for alias in college_data['aliases']:
                if alias == normalized_counselling:
                    return college_id, 0.95
        
        # Third pass: Fuzzy matching
        for college_id, college_data in self.master_colleges.items():
            similarity = self.calculate_similarity(normalized_counselling, college_data['normalized_name'])
            if similarity > best_confidence:
                best_match = college_id
                best_confidence = similarity
            
            # Check aliases
            for alias in college_data['aliases']:
                similarity = self.calculate_similarity(normalized_counselling, alias)
                if similarity > best_confidence:
                    best_match = college_id
                    best_confidence = similarity
        
        # State-based filtering
        if counselling_state and best_match and best_confidence > 0.6:
            matched_college = self.master_colleges[best_match]
            if matched_college['state'].upper() != counselling_state.upper():
                best_confidence *= 0.8
        
        return best_match, best_confidence
    
    def find_best_course_match(self, counselling_course_name: str) -> Tuple[Optional[str], float]:
        """Find best matching course in master data"""
        if not counselling_course_name:
            return None, 0.0
        
        normalized_counselling = self.normalize_text(counselling_course_name)
        best_match = None
        best_confidence = 0.0
        
        # First pass: Exact matches
        for course_id, course_data in self.master_courses.items():
            if course_data['normalized_name'] == normalized_counselling:
                return course_id, 1.0
        
        # Second pass: Check aliases
        for course_id, course_data in self.master_courses.items():
            for alias in course_data['aliases']:
                if alias == normalized_counselling:
                    return course_id, 0.95
        
        # Third pass: Fuzzy matching
        for course_id, course_data in self.master_courses.items():
            similarity = self.calculate_similarity(normalized_counselling, course_data['normalized_name'])
            if similarity > best_confidence:
                best_match = course_id
                best_confidence = similarity
            
            # Check aliases
            for alias in course_data['aliases']:
                similarity = self.calculate_similarity(normalized_counselling, alias)
                if similarity > best_confidence:
                    best_match = course_id
                    best_confidence = similarity
        
        return best_match, best_confidence
    
    def create_college_mappings(self):
        """Create mappings from counselling college names to master college IDs"""
        logger.info("🔗 Creating college mappings...")
        
        # Get unique college names from all counselling data
        counselling_files = [
            'data/parquet/2024/cutoffs_aiq_2024.parquet',
            'data/parquet/2024/cutoffs_kea_2024.parquet',
            'data/parquet/2023/cutoffs_aiq_2023.parquet',
            'data/parquet/2023/cutoffs_kea_2023.parquet'
        ]
        
        unique_colleges = set()
        for file_path in counselling_files:
            if Path(file_path).exists():
                df = pd.read_parquet(file_path)
                if 'collegeInstitute' in df.columns:
                    for college_name in df['collegeInstitute'].unique():
                        if pd.notna(college_name):
                            unique_colleges.add(str(college_name))
        
        logger.info(f"📊 Found {len(unique_colleges)} unique college names in counselling data")
        
        # Create mappings
        for college_name in unique_colleges:
            # Extract clean college name
            college_parts = college_name.split(',')
            clean_name = college_parts[0].strip()
            state = college_parts[1].strip() if len(college_parts) > 1 else ""
            
            # Find best match
            matched_id, confidence = self.find_best_college_match(clean_name, state)
            
            if matched_id and confidence >= 0.7:  # Only keep high-confidence matches
                self.college_mappings[college_name] = {
                    'master_college_id': matched_id,
                    'confidence': confidence,
                    'master_college_name': self.master_colleges[matched_id]['name']
                }
                self.stats['college_mappings_created'] += 1
        
        logger.info(f"✅ Created {len(self.college_mappings)} college mappings")
    
    def create_course_mappings(self):
        """Create mappings from counselling course names to master course IDs"""
        logger.info("🔗 Creating course mappings...")
        
        # Get unique course names from all counselling data
        counselling_files = [
            'data/parquet/2024/cutoffs_aiq_2024.parquet',
            'data/parquet/2024/cutoffs_kea_2024.parquet',
            'data/parquet/2023/cutoffs_aiq_2023.parquet',
            'data/parquet/2023/cutoffs_kea_2023.parquet'
        ]
        
        unique_courses = set()
        for file_path in counselling_files:
            if Path(file_path).exists():
                df = pd.read_parquet(file_path)
                if 'course' in df.columns:
                    for course_name in df['course'].unique():
                        if pd.notna(course_name):
                            unique_courses.add(str(course_name))
        
        logger.info(f"📊 Found {len(unique_courses)} unique course names in counselling data")
        
        # Create mappings
        for course_name in unique_courses:
            # Find best match
            matched_id, confidence = self.find_best_course_match(course_name)
            
            if matched_id and confidence >= 0.7:  # Only keep high-confidence matches
                self.course_mappings[course_name] = {
                    'master_course_id': matched_id,
                    'confidence': confidence,
                    'master_course_name': self.master_courses[matched_id]['name']
                }
                self.stats['course_mappings_created'] += 1
        
        logger.info(f"✅ Created {len(self.course_mappings)} course mappings")
    
    def update_counselling_data_with_relationships(self):
        """Update counselling data files with master data relationships"""
        logger.info("🔄 Updating counselling data with relationships...")
        
        counselling_files = [
            'data/parquet/2024/cutoffs_aiq_2024.parquet',
            'data/parquet/2024/cutoffs_kea_2024.parquet',
            'data/parquet/2023/cutoffs_aiq_2023.parquet',
            'data/parquet/2023/cutoffs_kea_2023.parquet'
        ]
        
        for file_path in counselling_files:
            if not Path(file_path).exists():
                continue
                
            logger.info(f"📝 Processing {file_path}")
            df = pd.read_parquet(file_path)
            
            # Add master data relationship columns
            df['master_college_id'] = df['collegeInstitute'].map(
                lambda x: self.college_mappings.get(x, {}).get('master_college_id', None)
            )
            df['master_college_name'] = df['collegeInstitute'].map(
                lambda x: self.college_mappings.get(x, {}).get('master_college_name', None)
            )
            df['college_match_confidence'] = df['collegeInstitute'].map(
                lambda x: self.college_mappings.get(x, {}).get('confidence', 0.0)
            )
            
            df['master_course_id'] = df['course'].map(
                lambda x: self.course_mappings.get(x, {}).get('master_course_id', None)
            )
            df['master_course_name'] = df['course'].map(
                lambda x: self.course_mappings.get(x, {}).get('master_course_name', None)
            )
            df['course_match_confidence'] = df['course'].map(
                lambda x: self.course_mappings.get(x, {}).get('confidence', 0.0)
            )
            
            # Save updated file
            df.to_parquet(file_path, index=False)
            self.stats['counselling_records_updated'] += len(df)
            logger.info(f"✅ Updated {len(df)} records in {file_path}")
    
    def save_mapping_tables(self):
        """Save mapping tables for reference and debugging"""
        logger.info("💾 Saving mapping tables...")
        
        # Save college mappings
        college_mappings_path = Path('data/mappings/college_mappings.json')
        college_mappings_path.parent.mkdir(exist_ok=True)
        
        with open(college_mappings_path, 'w', encoding='utf-8') as f:
            json.dump(self.college_mappings, f, indent=2, ensure_ascii=False)
        
        # Save course mappings
        course_mappings_path = Path('data/mappings/course_mappings.json')
        course_mappings_path.parent.mkdir(exist_ok=True)
        
        with open(course_mappings_path, 'w', encoding='utf-8') as f:
            json.dump(self.course_mappings, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved college mappings to {college_mappings_path}")
        logger.info(f"✅ Saved course mappings to {course_mappings_path}")
    
    def generate_relationship_report(self):
        """Generate a comprehensive report on the relationships created"""
        logger.info("📋 Generating relationship report...")
        
        # Calculate statistics
        total_college_mappings = len(self.college_mappings)
        total_course_mappings = len(self.course_mappings)
        
        # Count high-confidence mappings
        high_conf_college_mappings = sum(1 for m in self.college_mappings.values() if m['confidence'] >= 0.9)
        high_conf_course_mappings = sum(1 for m in self.course_mappings.values() if m['confidence'] >= 0.9)
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'master_colleges_loaded': self.stats['master_colleges_loaded'],
                'master_courses_loaded': self.stats['master_courses_loaded'],
                'college_mappings_created': total_college_mappings,
                'course_mappings_created': total_course_mappings,
                'counselling_records_updated': self.stats['counselling_records_updated']
            },
            'mapping_quality': {
                'high_confidence_college_mappings': high_conf_college_mappings,
                'high_confidence_course_mappings': high_conf_course_mappings,
                'college_mapping_rate': f"{(total_college_mappings / len(set([m['master_college_id'] for m in self.college_mappings.values()])) * 100):.1f}%" if self.college_mappings else "0%",
                'course_mapping_rate': f"{(total_course_mappings / len(set([m['master_course_id'] for m in self.course_mappings.values()])) * 100):.1f}%" if self.course_mappings else "0%"
            },
            'files_updated': [
                'data/parquet/2024/cutoffs_aiq_2024.parquet',
                'data/parquet/2024/cutoffs_kea_2024.parquet',
                'data/parquet/2023/cutoffs_aiq_2023.parquet',
                'data/parquet/2023/cutoffs_kea_2023.parquet'
            ],
            'new_columns_added': [
                'master_college_id',
                'master_college_name', 
                'college_match_confidence',
                'master_course_id',
                'master_course_name',
                'course_match_confidence'
            ]
        }
        
        # Save report
        report_path = Path('data/mappings/relationship_report.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info("📋 RELATIONSHIP BUILDING REPORT")
        logger.info("=" * 50)
        logger.info(f"Master colleges loaded: {self.stats['master_colleges_loaded']:,}")
        logger.info(f"Master courses loaded: {self.stats['master_courses_loaded']:,}")
        logger.info(f"College mappings created: {total_college_mappings:,}")
        logger.info(f"Course mappings created: {total_course_mappings:,}")
        logger.info(f"Counselling records updated: {self.stats['counselling_records_updated']:,}")
        logger.info("")
        logger.info("🎯 MAPPING QUALITY")
        logger.info("-" * 20)
        logger.info(f"High confidence college mappings: {high_conf_college_mappings:,}")
        logger.info(f"High confidence course mappings: {high_conf_course_mappings:,}")
        logger.info("")
        logger.info("📁 FILES UPDATED")
        logger.info("-" * 15)
        for file_path in report['files_updated']:
            if Path(file_path).exists():
                logger.info(f"✅ {file_path}")
            else:
                logger.info(f"❌ {file_path} (not found)")
        
        return report_path
    
    def run(self):
        """Main execution function"""
        logger.info("🚀 MASTER DATA RELATIONSHIP BUILDER")
        logger.info("=" * 50)
        logger.info("This script creates proper relationships between:")
        logger.info("1. Master Data (colleges.parquet, courses.parquet)")
        logger.info("2. Counselling Data (cutoffs_*.parquet)")
        logger.info("3. Seat Data (if exists)")
        logger.info("")
        
        try:
            # Step 1: Load master data
            if not self.load_master_data():
                logger.error("❌ Failed to load master data")
                return False
            
            # Step 2: Create college mappings
            self.create_college_mappings()
            
            # Step 3: Create course mappings
            self.create_course_mappings()
            
            # Step 4: Update counselling data with relationships
            self.update_counselling_data_with_relationships()
            
            # Step 5: Save mapping tables
            self.save_mapping_tables()
            
            # Step 6: Generate report
            report_path = self.generate_relationship_report()
            
            logger.info("")
            logger.info("🎉 RELATIONSHIP BUILDING COMPLETED SUCCESSFULLY!")
            logger.info("📝 Next steps:")
            logger.info("   1. Update APIs to use master_college_id and master_course_id")
            logger.info("   2. Test search functionality with proper relationships")
            logger.info("   3. Review low-confidence mappings if needed")
            logger.info(f"   4. Check report: {report_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Relationship building failed: {e}")
            return False

def main():
    builder = MasterDataRelationshipBuilder()
    success = builder.run()
    
    if success:
        logger.info("\n✅ All relationships created successfully!")
    else:
        logger.error("\n❌ Relationship building failed!")
        exit(1)

if __name__ == "__main__":
    main()
