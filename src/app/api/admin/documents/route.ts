/**
 * Documents API Route
 * GET /api/admin/documents - List all documents
 * POST /api/admin/documents - Create new document
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { data: documents, error } = await supabase
      .from('counselling_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documents: documents || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('counselling_documents')
      .insert([
        {
          title: body.title,
          category: body.category,
          counselling_body: body.counselling_body,
          file_url: body.file_url,
          official_url: body.official_url,
          upload_date: body.upload_date,
          file_size: body.file_size,
          downloads: body.downloads || 0,
          icon_type: body.icon_type || 'FileText',
          color: body.color || 'from-blue-500 to-cyan-500',
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document',
      },
      { status: 500 }
    );
  }
}
