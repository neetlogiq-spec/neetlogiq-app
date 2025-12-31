/**
 * Trends API Route
 * GET /api/trends - Fetch trend data for comparing colleges/years
 * Uses aggregated_cutoffs materialized view (same as Cutoffs API)
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params (matching Cutoffs API pattern)
    const filters = {
      // Partition key filter (e.g., AIQ-PG-2024)
      partitionKey: searchParams.get('partition_key') || searchParams.get('partitionKey') || undefined,
      // Master ID-based filters (preferred for exact matching)
      masterCollegeId: searchParams.get('masterCollegeId') || searchParams.get('master_college_id') || undefined,
      masterCourseId: searchParams.get('masterCourseId') || searchParams.get('master_course_id') || undefined,
      masterStateId: searchParams.get('masterStateId') || searchParams.get('master_state_id') || undefined,
      masterQuotaId: searchParams.get('masterQuotaId') || searchParams.get('master_quota_id') || undefined,
      masterCategoryId: searchParams.get('masterCategoryId') || searchParams.get('master_category_id') || undefined,
      // Legacy text-based filters
      state: searchParams.get('state') || undefined,
      category: searchParams.get('category') || undefined,
      quota: searchParams.get('quota') || undefined,
      course: searchParams.get('course') || undefined,
      // Year and round filters
      year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      years: searchParams.get('years')?.split(',').map(Number).filter(Boolean),
      round: searchParams.get('round') ? Number(searchParams.get('round')) : undefined,
      rounds: searchParams.get('rounds')?.split(',').map(Number).filter(Boolean),
      // Pagination
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 100,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0
    };

    const service = getSupabaseDataService();
    
    // Use the same aggregated view query pattern as Cutoffs API
    const result = await service.getTrendData(filters);

    const jsonResponse = NextResponse.json({
      success: true,
      ...result
    });

    // Add cache headers for Vercel Edge caching
    jsonResponse.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Error in trends API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trend data'
      },
      { status: 500 }
    );
  }
}
