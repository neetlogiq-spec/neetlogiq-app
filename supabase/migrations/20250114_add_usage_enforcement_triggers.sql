-- Triggers to enforce usage limits based on subscription tier

-- Trigger function to check saved colleges limit before insert
CREATE OR REPLACE FUNCTION check_saved_colleges_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit_check JSONB;
BEGIN
  -- Check usage limit
  v_limit_check := check_usage_limit(NEW.user_id, 'saved_colleges');

  IF NOT (v_limit_check->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'Usage limit exceeded: %',
      CASE
        WHEN (v_limit_check->>'tier')::TEXT = 'free' THEN
          'Free tier allows only ' || (v_limit_check->>'limit')::TEXT || ' saved colleges. Upgrade to Premium for unlimited access.'
        ELSE
          'You have reached your saved colleges limit'
      END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on favorites table to enforce saved colleges limit
DROP TRIGGER IF EXISTS enforce_saved_colleges_limit ON favorites;
CREATE TRIGGER enforce_saved_colleges_limit
BEFORE INSERT ON favorites
FOR EACH ROW
EXECUTE FUNCTION check_saved_colleges_limit();

-- Trigger function to check daily recommendations limit before increment
CREATE OR REPLACE FUNCTION check_daily_recommendations_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit_check JSONB;
  v_current_count INTEGER;
BEGIN
  -- Get current daily count
  SELECT daily_recommendation_count INTO v_current_count
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  -- Check if we need to reset (if last reset was more than 24 hours ago)
  UPDATE user_profiles
  SET
    daily_recommendation_count = 0,
    last_recommendation_reset = NOW()
  WHERE user_id = NEW.user_id
    AND last_recommendation_reset < NOW() - INTERVAL '24 hours';

  -- Check usage limit
  v_limit_check := check_usage_limit(NEW.user_id, 'daily_recommendations');

  IF NOT (v_limit_check->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'Usage limit exceeded: %',
      CASE
        WHEN (v_limit_check->>'tier')::TEXT = 'free' THEN
          'Free tier allows only ' || (v_limit_check->>'limit')::TEXT || ' recommendations per day. Upgrade to Premium for unlimited recommendations.'
        ELSE
          'You have reached your daily recommendations limit'
      END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create recommendation_requests table to track recommendations
CREATE TABLE IF NOT EXISTS recommendation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  neet_rank INTEGER,
  category TEXT,
  state TEXT,
  stream TEXT,
  recommendations_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_user_id ON recommendation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_requests_created_at ON recommendation_requests(created_at DESC);

-- Trigger on recommendation_requests to enforce daily limit
DROP TRIGGER IF EXISTS enforce_daily_recommendations_limit ON recommendation_requests;
CREATE TRIGGER enforce_daily_recommendations_limit
BEFORE INSERT ON recommendation_requests
FOR EACH ROW
EXECUTE FUNCTION check_daily_recommendations_limit();

-- Trigger function to increment daily recommendation count after recommendation
CREATE OR REPLACE FUNCTION increment_recommendation_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET daily_recommendation_count = daily_recommendation_count + 1
  WHERE user_id = NEW.user_id;

  -- Also track in usage tracking
  PERFORM track_user_activity(NEW.user_id, 'recommendation');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment count after successful recommendation
DROP TRIGGER IF EXISTS increment_daily_recommendation_count ON recommendation_requests;
CREATE TRIGGER increment_daily_recommendation_count
AFTER INSERT ON recommendation_requests
FOR EACH ROW
EXECUTE FUNCTION increment_recommendation_count();

-- Trigger function to track college saves
CREATE OR REPLACE FUNCTION track_college_save()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM track_user_activity(NEW.user_id, 'save_college');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track college saves
DROP TRIGGER IF EXISTS track_college_save_trigger ON favorites;
CREATE TRIGGER track_college_save_trigger
AFTER INSERT ON favorites
FOR EACH ROW
EXECUTE FUNCTION track_college_save();

-- Trigger function to track comparisons
CREATE TABLE IF NOT EXISTS college_comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_ids JSONB NOT NULL, -- Array of college IDs being compared
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_college_comparisons_user_id ON college_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_college_comparisons_created_at ON college_comparisons(created_at DESC);

-- Trigger function to track comparisons
CREATE OR REPLACE FUNCTION track_comparison()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM track_user_activity(NEW.user_id, 'comparison');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track comparisons
DROP TRIGGER IF EXISTS track_comparison_trigger ON college_comparisons;
CREATE TRIGGER track_comparison_trigger
AFTER INSERT ON college_comparisons
FOR EACH ROW
EXECUTE FUNCTION track_comparison();

-- Row Level Security for new tables
ALTER TABLE recommendation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE college_comparisons ENABLE ROW LEVEL SECURITY;

-- Users can only see/insert their own data
CREATE POLICY recommendation_requests_policy
ON recommendation_requests
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY college_comparisons_policy
ON college_comparisons
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can see all data
CREATE POLICY admin_recommendation_requests_policy
ON recommendation_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY admin_college_comparisons_policy
ON college_comparisons FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Comments
COMMENT ON FUNCTION check_saved_colleges_limit IS 'Trigger function to enforce saved colleges limit';
COMMENT ON FUNCTION check_daily_recommendations_limit IS 'Trigger function to enforce daily recommendations limit';
COMMENT ON FUNCTION increment_recommendation_count IS 'Increment daily recommendation count and track usage';
COMMENT ON TABLE recommendation_requests IS 'Track recommendation requests for usage limits and analytics';
COMMENT ON TABLE college_comparisons IS 'Track college comparisons for usage limits and analytics';
