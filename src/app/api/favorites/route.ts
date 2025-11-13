/**
 * Favorites API Route
 * GET /api/favorites - Get user's favorited colleges
 * POST /api/favorites - Add college to favorites
 * DELETE /api/favorites - Remove college from favorites
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hasFeatureAccess } from '@/lib/subscription-plans';
import { getUserSubscription } from '@/lib/supabase';

/**
 * GET - Fetch user's favorites
 */
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

    // Fetch favorites with college details
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        id,
        college_id,
        notes,
        tags,
        created_at,
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: favorites || [],
      count: favorites?.length || 0
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch favorites'
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Add college to favorites
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
    const body = await request.json();
    const { collegeId, notes, tags } = body;

    if (!collegeId) {
      return NextResponse.json(
        { success: false, error: 'College ID is required' },
        { status: 400 }
      );
    }

    // Check subscription tier and limits
    const { tier } = await getUserSubscription(userId);

    // Check current favorite count
    const { count } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Check if user can save more colleges
    if (!hasFeatureAccess(tier, 'savedColleges')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Free tier limit reached',
          message: 'Upgrade to save more colleges',
          limit: 10,
          current: count || 0
        },
        { status: 403 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('college_id', collegeId)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'College already in favorites' },
        { status: 409 }
      );
    }

    // Add to favorites
    const { data: favorite, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        college_id: collegeId,
        notes: notes || null,
        tags: tags || []
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: favorite
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add favorite'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove college from favorites
 */
export async function DELETE(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;
    const collegeId = searchParams.get('collegeId');
    const favoriteId = searchParams.get('id');

    if (!collegeId && !favoriteId) {
      return NextResponse.json(
        { success: false, error: 'College ID or Favorite ID is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId);

    if (favoriteId) {
      query = query.eq('id', favoriteId);
    } else if (collegeId) {
      query = query.eq('college_id', collegeId);
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove favorite'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update favorite (notes, tags)
 */
export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const { favoriteId, notes, tags } = body;

    if (!favoriteId) {
      return NextResponse.json(
        { success: false, error: 'Favorite ID is required' },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;

    const { data: favorite, error } = await supabase
      .from('favorites')
      .update(updates)
      .eq('id', favoriteId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: favorite
    });
  } catch (error) {
    console.error('Error updating favorite:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update favorite'
      },
      { status: 500 }
    );
  }
}
