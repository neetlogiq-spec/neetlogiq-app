import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteService } from '@/lib/database/sqlite-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    const sqliteService = getSQLiteService();
    const course = await sqliteService.getCourseById(id);

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Get counselling data for this course
    const counsellingData = await sqliteService.getCounsellingData({
      course_id: course.name,
      limit: 100 // Get recent counselling records
    });

    return NextResponse.json({ 
      success: true, 
      data: { 
        ...course, 
        counselling: counsellingData.data
      } 
    });
  } catch (error: any) {
    console.error('Course details API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}