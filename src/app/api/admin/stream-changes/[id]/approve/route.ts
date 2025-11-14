/**
 * Admin Approve Stream Change Request API
 *
 * POST /api/admin/stream-changes/[id]/approve - Approve a stream change request
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isDeveloperAccount } from '@/contexts/StreamContext';
import { sendStreamChangeApprovedEmail } from '@/lib/email';

/**
 * POST /api/admin/stream-changes/[id]/approve
 * Approve a stream change request and update user stream (admin only)
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

    // Use the admin_change_user_stream function from migration
    const { error: changeError } = await supabase.rpc('admin_change_user_stream', {
      p_user_id: changeRequest.user_id,
      p_new_stream: changeRequest.requested_stream,
      p_admin_user_id: user.id,
      p_admin_notes: adminNotes || null
    });

    if (changeError) {
      console.error('Error changing user stream:', changeError);
      return NextResponse.json(
        { error: 'Failed to change user stream' },
        { status: 500 }
      );
    }

    // Send email notification to user
    try {
      await sendStreamChangeApprovedEmail(
        changeRequest.user_id,
        changeRequest.current_stream,
        changeRequest.requested_stream,
        adminNotes
      );
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Stream change request approved successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/admin/stream-changes/[id]/approve:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
