/**
 * Admin Notifications API
 *
 * Endpoints:
 * - GET /api/admin/notifications - List all notifications
 * - POST /api/admin/notifications - Create new notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notificationService } from '@/services/NotificationService';
import type { AdminNotification } from '@/components/admin/NotificationManagement';

/**
 * GET /api/admin/notifications
 * List all notifications with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check admin access
    const authResult = await authenticateAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
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
    // Authenticate user and check admin access
    const authResult = await authenticateAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
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
