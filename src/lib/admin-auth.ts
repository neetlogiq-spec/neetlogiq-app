/**
 * Admin Authentication Utilities
 *
 * Provides role-based access control (RBAC) for admin features.
 * Replaces the legacy hardcoded email checking system.
 */

import { supabase } from './supabase';

export type UserRole = 'user' | 'admin' | 'super_admin';

export interface RoleCheckResult {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: UserRole;
}

/**
 * Check if a user has admin privileges (admin or super_admin)
 * @param userId - User ID to check
 * @returns Boolean indicating admin status
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in isUserAdmin:', error);
    return false;
  }
}

/**
 * Check if a user has super admin privileges
 * @param userId - User ID to check
 * @returns Boolean indicating super admin status
 */
export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_super_admin', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error checking super admin status:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in isUserSuperAdmin:', error);
    return false;
  }
}

/**
 * Get user's role and admin status
 * @param userId - User ID to check
 * @returns Role information
 */
export async function getUserRole(userId: string): Promise<RoleCheckResult> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        isAdmin: false,
        isSuperAdmin: false,
        role: 'user'
      };
    }

    const role = (data.role || 'user') as UserRole;

    return {
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin',
      role
    };
  } catch (error) {
    console.error('Error in getUserRole:', error);
    return {
      isAdmin: false,
      isSuperAdmin: false,
      role: 'user'
    };
  }
}

/**
 * Assign admin role to a user (super_admin only)
 * @param targetUserId - User ID to assign role to
 * @param newRole - New role to assign
 * @param adminUserId - User ID of the admin making the change
 * @param reason - Reason for role change
 * @returns Success status
 */
export async function assignAdminRole(
  targetUserId: string,
  newRole: UserRole,
  adminUserId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('assign_admin_role', {
      p_target_user_id: targetUserId,
      p_new_role: newRole,
      p_admin_user_id: adminUserId,
      p_reason: reason || null
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get role change history for a user
 * @param userId - User ID to get history for
 * @returns Array of role changes
 */
export async function getRoleChangeHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('admin_role_changes')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching role history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRoleChangeHistory:', error);
    return [];
  }
}

/**
 * Middleware helper for API routes to check admin access
 * @param userId - User ID from session
 * @returns Admin check result
 */
export async function requireAdmin(userId: string | undefined): Promise<{
  allowed: boolean;
  error?: string;
}> {
  if (!userId) {
    return {
      allowed: false,
      error: 'Authentication required'
    };
  }

  const isAdmin = await isUserAdmin(userId);

  if (!isAdmin) {
    return {
      allowed: false,
      error: 'Admin access required'
    };
  }

  return { allowed: true };
}

/**
 * Middleware helper for API routes to check super admin access
 * @param userId - User ID from session
 * @returns Super admin check result
 */
export async function requireSuperAdmin(userId: string | undefined): Promise<{
  allowed: boolean;
  error?: string;
}> {
  if (!userId) {
    return {
      allowed: false,
      error: 'Authentication required'
    };
  }

  const isSuperAdmin = await isUserSuperAdmin(userId);

  if (!isSuperAdmin) {
    return {
      allowed: false,
      error: 'Super admin access required'
    };
  }

  return { allowed: true };
}

/**
 * Legacy compatibility function
 * @deprecated Use isUserAdmin instead
 */
export async function isDeveloperAccount(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;

  // Get user by email
  const { data: user } = await supabase
    .from('user_profiles')
    .select('user_id, role')
    .eq('email', email)
    .single();

  if (!user) return false;

  return user.role === 'admin' || user.role === 'super_admin';
}
