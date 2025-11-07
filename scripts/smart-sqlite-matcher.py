#!/usr/bin/env python3
"""
Smart SQLite Matcher
Uses SQLite's built-in capabilities for fast matching instead of Python loops

Usage:
    python3 smart-sqlite-matcher.py
"""

import sqlite3
import logging
from pathlib import Path
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SmartSQLiteMatcher:
    def __init__(self):
        self.staging_db = 'data/staging.db'
        self.setup_smart_matching()
    
    def setup_smart_matching(self):
        """Setup SQLite for smart matching using built-in capabilities"""
        logger.info("🧠 Setting up smart SQLite matching...")
        
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Create master colleges table in SQLite for fast joins
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS master_colleges (
                id TEXT PRIMARY KEY,
                name TEXT,
                state TEXT,
                normalized_name TEXT
            )
        ''')
        
        # Create master courses table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS master_courses (
                id TEXT PRIMARY KEY,
                name TEXT,
                normalized_name TEXT
            )
        ''')
        
        # Load master data into SQLite
        self.load_master_data_to_sqlite()
        
        # Create indexes for fast matching
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_master_colleges_normalized ON master_colleges(normalized_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_master_courses_normalized ON master_courses(normalized_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_college ON counselling_data(college_institute)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_counselling_course ON counselling_data(course)')
        
        conn.commit()
        conn.close()
        
        logger.info("✅ Smart SQLite setup complete")
    
    def load_master_data_to_sqlite(self):
        """Load master data from parquet to SQLite for fast joins"""
        logger.info("📖 Loading master data to SQLite...")
        
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Clear existing master data
        cursor.execute('DELETE FROM master_colleges')
        cursor.execute('DELETE FROM master_courses')
        
        # Load master colleges
        colleges_path = Path('data/parquet/colleges.parquet')
        if colleges_path.exists():
            df_colleges = pd.read_parquet(colleges_path)
            for idx, row in df_colleges.iterrows():
                cursor.execute('''
                    INSERT INTO master_colleges (id, name, state, normalized_name)
                    VALUES (?, ?, ?, ?)
                ''', (
                    row.get('id', f'college_{idx}'),
                    row.get('name', ''),
                    row.get('state', ''),
                    row.get('normalized_name', '')
                ))
            logger.info(f"✅ Loaded {len(df_colleges)} master colleges")
        
        # Load master courses
        courses_path = Path('data/parquet/courses.parquet')
        if courses_path.exists():
            df_courses = pd.read_parquet(courses_path)
            for idx, row in df_courses.iterrows():
                cursor.execute('''
                    INSERT INTO master_courses (id, name, normalized_name)
                    VALUES (?, ?, ?, ?)
                ''', (
                    row.get('id', f'course_{idx}'),
                    row.get('name', ''),
                    row.get('normalized_name', '')
                ))
            logger.info(f"✅ Loaded {len(df_courses)} master courses")
        
        conn.commit()
        conn.close()
    
    def normalize_text(self, text: str) -> str:
        """Simple text normalization"""
        if not text or pd.isna(text):
            return ""
        
        normalized = str(text).upper().strip()
        normalized = normalized.replace('  ', ' ')
        
        # Common normalizations
        normalizations = {
            'GOVT': 'GOVERNMENT',
            'GMC': 'GOVERNMENT MEDICAL COLLEGE',
            'GMCH': 'GOVERNMENT MEDICAL COLLEGE AND HOSPITAL',
            'INST': 'INSTITUTE',
            'COLLAGE': 'COLLEGE',
            'HOSP': 'HOSPITAL',
            'MED': 'MEDICAL',
            'UNIV': 'UNIVERSITY',
            'CENTRE': 'CENTER',
            '&': 'AND',
        }
        
        for abbr, full in normalizations.items():
            normalized = normalized.replace(abbr, full)
            
        return normalized
    
    def smart_match_colleges(self):
        """Use SQLite's built-in capabilities for fast college matching"""
        logger.info("🎯 Smart matching colleges using SQLite...")
        
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Step 1: Exact matches using SQL JOIN
        logger.info("📊 Step 1: Exact matches...")
        cursor.execute('''
            UPDATE counselling_data 
            SET 
                matched_college_id = mc.id,
                matched_college_name = mc.name,
                match_confidence = 1.0,
                match_method = 'exact_match',
                match_pass = 1,
                is_unmatched = 0,
                master_college_id = mc.id,
                master_college_name = mc.name
            FROM master_colleges mc
            WHERE counselling_data.college_institute = mc.normalized_name
        ''')
        exact_matches = cursor.rowcount
        logger.info(f"✅ Found {exact_matches} exact matches")
        
        # Step 2: Fuzzy matches using SQL LIKE
        logger.info("📊 Step 2: Fuzzy matches...")
        cursor.execute('''
            UPDATE counselling_data 
            SET 
                matched_college_id = mc.id,
                matched_college_name = mc.name,
                match_confidence = 0.9,
                match_method = 'fuzzy_match',
                match_pass = 2,
                is_unmatched = 0,
                master_college_id = mc.id,
                master_college_name = mc.name
            FROM master_colleges mc
            WHERE counselling_data.is_unmatched = 1 
            AND (
                mc.normalized_name LIKE '%' || counselling_data.college_institute || '%'
                OR counselling_data.college_institute LIKE '%' || mc.normalized_name || '%'
            )
        ''')
        fuzzy_matches = cursor.rowcount
        logger.info(f"✅ Found {fuzzy_matches} fuzzy matches")
        
        # Step 3: State-based matching for remaining unmatched
        logger.info("📊 Step 3: State-based matching...")
        cursor.execute('''
            UPDATE counselling_data 
            SET 
                matched_college_id = mc.id,
                matched_college_name = mc.name,
                match_confidence = 0.8,
                match_method = 'state_match',
                match_pass = 3,
                is_unmatched = 0,
                master_college_id = mc.id,
                master_college_name = mc.name
            FROM master_colleges mc
            WHERE counselling_data.is_unmatched = 1 
            AND counselling_data.state = mc.state
            AND (
                mc.normalized_name LIKE '%' || counselling_data.college_institute || '%'
                OR counselling_data.college_institute LIKE '%' || mc.normalized_name || '%'
            )
        ''')
        state_matches = cursor.rowcount
        logger.info(f"✅ Found {state_matches} state-based matches")
        
        conn.commit()
        conn.close()
        
        total_matches = exact_matches + fuzzy_matches + state_matches
        logger.info(f"🎉 Total college matches: {total_matches}")
        
        return total_matches
    
    def smart_match_courses(self):
        """Use SQLite's built-in capabilities for fast course matching"""
        logger.info("🎯 Smart matching courses using SQLite...")
        
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Exact matches using SQL JOIN
        cursor.execute('''
            UPDATE counselling_data 
            SET 
                master_course_id = mc.id,
                master_course_name = mc.name,
                course_match_confidence = 1.0,
                course_matched = 1
            FROM master_courses mc
            WHERE counselling_data.course = mc.normalized_name
        ''')
        exact_matches = cursor.rowcount
        logger.info(f"✅ Found {exact_matches} exact course matches")
        
        # Fuzzy matches using SQL LIKE
        cursor.execute('''
            UPDATE counselling_data 
            SET 
                master_course_id = mc.id,
                master_course_name = mc.name,
                course_match_confidence = 0.9,
                course_matched = 1
            FROM master_courses mc
            WHERE counselling_data.course_matched = 0
            AND (
                mc.normalized_name LIKE '%' || counselling_data.course || '%'
                OR counselling_data.course LIKE '%' || mc.normalized_name || '%'
            )
        ''')
        fuzzy_matches = cursor.rowcount
        logger.info(f"✅ Found {fuzzy_matches} fuzzy course matches")
        
        conn.commit()
        conn.close()
        
        total_matches = exact_matches + fuzzy_matches
        logger.info(f"🎉 Total course matches: {total_matches}")
        
        return total_matches
    
    def get_final_stats(self) -> dict:
        """Get final matching statistics"""
        conn = sqlite3.connect(self.staging_db)
        cursor = conn.cursor()
        
        # Get total records
        cursor.execute('SELECT COUNT(*) FROM counselling_data')
        total = cursor.fetchone()[0]
        
        # Get matched records
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 0')
        matched = cursor.fetchone()[0]
        
        # Get unmatched records
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE is_unmatched = 1')
        unmatched = cursor.fetchone()[0]
        
        # Get course matches
        cursor.execute('SELECT COUNT(*) FROM counselling_data WHERE course_matched = 1')
        course_matched = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'total': total,
            'matched': matched,
            'unmatched': unmatched,
            'course_matched': course_matched,
            'match_rate': (matched / total * 100) if total > 0 else 0,
            'course_match_rate': (course_matched / total * 100) if total > 0 else 0
        }
    
    def run(self):
        """Run smart matching"""
        logger.info("🚀 SMART SQLITE MATCHER")
        logger.info("=" * 40)
        logger.info("Using SQLite's built-in capabilities for fast matching")
        logger.info("No Python loops - pure SQL operations!")
        logger.info("")
        
        try:
            # Smart match colleges
            college_matches = self.smart_match_colleges()
            
            # Smart match courses
            course_matches = self.smart_match_courses()
            
            # Get final statistics
            stats = self.get_final_stats()
            
            logger.info("")
            logger.info("🎉 SMART MATCHING COMPLETED!")
            logger.info("📊 Final Statistics:")
            logger.info(f"   - Total records: {stats['total']:,}")
            logger.info(f"   - College matches: {stats['matched']:,} ({stats['match_rate']:.1f}%)")
            logger.info(f"   - Course matches: {stats['course_matched']:,} ({stats['course_match_rate']:.1f}%)")
            logger.info(f"   - Unmatched: {stats['unmatched']:,}")
            logger.info("")
            
            if stats['unmatched'] == 0:
                logger.info("🎉 100% matching achieved!")
                logger.info("📝 Ready to convert to parquet files")
            else:
                logger.info("📝 Next steps:")
                logger.info("   1. Use interactive mode for remaining unmatched records")
                logger.info("   2. Convert to parquet after 100% matching")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Smart matching failed: {e}")
            return False

def main():
    matcher = SmartSQLiteMatcher()
    success = matcher.run()
    
    if success:
        logger.info("\n✅ Smart matching completed successfully!")
    else:
        logger.error("\n❌ Smart matching failed!")
        exit(1)

if __name__ == "__main__":
    main()
