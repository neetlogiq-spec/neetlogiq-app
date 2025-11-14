# 🗄️ Database Setup Guide

**NEETLogIQ Platform - Complete Supabase Database Setup**

**Status:** Ready for deployment
**Last Updated:** November 14, 2025

---

## 📋 Overview

This guide provides step-by-step instructions to set up the complete database schema for the NEETLogIQ platform on Supabase.

Due to network restrictions in automated environments, migrations must be applied manually through the Supabase Dashboard.

---

## 🎯 Prerequisites

- ✅ Supabase project created: `dbkpoiatlynvhrcnpvgw.supabase.co`
- ✅ Environment variables configured in `.env.local`
- ✅ All migration files ready in `supabase/migrations/`

---

## 🚀 Quick Setup (Option 1: Consolidated Migration)

### Use this method for fastest setup - applies all migrations at once.

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw
   - Navigate to: **SQL Editor** (left sidebar)

2. **Create New Query**
   - Click **"New Query"** button
   - Name it: "Initial Database Setup"

3. **Copy Migration SQL**
   - Open file: `supabase/migrations/consolidated_all_migrations.sql`
   - Copy entire contents (75,401 characters)
   - Paste into SQL Editor

4. **Execute Migration**
   - Click **"Run"** or press `Ctrl/Cmd + Enter`
   - Wait for completion (may take 30-60 seconds)
   - Check for success message: "Success. No rows returned"

5. **Verify Tables Created**
   - Navigate to: **Table Editor** (left sidebar)
   - You should see these tables:
     - `user_profiles`
     - `subscriptions`
     - `favorites`
     - `notifications`
     - `stream_config`
     - `user_usage_tracking`
     - `admin_role_changes`
     - `recommendation_requests`
     - `college_comparisons`

---

## 📝 Detailed Setup (Option 2: Individual Migrations)

### Use this method if you prefer step-by-step migration or if consolidated migration fails.

Run each migration file in order through the Supabase SQL Editor:

### Migration Order

1. **001_initial_schema.sql** (20,718 chars)
   - Creates core tables: `user_profiles`, `subscriptions`, `favorites`, `notifications`
   - Sets up Row Level Security (RLS) policies
   - Creates indexes for performance

2. **002_admin_audit_log.sql** (2,631 chars)
   - Creates `admin_role_changes` table
   - Tracks all role changes for audit trail

3. **20240615_create_counselling_documents.sql** (4,735 chars)
   - Creates `counselling_documents` table
   - Stores NEET counselling documents and forms

4. **20240620_create_subscriptions.sql** (7,070 chars)
   - Enhances subscription functionality
   - Adds Razorpay integration fields

5. **20250113_add_stream_lock.sql** (5,461 chars)
   - Prevents stream changes after selection
   - Data integrity protection

6. **20250114_add_user_roles.sql** (3,889 chars)
   - Adds RBAC (Role-Based Access Control)
   - Three roles: `user`, `admin`, `super_admin`

7. **20250114_create_stream_config.sql** (3,653 chars)
   - Creates `stream_config` table
   - Stores stream metadata (UG, PG, Diploma)

8. **20250114_add_usage_tracking.sql** (6,254 chars)
   - Creates `user_usage_tracking` table
   - Tracks recommendations and saved colleges

9. **20250114_add_usage_enforcement_triggers.sql** (6,745 chars)
   - Enforces usage limits for free tier
   - 3 daily recommendations for free users
   - 5 saved colleges for free users

10. **20250114_add_trial_period.sql** (5,864 chars)
    - Adds 7-day premium trial functionality
    - Auto-starts on first login
    - Auto-downgrades to free after expiry

11. **20250114_add_downgrade_rules.sql** (8,381 chars)
    - Handles subscription downgrades
    - Preserves data within new tier limits
    - Cleans up excess data

---

## 🔍 Verification Steps

### After running migrations, verify everything is set up correctly:

### 1. Check Tables

Navigate to **Table Editor** and verify these tables exist:

