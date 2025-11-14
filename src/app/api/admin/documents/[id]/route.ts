/**
 * Individual Document API Route
 * PUT /api/admin/documents/[id] - Update document
 * DELETE /api/admin/documents/[id] - Delete document
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin authentication
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id } = params;

    const { data, error } = await supabase
      .from('counselling_documents')
      .update({
        title: body.title,
        category: body.category,
        counselling_body: body.counselling_body,
        file_url: body.file_url,
        official_url: body.official_url,
        upload_date: body.upload_date,
        file_size: body.file_size,
        downloads: body.downloads,
        icon_type: body.icon_type,
        color: body.color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Log admin action
    await logAdminAction(
      authCheck.userId!,
      'UPDATE',
      'document',
      id,
      { title: body.title }
    );

    return NextResponse.json({
      success: true,
      document: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin authentication
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const { id } = params;

    const { error } = await supabase
      .from('counselling_documents')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Log admin action
    await logAdminAction(
      authCheck.userId!,
      'DELETE',
      'document',
      id,
      {}
    );

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document',
      },
      { status: 500 }
    );
  }
}
