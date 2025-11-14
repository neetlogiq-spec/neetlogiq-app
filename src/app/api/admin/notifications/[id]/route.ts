/**
 * Admin Notification Detail API
 *
 * Endpoints:
 * - GET /api/admin/notifications/[id] - Get notification details
 * - PUT /api/admin/notifications/[id] - Update notification
 * - DELETE /api/admin/notifications/[id] - Delete notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notificationService } from '@/services/NotificationService';
import type { AdminNotification } from '@/components/admin/NotificationManagement';

/**
 * GET /api/admin/notifications/[id]
 * Get notification by ID
 */
export async function GET(
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

    // TODO: Query notification from database
    // const notification = await db.collection('notifications').doc(id).get();
    // if (!notification.exists) {
    //   return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    // }

    // Placeholder - return structure
    const notification: AdminNotification | null = null;

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Get analytics if notification was sent
    if (notification.status === 'sent') {
      const analytics = await notificationService.getNotificationAnalytics(id);
      if (analytics) {
        notification.stats = {
          delivered: analytics.delivered,
          viewed: analytics.viewed,
          clicked: analytics.clicked,
          dismissed: analytics.dismissed
        };
      }
    }

    return NextResponse.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/notifications/[id]
 * Update notification
 */
export async function PUT(
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
    const updates: Partial<AdminNotification> = await request.json();

    // TODO: Get existing notification from database
    // const existingDoc = await db.collection('notifications').doc(id).get();
    // if (!existingDoc.exists) {
    //   return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    // }
    // const existing = existingDoc.data() as AdminNotification;

    // Prevent updating sent notifications (only draft/scheduled can be edited)
    // if (existing.status === 'sent') {
    //   return NextResponse.json(
    //     { error: 'Cannot update sent notifications' },
    //     { status: 400 }
    //   );
    // }

    // Validate updated notification
    const updatedNotification: AdminNotification = {
      ...updates,
      id,
      updatedAt: new Date()
    } as AdminNotification;

    const validation = notificationService.validateNotification(updatedNotification);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid notification', errors: validation.errors },
        { status: 400 }
      );
    }

    // TODO: Update in database
    // await db.collection('notifications').doc(id).update({
    //   ...updates,
    //   updatedAt: new Date()
    // });

    // If changing to scheduled, reschedule
    if (updates.schedule?.deliveryType === 'scheduled') {
      await notificationService.scheduleNotification(updatedNotification);
    }

    return NextResponse.json({
      success: true,
      notification: updatedNotification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications/[id]
 * Delete notification
 */
export async function DELETE(
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

    // TODO: Check if notification exists
    // const notification = await db.collection('notifications').doc(id).get();
    // if (!notification.exists) {
    //   return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    // }

    // Cancel scheduled notification if applicable
    await notificationService.cancelScheduledNotification(id);

    // TODO: Delete from database
    // await db.collection('notifications').doc(id).delete();

    // TODO: Also delete associated delivery records (optional, or mark as deleted)
    // await db.collection('notificationDeliveries')
    //   .where('notificationId', '==', id)
    //   .get()
    //   .then(snapshot => {
    //     const batch = db.batch();
    //     snapshot.docs.forEach(doc => batch.delete(doc.ref));
    //     return batch.commit();
    //   });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
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
