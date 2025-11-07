import { NextRequest, NextResponse } from 'next/server';
import { getSimpleParquetService } from '@/lib/database/simple-parquet-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || '';
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const category = searchParams.get('category') || '';
    const quota = searchParams.get('quota') || '';
    const college_id = searchParams.get('college_id') || '';
    const course_id = searchParams.get('course_id') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort_by = searchParams.get('sort_by') || 'allIndiaRank';
    const sort_order = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

    const parquetService = getSimpleParquetService();
    const offset = (page - 1) * limit;

    const result = await parquetService.getCounsellingData({
      query,
      year,
      category,
      quota,
      college_id,
      course_id,
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
        year,
        category,
        quota,
        college_id,
        course_id
      }
    });

  } catch (error) {
    console.error('Error fetching counselling data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}