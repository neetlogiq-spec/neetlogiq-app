/**
 * Razorpay Webhook Handler
 * POST /api/payments/webhook
 *
 * Handles Razorpay webhook events for subscription payments,
 * payment failures, refunds, and subscription lifecycle events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

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

    // Extract payload based on event type
    const payload = event.payload?.payment?.entity ||
                    event.payload?.order?.entity ||
                    event.payload?.subscription?.entity;

    // Handle different event types
    switch (eventType) {
      case 'payment.authorized':
        await handlePaymentAuthorized(payload);
        break;

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

      case 'subscription.completed':
        await handleSubscriptionCompleted(payload);
        break;

      default:
        // Log unhandled events for monitoring
        console.warn('Unhandled webhook event:', eventType, payload);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle payment authorized event
 */
async function handlePaymentAuthorized(payload: any) {
  const orderId = payload.order_id;
  const paymentId = payload.id;

  // Update subscription with payment ID
  await supabase
    .from('subscriptions')
    .update({
      razorpay_payment_id: paymentId,
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_order_id', orderId);
}

/**
 * Handle payment captured event - payment successful
 */
async function handlePaymentCaptured(payload: any) {
  const orderId = payload.order_id;
  const paymentId = payload.id;
  const amount = payload.amount / 100; // Convert paise to rupees

  // Update subscription status to active
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .update({
      razorpay_payment_id: paymentId,
      status: 'active',
      amount_paid: amount,
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_order_id', orderId)
    .select('user_id, plan, end_date')
    .single();

  if (error) {
    console.error('Error updating subscription after payment capture:', error);
    return;
  }

  if (subscription) {
    // Update user profile to premium tier
    await supabase
      .from('user_profiles')
      .update({
        subscription_tier: 'premium',
        subscription_end_date: subscription.end_date,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', subscription.user_id);

    // Create success notification
    await supabase.rpc('create_notification', {
      p_user_id: subscription.user_id,
      p_type: 'system',
      p_title: '🎉 Payment Successful!',
      p_message: 'Your premium subscription is now active. Enjoy unlimited access to all features!',
      p_link: '/dashboard',
      p_priority: 'high'
    });
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payload: any) {
  const orderId = payload.order_id;
  const errorDescription = payload.error_description || 'Payment processing failed';

  // Update subscription status to failed
  const { data: subscription } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_order_id', orderId)
    .select('user_id')
    .single();

  if (subscription) {
    // Create failure notification
    await supabase.rpc('create_notification', {
      p_user_id: subscription.user_id,
      p_type: 'system',
      p_title: 'Payment Failed',
      p_message: `Your payment could not be processed: ${errorDescription}. Please try again.`,
      p_link: '/pricing',
      p_priority: 'high'
    });
  }
}

/**
 * Handle payment refunded event
 */
async function handlePaymentRefunded(payload: any) {
  const paymentId = payload.id;
  const refundAmount = payload.amount_refunded / 100;

  // Find subscription by payment ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan')
    .eq('razorpay_payment_id', paymentId)
    .single();

  if (subscription) {
    // Update subscription status to cancelled
    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // Downgrade user back to free tier
    await supabase
      .from('user_profiles')
      .update({
        subscription_tier: 'free',
        subscription_end_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', subscription.user_id);

    // Create refund notification
    await supabase.rpc('create_notification', {
      p_user_id: subscription.user_id,
      p_type: 'system',
      p_title: 'Subscription Refunded',
      p_message: `Your subscription has been refunded (₹${refundAmount}). You now have access to the free tier.`,
      p_link: '/pricing',
      p_priority: 'high'
    });
  }
}

/**
 * Handle subscription activated event (for Razorpay subscription plans)
 */
async function handleSubscriptionActivated(payload: any) {
  const subscriptionId = payload.id;
  const customerId = payload.customer_id;

  // For Razorpay subscription plans with auto-renewal
  console.info('Razorpay subscription activated:', {
    subscriptionId,
    customerId,
    status: payload.status
  });

  // TODO: Implement if using Razorpay subscription plans
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(payload: any) {
  const subscriptionId = payload.id;

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_subscription_id', subscriptionId);

  console.info('Razorpay subscription cancelled:', subscriptionId);
}

/**
 * Handle subscription charged event (auto-renewal)
 */
async function handleSubscriptionCharged(payload: any) {
  const subscriptionId = payload.subscription_id;
  const paymentId = payload.payment_id;

  // Update subscription with latest payment
  await supabase
    .from('subscriptions')
    .update({
      razorpay_payment_id: paymentId,
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_subscription_id', subscriptionId);

  console.info('Razorpay subscription charged:', { subscriptionId, paymentId });
}

/**
 * Handle subscription completed event
 */
async function handleSubscriptionCompleted(payload: any) {
  const subscriptionId = payload.id;

  // Mark subscription as completed
  await supabase
    .from('subscriptions')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('razorpay_subscription_id', subscriptionId);

  console.info('Razorpay subscription completed:', subscriptionId);
}

// Prevent route caching
export const dynamic = 'force-dynamic';
