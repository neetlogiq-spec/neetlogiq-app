/**
 * Estimate Notification Reach API
 *
 * Endpoint:
 * - POST /api/admin/notifications/estimate-reach - Estimate how many users will receive notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/NotificationService';
import type { NotificationTarget } from '@/components/admin/NotificationManagement';

/**
 * POST /api/admin/notifications/estimate-reach
 * Estimate the number of users that will receive a notification based on targeting criteria
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
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
 * Check if request is from authenticated admin
 */
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    // Get session token from cookie or header
    const token = request.cookies.get('session')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return false;
    }

    // TODO: Verify token with Firebase Admin SDK
    // For now, this is a placeholder
    // In production, verify the token and check admin status

    // Example with Firebase Admin:
    // const decodedToken = await admin.auth().verifyIdToken(token);
    // const isAdmin = await checkAdminRole(decodedToken.uid);
    // return isAdmin;

    return true; // Placeholder - MUST implement proper auth
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}
