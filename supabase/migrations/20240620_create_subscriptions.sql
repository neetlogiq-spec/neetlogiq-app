-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'basic', 'pro', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  end_date TIMESTAMP WITH TIME ZONE,
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_customer_id TEXT,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'INR',
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  razorpay_order_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT,
  description TEXT,
  invoice_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create premium_features table (what each tier includes)
CREATE TABLE IF NOT EXISTS premium_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  free_limit INTEGER DEFAULT 0,
  basic_limit INTEGER DEFAULT 10,
  pro_limit INTEGER DEFAULT 100,
  premium_limit INTEGER DEFAULT -1, -- -1 means unlimited
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create user_feature_usage table (track usage)
CREATE TABLE IF NOT EXISTS user_feature_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, feature_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_usage_user_id ON user_feature_usage(user_id);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_usage ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Payment history policies
CREATE POLICY "Users can view their own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create payment records"
  ON payment_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Premium features policies
CREATE POLICY "Anyone can view premium features"
  ON premium_features FOR SELECT
  USING (true);

-- User feature usage policies
CREATE POLICY "Users can view their own feature usage"
  ON user_feature_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature usage"
  ON user_feature_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create feature usage records"
  ON user_feature_usage FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Insert default premium features
INSERT INTO premium_features (feature_key, feature_name, description, free_limit, basic_limit, pro_limit, premium_limit) VALUES
('college_comparisons', 'College Comparisons', 'Number of college comparisons per month', 3, 20, 100, -1),
('smart_predictions', 'Smart Predictions', 'AI-powered college predictions per month', 5, 50, 200, -1),
('trend_analysis', 'Trend Analysis', 'Access to historical trend data', 0, 1, 1, 1),
('counselling_documents', 'Counselling Documents', 'Download counselling documents', 2, 20, 100, -1),
('export_data', 'Export Data', 'Export college lists and comparisons', 0, 10, 50, -1),
('priority_support', 'Priority Support', 'Get priority customer support', 0, 0, 1, 1),
('advanced_filters', 'Advanced Filters', 'Use advanced search filters', 0, 1, 1, 1),
('rank_predictor', 'Rank Predictor', 'Advanced rank prediction tools', 0, 1, 1, 1);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_user_feature_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_subscriptions_updated_at_trigger BEFORE UPDATE
  ON subscriptions FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

CREATE TRIGGER update_user_feature_usage_updated_at_trigger BEFORE UPDATE
  ON user_feature_usage FOR EACH ROW
  EXECUTE FUNCTION update_user_feature_usage_updated_at();

-- Create function to check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
    AND status = 'active'
    AND (end_date IS NULL OR end_date > TIMEZONE('utc', NOW()))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's current plan
CREATE OR REPLACE FUNCTION get_user_plan(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_plan_type TEXT;
BEGIN
  SELECT plan_type INTO v_plan_type
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status = 'active'
  AND (end_date IS NULL OR end_date > TIMEZONE('utc', NOW()))
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_plan_type, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE subscriptions IS 'User subscription plans and billing information';
COMMENT ON TABLE payment_history IS 'Payment transaction history';
COMMENT ON TABLE premium_features IS 'Feature limits for each subscription tier';
COMMENT ON TABLE user_feature_usage IS 'Track user feature usage for rate limiting';
