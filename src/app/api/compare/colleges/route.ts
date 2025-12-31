import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

/**
 * GET /api/compare/colleges - Search colleges for comparison
 * 
 * Query params:
 * - search: Text search (college name, state)
 * - stream: Filter by stream (medical, dental, ayush)
 * - management: Filter by management type (Govt, Pvt, etc)
 * - state: Filter by state name
 * - limit: Max results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      search: searchParams.get('search') || undefined,
      stream: searchParams.get('stream') || undefined,
      management: searchParams.get('management') || undefined,
      state: searchParams.get('state') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    };

    const service = getSupabaseDataService();
    const colleges = await service.searchCollegesForCompare(filters);

    return NextResponse.json({
      success: true,
      colleges,
      count: colleges.length
    });

  } catch (error) {
    console.error('Error searching colleges for compare:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search colleges' },
      { status: 500 }
    );
  }
}
