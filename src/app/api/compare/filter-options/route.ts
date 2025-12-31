import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

/**
 * GET /api/compare/filter-options - Get distinct filter values for compare page
 * 
 * Returns distinct values for:
 * - streams (from course_type column)
 * - managements (from management column)
 * - states (from state column with master_state_id)
 */
export async function GET(request: NextRequest) {
  try {
    const service = getSupabaseDataService();
    const filterOptions = await service.getCompareFilterOptions();

    return NextResponse.json({
      success: true,
      ...filterOptions
    });

  } catch (error) {
    console.error('Error fetching compare filter options:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
