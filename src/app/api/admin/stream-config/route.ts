/**
 * Admin Stream Configuration API
 *
 * GET /api/admin/stream-config - Get all stream configurations
 * POST /api/admin/stream-config - Update stream configuration (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/stream-config
 * Get all stream configurations
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('stream_config')
      .select('*')
      .order('stream_id');

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching stream config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/stream-config
 * Update stream configuration (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stream_id, config } = body;

    if (!stream_id || !config) {
      return NextResponse.json(
        { error: 'Missing stream_id or config' },
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

    // Check if user has admin privileges
    const adminCheck = await requireAdmin(user.id);
    if (!adminCheck.allowed) {
      return NextResponse.json(
        { error: adminCheck.error || 'Admin access required' },
        { status: 403 }
      );
    }

    // Update stream config using the database function
    const { data, error } = await supabase.rpc('update_stream_config', {
      p_stream_id: stream_id,
      p_config: config,
      p_admin_user_id: user.id
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Fetch updated config
    const { data: updatedConfig } = await supabase
      .from('stream_config')
      .select('*')
      .eq('stream_id', stream_id)
      .single();

    return NextResponse.json({
      message: 'Stream configuration updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating stream config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
