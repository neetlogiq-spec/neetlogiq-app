import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type') || '';
    const state = searchParams.get('state') || '';

    const parquetService = getParquetService();
    
    // Get top colleges based on criteria
    const result = await parquetService.getColleges({
      type,
      state,
      limit,
      sort_by: 'name',
      sort_order: 'asc'
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        limit,
        total: result.total
      },
      filters: {
        type,
        state
      }
    });
  } catch (error: any) {
    console.error('Top colleges API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}