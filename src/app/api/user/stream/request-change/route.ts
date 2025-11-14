/**
 * Stream Change Request API
 *
 * POST /api/user/stream/request-change - Submit a request to change locked stream
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/user/stream/request-change
 * Submit a request to change locked stream
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestedStream, reason } = body;

    // Validate inputs
    if (!requestedStream || !['UG', 'PG_MEDICAL', 'PG_DENTAL'].includes(requestedStream)) {
      return NextResponse.json(
        { error: 'Invalid stream value' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a detailed reason (at least 10 characters)' },
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

    // Check if user has a locked stream
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('selected_stream, stream_locked, stream_change_requested')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!profile?.stream_locked) {
      return NextResponse.json(
        { error: 'Stream is not locked. You can change it directly.' },
        { status: 400 }
      );
    }

    if (profile?.stream_change_requested) {
      return NextResponse.json(
        { error: 'You already have a pending stream change request' },
        { status: 400 }
      );
    }

    if (profile?.selected_stream === requestedStream) {
      return NextResponse.json(
        { error: 'Requested stream is the same as your current stream' },
        { status: 400 }
      );
    }

    // Use the request_stream_change function from migration
    const { data: requestId, error } = await supabase.rpc('request_stream_change', {
      p_user_id: user.id,
      p_requested_stream: requestedStream,
      p_reason: reason.trim()
    });

    if (error) {
      console.error('Error creating stream change request:', error);
      return NextResponse.json(
        { error: 'Failed to submit stream change request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stream change request submitted successfully',
      requestId
    });
  } catch (error) {
    console.error('Error in POST /api/user/stream/request-change:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
