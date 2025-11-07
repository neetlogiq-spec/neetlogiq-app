import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const parquetService = getParquetService();
    const stats = await parquetService.getStats();

    // Get additional analytics
    const collegesResult = await parquetService.getColleges({ limit: 10000 });
    const coursesResult = await parquetService.getCourses({ limit: 10000 });
    const counsellingResult = await parquetService.getCounsellingData({ limit: 10000 });

    // Calculate additional metrics
    const states = [...new Set(collegesResult.data.map(c => c.state))].length;
    const types = [...new Set(collegesResult.data.map(c => c.type))].length;
    const streams = [...new Set(coursesResult.data.map(c => c.stream))].length;
    const categories = [...new Set(counsellingResult.data.map(c => c.category))].length;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          colleges: stats.colleges,
          courses: stats.courses,
          cutoffs: stats.cutoffs,
          years: stats.years
        },
        breakdown: {
          states,
          college_types: types,
          course_streams: streams,
          categories
        },
        last_updated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Analytics overview API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}