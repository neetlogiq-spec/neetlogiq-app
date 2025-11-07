#!/usr/bin/env python3

import pandas as pd
import duckdb
import json
import os
from pathlib import Path
from fuzzywuzzy import fuzz
import re

class HierarchicalMatcher:
    def __init__(self, master_db_path='neetlogiq_master.db'):
        self.master_db_path = master_db_path
        self.conn = duckdb.connect(master_db_path)
        self.colleges_cache = None
        self.courses_cache = None
        
    def load_master_data(self):
        """Load master data from database"""
        print('📊 Loading master data...')
        
        # Load colleges
        colleges_df = self.conn.execute("""
            SELECT id, name, state, address, type 
            FROM colleges 
            ORDER BY name
        """).fetchdf()
        
        self.colleges_cache = colleges_df
        print(f'  ✅ Loaded {len(colleges_df)} colleges')
        
        # Load courses
        courses_df = self.conn.execute("""
            SELECT id, name, stream, degree_type 
            FROM courses 
            ORDER BY name
        """).fetchdf()
        
        self.courses_cache = courses_df
        print(f'  ✅ Loaded {len(courses_df)} courses')
        
    def normalize_text(self, text):
        """Normalize text for matching"""
        if not text or pd.isna(text):
            return ""
        
        # Convert to string and uppercase
        text = str(text).upper().strip()
        
        # Remove extra spaces
        text = re.sub(r'\s+', ' ', text)
        
        # Remove common suffixes
        suffixes_to_remove = [
            'COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'HOSPITAL', 'CENTRE', 'CENTER',
            'MEDICAL', 'DENTAL', 'SCIENCES', 'RESEARCH', 'TECHNOLOGY', 'ENGINEERING',
            'AND', 'OF', 'THE', 'FOR', 'IN', 'AT', 'ON', 'BY', 'WITH'
        ]
        
        for suffix in suffixes_to_remove:
            text = text.replace(suffix, '')
        
        # Remove special characters
        text = re.sub(r'[^\w\s]', '', text)
        
        # Remove extra spaces again
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def match_college_hierarchical(self, college_name, state=None, address=None):
        """Hierarchical college matching algorithm"""
        if not college_name or pd.isna(college_name):
            return None, 0.0, 'no_name'
        
        # Normalize input
        normalized_name = self.normalize_text(college_name)
        normalized_state = self.normalize_text(state) if state else None
        normalized_address = self.normalize_text(address) if address else None
        
        if not normalized_name:
            return None, 0.0, 'empty_name'
        
        # Step 1: State-based filtering (if state provided)
        candidates = self.colleges_cache.copy()
        if normalized_state:
            candidates = candidates[candidates['state'].str.upper().str.contains(normalized_state, na=False)]
        
        if len(candidates) == 0:
            candidates = self.colleges_cache.copy()
        
        # Step 2: Exact name matching
        exact_matches = candidates[candidates['name'].str.upper() == college_name.upper()]
        if len(exact_matches) > 0:
            best_match = exact_matches.iloc[0]
            return best_match['id'], 1.0, 'exact'
        
        # Step 3: Normalized name matching
        candidates['normalized_name'] = candidates['name'].apply(self.normalize_text)
        normalized_matches = candidates[candidates['normalized_name'] == normalized_name]
        if len(normalized_matches) > 0:
            best_match = normalized_matches.iloc[0]
            return best_match['id'], 0.95, 'normalized'
        
        # Step 4: Fuzzy matching with high threshold
        best_match = None
        best_score = 0
        best_method = 'no_match'
        
        for _, candidate in candidates.iterrows():
            # Name similarity
            name_score = fuzz.ratio(normalized_name, candidate['normalized_name'])
            
            # Address similarity (if available)
            address_score = 0
            if normalized_address and candidate['address']:
                candidate_address = self.normalize_text(candidate['address'])
                address_score = fuzz.ratio(normalized_address, candidate_address) * 0.3
            
            # Combined score
            total_score = name_score + address_score
            
            if total_score > best_score and total_score >= 80:
                best_score = total_score
                best_match = candidate
                best_method = 'fuzzy'
        
        if best_match is not None:
            return best_match['id'], best_score / 100, best_method
        
        # Step 5: Partial matching
        for _, candidate in candidates.iterrows():
            # Check if input name contains candidate name or vice versa
            if (normalized_name in candidate['normalized_name'] or 
                candidate['normalized_name'] in normalized_name):
                return candidate['id'], 0.7, 'partial'
        
        return None, 0.0, 'no_match'
    
    def match_course(self, course_name):
        """Match course name to master courses"""
        if not course_name or pd.isna(course_name):
            return None, 0.0, 'no_name'
        
        # Normalize input
        normalized_name = self.normalize_text(course_name)
        
        if not normalized_name:
            return None, 0.0, 'empty_name'
        
        # Exact matching
        exact_matches = self.courses_cache[self.courses_cache['name'].str.upper() == course_name.upper()]
        if len(exact_matches) > 0:
            best_match = exact_matches.iloc[0]
            return best_match['id'], 1.0, 'exact'
        
        # Fuzzy matching
        best_match = None
        best_score = 0
        
        for _, candidate in self.courses_cache.iterrows():
            candidate_normalized = self.normalize_text(candidate['name'])
            score = fuzz.ratio(normalized_name, candidate_normalized)
            
            if score > best_score and score >= 80:
                best_score = score
                best_match = candidate
        
        if best_match is not None:
            return best_match['id'], best_score / 100, 'fuzzy'
        
        return None, 0.0, 'no_match'
    
    def process_counselling_data(self, counselling_file, session_name, session_year, session_type):
        """Process counselling data file and match with master data"""
        print(f'📊 Processing counselling data: {counselling_file}')
        
        # Load counselling data
        if counselling_file.endswith('.csv'):
            df = pd.read_csv(counselling_file)
        elif counselling_file.endswith('.xlsx'):
            df = pd.read_excel(counselling_file)
        else:
            raise ValueError(f'Unsupported file format: {counselling_file}')
        
        print(f'  📁 Loaded {len(df)} records')
        
        # Create counselling session
        session_id = self.create_counselling_session(session_name, session_year, session_type)
        
        # Process each record
        processed_records = []
        matched_colleges = 0
        matched_courses = 0
        
        for idx, row in df.iterrows():
            if idx % 1000 == 0:
                print(f'  Processing record {idx + 1}/{len(df)}')
            
            # Extract data based on column names
            college_name = row.get('COLLEGE/INSTITUTE', row.get('collegeInstitute', ''))
            state = row.get('STATE', row.get('state', ''))
            course_name = row.get('COURSE', row.get('course', ''))
            all_india_rank = row.get('ALL_INDIA_RANK', row.get('allIndiaRank', 0))
            quota = row.get('QUOTA', row.get('quota', ''))
            category = row.get('CATEGORY', row.get('category', ''))
            round_name = row.get('ROUND', row.get('round', ''))
            year = row.get('YEAR', row.get('year', session_year))
            
            # Match college
            college_id, college_confidence, college_method = self.match_college_hierarchical(
                college_name, state
            )
            
            if college_id:
                matched_colleges += 1
            
            # Match course
            course_id, course_confidence, course_method = self.match_course(course_name)
            
            if course_id:
                matched_courses += 1
            
            # Create record
            record_id = f'counselling_{session_id}_{idx}_{int(pd.Timestamp.now().timestamp())}'
            
            record = {
                'id': record_id,
                'session_id': session_id,
                'college_id': college_id,
                'course_id': course_id,
                'all_india_rank': int(all_india_rank) if pd.notna(all_india_rank) else None,
                'quota': quota,
                'category': category,
                'round': round_name,
                'year': int(year) if pd.notna(year) else session_year,
                'state': state,
                'college_name': college_name,
                'course_name': course_name,
                'match_confidence': max(college_confidence, course_confidence),
                'match_method': f'{college_method}_{course_method}',
                'needs_manual_review': college_confidence < 0.8 or course_confidence < 0.8,
                'is_unmatched': college_id is None and course_id is None,
                'source_file': os.path.basename(counselling_file)
            }
            
            processed_records.append(record)
        
        # Insert records into database
        self.insert_counselling_records(processed_records)
        
        print(f'  ✅ Processed {len(processed_records)} records')
        print(f'  ✅ Matched colleges: {matched_colleges} ({matched_colleges/len(df)*100:.1f}%)')
        print(f'  ✅ Matched courses: {matched_courses} ({matched_courses/len(df)*100:.1f}%)')
        
        return processed_records
    
    def create_counselling_session(self, name, year, session_type):
        """Create counselling session and return session ID"""
        # Check if session already exists
        existing = self.conn.execute("""
            SELECT id FROM counselling_sessions 
            WHERE name = ? AND year = ? AND type = ?
        """, [name, year, session_type]).fetchone()
        
        if existing:
            return existing[0]
        
        # Get next available ID
        max_id = self.conn.execute("SELECT COALESCE(MAX(id), 0) FROM counselling_sessions").fetchone()[0]
        session_id = max_id + 1
        
        # Create new session
        self.conn.execute("""
            INSERT INTO counselling_sessions (id, name, year, type, description)
            VALUES (?, ?, ?, ?, ?)
        """, [session_id, name, year, session_type, f'{session_type} counselling data for {year}'])
        
        return session_id
    
    def insert_counselling_records(self, records):
        """Insert counselling records into database"""
        if not records:
            return
        
        # Prepare data for batch insert
        data = []
        for record in records:
            data.append([
                record['id'],
                record['session_id'],
                record['college_id'],
                record['course_id'],
                record['all_india_rank'],
                record['quota'],
                record['category'],
                record['round'],
                record['year'],
                record['state'],
                record['college_name'],
                record['course_name'],
                record['match_confidence'],
                record['match_method'],
                record['needs_manual_review'],
                record['is_unmatched'],
                record['source_file']
            ])
        
        # Batch insert
        self.conn.executemany("""
            INSERT INTO counselling_records (
                id, session_id, college_id, course_id, all_india_rank, quota, category,
                round, year, state, college_name, course_name, match_confidence,
                match_method, needs_manual_review, is_unmatched, source_file
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, data)
    
    def get_statistics(self):
        """Get database statistics"""
        stats = self.conn.execute("""
            SELECT 
                'states' as table_name, COUNT(*) as count FROM states
            UNION ALL
            SELECT 'categories', COUNT(*) FROM categories
            UNION ALL
            SELECT 'quotas', COUNT(*) FROM quotas
            UNION ALL
            SELECT 'courses', COUNT(*) FROM courses
            UNION ALL
            SELECT 'colleges', COUNT(*) FROM colleges
            UNION ALL
            SELECT 'counselling_sessions', COUNT(*) FROM counselling_sessions
            UNION ALL
            SELECT 'counselling_records', COUNT(*) FROM counselling_records
        """).fetchall()
        
        return stats
    
    def close(self):
        """Close database connection"""
        self.conn.close()

def main():
    """Main function to process counselling data"""
    matcher = HierarchicalMatcher()
    
    try:
        # Load master data
        matcher.load_master_data()
        
        # Process counselling data files
        counselling_files = [
            {
                'file': 'kea2023_counselling_processed_20250926_213525.csv',
                'name': 'KEA 2023',
                'year': 2023,
                'type': 'KEA'
            },
            {
                'file': 'aiq2024_counselling_processed_20250926_223957.csv',
                'name': 'AIQ 2024',
                'year': 2024,
                'type': 'AIQ'
            },
            {
                'file': 'kea2024_processed.csv',
                'name': 'KEA 2024',
                'year': 2024,
                'type': 'KEA'
            }
        ]
        
        for file_info in counselling_files:
            if os.path.exists(file_info['file']):
                matcher.process_counselling_data(
                    file_info['file'],
                    file_info['name'],
                    file_info['year'],
                    file_info['type']
                )
            else:
                print(f'⚠️  File not found: {file_info["file"]}')
        
        # Get final statistics
        print('\n📊 FINAL DATABASE STATISTICS:')
        stats = matcher.get_statistics()
        for stat in stats:
            print(f'  {stat[0]}: {stat[1]:,}')
        
    finally:
        matcher.close()

if __name__ == '__main__':
    main()
