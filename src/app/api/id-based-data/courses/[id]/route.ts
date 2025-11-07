import { NextRequest, NextResponse } from 'next/server';
import { getIdBasedDataService } from '@/services/id-based-data-service';

/**
 * GET /api/id-based-data/courses/[id]
 * Get combined data for a course (seats + counselling) with standardized names
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const courseId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;

    const service = getIdBasedDataService();
    const result = await service.getCourseData(courseId, year);

    return NextResponse.json({
      success: true,
      data: result,
      course_id: courseId,
      year,
    });
  } catch (error) {
    console.error('Error fetching course data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch course data',
      },
      { status: 500 }
    );
  }
}


