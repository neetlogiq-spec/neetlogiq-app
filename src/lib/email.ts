/**
 * Email Notification Utilities
 *
 * Simple email notification functions using the database notification system
 * In production, this should be replaced with actual email service (SendGrid, AWS SES, etc.)
 */

import { supabase } from '@/lib/supabase';

export interface EmailNotification {
  to: string; // user_id
  subject: string;
  message: string;
  link?: string;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Send email notification (currently uses in-app notifications)
 * TODO: Integrate with actual email service provider
 */
export async function sendEmail(notification: EmailNotification): Promise<boolean> {
  try {
    // For now, create an in-app notification
    // In production, this should also send an actual email
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: notification.to,
      p_type: 'system',
      p_title: notification.subject,
      p_message: notification.message,
      p_link: notification.link || null,
      p_priority: notification.priority || 'medium'
    });

    if (error) {
      console.error('Error sending notification:', error);
      return false;
    }

    // TODO: Send actual email here
    // Example with SendGrid:
    // await sendgrid.send({
    //   to: userEmail,
    //   from: 'noreply@neetlogiq.com',
    //   subject: notification.subject,
    //   html: generateEmailTemplate(notification.message, notification.link)
    // });

    console.log(`📧 Email notification sent to user ${notification.to}: ${notification.subject}`);
    return true;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    return false;
  }
}

/**
 * Send stream change approved notification
 */
export async function sendStreamChangeApprovedEmail(
  userId: string,
  oldStream: string,
  newStream: string,
  adminNotes?: string
): Promise<boolean> {
  const streamNames: Record<string, string> = {
    'UG': 'Undergraduate (MBBS, BDS)',
    'PG_MEDICAL': 'Postgraduate Medical (MD, MS)',
    'PG_DENTAL': 'Postgraduate Dental (MDS)'
  };

  let message = `Your stream change request has been approved! ✅\n\n`;
  message += `Previous Stream: ${streamNames[oldStream] || oldStream}\n`;
  message += `New Stream: ${streamNames[newStream] || newStream}\n\n`;

  if (adminNotes) {
    message += `Admin Note: ${adminNotes}\n\n`;
  }

  message += `Your stream selection has been updated. You can now access features and data for your new stream.`;

  return sendEmail({
    to: userId,
    subject: '✅ Stream Change Request Approved',
    message,
    link: '/profile',
    priority: 'high'
  });
}

/**
 * Send stream change rejected notification
 */
export async function sendStreamChangeRejectedEmail(
  userId: string,
  requestedStream: string,
  adminNotes?: string
): Promise<boolean> {
  const streamNames: Record<string, string> = {
    'UG': 'Undergraduate (MBBS, BDS)',
    'PG_MEDICAL': 'Postgraduate Medical (MD, MS)',
    'PG_DENTAL': 'Postgraduate Dental (MDS)'
  };

  let message = `Your stream change request has been reviewed and unfortunately cannot be approved at this time. ❌\n\n`;
  message += `Requested Stream: ${streamNames[requestedStream] || requestedStream}\n\n`;

  if (adminNotes) {
    message += `Reason: ${adminNotes}\n\n`;
  }

  message += `If you have questions or need further assistance, please contact our support team.`;

  return sendEmail({
    to: userId,
    subject: '❌ Stream Change Request - Update',
    message,
    link: '/profile',
    priority: 'high'
  });
}

/**
 * Send subscription gifted notification
 */
export async function sendSubscriptionGiftedEmail(
  userId: string,
  planType: string,
  durationDays: number
): Promise<boolean> {
  let message = `Congratulations! You've received a premium subscription! 🎁\n\n`;
  message += `Plan: ${planType.charAt(0).toUpperCase() + planType.slice(1)}\n`;
  message += `Duration: ${durationDays} days\n\n`;
  message += `You now have access to all premium features including:\n`;
  message += `• Unlimited college comparisons\n`;
  message += `• Unlimited AI predictions\n`;
  message += `• Full trend analysis\n`;
  message += `• Unlimited document downloads\n`;
  message += `• Priority support\n\n`;
  message += `Enjoy your premium access!`;

  return sendEmail({
    to: userId,
    subject: '🎁 You Received a Premium Subscription!',
    message,
    link: '/pricing',
    priority: 'high'
  });
}
