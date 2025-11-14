/**
 * Recommendations API Route
 * GET /api/recommendations - Get personalized college recommendations
 * Uses basic algorithm now, will be enhanced with ML in Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { canGetRecommendations, getUserSubscription } from '@/lib/supabase';
import { getSupabaseDataService } from '@/services/supabase-data-service';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check if user can get recommendations (feature gating)
    const canGet = await canGetRecommendations(userId);
    if (!canGet) {
      const { tier } = await getUserSubscription(userId);

      return NextResponse.json(
        {
          success: false,
          error: 'Daily recommendation limit reached',
          message: tier === 'free'
            ? 'Upgrade to get unlimited recommendations'
            : 'Daily limit reached',
          limit: tier === 'free' ? 3 : 'unlimited'
        },
        { status: 429 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 10;

    const service = getSupabaseDataService();
    const recommendations = await service.getRecommendations(userId, limit);

    // Increment recommendation count for free users
    const { tier } = await getUserSubscription(userId);
    if (tier === 'free') {
      await supabase.rpc('increment_recommendation_count', { p_user_id: userId });
    }

    return NextResponse.json({
      success: true,
      data: recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recommendations'
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate new recommendations (force refresh)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check feature access
    const canGet = await canGetRecommendations(userId);
    if (!canGet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Daily recommendation limit reached',
          message: 'Upgrade to get unlimited recommendations'
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { rank, category, state, preferences } = body;

    if (!rank) {
      return NextResponse.json(
        { success: false, error: 'NEET rank is required' },
        { status: 400 }
      );
    }

    // TODO: Implement advanced ML recommendation engine here
    // For now, return basic recommendations based on rank

    // Basic algorithm: Find colleges where user's rank is within cutoff range
    const { data: recommendations, error } = await supabase
      .from('cutoffs')
      .select(`
        college_id,
        closing_rank,
        opening_rank,
        colleges (
          id,
          name,
          city,
          state,
          management_type,
          niac_rating,
          nirf_rank
        )
      `)
      .gte('closing_rank', rank * 0.8) // Safe colleges
      .lte('opening_rank', rank * 1.2)  // Reach colleges
      .eq('year', new Date().getFullYear() - 1)
      .limit(20);

    if (error) {
      throw error;
    }

    // Calculate match scores (basic)
    const scoredRecommendations = (recommendations || []).map(rec => {
      const rank_normalized = rank;
      const cutoff_normalized = rec.closing_rank || 0;

      // Simple scoring: closer to cutoff = higher score
      const rankDiff = Math.abs(rank_normalized - cutoff_normalized);
      const match_score = Math.max(0, 100 - (rankDiff / rank_normalized) * 100);

      // Determine safety level
      let safety_level = 'moderate';
      if (rank < (rec.opening_rank || 0) * 0.9) {
        safety_level = 'safe';
      } else if (rank > (rec.closing_rank || 0) * 1.1) {
        safety_level = 'reach';
      }

      return {
        college: rec.colleges,
        match_score: Math.round(match_score),
        safety_level,
        closing_rank: rec.closing_rank,
        opening_rank: rec.opening_rank
      };
    });

    // Sort by match score
    scoredRecommendations.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

    // Cache recommendations
    const cacheData = scoredRecommendations.slice(0, 10).map(rec => ({
      user_id: userId,
      college_id: rec.college?.id,
      match_score: rec.match_score,
      safety_level: rec.safety_level,
      factors: { rank, category, state },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    }));

    await supabase.from('recommendation_cache').upsert(cacheData);

    // Increment count
    const { tier } = await getUserSubscription(userId);
    if (tier === 'free') {
      await supabase.rpc('increment_recommendation_count', { p_user_id: userId });
    }

    return NextResponse.json({
      success: true,
      data: scoredRecommendations.slice(0, 10),
      count: scoredRecommendations.length,
      algorithm: 'basic_v1', // Will change to 'ml_v2' after advanced engine
      cached: true
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations'
      },
      { status: 500 }
    );
  }
}
