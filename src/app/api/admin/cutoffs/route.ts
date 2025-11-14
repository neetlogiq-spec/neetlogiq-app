/**
 * Admin Cutoffs API
 * CRUD operations for cutoff data (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * GET - List cutoffs with filters
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
    const collegeId = searchParams.get('collegeId');
    const year = searchParams.get('year');
    const category = searchParams.get('category');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('cutoffs')
      .select(`
        *,
        colleges:college_id (id, name, city, state),
        courses:course_id (id, name)
      `, { count: 'exact' });

    // Filters
    if (collegeId) query = query.eq('college_id', collegeId);
    if (year) query = query.eq('year', parseInt(year));
    if (category) query = query.eq('category', category);

    // Pagination
    query = query
      .order('year', { ascending: false })
      .order('closing_rank', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching cutoffs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cutoffs' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new cutoff record
 */
export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      college_id,
      course_id,
      year,
      round,
      category,
      quota,
      state,
      opening_rank,
      closing_rank,
      seats,
      seats_filled,
      source,
      level
    } = body;

    // Validation
    if (!college_id || !course_id || !year) {
      return NextResponse.json(
        { success: false, error: 'College, course, and year are required' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from('cutoffs')
      .select('id')
      .eq('college_id', college_id)
      .eq('course_id', course_id)
      .eq('year', year)
      .eq('round', round || 1)
      .eq('category', category || 'GENERAL')
      .eq('quota', quota || 'All India')
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Cutoff record already exists for this combination' },
        { status: 409 }
      );
    }

    const { data: cutoff, error } = await supabaseAdmin
      .from('cutoffs')
      .insert({
        college_id,
        course_id,
        year,
        round: round || 1,
        category: category || 'GENERAL',
        quota: quota || 'All India',
        state,
        opening_rank,
        closing_rank,
        seats,
        seats_filled,
        metadata: {
          source: source || 'manual',
          level: level || 'UG'
        }
      })
      .select()
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      authCheck.userId!,
      'CREATE',
      'cutoff',
      cutoff.id,
      { college_id, course_id, year, closing_rank }
    );

    return NextResponse.json({
      success: true,
      data: cutoff,
      message: 'Cutoff created successfully'
    });

  } catch (error) {
    console.error('Error creating cutoff:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create cutoff' },
      { status: 500 }
    );
  }
}
