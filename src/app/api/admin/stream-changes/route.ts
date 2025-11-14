/**
 * Admin Stream Change Requests API
 *
 * GET /api/admin/stream-changes - Get all stream change requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isDeveloperAccount } from '@/contexts/StreamContext';

/**
 * GET /api/admin/stream-changes
 * Get all stream change requests (admin only)
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

    // Check if user is admin (developer account)
    if (!isDeveloperAccount(user.email)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get filter parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

    // Fetch stream change requests with user info
    let query = supabase
      .from('stream_change_requests')
      .select(`
        *,
        user_profiles!inner(
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error('Error fetching stream change requests:', requestsError);
      return NextResponse.json(
        { error: 'Failed to fetch stream change requests' },
        { status: 500 }
      );
    }

    // Get user emails for each request
    const userIds = requests?.map(r => r.user_id) || [];
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    const userEmailMap: Record<string, string> = {};
    users?.forEach(u => {
      if (userIds.includes(u.id)) {
        userEmailMap[u.id] = u.email || '';
      }
    });

    // Enhance requests with user email
    const enhancedRequests = requests?.map(r => ({
      ...r,
      user_email: userEmailMap[r.user_id] || 'Unknown'
    }));

    return NextResponse.json({
      success: true,
      requests: enhancedRequests || []
    });
  } catch (error) {
    console.error('Error in GET /api/admin/stream-changes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
