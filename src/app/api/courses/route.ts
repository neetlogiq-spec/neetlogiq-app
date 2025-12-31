/**
 * Courses API Route
 * GET /api/courses - Search and filter courses
 */

import { NextRequest, NextResponse } from 'next/server';
<<<<<<< Updated upstream
import { supabaseAdmin } from '@/lib/supabase';
=======
import { createClient } from '@supabase/supabase-js';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
>>>>>>> Stashed changes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

<<<<<<< Updated upstream
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
=======
    // Parse search parameters
    const query = searchParams.get('query') || searchParams.get('q') || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 24, 100); // Default to 24 to match client
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    
    // Calculate offset if not explicitly provided
    const offset = searchParams.has('offset') 
      ? Number(searchParams.get('offset')) 
      : (page - 1) * limit;

    // Parse filters
    const streams = searchParams.get('streams')?.split(',').filter(Boolean) || 
                   (searchParams.get('stream') ? [searchParams.get('stream')!] : undefined);
    const branches = searchParams.get('branches')?.split(',').filter(Boolean) || 
                    (searchParams.get('branch') ? [searchParams.get('branch')!] : undefined);
    const courseType = searchParams.get('courseType') || undefined;

    // Parse sorting
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const service = getSupabaseDataService();
    
    // Use service to search and aggregate courses from seat_data
    const result = await service.searchCourses({
      query,
      streams,
      branches,
      courseType,
      limit,
      offset
    });
>>>>>>> Stashed changes

    return NextResponse.json({
      success: true,
<<<<<<< Updated upstream
      data: data || [],
      pagination: {
        page,
        limit,
        totalItems: count || 0,
        totalPages,
        hasNext: page < totalPages
      }
=======
      data: result.data || [],
      pagination: {
        total: result.count || 0,
        page,
        limit: result.pageSize,
        totalPages: result.totalPages,
        hasMore: result.page < result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrevious: result.page > 1,
      },
>>>>>>> Stashed changes
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

