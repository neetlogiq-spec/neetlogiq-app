# Database Setup Guide

## Complete Supabase Database Configuration

This guide provides step-by-step instructions for setting up the unified database schema that aligns with DATABASE_SCHEMAS.md.

---

## Prerequisites

1. **Supabase Project**: You must have a Supabase project created
2. **Access**: You need admin access to the Supabase Dashboard
3. **SQL Editor**: Access to the SQL Editor in your Supabase dashboard

---

## Architecture Overview

The database schema combines:
- **SQLite Structure** from DATABASE_SCHEMAS.md (foundation, colleges, counselling data)
- **PostgreSQL Features** (foreign keys, triggers, JSONB, UUID)
- **Application Features** (user management, subscriptions, recommendations)

See **SCHEMA_MIGRATION_GUIDE.md** for detailed mapping documentation.

---

## Step 1: Apply Unified Schema Migration

**Use the new unified schema (20250114_unified_schema.sql):**

```sql
-- File: supabase/migrations/20250114_unified_schema.sql
```

**How to apply:**
1. Go to **Supabase Dashboard → SQL Editor**
2. Create a new query
3. Copy the entire contents of `supabase/migrations/20250114_unified_schema.sql`
4. Paste into the SQL Editor
5. Click **Run** or press Ctrl+Enter
6. Verify: "Success. No rows returned"

**What this creates:**

**Foundation Tables (8):**
- `states` - 36 Indian states/UTs
- `categories` - Admission categories (General, OBC, SC, ST, EWS, PwD)
- `quotas` - 12 quota types (AIQ, State, Management, etc.)
- `courses` - Course types and specializations
- `sources` - Data sources (AIQ, KEA, STATE, MCC, DGHS, NBEMS)
- `levels` - Education levels (UG, PG, DEN, DNB, DIPLOMA)

**College Tables (3):**
- `medical_colleges` - Medical colleges with normalization and TF-IDF vectors
- `dental_colleges` - Dental colleges with normalization
- `dnb_colleges` - DNB institutions with normalization

**Alias Tables (5):**
- `college_aliases` - College name variations for matching
- `course_aliases` - Course name variations
- `state_aliases` - State name variations
- `category_aliases` - Category name variations
- `quota_aliases` - Quota name variations

**Link Tables (3):**
- `state_college_link` - State-college relationships
- `state_course_college_link` - State-course-college combinations
- `state_mappings` - Raw to normalized state mappings

**Data Tables (4):**
- `seat_data` - Seat matrix with college/course matching
- `counselling_records` - Historical counselling data
- `counselling_rounds` - Counselling round information
- `partition_metadata` - Partition statistics

**Application Tables (11):**
- `user_profiles` - User account data
- `user_roles` - Role-based access control
- `admin_users` - Admin accounts
- `subscriptions` - Payment subscriptions
- `payment_transactions` - Payment history
- `favorites` - User favorites
- `recommendations` - College recommendations
- `user_activity` - Activity tracking
- `notifications` - User notifications
- `stream_configurations` - Stream settings
- `user_streams` - User stream access

**Views (2):**
- `colleges_unified` - Unified view of all college types
- `v_counselling_details` - Complete counselling data with joins

**Total:** 35+ tables, 50+ indexes, 10+ triggers

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

**Expected tables (35+):**
```
admin_users
categories
category_aliases
college_aliases
counselling_records
counselling_rounds
course_aliases
courses
dental_colleges
dnb_colleges
favorites
levels
medical_colleges
notifications
partition_metadata
payment_transactions
quota_aliases
quotas
recommendations
seat_data
sources
state_aliases
state_college_link
state_course_college_link
state_mappings
states
stream_configurations
subscriptions
user_activity
user_profiles
user_roles
user_streams
```

