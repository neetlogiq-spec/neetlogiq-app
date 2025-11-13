/**
 * Admin Reject Stream Change Request API
 *
 * POST /api/admin/stream-changes/[id]/reject - Reject a stream change request
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isDeveloperAccount } from '@/contexts/StreamContext';
import { sendStreamChangeRejectedEmail } from '@/lib/email';

/**
 * POST /api/admin/stream-changes/[id]/reject
 * Reject a stream change request (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { adminNotes } = body;
    const { id: requestId } = params;

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

    // Check if user is admin (developer account)
    if (!isDeveloperAccount(user.email)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get the stream change request
    const { data: changeRequest, error: requestError } = await supabase
      .from('stream_change_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !changeRequest) {
      return NextResponse.json(
        { error: 'Stream change request not found' },
        { status: 404 }
      );
    }

    if (changeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      );
    }

    // Update request status to rejected
    const { error: updateError } = await supabase
      .from('stream_change_requests')
      .update({
        status: 'rejected',
        admin_user_id: user.id,
        admin_notes: adminNotes || null,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating stream change request:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject stream change request' },
        { status: 500 }
      );
    }

    // Update user profile to clear change request flags
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        stream_change_requested: false,
        stream_change_request_date: null,
        stream_change_request_reason: null
      })
      .eq('user_id', changeRequest.user_id);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }

    // Send email notification to user
    try {
      await sendStreamChangeRejectedEmail(
        changeRequest.user_id,
        changeRequest.requested_stream,
        adminNotes
      );
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Stream change request rejected successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/admin/stream-changes/[id]/reject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
