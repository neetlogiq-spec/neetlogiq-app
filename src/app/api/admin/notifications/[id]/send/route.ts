/**
 * Send Notification Immediately API
 *
 * Endpoint:
 * - POST /api/admin/notifications/[id]/send - Send notification now
 */

import { NextRequest, NextResponse } from 'next/server';
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
    // Check admin authentication
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
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
