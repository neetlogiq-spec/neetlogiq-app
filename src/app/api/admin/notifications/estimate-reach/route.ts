/**
 * Estimate Notification Reach API
 *
 * Endpoint:
 * - POST /api/admin/notifications/estimate-reach - Estimate how many users will receive notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notificationService } from '@/services/NotificationService';
import type { NotificationTarget } from '@/components/admin/NotificationManagement';

/**
 * POST /api/admin/notifications/estimate-reach
 * Estimate the number of users that will receive a notification based on targeting criteria
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user and check admin access
    const authResult = await authenticateAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse targeting criteria
    const target: NotificationTarget = await request.json();

    // Validate target
    if (!target.streams || target.streams.length === 0) {
      return NextResponse.json(
        { error: 'At least one stream must be selected' },
        { status: 400 }
      );
    }

    if (!target.userSegments || target.userSegments.length === 0) {
      return NextResponse.json(
        { error: 'At least one user segment must be selected' },
        { status: 400 }
      );
    }

    // Estimate reach
    const estimatedUsers = await notificationService.estimateReach(target);

    // Get breakdown by stream
    const breakdown: Record<string, number> = {};
    for (const stream of target.streams) {
      const streamTarget = { ...target, streams: [stream] };
      const count = await notificationService.estimateReach(streamTarget);
      breakdown[stream] = count;
    }

    return NextResponse.json({
      success: true,
      estimate: {
        total: estimatedUsers,
        breakdown,
        target
      }
    });
  } catch (error) {
    console.error('Error estimating reach:', error);
    return NextResponse.json(
      { error: 'Failed to estimate reach' },
      { status: 500 }
    );
  }
}

/**
 * Authenticate user and verify admin access
 */
async function authenticateAdmin(request: NextRequest): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
  status?: number;
}> {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        success: false,
        error: 'Not authenticated - Authorization header required',
        status: 401
      };
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        success: false,
        error: 'Invalid authentication token',
        status: 401
      };
    }

    // Check if user has admin privileges
    const adminCheck = await requireAdmin(user.id);
    if (!adminCheck.allowed) {
      return {
        success: false,
        error: adminCheck.error || 'Admin access required',
        status: 403
      };
    }

    return {
      success: true,
      userId: user.id
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    };
  }
}
