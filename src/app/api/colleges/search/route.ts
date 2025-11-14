/**
 * Enhanced College Search API with Fuzzy Matching
 * GET /api/colleges/search - Full-text search with typo tolerance
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = Number(searchParams.get('limit')) || 50;
    const offset = Number(searchParams.get('offset')) || 0;

    // Parse filters
    const states = searchParams.get('states')?.split(',').filter(Boolean);
    const managementTypes = searchParams.get('management')?.split(',').filter(Boolean);
    const collegeTypes = searchParams.get('type')?.split(',').filter(Boolean);
    const feesMin = searchParams.get('feesMin') ? Number(searchParams.get('feesMin')) : undefined;
    const feesMax = searchParams.get('feesMax') ? Number(searchParams.get('feesMax')) : undefined;
    const rankMin = searchParams.get('rankMin') ? Number(searchParams.get('rankMin')) : undefined;
    const rankMax = searchParams.get('rankMax') ? Number(searchParams.get('rankMax')) : undefined;
  const sortBy = searchParams.get('sortBy') || 'relevance';

  const supabase = supabaseAdmin;

    let queryBuilder = supabase
      .from('colleges')
      .select('*', { count: 'exact' });

    // Fuzzy text search using ILIKE (basic version - will upgrade to trigram)
    if (query.trim()) {
      // Search across multiple fields
      const searchPattern = `%${query}%`;
      queryBuilder = queryBuilder.or(
        `name.ilike.${searchPattern},city.ilike.${searchPattern},state.ilike.${searchPattern},address.ilike.${searchPattern}`
      );
    }

    // Multi-select state filter
    if (states && states.length > 0) {
      queryBuilder = queryBuilder.in('state', states);
    }

    // Multi-select management type filter
    if (managementTypes && managementTypes.length > 0) {
      queryBuilder = queryBuilder.in('management_type', managementTypes);
    }

    // Multi-select college type filter
    if (collegeTypes && collegeTypes.length > 0) {
      queryBuilder = queryBuilder.in('type', collegeTypes);
    }

    // Range filters
    if (feesMin !== undefined) {
      queryBuilder = queryBuilder.gte('fees', feesMin);
    }
    if (feesMax !== undefined) {
      queryBuilder = queryBuilder.lte('fees', feesMax);
    }
    if (rankMin !== undefined) {
      queryBuilder = queryBuilder.gte('nirf_rank', rankMin);
    }
    if (rankMax !== undefined) {
      queryBuilder = queryBuilder.lte('nirf_rank', rankMax);
    }

    // Sorting
    switch (sortBy) {
      case 'name_asc':
        queryBuilder = queryBuilder.order('name', { ascending: true });
        break;
      case 'name_desc':
        queryBuilder = queryBuilder.order('name', { ascending: false });
        break;
      case 'rank_asc':
        queryBuilder = queryBuilder
          .not('nirf_rank', 'is', null)
          .order('nirf_rank', { ascending: true });
        break;
      case 'fees_asc':
        queryBuilder = queryBuilder
          .not('fees', 'is', null)
          .order('fees', { ascending: true });
        break;
      case 'fees_desc':
        queryBuilder = queryBuilder
          .not('fees', 'is', null)
          .order('fees', { ascending: false });
        break;
      case 'established_desc':
        queryBuilder = queryBuilder
          .not('established_year', 'is', null)
          .order('established_year', { ascending: false });
        break;
      case 'seats_desc':
        queryBuilder = queryBuilder
          .not('total_seats', 'is', null)
          .order('total_seats', { ascending: false });
        break;
      default:
        // Default: order by name
        queryBuilder = queryBuilder.order('name', { ascending: true });
    }

    // Pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        page: currentPage,
        limit,
        totalPages,
        hasMore: (offset + limit) < (count || 0),
        hasNext: (offset + limit) < (count || 0),
        has_next: (offset + limit) < (count || 0)
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      },
      { status: 500 }
    );
  }
}
