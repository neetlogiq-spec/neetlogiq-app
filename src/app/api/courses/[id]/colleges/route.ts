/**
 * Course Colleges API
 * GET /api/courses/[id]/colleges - Get all colleges offering a specific course
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const { id } = await params;
    const service = getSupabaseDataService();

    // ULTRA-OPTIMIZED: Single seat_data query provides everything
    // No ID resolution needed, no courses table query needed
    const result = await service.getCourseColleges(id);
    
    if (!result.course && (!result.data || result.data.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const jsonResponse = NextResponse.json({
      success: true,
      data: result.data || [],
      course: result.course || {
        id: id,
        name: id,
        stream: 'MEDICAL',
      },
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);

  } catch (error) {
    console.error('Course colleges API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch colleges',
        data: [],
      },
      { status: 500 }
    );
  }
}
