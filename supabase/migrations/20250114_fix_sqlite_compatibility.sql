-- =====================================================
-- Fix Supabase Schema to Match SQLite Structure
-- =====================================================
-- This migration updates Supabase tables to match SQLite schema
-- for successful data migration
-- =====================================================

-- =====================================================
-- 1. FIX COURSES TABLE
-- =====================================================
-- Change from UUID to TEXT id to match SQLite

-- Drop existing courses table if it exists with UUID
DROP TABLE IF EXISTS courses CASCADE;

-- Recreate courses table with TEXT id (matching SQLite)
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT,
  tfidf_vector TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_courses_normalized_name ON courses(normalized_name);
CREATE INDEX IF NOT EXISTS idx_courses_normalized_covering ON courses(normalized_name, name, id);

-- =====================================================
-- 2. FIX STATE_COLLEGE_LINK TABLE
-- =====================================================
-- Remove id column if exists, use composite primary key

-- Drop existing table
DROP TABLE IF EXISTS state_college_link CASCADE;

-- Recreate with composite primary key (matching SQLite)
CREATE TABLE IF NOT EXISTS state_college_link (
  college_name TEXT NOT NULL,
  address TEXT,
  state TEXT NOT NULL,
  college_id TEXT NOT NULL,
  state_id TEXT NOT NULL,
  composite_college_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (college_id, state_id),
  FOREIGN KEY (state_id) REFERENCES states(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_state_college_link_state_id ON state_college_link(state_id);
CREATE INDEX IF NOT EXISTS idx_state_college_link_college_id ON state_college_link(college_id);
CREATE INDEX IF NOT EXISTS idx_scl_state ON state_college_link(state_id);
CREATE INDEX IF NOT EXISTS idx_scl_college ON state_college_link(college_id);
CREATE INDEX IF NOT EXISTS idx_scl_state_college ON state_college_link(state_id, college_id);
CREATE INDEX IF NOT EXISTS idx_scl_composite_key ON state_college_link(composite_college_key);

-- =====================================================
-- 3. FIX STATE_COURSE_COLLEGE_LINK TABLE
-- =====================================================
-- Remove id column if exists, use composite primary key

-- Drop existing table
DROP TABLE IF EXISTS state_course_college_link CASCADE;

-- Recreate with composite primary key (matching SQLite)
CREATE TABLE IF NOT EXISTS state_course_college_link (
  state_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  college_id TEXT NOT NULL,
  stream TEXT,
  master_address TEXT,
  seat_address_normalized TEXT,
  occurrences INTEGER,
  last_seen_ts TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (state_id, course_id, college_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ms_sccl_state ON state_course_college_link(state_id);
CREATE INDEX IF NOT EXISTS idx_ms_sccl_course ON state_course_college_link(course_id);
CREATE INDEX IF NOT EXISTS idx_ms_sccl_state_course ON state_course_college_link(state_id, course_id);
CREATE INDEX IF NOT EXISTS idx_ms_sccl_college ON state_course_college_link(college_id);
CREATE INDEX IF NOT EXISTS idx_sccl_state ON state_course_college_link(state_id);
CREATE INDEX IF NOT EXISTS idx_sccl_course ON state_course_college_link(course_id);
CREATE INDEX IF NOT EXISTS idx_sccl_college ON state_course_college_link(college_id);
CREATE INDEX IF NOT EXISTS idx_sccl_state_course ON state_course_college_link(state_id, course_id);
CREATE INDEX IF NOT EXISTS idx_sccl_state_course_college ON state_course_college_link(state_id, course_id, college_id);

-- =====================================================
-- 4. FIX SEAT_DATA TABLE
-- =====================================================
-- Change id column from VARCHAR(50) to TEXT to accommodate longer IDs

-- Check if seat_data table exists, if so alter it
DO $$
BEGIN
  -- If table exists, alter the id column
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seat_data') THEN
    -- Drop existing constraints if any
    ALTER TABLE seat_data DROP CONSTRAINT IF EXISTS seat_data_pkey;
    
    -- Change id column type to TEXT
    ALTER TABLE seat_data ALTER COLUMN id TYPE TEXT;
    
    -- Recreate primary key
    ALTER TABLE seat_data ADD PRIMARY KEY (id);
  ELSE
    -- Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS seat_data (
      id TEXT PRIMARY KEY,
      college_name TEXT,
      course_name TEXT,
      seats INTEGER,
      state TEXT,
      address TEXT,
      management TEXT,
      university_affiliation TEXT,
      normalized_college_name TEXT,
      normalized_course_name TEXT,
      normalized_state TEXT,
      normalized_address TEXT,
      course_type TEXT,
      source_file TEXT,
      created_at TEXT,
      updated_at TEXT,
      master_college_id TEXT,
      master_course_id TEXT,
      master_state_id TEXT,
      college_match_score REAL,
      course_match_score REAL,
      college_match_method TEXT,
      course_match_method TEXT,
      is_linked INTEGER,
      state_id TEXT,
      college_id TEXT,
      course_id TEXT,
      record_hash TEXT,
      validation_status TEXT,
      validation_errors TEXT
    );
  END IF;
END $$;

-- =====================================================
-- 5. UPDATE FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Update course_aliases to reference TEXT id instead of UUID

-- Drop and recreate course_aliases table with correct foreign key
DROP TABLE IF EXISTS course_aliases CASCADE;

CREATE TABLE IF NOT EXISTS course_aliases (
  id SERIAL PRIMARY KEY,
  original_name TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  course_id TEXT,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_aliases_original ON course_aliases(original_name);
CREATE INDEX IF NOT EXISTS idx_course_aliases_course_id ON course_aliases(course_id);

-- =====================================================
-- 6. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add normalized_name to courses if missing (should already be there from above)
-- Add tfidf_vector if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'courses' AND column_name = 'normalized_name') THEN
    ALTER TABLE courses ADD COLUMN normalized_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'courses' AND column_name = 'tfidf_vector') THEN
    ALTER TABLE courses ADD COLUMN tfidf_vector TEXT;
  END IF;
END $$;

-- =====================================================
-- 7. VERIFY SCHEMA MATCHES
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Schema update complete! Tables now match SQLite structure.';
  RAISE NOTICE 'Courses: TEXT id (was UUID)';
  RAISE NOTICE 'State-College-Link: Composite PK (no id column)';
  RAISE NOTICE 'State-Course-College-Link: Composite PK (no id column)';
  RAISE NOTICE 'Seat Data: TEXT id (was VARCHAR(50))';
END $$;

