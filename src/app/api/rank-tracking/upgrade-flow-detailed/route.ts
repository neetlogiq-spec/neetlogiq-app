/**
 * Detailed Upgrade Flow API Route
 * GET /api/rank-tracking/upgrade-flow-detailed
 * 
 * Returns raw student records showing side-by-side round comparison
 * Supports 'all' category and quota for fetching all data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRankTrackingService } from '@/services/rank-tracking-service';
import { getRedisService } from '@/services/RedisService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Extract parameters
    const year = parseInt(searchParams.get('year') || '');
    const sourceId = searchParams.get('sourceId') || '';
    const levelId = searchParams.get('levelId') || '';
    const category = searchParams.get('category') || 'all'; // Default to 'all'
    const quota = searchParams.get('quota') || 'all'; // Default to 'all'
    const fromRound = parseInt(searchParams.get('fromRound') || '');
    const toRound = parseInt(searchParams.get('toRound') || '');

    const state = searchParams.get('state') || undefined;
    const college = searchParams.get('college') || undefined;
    const course = searchParams.get('course') || undefined;
    const minRank = searchParams.get('minRank') ? parseInt(searchParams.get('minRank') || '') : undefined;
    const maxRank = searchParams.get('maxRank') ? parseInt(searchParams.get('maxRank') || '') : undefined;
    const search = searchParams.get('search') || undefined;

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Basic Validation - only require core params
    if (!year || !sourceId || !levelId || isNaN(fromRound) || isNaN(toRound)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid parameters' },
        { status: 400 }
      );
    }

    // Cache key for detailed data - include all filters
    const cacheKey = `flow_detailed:${year}:${sourceId}:${levelId}:${category}:${quota}:${fromRound}:${toRound}:${state}:${college}:${course}:${minRank}:${maxRank}:${search}:${limit}:${offset}`;
    const redis = getRedisService();
    
    // Check cache
    const cached = await redis.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        ...cached,
        cached: true,
      });
    }

    // Fetch data using service
    const service = getRankTrackingService();
    const result = await service.getDetailedUpgradeFlow({
      year,
      sourceId,
      levelId,
      category: category === 'all' ? '' : category, 
      quota: quota === 'all' ? '' : quota, 
      fromRound,
      toRound,
      state,
      college,
      course,
      minRank,
      maxRank,
      search,
      limit,
      offset
    });

    // Cache for 5 minutes
    await redis.set(cacheKey, result, 300);

    return NextResponse.json({
      success: true,
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error('Error in upgrade-flow-detailed API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch detailed upgrade flow data',
      },
      { status: 500 }
    );
  }
}
