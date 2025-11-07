import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteService } from '@/lib/database/sqlite-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || '';
    const stream = searchParams.get('stream') || '';
    const branch = searchParams.get('branch') || '';
    const degree_type = searchParams.get('degree_type') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort_by = searchParams.get('sort_by') || 'name';
    const sort_order = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

    const sqliteService = getSQLiteService();
    const offset = (page - 1) * limit;

    const result = await sqliteService.getCourses({
      query,
      stream,
      branch,
      degree_type,
      limit,
      offset,
      sort_by,
      sort_order
    });

    return NextResponse.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
        has_next: (page * limit) < result.total,
        has_prev: page > 1
      },
      filters: {
        query,
        stream,
        branch,
        degree_type
      }
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}