-- ===============================================
-- Database Verification Script
-- Run this in Supabase SQL Editor to verify setup
-- ===============================================

-- 1. Check all tables exist
SELECT
    '✅ TABLES CHECK' as check_type,
    COUNT(*) as total_tables,
    CASE
        WHEN COUNT(*) >= 27 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 27+ tables'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public';

-- 2. List all tables
SELECT
    '📋 TABLE LIST' as info,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. Check critical tables exist
SELECT
    '✅ CRITICAL TABLES' as check_type,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN '✅' ELSE '❌' END as user_profiles,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN '✅' ELSE '❌' END as subscriptions,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_config') THEN '✅' ELSE '❌' END as stream_config,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_usage_tracking') THEN '✅' ELSE '❌' END as usage_tracking,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'favorites') THEN '✅' ELSE '❌' END as favorites,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN '✅' ELSE '❌' END as notifications;

-- 4. Check database functions exist
SELECT
    '✅ FUNCTIONS CHECK' as check_type,
    routine_name as function_name,
    routine_type as type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 5. Verify stream config populated
SELECT
    '✅ STREAM CONFIG' as check_type,
    stream_id,
    stream_name,
    enabled,
    CASE WHEN enabled THEN '✅ Active' ELSE '⚠️ Disabled' END as status
FROM stream_config
ORDER BY stream_id;

-- 6. Check for super admins
SELECT
    '👤 SUPER ADMINS' as check_type,
    COUNT(*) as total_super_admins,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ At least one super admin exists'
        ELSE '⚠️ No super admin - Create one!'
    END as status
FROM user_profiles
WHERE role = 'super_admin';

-- 7. Check user roles distribution
SELECT
    '📊 USER ROLES' as info,
    role,
    COUNT(*) as user_count
FROM user_profiles
GROUP BY role
ORDER BY user_count DESC;

-- 8. Check subscriptions table structure
SELECT
    '✅ SUBSCRIPTIONS COLUMNS' as check_type,
    column_name,
    data_type,
    CASE WHEN is_nullable = 'NO' THEN 'Required' ELSE 'Optional' END as nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 9. Verify trial period columns exist
SELECT
    '✅ TRIAL COLUMNS' as check_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'trial_started_at'
    ) THEN '✅' ELSE '❌' END as trial_started_at,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'trial_ends_at'
    ) THEN '✅' ELSE '❌' END as trial_ends_at,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'trial_used'
    ) THEN '✅' ELSE '❌' END as trial_used;

-- 10. Check usage tracking table
SELECT
    '✅ USAGE TRACKING' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users
FROM user_usage_tracking;

-- 11. Verify triggers exist
SELECT
    '✅ TRIGGERS' as check_type,
    trigger_name,
    event_manipulation as event,
    event_object_table as table_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 12. Check RLS policies
SELECT
    '🔒 RLS POLICIES' as check_type,
    tablename as table_name,
    policyname as policy_name,
    CASE WHEN cmd = 'ALL' THEN 'ALL'
         WHEN cmd = 'SELECT' THEN 'SELECT'
         WHEN cmd = 'INSERT' THEN 'INSERT'
         WHEN cmd = 'UPDATE' THEN 'UPDATE'
         WHEN cmd = 'DELETE' THEN 'DELETE'
    END as command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ===============================================
-- SUMMARY
-- ===============================================
SELECT
    '📊 DEPLOYMENT READINESS' as final_check,
    CASE
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') >= 27
        THEN '✅ Database ready for deployment'
        ELSE '❌ Database not ready - missing tables'
    END as database_status,
    CASE
        WHEN (SELECT COUNT(*) FROM user_profiles WHERE role = 'super_admin') > 0
        THEN '✅ Super admin exists'
        ELSE '⚠️ Create super admin'
    END as admin_status,
    CASE
        WHEN (SELECT COUNT(*) FROM stream_config) >= 3
        THEN '✅ Stream config populated'
        ELSE '❌ Stream config missing'
    END as stream_status;
