-- Subscription downgrade rules and grace period logic

-- Add downgrade-related fields to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS downgrade_scheduled BOOLEAN DEFAULT false;

-- Create index
CREATE INDEX IF NOT EXISTS idx_subscriptions_grace_period ON subscriptions(grace_period_ends_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_downgrade ON subscriptions(downgrade_scheduled, end_date);

-- Function to handle subscription downgrade
CREATE OR REPLACE FUNCTION downgrade_subscription(
  p_user_id UUID,
  p_grace_period_days INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_favorites_count INTEGER;
  v_favorites_to_remove INTEGER;
  v_profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- Count saved favorites
  SELECT COUNT(*) INTO v_favorites_count
  FROM favorites
  WHERE user_id = p_user_id;

  -- Determine how many favorites to remove (free tier allows 10)
  v_favorites_to_remove := GREATEST(0, v_favorites_count - 10);

  -- Apply grace period if provided
  IF p_grace_period_days > 0 THEN
    UPDATE user_profiles
    SET
      subscription_tier = 'free',
      updated_at = NOW()
    WHERE user_id = p_user_id;

    UPDATE subscriptions
    SET
      grace_period_ends_at = NOW() + (p_grace_period_days || ' days')::INTERVAL,
      downgrade_scheduled = true,
      updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';

    -- Send notification about grace period
    PERFORM create_notification(
      p_user_id,
      'system',
      'Subscription Ending - Grace Period Active',
      format('Your Premium subscription has ended. You have %s days of grace period to keep your saved data. Please upgrade to avoid data loss.', p_grace_period_days),
      '/pricing',
      'high'
    );

    RETURN jsonb_build_object(
      'success', true,
      'grace_period', true,
      'grace_period_days', p_grace_period_days,
      'message', 'Downgrade scheduled with grace period'
    );
  END IF;

  -- Immediate downgrade without grace period
  UPDATE user_profiles
  SET
    subscription_tier = 'free',
    daily_recommendation_count = LEAST(daily_recommendation_count, 3),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Remove excess favorites (keep oldest 10)
  IF v_favorites_to_remove > 0 THEN
    DELETE FROM favorites
    WHERE id IN (
      SELECT id FROM favorites
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      OFFSET 10
    );
  END IF;

  -- Send notification
  PERFORM create_notification(
    p_user_id,
    'system',
    'Subscription Downgraded',
    format('Your account has been downgraded to Free tier. %s saved colleges were removed to comply with free tier limits.', v_favorites_to_remove),
    '/pricing',
    'high'
  );

  RETURN jsonb_build_object(
    'success', true,
    'grace_period', false,
    'favorites_removed', v_favorites_to_remove,
    'message', 'Downgrade completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process downgrades (called by cron)
CREATE OR REPLACE FUNCTION process_subscription_downgrades()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_subscription RECORD;
BEGIN
  -- Find all subscriptions that have ended
  FOR v_subscription IN
    SELECT user_id, end_date, grace_period_ends_at
    FROM subscriptions
    WHERE status = 'active'
      AND end_date < NOW()
      AND (grace_period_ends_at IS NULL OR grace_period_ends_at < NOW())
  LOOP
    -- Mark subscription as expired
    UPDATE subscriptions
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE user_id = v_subscription.user_id
      AND status = 'active';

    -- Downgrade user (no grace period as it's already passed or wasn't set)
    PERFORM downgrade_subscription(v_subscription.user_id, 0);

    v_count := v_count + 1;
  END LOOP;

  -- Log the downgrades
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    details
  ) VALUES (
    NULL,
    'subscription_downgrades',
    jsonb_build_object(
      'downgraded_count', v_count,
      'processed_at', NOW()
    )
  );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel subscription with optional immediate effect
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_user_id UUID,
  p_immediate BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_refund_eligible BOOLEAN := false;
  v_days_used INTEGER;
  v_days_total INTEGER;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active subscription found'
    );
  END IF;

  -- Calculate refund eligibility (within 7 days and used less than 50% of time)
  v_days_used := EXTRACT(DAY FROM (NOW() - v_subscription.start_date));
  v_days_total := EXTRACT(DAY FROM (v_subscription.end_date - v_subscription.start_date));

  IF v_days_used <= 7 AND (v_days_used::FLOAT / v_days_total::FLOAT) < 0.5 THEN
    v_refund_eligible := true;
  END IF;

  -- Update subscription
  UPDATE subscriptions
  SET
    status = CASE WHEN p_immediate THEN 'cancelled' ELSE status END,
    auto_renew = false,
    cancellation_requested_at = NOW(),
    cancellation_reason = p_reason,
    updated_at = NOW()
  WHERE id = v_subscription.id;

  IF p_immediate THEN
    -- Immediate cancellation - downgrade now with 3-day grace period
    PERFORM downgrade_subscription(p_user_id, 3);

    RETURN jsonb_build_object(
      'success', true,
      'cancelled_immediately', true,
      'refund_eligible', v_refund_eligible,
      'grace_period_days', 3,
      'message', 'Subscription cancelled. 3-day grace period granted.'
    );
  ELSE
    -- Cancel at end of period - user keeps access until end date
    PERFORM create_notification(
      p_user_id,
      'system',
      'Subscription Cancellation Scheduled',
      format('Your subscription will end on %s. You will keep access until then.', TO_CHAR(v_subscription.end_date, 'Mon DD, YYYY')),
      '/pricing',
      'medium'
    );

    RETURN jsonb_build_object(
      'success', true,
      'cancelled_immediately', false,
      'access_until', v_subscription.end_date,
      'refund_eligible', v_refund_eligible,
      'message', 'Subscription will end at the end of current billing period'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent data loss warnings
CREATE OR REPLACE FUNCTION warn_before_downgrade()
RETURNS TRIGGER AS $$
DECLARE
  v_favorites_count INTEGER;
  v_will_lose INTEGER;
BEGIN
  -- Only trigger on tier downgrade
  IF OLD.subscription_tier = 'premium' AND NEW.subscription_tier = 'free' THEN
    -- Count favorites
    SELECT COUNT(*) INTO v_favorites_count
    FROM favorites
    WHERE user_id = NEW.user_id;

    v_will_lose := GREATEST(0, v_favorites_count - 10);

    IF v_will_lose > 0 THEN
      -- Send warning notification
      PERFORM create_notification(
        NEW.user_id,
        'warning',
        '⚠️ Data Loss Warning',
        format('You have %s saved colleges but Free tier only allows 10. %s colleges will be removed. Upgrade to Premium to keep all your data.', v_favorites_count, v_will_lose),
        '/pricing',
        'high'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger
DROP TRIGGER IF EXISTS warn_before_downgrade_trigger ON user_profiles;
CREATE TRIGGER warn_before_downgrade_trigger
BEFORE UPDATE ON user_profiles
FOR EACH ROW
WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
EXECUTE FUNCTION warn_before_downgrade();

-- Comments
COMMENT ON FUNCTION downgrade_subscription IS 'Downgrade user to free tier with optional grace period';
COMMENT ON FUNCTION process_subscription_downgrades IS 'Process all pending subscription downgrades (called by cron)';
COMMENT ON FUNCTION cancel_subscription IS 'Cancel user subscription with optional immediate effect';
COMMENT ON FUNCTION warn_before_downgrade IS 'Warn user before data loss during downgrade';
