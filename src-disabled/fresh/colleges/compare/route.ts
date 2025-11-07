import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeIds = searchParams.get('ids')?.split(',') || [];

    if (collegeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'College IDs are required' },
        { status: 400 }
      );
    }

    const parquetService = getParquetService();
    const colleges = [];

    // Get each college
    for (const id of collegeIds) {
      const college = await parquetService.getCollegeById(id);
      if (college) {
        colleges.push(college);
      }
    }

    if (colleges.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No colleges found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        colleges,
        comparison: {
          total_colleges: colleges.length,
          states: [...new Set(colleges.map(c => c.state))],
          types: [...new Set(colleges.map(c => c.type))],
          management_types: [...new Set(colleges.map(c => c.management))]
        }
      }
    });
  } catch (error: any) {
    console.error('College comparison API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}