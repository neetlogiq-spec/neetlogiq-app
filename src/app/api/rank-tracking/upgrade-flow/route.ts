/**
 * College-Course Upgrade Flow API Route
 * GET /api/rank-tracking/upgrade-flow
 *
 * Returns upgrade flow data showing how students migrated between
 * college-course combinations across counselling rounds
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRankTrackingService } from '@/services/rank-tracking-service';
import { getRedisService } from '@/services/RedisService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Extract and validate query parameters
    const year = parseInt(searchParams.get('year') || '');
    const sourceId = searchParams.get('sourceId') || '';
    const levelId = searchParams.get('levelId') || '';
    const category = searchParams.get('category') || '';
    const quota = searchParams.get('quota') || '';
    const fromRound = parseInt(searchParams.get('fromRound') || '');
    const toRound = parseInt(searchParams.get('toRound') || '');
    const minFlowCount = parseInt(searchParams.get('minFlowCount') || '5');

    // Validation
    if (!year || isNaN(year) || year < 2020 || year > 2030) {
      return NextResponse.json(
        { success: false, error: 'Invalid year. Must be between 2020-2030.' },
        { status: 400 }
      );
    }

    if (!sourceId || !levelId || !category || !quota) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: sourceId, levelId, category, quota' },
        { status: 400 }
      );
    }

    if (isNaN(fromRound) || isNaN(toRound) || fromRound < 1 || toRound < 1 || fromRound >= toRound) {
      return NextResponse.json(
        { success: false, error: 'Invalid round numbers. fromRound must be less than toRound.' },
        { status: 400 }
      );
    }

    // Build cache key
    const cacheKey = `flow:${year}:${sourceId}:${levelId}:${category}:${quota}:${fromRound}:${toRound}:${minFlowCount}`;
    const redis = getRedisService();
    
    // Check cache
    const cached = await redis.get<any>(cacheKey);
    if (cached) {
      console.log(`[upgrade-flow API] REDIS HIT for ${cacheKey}`);
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Fetch upgrade flow data
    const service = getRankTrackingService();
    const data = await service.getCollegeCourseUpgradeFlow({
      year,
      sourceId,
      levelId,
      category,
      quota,
      fromRound,
      toRound,
      minFlowCount,
    });

    // Store in cache (5 minutes TTL)
    await redis.set(cacheKey, data, 300);

    return NextResponse.json({
      success: true,
      data,
      cached: false,
    });
  } catch (error) {
    console.error('Error in upgrade-flow API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch upgrade flow data',
      },
      { status: 500 }
    );
  }
}
