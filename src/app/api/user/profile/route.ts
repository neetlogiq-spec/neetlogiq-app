/**
 * User Profile API Route
 * GET /api/user/profile - Get user profile
 * PATCH /api/user/profile - Update user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSubscription } from '@/lib/supabase';

/**
 * GET - Fetch user profile
 */
export async function GET(request: NextRequest) {
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

    // Fetch profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Get subscription info
    const subscriptionInfo = await getUserSubscription(userId);

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        ...subscriptionInfo
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update user profile
 */
export async function PATCH(request: NextRequest) {
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
      neet_rank,
      category,
      state,
      selected_stream,
      preferences,
      onboarding_completed
    } = body;

    // Build update object
    const updates: any = {};
    if (neet_rank !== undefined) updates.neet_rank = neet_rank;
    if (category !== undefined) updates.category = category;
    if (state !== undefined) updates.state = state;
    if (selected_stream !== undefined) updates.selected_stream = selected_stream;
    if (preferences !== undefined) updates.preferences = preferences;
    if (onboarding_completed !== undefined) updates.onboarding_completed = onboarding_completed;

    // Update profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile'
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Complete onboarding
 */
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
      neet_rank,
      category,
      state,
      selected_stream,
      preferences
    } = body;

    // Update profile with onboarding data
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        neet_rank,
        category,
        state,
        selected_stream,
        preferences: preferences || {},
        onboarding_completed: true
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: profile,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete onboarding'
      },
      { status: 500 }
    );
  }
}
