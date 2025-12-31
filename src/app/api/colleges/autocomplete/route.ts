/**
 * College Name Autocomplete API
 * GET /api/colleges/autocomplete - Get college name suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = Number(searchParams.get('limit')) || 5;

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: []
      });
    }

    const supabase = supabaseAdmin;

    // Get college name suggestions
    const { data, error } = await supabase
      .from('colleges')
      .select('name, address, state, college_type')
      .ilike('name', `${query}%`)
      .limit(limit);

    if (error) {
      console.error('Autocomplete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Format suggestions
    const suggestions = (data || []).map(college => ({
      value: college.name,
      label: `${college.name}, ${college.address || ''}`,
      secondary: `${college.state} • ${college.college_type || ''}`,
      name: college.name,
      address: college.address,
      state: college.state,
      type: college.college_type
    }));

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Autocomplete API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Autocomplete failed'
      },
      { status: 500 }
    );
  }
}
