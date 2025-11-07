#!/usr/bin/env python3

import pandas as pd
import duckdb
import json
import os
from pathlib import Path

def init_fresh_master_database():
    print('🚀 Initializing Fresh Master Database...')
    
    # Database path
    db_path = 'neetlogiq_master.db'
    
    # Remove existing database
    if os.path.exists(db_path):
        os.remove(db_path)
        print('  ✅ Removed existing database')
    
    # Foundation data directory
    foundation_dir = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/'
    
    # Connect to DuckDB
    conn = duckdb.connect(db_path)
    
    try:
        # Create all tables
        print('📋 Creating all tables...')
        create_tables(conn)
        
        # Load Foundation data
        print('📊 Loading Foundation data...')
        load_foundation_data(conn, foundation_dir)
        
        # Create indexes
        print('⚡ Creating indexes...')
        create_indexes(conn)
        
        # Generate statistics
        print('📊 Generating statistics...')
        generate_statistics(conn)
        
        print('✅ Fresh master database initialization completed successfully!')
        
    except Exception as e:
        print(f'❌ Database initialization failed: {e}')
        raise
    finally:
        conn.close()

def create_tables(conn):
    """Create all database tables"""
    
    # States table
    conn.execute("""
        CREATE TABLE states (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            code VARCHAR(10),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Categories table
    conn.execute("""
        CREATE TABLE categories (
            id INTEGER PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            description VARCHAR(200),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Quotas table
    conn.execute("""
        CREATE TABLE quotas (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description VARCHAR(200),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Courses table
    conn.execute("""
        CREATE TABLE courses (
            id INTEGER PRIMARY KEY,
            name VARCHAR(200) NOT NULL UNIQUE,
            stream VARCHAR(50),
            degree_type VARCHAR(50),
            duration_years INTEGER,
            description TEXT,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Colleges table
    conn.execute("""
        CREATE TABLE colleges (
            id INTEGER PRIMARY KEY,
            name VARCHAR(500) NOT NULL,
            state VARCHAR(100),
            address VARCHAR(500),
            type VARCHAR(50),
            management_type VARCHAR(50),
            university_affiliation VARCHAR(200),
            website VARCHAR(200),
            phone VARCHAR(20),
            email VARCHAR(100),
            established_year INTEGER,
            accreditation VARCHAR(200),
            recognition VARCHAR(200),
            total_courses INTEGER DEFAULT 0,
            total_seats INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # College courses table (seats data)
    conn.execute("""
        CREATE TABLE college_courses (
            id INTEGER PRIMARY KEY,
            college_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            seats INTEGER DEFAULT 0,
            management_type VARCHAR(50),
            university_affiliation VARCHAR(200),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (college_id) REFERENCES colleges(id),
            FOREIGN KEY (course_id) REFERENCES courses(id)
        )
    """)
    
    # Counselling sessions table
    conn.execute("""
        CREATE TABLE counselling_sessions (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            year INTEGER NOT NULL,
            type VARCHAR(50) NOT NULL,
            description VARCHAR(200),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Counselling records table
    conn.execute("""
        CREATE TABLE counselling_records (
            id VARCHAR(100) PRIMARY KEY,
            session_id INTEGER NOT NULL,
            college_id INTEGER,
            course_id INTEGER,
            all_india_rank INTEGER,
            quota VARCHAR(100),
            category VARCHAR(50),
            round VARCHAR(50),
            year INTEGER,
            state VARCHAR(100),
            college_name VARCHAR(500),
            course_name VARCHAR(200),
            match_confidence DECIMAL(3,2) DEFAULT 0.0,
            match_method VARCHAR(50),
            needs_manual_review BOOLEAN DEFAULT FALSE,
            is_unmatched BOOLEAN DEFAULT FALSE,
            source_file VARCHAR(200),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES counselling_sessions(id),
            FOREIGN KEY (college_id) REFERENCES colleges(id),
            FOREIGN KEY (course_id) REFERENCES courses(id)
        )
    """)
    
    print('  ✅ All tables created successfully')

def load_foundation_data(conn, foundation_dir):
    """Load Foundation data from Excel files"""
    
    # Load states
    load_states(conn, foundation_dir)
    
    # Load categories
    load_categories(conn, foundation_dir)
    
    # Load quotas
    load_quotas(conn, foundation_dir)
    
    # Load courses
    load_courses(conn, foundation_dir)
    
    # Load colleges
    load_colleges(conn, foundation_dir)

def load_states(conn, foundation_dir):
    """Load states data"""
    states_file = os.path.join(foundation_dir, 'STATES.xlsx')
    if os.path.exists(states_file):
        df = pd.read_excel(states_file, sheet_name='Sheet1', header=None)
        
        for i, row in df.iterrows():
            state_name = row[0]
            if state_name and state_name != 'STATES OF INDIA':
                conn.execute("""
                    INSERT INTO states (id, name) VALUES (?, ?)
                """, [i, state_name])
        
        print('  ✅ States loaded')

def load_categories(conn, foundation_dir):
    """Load categories data"""
    categories_file = os.path.join(foundation_dir, 'CATEGORY.xlsx')
    if os.path.exists(categories_file):
        df = pd.read_excel(categories_file, sheet_name='Sheet1', header=None)
        
        for i, row in df.iterrows():
            category_name = row[0]
            if category_name and category_name != 'CATEGORY':
                conn.execute("""
                    INSERT INTO categories (id, name) VALUES (?, ?)
                """, [i, category_name])
        
        print('  ✅ Categories loaded')

def load_quotas(conn, foundation_dir):
    """Load quotas data"""
    quotas_file = os.path.join(foundation_dir, 'QUOTA.xlsx')
    if os.path.exists(quotas_file):
        df = pd.read_excel(quotas_file, sheet_name='Sheet1', header=None)
        
        for i, row in df.iterrows():
            quota_name = row[0]
            if quota_name and quota_name != 'QUOTA':
                conn.execute("""
                    INSERT INTO quotas (id, name) VALUES (?, ?)
                """, [i, quota_name])
        
        print('  ✅ Quotas loaded')

def load_courses(conn, foundation_dir):
    """Load courses data"""
    courses_file = os.path.join(foundation_dir, 'standard_courses.txt')
    if os.path.exists(courses_file):
        with open(courses_file, 'r') as f:
            courses = f.read().strip().split('\n')
        
        for i, course_name in enumerate(courses):
            course_name = course_name.strip()
            if course_name:
                # Determine stream and degree type
                stream = 'Other'
                degree_type = 'Other'
                duration_years = 1
                
                if 'MBBS' in course_name or 'BDS' in course_name:
                    stream = 'Medical'
                    degree_type = 'UG'
                    duration_years = 5 if 'MBBS' in course_name else 4
                elif 'MD' in course_name or 'MS' in course_name or 'MDS' in course_name:
                    stream = 'Dental' if 'MDS' in course_name else 'Medical'
                    degree_type = 'PG'
                    duration_years = 3
                elif 'DNB' in course_name:
                    stream = 'DNB'
                    degree_type = 'PG'
                    duration_years = 3
                elif 'DIPLOMA' in course_name:
                    stream = 'Medical'
                    degree_type = 'Diploma'
                    duration_years = 2
                
                conn.execute("""
                    INSERT INTO courses (id, name, stream, degree_type, duration_years) 
                    VALUES (?, ?, ?, ?, ?)
                """, [i + 1, course_name, stream, degree_type, duration_years])
        
        print('  ✅ Courses loaded')

def load_colleges(conn, foundation_dir):
    """Load colleges data"""
    college_id = 1
    
    # Load medical colleges
    college_id = load_colleges_from_file(conn, foundation_dir, 'med ad.xlsx', 'Medical', college_id)
    
    # Load dental colleges
    college_id = load_colleges_from_file(conn, foundation_dir, 'dental ad.xlsx', 'Dental', college_id)
    
    # Load DNB colleges
    college_id = load_colleges_from_file(conn, foundation_dir, 'dnb ad.xlsx', 'DNB', college_id)

def load_colleges_from_file(conn, foundation_dir, filename, college_type, start_id):
    """Load colleges from specific file"""
    file_path = os.path.join(foundation_dir, filename)
    if os.path.exists(file_path):
        df = pd.read_excel(file_path, sheet_name='Sheet1', header=0)
        
        college_id = start_id
        for _, row in df.iterrows():
            state = row['STATE'] if 'STATE' in row else None
            college_name = row['COLLEGE/INSTITUTE'] if 'COLLEGE/INSTITUTE' in row else None
            address = row['ADDRESS'] if 'ADDRESS' in row else None
            
            if state and college_name:
                conn.execute("""
                    INSERT INTO colleges (id, name, state, address, type) 
                    VALUES (?, ?, ?, ?, ?)
                """, [college_id, college_name, state, address, college_type])
                college_id += 1
        
        print(f'  ✅ {college_type} colleges loaded')
        return college_id
    
    return start_id

def create_indexes(conn):
    """Create all indexes for performance"""
    indexes = [
        'CREATE INDEX idx_colleges_state ON colleges(state)',
        'CREATE INDEX idx_colleges_type ON colleges(type)',
        'CREATE INDEX idx_colleges_name ON colleges(name)',
        'CREATE INDEX idx_courses_stream ON courses(stream)',
        'CREATE INDEX idx_courses_degree_type ON courses(degree_type)',
        'CREATE INDEX idx_college_courses_college_id ON college_courses(college_id)',
        'CREATE INDEX idx_college_courses_course_id ON college_courses(course_id)',
        'CREATE INDEX idx_counselling_records_session_id ON counselling_records(session_id)',
        'CREATE INDEX idx_counselling_records_college_id ON counselling_records(college_id)',
        'CREATE INDEX idx_counselling_records_rank ON counselling_records(all_india_rank)',
        'CREATE INDEX idx_counselling_records_year ON counselling_records(year)',
        'CREATE INDEX idx_counselling_records_quota ON counselling_records(quota)',
        'CREATE INDEX idx_counselling_records_category ON counselling_records(category)'
    ]
    
    for index_query in indexes:
        conn.execute(index_query)
    
    print('  ✅ All indexes created successfully')

def generate_statistics(conn):
    """Generate initial statistics"""
    stats = conn.execute("""
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
        SELECT 'college_courses', COUNT(*) FROM college_courses
    """).fetchall()
    
    print('📊 Master Database Statistics:')
    for stat in stats:
        print(f'  {stat[0]}: {stat[1]:,}')
    
    print('  ✅ Statistics generated successfully')

if __name__ == '__main__':
    init_fresh_master_database()
