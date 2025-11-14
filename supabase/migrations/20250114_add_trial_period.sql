-- Trial period logic for new users
-- Gives 7-day premium trial to new signups

-- Add trial tracking fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;

-- Create index for trial queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial ON user_profiles(trial_used, trial_ends_at);

-- Function to start trial for new user
CREATE OR REPLACE FUNCTION start_user_trial(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_trial_already_used BOOLEAN;
  v_trial_duration INTERVAL := '7 days';
BEGIN
  -- Check if user has already used trial
  SELECT trial_used INTO v_trial_already_used
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF v_trial_already_used THEN
    RETURN FALSE; -- Trial already used
  END IF;

  -- Start the trial
  UPDATE user_profiles
  SET
    trial_started_at = NOW(),
    trial_ends_at = NOW() + v_trial_duration,
    trial_used = true,
    subscription_tier = 'premium', -- Give premium access during trial
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create notification
  PERFORM create_notification(
    p_user_id,
    'system',
    '🎉 Welcome! Your 7-day Premium trial has started',
    'Enjoy unlimited access to all features for the next 7 days. Upgrade anytime to continue after the trial ends.',
    '/pricing',
    'high'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is on active trial
CREATE OR REPLACE FUNCTION is_on_trial(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  SELECT trial_ends_at INTO v_trial_ends_at
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF v_trial_ends_at IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_trial_ends_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire trials (called by cron)
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Downgrade users whose trials have expired
  UPDATE user_profiles
  SET
    subscription_tier = 'free',
    updated_at = NOW()
  WHERE
    trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
    AND subscription_tier = 'premium'
    AND NOT EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.user_id = user_profiles.user_id
      AND subscriptions.status = 'active'
      AND subscriptions.end_date > NOW()
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Send notifications to users whose trials expired
  INSERT INTO notifications (user_id, type, title, message, link, priority)
  SELECT
    user_id,
    'system',
    'Your Premium trial has ended',
    'Thanks for trying Premium! Upgrade now to continue enjoying unlimited access to all features.',
    '/pricing',
    'high'
  FROM user_profiles
  WHERE
    trial_ends_at >= NOW() - INTERVAL '1 day'
    AND trial_ends_at < NOW()
    AND subscription_tier = 'free';

  -- Log the expiration
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    details
  ) VALUES (
    NULL,
    'trial_expiration',
    jsonb_build_object(
      'expired_count', v_count,
      'expiration_time', NOW()
    )
  );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trial status for a user
CREATE OR REPLACE FUNCTION get_trial_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_days_remaining INTEGER;
BEGIN
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF v_profile.trial_used THEN
    IF v_profile.trial_ends_at IS NOT NULL AND v_profile.trial_ends_at > NOW() THEN
      -- Active trial
      v_days_remaining := EXTRACT(DAY FROM (v_profile.trial_ends_at - NOW()));

      RETURN jsonb_build_object(
        'trial_active', true,
        'trial_used', true,
        'started_at', v_profile.trial_started_at,
        'ends_at', v_profile.trial_ends_at,
        'days_remaining', v_days_remaining,
        'hours_remaining', EXTRACT(HOUR FROM (v_profile.trial_ends_at - NOW()))
      );
    ELSE
      -- Trial expired
      RETURN jsonb_build_object(
        'trial_active', false,
        'trial_used', true,
        'started_at', v_profile.trial_started_at,
        'ended_at', v_profile.trial_ends_at
      );
    END IF;
  ELSE
    -- Trial available
    RETURN jsonb_build_object(
      'trial_active', false,
      'trial_used', false,
      'trial_available', true
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically start trial for new users
CREATE OR REPLACE FUNCTION auto_start_trial_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only start trial if user hasn't used it yet
  IF NEW.trial_used = false OR NEW.trial_used IS NULL THEN
    PERFORM start_user_trial(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to user_profiles (only fires on insert)
DROP TRIGGER IF EXISTS auto_start_trial_trigger ON user_profiles;
CREATE TRIGGER auto_start_trial_trigger
AFTER INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_start_trial_on_signup();

-- Comments
COMMENT ON COLUMN user_profiles.trial_started_at IS 'When the user started their premium trial';
COMMENT ON COLUMN user_profiles.trial_ends_at IS 'When the user trial expires';
COMMENT ON COLUMN user_profiles.trial_used IS 'Whether the user has used their one-time trial';
COMMENT ON FUNCTION start_user_trial IS 'Start a 7-day premium trial for a user';
COMMENT ON FUNCTION is_on_trial IS 'Check if user is currently on an active trial';
COMMENT ON FUNCTION expire_trials IS 'Expire all trials that have ended (called by cron)';
COMMENT ON FUNCTION get_trial_status IS 'Get detailed trial status for a user';
