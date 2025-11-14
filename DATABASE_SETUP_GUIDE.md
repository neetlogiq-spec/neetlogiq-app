# Database Setup Guide

## Complete Supabase Database Configuration

This guide provides step-by-step instructions for setting up the complete database schema, configuring streams, creating admin users, and testing all functionality.

---

## Prerequisites

1. **Supabase Project**: You must have a Supabase project created
2. **Access**: You need admin access to the Supabase Dashboard
3. **SQL Editor**: Access to the SQL Editor in your Supabase dashboard

---

## Step 1: Apply Database Migrations

You have **two options** for applying migrations:

### Option A: Apply Consolidated Migration (Recommended)

Apply the single consolidated migration that includes everything:

```sql
-- File: supabase/migrations/consolidated_all_migrations.sql
```

**How to apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the entire contents of `supabase/migrations/consolidated_all_migrations.sql`
4. Paste into the SQL Editor
5. Click "Run" or press Ctrl+Enter
6. Verify: "Success. No rows returned"

**What this includes:**
- Initial schema (users, colleges, courses, cutoffs, etc.)
- Admin and audit log tables
- Counselling documents tables
- Subscriptions and payments
- Stream configuration tables
- User roles and permissions
- Usage tracking and enforcement
- Trial period management
- Downgrade rules
- Fuzzy search capabilities

### Option B: Apply Individual Migrations (Alternative)

If you prefer to apply migrations one by one, run them in this exact order:

1. `001_initial_schema.sql` - Core tables
2. `002_admin_audit_log.sql` - Admin functionality
3. `20240615_create_counselling_documents.sql` - Counselling features
4. `20240620_create_subscriptions.sql` - Payment system
5. `20250113_add_stream_lock.sql` - Stream locking
6. `20250114_add_user_roles.sql` - Role-based access
7. `20250114_create_stream_config.sql` - Stream configuration
8. `20250114_add_usage_tracking.sql` - Usage analytics
9. `20250114_add_usage_enforcement_triggers.sql` - Limit enforcement
10. `20250114_add_trial_period.sql` - Trial management
11. `20250114_add_downgrade_rules.sql` - Subscription downgrades
12. `20250114_add_fuzzy_search.sql` - Typo-tolerant search

**Important:** Each migration must complete successfully before proceeding to the next.

---

## Step 2: Verify Migration Success

Run this query to verify all tables were created:

```sql
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected tables (minimum 25):**
- admin_activity_log
- admin_users
- colleges
- college_courses
- college_facilities
- counselling_bookings
- counselling_documents
- counselling_packages
- course_variants
- courses
- cutoffs
- live_seat_updates
- notifications
- payment_transactions
- recommendations
- stream_access_log
- stream_configurations
- stream_locks
- subscriptions
- user_activity
- user_preferences
- user_profiles
- user_roles
- user_streams
- user_usage_tracking

---

## Step 3: Insert Stream Configuration Data

The platform supports three educational streams. Insert the configuration for each:

```sql
-- Insert UG (Undergraduate) Stream Configuration
INSERT INTO stream_configurations (
  stream_id,
  stream_name,
  stream_description,
  is_enabled,
  requires_subscription,
  priority,
  metadata
) VALUES (
  'UG',
  'Undergraduate Medical (NEET UG)',
  'MBBS and BDS courses through NEET UG counseling',
  true,
  false,
  1,
  jsonb_build_object(
    'exam', 'NEET UG',
    'courses', ARRAY['MBBS', 'BDS'],
    'counseling_body', 'MCC',
    'rounds', 4,
    'max_choices', 100
  )
)
ON CONFLICT (stream_id) DO UPDATE
SET
  stream_name = EXCLUDED.stream_name,
  stream_description = EXCLUDED.stream_description,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- Insert PG Medical Stream Configuration
INSERT INTO stream_configurations (
  stream_id,
  stream_name,
  stream_description,
  is_enabled,
  requires_subscription,
  priority,
  metadata
) VALUES (
  'PG_MEDICAL',
  'Postgraduate Medical (NEET PG)',
  'MD/MS courses through NEET PG counseling',
  true,
  true,
  2,
  jsonb_build_object(
    'exam', 'NEET PG',
    'courses', ARRAY['MD', 'MS', 'PG Diploma'],
    'counseling_body', 'MCC',
    'rounds', 3,
    'max_choices', 75
  )
)
ON CONFLICT (stream_id) DO UPDATE
SET
  stream_name = EXCLUDED.stream_name,
  stream_description = EXCLUDED.stream_description,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- Insert Diploma Stream Configuration
