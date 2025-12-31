/**
 * Rank Journey API Route
 * GET /api/rank-tracking/[rank] - Get complete journey for a specific rank
 *
 * Query Parameters:
 * - year: number (required)
 * - category: string (required) - General, OBC, SC, ST, EWS
 * - quota: string (required) - All India, State, etc.
 * - source_id: string (required) - SRC_AIQ, SRC_KEA, SRC_MCC, etc.
 * - level_id: string (required) - LVL_UG, LVL_PG, LVL_DEN, etc.
 *
 * Example: GET /api/rank-tracking/123?year=2024&category=General&quota=All%20India&source_id=SRC_KEA&level_id=LVL_UG
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRankTrackingService } from '@/services/rank-tracking-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rank: string }> }
) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json(
        { success: false, error: rateLimitResult.error },
        { status: 429 }
      ),
      rateLimitResult
    );
  }

  try {
    // In Next.js 16+, params is a Promise that needs to be awaited
    const { rank: rankParam } = await params;
    const rank = parseInt(rankParam);

    if (isNaN(rank) || rank < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid rank parameter' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Required parameters
    const yearParam = searchParams.get('year');
    const category = searchParams.get('category');
    const quota = searchParams.get('quota');
    const sourceId = searchParams.get('source_id');
    const levelId = searchParams.get('level_id');

    if (!yearParam || !category || !quota || !sourceId || !levelId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: year, category, quota, source_id, level_id',
        },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);

    if (isNaN(year) || year < 2020 || year > 2030) {
      return NextResponse.json(
        { success: false, error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate source_id
    const validSources = ['SRC_AIQ', 'SRC_KEA', 'SRC_STATE', 'SRC_MCC', 'SRC_TN', 'SRC_MH', 'SRC_UP', 'SRC_DL'];
    if (!validSources.includes(sourceId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid source_id. Must be one of: ${validSources.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate level_id
    const validLevels = ['LVL_UG', 'LVL_PG', 'LVL_DEN', 'LVL_PG_DEN'];
    if (!validLevels.includes(levelId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid level_id. Must be one of: ${validLevels.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Fetch rank journey
    const service = getRankTrackingService();
    const journey = await service.getRankJourney(rank, year, category, quota, sourceId, levelId);

    if (!journey) {
      return NextResponse.json(
        {
          success: false,
          error: `No data found for rank ${rank} in ${category} category, ${quota} quota, ${sourceId} source, ${levelId} level for year ${year}`,
        },
        { status: 404 }
      );
    }

    const jsonResponse = NextResponse.json({
      success: true,
      data: journey,
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Error in rank journey API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rank journey',
      },
      { status: 500 }
    );
  }
}
