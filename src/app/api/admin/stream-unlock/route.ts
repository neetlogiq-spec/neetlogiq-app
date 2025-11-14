/**
 * Admin Stream Unlock API
 *
 * POST /api/admin/stream-unlock - Unlock a user's stream selection (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * POST /api/admin/stream-unlock
 * Unlock a user's stream selection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, reason } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id' },
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
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if user has admin privileges
    const adminCheck = await requireAdmin(adminUser.id);
    if (!adminCheck.allowed) {
      return NextResponse.json(
        { error: adminCheck.error || 'Admin access required' },
        { status: 403 }
      );
    }

    // Unlock the stream (set stream_locked to false, clear lock timestamp)
    const { error: unlockError } = await supabase
      .from('user_profiles')
      .update({
        stream_locked: false,
        stream_locked_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id);

    if (unlockError) {
      return NextResponse.json(
        { error: unlockError.message },
        { status: 500 }
      );
    }

    // Log the unlock in audit log
    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'stream_unlock',
      target_user_id: user_id,
      details: {
        reason: reason || 'No reason provided',
        timestamp: new Date().toISOString()
      }
    });

    // Send notification to user
    await supabase.rpc('create_notification', {
      p_user_id: user_id,
      p_type: 'system',
      p_title: 'Stream Selection Unlocked',
      p_message: 'Your stream selection has been unlocked by an admin. You can now change your stream selection.',
      p_priority: 'high'
    });

    return NextResponse.json({
      message: 'Stream unlocked successfully',
      success: true
    });
  } catch (error) {
    console.error('Error unlocking stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
