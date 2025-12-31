import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

/**
 * GET /api/compare/seat-data - Get detailed seat data for multiple colleges
 * 
 * Query params:
 * - collegeIds: Comma-separated list of master_college_ids
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const collegeIdsParam = searchParams.get('collegeIds');
    
    if (!collegeIdsParam) {
      return NextResponse.json(
        { success: false, error: 'collegeIds parameter is required' },
        { status: 400 }
      );
    }

    const collegeIds = collegeIdsParam.split(',').filter(id => id.trim());
    
    if (collegeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one college ID is required' },
        { status: 400 }
      );
    }

    if (collegeIds.length > 4) {
      return NextResponse.json(
        { success: false, error: 'Maximum 4 colleges can be compared at once' },
        { status: 400 }
      );
    }

    const service = getSupabaseDataService();
    const colleges = await service.getCollegesWithSeatData(collegeIds);

    return NextResponse.json({
      success: true,
      colleges,
      count: colleges.length
    });

  } catch (error) {
    console.error('Error fetching seat data for compare:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch seat data' },
      { status: 500 }
    );
  }
}
