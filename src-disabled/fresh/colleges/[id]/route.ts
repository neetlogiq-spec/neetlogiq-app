import { NextRequest, NextResponse } from 'next/server';
import { getJSONDataService } from '@/lib/data/json-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'College ID is required' },
        { status: 400 }
      );
    }

    const jsonService = getJSONDataService();
    const college = await jsonService.getCollegeById(id);

    if (!college) {
      return NextResponse.json(
        { success: false, error: 'College not found' },
        { status: 404 }
      );
    }

    // Get courses offered by this college from trends data
    const collegeCourses = await jsonService.getCollegeCourses(id);

    // Get course count for this college
    const courseCount = await jsonService.getCollegeCourseCount(id);

    return NextResponse.json({ 
      success: true, 
      data: { 
        ...college, 
        course_count: courseCount,
        coursesOffered: collegeCourses
      } 
    });
  } catch (error: unknown) {
    console.error('College details API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}