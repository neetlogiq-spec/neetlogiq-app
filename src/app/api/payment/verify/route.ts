/**
 * Verify Razorpay Payment API
 * POST /api/payment/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { verifyPaymentSignature, calculateSubscriptionEndDate } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Get subscription record
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('user_id', userId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = calculateSubscriptionEndDate(
      subscription.plan as 'counseling' | 'premium',
      startDate
    );

    // Update subscription status to active
    const { data: updatedSub, error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        razorpay_payment_id,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      throw updateError;
    }

    // Update user profile with subscription tier
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        subscription_tier: subscription.plan,
        subscription_end_date: endDate.toISOString()
      })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'subscription_activated',
        title: 'Subscription Activated! 🎉',
        message: `Your ${subscription.plan === 'counseling' ? 'Counseling Season Pass' : 'Premium Annual'} subscription is now active.`,
        data: {
          plan: subscription.plan,
          end_date: endDate.toISOString()
        }
      });

    // Log activity
    await supabaseAdmin
      .from('user_activity')
      .insert({
        user_id: userId,
        action: 'subscription_purchased',
        details: {
          plan: subscription.plan,
          amount: subscription.amount_paid,
          payment_id: razorpay_payment_id
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      subscription: {
        id: updatedSub.id,
        plan: updatedSub.plan,
        status: updatedSub.status,
        startDate: updatedSub.start_date,
        endDate: updatedSub.end_date
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify payment'
      },
      { status: 500 }
    );
  }
}
