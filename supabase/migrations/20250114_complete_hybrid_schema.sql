-- =====================================================
-- NEET Counseling Platform - Complete Hybrid Database Schema
-- Combines DATABASE_SCHEMAS.md (SQLite) + Application Features
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic data

-- =====================================================
-- PART 1: FOUNDATION SCHEMA (from DATABASE_SCHEMAS.md)
-- Master Reference Data with TEXT IDs
-- =====================================================

-- States master table
CREATE TABLE IF NOT EXISTS states (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10),
    region VARCHAR(50),
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories master table (General, OBC, SC, ST, EWS, PWD, etc.)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(10),
    normalized_name TEXT NOT NULL,
    description TEXT,
    is_reservation BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota types master table (All India, State, Management, etc.)
CREATE TABLE IF NOT EXISTS quotas (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20),
    normalized_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Master courses catalog (TEXT IDs for counselling data import)
CREATE TABLE IF NOT EXISTS master_courses (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    normalized_name TEXT NOT NULL,
    level VARCHAR(20), -- UG, PG
    domain VARCHAR(50), -- MEDICAL, DENTAL, DNB
    duration_years INTEGER,
    description TEXT,
    tfidf_vector TEXT, -- JSON serialized TF-IDF vector
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sources master table (AIQ, KEA, STATE, etc.)
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Levels master table (UG, PG, DEN, etc.)
CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 2: COLLEGE TABLES (from DATABASE_SCHEMAS.md)
-- Separate by type with TEXT IDs for data import
-- =====================================================

-- Medical colleges master table
CREATE TABLE IF NOT EXISTS medical_colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT,
    address TEXT,
    college_type VARCHAR(50), -- GOVERNMENT, PRIVATE, etc.
    normalized_name TEXT,
    normalized_state TEXT,
    normalized_address TEXT,
    composite_college_key TEXT,
    tfidf_vector TEXT, -- JSON serialized TF-IDF vector
    establishment_year INTEGER,
    website VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dental colleges master table
CREATE TABLE IF NOT EXISTS dental_colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT,
    address TEXT,
    college_type VARCHAR(50),
    normalized_name TEXT,
    normalized_state TEXT,
    normalized_address TEXT,
    composite_college_key TEXT,
    tfidf_vector TEXT,
    establishment_year INTEGER,
    website VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DNB colleges master table
CREATE TABLE IF NOT EXISTS dnb_colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT,
    address TEXT,
    college_type VARCHAR(50),
    normalized_name TEXT,
    normalized_state TEXT,
    normalized_address TEXT,
    composite_college_key TEXT,
    tfidf_vector TEXT,
    establishment_year INTEGER,
    website VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 3: APPLICATION COLLEGES TABLE (UUID for app)
-- Simplified colleges table for app features
-- =====================================================

-- Application colleges table (UUID-based for app compatibility)
CREATE TABLE IF NOT EXISTS colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_college_id TEXT, -- Links to medical/dental/dnb_colleges
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    management_type TEXT CHECK (management_type IN ('Government', 'Private', 'Trust', 'Deemed')),
    niac_rating TEXT,
    nirf_rank INTEGER,
    established_year INTEGER,
    facilities JSONB DEFAULT '{}',
    coordinates GEOGRAPHY(POINT, 4326),
    total_seats INTEGER DEFAULT 0,
    website_url TEXT,
    description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses table (UUID-based for app, different from master_courses)
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    master_course_id TEXT REFERENCES master_courses(id),
    name TEXT NOT NULL,
    stream TEXT NOT NULL,
    duration TEXT,
    seats_available INTEGER,
    fees_structure JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cutoffs table (CRITICAL - historical cutoff data)
CREATE TABLE IF NOT EXISTS cutoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    category TEXT NOT NULL,
    quota TEXT NOT NULL,
    round INTEGER NOT NULL,
    opening_rank INTEGER,
    closing_rank INTEGER,
    seats INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_cutoff UNIQUE (college_id, year, category, quota, round)
);

-- =====================================================
-- PART 4: ALIAS TABLES (from DATABASE_SCHEMAS.md)
-- For name matching and normalization
-- =====================================================

