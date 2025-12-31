/**
 * Course Name Autocomplete API
 * GET /api/courses/autocomplete - Get course name suggestions
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
    const q = query.trim().toUpperCase();

    // Get course name suggestions from seat_data
    // We use seat_data because it's the most complete source for current courses
    // CRITICAL: Supabase has a 1000-row limit, so we need paginated fetching
    let allData: any[] = [];
    let batchOffset = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batchData, error: batchError } = await supabase
        .from('seat_data')
        .select('master_course_id, course_name, course_type')
        .ilike('course_name', `%${q}%`)
        .range(batchOffset, batchOffset + batchSize - 1);
      
      if (batchError) {
        console.error('Autocomplete batch error:', batchError);
        break;
      }
      
      if (batchData && batchData.length > 0) {
        allData = [...allData, ...batchData];
        batchOffset += batchSize;
        hasMore = batchData.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Format and deduplicate suggestions
    const suggestionMap = new Map();
    allData.forEach(record => {
      const name = record.course_name;
      if (!name || suggestionMap.has(name)) return;
      
      suggestionMap.set(name, {
        value: record.master_course_id || name,
        label: name,
        secondary: record.course_type || 'MEDICAL',
        id: record.master_course_id,
        name: name,
        type: record.course_type
      });
    });

    // Take top N distinct suggestions
    const suggestions = Array.from(suggestionMap.values()).slice(0, limit);

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
