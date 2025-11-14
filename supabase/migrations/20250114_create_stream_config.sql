-- Create stream configuration table
-- Stores stream-specific settings and metadata

CREATE TABLE IF NOT EXISTS stream_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id TEXT UNIQUE NOT NULL CHECK (stream_id IN ('UG', 'PG_MEDICAL', 'PG_DENTAL')),
  stream_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,

  -- Features
  features JSONB DEFAULT '{}',

  -- Limits
  max_saved_colleges INTEGER,
  max_comparisons INTEGER,

  -- UI customization
  primary_color TEXT,
  icon_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default stream configurations
INSERT INTO stream_config (stream_id, stream_name, description, primary_color, icon_name, max_saved_colleges, max_comparisons)
VALUES
  (
    'UG',
    'Undergraduate Medical',
    'NEET UG - MBBS and BDS courses',
    '#3B82F6',
    'GraduationCap',
    100,
    10
  ),
  (
    'PG_MEDICAL',
    'Postgraduate Medical',
    'NEET PG - MD/MS and DNB courses',
    '#10B981',
    'Stethoscope',
    100,
    10
  ),
  (
    'PG_DENTAL',
    'Postgraduate Dental',
    'NEET MDS - Dental postgraduate courses',
    '#8B5CF6',
    'Tooth',
    100,
    10
  )
ON CONFLICT (stream_id) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_stream_config_stream_id ON stream_config(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_config_enabled ON stream_config(enabled);

-- Function to get active streams
CREATE OR REPLACE FUNCTION get_active_streams()
RETURNS SETOF stream_config AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM stream_config
  WHERE enabled = true
  ORDER BY stream_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update stream config (admin only)
CREATE OR REPLACE FUNCTION update_stream_config(
  p_stream_id TEXT,
  p_config JSONB,
  p_admin_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT role IN ('admin', 'super_admin') INTO v_is_admin
  FROM user_profiles
  WHERE user_id = p_admin_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Update stream config
  UPDATE stream_config
  SET
    stream_name = COALESCE((p_config->>'stream_name')::TEXT, stream_name),
    description = COALESCE((p_config->>'description')::TEXT, description),
    enabled = COALESCE((p_config->>'enabled')::BOOLEAN, enabled),
    features = COALESCE((p_config->'features')::JSONB, features),
    max_saved_colleges = COALESCE((p_config->>'max_saved_colleges')::INTEGER, max_saved_colleges),
    max_comparisons = COALESCE((p_config->>'max_comparisons')::INTEGER, max_comparisons),
    primary_color = COALESCE((p_config->>'primary_color')::TEXT, primary_color),
    icon_name = COALESCE((p_config->>'icon_name')::TEXT, icon_name),
    updated_at = NOW()
  WHERE stream_id = p_stream_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE stream_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read stream configs
CREATE POLICY stream_config_select_policy
ON stream_config FOR SELECT
USING (true);

-- Only admins can update (via function)
CREATE POLICY stream_config_update_policy
ON stream_config FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Comments
COMMENT ON TABLE stream_config IS 'Configuration and metadata for academic streams (UG, PG Medical, PG Dental)';
COMMENT ON FUNCTION get_active_streams IS 'Get all enabled streams';
COMMENT ON FUNCTION update_stream_config IS 'Update stream configuration (admin only)';
