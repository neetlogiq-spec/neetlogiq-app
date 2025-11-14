# 🗃️ Database Migration Checklist

**Supabase Project:** dbkpoiatlynvhrcnpvgw.supabase.co

## Migration Files to Run (In Order)

Execute these in the Supabase SQL Editor:

- [ ] `001_initial_schema.sql` - Base schema with all tables
- [ ] `002_admin_audit_log.sql` - Admin audit logging
- [ ] `20240615_create_counselling_documents.sql` - Documents table
- [ ] `20240620_create_subscriptions.sql` - Subscriptions system
- [ ] `20250113_add_stream_lock.sql` - Stream locking feature
- [ ] `20250114_add_user_roles.sql` - RBAC system (user/admin/super_admin)
- [ ] `20250114_create_stream_config.sql` - Dynamic stream configuration
- [ ] `20250114_add_usage_tracking.sql` - Monthly usage analytics
- [ ] `20250114_add_usage_enforcement_triggers.sql` - Usage limit enforcement
- [ ] `20250114_add_trial_period.sql` - 7-day trial system
- [ ] `20250114_add_downgrade_rules.sql` - Subscription downgrade logic

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw/sql/new
2. For each migration file (in order):
   ```bash
   cat supabase/migrations/001_initial_schema.sql
   ```
3. Copy the SQL and paste into Supabase SQL Editor
4. Click "Run"
5. Verify success (no errors)
6. Repeat for next migration

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref dbkpoiatlynvhrcnpvgw

# Push all migrations
supabase db push
```

## Verify Setup

After running all migrations, execute this SQL to verify:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should show at least 27 tables including:
-- user_profiles, subscriptions, stream_config,
-- user_usage_tracking, recommendation_requests, etc.
```

## Create First Super Admin

After migrations, make yourself a super admin:

```sql
-- Get your user ID from auth.users
SELECT id, email FROM auth.users;

-- Set your role to super_admin (replace YOUR-USER-ID)
UPDATE user_profiles
SET role = 'super_admin'
WHERE user_id = 'YOUR-USER-ID';

-- Verify
SELECT user_id, role FROM user_profiles WHERE role = 'super_admin';
```

## Test Database Functions

```sql
-- Test trial system
SELECT get_trial_status('YOUR-USER-ID');

-- Test usage checking
SELECT check_usage_limit('YOUR-USER-ID', 'saved_colleges');

-- Test stream configuration
SELECT * FROM stream_config;
```
