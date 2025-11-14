/**
 * Courses API Route
 * GET /api/courses - Search and filter courses
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const offset = (page - 1) * limit;
    const stream = searchParams.get('stream');
    const branch = searchParams.get('branch');
    const search = searchParams.get('search') || searchParams.get('q');

    // Build query
    let query = supabaseAdmin
      .from('courses')
      .select('*', { count: 'exact' });

    // Apply filters
    if (stream) {
      query = query.eq('stream', stream);
    }
    if (branch) {
      query = query.eq('branch', branch);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,branch.ilike.%${search}%`);
    }

    // Apply pagination and ordering
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching courses:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        totalItems: count || 0,
        totalPages,
        hasNext: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error in courses API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch courses'
      },
      { status: 500 }
    );
  }
}

