-- Phase 4: Pagination Optimization
-- Creates a precomputed distinct values table to eliminate slow 38k row pagination
-- Single row per partition_key containing arrays of all distinct IDs

-- Drop if exists (for re-running)
DROP TABLE IF EXISTS partition_distinct_values CASCADE;

-- Create table to store precomputed distinct values per partition
CREATE TABLE partition_distinct_values (
  partition_key TEXT PRIMARY KEY,
  state_ids TEXT[] NOT NULL DEFAULT '{}',
  course_ids TEXT[] NOT NULL DEFAULT '{}',
  quota_ids TEXT[] NOT NULL DEFAULT '{}',
  category_ids TEXT[] NOT NULL DEFAULT '{}',
  managements TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Populate initial data from aggregated_cutoffs
INSERT INTO partition_distinct_values (partition_key, state_ids, course_ids, quota_ids, category_ids, managements)
SELECT 
  partition_key,
  ARRAY_AGG(DISTINCT master_state_id) FILTER (WHERE master_state_id IS NOT NULL),
  ARRAY_AGG(DISTINCT master_course_id) FILTER (WHERE master_course_id IS NOT NULL),
  ARRAY_AGG(DISTINCT master_quota_id) FILTER (WHERE master_quota_id IS NOT NULL),
  ARRAY_AGG(DISTINCT master_category_id) FILTER (WHERE master_category_id IS NOT NULL),
  ARRAY_AGG(DISTINCT management) FILTER (WHERE management IS NOT NULL AND management != '-')
FROM aggregated_cutoffs
GROUP BY partition_key;

-- Create function to refresh distinct values after materialized view refresh
CREATE OR REPLACE FUNCTION refresh_partition_distinct_values()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert distinct values for each partition
  INSERT INTO partition_distinct_values (partition_key, state_ids, course_ids, quota_ids, category_ids, managements, updated_at)
  SELECT 
    partition_key,
    ARRAY_AGG(DISTINCT master_state_id) FILTER (WHERE master_state_id IS NOT NULL),
    ARRAY_AGG(DISTINCT master_course_id) FILTER (WHERE master_course_id IS NOT NULL),
    ARRAY_AGG(DISTINCT master_quota_id) FILTER (WHERE master_quota_id IS NOT NULL),
    ARRAY_AGG(DISTINCT master_category_id) FILTER (WHERE master_category_id IS NOT NULL),
    ARRAY_AGG(DISTINCT management) FILTER (WHERE management IS NOT NULL AND management != '-'),
    NOW()
  FROM aggregated_cutoffs
  GROUP BY partition_key
  ON CONFLICT (partition_key) DO UPDATE SET
    state_ids = EXCLUDED.state_ids,
    course_ids = EXCLUDED.course_ids,
    quota_ids = EXCLUDED.quota_ids,
    category_ids = EXCLUDED.category_ids,
    managements = EXCLUDED.managements,
    updated_at = NOW();
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: Since we can't create triggers on materialized views,
-- This function should be called after REFRESH MATERIALIZED VIEW aggregated_cutoffs
-- Example: SELECT refresh_partition_distinct_values();

-- Alternatively, update the refresh trigger function to also refresh distinct values
CREATE OR REPLACE FUNCTION refresh_aggregated_cutoffs()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW aggregated_cutoffs;
  
  -- Also refresh the distinct values table
  PERFORM refresh_partition_distinct_values();
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Show results
SELECT partition_key, 
       array_length(state_ids, 1) as states,
       array_length(course_ids, 1) as courses,
       array_length(quota_ids, 1) as quotas,
       array_length(category_ids, 1) as categories,
       array_length(managements, 1) as managements
FROM partition_distinct_values;
