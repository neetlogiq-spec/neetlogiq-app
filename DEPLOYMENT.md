# 🚀 NEETLogIQ - Deployment Guide

Complete guide for deploying NEETLogIQ platform to Vercel with Supabase.

**Last Updated:** January 14, 2025
**Platform Version:** v1.0.0
**Deployment Readiness:** 85/100

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup (Supabase)](#database-setup)
3. [Firebase Setup](#firebase-setup)
4. [Razorpay Setup](#razorpay-setup)
5. [Environment Variables](#environment-variables)
6. [Vercel Deployment](#vercel-deployment)
7. [Post-Deployment Tasks](#post-deployment-tasks)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Required Accounts
- [ ] **Vercel Account** - https://vercel.com/signup
- [ ] **Supabase Account** - https://supabase.com/dashboard
- [ ] **Firebase Account** - https://console.firebase.google.com/
- [ ] **Razorpay Account** - https://dashboard.razorpay.com/signup

### Optional Accounts
- [ ] SendGrid (for emails) - https://sendgrid.com/
- [ ] Twilio (for SMS) - https://www.twilio.com/
- [ ] Sentry (error tracking) - https://sentry.io/

### Local Setup
```bash
# Clone the repository
git clone https://github.com/your-username/neetlogiq.git
cd neetlogiq

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Fill in .env.local with your values
```

---

## 💾 Database Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name:** neetlogiq-production
   - **Database Password:** (generate secure password)
   - **Region:** Choose closest to your users
4. Wait for project to be ready (~2 minutes)

### Step 2: Get Database Credentials

1. Go to **Project Settings** > **API**
2. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (reveal) → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Run Database Migrations

**Option A: Via Supabase Dashboard** (Recommended)

1. Go to **SQL Editor**
2. Run migrations in order:

```sql
-- 1. Stream Lock (from file: 20250113_add_stream_lock.sql)
-- Copy and paste the entire file content

-- 2. User Roles (from file: 20250114_add_user_roles.sql)
-- Copy and paste the entire file content

-- 3. Stream Config (from file: 20250114_create_stream_config.sql)
-- Copy and paste the entire file content

-- 4. Usage Tracking (from file: 20250114_add_usage_tracking.sql)
-- Copy and paste the entire file content

-- 5. Usage Enforcement (from file: 20250114_add_usage_enforcement_triggers.sql)
-- Copy and paste the entire file content

-- 6. Trial Period (from file: 20250114_add_trial_period.sql)
-- Copy and paste the entire file content

-- 7. Downgrade Rules (from file: 20250114_add_downgrade_rules.sql)
-- Copy and paste the entire file content
```

**Option B: Via Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Step 4: Assign Super Admin Role

Run this SQL to make yourself a super admin:

```sql
-- Replace 'your-user-id' with your actual user ID from auth.users
UPDATE user_profiles
SET role = 'super_admin'
WHERE user_id = 'your-user-id';

-- Verify
SELECT user_id, role FROM user_profiles WHERE role = 'super_admin';
```

### Step 5: Verify Database Setup

```sql
-- Check all tables are created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should show at least 27 tables including:
-- - user_profiles
-- - subscriptions
-- - stream_config
-- - user_usage_tracking
-- - admin_role_changes
-- - recommendation_requests
-- - college_comparisons
```

---

## 🔥 Firebase Setup

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Enter project name: **neetlogiq**
4. Disable Google Analytics (optional)
5. Click "Create Project"

### Step 2: Enable Authentication

1. Go to **Authentication** > **Sign-in method**
2. Enable:
   - ✅ Email/Password
   - ✅ Google (optional)
3. Configure authorized domains:
   - Add your Vercel domain: `your-app.vercel.app`
   - Add custom domain if you have one

### Step 3: Get Firebase Config

1. Go to **Project Settings** > **General**
2. Scroll to "Your apps" section
3. Click **Web** icon (</>) to add web app
4. Register app name: **NEETLogIQ Web**
5. Copy the configuration values:

```javascript
// Copy these values to your .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=neetlogiq.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=neetlogiq
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=neetlogiq.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123
```

---

## 💳 Razorpay Setup

### Step 1: Create Razorpay Account

1. Go to https://dashboard.razorpay.com/signup
2. Complete KYC verification
3. Wait for account activation

### Step 2: Get API Keys

**For Testing:**
1. Go to **Settings** > **API Keys**
2. **Generate Test Key**
3. Copy:
   - Test Key ID → `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - Test Key Secret → `RAZORPAY_KEY_SECRET`

**For Production:**
1. Switch to **Live Mode** (top-right toggle)
2. **Generate Live Key**
3. Copy production keys (use same env var names)

### Step 3: Create Subscription Plans

1. Go to **Subscriptions** > **Plans**
2. Create the following plans:

**Plan 1: Monthly Premium**
- Plan Name: `Premium Monthly`
- Plan ID: `plan_premium_monthly`
- Billing Cycle: Monthly
- Amount: ₹149

**Plan 2: Quarterly Premium**
- Plan Name: `Premium Quarterly`
- Plan ID: `plan_premium_quarterly`
- Billing Cycle: Every 3 months
- Amount: ₹399

**Plan 3: Half-Yearly Premium**
- Plan Name: `Premium Half-Yearly`
- Plan ID: `plan_premium_halfyearly`
- Billing Cycle: Every 6 months
- Amount: ₹699

**Plan 4: Annual Premium**
- Plan Name: `Premium Annual`
- Plan ID: `plan_premium_yearly`
- Billing Cycle: Yearly
- Amount: ₹999

### Step 4: Setup Webhook (After Deployment)

1. Go to **Settings** > **Webhooks**
2. Add webhook URL: `https://your-app.vercel.app/api/payments/webhook`
3. Select events:
   - ✅ payment.authorized
   - ✅ payment.captured
   - ✅ payment.failed
   - ✅ subscription.activated
   - ✅ subscription.charged
   - ✅ subscription.cancelled
   - ✅ subscription.completed
4. Copy **Webhook Secret** → `RAZORPAY_WEBHOOK_SECRET`

---

## 🔐 Environment Variables

### Create .env.local for Local Development

```bash
# Copy example file
cp .env.example .env.local

# Edit with your values
nano .env.local
```

### Required Variables

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Payment
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxx
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=neetlogiq.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=neetlogiq
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=neetlogiq.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123

# Cron Jobs
CRON_SECRET=$(openssl rand -base64 32)

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3500
```

---

## 🚀 Vercel Deployment

### Step 1: Connect Repository

1. Go to https://vercel.com/new
2. **Import Git Repository**
3. Select your GitHub/GitLab repository
4. Click **Import**

### Step 2: Configure Project

**Framework Preset:** Next.js (auto-detected)

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `.next` (auto-detected)
- Install Command: `npm install`

**Root Directory:** `./` (leave as is)

### Step 3: Add Environment Variables

In Vercel dashboard:
1. Go to **Settings** > **Environment Variables**
2. Add all variables from `.env.local`
3. **Important:** Set environment for each:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

**Quick Add:**
```bash
# You can bulk import from Vercel CLI
vercel env pull .env.vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# ... repeat for all variables
```

### Step 4: Deploy

1. Click **Deploy**
2. Wait for build to complete (~3-5 minutes)
3. Your app will be live at: `https://your-app.vercel.app`

### Step 5: Add Custom Domain (Optional)

1. Go to **Settings** > **Domains**
2. Add your domain: `neetlogiq.com`
3. Configure DNS:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com

   Type: A
   Name: @
   Value: 76.76.21.21
   ```
4. Wait for DNS propagation (~24 hours)

---

## ✅ Post-Deployment Tasks

### 1. Verify Cron Jobs

Check if cron jobs are scheduled:
1. Go to Vercel Dashboard > **Deployments** > **Cron Jobs**
2. You should see 3 cron jobs:
   - `/api/cron/reset-usage` - Monthly (1st at 00:00 UTC)
   - `/api/cron/expire-trials` - Daily (00:00 UTC)
   - `/api/cron/process-downgrades` - Daily (02:00 UTC)

**Test cron jobs manually:**
```bash
curl -X POST https://your-app.vercel.app/api/cron/reset-usage \
  -H "Authorization: Bearer your_cron_secret"
```

### 2. Setup Firebase Authorized Domains

1. Go to Firebase Console > **Authentication** > **Settings**
2. Add authorized domains:
   - `your-app.vercel.app`
   - `your-custom-domain.com` (if using)

### 3. Configure Razorpay Webhook

1. Update webhook URL in Razorpay dashboard
2. Change from test webhook to production webhook URL
3. Test webhook:
   ```bash
   # Create a test payment in Razorpay dashboard
   # Check Vercel logs for webhook events
   ```

### 4. Test Critical Flows

- [ ] User signup and authentication
- [ ] Premium subscription purchase (test mode)
- [ ] Trial period activation
- [ ] Admin dashboard access
- [ ] College search and filtering
- [ ] Comparison feature
- [ ] Profile updates

### 5. Enable Production Mode

**Razorpay:**
1. Switch to Live Mode in dashboard
2. Update `NEXT_PUBLIC_RAZORPAY_KEY_ID` with live key
3. Update `RAZORPAY_KEY_SECRET` with live secret
4. Redeploy in Vercel

**Environment:**
```bash
NODE_ENV=production  # Should be automatically set by Vercel
```

---

## 📊 Monitoring & Maintenance

### Setup Error Tracking (Recommended)

**Option 1: Sentry**
```bash
npm install @sentry/nextjs

# Add to .env.local
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Initialize in your app
# Follow: https://docs.sentry.io/platforms/javascript/guides/nextjs/
```

**Option 2: LogRocket**
```bash
npm install logrocket

# Add to .env.local
LOGROCKET_APP_ID=your-app/project-name
```

### Monitor Cron Jobs

1. Go to Vercel > **Logs**
2. Filter by cron job path
3. Check for errors monthly
4. Verify counters are resetting

### Database Maintenance

**Monthly Tasks:**
```sql
-- Check usage statistics
SELECT month_year, COUNT(*) as users, AVG(recommendations_count)
FROM user_usage_tracking
GROUP BY month_year
ORDER BY month_year DESC;

-- Check subscription status
SELECT status, COUNT(*)
FROM subscriptions
GROUP BY status;

-- Check trial conversions
SELECT
  COUNT(*) FILTER (WHERE trial_used = true) as total_trials,
  COUNT(*) FILTER (WHERE subscription_tier = 'premium') as converted
FROM user_profiles;
```

### Performance Monitoring

- Monitor Vercel Analytics dashboard
- Check Core Web Vitals
- Review API response times
- Monitor database query performance in Supabase

---

## 🐛 Troubleshooting

### Build Fails on Vercel

**Error: "Module not found"**
```bash
# Solution: Clear build cache
vercel --force

# Or in Vercel dashboard:
# Settings > General > Clear Build Cache
```

**Error: "Type errors"**
```bash
# Solution: Check database types are synced
npm run build  # Run locally first
# Fix any TypeScript errors before deploying
```

### Cron Jobs Not Running

**Check logs:**
```bash
vercel logs --follow
```

**Verify CRON_SECRET:**
```bash
# In Vercel dashboard, check that CRON_SECRET matches
# what's used in cron job Authorization headers
```

### Razorpay Webhook Fails

**Check webhook signature:**
1. Enable logging in `/api/webhooks/razorpay`
2. Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
3. Check request body is parsed correctly

**Test locally:**
```bash
# Use Razorpay webhook tester
# Or use ngrok for local testing:
ngrok http 3500
# Update webhook URL in Razorpay to ngrok URL
```

### Database Connection Issues

**Error: "Could not connect to database"**
1. Check Supabase project is not paused
2. Verify environment variables are correct
3. Check RLS policies allow access
4. Try regenerating Supabase keys

### Authentication Issues

**Users can't sign in:**
1. Check Firebase authorized domains
2. Verify Firebase config env variables
3. Check browser console for errors
4. Test in incognito mode (clear cookies)

---

## 📚 Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Razorpay Integration Guide](https://razorpay.com/docs/)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)

---

## 🆘 Support

If you encounter issues:

1. Check [COMPREHENSIVE_STATUS_REPORT.md](./COMPREHENSIVE_STATUS_REPORT.md) for known issues
2. Search existing GitHub issues
3. Create a new issue with:
   - Environment details
   - Error logs
   - Steps to reproduce
   - Expected vs actual behavior

---

**Deployment Guide Version:** 1.0.0
**Last Updated:** January 14, 2025
**Platform Status:** Ready for Staging Deployment (85/100)
