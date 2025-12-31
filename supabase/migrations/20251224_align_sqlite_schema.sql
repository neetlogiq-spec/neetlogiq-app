-- =====================================================
-- Migration: Align Supabase Schema with SQLite Master Data
-- SQLite is the source of truth for master data tables
-- =====================================================

-- =====================================================
-- 1. DROP UNNECESSARY COLUMNS FROM COLLEGE TABLES
-- =====================================================

-- Medical colleges - drop columns not in SQLite
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS establishment_year;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS website;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS phone;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS email;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS latitude;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS longitude;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS is_active;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS created_at;
ALTER TABLE medical_colleges DROP COLUMN IF EXISTS updated_at;

-- Dental colleges - drop columns not in SQLite
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS establishment_year;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS website;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS phone;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS email;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS latitude;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS longitude;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS is_active;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS created_at;
ALTER TABLE dental_colleges DROP COLUMN IF EXISTS updated_at;

-- DNB colleges - drop columns not in SQLite
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS establishment_year;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS website;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS phone;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS email;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS latitude;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS longitude;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS is_active;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS created_at;
ALTER TABLE dnb_colleges DROP COLUMN IF EXISTS updated_at;

-- =====================================================
-- 2. DROP UNNECESSARY COLUMNS FROM COURSES
-- =====================================================

ALTER TABLE courses DROP COLUMN IF EXISTS code;
ALTER TABLE courses DROP COLUMN IF EXISTS level;
ALTER TABLE courses DROP COLUMN IF EXISTS domain;
ALTER TABLE courses DROP COLUMN IF EXISTS duration_years;
ALTER TABLE courses DROP COLUMN IF EXISTS description;
ALTER TABLE courses DROP COLUMN IF EXISTS created_at;
ALTER TABLE courses DROP COLUMN IF EXISTS updated_at;

-- =====================================================
-- 3. DROP UNNECESSARY COLUMNS FROM STATES
-- =====================================================

ALTER TABLE states DROP COLUMN IF EXISTS code;
ALTER TABLE states DROP COLUMN IF EXISTS region;

-- =====================================================
-- 4. DROP UNNECESSARY COLUMNS FROM CATEGORIES
-- =====================================================

ALTER TABLE categories DROP COLUMN IF EXISTS code;
ALTER TABLE categories DROP COLUMN IF EXISTS description;
ALTER TABLE categories DROP COLUMN IF EXISTS is_reservation;

-- =====================================================
-- 5. DROP UNNECESSARY COLUMNS FROM QUOTAS
-- =====================================================

ALTER TABLE quotas DROP COLUMN IF EXISTS code;
ALTER TABLE quotas DROP COLUMN IF EXISTS description;

-- =====================================================
-- 6. FIX SEAT_DATA.IS_LINKED TYPE (BOOLEAN → INTEGER)
-- =====================================================

-- Change is_linked from BOOLEAN to INTEGER to match SQLite
ALTER TABLE seat_data ALTER COLUMN is_linked TYPE INTEGER USING CASE WHEN is_linked THEN 1 ELSE 0 END;

-- =====================================================
-- 7. FIX TIMESTAMP TYPES TO TEXT (match SQLite)
-- =====================================================

-- state_course_college_link.last_seen_ts
ALTER TABLE state_course_college_link ALTER COLUMN last_seen_ts TYPE TEXT;
ALTER TABLE state_course_college_link DROP COLUMN IF EXISTS created_at;

-- state_college_link
ALTER TABLE state_college_link DROP COLUMN IF EXISTS created_at;
ALTER TABLE state_college_link DROP COLUMN IF EXISTS state;

-- seat_data timestamps
ALTER TABLE seat_data ALTER COLUMN created_at TYPE TEXT;
ALTER TABLE seat_data ALTER COLUMN updated_at TYPE TEXT;

-- =====================================================
-- 8. VERIFY FINAL SCHEMA MATCHES SQLITE
-- =====================================================

-- medical_colleges: id, name, state, address, college_type, normalized_name, normalized_state, normalized_address, tfidf_vector, composite_college_key
-- dental_colleges: same as medical_colleges
-- dnb_colleges: same as medical_colleges
-- courses: id, name, normalized_name, tfidf_vector
-- states: id, name, normalized_name, created_at, updated_at
-- categories: id, name, normalized_name, created_at, updated_at
-- quotas: id, name, normalized_name, created_at, updated_at
-- state_college_link: college_id, state_id, address, college_name, composite_college_key
-- state_course_college_link: state_id, course_id, college_id, stream, master_address, seat_address_normalized, occurrences, last_seen_ts

COMMENT ON TABLE medical_colleges IS 'Medical colleges master data - synced from SQLite';
COMMENT ON TABLE dental_colleges IS 'Dental colleges master data - synced from SQLite';
COMMENT ON TABLE dnb_colleges IS 'DNB institutions master data - synced from SQLite';
COMMENT ON TABLE courses IS 'Course definitions - synced from SQLite';
COMMENT ON TABLE states IS 'State definitions - synced from SQLite';
COMMENT ON TABLE categories IS 'Category definitions - synced from SQLite';
COMMENT ON TABLE quotas IS 'Quota definitions - synced from SQLite';
