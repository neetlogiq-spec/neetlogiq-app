/**
 * Filter Options API Route
 * GET /api/filter-options - Get distinct filter values for a partition
 * 
 * Returns cached distinct values for states, courses, quotas, categories, management types
 * Server-side cache: 1 hour TTL to avoid repeated pagination queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { getRedisService } from '@/services/RedisService';

// Cache TTL: 1 hour (filter options rarely change)
const CACHE_TTL_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const partitionKey = searchParams.get('partition_key');
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    if (!partitionKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'partition_key is required' 
      }, { status: 400 });
    }

    const redis = getRedisService();
    const cacheKey = `filters:${partitionKey}`;
    
    // Check Redis cache first
    const cached = forceRefresh ? null : await redis.get<any>(cacheKey);
    
    if (cached) {
      console.log(`[filter-options API] partition=${partitionKey}: REDIS HIT`);
      
      return NextResponse.json({
        success: true,
        data: cached,
        partitionKey,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[filter-options API] partition=${partitionKey}: REDIS MISS - fetching from DB...`);
    
    const service = getSupabaseDataService();
    
    // Get distinct values for each filter dimension
    const filterOptions = await service.getFilterOptions(partitionKey);

    // Store in Redis cache
    await redis.set(cacheKey, filterOptions, CACHE_TTL_SECONDS);

    console.log(`[filter-options API] partition=${partitionKey}: CACHED in Redis`, {
      states: filterOptions.states?.length || 0,
      courses: filterOptions.courses?.length || 0,
      quotas: filterOptions.quotas?.length || 0,
      categories: filterOptions.categories?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: filterOptions,
      partitionKey,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in filter-options API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch filter options'
    }, { status: 500 });
  }
}

// POST to clear cache (useful after data updates)
export async function POST(request: NextRequest) {
  try {
    const { partitionKey } = await request.json();
    const redis = getRedisService();
    
    if (partitionKey) {
      await redis.del(`filters:${partitionKey}`);
      console.log(`[filter-options API] Cache cleared for partition in Redis: ${partitionKey}`);
    } else {
      // Note: We don't flush all of Redis to avoid clearing other decoupled caches
      // If we had a prefix system, we'd use that here.
      console.log('[filter-options API] Manual flush requested - selective clearing not implemented');
    }
    
    return NextResponse.json({ success: true, message: 'Cache clear requested' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to clear cache' }, { status: 500 });
  }
}

