import { NextRequest, NextResponse } from 'next/server';
import { getJSONDataService } from '@/lib/data/json-service';

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

    const jsonService = getJSONDataService();
    const offset = (page - 1) * limit;

    const result = await jsonService.getColleges({
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

    // Add course count to each college
    const collegesWithCourseCount = await Promise.all(
      result.data.map(async (college: any) => {
        const courseCount = await jsonService.getCollegeCourseCount(college.id);
        return {
          ...college,
          course_count: courseCount
        };
      })
    );

    return NextResponse.json({
      data: collegesWithCourseCount,
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

  } catch (error) {
    console.error('Error fetching colleges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}