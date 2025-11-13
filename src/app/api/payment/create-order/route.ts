/**
 * Create Razorpay Order API
 * POST /api/payment/create-order
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { razorpay, rupeesToPaise, generateReceiptId } from '@/lib/razorpay';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';

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
    const { planId } = body;

    if (!planId || (planId !== 'counseling' && planId !== 'premium')) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get plan details
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Check if user already has active subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, status, end_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingSub && new Date(existingSub.end_date) > new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have an active subscription',
          currentSubscription: existingSub
        },
        { status: 409 }
      );
    }

    // Create Razorpay order
    const receiptId = generateReceiptId(userId, planId);
    const amountInPaise = rupeesToPaise(plan.price);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        user_id: userId,
        plan_id: planId,
        plan_name: plan.name,
        email: session.user.email || ''
      }
    });

    // Store order in database (pending status)
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: planId,
        razorpay_order_id: order.id,
        status: 'pending',
        amount_paid: amountInPaise,
        start_date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription record:', error);
      throw error;
    }

    // Return order details for frontend
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: amountInPaise,
        currency: order.currency,
        receipt: order.receipt
      },
      subscription: {
        id: subscription.id,
        plan: planId,
        planName: plan.name,
        amount: plan.price
      },
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order'
      },
      { status: 500 }
    );
  }
}
