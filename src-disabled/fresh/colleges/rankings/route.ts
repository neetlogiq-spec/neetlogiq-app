import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort_by = searchParams.get('sort_by') || 'name';
    const sort_order = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

    const parquetService = getParquetService();
    
    // Get colleges with basic ranking (by name for now)
    const result = await parquetService.getColleges({
      limit,
      sort_by,
      sort_order
    });

    // Add ranking position
    const rankedColleges = result.data.map((college, index) => ({
      ...college,
      rank: index + 1
    }));

    return NextResponse.json({
      success: true,
      data: rankedColleges,
      pagination: {
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error: any) {
    console.error('College rankings API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}