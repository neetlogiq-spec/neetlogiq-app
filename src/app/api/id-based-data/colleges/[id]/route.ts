import { NextRequest, NextResponse } from 'next/server';
import { getIdBasedDataService } from '@/services/id-based-data-service';

/**
 * GET /api/id-based-data/colleges/[id]
 * Get combined data for a college (seats + counselling) with standardized names
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const collegeId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;

    const service = getIdBasedDataService();
    const result = await service.getCollegeData(collegeId, year);

    return NextResponse.json({
      success: true,
      data: result,
      college_id: collegeId,
      year,
    });
  } catch (error) {
    console.error('Error fetching college data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch college data',
      },
      { status: 500 }
    );
  }
}


