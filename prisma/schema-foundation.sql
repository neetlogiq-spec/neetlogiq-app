-- Foundation Data Schema
-- This schema defines the master reference tables for the application

-- States of India
CREATE TABLE IF NOT EXISTS states (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_states_name (name),
    INDEX idx_states_active (is_active)
);

-- Quota types (All India, State, DNB, etc.)
CREATE TABLE IF NOT EXISTS quotas (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    type ENUM('ALL_INDIA', 'STATE', 'UNIVERSITY', 'DNB') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_quotas_name (name),
    INDEX idx_quotas_type (type),
    INDEX idx_quotas_active (is_active)
);

-- Categories (OPEN, OBC, SC, ST, EWS, PWD, etc.)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    type ENUM('GENERAL', 'RESERVED', 'PWD') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categories_name (name),
    INDEX idx_categories_type (type),
    INDEX idx_categories_active (is_active)
);

-- Foundation Colleges (Master Registry)
CREATE TABLE IF NOT EXISTS foundation_colleges (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(500) NOT NULL,
    type ENUM('MEDICAL', 'DENTAL', 'DNB') NOT NULL,
    state VARCHAR(255),
    address TEXT,
    city VARCHAR(255),
    pincode VARCHAR(10),
    university VARCHAR(255),
    management ENUM('GOVERNMENT', 'PRIVATE', 'DEEMED'),
    established_year INT,
    website VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_foundation_colleges_name (name),
    INDEX idx_foundation_colleges_type (type),
    INDEX idx_foundation_colleges_state (state),
    INDEX idx_foundation_colleges_active (is_active),
    INDEX idx_foundation_colleges_source (source_file)
);

-- Seat Data (Links to Foundation Colleges)
CREATE TABLE IF NOT EXISTS seat_data (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    foundation_college_id VARCHAR(36) NOT NULL,
    course VARCHAR(255) NOT NULL,
    seats INT NOT NULL,
    category VARCHAR(255),
    quota VARCHAR(255),
    year INT NOT NULL,
    original_data JSON,
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (foundation_college_id) REFERENCES foundation_colleges(id) ON DELETE CASCADE,
    INDEX idx_seat_data_college (foundation_college_id),
    INDEX idx_seat_data_course (course),
    INDEX idx_seat_data_year (year),
    INDEX idx_seat_data_source (source_file)
);

-- Counselling Data (AIQ/KEA - Links to Foundation Colleges)
CREATE TABLE IF NOT EXISTS counselling_data (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    foundation_college_id VARCHAR(36),
    original_college_name VARCHAR(500) NOT NULL,
    course VARCHAR(255) NOT NULL,
    rank INT NOT NULL,
    quota VARCHAR(255),
    category VARCHAR(255),
    round VARCHAR(50),
    year INT NOT NULL,
    source_type ENUM('AIQ', 'KEA') NOT NULL,
    is_matched BOOLEAN DEFAULT FALSE,
    original_data JSON,
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (foundation_college_id) REFERENCES foundation_colleges(id) ON DELETE SET NULL,
    INDEX idx_counselling_data_college (foundation_college_id),
    INDEX idx_counselling_data_course (course),
    INDEX idx_counselling_data_rank (rank),
    INDEX idx_counselling_data_year (year),
    INDEX idx_counselling_data_source (source_type),
    INDEX idx_counselling_data_matched (is_matched)
);

-- Courses Master List
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    type ENUM('MBBS', 'MD', 'MS', 'DIPLOMA', 'DNB', 'FNB', 'DrNB') NOT NULL,
    duration_years INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_courses_name (name),
    INDEX idx_courses_type (type),
    INDEX idx_courses_active (is_active)
);

-- Insert default courses
INSERT IGNORE INTO courses (id, name, type, duration_years) VALUES
(UUID(), 'MBBS', 'MBBS', 5),
(UUID(), 'MD GENERAL MEDICINE', 'MD', 3),
(UUID(), 'MS GENERAL SURGERY', 'MS', 3),
(UUID(), 'MD RADIO DIAGNOSIS', 'MD', 3),
(UUID(), 'MS ORTHOPAEDICS', 'MS', 3),
(UUID(), 'MD PAEDIATRICS', 'MD', 3),
(UUID(), 'MS OBSTETRICS & GYNAECOLOGY', 'MS', 3),
(UUID(), 'MD DERMATOLOGY', 'MD', 3),
(UUID(), 'MS OPHTHALMOLOGY', 'MS', 3),
(UUID(), 'MD PSYCHIATRY', 'MD', 3);
