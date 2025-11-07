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
    const colleges = await sqliteService.getCourseColleges(id);

    return NextResponse.json({ 
      success: true, 
      data: colleges
    });
  } catch (error: unknown) {
    console.error('Course colleges API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}






