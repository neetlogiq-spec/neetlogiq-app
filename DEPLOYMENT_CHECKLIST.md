# Production Deployment Checklist

Complete checklist for deploying the NEET Counseling Platform to production.

---

## Phase 1: Build Fixes (✅ COMPLETED)

- [x] Fix toast.ts JSX syntax error (renamed to toast.tsx)
- [x] Add missing supabaseDataService export
- [x] Fix WASM module import with browser check
- [x] Fix environment variable handling in supabase.ts
- [x] Fix SQL migration syntax error (consolidated_all_migrations.sql)
- [x] Commit and push all build fixes

**Status:** All Vercel build errors have been resolved. ✅

---

## Phase 2: Database Setup

### 2.1: Apply Database Migrations

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy contents of `supabase/migrations/consolidated_all_migrations.sql`
- [ ] Paste into SQL Editor and execute
- [ ] Verify: "Success. No rows returned"
- [ ] Check that all 25+ tables were created:
  ```sql
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  ```

### 2.2: Insert Configuration Data

- [ ] Run `supabase/initial_data_setup.sql` in SQL Editor
- [ ] Verify 3 streams were created:
  ```sql
  SELECT * FROM stream_configurations ORDER BY priority;
  ```
- [ ] Verify 4 user roles were created:
  ```sql
  SELECT * FROM user_roles ORDER BY role_name;
  ```

### 2.3: Create Super Admin User

- [ ] Go to Authentication → Users in Supabase Dashboard
- [ ] Click "Add user"
- [ ] Enter admin email (e.g., admin@yourdomain.com)
- [ ] Set strong password
- [ ] Enable "Auto Confirm User"
- [ ] Click "Create user"
- [ ] Copy the User UUID
- [ ] Open `supabase/promote_to_super_admin.sql`
- [ ] Replace `'USER_UUID_HERE'` with actual UUID
- [ ] Run the script in SQL Editor
- [ ] Verify admin was created:
  ```sql
  SELECT * FROM admin_users WHERE role = 'super_admin';
  ```

**Database Documentation:** See `DATABASE_SETUP_GUIDE.md` for detailed instructions.

---

## Phase 3: Environment Variables

### 3.1: Supabase Keys

- [ ] Go to Supabase Dashboard → Settings → API
- [ ] Copy Project URL
- [ ] Copy anon/public key
- [ ] Copy service_role key (keep this secret!)

### 3.2: Set Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Gemini AI
GEMINI_API_KEY=ff2d76242389488a9db04a89eeedbf91.uuFP8YmmC5cLRk4Q
NEXT_PUBLIC_GEMINI_API_KEY=ff2d76242389488a9db04a89eeedbf91.uuFP8YmmC5cLRk4Q

# Firebase (if using)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Razorpay (for payments)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

- [ ] All environment variables added to Vercel
- [ ] Trigger new deployment to apply env vars

---

## Phase 4: Verify Deployment

### 4.1: Build Verification

- [ ] Go to Vercel Dashboard → Deployments
- [ ] Check latest deployment status
- [ ] Verify build completed successfully (no errors)
- [ ] Check build logs for warnings

### 4.2: Application Testing

Test these critical features in production:

- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] User login works
- [ ] Search bar returns results
  - Test: Search for "AIIMS"
  - Test: Search for "Delhi" (fuzzy search)
  - Test: Search with typo "delli"
- [ ] Filters work correctly
  - Test: Multi-select states
  - Test: Fees range filter
  - Test: Management type filter
  - Test: Sort options (8 variations)
- [ ] College details page loads
- [ ] Recommendations work
- [ ] Admin panel accessible (with super admin account)
- [ ] Chatbot responds (Gemini AI)
- [ ] Payment flow works (Razorpay)

### 4.3: Database Connectivity

- [ ] Create test API route: `/api/test-db`
- [ ] Verify database queries work:
  ```typescript
  // Test colleges query
  const { data } = await supabase.from('colleges').select('*').limit(5);
  
  // Test fuzzy search
  const { data: results } = await supabase.rpc('fuzzy_search_colleges', {
    search_term: 'aiims'
  });
  
  // Test stream config
  const { data: streams } = await supabase.from('stream_configurations').select('*');
  ```
- [ ] All test queries return data

### 4.4: Performance Check

- [ ] Run Lighthouse audit
  - Target: Performance > 80
  - Target: Accessibility > 90
  - Target: Best Practices > 90
- [ ] Check Core Web Vitals
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
- [ ] Test on mobile devices
- [ ] Test on slow 3G connection

---

## Phase 5: Search & Filter Features

### 5.1: Search Bar Features

- [ ] Full-database search (searches all 2,117+ colleges)
- [ ] Autocomplete suggestions appear (5 suggestions)
- [ ] Search history works (last 10 searches)
- [ ] Fuzzy search handles typos
  - Test: "delli" finds "Delhi"
  - Test: "mumbai" finds "Mumbai"
  - Test: "aiims" finds all AIIMS colleges
- [ ] Search debounce working (150ms autocomplete, 400ms search)
- [ ] Results show correct colleges with details

### 5.2: Filter Features

- [ ] Multi-select State filter (checkbox-based)
- [ ] Multi-select Management Type filter
- [ ] Multi-select Course filter
- [ ] Fees range filter (min/max inputs)
- [ ] NIRF rank range filter
- [ ] 8 sort options work:
  1. Relevance (default)
  2. NIRF Rank (Best First)
  3. NIRF Rank (Worst First)
  4. Fees (Low to High)
  5. Fees (High to Low)
  6. Name (A-Z)
  7. Name (Z-A)
  8. Total Seats (High to Low)
