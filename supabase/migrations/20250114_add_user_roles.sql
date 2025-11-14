-- Add role-based access control to user_profiles
-- Replaces hardcoded email checking with proper database roles

-- Add role column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Add audit log for role changes
CREATE TABLE IF NOT EXISTS admin_role_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  old_role TEXT,
  new_role TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_user_id ON admin_role_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_changes_changed_at ON admin_role_changes(changed_at DESC);

-- Function to assign admin role (can only be called by super_admin)
CREATE OR REPLACE FUNCTION assign_admin_role(
  p_target_user_id UUID,
  p_new_role TEXT,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role TEXT;
  v_old_role TEXT;
BEGIN
  -- Check if the requesting user is a super_admin
  SELECT role INTO v_admin_role
  FROM user_profiles
  WHERE user_id = p_admin_user_id;

  IF v_admin_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can assign roles';
  END IF;

  -- Validate new role
  IF p_new_role NOT IN ('user', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  -- Get current role
  SELECT role INTO v_old_role
  FROM user_profiles
  WHERE user_id = p_target_user_id;

  -- Update role
  UPDATE user_profiles
  SET role = p_new_role, updated_at = NOW()
  WHERE user_id = p_target_user_id;

  -- Log the change
  INSERT INTO admin_role_changes (user_id, old_role, new_role, changed_by, reason)
  VALUES (p_target_user_id, v_old_role, p_new_role, p_admin_user_id, p_reason);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin (callable by anyone)
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM user_profiles
  WHERE user_id = p_user_id;

  RETURN v_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin (callable by anyone)
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM user_profiles
  WHERE user_id = p_user_id;

  RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) Policies
-- Only admins can view admin_role_changes
ALTER TABLE admin_role_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_role_changes_select_policy
ON admin_role_changes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Only super_admins can insert role changes (via function)
CREATE POLICY admin_role_changes_insert_policy
ON admin_role_changes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Comment explaining the role system
COMMENT ON COLUMN user_profiles.role IS 'User role for RBAC: user (default), admin (can manage data), super_admin (can assign roles)';
COMMENT ON TABLE admin_role_changes IS 'Audit log for all role changes';
COMMENT ON FUNCTION assign_admin_role IS 'Assign admin role to a user (super_admin only)';
COMMENT ON FUNCTION is_admin IS 'Check if user has admin privileges';
COMMENT ON FUNCTION is_super_admin IS 'Check if user has super admin privileges';
