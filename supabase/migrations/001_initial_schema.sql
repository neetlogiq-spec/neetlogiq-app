-- =====================================================
-- NEET Counseling Platform - Initial Database Schema
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Colleges table
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  management_type TEXT CHECK (management_type IN ('Government', 'Private', 'Trust', 'Deemed')),
  niac_rating TEXT,
  nirf_rank INTEGER,
  established_year INTEGER,
  facilities JSONB DEFAULT '{}',
  coordinates GEOGRAPHY(POINT, 4326),
  total_seats INTEGER DEFAULT 0,
  website_url TEXT,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stream TEXT NOT NULL,
  duration TEXT,
  seats_available INTEGER,
  fees_structure JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cutoffs table
CREATE TABLE IF NOT EXISTS cutoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  category TEXT NOT NULL,
  quota TEXT NOT NULL,
  round INTEGER NOT NULL,
  opening_rank INTEGER,
  closing_rank INTEGER,
  seats INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite unique constraint
  CONSTRAINT unique_cutoff UNIQUE (college_id, year, category, quota, round)
);

-- =====================================================
-- USER MANAGEMENT TABLES
-- =====================================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  neet_rank INTEGER,
  neet_year INTEGER,
  category TEXT,
  state TEXT,
  preferences JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  subscription_tier TEXT CHECK (subscription_tier IN ('free', 'counseling', 'premium')) DEFAULT 'free',
  subscription_end_date TIMESTAMPTZ,
  daily_recommendation_count INTEGER DEFAULT 0,
  last_recommendation_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('free', 'counseling', 'premium')) DEFAULT 'free',
  razorpay_subscription_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  status TEXT CHECK (status IN ('active', 'expired', 'cancelled', 'pending')) DEFAULT 'pending',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT false,
  amount_paid INTEGER, -- in paise
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_active_subscription UNIQUE (user_id, status)
  WHERE status = 'active'
);

-- Payment history
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT CHECK (status IN ('success', 'failed', 'pending')),
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER INTERACTION TABLES
-- =====================================================

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('college', 'course', 'cutoff')) DEFAULT 'college',
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_favorite UNIQUE (user_id, college_id)
);

-- College notes (from CollegeWorkspace)
CREATE TABLE IF NOT EXISTS college_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_watchlist UNIQUE (user_id, college_id)
);

-- =====================================================
-- REAL-TIME COUNSELING TABLES
-- =====================================================

-- Live seat updates (for premium real-time counseling tracker)
CREATE TABLE IF NOT EXISTS live_seat_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  seats_filled INTEGER DEFAULT 0,
  seats_total INTEGER NOT NULL,
  last_rank_filled INTEGER,
  filling_rate DECIMAL(5,2), -- Percentage filled
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_live_seat UNIQUE (college_id, course_id, round)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('deadline', 'seat_alert', 'cutoff_update', 'recommendation', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert subscriptions (premium feature)
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  alert_type TEXT CHECK (alert_type IN ('seat_filling', 'cutoff_change', 'deadline')) NOT NULL,
  threshold INTEGER, -- For seat filling percentage
  sms_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_alert UNIQUE (user_id, college_id, alert_type)
);

-- =====================================================
-- RECOMMENDATION SYSTEM TABLES
-- =====================================================

-- Recommendation cache (stores ML predictions)
CREATE TABLE IF NOT EXISTS recommendation_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2) NOT NULL, -- 0-100
  safety_level TEXT CHECK (safety_level IN ('safe', 'moderate', 'reach', 'dream')),
  factors JSONB DEFAULT '{}', -- Detailed scoring factors
  reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_hidden_gem BOOLEAN DEFAULT false,
  is_early_advantage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  CONSTRAINT unique_recommendation UNIQUE (user_id, college_id)
);

-- User search history (for improving recommendations)
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT,
  filters JSONB DEFAULT '{}',
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS TABLES
-- =====================================================

-- User activity log
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Colleges indexes
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state);
CREATE INDEX IF NOT EXISTS idx_colleges_management ON colleges(management_type);
CREATE INDEX IF NOT EXISTS idx_colleges_nirf ON colleges(nirf_rank) WHERE nirf_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_colleges_location ON colleges USING GIST(coordinates);

-- Cutoffs indexes
CREATE INDEX IF NOT EXISTS idx_cutoffs_college_year ON cutoffs(college_id, year);
CREATE INDEX IF NOT EXISTS idx_cutoffs_category ON cutoffs(category);
CREATE INDEX IF NOT EXISTS idx_cutoffs_rank ON cutoffs(closing_rank);
CREATE INDEX IF NOT EXISTS idx_cutoffs_year_category ON cutoffs(year, category);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_rank ON user_profiles(neet_rank);

