import { NextRequest, NextResponse } from 'next/server';
import { getIdBasedDataService } from '@/services/id-based-data-service';

/**
 * GET /api/id-based-data/seat
 * Get enriched seat data with standardized names from master data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      college_id: searchParams.get('college_id') || undefined,
      course_id: searchParams.get('course_id') || undefined,
      state_id: searchParams.get('state_id') || undefined,
      year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    };

    const service = getIdBasedDataService();
    const result = await service.getSeatData(filters);

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      filters,
    });
  } catch (error) {
    console.error('Error fetching seat data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch seat data',
      },
      { status: 500 }
    );
  }
}


