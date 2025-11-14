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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create partial unique index for active subscriptions (one active subscription per user)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_subscription_per_user
ON subscriptions(user_id)
WHERE status = 'active';

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
-- Admin Audit Log Table
-- Tracks all admin actions for compliance and debugging

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE')),
    resource_type TEXT NOT NULL, -- 'college', 'cutoff', 'course', etc.
    resource_id TEXT NOT NULL,   -- ID of the affected resource
    changes JSONB,               -- What changed (before/after)
    ip_address INET,             -- IP address of admin
    user_agent TEXT,             -- Browser/client info
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_audit_user ON admin_audit_log(user_id);
CREATE INDEX idx_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON admin_audit_log(action);

-- RLS Policy (only admins can view audit logs)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
    ON admin_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- Add role column to user_profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'role'
    ) THEN
        ALTER TABLE user_profiles
        ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

        CREATE INDEX idx_user_profiles_role ON user_profiles(role);
    END IF;
END $$;

-- Function to get audit trail for a resource
CREATE OR REPLACE FUNCTION get_audit_trail(
    p_resource_type TEXT,
    p_resource_id TEXT
)
RETURNS TABLE (
    id UUID,
    user_email TEXT,
    action TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        u.email as user_email,
        a.action,
        a.changes,
        a.created_at
    FROM admin_audit_log a
    JOIN auth.users u ON a.user_id = u.id
    WHERE a.resource_type = p_resource_type
      AND a.resource_id = p_resource_id
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE admin_audit_log IS 'Tracks all administrative actions for audit trail';
COMMENT ON FUNCTION get_audit_trail IS 'Get complete audit history for a specific resource';
-- Create counselling_documents table for managing MCC and KEA documents
CREATE TABLE IF NOT EXISTS counselling_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  counselling_body TEXT NOT NULL CHECK (counselling_body IN ('MCC', 'KEA')),
  file_url TEXT NOT NULL,
  official_url TEXT NOT NULL,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_size TEXT NOT NULL,
  downloads INTEGER DEFAULT 0,
  icon_type TEXT DEFAULT 'FileText',
  color TEXT DEFAULT 'from-blue-500 to-cyan-500',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_counselling_documents_body ON counselling_documents(counselling_body);
CREATE INDEX IF NOT EXISTS idx_counselling_documents_category ON counselling_documents(category);
CREATE INDEX IF NOT EXISTS idx_counselling_documents_created_at ON counselling_documents(created_at DESC);

-- Enable Row Level Security
ALTER TABLE counselling_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read documents
CREATE POLICY "Public documents are viewable by everyone"
  ON counselling_documents FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert documents
CREATE POLICY "Authenticated users can insert documents"
  ON counselling_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can update documents
CREATE POLICY "Authenticated users can update documents"
  ON counselling_documents FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy: Only authenticated users can delete documents
CREATE POLICY "Authenticated users can delete documents"
  ON counselling_documents FOR DELETE
  USING (auth.role() = 'authenticated');

-- Insert sample MCC documents
INSERT INTO counselling_documents (title, category, counselling_body, file_url, official_url, upload_date, file_size, downloads, icon_type, color) VALUES
('NEET UG 2024 Seat Matrix - Round 1', 'Seat Matrix', 'MCC', '/documents/mcc-seat-matrix-2024.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=1&LangId=P', '2024-06-15', '12.5 MB', 45231, 'FileText', 'from-blue-500 to-cyan-500'),
('Round 1 Schedule & Important Dates', 'Schedule', 'MCC', '/documents/mcc-round1-schedule.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=2&LangId=P', '2024-06-10', '2.1 MB', 38450, 'Calendar', 'from-purple-500 to-pink-500'),
('Document Verification Guidelines', 'Guidelines', 'MCC', '/documents/mcc-document-guidelines.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=3&LangId=P', '2024-06-05', '5.8 MB', 29340, 'FileCheck', 'from-green-500 to-teal-500'),
('NEET UG 2024 Information Bulletin', 'Information', 'MCC', '/documents/mcc-information-bulletin.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=4&LangId=P', '2024-05-20', '8.3 MB', 56120, 'FileText', 'from-orange-500 to-red-500');

-- Insert sample KEA documents
INSERT INTO counselling_documents (title, category, counselling_body, file_url, official_url, upload_date, file_size, downloads, icon_type, color) VALUES
('Karnataka CET 2024 Seat Matrix', 'Seat Matrix', 'KEA', '/documents/kea-seat-matrix-2024.pdf', 'https://kea.kar.nic.in/ugmedical2024/seat_matrix.aspx', '2024-06-20', '8.2 MB', 28450, 'FileText', 'from-purple-500 to-pink-500'),
('KEA Counselling Schedule 2024', 'Schedule', 'KEA', '/documents/kea-schedule-2024.pdf', 'https://kea.kar.nic.in/ugmedical2024/schedule.aspx', '2024-06-18', '1.9 MB', 22130, 'Calendar', 'from-blue-500 to-cyan-500');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_counselling_documents_updated_at BEFORE UPDATE
  ON counselling_documents FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE counselling_documents IS 'Stores counselling documents for MCC and KEA with metadata';
COMMENT ON COLUMN counselling_documents.counselling_body IS 'Either MCC or KEA';
COMMENT ON COLUMN counselling_documents.file_url IS 'Internal file URL for preview';
COMMENT ON COLUMN counselling_documents.official_url IS 'Official government website URL';
COMMENT ON COLUMN counselling_documents.downloads IS 'Number of times document was downloaded/viewed';
COMMENT ON COLUMN counselling_documents.icon_type IS 'Lucide icon name (FileText, Calendar, FileCheck, etc.)';
COMMENT ON COLUMN counselling_documents.color IS 'Tailwind gradient classes for visual theming';
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
-- Add role-based access control to user_profiles
-- Replaces hardcoded email checking with proper database roles

-- Add role column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Add audit log for role changes
CREATE TABLE IF NOT EXISTS admin_role_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  old_role TEXT,
  new_role TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_user_id ON admin_role_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_changed_at ON admin_role_changes(changed_at DESC);

-- Function to assign admin role (can only be called by super_admin)
CREATE OR REPLACE FUNCTION assign_admin_role(
  p_target_user_id UUID,
  p_new_role TEXT,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role TEXT;
  v_old_role TEXT;
BEGIN
  -- Check if the requesting user is a super_admin
  SELECT role INTO v_admin_role
  FROM user_profiles
  WHERE user_id = p_admin_user_id;

  IF v_admin_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can assign roles';
  END IF;

  -- Validate new role
  IF p_new_role NOT IN ('user', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  -- Get current role
  SELECT role INTO v_old_role
  FROM user_profiles
  WHERE user_id = p_target_user_id;

  -- Update role
  UPDATE user_profiles
  SET role = p_new_role, updated_at = NOW()
  WHERE user_id = p_target_user_id;

  -- Log the change
  INSERT INTO admin_role_changes (user_id, old_role, new_role, changed_by, reason)
  VALUES (p_target_user_id, v_old_role, p_new_role, p_admin_user_id, p_reason);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin (callable by anyone)
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM user_profiles
  WHERE user_id = p_user_id;

  RETURN v_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin (callable by anyone)
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM user_profiles
  WHERE user_id = p_user_id;

  RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) Policies
-- Only admins can view admin_role_changes
ALTER TABLE admin_role_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_role_changes_select_policy
ON admin_role_changes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Only super_admins can insert role changes (via function)
CREATE POLICY admin_role_changes_insert_policy
ON admin_role_changes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Comment explaining the role system
COMMENT ON COLUMN user_profiles.role IS 'User role for RBAC: user (default), admin (can manage data), super_admin (can assign roles)';
COMMENT ON TABLE admin_role_changes IS 'Audit log for all role changes';
COMMENT ON FUNCTION assign_admin_role IS 'Assign admin role to a user (super_admin only)';
COMMENT ON FUNCTION is_admin IS 'Check if user has admin privileges';
COMMENT ON FUNCTION is_super_admin IS 'Check if user has super admin privileges';
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
