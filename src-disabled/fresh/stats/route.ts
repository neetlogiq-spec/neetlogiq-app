import { NextRequest, NextResponse } from 'next/server';
import { getSQLiteService } from '@/lib/database/sqlite-service';

export async function GET(request: NextRequest) {
  try {
    const sqliteService = getSQLiteService();
    const stats = await sqliteService.getStats();

    return NextResponse.json({
      success: true,
      data: {
        colleges: stats.totalColleges,
        courses: stats.totalCourses,
        cutoffs: stats.totalCounsellingRecords,
        states: stats.statesCount,
        types: stats.typesCount,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}