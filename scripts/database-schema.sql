-- NeetLogIQ Database Schema for D1

CREATE TABLE IF NOT EXISTS colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    management_type TEXT,
    established_year INTEGER,
    website TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stream TEXT,
    branch TEXT,
    duration_years INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS college_courses (
    id TEXT PRIMARY KEY,
    college_id TEXT REFERENCES colleges(id),
    course_id TEXT REFERENCES courses(id),
    year INTEGER,
    total_seats INTEGER,
    general_seats INTEGER,
    obc_seats INTEGER,
    sc_seats INTEGER,
    st_seats INTEGER,
    ews_seats INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cutoffs (
    id TEXT PRIMARY KEY,
    college_id TEXT REFERENCES colleges(id),
    course_id TEXT REFERENCES courses(id),
    year INTEGER,
    round INTEGER,
    category TEXT,
    opening_rank INTEGER,
    closing_rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publish_metadata (
    year INTEGER PRIMARY KEY,
    published_at TIMESTAMP,
    version_hash TEXT,
    status TEXT CHECK(status IN ('draft', 'validating', 'published', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_documents (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('college', 'course', 'cutoff')),
    year INTEGER,
    content TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    event_data JSON,
    user_id TEXT,
    session_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state);
CREATE INDEX IF NOT EXISTS idx_colleges_management_type ON colleges(management_type);
CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream);
CREATE INDEX IF NOT EXISTS idx_courses_branch ON courses(branch);
CREATE INDEX IF NOT EXISTS idx_college_courses_year ON college_courses(year);
CREATE INDEX IF NOT EXISTS idx_cutoffs_year ON cutoffs(year);
CREATE INDEX IF NOT EXISTS idx_cutoffs_college_course ON cutoffs(college_id, course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);

-- Insert sample data for testing
INSERT OR IGNORE INTO colleges (id, name, city, state, management_type, description) VALUES
('college_001', 'All India Institute of Medical Sciences', 'New Delhi', 'Delhi', 'Government', 'Premier medical institute in India'),
('college_002', 'Christian Medical College', 'Vellore', 'Tamil Nadu', 'Private', 'Renowned private medical college'),
('college_003', 'Armed Forces Medical College', 'Pune', 'Maharashtra', 'Government', 'Military medical college');

INSERT OR IGNORE INTO courses (id, name, stream, branch, description) VALUES
('course_001', 'MBBS', 'Medical', 'General Medicine', 'Bachelor of Medicine and Bachelor of Surgery'),
('course_002', 'MD', 'Medical', 'Internal Medicine', 'Doctor of Medicine in Internal Medicine'),
('course_003', 'MS', 'Medical', 'General Surgery', 'Master of Surgery in General Surgery');

INSERT OR IGNORE INTO college_courses (id, college_id, course_id, year, total_seats, general_seats, obc_seats, sc_seats, st_seats, ews_seats) VALUES
('cc_001', 'college_001', 'course_001', 2024, 100, 50, 27, 15, 7, 10),
('cc_002', 'college_002', 'course_001', 2024, 150, 75, 40, 22, 11, 15),
('cc_003', 'college_003', 'course_001', 2024, 120, 60, 32, 18, 9, 12);

INSERT OR IGNORE INTO cutoffs (id, college_id, course_id, year, round, category, opening_rank, closing_rank) VALUES
('cutoff_001', 'college_001', 'course_001', 2024, 1, 'General', 1, 50),
('cutoff_002', 'college_002', 'course_001', 2024, 1, 'General', 51, 125),
('cutoff_003', 'college_003', 'course_001', 2024, 1, 'General', 126, 185);
