/**
 * Admin Gift Subscription API
 *
 * POST /api/admin/subscriptions/gift - Manually activate subscription for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isDeveloperAccount } from '@/contexts/StreamContext';

/**
 * POST /api/admin/subscriptions/gift
 * Manually activate/gift a subscription to a user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userEmail,
      planType,
      billingCycle,
      customDuration, // in days
      reason
    } = body;

    // Validate inputs
    if (!userEmail || !planType || (!billingCycle && !customDuration)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['free', 'premium'].includes(planType)) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // Get authenticated admin user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if user is admin (developer account)
    if (!isDeveloperAccount(adminUser.email)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Find user by email using Supabase Auth Admin API
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const targetUser = users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate subscription duration
    let durationDays = customDuration;
    if (!customDuration) {
      const durations: Record<string, number> = {
        'monthly': 30,
        'quarterly': 90,
        'halfYearly': 180,
        'yearly': 365
      };
      durationDays = durations[billingCycle] || 365;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    // Cancel any existing active subscriptions
    const { error: cancelError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', targetUser.id)
      .eq('status', 'active');

    if (cancelError) {
      console.error('Error cancelling existing subscriptions:', cancelError);
    }

    // Create new subscription record
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: targetUser.id,
        plan_type: planType,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        razorpay_subscription_id: `GIFT-${Date.now()}`, // Special ID for gifted subscriptions
        amount: 0, // Free gift
        currency: 'INR',
        billing_cycle: billingCycle || 'custom',
        auto_renew: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Update user profile tier
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: targetUser.id,
        subscription_tier: planType,
        subscription_end_date: endDate.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (profileError) {
      console.error('Error updating user profile:', profileError);
      // Don't fail the request, subscription is already created
    }

    // Create payment history record for tracking
    const { error: paymentError } = await supabase
      .from('payment_history')
      .insert({
        user_id: targetUser.id,
        subscription_id: subscription.id,
        razorpay_payment_id: `GIFT-${Date.now()}`,
        razorpay_order_id: `ADMIN-GIFT-${adminUser.id}`,
        amount: 0,
        currency: 'INR',
        status: 'completed',
        description: `Admin gifted ${planType} subscription - ${reason || 'No reason provided'}`
      });

    if (paymentError) {
      console.error('Error creating payment history:', paymentError);
    }

    // Create notification for user
    try {
      await supabase.rpc('create_notification', {
        p_user_id: targetUser.id,
        p_type: 'system',
        p_title: '🎁 You received a Premium subscription!',
        p_message: `Congratulations! You've been gifted ${durationDays} days of ${planType} access. Enjoy all premium features!`,
        p_link: '/pricing',
        p_priority: 'high'
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully gifted ${planType} subscription to ${userEmail}`,
      subscription: {
        id: subscription.id,
        planType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationDays
      }
    });
  } catch (error) {
    console.error('Error in POST /api/admin/subscriptions/gift:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
