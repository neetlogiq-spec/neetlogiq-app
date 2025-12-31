/**
 * Admin Colleges API
 * CRUD operations for colleges (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * GET - List all colleges with pagination
 */
export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('colleges')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,state.ilike.%${search}%`);
    }

    // Pagination
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching colleges:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch colleges' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new college
 */
export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      state,
      management_type,
      college_type,
      niac_rating,
      nirf_rank,
      established_year,
      address,
      website,
      phone,
      email,
      facilities,
      latitude,
      longitude
    } = body;

    // Validation
    if (!name || !state) {
      return NextResponse.json(
        { success: false, error: 'Name and state are required' },
        { status: 400 }
      );
    }

    // Create coordinates point if lat/lng provided
    let coordinates = null;
    if (latitude && longitude) {
      coordinates = `POINT(${longitude} ${latitude})`;
    }

    const { data: college, error } = await supabaseAdmin
      .from('colleges')
      .insert({
        name,
        state,
        management_type,
        college_type,
        niac_rating,
        nirf_rank,
        established_year,
        address,
        website,
        phone,
        email,
        facilities: facilities || {},
        coordinates: coordinates ? supabaseAdmin.rpc('ST_GeomFromText', { wkt: coordinates, srid: 4326 }) : null
      })
      .select()
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      authCheck.userId!,
      'CREATE',
      'college',
      college.id,
      { name, address, state }
    );

    return NextResponse.json({
      success: true,
      data: college,
      message: 'College created successfully'
    });

  } catch (error) {
    console.error('Error creating college:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create college' },
      { status: 500 }
    );
  }
}
