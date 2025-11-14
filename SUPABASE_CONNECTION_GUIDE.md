# Supabase Connection Guide

## 🎉 Database Connection Setup Complete!

Your Supabase database connection has been configured and is ready to test. This guide explains what has been set up and how to verify your database connection.

## What Was Configured

### 1. Environment Variables (`.env.local`)

Your Supabase connection credentials are already configured:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dbkpoiatlynvhrcnpvgw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **Status**: Configured

### 2. Supabase Client (`src/lib/supabase.ts`)

The Supabase client is configured with:
- **Client-side client**: Uses anon key, respects RLS policies
- **Server-side client (Admin)**: Uses service role key, bypasses RLS
- **Helper functions**: User management, subscriptions, notifications, activity logging
- **Real-time subscriptions**: Live seat updates, notifications

✅ **Status**: Ready to use

### 3. Database Test API (`/api/test-db-connection`)

A comprehensive API route that tests:
- ✅ Basic database connection
- ✅ Schema verification (50+ tables)
- ✅ Foundation data population
- ✅ Views existence
- ✅ Critical tables readiness

**Endpoint**: `GET http://localhost:3500/api/test-db-connection`

### 4. Admin Test Page (`/admin/db-test`)

A beautiful admin page that visualizes:
- Connection status
- Schema completeness (expected vs existing tables)
- Foundation data status (states, categories, quotas, courses, etc.)
- Views status
- Critical tables status (colleges, courses, cutoffs, user_profiles)
- Summary with actionable next steps

**URL**: `http://localhost:3500/admin/db-test`

## How to Test the Connection

### Option 1: Visual Admin Page (Recommended)

1. Make sure your dev server is running:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3500/admin/db-test
   ```

3. The page will automatically test the connection and display:
   - ✅ **Green**: Everything is working
   - ⚠️ **Yellow**: Partial success, needs attention
   - ❌ **Red**: Issues detected, action required

### Option 2: API Endpoint (For Developers)

Test the connection via command line:

```bash
# Basic test
curl http://localhost:3500/api/test-db-connection

# Pretty formatted JSON
curl http://localhost:3500/api/test-db-connection | python3 -m json.tool
```

### Option 3: Direct Supabase Client (In Your Code)

```typescript
import { supabase, supabaseAdmin } from '@/lib/supabase';

// Client-side example (respects RLS)
async function testConnection() {
  const { data, error } = await supabase
    .from('states')
    .select('*')
    .limit(10);

  if (error) {
    console.error('Connection failed:', error);
  } else {
    console.log('Connected! States:', data);
  }
}

// Server-side example (admin access)
async function testAdminConnection() {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .select('count');

  if (error) {
    console.error('Admin connection failed:', error);
  } else {
    console.log('Admin connected! College count:', data);
  }
}
```

## Expected Schema (Complete Hybrid Schema)

Your database should have **50+ tables** from the complete hybrid schema:

### Foundation Tables (6)
- `states` (36 Indian states & UTs)
- `categories` (11 NEET categories)
- `quotas` (12 quota types)
- `master_courses` (40 medical courses)
- `sources` (counselling sources)
- `levels` (UG, PG, Diploma, DNB)

### College Tables (4)
- `medical_colleges` (TEXT IDs: MED0001, MED0002...)
- `dental_colleges` (TEXT IDs: DEN0001, DEN0002...)
- `dnb_colleges` (TEXT IDs: DNB0001, DNB0002...)
- `colleges` (UUID IDs for app)

### Critical Tables (2)
- `courses` (UUID IDs for app)
- `cutoffs` ⚠️ **CRITICAL for recommendations!**

### Alias Tables (5)
- `college_aliases`, `course_aliases`, `state_aliases`, `category_aliases`, `quota_aliases`

### Link Tables (3)
- `state_college_link`, `state_course_college_link`, `state_mappings`

### Data Tables (4)
- `seat_data`, `counselling_records`, `counselling_rounds`, `partition_metadata`

### User Management (4)
- `user_profiles`, `user_roles`, `admin_users`, `admin_audit_log`

### Subscriptions & Payments (4)
- `subscriptions`, `payment_transactions`, `premium_features`, `user_feature_usage`

### User Interactions (7)
- `favorites`, `college_notes`, `watchlist`, `recommendations`, `user_activity`, `search_history`, `user_preferences`

### Real-Time Features (3)
- `live_seat_updates`, `notifications`, `alert_subscriptions`

### Counselling Features (3)
- `counselling_documents`, `counselling_packages`, `counselling_bookings`

### Stream Management (4)
- `stream_configurations`, `user_streams`, `stream_locks`, `stream_change_requests`

### Analytics (3)
- `user_usage_tracking`, `recommendation_requests`, `college_comparisons`

## Configuration Changes

### `next.config.mjs` Update

Updated to allow API routes in development mode:

```javascript
// Before
output: 'export',  // Static export (no API routes)

