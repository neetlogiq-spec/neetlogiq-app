/**
 * Cutoffs API Route
 * GET /api/cutoffs - Search and filter cutoffs
<<<<<<< Updated upstream
=======
 * Uses pre-aggregated materialized view for consistent row counts
 *
 * Rate Limited: 100 requests/minute per IP
>>>>>>> Stashed changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params
    const filters = {
      // Partition key filter (e.g., AIQ-PG-2024)
      partitionKey: searchParams.get('partition_key') || searchParams.get('partitionKey') || undefined,
      // Text search across college/course names
      search: searchParams.get('search') || undefined,
      // Legacy source/level filters for backward compatibility
      source: searchParams.get('source') || searchParams.get('source_normalized') || undefined,
      level: searchParams.get('level') || searchParams.get('level_normalized') || undefined,
      // Legacy text-based filters
      collegeId: searchParams.get('collegeId') || undefined,
      courseId: searchParams.get('courseId') || undefined,
      year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      years: searchParams.get('years')?.split(',').map(Number).filter(Boolean),
      category: searchParams.get('category') || undefined,
      quota: searchParams.get('quota') || undefined,
      state: searchParams.get('state') || undefined,
      management: searchParams.get('management') || undefined,
      course: searchParams.get('course') || undefined,
      round: searchParams.get('round') ? Number(searchParams.get('round')) : undefined,
      // Master ID-based filters (preferred for exact matching)
      masterCollegeId: searchParams.get('masterCollegeId') || searchParams.get('master_college_id') || undefined,
      masterCourseId: searchParams.get('masterCourseId') || searchParams.get('master_course_id') || undefined,
      masterStateId: searchParams.get('masterStateId') || searchParams.get('master_state_id') || undefined,
      masterQuotaId: searchParams.get('masterQuotaId') || searchParams.get('master_quota_id') || undefined,
      masterCategoryId: searchParams.get('masterCategoryId') || searchParams.get('master_category_id') || undefined,
      // Rank range filters
      minRank: searchParams.get('minRank') ? Number(searchParams.get('minRank')) : undefined,
      maxRank: searchParams.get('maxRank') ? Number(searchParams.get('maxRank')) : undefined,
      // Pagination
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0
    };

    const service = getSupabaseDataService();
    
    // Use aggregated view for consistent row counts (100 requested = 100 returned)
    // Falls back to client-side aggregation if materialized view doesn't exist
    const result = await service.searchAggregatedCutoffs(filters);

    return NextResponse.json({
      success: true,
      ...result
    });
<<<<<<< Updated upstream
=======

    // Add cache headers for Vercel Edge caching
    jsonResponse.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
>>>>>>> Stashed changes
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
