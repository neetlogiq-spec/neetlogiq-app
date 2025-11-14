/**
 * College Name Autocomplete API
 * GET /api/colleges/autocomplete - Get college name suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get college name suggestions
    const { data, error } = await supabase
      .from('colleges')
      .select('name, city, state, management_type')
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
      label: `${college.name}, ${college.city}`,
      secondary: `${college.state} • ${college.management_type}`,
      name: college.name,
      city: college.city,
      state: college.state,
      managementType: college.management_type
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
