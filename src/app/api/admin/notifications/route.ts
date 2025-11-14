/**
 * Admin Notifications API
 *
 * Endpoints:
 * - GET /api/admin/notifications - List all notifications
 * - POST /api/admin/notifications - Create new notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/NotificationService';
import type { AdminNotification } from '@/components/admin/NotificationManagement';

/**
 * GET /api/admin/notifications
 * List all notifications with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const stream = searchParams.get('stream');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // TODO: Query notifications from database
    // For now, return mock structure
    const notifications: AdminNotification[] = [];

    // Apply filters
    let filtered = notifications;
    if (status) {
      filtered = filtered.filter(n => n.status === status);
    }
    if (type) {
      filtered = filtered.filter(n => n.type === type);
    }
    if (stream) {
      filtered = filtered.filter(n => n.target.streams.includes(stream as any));
    }

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      notifications: paginated,
      total: filtered.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications
 * Create a new notification
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

    // Parse request body
    const notification: AdminNotification = await request.json();

    // Validate notification
    const validation = notificationService.validateNotification(notification);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid notification', errors: validation.errors },
        { status: 400 }
      );
    }

    // Set metadata
    notification.createdAt = new Date();
    notification.updatedAt = new Date();
    notification.status = 'draft';

    // TODO: Save to database
    // await db.collection('notifications').doc(notification.id).set(notification);

    // If delivery type is immediate, send now
    if (notification.schedule.deliveryType === 'immediate') {
      const result = await notificationService.sendNotification(notification);

      notification.status = 'sent';
      notification.stats = {
        delivered: result.delivered,
        viewed: 0,
        clicked: 0,
        dismissed: 0
      };

      // TODO: Update in database
      // await db.collection('notifications').doc(notification.id).update({ status: 'sent', stats });
    }
    // If scheduled, set up scheduling
    else if (notification.schedule.deliveryType === 'scheduled') {
      const scheduled = await notificationService.scheduleNotification(notification);

      if (scheduled) {
        notification.status = 'scheduled';
        // TODO: Update in database
      }
    }

    return NextResponse.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
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
