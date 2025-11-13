/**
 * Admin Single Cutoff API
 * UPDATE, DELETE operations for individual cutoff record
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * PATCH - Update cutoff record (most common operation)
 * Example: Update seats from 200 to 250
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

    // Get existing cutoff for audit log
    const { data: existingCutoff } = await supabaseAdmin
      .from('cutoffs')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!existingCutoff) {
      return NextResponse.json(
        { success: false, error: 'Cutoff not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {};
    const allowedFields = [
      'opening_rank', 'closing_rank', 'seats', 'seats_filled',
      'round', 'category', 'quota', 'state'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    // Update cutoff
    const { data: updatedCutoff, error } = await supabaseAdmin
      .from('cutoffs')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Log changes (important for audit trail)
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (existingCutoff[key] !== updates[key]) {
        changes[key] = {
          from: existingCutoff[key],
          to: updates[key]
        };
      }
    });

    await logAdminAction(
      authCheck.userId!,
      'UPDATE',
      'cutoff',
      params.id,
      changes
    );

    return NextResponse.json({
      success: true,
      data: updatedCutoff,
      message: 'Cutoff updated successfully',
      changes // Return what changed
    });

  } catch (error) {
    console.error('Error updating cutoff:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update cutoff' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete cutoff record
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
    // Get cutoff details for audit log
    const { data: cutoff } = await supabaseAdmin
      .from('cutoffs')
      .select('college_id, course_id, year, category, closing_rank')
      .eq('id', params.id)
      .single();

    // Delete cutoff
    const { error } = await supabaseAdmin
      .from('cutoffs')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    // Log deletion
    await logAdminAction(
      authCheck.userId!,
      'DELETE',
      'cutoff',
      params.id,
      cutoff
    );

    return NextResponse.json({
      success: true,
      message: 'Cutoff deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting cutoff:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete cutoff' },
      { status: 500 }
    );
  }
}

/**
 * POST - Bulk update cutoffs (useful for batch operations)
 * Example: Update all seats for a college in a specific year
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // This would be for bulk operations like:
  // "Update all MBBS seats for XYZ college from 200 to 250"

  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  // Placeholder for bulk operations
  return NextResponse.json({
    success: false,
    error: 'Bulk operations not yet implemented'
  }, { status: 501 });
}
