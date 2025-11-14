-- Usage tracking and monthly reset functionality

-- Create usage tracking table for more detailed analytics
CREATE TABLE IF NOT EXISTS user_usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: YYYY-MM

  -- Usage counters
  recommendations_count INTEGER DEFAULT 0,
  colleges_saved INTEGER DEFAULT 0,
  comparisons_made INTEGER DEFAULT 0,
  documents_downloaded INTEGER DEFAULT 0,
  searches_performed INTEGER DEFAULT 0,

  -- Feature usage
  used_cutoff_years JSONB DEFAULT '[]', -- Array of years accessed
  used_streams JSONB DEFAULT '[]', -- Array of streams accessed

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, month_year)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_user_id ON user_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_month_year ON user_usage_tracking(month_year);

-- Function to reset monthly usage counters
CREATE OR REPLACE FUNCTION reset_monthly_usage_counters()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Reset daily recommendation counter
  UPDATE user_profiles
  SET
    daily_recommendation_count = 0,
    last_recommendation_reset = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the reset operation
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    details
  ) VALUES (
    NULL,
    'monthly_usage_reset',
    jsonb_build_object(
      'reset_time', NOW(),
      'users_affected', v_count,
      'month_year', TO_CHAR(NOW(), 'YYYY-MM')
    )
  );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track user activity
CREATE OR REPLACE FUNCTION track_user_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_month_year TEXT;
BEGIN
  v_month_year := TO_CHAR(NOW(), 'YYYY-MM');

  -- Insert or update usage tracking for current month
  INSERT INTO user_usage_tracking (user_id, month_year)
  VALUES (p_user_id, v_month_year)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET updated_at = NOW();

  -- Update specific counters based on activity type
  CASE p_activity_type
    WHEN 'recommendation' THEN
      UPDATE user_usage_tracking
      SET recommendations_count = recommendations_count + 1
      WHERE user_id = p_user_id AND month_year = v_month_year;

    WHEN 'save_college' THEN
      UPDATE user_usage_tracking
      SET colleges_saved = colleges_saved + 1
      WHERE user_id = p_user_id AND month_year = v_month_year;

    WHEN 'comparison' THEN
      UPDATE user_usage_tracking
      SET comparisons_made = comparisons_made + 1
      WHERE user_id = p_user_id AND month_year = v_month_year;

    WHEN 'document_download' THEN
      UPDATE user_usage_tracking
      SET documents_downloaded = documents_downloaded + 1
      WHERE user_id = p_user_id AND month_year = v_month_year;

    WHEN 'search' THEN
      UPDATE user_usage_tracking
      SET searches_performed = searches_performed + 1
      WHERE user_id = p_user_id AND month_year = v_month_year;

    ELSE
      -- Unknown activity type, do nothing
      NULL;
  END CASE;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has exceeded their usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id UUID,
  p_limit_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_limit INTEGER;
  v_current_count INTEGER;
  v_can_proceed BOOLEAN;
BEGIN
  -- Get user profile with subscription tier
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Determine limits based on subscription tier
  CASE p_limit_type
    WHEN 'daily_recommendations' THEN
      -- Free: 3, Premium: unlimited
      IF v_profile.subscription_tier = 'free' THEN
        v_limit := 3;
      ELSE
        v_limit := -1; -- unlimited
      END IF;
      v_current_count := v_profile.daily_recommendation_count;

    WHEN 'saved_colleges' THEN
      -- Free: 10, Premium: unlimited
      SELECT COUNT(*) INTO v_current_count
      FROM favorites
      WHERE user_id = p_user_id;

      IF v_profile.subscription_tier = 'free' THEN
        v_limit := 10;
      ELSE
        v_limit := -1; -- unlimited
      END IF;

    ELSE
      RETURN jsonb_build_object(
        'allowed', false,
        'error', 'Unknown limit type'
      );
  END CASE;

  -- Check if limit is exceeded
  IF v_limit = -1 THEN
    -- Unlimited
    v_can_proceed := true;
  ELSE
    v_can_proceed := v_current_count < v_limit;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_can_proceed,
    'current_count', v_current_count,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit = -1 THEN -1 ELSE GREATEST(0, v_limit - v_current_count) END,
    'tier', v_profile.subscription_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE user_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage data
CREATE POLICY user_usage_tracking_select_policy
ON user_usage_tracking FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert/update their own usage data (via function)
CREATE POLICY user_usage_tracking_insert_policy
ON user_usage_tracking FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_usage_tracking_update_policy
ON user_usage_tracking FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can see all usage data
CREATE POLICY admin_usage_tracking_select_policy
ON user_usage_tracking FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Comments
COMMENT ON TABLE user_usage_tracking IS 'Monthly usage tracking for analytics and limit enforcement';
COMMENT ON FUNCTION reset_monthly_usage_counters IS 'Reset all user usage counters (called monthly)';
COMMENT ON FUNCTION track_user_activity IS 'Track user activity for analytics';
COMMENT ON FUNCTION check_usage_limit IS 'Check if user has exceeded their usage limits';
