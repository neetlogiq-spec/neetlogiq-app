/**
 * Admin Middleware
 * Checks if user has admin role before allowing access to admin routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function checkAdminAccess(request: NextRequest): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    // Get session from request
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        authorized: false,
        error: 'Not authenticated'
      };
    }

    const userId = session.user.id;

    // Check if user has admin role
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      return {
        authorized: false,
        error: 'User profile not found'
      };
    }

    if (profile.role !== 'admin') {
      return {
        authorized: false,
        userId,
        error: 'Insufficient permissions. Admin access required.'
      };
    }

    return {
      authorized: true,
      userId
    };

  } catch (error) {
    console.error('Admin auth check error:', error);
    return {
      authorized: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes?: any
) {
  try {
    await supabase
      .from('admin_audit_log')
      .insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        changes: changes || null,
        ip_address: null, // Could extract from request headers
        user_agent: null  // Could extract from request headers
      });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't fail the request if logging fails
  }
}