-- Favorites indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_college ON favorites(college_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Recommendation cache indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendation_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_score ON recommendation_cache(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON recommendation_cache(expires_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE college_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Payment history policies
CREATE POLICY "Users can view own payments"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- Favorites policies
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
  ON favorites FOR UPDATE
  USING (auth.uid() = user_id);

-- College notes policies
CREATE POLICY "Users can manage own notes"
  ON college_notes FOR ALL
  USING (auth.uid() = user_id);

-- Watchlist policies
CREATE POLICY "Users can manage own watchlist"
  ON watchlist FOR ALL
  USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Alert subscriptions policies
CREATE POLICY "Users can manage own alerts"
  ON alert_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Recommendation cache policies
CREATE POLICY "Users can view own recommendations"
  ON recommendation_cache FOR SELECT
  USING (auth.uid() = user_id);

-- Search history policies
CREATE POLICY "Users can view own search history"
  ON search_history FOR ALL
  USING (auth.uid() = user_id);

-- User activity policies
CREATE POLICY "Users can view own activity"
  ON user_activity FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_colleges_updated_at
  BEFORE UPDATE ON colleges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_college_notes_updated_at
  BEFORE UPDATE ON college_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check subscription status
CREATE OR REPLACE FUNCTION check_subscription_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date < NOW() AND NEW.status = 'active' THEN
    NEW.status = 'expired';

    -- Update user profile tier to free
    UPDATE user_profiles
    SET subscription_tier = 'free'
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_subscription_expiry
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION check_subscription_status();

-- Function to reset daily recommendation count
CREATE OR REPLACE FUNCTION reset_recommendation_count()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET
    daily_recommendation_count = 0,
    last_recommendation_reset = NOW()
  WHERE last_recommendation_reset < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired recommendations
CREATE OR REPLACE FUNCTION clean_expired_recommendations()
RETURNS void AS $$
BEGIN
  DELETE FROM recommendation_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, priority)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_priority)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access premium features
CREATE OR REPLACE FUNCTION has_premium_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
  v_end_date TIMESTAMPTZ;
BEGIN
  SELECT subscription_tier, subscription_end_date
  INTO v_tier, v_end_date
  FROM user_profiles
  WHERE user_id = p_user_id;

  IF v_tier = 'free' THEN
    RETURN FALSE;
  END IF;

  IF v_end_date IS NULL OR v_end_date > NOW() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- College statistics view
CREATE MATERIALIZED VIEW college_stats AS
SELECT
  c.id,
  c.name,
  c.state,
  c.management_type,
  c.nirf_rank,
  COUNT(DISTINCT co.id) as course_count,
  COUNT(DISTINCT cu.id) as cutoff_records,
  MIN(cu.closing_rank) as lowest_cutoff,
  AVG(cu.closing_rank)::INTEGER as avg_cutoff,
  MAX(cu.year) as latest_year,
  COUNT(DISTINCT f.user_id) as favorite_count
FROM colleges c
LEFT JOIN courses co ON c.id = co.college_id
LEFT JOIN cutoffs cu ON c.id = cu.college_id
LEFT JOIN favorites f ON c.id = f.college_id
GROUP BY c.id, c.name, c.state, c.management_type, c.nirf_rank;

CREATE UNIQUE INDEX idx_college_stats_id ON college_stats(id);
CREATE INDEX idx_college_stats_state ON college_stats(state);
CREATE INDEX idx_college_stats_cutoff ON college_stats(lowest_cutoff);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_college_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY college_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEDULED JOBS (using pg_cron)
-- =====================================================

-- Reset recommendation counts daily at midnight
SELECT cron.schedule(
  'reset-recommendation-counts',
  '0 0 * * *',
  'SELECT reset_recommendation_count();'
);

-- Clean expired recommendations every hour
SELECT cron.schedule(
  'clean-expired-recommendations',
  '0 * * * *',
  'SELECT clean_expired_recommendations();'
);

-- Refresh college stats daily at 2 AM
SELECT cron.schedule(
  'refresh-college-stats',
  '0 2 * * *',
  'SELECT refresh_college_stats();'
);

-- Check and expire subscriptions daily
SELECT cron.schedule(
  'check-subscription-expiry',
  '0 1 * * *',
  'UPDATE subscriptions SET status = ''expired'' WHERE end_date < NOW() AND status = ''active'';'
);

-- =====================================================
-- INITIAL DATA / SEED
-- =====================================================

-- Create default subscription plans reference
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL, -- in paise
  duration TEXT CHECK (duration IN ('monthly', 'seasonal', 'annual')),
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans (id, name, price, duration, features) VALUES
('free', 'Explorer', 0, 'monthly', '[
  "Basic college search",
  "View cutoffs (last 3 years)",
  "Save 10 colleges",
  "3 recommendations per day",
  "Basic chance calculator"
]'),
('counseling', 'Counseling Season Pass', 99900, 'seasonal', '[
  "Everything in Free",
  "Live counseling tracker",
  "Unlimited recommendations",
  "Save unlimited colleges",
  "Advanced analytics",
  "SMS + Email alerts",
  "Priority support",
  "Round-wise strategy"
]'),
('premium', 'Premium Annual', 199900, 'annual', '[
  "Everything in Counseling Pass",
  "AI Study Buddy",
  "College visit planner",
  "Document manager",
  "Family sharing (3 members)",
  "Custom reports",
  "Career counseling session",
  "NEET prep tracker"
]');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE colleges IS 'Main college information';
COMMENT ON TABLE cutoffs IS 'Historical cutoff data';
COMMENT ON TABLE subscriptions IS 'User subscription tracking for premium features';
COMMENT ON TABLE recommendation_cache IS 'Cached ML recommendations with 24h expiry';
COMMENT ON TABLE live_seat_updates IS 'Real-time seat filling data for counseling tracker';
COMMENT ON FUNCTION has_premium_access IS 'Check if user has active premium subscription';
