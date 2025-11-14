/**
 * Admin Single College API
 * GET, UPDATE, DELETE operations for individual college
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * GET - Get single college by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const { data: college, error } = await supabaseAdmin
      .from('colleges')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    if (!college) {
      return NextResponse.json(
        { success: false, error: 'College not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: college
    });

  } catch (error) {
    console.error('Error fetching college:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch college' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update college
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Get existing college for audit log
    const { data: existingCollege } = await supabaseAdmin
      .from('colleges')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!existingCollege) {
      return NextResponse.json(
        { success: false, error: 'College not found' },
        { status: 404 }
      );
    }

    // Build update object (only include fields that are provided)
    const updates: any = {};
    const allowedFields = [
      'name', 'city', 'state', 'management_type', 'college_type',
      'niac_rating', 'nirf_rank', 'established_year', 'address',
      'website', 'phone', 'email', 'facilities'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    // Handle coordinates update
    if (body.latitude !== undefined && body.longitude !== undefined) {
      const coordinates = `POINT(${body.longitude} ${body.latitude})`;
      updates.coordinates = supabaseAdmin.rpc('ST_GeomFromText', {
        wkt: coordinates,
        srid: 4326
      });
    }

    // Update college
    const { data: updatedCollege, error } = await supabaseAdmin
      .from('colleges')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Log changes
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (existingCollege[key] !== updates[key]) {
        changes[key] = {
          from: existingCollege[key],
          to: updates[key]
        };
      }
    });

    await logAdminAction(
      authCheck.userId!,
      'UPDATE',
      'college',
      params.id,
      changes
    );

    return NextResponse.json({
      success: true,
      data: updatedCollege,
      message: 'College updated successfully'
    });

  } catch (error) {
    console.error('Error updating college:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update college' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete college
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    // Get college details for audit log
    const { data: college } = await supabaseAdmin
      .from('colleges')
      .select('name, city, state')
      .eq('id', params.id)
      .single();

    // Delete college (cascades to related records if configured)
    const { error } = await supabaseAdmin
      .from('colleges')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    // Log deletion
    await logAdminAction(
      authCheck.userId!,
      'DELETE',
      'college',
      params.id,
      college
    );

    return NextResponse.json({
      success: true,
      message: 'College deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting college:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete college' },
      { status: 500 }
    );
  }
}