INSERT INTO stream_configurations (
  stream_id,
  stream_name,
  stream_description,
  is_enabled,
  requires_subscription,
  priority,
  metadata
) VALUES (
  'DIPLOMA',
  'Diploma in Medical/Dental',
  'Diploma courses for medical and dental streams',
  true,
  true,
  3,
  jsonb_build_object(
    'exam', 'NEET UG',
    'courses', ARRAY['Diploma in Medical', 'Diploma in Dental'],
    'counseling_body', 'State Councils',
    'rounds', 2,
    'max_choices', 50
  )
)
ON CONFLICT (stream_id) DO UPDATE
SET
  stream_name = EXCLUDED.stream_name,
  stream_description = EXCLUDED.stream_description,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();
```

**Verify stream insertion:**

```sql
SELECT
  stream_id,
  stream_name,
  is_enabled,
  requires_subscription,
  priority
FROM stream_configurations
ORDER BY priority;
```

Expected output:
```
stream_id    | stream_name                  | is_enabled | requires_subscription | priority
-------------|------------------------------|------------|-----------------------|---------
UG           | Undergraduate Medical        | true       | false                 | 1
PG_MEDICAL   | Postgraduate Medical         | true       | true                  | 2
DIPLOMA      | Diploma in Medical/Dental    | true       | true                  | 3
```

---

## Step 4: Create Super Admin User

You need to create at least one super admin user to manage the platform.

### 4.1: Create Auth User First

You **cannot** create a super admin directly in SQL because Supabase Auth manages users.

**Option 1: Create via Supabase Dashboard**
1. Go to Authentication → Users
2. Click "Add user"
3. Enter email: `admin@example.com` (or your preferred admin email)
4. Set a strong password
5. Enable "Auto Confirm User"
6. Click "Create user"
7. Copy the User UUID (you'll need this)

**Option 2: Create via Sign-Up Flow**
1. Use your application's sign-up page
2. Register with your admin email
3. Verify email if required
4. Get the user UUID from the authentication table

### 4.2: Promote User to Super Admin

Once you have the user UUID, run this SQL:

```sql
-- Replace 'USER_UUID_HERE' with the actual UUID from Step 4.1
DO $$
DECLARE
  admin_user_id UUID := 'USER_UUID_HERE'::uuid;
  admin_role_id UUID;
BEGIN
  -- Create or get super_admin role
  INSERT INTO user_roles (role_name, role_description, permissions)
  VALUES (
    'super_admin',
    'Super Administrator with full platform access',
    jsonb_build_object(
      'can_manage_users', true,
      'can_manage_content', true,
      'can_manage_streams', true,
      'can_view_analytics', true,
      'can_manage_subscriptions', true,
      'can_access_admin_panel', true
    )
  )
  ON CONFLICT (role_name) DO UPDATE
  SET permissions = EXCLUDED.permissions
  RETURNING id INTO admin_role_id;

  -- Assign super_admin role to user
  UPDATE user_profiles
  SET role_id = admin_role_id
  WHERE user_id = admin_user_id;

  -- Create admin_users entry
  INSERT INTO admin_users (user_id, role, permissions, status)
  VALUES (
    admin_user_id,
    'super_admin',
    jsonb_build_object(
      'full_access', true,
      'can_create_admins', true
    ),
    'active'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'super_admin', status = 'active';

  -- Grant access to all streams
  INSERT INTO user_streams (user_id, stream_id, access_level)
  VALUES
    (admin_user_id, 'UG', 'full'),
    (admin_user_id, 'PG_MEDICAL', 'full'),
    (admin_user_id, 'DIPLOMA', 'full')
  ON CONFLICT (user_id, stream_id) DO UPDATE
  SET access_level = 'full';

  RAISE NOTICE 'Super admin created successfully!';
END $$;
```

**Verify admin creation:**

```sql
SELECT
  u.user_id,
  u.role_id,
  r.role_name,
  a.role as admin_role,
  a.status
FROM user_profiles u
LEFT JOIN user_roles r ON u.role_id = r.id
LEFT JOIN admin_users a ON u.user_id = a.user_id
WHERE a.role = 'super_admin';
```

---

## Step 5: Set Up Environment Variables

Add these environment variables to your Vercel/deployment platform:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side only (DO NOT expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Gemini AI Configuration
GEMINI_API_KEY=ff2d76242389488a9db04a89eeedbf91.uuFP8YmmC5cLRk4Q
NEXT_PUBLIC_GEMINI_API_KEY=ff2d76242389488a9db04a89eeedbf91.uuFP8YmmC5cLRk4Q
```

**Where to find Supabase keys:**
1. Go to Supabase Dashboard
2. Click on your project
3. Go to Settings → API
4. Copy the keys as shown above

---

## Complete! 🎉

Your database is now configured and ready for use.
