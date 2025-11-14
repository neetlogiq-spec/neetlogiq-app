/**
 * Initial Data Setup Script
 * Run this AFTER applying all migrations to insert essential configuration data
 */

-- =====================================================
-- STEP 1: Insert Stream Configurations
-- =====================================================

INSERT INTO stream_configurations (
  stream_id,
  stream_name,
  stream_description,
  is_enabled,
  requires_subscription,
  priority,
  metadata
) VALUES
(
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
),
(
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
),
(
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
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- =====================================================
-- STEP 2: Verify Stream Configurations
-- =====================================================

SELECT
  stream_id,
  stream_name,
  is_enabled,
  requires_subscription,
  priority
FROM stream_configurations
ORDER BY priority;

-- Expected output: 3 streams (UG, PG_MEDICAL, DIPLOMA)

-- =====================================================
-- STEP 3: Create Default User Roles
-- =====================================================

INSERT INTO user_roles (role_name, role_description, permissions)
VALUES
(
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
),
(
  'admin',
  'Administrator with limited management access',
  jsonb_build_object(
    'can_manage_content', true,
    'can_view_analytics', true,
    'can_access_admin_panel', true
  )
),
(
  'moderator',
  'Content moderator',
  jsonb_build_object(
    'can_manage_content', true,
    'can_access_admin_panel', true
  )
),
(
  'user',
  'Regular platform user',
  jsonb_build_object(
    'can_view_content', true,
    'can_create_profile', true
  )
)
ON CONFLICT (role_name) DO UPDATE
SET
  role_description = EXCLUDED.role_description,
  permissions = EXCLUDED.permissions;

-- =====================================================
-- STEP 4: Verify Role Creation
-- =====================================================

SELECT
  id,
  role_name,
  role_description
FROM user_roles
ORDER BY role_name;

-- Expected output: 4 roles (super_admin, admin, moderator, user)

-- =====================================================
-- DONE! Next Steps:
-- =====================================================

-- 1. Create a user via Supabase Dashboard (Authentication → Users)
-- 2. Copy the user UUID
-- 3. Run the promote_to_super_admin.sql script with that UUID

SELECT 'Initial data setup complete!' as status;
