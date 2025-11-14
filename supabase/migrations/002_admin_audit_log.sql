-- Admin Audit Log Table
-- Tracks all admin actions for compliance and debugging

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE')),
    resource_type TEXT NOT NULL, -- 'college', 'cutoff', 'course', etc.
    resource_id TEXT NOT NULL,   -- ID of the affected resource
    changes JSONB,               -- What changed (before/after)
    ip_address INET,             -- IP address of admin
    user_agent TEXT,             -- Browser/client info
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_audit_user ON admin_audit_log(user_id);
CREATE INDEX idx_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON admin_audit_log(action);

-- RLS Policy (only admins can view audit logs)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
    ON admin_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- Add role column to user_profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'role'
    ) THEN
        ALTER TABLE user_profiles
        ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));

        CREATE INDEX idx_user_profiles_role ON user_profiles(role);
    END IF;
END $$;

-- Function to get audit trail for a resource
CREATE OR REPLACE FUNCTION get_audit_trail(
    p_resource_type TEXT,
    p_resource_id TEXT
)
RETURNS TABLE (
    id UUID,
    user_email TEXT,
    action TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        u.email as user_email,
        a.action,
        a.changes,
        a.created_at
    FROM admin_audit_log a
    JOIN auth.users u ON a.user_id = u.id
    WHERE a.resource_type = p_resource_type
      AND a.resource_id = p_resource_id
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE admin_audit_log IS 'Tracks all administrative actions for audit trail';
COMMENT ON FUNCTION get_audit_trail IS 'Get complete audit history for a specific resource';