- ✅ `user_profiles` - User data and subscription info
- ✅ `subscriptions` - Payment and subscription tracking
- ✅ `favorites` - Saved colleges
- ✅ `notifications` - User notifications
- ✅ `stream_config` - Stream configuration (UG/PG/Diploma)
- ✅ `user_usage_tracking` - Usage metrics
- ✅ `admin_role_changes` - Role change audit log
- ✅ `recommendation_requests` - AI recommendation history
- ✅ `college_comparisons` - College comparison history
- ✅ `counselling_documents` - Document storage

### 2. Check Functions

Navigate to **Database** > **Functions** and verify:

- ✅ `start_user_trial()` - Starts 7-day trial
- ✅ `is_on_trial()` - Checks trial status
- ✅ `get_trial_status()` - Gets trial details
- ✅ `expire_trials()` - Expires old trials
- ✅ `check_usage_limit()` - Enforces usage limits
- ✅ `track_user_activity()` - Tracks user actions
- ✅ `reset_monthly_usage_counters()` - Resets counters

### 3. Check Triggers

Navigate to **Database** > **Triggers** and verify:

- ✅ `enforce_saved_colleges_limit` - Limits saved colleges for free tier
- ✅ `enforce_daily_recommendations_limit` - Limits recommendations
- ✅ `trigger_start_trial_on_profile_insert` - Auto-starts trial

### 4. Check RLS Policies

Navigate to **Authentication** > **Policies** and verify RLS is enabled on all tables.

---

## 👤 Create Super Admin User

### After migrations, create the first super admin:

1. **Register a User**
   - Go to your app: http://localhost:3500 (or deployed URL)
   - Sign up with your admin email
   - Complete registration

2. **Get User ID**
   - Navigate to Supabase: **Authentication** > **Users**
   - Find your user
   - Copy the **UUID** (e.g., `123e4567-e89b-12d3-a456-426614174000`)

3. **Promote to Super Admin**
   - Go to: **SQL Editor**
   - Run this query (replace `YOUR_USER_ID`):

   ```sql
   -- Make user a super admin
   UPDATE user_profiles
   SET role = 'super_admin'
   WHERE id = 'YOUR_USER_ID';

   -- Verify
   SELECT id, email, role, created_at
   FROM user_profiles
   WHERE id = 'YOUR_USER_ID';
   ```

4. **Verify Admin Access**
   - Log out and log back in
   - Navigate to: `/admin` route
   - You should see the admin panel

---

## 🧪 Test Database Functions

### Test critical functions manually:

### Test Trial System

```sql
-- Check trial status for a user (replace USER_ID)
SELECT is_on_trial('USER_ID');

-- Get trial details
SELECT get_trial_status('USER_ID');

-- Manually start trial (if needed)
SELECT start_user_trial('USER_ID');
```

### Test Usage Tracking

```sql
-- Check usage for a user
SELECT * FROM user_usage_tracking
WHERE user_id = 'USER_ID';

-- Track an activity
SELECT track_user_activity('USER_ID', 'recommendation');

-- Check if user can perform action
SELECT check_usage_limit('USER_ID', 'recommendations');
```

### Test Stream Configuration

```sql
-- Check configured streams
SELECT * FROM stream_config
ORDER BY stream_id;

-- Should return: UG, PG, Diploma
```

---

## 🎯 Insert Stream Configuration Data

### The stream_config table needs initial data:

Run this in **SQL Editor**:

```sql
-- Insert stream configurations
INSERT INTO stream_config (stream_id, stream_name, description, enabled)
VALUES
  ('UG', 'Undergraduate (UG)', 'Undergraduate medical courses including MBBS', true),
  ('PG', 'Postgraduate (PG)', 'Postgraduate medical courses including MD/MS', true),
  ('DIPLOMA', 'Diploma', 'Diploma medical courses', true)
ON CONFLICT (stream_id) DO UPDATE
SET
  stream_name = EXCLUDED.stream_name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled;

-- Verify
SELECT * FROM stream_config;
```

---

## ⚙️ Environment Variables

### Ensure these are set in `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://dbkpoiatlynvhrcnpvgw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Gemini AI
NEXT_PUBLIC_GEMINI_API_KEY=ff2d76242389488a9db04a89eeedbf91.uuFP8YmmC5cLRk4Q

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=<your_razorpay_key>
RAZORPAY_KEY_SECRET=<your_razorpay_secret>