**Verify views:**
```sql
SELECT
  table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: `colleges_unified`, `v_counselling_details`

---

## Step 3: Populate Foundation Data

Run the foundation data population script to insert reference data:

```sql
-- File: supabase/foundation_data_population.sql
```

**How to apply:**
1. In SQL Editor, create a new query
2. Copy the entire contents of `supabase/foundation_data_population.sql`
3. Paste into the SQL Editor
4. Click **Run**

**What this inserts:**
- **36 States/UTs** (Andhra Pradesh to Andaman and Nicobar Islands)
- **11 Categories** (General, OBC-NCL, SC, ST, EWS, PwD variants)
- **12 Quotas** (AIQ, State, Management, AIIMS, JIPMER, etc.)
- **7 Sources** (AIQ, KEA, STATE, MCC, DGHS, NBEMS, MANUAL)
- **5 Levels** (UG, PG, DEN, DNB, DIPLOMA)
- **40 Courses** (MBBS, BDS, MD, MS, MDS, DNB, Diploma courses)
- **4 Stream Configurations** (UG, PG_MEDICAL, DIPLOMA, DNB)
- **4 User Roles** (super_admin, admin, moderator, user)

**Verify data insertion:**

```sql
-- Check all foundation tables
SELECT 'States' as table_name, COUNT(*) as count FROM states
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Quotas', COUNT(*) FROM quotas
UNION ALL
SELECT 'Sources', COUNT(*) FROM sources
UNION ALL
SELECT 'Levels', COUNT(*) FROM levels
UNION ALL
SELECT 'Courses', COUNT(*) FROM courses
UNION ALL
SELECT 'Stream Configurations', COUNT(*) FROM stream_configurations
UNION ALL
SELECT 'User Roles', COUNT(*) FROM user_roles;
```

**Expected output:**
```
table_name               | count
-------------------------|------
States                   | 36
Categories               | 11
Quotas                   | 12
Sources                  | 7
Levels                   | 5
Courses                  | 40
Stream Configurations    | 4
User Roles               | 4
```

---

## Step 4: Create Super Admin User

### 4.1: Create Auth User

**Option 1: Via Supabase Dashboard (Recommended)**
1. Go to **Authentication → Users**
2. Click **"Add user"**
3. Enter email: `admin@yourdomain.com`
4. Set a strong password
5. Enable **"Auto Confirm User"**
6. Click **"Create user"**
7. **Copy the User UUID** (you'll need this in the next step)

**Option 2: Via Sign-Up Flow**
1. Use your application's sign-up page
2. Register with your admin email
3. Verify email if required
4. Get the user UUID from the auth.users table

### 4.2: Promote User to Super Admin

Use the provided script:

```sql
-- File: supabase/promote_to_super_admin.sql
```

**How to use:**
1. Open `supabase/promote_to_super_admin.sql`
2. Replace `'USER_UUID_HERE'` with the actual UUID from Step 4.1
3. Copy the modified SQL
4. Paste into SQL Editor
5. Click **Run**

**What this does:**
- Creates/gets super_admin role
- Updates user profile with super_admin role
- Creates admin_users entry
- Grants full access to all streams (UG, PG_MEDICAL, DIPLOMA, DNB)

**Verify admin creation:**

```sql
SELECT
  up.user_id,
  ur.role_name,
  au.role as admin_role,
  au.status,
  up.subscription_tier,
  (SELECT COUNT(*) FROM user_streams us WHERE us.user_id = up.user_id) as stream_access_count
FROM user_profiles up
LEFT JOIN user_roles ur ON up.role_id = ur.id
LEFT JOIN admin_users au ON up.user_id = au.user_id
WHERE au.role = 'super_admin';
```

Expected: 1 row with role_name = 'super_admin', stream_access_count = 4

---

## Step 5: Set Up Environment Variables

Add these to your **Vercel Dashboard → Settings → Environment Variables**:

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
1. Go to **Supabase Dashboard**
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

---

## Step 6: Test Database Connectivity

Create a test to verify everything works:

```sql
-- Test foundation data
SELECT
  (SELECT COUNT(*) FROM states) as states_count,
  (SELECT COUNT(*) FROM categories) as categories_count,
  (SELECT COUNT(*) FROM quotas) as quotas_count,
  (SELECT COUNT(*) FROM courses) as courses_count;

-- Test views
SELECT COUNT(*) FROM colleges_unified;

-- Test triggers (insert a test record)
INSERT INTO counselling_records (
  id, all_india_rank, college_institute_raw, course_raw,
  round_raw, year, partition_key, is_matched
) VALUES (
  'TEST-UG-2024-1-1', 1, 'Test College', 'MBBS',
  '1', 2024, 'TEST-UG-2024', false
);