-- College aliases for matching
CREATE TABLE IF NOT EXISTS college_aliases (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    master_college_id TEXT,
    state_normalized TEXT,
    address_normalized TEXT,
    confidence REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course aliases
CREATE TABLE IF NOT EXISTS course_aliases (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    course_id TEXT REFERENCES master_courses(id),
    confidence REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- State aliases
CREATE TABLE IF NOT EXISTS state_aliases (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL UNIQUE,
    alias_name TEXT NOT NULL,
    state_id TEXT REFERENCES states(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category aliases
CREATE TABLE IF NOT EXISTS category_aliases (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id),
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota aliases
CREATE TABLE IF NOT EXISTS quota_aliases (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    quota_id TEXT REFERENCES quotas(id),
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 5: LINK TABLES (from DATABASE_SCHEMAS.md)
-- Relationships between entities
-- =====================================================

-- State-College link table
CREATE TABLE IF NOT EXISTS state_college_link (
    college_name TEXT NOT NULL,
    address TEXT,
    state TEXT NOT NULL,
    college_id TEXT NOT NULL,
    state_id TEXT NOT NULL REFERENCES states(id),
    composite_college_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (college_id, state_id)
);

-- State-Course-College link table
CREATE TABLE IF NOT EXISTS state_course_college_link (
    state_id TEXT NOT NULL REFERENCES states(id),
    course_id TEXT NOT NULL REFERENCES master_courses(id),
    college_id TEXT NOT NULL,
    stream TEXT,
    master_address TEXT,
    seat_address_normalized TEXT,
    occurrences INTEGER DEFAULT 0,
    last_seen_ts TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (state_id, course_id, college_id)
);

-- State mappings for normalization
CREATE TABLE IF NOT EXISTS state_mappings (
    id SERIAL PRIMARY KEY,
    raw_state TEXT UNIQUE NOT NULL,
    normalized_state TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 6: DATA TABLES (from DATABASE_SCHEMAS.md)
-- Seat and counselling data
-- =====================================================

-- Seat data table
CREATE TABLE IF NOT EXISTS seat_data (
    id TEXT PRIMARY KEY,
    college_name TEXT,
    course_name TEXT,
    seats INTEGER,
    state TEXT,
    address TEXT,
    management VARCHAR(50),
    university_affiliation TEXT,
    normalized_college_name TEXT,
    normalized_course_name TEXT,
    normalized_state TEXT,
    normalized_address TEXT,
    course_type VARCHAR(50), -- MBBS, BDS, MD, MS, MDS, DIPLOMA, DNB
    source_file TEXT,
    master_college_id TEXT,
    master_course_id TEXT REFERENCES master_courses(id),
    master_state_id TEXT REFERENCES states(id),
    college_match_score REAL,
    course_match_score REAL,
    college_match_method VARCHAR(50),
    course_match_method VARCHAR(50),
    is_linked BOOLEAN DEFAULT false,
    state_id TEXT,
    college_id TEXT,
    course_id TEXT,
    record_hash TEXT,
    validation_status VARCHAR(50),
    validation_errors TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Counselling rounds master
CREATE TABLE IF NOT EXISTS counselling_rounds (
    id TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    round_name VARCHAR(50) NOT NULL,
    counselling_body VARCHAR(50) NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(year, round_name, counselling_body)
);

-- Counselling records table (from DATABASE_SCHEMAS.md)
CREATE TABLE IF NOT EXISTS counselling_records (
    id TEXT PRIMARY KEY, -- {SOURCE}-{LEVEL}-{YEAR}-{RANK}-{ROUND}
    
    -- Raw data from Excel
    all_india_rank INTEGER NOT NULL,
    quota TEXT,
    college_institute_raw TEXT NOT NULL,
    state_raw TEXT,
    course_raw TEXT NOT NULL,
    category TEXT,
    round_raw TEXT NOT NULL,
    year INTEGER NOT NULL,
    
    -- Normalized data
    college_institute_normalized TEXT,
    state_normalized TEXT,
    course_normalized TEXT,
    source_normalized TEXT, -- AIQ, KEA, STATE, etc.
    level_normalized TEXT,  -- UG, PG, DEN
    round_normalized INTEGER,
    
    -- Linked to master data
    master_college_id TEXT,
    master_course_id TEXT REFERENCES master_courses(id),
    master_state_id TEXT REFERENCES states(id),
    master_quota_id TEXT REFERENCES quotas(id),
    master_category_id TEXT REFERENCES categories(id),
    master_source_id TEXT REFERENCES sources(id),
    master_level_id TEXT REFERENCES levels(id),
    
    -- Match metadata
    college_match_score REAL,
    college_match_method VARCHAR(50),
    course_match_score REAL,
    course_match_method VARCHAR(50),
    
    -- Status
    is_matched BOOLEAN DEFAULT FALSE,
    needs_manual_review BOOLEAN DEFAULT FALSE,
    
    -- Partition info
    partition_key TEXT NOT NULL, -- AIQ-PG-2024, KEA-UG-2024, etc.
    
    -- Additional fields
    address TEXT,
    source TEXT,
    level TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition metadata
CREATE TABLE IF NOT EXISTS partition_metadata (
    partition_key TEXT PRIMARY KEY,
    total_records INTEGER DEFAULT 0,
    matched_records INTEGER DEFAULT 0,
    unmatched_records INTEGER DEFAULT 0,
    needs_review_records INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 7: USER MANAGEMENT TABLES
-- User accounts, roles, authentication
-- =====================================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    neet_rank INTEGER,
    neet_year INTEGER,
    category TEXT,
    state TEXT,
    preferences JSONB DEFAULT '{}',
    onboarding_completed BOOLEAN DEFAULT false,
    subscription_tier VARCHAR(20) CHECK (subscription_tier IN ('free', 'counseling', 'premium')) DEFAULT 'free',
    subscription_end_date TIMESTAMPTZ,
    role_id UUID,
    daily_recommendation_count INTEGER DEFAULT 0,
    last_recommendation_reset TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    role_description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '{}',
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id TEXT,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 8: SUBSCRIPTION & PAYMENT TABLES
-- Payment processing and subscription management
-- =====================================================

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan VARCHAR(20) CHECK (plan IN ('free', 'counseling', 'premium')) DEFAULT 'free',
    razorpay_subscription_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    status VARCHAR(20) CHECK (status IN ('active', 'expired', 'cancelled', 'pending')) DEFAULT 'pending',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT false,
    amount_paid INTEGER, -- in paise
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_subscription_per_user
ON subscriptions(user_id)
WHERE status = 'active';

-- Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    razorpay_payment_id TEXT UNIQUE,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) CHECK (status IN ('success', 'failed', 'pending')),
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 9: USER INTERACTION TABLES
-- Favorites, notes, watchlist, etc.
-- =====================================================

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('college', 'course', 'cutoff')) DEFAULT 'college',
    notes TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_favorite UNIQUE (user_id, college_id)
);

-- College notes
CREATE TABLE IF NOT EXISTS college_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    priority VARCHAR(20) CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_watchlist UNIQUE (user_id, college_id)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    score REAL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{}',
    display_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 10: REAL-TIME & LIVE DATA TABLES
-- Live seat tracking, notifications, alerts
-- =====================================================

-- Live seat updates (premium feature)
CREATE TABLE IF NOT EXISTS live_seat_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    seats_filled INTEGER DEFAULT 0,
    seats_total INTEGER NOT NULL,
    last_rank_filled INTEGER,
    filling_rate DECIMAL(5,2), -- Percentage filled
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_live_seat UNIQUE (college_id, course_id, round)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert subscriptions (premium feature)
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    threshold INTEGER,
    sms_enabled BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 11: COUNSELLING FEATURES
-- Documents, packages, bookings
-- =====================================================

-- Counselling documents
CREATE TABLE IF NOT EXISTS counselling_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    verification_status VARCHAR(20) DEFAULT 'pending',
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Counselling packages (premium services)
CREATE TABLE IF NOT EXISTS counselling_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    features JSONB DEFAULT '{}',
    duration_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Counselling bookings
CREATE TABLE IF NOT EXISTS counselling_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES counselling_packages(id),
    counselor_id UUID REFERENCES auth.users(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(20) CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',
    meeting_link TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 12: STREAM MANAGEMENT
-- Stream configurations, access, locks
-- =====================================================

-- Stream configurations
CREATE TABLE IF NOT EXISTS stream_configurations (
    stream_id VARCHAR(50) PRIMARY KEY,
    stream_name VARCHAR(100) NOT NULL,
    stream_description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    requires_subscription BOOLEAN DEFAULT false,
    priority INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User streams access
CREATE TABLE IF NOT EXISTS user_streams (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id VARCHAR(50) REFERENCES stream_configurations(stream_id),
    access_level VARCHAR(20) DEFAULT 'view',
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, stream_id)
);

-- Stream locks
CREATE TABLE IF NOT EXISTS stream_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id VARCHAR(50) REFERENCES stream_configurations(stream_id),
    locked_until TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stream change requests
CREATE TABLE IF NOT EXISTS stream_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    from_stream_id VARCHAR(50),
    to_stream_id VARCHAR(50),
    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 13: USAGE TRACKING & ANALYTICS
-- Track user usage, limits, premium features
-- =====================================================

-- User usage tracking
CREATE TABLE IF NOT EXISTS user_usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature_type)
);

-- Premium features catalog
CREATE TABLE IF NOT EXISTS premium_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_name VARCHAR(100) NOT NULL UNIQUE,
    feature_description TEXT,
    required_tier VARCHAR(20) NOT NULL,
    daily_limit INTEGER,
    monthly_limit INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feature usage
CREATE TABLE IF NOT EXISTS user_feature_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES premium_features(id),
    usage_count INTEGER DEFAULT 0,
    last_reset TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendation requests (track AI recommendations)
CREATE TABLE IF NOT EXISTS recommendation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rank INTEGER,
    category VARCHAR(50),
    preferences JSONB,
    results JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- College comparisons
CREATE TABLE IF NOT EXISTS college_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    college_ids UUID[] NOT NULL,
    comparison_criteria JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance Optimization
-- =====================================================

-- Foundation schema indexes
CREATE INDEX IF NOT EXISTS idx_states_name ON states(name);
CREATE INDEX IF NOT EXISTS idx_states_normalized ON states(normalized_name);
CREATE INDEX IF NOT EXISTS idx_categories_normalized ON categories(normalized_name);
CREATE INDEX IF NOT EXISTS idx_quotas_normalized ON quotas(normalized_name);
CREATE INDEX IF NOT EXISTS idx_master_courses_normalized ON master_courses(normalized_name);
CREATE INDEX IF NOT EXISTS idx_master_courses_domain_level ON master_courses(domain, level);

-- College indexes
CREATE INDEX IF NOT EXISTS idx_medical_state_type ON medical_colleges(state, college_type);
CREATE INDEX IF NOT EXISTS idx_medical_normalized_name ON medical_colleges(normalized_name);
CREATE INDEX IF NOT EXISTS idx_medical_composite_key ON medical_colleges(composite_college_key);
CREATE INDEX IF NOT EXISTS idx_dental_state_type ON dental_colleges(state, college_type);
CREATE INDEX IF NOT EXISTS idx_dental_normalized_name ON dental_colleges(normalized_name);
CREATE INDEX IF NOT EXISTS idx_dnb_state_type ON dnb_colleges(state, college_type);
CREATE INDEX IF NOT EXISTS idx_dnb_normalized_name ON dnb_colleges(normalized_name);

-- Application colleges indexes
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state);
CREATE INDEX IF NOT EXISTS idx_colleges_management_type ON colleges(management_type);
CREATE INDEX IF NOT EXISTS idx_colleges_nirf_rank ON colleges(nirf_rank);
CREATE INDEX IF NOT EXISTS idx_colleges_master_college_id ON colleges(master_college_id);

-- Courses and cutoffs indexes
CREATE INDEX IF NOT EXISTS idx_courses_college ON courses(college_id);
CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream);
CREATE INDEX IF NOT EXISTS idx_cutoffs_college ON cutoffs(college_id);
CREATE INDEX IF NOT EXISTS idx_cutoffs_year_category ON cutoffs(year, category);

-- Alias indexes
CREATE INDEX IF NOT EXISTS idx_college_aliases_original ON college_aliases(original_name);
CREATE INDEX IF NOT EXISTS idx_course_aliases_original ON course_aliases(original_name);
CREATE INDEX IF NOT EXISTS idx_state_aliases_original ON state_aliases(original_name);

-- Link table indexes
CREATE INDEX IF NOT EXISTS idx_scl_state ON state_college_link(state_id);
CREATE INDEX IF NOT EXISTS idx_scl_college ON state_college_link(college_id);
CREATE INDEX IF NOT EXISTS idx_scl_composite_key ON state_college_link(composite_college_key);
CREATE INDEX IF NOT EXISTS idx_sccl_state ON state_course_college_link(state_id);
CREATE INDEX IF NOT EXISTS idx_sccl_course ON state_course_college_link(course_id);
CREATE INDEX IF NOT EXISTS idx_sccl_college ON state_course_college_link(college_id);
CREATE INDEX IF NOT EXISTS idx_sccl_state_course ON state_course_college_link(state_id, course_id);

-- Data tables indexes
CREATE INDEX IF NOT EXISTS idx_seat_data_college ON seat_data(master_college_id);
CREATE INDEX IF NOT EXISTS idx_seat_data_course ON seat_data(master_course_id);
CREATE INDEX IF NOT EXISTS idx_seat_data_state ON seat_data(master_state_id);
CREATE INDEX IF NOT EXISTS idx_counselling_partition ON counselling_records(partition_key);
CREATE INDEX IF NOT EXISTS idx_counselling_rank ON counselling_records(all_india_rank);
CREATE INDEX IF NOT EXISTS idx_counselling_year ON counselling_records(year);
CREATE INDEX IF NOT EXISTS idx_counselling_matched ON counselling_records(is_matched);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_category ON user_profiles(category);
CREATE INDEX IF NOT EXISTS idx_user_profiles_state ON user_profiles(state);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_user ON user_usage_tracking(user_id);

-- =====================================================
-- VIEWS for Common Queries
-- =====================================================

-- Unified colleges view (combines all college types)
CREATE OR REPLACE VIEW colleges_unified AS
    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        composite_college_key,
        'MEDICAL' as source_table,
        establishment_year,
        website,
        is_active
    FROM medical_colleges
    
    UNION ALL
    
    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        composite_college_key,
        'DENTAL' as source_table,
        establishment_year,
        website,
        is_active
    FROM dental_colleges
    
    UNION ALL
    
    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        composite_college_key,
        'DNB' as source_table,
        establishment_year,
        website,
        is_active
    FROM dnb_colleges;

-- Complete counselling data view
CREATE OR REPLACE VIEW v_counselling_details AS
SELECT 
    cr.id,
    cr.year,
    cr.all_india_rank,
    cr.college_institute_raw,
    cr.state_raw,
    cr.course_raw,
    cr.category,
    cr.round_raw,
    s.name as state_name,
    q.name as quota_name,
    cat.name as category_name,
    cr.college_match_score,
    cr.course_match_score,
    cr.is_matched,
    cr.needs_manual_review
FROM counselling_records cr
LEFT JOIN states s ON cr.master_state_id = s.id
LEFT JOIN quotas q ON cr.master_quota_id = q.id
LEFT JOIN categories cat ON cr.master_category_id = cat.id;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update partition metadata
CREATE OR REPLACE FUNCTION update_partition_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO partition_metadata (partition_key, total_records, matched_records, unmatched_records, needs_review_records)
        VALUES (NEW.partition_key, 1, 
                CASE WHEN NEW.is_matched THEN 1 ELSE 0 END,
                CASE WHEN NOT NEW.is_matched THEN 1 ELSE 0 END,
                CASE WHEN NEW.needs_manual_review THEN 1 ELSE 0 END)
        ON CONFLICT (partition_key) DO UPDATE
        SET total_records = partition_metadata.total_records + 1,
            matched_records = partition_metadata.matched_records + CASE WHEN NEW.is_matched THEN 1 ELSE 0 END,
            unmatched_records = partition_metadata.unmatched_records + CASE WHEN NOT NEW.is_matched THEN 1 ELSE 0 END,
            needs_review_records = partition_metadata.needs_review_records + CASE WHEN NEW.needs_manual_review THEN 1 ELSE 0 END,
            last_updated = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE partition_metadata
        SET matched_records = matched_records + 
                CASE WHEN NEW.is_matched AND NOT OLD.is_matched THEN 1
                     WHEN NOT NEW.is_matched AND OLD.is_matched THEN -1
                     ELSE 0 END,
            unmatched_records = unmatched_records +
                CASE WHEN NOT NEW.is_matched AND OLD.is_matched THEN 1
                     WHEN NEW.is_matched AND NOT OLD.is_matched THEN -1
                     ELSE 0 END,
            needs_review_records = needs_review_records +
                CASE WHEN NEW.needs_manual_review AND NOT OLD.needs_manual_review THEN 1
                     WHEN NOT NEW.needs_manual_review AND OLD.needs_manual_review THEN -1
                     ELSE 0 END,
            last_updated = NOW()
        WHERE partition_key = NEW.partition_key;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check daily usage limits
CREATE OR REPLACE FUNCTION check_daily_limit(p_user_id UUID, p_feature_type VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
    v_last_reset TIMESTAMPTZ;
BEGIN
    -- Get current usage
    SELECT usage_count, last_used_at
    INTO v_count, v_last_reset
    FROM user_usage_tracking
    WHERE user_id = p_user_id AND feature_type = p_feature_type;
    
    -- Reset if new day
    IF v_last_reset IS NULL OR v_last_reset < CURRENT_DATE THEN
        UPDATE user_usage_tracking
        SET usage_count = 0, reset_at = NOW()
        WHERE user_id = p_user_id AND feature_type = p_feature_type;
        RETURN TRUE;
    END IF;
    
    -- Check limit based on subscription tier
    SELECT CASE 
        WHEN subscription_tier = 'free' THEN 5
        WHEN subscription_tier = 'counseling' THEN 20
        WHEN subscription_tier = 'premium' THEN 999999
        ELSE 0
    END INTO v_limit
    FROM user_profiles
    WHERE user_id = p_user_id;
    
    RETURN v_count < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for partition metadata updates
CREATE TRIGGER update_partition_stats
    AFTER INSERT OR UPDATE ON counselling_records
    FOR EACH ROW
    EXECUTE FUNCTION update_partition_metadata();

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_states_updated_at BEFORE UPDATE ON states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotas_updated_at BEFORE UPDATE ON quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_courses_updated_at BEFORE UPDATE ON master_courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_colleges_updated_at BEFORE UPDATE ON medical_colleges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dental_colleges_updated_at BEFORE UPDATE ON dental_colleges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dnb_colleges_updated_at BEFORE UPDATE ON dnb_colleges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON colleges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS for Documentation
-- =====================================================

COMMENT ON TABLE states IS 'Master states/regions reference table from DATABASE_SCHEMAS.md';
COMMENT ON TABLE categories IS 'Admission categories (General, OBC, SC, ST, EWS, etc.)';
COMMENT ON TABLE quotas IS 'Quota types (All India, State, Management, etc.)';
COMMENT ON TABLE master_courses IS 'Master course catalog with TEXT IDs for counselling data import';
COMMENT ON TABLE medical_colleges IS 'Medical colleges master data with normalization from DATABASE_SCHEMAS.md';
COMMENT ON TABLE dental_colleges IS 'Dental colleges master data with normalization';
COMMENT ON TABLE dnb_colleges IS 'DNB institutions master data with normalization';
COMMENT ON TABLE colleges IS 'Application colleges table (UUID-based) for app features and compatibility';
COMMENT ON TABLE courses IS 'Application courses table (UUID-based) linked to colleges';
COMMENT ON TABLE cutoffs IS 'Historical cutoff data - CRITICAL for recommendations';
COMMENT ON TABLE counselling_records IS 'Historical counselling/admission data partitioned by source-level-year';
COMMENT ON TABLE seat_data IS 'Seat matrix data with linking to master colleges and courses';
COMMENT ON TABLE user_usage_tracking IS 'Track usage limits for premium features';
