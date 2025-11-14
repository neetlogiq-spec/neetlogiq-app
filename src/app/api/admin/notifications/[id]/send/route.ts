/**
 * Send Notification Immediately API
 *
 * Endpoint:
 * - POST /api/admin/notifications/[id]/send - Send notification now
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notificationService } from '@/services/NotificationService';
import type { AdminNotification } from '@/components/admin/NotificationManagement';

/**
 * POST /api/admin/notifications/[id]/send
 * Send a notification immediately (even if it was scheduled)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user and check admin access
    const authResult = await authenticateAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = params;

    // TODO: Get notification from database
    // const notificationDoc = await db.collection('notifications').doc(id).get();
    // if (!notificationDoc.exists) {
    //   return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    // }
    // const notification = notificationDoc.data() as AdminNotification;

    // Placeholder
    const notification: AdminNotification | null = null;

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Check if already sent
    if (notification.status === 'sent') {
      return NextResponse.json(
        { error: 'Notification already sent' },
        { status: 400 }
      );
    }

    // Validate notification before sending
    const validation = notificationService.validateNotification(notification);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid notification', errors: validation.errors },
        { status: 400 }
      );
    }

    // Estimate reach before sending
    const estimatedReach = await notificationService.estimateReach(notification.target);

    // Send notification
    console.log(`📤 Sending notification "${notification.title}" to ~${estimatedReach} users`);

    const result = await notificationService.sendNotification(notification);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send notification' },
        { status: 500 }
      );
    }

    // Update notification status
    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.stats = {
      delivered: result.delivered,
      viewed: 0,
      clicked: 0,
      dismissed: 0
    };

    // TODO: Update in database
    // await db.collection('notifications').doc(id).update({
    //   status: 'sent',
    //   sentAt: new Date(),
    //   stats: notification.stats
    // });

    // Cancel scheduled job if it was scheduled
    if (notification.schedule.deliveryType === 'scheduled') {
      await notificationService.cancelScheduledNotification(id);
    }

    console.log(`✅ Notification sent: ${result.delivered} delivered, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      notification,
      delivery: {
        delivered: result.delivered,
        failed: result.failed,
        estimatedReach
      }
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification', details: (error as Error).message },
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
