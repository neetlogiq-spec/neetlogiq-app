import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteService } from '@/lib/database/sqlite-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || '';
    const state = searchParams.get('state') || '';
    const city = searchParams.get('city') || '';
    const type = searchParams.get('type') || '';
    const management = searchParams.get('management') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort_by = searchParams.get('sort_by') || 'name';
    const sort_order = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

    const sqliteService = getSQLiteService();
    const offset = (page - 1) * limit;

    const result = await sqliteService.getColleges({
      query,
      state,
      city,
      type,
      management,
      limit,
      offset,
      sort_by,
      sort_order
    });

    return NextResponse.json({
      success: true,
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
        state,
        city,
        type,
        management
      }
    });

  } catch (error: any) {
    console.error('Error searching colleges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}