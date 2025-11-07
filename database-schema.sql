-- NeetLogIQ Database Schema
-- Unified structure for Medical, Dental, and DNB data
-- Supports hierarchical college matching and efficient querying

-- =============================================================================
-- FOUNDATION SCHEMA - Master Reference Data
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS foundation;

-- States master table
CREATE TABLE foundation.states (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    region VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories master table (General, OBC, SC, ST, EWS, PWD, etc.)
CREATE TABLE foundation.categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    is_reservation BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quota types master table (All India, State, Management, etc.)
CREATE TABLE foundation.quotas (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course types and specializations
CREATE TABLE foundation.course_types (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    level VARCHAR(20) NOT NULL, -- UG, PG
    domain VARCHAR(50) NOT NULL, -- MEDICAL, DENTAL, DNB
    duration_years INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Universities/Affiliating bodies
CREATE TABLE foundation.universities (
    id INTEGER PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    state_id INTEGER NOT NULL,
    type VARCHAR(50), -- Central, State, Private, Deemed
    is_dnb BOOLEAN DEFAULT false, -- Special flag for NBEMS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (state_id) REFERENCES foundation.states(id)
);

-- =============================================================================
-- STATIC SCHEMA - Colleges and Courses Data
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS static;

-- Colleges master table
CREATE TABLE static.colleges (
    id INTEGER PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    short_name VARCHAR(100),
    address TEXT,
    state_id INTEGER NOT NULL,
    university_id INTEGER,
    management VARCHAR(100), -- Government, Private, etc.
    establishment_year INTEGER,
    website VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (state_id) REFERENCES foundation.states(id),
    FOREIGN KEY (university_id) REFERENCES foundation.universities(id)
);

-- College courses and seats information
CREATE TABLE static.college_courses (
    id INTEGER PRIMARY KEY,
    college_id INTEGER NOT NULL,
    course_type_id INTEGER NOT NULL,
    total_seats INTEGER NOT NULL DEFAULT 0,
    year INTEGER NOT NULL, -- Academic year
    fees_annual DECIMAL(12,2),
    duration_years INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (college_id) REFERENCES static.colleges(id),
    FOREIGN KEY (course_type_id) REFERENCES foundation.course_types(id),
    UNIQUE(college_id, course_type_id, year)
);

-- Seat distribution by quota and category
CREATE TABLE static.seat_distribution (
    id INTEGER PRIMARY KEY,
    college_course_id INTEGER NOT NULL,
    quota_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    seats INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (college_course_id) REFERENCES static.college_courses(id),
    FOREIGN KEY (quota_id) REFERENCES foundation.quotas(id),
    FOREIGN KEY (category_id) REFERENCES foundation.categories(id),
    UNIQUE(college_course_id, quota_id, category_id)
);

-- =============================================================================
-- COUNSELLING SCHEMA - Historical Admission Data
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS counselling;

-- Counselling rounds master
CREATE TABLE counselling.rounds (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    round_name VARCHAR(50) NOT NULL, -- AIQ_R1, AIQ_R2, KEA_R1, etc.
    counselling_body VARCHAR(50) NOT NULL, -- AIQ, KEA, etc.
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, round_name, counselling_body)
);

-- Main counselling data table with hierarchical structure
CREATE TABLE counselling.admissions (
    id INTEGER PRIMARY KEY,
    round_id INTEGER NOT NULL,
    college_id INTEGER NOT NULL,
    course_type_id INTEGER NOT NULL,
    quota_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    opening_rank INTEGER,
    closing_rank INTEGER,
    total_seats INTEGER,
    filled_seats INTEGER,
    raw_college_name TEXT, -- Original name from source file
    match_confidence DECIMAL(5,4), -- Confidence score for college matching
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (round_id) REFERENCES counselling.rounds(id),
    FOREIGN KEY (college_id) REFERENCES static.colleges(id),
    FOREIGN KEY (course_type_id) REFERENCES foundation.course_types(id),
    FOREIGN KEY (quota_id) REFERENCES foundation.quotas(id),
    FOREIGN KEY (category_id) REFERENCES foundation.categories(id),
    UNIQUE(round_id, college_id, course_type_id, quota_id, category_id)
);

-- College name matching cache for hierarchical algorithm
CREATE TABLE counselling.college_name_matches (
    id INTEGER PRIMARY KEY,
    raw_name TEXT NOT NULL,
    state_id INTEGER NOT NULL,
    course_type_id INTEGER,
    matched_college_id INTEGER,
    confidence_score DECIMAL(5,4),
    match_method VARCHAR(50), -- 'EXACT', 'FUZZY', 'HIERARCHICAL'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (state_id) REFERENCES foundation.states(id),
    FOREIGN KEY (course_type_id) REFERENCES foundation.course_types(id),
    FOREIGN KEY (matched_college_id) REFERENCES static.colleges(id),
    UNIQUE(raw_name, state_id, course_type_id)
);

-- =============================================================================
-- INDEXES for Performance Optimization
-- =============================================================================

-- Foundation schema indexes
CREATE INDEX idx_states_name ON foundation.states(name);
CREATE INDEX idx_states_code ON foundation.states(code);
CREATE INDEX idx_categories_code ON foundation.categories(code);
CREATE INDEX idx_quotas_code ON foundation.quotas(code);
CREATE INDEX idx_course_types_domain_level ON foundation.course_types(domain, level);
CREATE INDEX idx_universities_state ON foundation.universities(state_id);

-- Static schema indexes
CREATE INDEX idx_colleges_state ON static.colleges(state_id);
CREATE INDEX idx_colleges_university ON static.colleges(university_id);
CREATE INDEX idx_colleges_name ON static.colleges(name);
CREATE INDEX idx_college_courses_college ON static.college_courses(college_id);
CREATE INDEX idx_college_courses_course_type ON static.college_courses(course_type_id);
CREATE INDEX idx_college_courses_year ON static.college_courses(year);
CREATE INDEX idx_seat_distribution_college_course ON static.seat_distribution(college_course_id);

-- Counselling schema indexes
CREATE INDEX idx_rounds_year_body ON counselling.rounds(year, counselling_body);
CREATE INDEX idx_admissions_round ON counselling.admissions(round_id);
CREATE INDEX idx_admissions_college ON counselling.admissions(college_id);
CREATE INDEX idx_admissions_course_type ON counselling.admissions(course_type_id);
CREATE INDEX idx_admissions_hierarchical ON counselling.admissions(round_id, college_id, course_type_id);
CREATE INDEX idx_college_name_matches_raw ON counselling.college_name_matches(raw_name);
CREATE INDEX idx_college_name_matches_state_course ON counselling.college_name_matches(state_id, course_type_id);

-- =============================================================================
-- VIEWS for Common Queries
-- =============================================================================

-- Complete college information with state and university details
CREATE VIEW counselling.v_college_details AS
SELECT 
    c.id,
    c.name as college_name,
    c.short_name,
    c.address,
    s.name as state_name,
    s.code as state_code,
    u.name as university_name,
    u.type as university_type,
    c.management,
    c.is_active
FROM static.colleges c
JOIN foundation.states s ON c.state_id = s.id
LEFT JOIN foundation.universities u ON c.university_id = u.id;

-- Complete admission data with all related information
CREATE VIEW counselling.v_admission_details AS
SELECT 
    a.id,
    r.year,
    r.round_name,
    r.counselling_body,
    c.name as college_name,
    s.name as state_name,
    ct.name as course_name,
    ct.domain,
    ct.level,
    q.name as quota_name,
    cat.name as category_name,
    a.opening_rank,
    a.closing_rank,
    a.total_seats,
    a.filled_seats,
    a.match_confidence
FROM counselling.admissions a
JOIN counselling.rounds r ON a.round_id = r.id
JOIN static.colleges c ON a.college_id = c.id
JOIN foundation.states s ON c.state_id = s.id
JOIN foundation.course_types ct ON a.course_type_id = ct.id
JOIN foundation.quotas q ON a.quota_id = q.id
JOIN foundation.categories cat ON a.category_id = cat.id;