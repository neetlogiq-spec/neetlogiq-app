import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const parquetService = getParquetService();
    
    // Get all data for distribution analysis
    const collegesResult = await parquetService.getColleges({ limit: 10000 });
    const coursesResult = await parquetService.getCourses({ limit: 10000 });
    const counsellingResult = await parquetService.getCounsellingData({ limit: 10000 });

    // Calculate distributions
    const stateDistribution: { [key: string]: number } = {};
    const typeDistribution: { [key: string]: number } = {};
    const managementDistribution: { [key: string]: number } = {};
    const streamDistribution: { [key: string]: number } = {};

    // College distributions
    collegesResult.data.forEach(college => {
      stateDistribution[college.state] = (stateDistribution[college.state] || 0) + 1;
      typeDistribution[college.type] = (typeDistribution[college.type] || 0) + 1;
      managementDistribution[college.management] = (managementDistribution[college.management] || 0) + 1;
    });

    // Course distributions
    coursesResult.data.forEach(course => {
      streamDistribution[course.stream] = (streamDistribution[course.stream] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        states: Object.entries(stateDistribution).map(([state, count]) => ({
          state,
          count
        })),
        types: Object.entries(typeDistribution).map(([type, count]) => ({
          type,
          count
        })),
        management: Object.entries(managementDistribution).map(([management, count]) => ({
          management,
          count
        })),
        streams: Object.entries(streamDistribution).map(([stream, count]) => ({
          stream,
          count
        })),
        total: {
          colleges: collegesResult.total,
          courses: coursesResult.total,
          cutoffs: counsellingResult.total
        }
      }
    });
  } catch (error: any) {
    console.error('Analytics distribution API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}