-- Verify trigger updated partition_metadata
SELECT * FROM partition_metadata WHERE partition_key = 'TEST-UG-2024';

-- Clean up test data
DELETE FROM counselling_records WHERE id = 'TEST-UG-2024-1-1';
DELETE FROM partition_metadata WHERE partition_key = 'TEST-UG-2024';
```

---

## Step 7: Import College Data (Optional)

If you have existing SQLite databases with college data:

### Import Medical Colleges

```sql
-- Example import structure
INSERT INTO medical_colleges (
  id, name, state, address, college_type,
  normalized_name, normalized_state, normalized_address,
  composite_college_key, establishment_year, is_active
) VALUES
('MED0001', 'All India Institute of Medical Sciences', 'Delhi', 'Ansari Nagar, New Delhi',
 'Government', 'all india institute of medical sciences', 'delhi',
 'ansari nagar new delhi', 'all_india_institute_of_medical_sciences_delhi_ansari_nagar_new_delhi',
 1956, true);

-- Repeat for all medical colleges...
```

### Import Dental Colleges

```sql
INSERT INTO dental_colleges (
  id, name, state, address, college_type,
  normalized_name, normalized_state, normalized_address,
  composite_college_key, is_active
) VALUES
('DEN0001', 'Government Dental College & Hospital', 'Mumbai', 'Fort, Mumbai',
 'Government', 'government dental college hospital', 'maharashtra',
 'fort mumbai', 'government_dental_college_hospital_maharashtra_fort_mumbai', true);
```

### Import DNB Colleges

```sql
INSERT INTO dnb_colleges (
  id, name, state, address, college_type,
  normalized_name, normalized_state, normalized_address,
  composite_college_key, is_active
) VALUES
('DNB0001', 'Apollo Hospital', 'Delhi', 'Sarita Vihar, New Delhi',
 'Private', 'apollo hospital', 'delhi',
 'sarita vihar new delhi', 'apollo_hospital_delhi_sarita_vihar_new_delhi', true);
```

---

## Troubleshooting

### Issue: Foreign key constraint violation

**Cause:** Trying to insert data that references non-existent foreign keys

**Solution:**
```sql
-- Check if referenced data exists
SELECT * FROM states WHERE id = 'ST001';
SELECT * FROM courses WHERE id = 'CRS001';

-- Insert foundation data first, then college data
```

### Issue: Duplicate key error

**Cause:** Trying to insert data with existing primary key

**Solution:**
```sql
-- Use ON CONFLICT clause
INSERT INTO states (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

### Issue: Trigger not firing

**Cause:** Trigger function has an error

**Solution:**
```sql
-- Check trigger function
SELECT proname, prosrc FROM pg_proc WHERE proname = 'update_partition_metadata';

-- Test trigger manually
SELECT update_partition_metadata();
```

---

## Verification Checklist

- [ ] Unified schema migration applied successfully
- [ ] 35+ tables created
- [ ] 2 views created
- [ ] Foundation data populated (36 states, 11 categories, 12 quotas, etc.)
- [ ] Stream configurations inserted (4 streams)
- [ ] User roles created (4 roles)
- [ ] Super admin user created and verified
- [ ] Environment variables configured in Vercel
- [ ] Database connectivity tested
- [ ] Triggers working correctly

---

## Next Steps

1. **Import College Data** - Import medical, dental, and DNB colleges from SQLite databases
2. **Import Seat Data** - Import seat matrix information
3. **Import Counselling Data** - Import historical counselling records
4. **Configure RLS** - Set up Row Level Security policies
5. **Test Application** - Verify all application features work
6. **Deploy** - Push to production

---

## Complete! 🎉

Your database is now configured with the unified schema matching DATABASE_SCHEMAS.md structure!

**Schema Documentation:**
- **SCHEMA_MIGRATION_GUIDE.md** - SQLite to PostgreSQL mapping details
- **DATABASE_SCHEMAS.md** - Original SQLite schema documentation
- **foundation_data_population.sql** - Foundation data insertion script
- **promote_to_super_admin.sql** - Admin user promotion script

**Status:** Ready for college data import and application testing
