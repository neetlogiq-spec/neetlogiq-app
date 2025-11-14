/**
 * Promote User to Super Admin
 * 
 * INSTRUCTIONS:
 * 1. First create a user via Supabase Dashboard:
 *    - Go to Authentication → Users
 *    - Click "Add user"
 *    - Enter email and password
 *    - Enable "Auto Confirm User"
 *    - Copy the User UUID
 * 
 * 2. Replace 'USER_UUID_HERE' below with the actual UUID
 * 3. Run this script in Supabase SQL Editor
 */

DO $$
DECLARE
  -- ⚠️ REPLACE THIS WITH YOUR ACTUAL USER UUID ⚠️
  admin_user_id UUID := 'USER_UUID_HERE'::uuid;
  admin_role_id UUID;
BEGIN
  -- Get super_admin role ID
  SELECT id INTO admin_role_id
  FROM user_roles
  WHERE role_name = 'super_admin';

  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin role not found. Run initial_data_setup.sql first!';
  END IF;

  -- Create or update user profile
  INSERT INTO user_profiles (
    user_id,
    role_id,
    onboarding_completed,
    subscription_tier
  )
  VALUES (
    admin_user_id,
    admin_role_id,
    true,
    'premium'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    role_id = admin_role_id,
    subscription_tier = 'premium',
    updated_at = NOW();

  -- Create or update admin_users entry
  INSERT INTO admin_users (
    user_id,
    role,
    permissions,
    status
  )
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
  SET
    role = 'super_admin',
    permissions = jsonb_build_object(
      'full_access', true,
      'can_create_admins', true
    ),
    status = 'active',
    updated_at = NOW();

  -- Grant access to all streams
  INSERT INTO user_streams (user_id, stream_id, access_level)
  VALUES
    (admin_user_id, 'UG', 'full'),
    (admin_user_id, 'PG_MEDICAL', 'full'),
    (admin_user_id, 'DIPLOMA', 'full')
  ON CONFLICT (user_id, stream_id) DO UPDATE
  SET
    access_level = 'full',
    updated_at = NOW();

  RAISE NOTICE '✅ Super admin created successfully!';
  RAISE NOTICE 'User ID: %', admin_user_id;
END $$;

-- Verify the super admin was created
SELECT
  up.user_id,
  ur.role_name,
  au.role as admin_role,
  au.status,
  up.subscription_tier,
  (
    SELECT COUNT(*)
    FROM user_streams us
    WHERE us.user_id = up.user_id
  ) as stream_access_count
FROM user_profiles up
LEFT JOIN user_roles ur ON up.role_id = ur.id
LEFT JOIN admin_users au ON up.user_id = au.user_id
WHERE au.role = 'super_admin'
ORDER BY au.created_at DESC
LIMIT 1;
