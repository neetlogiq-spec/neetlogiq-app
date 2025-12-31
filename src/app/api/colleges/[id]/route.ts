/**
 * College Details API Route
 * GET /api/colleges/[id] - Get college details with courses, cutoffs, stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
<<<<<<< Updated upstream
    const collegeId = params.id;
=======
    // In Next.js 16+, params is a Promise and must be awaited
    const { id: collegeId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const includeGraph = searchParams.get('includeGraph') !== 'false';
    const graphDepth = Math.min(
      Math.max(Number(searchParams.get('graphDepth')) || 1, 1),
      3
    );
>>>>>>> Stashed changes

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
