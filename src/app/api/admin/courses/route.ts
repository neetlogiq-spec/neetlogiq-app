/**
 * Admin Courses API
 * CRUD operations for courses
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * GET - List courses with pagination and search
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
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('courses')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Pagination
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new course
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
    const { name, description, duration_years, degree_type } = body;

    // Validation
    if (!name || !degree_type) {
      return NextResponse.json(
        { success: false, error: 'Name and degree type are required' },
        { status: 400 }
      );
    }

    // Insert course
    const { data: newCourse, error } = await supabaseAdmin
      .from('courses')
      .insert({
        name,
        description,
        duration_years,
        degree_type
      })
      .select()
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      authCheck.userId!,
      'CREATE',
      'course',
      newCourse.id,
      { name, description, duration_years, degree_type }
    );

    return NextResponse.json({
      success: true,
      data: newCourse
    });

  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create course' },
      { status: 500 }
    );
  }
}
