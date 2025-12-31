-- Migration: Create Aggregated Cutoffs Materialized View
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This eliminates client-side aggregation and ensures consistent row counts

-- Drop if exists (for re-running)
DROP MATERIALIZED VIEW IF EXISTS aggregated_cutoffs CASCADE;
DROP FUNCTION IF EXISTS refresh_aggregated_cutoffs CASCADE;

-- Create materialized view with pre-aggregated data
CREATE MATERIALIZED VIEW aggregated_cutoffs AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY MIN(all_india_rank)) as id,
  partition_key,
  master_college_id,
  master_course_id, 
  master_state_id,
  master_quota_id,
  master_category_id,
  college_name,
  course_name,
  state,
  category,
  quota,
  year,
  round_normalized as round,
  MIN(all_india_rank) as opening_rank,
  MAX(all_india_rank) as closing_rank,
  COUNT(*) as total_seats
FROM counselling_records
WHERE all_india_rank IS NOT NULL
GROUP BY 
  partition_key,
  master_college_id,
  master_course_id,
  master_state_id,
  master_quota_id,
  master_category_id,
  college_name,
  course_name,
  state,
  category,
  quota,
  year,
  round_normalized;

-- Create indexes for fast filtering
CREATE INDEX idx_agg_cutoffs_partition ON aggregated_cutoffs(partition_key);
CREATE INDEX idx_agg_cutoffs_state ON aggregated_cutoffs(state);
CREATE INDEX idx_agg_cutoffs_course ON aggregated_cutoffs(course_name);
CREATE INDEX idx_agg_cutoffs_category ON aggregated_cutoffs(category);
CREATE INDEX idx_agg_cutoffs_quota ON aggregated_cutoffs(quota);
CREATE INDEX idx_agg_cutoffs_closing ON aggregated_cutoffs(closing_rank);
CREATE INDEX idx_agg_cutoffs_opening ON aggregated_cutoffs(opening_rank);

-- Composite index for common filter combinations
CREATE INDEX idx_agg_cutoffs_composite ON aggregated_cutoffs(partition_key, state, category, quota);

-- Add comment
COMMENT ON MATERIALIZED VIEW aggregated_cutoffs IS 'Pre-aggregated cutoffs for fast querying with consistent row counts';

-- Verify row count
SELECT 
  partition_key,
  COUNT(*) as row_count 
FROM aggregated_cutoffs 
GROUP BY partition_key 
ORDER BY partition_key;

-- ===========================================
-- AUTO-REFRESH TRIGGER
-- Refreshes materialized view when data changes
-- Uses regular REFRESH (not CONCURRENTLY, no unique index needed)
-- ===========================================

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_aggregated_cutoffs()
RETURNS TRIGGER AS $$
BEGIN
  -- Regular refresh (fast enough for this data size)
  REFRESH MATERIALIZED VIEW aggregated_cutoffs;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger: runs after INSERT, UPDATE, or DELETE on counselling_records
-- Uses FOR EACH STATEMENT (not row) to avoid multiple refreshes per batch
DROP TRIGGER IF EXISTS trigger_refresh_aggregated_cutoffs ON counselling_records;

CREATE TRIGGER trigger_refresh_aggregated_cutoffs
AFTER INSERT OR UPDATE OR DELETE ON counselling_records
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_aggregated_cutoffs();

-- Notify completion
SELECT 'Materialized view created with auto-refresh trigger!' as status;