# Firebase (Optional - for analytics)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBoTOrLIfgMkfr3lMQQJd3f_ZWqfi-bFjk
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=neetlogiq-15499.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=neetlogiq-15499
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=neetlogiq-15499.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=100369453309
NEXT_PUBLIC_FIREBASE_APP_ID=1:100369453309:web:205c0f116b5d899580ee94
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-V4V48LV46K
```

---

## 🚦 Post-Setup Checklist

After completing database setup:

- [ ] All 10 tables created
- [ ] All 7 database functions created
- [ ] All 3 triggers active
- [ ] RLS policies enabled
- [ ] Stream config data inserted (UG, PG, Diploma)
- [ ] Super admin user created
- [ ] Admin panel accessible at `/admin`
- [ ] Trial system tested
- [ ] Usage tracking tested
- [ ] Environment variables configured

---

## 🐛 Troubleshooting

### Tables Not Created

**Problem:** Some tables are missing after running migrations

**Solution:**
1. Check SQL Editor for error messages
2. Run migrations one by one to identify failing migration
3. Check for syntax errors in migration files
4. Verify you have sufficient Supabase permissions

### Functions Not Working

**Problem:** Database functions return errors

**Solution:**
1. Navigate to **Database** > **Functions**
2. Check if functions are created
3. Test functions manually in SQL Editor
4. Check function permissions

### RLS Blocking Queries

**Problem:** Queries fail with "permission denied" errors

**Solution:**
1. Use service role key for backend operations
2. Check RLS policies in **Authentication** > **Policies**
3. Ensure user authentication is working
4. Verify user IDs match policy conditions

### Trial Not Starting

**Problem:** Trial doesn't start automatically for new users

**Solution:**
1. Check if trigger exists: `trigger_start_trial_on_profile_insert`
2. Manually start trial: `SELECT start_user_trial('USER_ID');`
3. Verify `user_profiles` table has trial columns

### Usage Limits Not Enforced

**Problem:** Free users can exceed usage limits

**Solution:**
1. Check if triggers exist in **Database** > **Triggers**
2. Verify `user_usage_tracking` table exists
3. Test manually: `SELECT check_usage_limit('USER_ID', 'recommendations');`

---

## 📊 Database Schema Summary

### Core Tables

| Table | Purpose | Records (Estimated) |
|-------|---------|---------------------|
| `user_profiles` | User data, roles, subscription | 1,000+ |
| `subscriptions` | Payment tracking | 500+ |
| `favorites` | Saved colleges | 5,000+ |
| `notifications` | User notifications | 10,000+ |
| `stream_config` | Stream metadata | 3 |
| `user_usage_tracking` | Usage metrics | 1,000+ |
| `admin_role_changes` | Audit log | 100+ |
| `recommendation_requests` | AI history | 5,000+ |
| `college_comparisons` | Comparison history | 2,000+ |
| `counselling_documents` | Documents | 50+ |

### Key Features

- **Authentication:** Supabase Auth with email/password
- **Authorization:** RBAC with 3 roles (user, admin, super_admin)
- **Subscription Tiers:** Free, Basic, Premium, Pro
- **Trial System:** 7-day auto-start premium trial
- **Usage Limits:** 3 daily recommendations, 5 saved colleges (free)
- **Payment Integration:** Razorpay
- **AI Integration:** Gemini API for chatbot and recommendations
- **Audit Trail:** All role changes logged

---

## 🎉 Success!

Once all steps are complete, your database is ready for production!

### Next Steps:

1. **Test Locally:**
   ```bash
   npm install
   npm run dev
   ```
   Visit: http://localhost:3500

2. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "feat: Complete database setup"
   git push origin main
   ```
   - Connect GitHub repo to Vercel
   - Set environment variables
   - Deploy

3. **Monitor:**
   - Check Supabase Dashboard for usage
   - Monitor API logs
   - Track user signups and trials

---

**Need Help?**
- Supabase Docs: https://supabase.com/docs
- Project Dashboard: https://supabase.com/dashboard/project/dbkpoiatlynvhrcnpvgw

**Database Status:** ✅ **READY FOR PRODUCTION**