- [ ] Filters combine correctly (AND/OR logic)
- [ ] Clear filters button works
- [ ] Filter state persists on page refresh

### 5.3: Search API Endpoints

- [ ] `/api/colleges/search` returns results
- [ ] `/api/colleges/autocomplete` provides suggestions
- [ ] API handles pagination correctly
- [ ] API returns proper error messages
- [ ] API performance < 500ms average

**Search Documentation:** See `SEARCH_ENHANCEMENT_IMPLEMENTATION.md` for details.

---

## Phase 6: Security & Performance

### 6.1: Row Level Security (RLS)

- [ ] RLS enabled on user_profiles
- [ ] RLS enabled on subscriptions
- [ ] RLS enabled on recommendations
- [ ] Public read access on colleges
- [ ] Public read access on courses
- [ ] Public read access on cutoffs
- [ ] Test: Users can only see their own data
- [ ] Test: Public can view college data

### 6.2: API Security

- [ ] Rate limiting configured
- [ ] CORS configured correctly
- [ ] API keys stored securely (not exposed to client)
- [ ] Service role key used only in API routes

### 6.3: Performance Optimization

- [ ] PostgreSQL indexes created (30+ indexes)
- [ ] GIN indexes for fuzzy search
- [ ] Database query performance < 100ms average
- [ ] Caching strategy implemented
  - IndexedDB for client-side caching
  - 1-hour TTL for college data
- [ ] WebAssembly processing working
- [ ] Image optimization enabled

---

## Phase 7: Monitoring & Analytics

### 7.1: Error Tracking

- [ ] Error logging configured
- [ ] Supabase logs monitored
- [ ] Vercel logs monitored
- [ ] Error alerts set up

### 7.2: Analytics

- [ ] User activity tracking works
- [ ] Search analytics captured
- [ ] Filter usage tracked
- [ ] Recommendation views logged

### 7.3: Database Monitoring

- [ ] Query performance monitored
- [ ] Slow query alerts configured
- [ ] Database size monitored
- [ ] Connection pool monitored

---

## Phase 8: Data Import

### 8.1: College Data

- [ ] Import college data CSV/JSON
- [ ] Verify all colleges imported
- [ ] Check data integrity
- [ ] Update search vectors

### 8.2: Course Data

- [ ] Import course data
- [ ] Link courses to colleges
- [ ] Verify course variants

### 8.3: Cutoff Data

- [ ] Import historical cutoff data (2020-2024)
- [ ] Import all rounds (1-4)
- [ ] Verify cutoff accuracy
- [ ] Test cutoff queries

---

## Phase 9: Final Pre-Launch

### 9.1: Documentation

- [ ] API documentation complete
- [ ] User guide created
- [ ] Admin guide created
- [ ] Troubleshooting guide available

### 9.2: Backup & Recovery

- [ ] Database backup configured (automatic)
- [ ] Recovery procedure documented
- [ ] Test backup restoration

### 9.3: Legal & Compliance

- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie consent implemented
- [ ] GDPR compliance checked (if applicable)

---

## Phase 10: Launch

### 10.1: Pre-Launch Check

- [ ] All checklist items above completed
- [ ] No critical bugs remaining
- [ ] Performance meets targets
- [ ] All features tested

### 10.2: Launch Day

- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Monitor user registrations
- [ ] Be ready for support requests

### 10.3: Post-Launch

- [ ] Gather user feedback
- [ ] Monitor analytics
- [ ] Fix urgent bugs
- [ ] Plan feature updates

---

## Quick Reference

### Essential Commands

```bash
# Deploy to Vercel
git push origin claude/review-frontend-files-011CUv6FgtVC5g7xRu3F2MkK

# Check Vercel deployment status
vercel logs

# Run database migrations locally (if needed)
supabase db push

# Test database connection
curl https://your-domain.com/api/test-db
```

### Essential SQL Queries

```sql
-- Verify table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check stream configs
SELECT * FROM stream_configurations;

-- Check admin users
SELECT * FROM admin_users WHERE role = 'super_admin';

-- Test fuzzy search
SELECT * FROM fuzzy_search_colleges('aiims', 0.3, 10);
```

### Essential Files

- `DATABASE_SETUP_GUIDE.md` - Complete database setup instructions
- `SEARCH_ENHANCEMENT_IMPLEMENTATION.md` - Search feature documentation
- `supabase/migrations/consolidated_all_migrations.sql` - All migrations
- `supabase/initial_data_setup.sql` - Stream and role configuration
- `supabase/promote_to_super_admin.sql` - Create admin users

---

## Status Summary

### ✅ Completed
- Build fixes (all 5 errors resolved)
- Search and filter enhancements (Priority 1 + 2)
- Database schema designed
- Migration files created
- Documentation written

### 🔄 In Progress
- Database deployment
- Environment variable configuration
- Production testing

### ⏳ Pending
- Data import
- Performance optimization
- Launch preparation

---

## Support

If you encounter issues:

1. **Build Errors**: Check Vercel deployment logs
2. **Database Errors**: Check Supabase logs in Dashboard
3. **Search Issues**: Verify fuzzy search migration applied
4. **Filter Issues**: Check API endpoints are working
5. **Auth Issues**: Verify environment variables are set

---

**Last Updated:** 2025-11-14

**Platform Status:** Ready for database setup and deployment testing 🚀
