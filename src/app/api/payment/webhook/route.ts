/**
 * Razorpay Webhook Handler
 * POST /api/payment/webhook
 *
 * Handles Razorpay webhook events for subscription auto-renewal,
 * payment failures, refunds, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyWebhookSignature } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from headers
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Get raw body
    const body = await request.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    // Verify signature
    const isValid = verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse event
    const event = JSON.parse(body);
    const eventType = event.event;
    const payload = event.payload.payment.entity || event.payload.order.entity;

    console.log('Razorpay webhook event:', eventType);

    // Handle different event types
    switch (eventType) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;

      case 'payment.refunded':
        await handlePaymentRefunded(payload);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(payload);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload);
        break;

      default:
        console.log('Unhandled webhook event:', eventType);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle payment captured event
 */
async function handlePaymentCaptured(payload: any) {
  const orderId = payload.order_id;
  const paymentId = payload.id;

  // Update subscription status
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      razorpay_payment_id: paymentId,
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_order_id', orderId);

  if (error) {
    console.error('Error updating subscription after payment capture:', error);
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payload: any) {
  const orderId = payload.order_id;

  // Update subscription status to failed
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_order_id', orderId);

  if (error) {
    console.error('Error updating subscription after payment failure:', error);
  }

  // Create notification for user
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('razorpay_order_id', orderId)
    .single();

  if (subscription) {
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: subscription.user_id,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: 'Your payment could not be processed. Please try again.',
        data: { order_id: orderId, reason: payload.error_description }
      });
  }
}

/**
 * Handle payment refunded event
 */
async function handlePaymentRefunded(payload: any) {
  const paymentId = payload.id;

  // Update subscription status
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('razorpay_payment_id', paymentId)
    .single();

  if (subscription) {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('razorpay_payment_id', paymentId);

    // Update user profile back to free tier
    await supabaseAdmin
      .from('user_profiles')
      .update({
        subscription_tier: 'free',
        subscription_end_date: null
      })
      .eq('user_id', subscription.user_id);

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: subscription.user_id,
        type: 'subscription_refunded',
        title: 'Subscription Refunded',
        message: 'Your subscription has been refunded. You now have access to the free tier.',
        data: { payment_id: paymentId, amount: payload.amount }
      });
  }
}

/**
 * Handle subscription activated event
 */
async function handleSubscriptionActivated(payload: any) {
  // This is for Razorpay subscription plans (auto-renewal)
  // Implementation depends on if you use Razorpay subscriptions
  console.log('Subscription activated:', payload);
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(payload: any) {
  console.log('Subscription cancelled:', payload);
}

/**
 * Handle subscription charged event (auto-renewal)
 */
async function handleSubscriptionCharged(payload: any) {
  console.log('Subscription charged:', payload);
}
