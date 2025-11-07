import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const parquetService = getParquetService();
    
    // Get all courses to extract filter options
    const coursesResult = await parquetService.getCourses({ limit: 10000 });
    const courses = coursesResult.data;

    // Extract unique values for filters
    const streams = [...new Set(courses.map(c => c.stream))].filter(Boolean);
    const branches = [...new Set(courses.map(c => c.branch))].filter(Boolean);
    const degreeTypes = [...new Set(courses.map(c => c.degree_type))].filter(Boolean);

    return NextResponse.json({
      success: true,
      data: {
        streams: streams.map(s => ({ value: s, label: s })),
        branches: branches.map(b => ({ value: b, label: b })),
        degree_types: degreeTypes.map(d => ({ value: d, label: d }))
      }
    });
  } catch (error: any) {
    console.error('Course filters API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}