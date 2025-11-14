/**
 * Add Fuzzy Search Capabilities
 * Enables typo-tolerant search using PostgreSQL pg_trgm extension
 */

-- Enable the pg_trgm extension for fuzzy/similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for trigram similarity search on colleges table
CREATE INDEX IF NOT EXISTS colleges_name_trgm_idx
ON colleges USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS colleges_city_trgm_idx
ON colleges USING GIN (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS colleges_state_trgm_idx
ON colleges USING GIN (state gin_trgm_ops);

-- Create a combined text search column for better full-text search
ALTER TABLE colleges
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index on search vector
CREATE INDEX IF NOT EXISTS colleges_search_vector_idx
ON colleges USING GIN (search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION colleges_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.state, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.management_type, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
DROP TRIGGER IF EXISTS colleges_search_vector_trigger ON colleges;
CREATE TRIGGER colleges_search_vector_trigger
  BEFORE INSERT OR UPDATE ON colleges
  FOR EACH ROW
  EXECUTE FUNCTION colleges_search_vector_update();

-- Update existing rows
UPDATE colleges SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(city, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(state, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(address, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(management_type, '')), 'C');

-- Function for fuzzy search with similarity ranking
CREATE OR REPLACE FUNCTION fuzzy_search_colleges(
  search_term TEXT,
  similarity_threshold REAL DEFAULT 0.3,
  result_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  city TEXT,
  state TEXT,
  management_type TEXT,
  type TEXT,
  nirf_rank INTEGER,
  fees NUMERIC,
  total_seats INTEGER,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.city,
    c.state,
    c.management_type,
    c.type,
    c.nirf_rank,
    c.fees,
    c.total_seats,
    GREATEST(
      similarity(c.name, search_term),
      similarity(c.city, search_term),
      similarity(c.state, search_term)
    ) as similarity_score
  FROM colleges c
  WHERE
    c.name % search_term
    OR c.city % search_term
    OR c.state % search_term
    OR c.search_vector @@ plainto_tsquery('english', search_term)
  ORDER BY
    GREATEST(
      similarity(c.name, search_term),
      similarity(c.city, search_term),
      similarity(c.state, search_term)
    ) DESC,
    ts_rank(c.search_vector, plainto_tsquery('english', search_term)) DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION fuzzy_search_colleges(TEXT, REAL, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION fuzzy_search_colleges(TEXT, REAL, INT) TO anon;

-- Add comment
COMMENT ON FUNCTION fuzzy_search_colleges IS 'Performs fuzzy search on colleges with typo tolerance and relevance ranking';
