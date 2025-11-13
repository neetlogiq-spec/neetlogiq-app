/**
 * Verify Razorpay Payment API Route
 * POST /api/payments/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { RAZORPAY_CONFIG } from '@/config/premium';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billingCycle,
      userId,
      amount
    } = body;

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_CONFIG.keySecret)
      .update(text)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Calculate subscription end date
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create subscription record
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_type: planId,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        razorpay_subscription_id: razorpay_payment_id,
        amount: amount / 100, // Convert from paise to rupees
        currency: 'INR',
        billing_cycle: billingCycle,
        auto_renew: true
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription:', subError);
      return NextResponse.json(
        { success: false, error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Create payment history record
    const { error: paymentError } = await supabase
      .from('payment_history')
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        razorpay_payment_id,
        razorpay_order_id,
        amount: amount / 100,
        currency: 'INR',
        status: 'completed',
        description: `${planId} subscription - ${billingCycle}`
      });

    if (paymentError) {
      console.error('Error creating payment history:', paymentError);
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: 'Payment verified and subscription activated successfully'
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
