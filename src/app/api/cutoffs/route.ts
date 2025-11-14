/**
 * Cutoffs API Route
 * GET /api/cutoffs - Search and filter cutoffs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params
    const filters = {
      collegeId: searchParams.get('collegeId') || undefined,
      courseId: searchParams.get('courseId') || undefined,
      year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      years: searchParams.get('years')?.split(',').map(Number).filter(Boolean),
      category: searchParams.get('category') || undefined,
      quota: searchParams.get('quota') || undefined,
      state: searchParams.get('state') || undefined,
      round: searchParams.get('round') ? Number(searchParams.get('round')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0
    };

    const service = getSupabaseDataService();
    const result = await service.searchCutoffs(filters);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in cutoffs API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cutoffs'
      },
      { status: 500 }
    );
  }
}
