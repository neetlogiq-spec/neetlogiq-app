/**
 * Colleges API Route
 * GET /api/colleges - Search and filter colleges
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : (page - 1) * limit;
    
    const filters = {
      query: searchParams.get('q') || undefined,
      states: searchParams.get('states')?.split(',').filter(Boolean),
      stateIds: searchParams.get('stateIds')?.split(',').filter(Boolean),
      stream: searchParams.get('stream')?.split(',').filter(Boolean) || undefined, // MED, DEN, DNB (can be multiple)
      managementTypes: searchParams.get('management')?.split(',').filter(Boolean) as any,
      niacRating: searchParams.get('rating')?.split(',').filter(Boolean) as any,
      courseIds: searchParams.get('courseIds')?.split(',').filter(Boolean),
      nfrfRankMin: searchParams.get('rankMin') ? Number(searchParams.get('rankMin')) : undefined,
      nfrfRankMax: searchParams.get('rankMax') ? Number(searchParams.get('rankMax')) : undefined,
      latitude: searchParams.get('lat') ? Number(searchParams.get('lat')) : undefined,
      longitude: searchParams.get('lng') ? Number(searchParams.get('lng')) : undefined,
      radiusKm: searchParams.get('radius') ? Number(searchParams.get('radius')) : undefined,
      limit,
      offset
    };

    const service = getSupabaseDataService();
    const result = await service.searchColleges(filters);

<<<<<<< Updated upstream
    return NextResponse.json({
=======
    // Transform response to include pagination wrapper for frontend
    const jsonResponse = NextResponse.json({
>>>>>>> Stashed changes
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.pageSize,
        total: result.count,
        total_pages: result.totalPages,
        has_next: result.page < result.totalPages
      }
    });
  } catch (error) {
    console.error('Error in colleges API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch colleges'
      },
      { status: 500 }
    );
  }
}
