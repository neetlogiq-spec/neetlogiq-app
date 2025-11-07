#!/usr/bin/env python3
"""
Setup Master Data with Proper IDs
Creates proper master data with unique IDs for colleges and courses
This should be run before using the standard importer for mapping

Usage:
    python3 setup-master-data-with-ids.py
"""

import pandas as pd
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List
import re

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MasterDataSetup:
    def __init__(self):
        self.colleges = []
        self.courses = []
        self.stats = {
            'colleges_created': 0,
            'courses_created': 0
        }
        
    def load_standard_courses(self) -> List[Dict]:
        """Load standard courses from text file"""
        logger.info("📖 Loading standard courses...")
        
        courses = []
        courses_file = Path('data/standard_courses.txt')
        
        if not courses_file.exists():
            logger.error(f"❌ Standard courses file not found: {courses_file}")
            return courses
        
        try:
            with open(courses_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            course_id = 1
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                # Parse course information
                parts = line.split(' - ')
                if len(parts) >= 2:
                    course_name = parts[0].strip()
                    description = parts[1].strip() if len(parts) > 1 else ""
                else:
                    course_name = line
                    description = ""
                
                # Determine stream and branch
                stream, branch = self.categorize_course(course_name)
                
                course = {
                    'id': f'course_{course_id:04d}',
                    'name': course_name,
                    'code': self.generate_course_code(course_name),
                    'stream': stream,
                    'branch': branch,
                    'degree_type': self.get_degree_type(course_name),
                    'duration_years': self.get_duration(course_name),
                    'syllabus': f"Curriculum for {course_name}",
                    'career_prospects': f"Medical Professional, Healthcare Worker",
                    'description': description,
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                
                courses.append(course)
                course_id += 1
            
            logger.info(f"✅ Loaded {len(courses)} standard courses")
            return courses
            
        except Exception as e:
            logger.error(f"❌ Error loading standard courses: {e}")
            return []
    
    def categorize_course(self, course_name: str) -> tuple:
        """Categorize course into stream and branch"""
        course_upper = course_name.upper()
        
        # Determine stream
        if any(term in course_upper for term in ['MD', 'MS', 'DM', 'MCH', 'MDS']):
            stream = 'Medical'
        elif any(term in course_upper for term in ['BDS', 'MDS']):
            stream = 'Dental'
        elif any(term in course_upper for term in ['DNB']):
            stream = 'DNB'
        elif any(term in course_upper for term in ['MBBS', 'BDS']):
            stream = 'Undergraduate'
        else:
            stream = 'Medical'  # Default
        
        # Determine branch
        if 'GENERAL MEDICINE' in course_upper or 'MEDICINE' in course_upper:
            branch = 'General Medicine'
        elif 'GENERAL SURGERY' in course_upper or 'SURGERY' in course_upper:
            branch = 'General Surgery'
        elif 'PEDIATRICS' in course_upper or 'PEDIATRIC' in course_upper:
            branch = 'Pediatrics'
        elif 'OBSTETRICS' in course_upper or 'GYNECOLOGY' in course_upper:
            branch = 'Obstetrics & Gynecology'
        elif 'ORTHOPEDICS' in course_upper or 'ORTHOPAEDIC' in course_upper:
            branch = 'Orthopedics'
        elif 'OPHTHALMOLOGY' in course_upper or 'OPHTHALMIC' in course_upper:
            branch = 'Ophthalmology'
        elif 'ENT' in course_upper or 'OTORHINOLARYNGOLOGY' in course_upper:
            branch = 'ENT'
        elif 'DERMATOLOGY' in course_upper or 'DERMATOLOGIC' in course_upper:
            branch = 'Dermatology'
        elif 'PSYCHIATRY' in course_upper or 'PSYCHIATRIC' in course_upper:
            branch = 'Psychiatry'
        elif 'RADIOLOGY' in course_upper or 'RADIOLOGIC' in course_upper:
            branch = 'Radiology'
        elif 'ANESTHESIOLOGY' in course_upper or 'ANESTHESIA' in course_upper:
            branch = 'Anesthesiology'
        elif 'PATHOLOGY' in course_upper or 'PATHOLOGIC' in course_upper:
            branch = 'Pathology'
        elif 'MICROBIOLOGY' in course_upper or 'MICROBIOLOGIC' in course_upper:
            branch = 'Microbiology'
        elif 'PHARMACOLOGY' in course_upper or 'PHARMACOLOGIC' in course_upper:
            branch = 'Pharmacology'
        elif 'FORENSIC' in course_upper:
            branch = 'Forensic Medicine'
        elif 'COMMUNITY' in course_upper or 'PUBLIC HEALTH' in course_upper:
            branch = 'Community Medicine'
        elif 'PHYSIOLOGY' in course_upper:
            branch = 'Physiology'
        elif 'ANATOMY' in course_upper:
            branch = 'Anatomy'
        elif 'BIOCHEMISTRY' in course_upper:
            branch = 'Biochemistry'
        elif 'DENTAL' in course_upper or 'ORAL' in course_upper:
            branch = 'Dental'
        else:
            branch = 'General'
        
        return stream, branch
    
    def generate_course_code(self, course_name: str) -> str:
        """Generate a course code from course name"""
        # Extract key terms and create code
        words = course_name.upper().split()
        code_parts = []
        
        for word in words:
            if len(word) > 2 and word not in ['OF', 'AND', 'THE', 'IN', 'FOR', 'WITH']:
                code_parts.append(word[:3])
        
        return ''.join(code_parts[:3]) if code_parts else 'GEN'
    
    def get_degree_type(self, course_name: str) -> str:
        """Get degree type from course name"""
        course_upper = course_name.upper()
        
        if 'MD' in course_upper:
            return 'MD'
        elif 'MS' in course_upper:
            return 'MS'
        elif 'DM' in course_upper:
            return 'DM'
        elif 'MCH' in course_upper:
            return 'MCH'
        elif 'MDS' in course_upper:
            return 'MDS'
        elif 'DNB' in course_upper:
            return 'DNB'
        elif 'MBBS' in course_upper:
            return 'MBBS'
        elif 'BDS' in course_upper:
            return 'BDS'
        else:
            return 'Other'
    
    def get_duration(self, course_name: str) -> int:
        """Get duration in years from course name"""
        course_upper = course_name.upper()
        
        if 'MBBS' in course_upper:
            return 5
        elif 'BDS' in course_upper:
            return 5
        elif 'MD' in course_upper or 'MS' in course_upper:
            return 3
        elif 'MDS' in course_upper:
            return 3
        elif 'DM' in course_upper or 'MCH' in course_upper:
            return 3
        elif 'DNB' in course_upper:
            return 3
        else:
            return 3  # Default for postgraduate courses
    
    def load_foundation_colleges(self) -> List[Dict]:
        """Load colleges from foundation files"""
        logger.info("📖 Loading foundation colleges...")
        
        colleges = []
        college_id = 1
        
        # Foundation files
        foundation_files = [
            ('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/med.xlsx', 'Medical'),
            ('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental.xlsx', 'Dental'),
            ('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dnb.xlsx', 'DNB')
        ]
        
        for file_path, college_type in foundation_files:
            if not Path(file_path).exists():
                logger.warning(f"⚠️ Foundation file not found: {file_path}")
                continue
            
            try:
                df = pd.read_excel(file_path)
                logger.info(f"📊 Processing {file_path}: {len(df)} colleges")
                
                for idx, row in df.iterrows():
                    college_name = str(row.get('COLLEGE/INSTITUTE', '')).strip()
                    state = str(row.get('STATE', '')).strip()
                    address = str(row.get('ADDRESS', '')).strip()
                    
                    if not college_name or college_name == 'nan':
                        continue
                    
                    college = {
                        'id': f'college_{college_id:04d}',
                        'name': college_name,
                        'state': state,
                        'city': self.extract_city_from_address(address),
                        'type': college_type,
                        'management': 'Unknown',  # Will be updated later
                        'university_affiliation': None,  # Will be updated later
                        'website': None,
                        'address': address,
                        'established_year': None,
                        'recognition': None,
                        'affiliation': None,
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    colleges.append(college)
                    college_id += 1
                
            except Exception as e:
                logger.error(f"❌ Error processing {file_path}: {e}")
                continue
        
        self.stats['colleges_created'] = len(colleges)
        logger.info(f"✅ Loaded {len(colleges)} colleges from foundation files")
        return colleges
    
    def extract_city_from_address(self, address: str) -> str:
        """Extract city from address"""
        if not address or address == 'nan':
            return 'Unknown'
        
        # Common city patterns
        address_upper = address.upper()
        
        # Check for common city names
        cities = [
            'MUMBAI', 'DELHI', 'BANGALORE', 'CHENNAI', 'KOLKATA', 'HYDERABAD',
            'PUNE', 'AHMEDABAD', 'JAIPUR', 'SURAT', 'LUCKNOW', 'KANPUR',
            'NAGPUR', 'INDORE', 'THANE', 'BHOPAL', 'VISAKHAPATNAM', 'PIMRI',
            'VADODARA', 'FIZABAD', 'LUDHIANA', 'AGRA', 'NASHIK', 'FARIDABAD',
            'MEERUT', 'RAJKOT', 'KALYAN', 'VASANT KUNJ', 'VARANASI', 'SRINAGAR',
            'AURANGABAD', 'NASHIK', 'SOLAPUR', 'VADODARA', 'KOLHAPUR', 'AMRAVATI',
            'NANDED', 'KOLHAPUR', 'SANGALI', 'MALEGAON', 'BHANDARA', 'PARBHANI',
            'ICHALKARANJI', 'JALGAON', 'LATUR', 'AHMEDNAGAR', 'CHANDRAPUR',
            'PARBHANI', 'JALNA', 'BHIWANDI', 'AMALNER', 'DHULE', 'NANDURBAR',
            'YAVATMAL', 'KAMPTEE', 'ACHALPUR', 'OSMANABAD', 'NANDED', 'WARDHA',
            'UDGIR', 'AKOLA', 'AMARAVATI', 'BARSI', 'YAVATMAL', 'AKOLA',
            'AMRAVATI', 'CHANDRAPUR', 'BEED', 'JALNA', 'LATUR', 'OSMANABAD',
            'PARBHANI', 'WASHIM', 'YAVATMAL', 'NANDED', 'HINGOLI', 'GADCHIROLI'
        ]
        
        for city in cities:
            if city in address_upper:
                return city.title()
        
        # Try to extract from comma-separated parts
        parts = address.split(',')
        if len(parts) > 1:
            potential_city = parts[-1].strip()
            if len(potential_city) > 2:
                return potential_city.title()
        
        return 'Unknown'
    
    def save_master_data(self):
        """Save master data to parquet files"""
        logger.info("💾 Saving master data...")
        
        # Create data directory
        data_dir = Path('data/parquet')
        data_dir.mkdir(exist_ok=True)
        
        # Save colleges
        if self.colleges:
            df_colleges = pd.DataFrame(self.colleges)
            colleges_path = data_dir / 'colleges.parquet'
            df_colleges.to_parquet(colleges_path, index=False)
            logger.info(f"✅ Saved {len(self.colleges)} colleges to {colleges_path}")
        
        # Save courses
        if self.courses:
            df_courses = pd.DataFrame(self.courses)
            courses_path = data_dir / 'courses.parquet'
            df_courses.to_parquet(courses_path, index=False)
            logger.info(f"✅ Saved {len(self.courses)} courses to {courses_path}")
    
    def generate_setup_report(self):
        """Generate setup report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'colleges_created': self.stats['colleges_created'],
                'courses_created': self.stats['courses_created']
            },
            'files_created': [
                'data/parquet/colleges.parquet',
                'data/parquet/courses.parquet'
            ],
            'next_steps': [
                'Run standard-importer.py to map counselling data',
                'Update APIs to use master data relationships',
                'Test search functionality'
            ]
        }
        
        # Save report
        report_path = Path('data/mappings/master_data_setup_report.json')
        report_path.parent.mkdir(exist_ok=True)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info("📋 MASTER DATA SETUP REPORT")
        logger.info("=" * 40)
        logger.info(f"Colleges created: {self.stats['colleges_created']:,}")
        logger.info(f"Courses created: {self.stats['courses_created']:,}")
        logger.info("")
        logger.info("📁 Files created:")
        logger.info("   ✅ data/parquet/colleges.parquet")
        logger.info("   ✅ data/parquet/courses.parquet")
        logger.info("")
        logger.info("📝 Next steps:")
        logger.info("   1. Run standard-importer.py to map counselling data")
        logger.info("   2. Update APIs to use master data relationships")
        logger.info("   3. Test search functionality")
        
        return report_path
    
    def run(self):
        """Main execution function"""
        logger.info("🚀 MASTER DATA SETUP")
        logger.info("=" * 30)
        logger.info("Setting up master data with proper IDs for:")
        logger.info("1. Colleges (from foundation files)")
        logger.info("2. Courses (from standard_courses.txt)")
        logger.info("")
        
        try:
            # Step 1: Load and create courses
            self.courses = self.load_standard_courses()
            
            # Step 2: Load and create colleges
            self.colleges = self.load_foundation_colleges()
            
            # Step 3: Save master data
            self.save_master_data()
            
            # Step 4: Generate report
            self.generate_setup_report()
            
            logger.info("")
            logger.info("🎉 MASTER DATA SETUP COMPLETED SUCCESSFULLY!")
            logger.info("📝 Ready for standard-importer.py mapping")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Master data setup failed: {e}")
            return False

def main():
    setup = MasterDataSetup()
    success = setup.run()
    
    if success:
        logger.info("\n✅ Master data setup completed!")
    else:
        logger.error("\n❌ Master data setup failed!")
        exit(1)

if __name__ == "__main__":
    main()
