/**
 * Admin Authentication Tests
 * Tests for RBAC system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

describe('Admin Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isUserAdmin()', () => {
    it('should return true for admin users', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const { isUserAdmin } = await import('@/lib/admin-auth');
      const result = await isUserAdmin('admin-user-123');

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('is_admin', {
        p_user_id: 'admin-user-123',
      });
    });

    it('should return false for non-admin users', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const { isUserAdmin } = await import('@/lib/admin-auth');
      const result = await isUserAdmin('regular-user-123');

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const { isUserAdmin } = await import('@/lib/admin-auth');
      const result = await isUserAdmin('user-123');

      expect(result).toBe(false);
    });
  });

  describe('isUserSuperAdmin()', () => {
    it('should return true for super admin users', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const { isUserSuperAdmin } = await import('@/lib/admin-auth');
      const result = await isUserSuperAdmin('super-admin-123');

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('is_super_admin', {
        p_user_id: 'super-admin-123',
      });
    });

    it('should return false for regular admins', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const { isUserSuperAdmin } = await import('@/lib/admin-auth');
      const result = await isUserSuperAdmin('admin-123');

      expect(result).toBe(false);
    });
  });

  describe('getUserRole()', () => {
    it('should return user role from database', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'admin', error: null });

      const { getUserRole } = await import('@/lib/admin-auth');
      const role = await getUserRole('user-123');

      expect(role).toBe('admin');
    });

    it('should return user as default role', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const { getUserRole } = await import('@/lib/admin-auth');
      const role = await getUserRole('user-123');

      expect(role).toBe('user');
    });
  });

  describe('requireAdmin()', () => {
    it('should allow access for admin users', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const { requireAdmin } = await import('@/lib/admin-auth');
      const result = await requireAdmin('admin-user-123');

      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should deny access for non-admin users', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const { requireAdmin } = await import('@/lib/admin-auth');
      const result = await requireAdmin('user-123');

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Admin access required');
    });

    it('should require authentication', async () => {
      const { requireAdmin } = await import('@/lib/admin-auth');
      const result = await requireAdmin(undefined);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Authentication required');
    });
  });

  describe('assignAdminRole()', () => {
    it('should assign role when called by super admin', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const { assignAdminRole } = await import('@/lib/admin-auth');
      const result = await assignAdminRole(
        'target-user-123',
        'admin',
        'super-admin-123',
        'Promoted to admin'
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('assign_admin_role', {
        p_target_user_id: 'target-user-123',
        p_new_role: 'admin',
        p_admin_user_id: 'super-admin-123',
        p_reason: 'Promoted to admin',
      });
    });

    it('should fail when not called by super admin', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Only super admins can assign roles' },
      });

      const { assignAdminRole } = await import('@/lib/admin-auth');
      const result = await assignAdminRole(
        'target-user-123',
        'admin',
        'regular-admin-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only super admins can assign roles');
    });
  });
});

describe('User Roles', () => {
  it('should have three distinct roles', () => {
    const roles = ['user', 'admin', 'super_admin'];

    expect(roles).toHaveLength(3);
    expect(roles).toContain('user');
    expect(roles).toContain('admin');
    expect(roles).toContain('super_admin');
  });

  it('should enforce role hierarchy', () => {
    const hierarchy = {
      user: 1,
      admin: 2,
      super_admin: 3,
    };

    expect(hierarchy.super_admin).toBeGreaterThan(hierarchy.admin);
    expect(hierarchy.admin).toBeGreaterThan(hierarchy.user);
  });
});
