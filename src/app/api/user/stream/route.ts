/**
 * User Stream Selection API
 *
 * POST /api/user/stream - Save and lock user stream selection
 * GET /api/user/stream - Get current user stream info
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/user/stream
 * Get current user's stream selection and lock status
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Get user profile with stream info
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('selected_stream, stream_locked, stream_locked_at, stream_change_requested, stream_change_request_date')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stream: {
        selectedStream: profile?.selected_stream || null,
        isLocked: profile?.stream_locked || false,
        lockedAt: profile?.stream_locked_at || null,
        changeRequested: profile?.stream_change_requested || false,
        changeRequestDate: profile?.stream_change_request_date || null
      }
    });
  } catch (error) {
    console.error('Error in GET /api/user/stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/stream
 * Save and lock user stream selection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stream } = body;

    // Validate stream value
    if (!stream || !['UG', 'PG_MEDICAL', 'PG_DENTAL'].includes(stream)) {
      return NextResponse.json(
        { error: 'Invalid stream value' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if stream is already locked
    const { data: currentProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('stream_locked, selected_stream')
      .eq('user_id', user.id)
      .single();

    if (checkError) {
      console.error('Error checking current profile:', checkError);
    }

    if (currentProfile?.stream_locked) {
      return NextResponse.json(
        {
          error: 'Stream is already locked',
          currentStream: currentProfile.selected_stream
        },
        { status: 400 }
      );
    }

    // Use the lock_user_stream function from migration
    const { data, error } = await supabase.rpc('lock_user_stream', {
      p_user_id: user.id,
      p_stream: stream
    });

    if (error) {
      console.error('Error locking user stream:', error);
      return NextResponse.json(
        { error: 'Failed to save stream selection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stream selection saved and locked successfully',
      stream: {
        selectedStream: stream,
        isLocked: true,
        lockedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in POST /api/user/stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
