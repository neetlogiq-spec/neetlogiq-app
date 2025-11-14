/**
 * Admin Audit Logs API
 * Read-only access to audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/admin-middleware';

/**
 * GET - Fetch audit logs with filters
 */
export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resource_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('admin_audit_log')
      .select(`
        id,
        action,
        resource_type,
        resource_id,
        changes,
        created_at,
        ip_address,
        user_agent,
        user_id
      `, { count: 'exact' });

    // Filters
    if (action) query = query.eq('action', action);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) throw error;

    // Fetch user emails for each log
    const userIds = [...new Set(logs?.map(log => log.user_id) || [])];
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();

    const userEmailMap = new Map(
      users.users.map(user => [user.id, user.email])
    );

    // Add user emails to logs
    const logsWithEmails = logs?.map(log => ({
      ...log,
      user_email: userEmailMap.get(log.user_id) || 'Unknown User',
      user_id: undefined // Remove user_id from response
    })) || [];

    return NextResponse.json({
      success: true,
      data: logsWithEmails,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
