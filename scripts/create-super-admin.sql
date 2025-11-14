-- ===============================================
-- Create Super Admin User
-- ===============================================
-- Run this after you've signed up as a user in the app

-- STEP 1: Find your user ID
-- Replace the email with your actual email
SELECT
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'your-email@example.com'  -- ⚠️ CHANGE THIS
ORDER BY created_at DESC
LIMIT 1;

-- Copy the user_id from the result above

-- STEP 2: Make yourself super admin
-- Replace 'YOUR-USER-ID-HERE' with the actual ID from Step 1
UPDATE user_profiles
SET role = 'super_admin',
    updated_at = NOW()
WHERE user_id = 'YOUR-USER-ID-HERE';  -- ⚠️ CHANGE THIS

-- STEP 3: Verify super admin created
SELECT
    up.user_id,
    au.email,
    up.role,
    up.subscription_tier,
    up.created_at
FROM user_profiles up
JOIN auth.users au ON up.user_id = au.id
WHERE up.role = 'super_admin';

-- STEP 4: Grant yourself a trial (optional)
-- This will give you 7-day premium trial to test features
SELECT start_user_trial('YOUR-USER-ID-HERE');  -- ⚠️ CHANGE THIS

-- STEP 5: Verify trial started
SELECT
    user_id,
    trial_started_at,
    trial_ends_at,
    trial_used,
    subscription_tier,
    EXTRACT(DAY FROM (trial_ends_at - NOW())) as days_remaining
FROM user_profiles
WHERE user_id = 'YOUR-USER-ID-HERE';  -- ⚠️ CHANGE THIS

-- ===============================================
-- Quick Commands
-- ===============================================

-- List all users with their roles
SELECT
    au.email,
    up.role,
    up.subscription_tier,
    up.created_at
FROM user_profiles up
JOIN auth.users au ON up.user_id = au.id
ORDER BY up.created_at DESC
LIMIT 10;

-- Make multiple users admins (replace IDs)
UPDATE user_profiles
SET role = 'admin'
WHERE user_id IN (
    'user-id-1',
    'user-id-2',
    'user-id-3'
);

-- Remove admin role (demote to user)
UPDATE user_profiles
SET role = 'user'
WHERE user_id = 'user-id-to-demote';

-- Check trial status for all users
SELECT
    au.email,
    up.trial_used,
    up.trial_started_at,
    up.trial_ends_at,
    CASE
        WHEN up.trial_ends_at > NOW() THEN '✅ Active'
        WHEN up.trial_ends_at IS NOT NULL THEN '❌ Expired'
        ELSE '⏳ Not started'
    END as trial_status
FROM user_profiles up
JOIN auth.users au ON up.user_id = au.id
ORDER BY up.trial_started_at DESC NULLS LAST;