// After
output: isDev ? undefined : 'export',  // API routes enabled in dev
```

This allows you to test database connections locally while still supporting static export for production deployment to Cloudflare Pages.

## Troubleshooting

### ❌ Connection Failed

If you see "Connection failed: TypeError: fetch failed":

1. **Check Supabase credentials** in `.env.local`
2. **Verify Supabase project is active** in Supabase Dashboard
3. **Check network connectivity** to supabase.co
4. **Verify API keys are correct** (not expired or rotated)

### ❌ Missing Tables

If tables are missing:

1. **Apply the complete hybrid schema** in Supabase SQL Editor:
   ```sql
   -- File: supabase/migrations/20250114_complete_hybrid_schema.sql
   ```

2. **Run foundation data population**:
   ```sql
   -- File: supabase/foundation_data_population.sql
   ```

3. **Verify in Supabase Dashboard** > Table Editor

### ❌ Empty Foundation Data

If tables exist but have no data:

1. Run `foundation_data_population.sql` in Supabase SQL Editor
2. Verify with:
   ```sql
   SELECT 'states' as table_name, COUNT(*) FROM states
   UNION ALL
   SELECT 'categories', COUNT(*) FROM categories
   UNION ALL
   SELECT 'master_courses', COUNT(*) FROM master_courses;
   ```

### ⚠️ Views Missing

If views don't exist:

1. Check the complete hybrid schema includes view definitions
2. Re-run the migration
3. Verify with:
   ```sql
   SELECT * FROM colleges_unified LIMIT 1;
   SELECT * FROM v_counselling_details LIMIT 1;
   ```

## Next Steps After Connection

Once your connection is verified:

1. ✅ **Import College Data**
   - Import from SQLite databases (medical, dental, DNB colleges)
   - Import seat data
   - Import counselling records

2. ✅ **Populate Cutoffs**
   - Critical for recommendation engine
   - Import historical cutoff data

3. ✅ **Create Super Admin User**
   ```sql
   -- File: supabase/promote_to_super_admin.sql
   ```

4. ✅ **Test Application Features**
   - College search and filters
   - Recommendation engine
   - User authentication (Firebase + Supabase profiles)
   - Subscription management (Razorpay integration)

5. ✅ **Deploy to Production**
   - Configure Vercel environment variables
   - Deploy to Vercel
   - Test production connection

## Helper Functions Available

The `src/lib/supabase.ts` file provides these helper functions:

```typescript
// User Management
getCurrentUser()
getUserSubscription(userId)
hasPremiumAccess(userId)

// Recommendations
canGetRecommendations(userId)
incrementRecommendationCount(userId)

// Notifications
createNotification(userId, type, title, message, link?, priority?)

// Activity Tracking
logActivity(userId, action, resourceType?, resourceId?, metadata?)

// Real-Time Subscriptions
subscribeLiveSeatUpdates(collegeId, callback)
subscribeNotifications(userId, callback)
```

## Testing Checklist

Use this checklist to verify everything is working:

- [ ] Development server is running (`npm run dev`)
- [ ] Visit `/admin/db-test` page
- [ ] Connection shows ✅ Success
- [ ] All 50+ tables exist
- [ ] Foundation data populated (states, categories, quotas, courses)
- [ ] Views exist (colleges_unified, v_counselling_details)
- [ ] Critical tables ready (colleges, courses, cutoffs, user_profiles)
- [ ] Can query data using Supabase client
- [ ] Real-time subscriptions work
- [ ] Helper functions accessible

## Support

If you encounter issues:

1. Check Supabase Dashboard > Project Settings > API
2. Verify RLS policies are configured correctly
3. Check logs in Supabase Dashboard > Logs
4. Test connection directly in Supabase SQL Editor

## Summary

✅ **Environment**: Configured
✅ **Client**: Ready
✅ **API Route**: Created (`/api/test-db-connection`)
✅ **Admin Page**: Created (`/admin/db-test`)
✅ **Dev Config**: Updated (API routes enabled)
🎯 **Next**: Test connection via admin page!

---

**Ready to test?** Start the dev server and visit:
```
http://localhost:3500/admin/db-test
```

Good luck! 🚀
