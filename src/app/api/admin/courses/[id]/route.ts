/**
 * Admin Course API - Single Course Operations
 * GET, PATCH, DELETE operations for individual courses
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * GET - Fetch single course
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
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update course
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

    // Get existing course for audit
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {};
    const allowedFields = ['name', 'description', 'duration_years', 'degree_type'];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update course
    const { data: updated, error } = await supabaseAdmin
      .from('courses')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Track changes
    const changes: any = {};
    Object.keys(updates).forEach(key => {
      if (existing[key] !== updates[key]) {
        changes[key] = {
          from: existing[key],
          to: updates[key]
        };
      }
    });

    // Log action
    await logAdminAction(
      authCheck.userId!,
      'UPDATE',
      'course',
      params.id,
      changes
    );

    return NextResponse.json({
      success: true,
      data: updated,
      changes
    });

  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update course' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete course
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
    // Get course data before deleting (for audit)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Delete course
    const { error } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    // Log action
    await logAdminAction(
      authCheck.userId!,
      'DELETE',
      'course',
      params.id,
      existing
    );

    return NextResponse.json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting course:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete course' },
      { status: 500 }
    );
  }
}
