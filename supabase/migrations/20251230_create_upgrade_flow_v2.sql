-- Migration: Create Optimized Upgrade Flow RPC
-- This function handles joining R1 and R2 records in the database
-- and returns paginated upgraded records.

CREATE OR REPLACE FUNCTION get_upgrade_flow_v2(
  p_partition_key TEXT,
  p_round_from INTEGER,
  p_round_to INTEGER,
  p_category TEXT DEFAULT NULL,
  p_quota TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_college TEXT DEFAULT NULL,
  p_course TEXT DEFAULT NULL,
  p_min_rank INTEGER DEFAULT NULL,
  p_max_rank INTEGER DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  all_india_rank INTEGER,
  r1_college TEXT,
  r1_course TEXT,
  r1_state TEXT,
  r1_category TEXT,
  r1_quota TEXT,
  r2_college TEXT,
  r2_course TEXT,
  r2_state TEXT,
  r2_category TEXT,
  r2_quota TEXT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH r1 AS (
    SELECT 
      c.all_india_rank,
      c.college_name,
      c.course_name,
      c.state,
      c.category,
      c.quota
    FROM counselling_records c
    WHERE c.partition_key = p_partition_key
      AND c.round_normalized = p_round_from
      AND (p_category IS NULL OR p_category = '' OR p_category = 'all' OR c.category = p_category)
      AND (p_quota IS NULL OR p_quota = '' OR p_quota = 'all' OR c.quota = p_quota)
      AND (p_state IS NULL OR p_state = '' OR p_state = 'all' OR c.state = p_state)
  ),
  r2 AS (
    SELECT 
      c.all_india_rank,
      c.college_name,
      c.course_name,
      c.state,
      c.category,
      c.quota
    FROM counselling_records c
    WHERE c.partition_key = p_partition_key
      AND c.round_normalized = p_round_to
      AND (p_category IS NULL OR p_category = '' OR p_category = 'all' OR c.category = p_category)
      AND (p_quota IS NULL OR p_quota = '' OR p_quota = 'all' OR c.quota = p_quota)
      AND (p_state IS NULL OR p_state = '' OR p_state = 'all' OR c.state = p_state)
  ),
  joined AS (
    SELECT 
      t2.all_india_rank,
      t1.college_name as r1_college,
      t1.course_name as r1_course,
      t1.state as r1_state,
      t1.category as r1_category,
      t1.quota as r1_quota,
      t2.college_name as r2_college,
      t2.course_name as r2_course,
      t2.state as r2_state,
      t2.category as r2_category,
      t2.quota as r2_quota
    FROM r2 t2
    LEFT JOIN r1 t1 ON t1.all_india_rank = t2.all_india_rank
    -- Filter for upgrades: either R1 info is missing or college/course changed
    WHERE (t1.all_india_rank IS NULL OR t1.college_name != t2.college_name OR t1.course_name != t2.course_name)
      -- Apply college and course filters on either R1 or R2
      AND (p_college IS NULL OR p_college = '' OR p_college = 'all' OR t1.college_name ILIKE '%' || p_college || '%' OR t2.college_name ILIKE '%' || p_college || '%')
      AND (p_course IS NULL OR p_course = '' OR p_course = 'all' OR t1.course_name ILIKE '%' || p_course || '%' OR t2.course_name ILIKE '%' || p_course || '%')
      -- Apply rank range filters on R2 rank
      AND (p_min_rank IS NULL OR t2.all_india_rank >= p_min_rank)
      AND (p_max_rank IS NULL OR t2.all_india_rank <= p_max_rank)
      -- Apply multi-column search
      AND (p_search IS NULL OR p_search = '' OR 
           t1.college_name ILIKE '%' || p_search || '%' OR t2.college_name ILIKE '%' || p_search || '%' OR
           t1.course_name ILIKE '%' || p_search || '%' OR t2.course_name ILIKE '%' || p_search || '%' OR
           t1.state ILIKE '%' || p_search || '%' OR t2.state ILIKE '%' || p_search || '%')
  ),
  counts AS (
    SELECT count(*) as total FROM joined
  )
  SELECT 
    j.all_india_rank,
    COALESCE(j.r1_college, ''),
    COALESCE(j.r1_course, ''),
    COALESCE(j.r1_state, ''),
    COALESCE(j.r1_category, ''),
    COALESCE(j.r1_quota, ''),
    j.r2_college,
    j.r2_course,
    j.r2_state,
    j.r2_category,
    j.r2_quota,
    c.total
  FROM joined j, counts c
  ORDER BY j.all_india_rank ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
