-- Advanced Matching Enhancements: FTS5 Indexes and Feedback Tables
-- Run this migration on master_data and seat_data databases

-- ==================== FTS5 FULL-TEXT SEARCH INDEXES ====================
-- 10-50x speedup for text search queries

-- Medical Colleges FTS5 (if not exists)
CREATE VIRTUAL TABLE IF NOT EXISTS medical_colleges_fts USING fts5(
    id,
    name,
    normalized_name, 
    normalized_address,
    normalized_state,
    content='medical_colleges',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- Dental Colleges FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS dental_colleges_fts USING fts5(
    id,
    name,
    normalized_name,
    normalized_address, 
    normalized_state,
    content='dental_colleges',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- DNB Colleges FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS dnb_colleges_fts USING fts5(
    id,
    name,
    normalized_name,
    normalized_address,
    normalized_state, 
    content='dnb_colleges',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- ==================== COMPOUND INDEXES ====================
-- Fast filtering by state + name combination

CREATE INDEX IF NOT EXISTS idx_medical_state_name 
    ON medical_colleges(normalized_state, normalized_name);

CREATE INDEX IF NOT EXISTS idx_dental_state_name 
    ON dental_colleges(normalized_state, normalized_name);

CREATE INDEX IF NOT EXISTS idx_dnb_state_name 
    ON dnb_colleges(normalized_state, normalized_name);

-- ==================== MATCHING FEEDBACK TABLE ====================
-- Records user decisions for dynamic threshold adjustment

CREATE TABLE IF NOT EXISTS matching_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_college TEXT NOT NULL,
    query_state TEXT,
    query_address TEXT,
    candidate_id TEXT,
    candidate_college TEXT NOT NULL,
    match_score REAL NOT NULL,
    hybrid_breakdown TEXT,  -- JSON: {"name": 40, "state": 25, "city": 15, "code": 15}
    user_decision TEXT NOT NULL,  -- 'approved' | 'rejected' | 'skipped'
    course_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_decision 
    ON matching_feedback(user_decision, match_score);

CREATE INDEX IF NOT EXISTS idx_feedback_score_range 
    ON matching_feedback(match_score);

-- ==================== THRESHOLD HISTORY TABLE ====================
-- Tracks auto-adjustment of matching thresholds

CREATE TABLE IF NOT EXISTS threshold_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threshold_type TEXT NOT NULL,  -- 'auto_accept' | 'manual_review' | 'reject'
    old_value REAL NOT NULL,
    new_value REAL NOT NULL,
    adjustment_reason TEXT,  -- 'approval_rate_low' | 'approval_rate_high'
    sample_count INTEGER,
    approval_rate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==================== REBUILD FTS5 INDEXES ====================
-- Run these after initial creation to populate the indexes

-- Uncomment to rebuild (run manually):
-- INSERT INTO medical_colleges_fts(medical_colleges_fts) VALUES('rebuild');
-- INSERT INTO dental_colleges_fts(dental_colleges_fts) VALUES('rebuild');
-- INSERT INTO dnb_colleges_fts(dnb_colleges_fts) VALUES('rebuild');
