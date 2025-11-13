/**
 * College Details API Route
 * GET /api/colleges/[id] - Get college details with courses, cutoffs, stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const collegeId = params.id;

    // Get user ID from session (if authenticated)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    const service = getSupabaseDataService();
    const result = await service.getCollegeDetails(collegeId, userId);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'College not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching college details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch college details'
      },
      { status: 500 }
    );
  }
}
