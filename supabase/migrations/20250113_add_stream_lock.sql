-- =====================================================
-- Add Stream Lock Feature to User Profiles
-- Created: 2025-01-13
-- =====================================================

-- Add stream selection and lock fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS selected_stream TEXT CHECK (selected_stream IN ('UG', 'PG_MEDICAL', 'PG_DENTAL')),
ADD COLUMN IF NOT EXISTS stream_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stream_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stream_change_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stream_change_request_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stream_change_request_reason TEXT;

-- Create index on selected_stream for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stream ON user_profiles(selected_stream);

-- Create stream change requests table for admin management
CREATE TABLE IF NOT EXISTS stream_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_stream TEXT NOT NULL,
  requested_stream TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  admin_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Enable RLS on stream_change_requests
ALTER TABLE stream_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own stream change requests
CREATE POLICY "Users can view own stream change requests"
  ON stream_change_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own stream change requests
CREATE POLICY "Users can create own stream change requests"
  ON stream_change_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_stream_change_requests_status
  ON stream_change_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_change_requests_user
  ON stream_change_requests(user_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_stream_change_requests_updated_at
  BEFORE UPDATE ON stream_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to lock user stream
CREATE OR REPLACE FUNCTION lock_user_stream(p_user_id UUID, p_stream TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles
  SET
    selected_stream = p_stream,
    stream_locked = true,
    stream_locked_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to change user stream (bypasses lock)
CREATE OR REPLACE FUNCTION admin_change_user_stream(
  p_user_id UUID,
  p_new_stream TEXT,
  p_admin_user_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update user profile
  UPDATE user_profiles
  SET
    selected_stream = p_new_stream,
    stream_locked = true,
    stream_locked_at = NOW(),
    stream_change_requested = false,
    stream_change_request_date = NULL,
    stream_change_request_reason = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Update any pending stream change request
  UPDATE stream_change_requests
  SET
    status = 'approved',
    admin_user_id = p_admin_user_id,
    admin_notes = p_admin_notes,
    processed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND requested_stream = p_new_stream;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request stream change
CREATE OR REPLACE FUNCTION request_stream_change(
  p_user_id UUID,
  p_requested_stream TEXT,
  p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_current_stream TEXT;
  v_request_id UUID;
BEGIN
  -- Get current stream
  SELECT selected_stream INTO v_current_stream
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- Create stream change request
  INSERT INTO stream_change_requests (
    user_id,
    current_stream,
    requested_stream,
    reason,
    status
  ) VALUES (
    p_user_id,
    v_current_stream,
    p_requested_stream,
    p_reason,
    'pending'
  ) RETURNING id INTO v_request_id;

  -- Update user profile to mark request as pending
  UPDATE user_profiles
  SET
    stream_change_requested = true,
    stream_change_request_date = NOW(),
    stream_change_request_reason = p_reason,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.selected_stream IS 'User selected academic stream (UG, PG_MEDICAL, PG_DENTAL)';
COMMENT ON COLUMN user_profiles.stream_locked IS 'Whether stream selection is locked and cannot be changed by user';
COMMENT ON COLUMN user_profiles.stream_locked_at IS 'Timestamp when stream was locked';
COMMENT ON COLUMN user_profiles.stream_change_requested IS 'Whether user has requested a stream change';
COMMENT ON TABLE stream_change_requests IS 'Requests from users to change their locked stream';
COMMENT ON FUNCTION lock_user_stream IS 'Lock user stream selection after confirmation';
COMMENT ON FUNCTION admin_change_user_stream IS 'Admin function to change user stream (bypasses lock)';
COMMENT ON FUNCTION request_stream_change IS 'User function to request stream change from locked state';
