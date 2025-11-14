/**
 * Admin Stream Detail API
 *
 * Endpoints:
 * - GET /api/admin/streams/[id] - Get stream configuration
 * - PUT /api/admin/streams/[id] - Update stream configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';
import type { StreamConfig } from '@/components/admin/StreamManagement';

/**
 * GET /api/admin/streams/[id]
 * Get stream configuration by ID
 */
export async function GET(
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

    // TODO: Load stream configuration from database
    // const streamConfig = await db.collection('streamConfigs').doc(id).get();
    // if (!streamConfig.exists) {
    //   return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    // }

    // Placeholder - return null
    const streamConfig: StreamConfig | null = null;

    if (!streamConfig) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      stream: streamConfig
    });
  } catch (error) {
    console.error('Error fetching stream:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/streams/[id]
 * Update stream configuration
 */
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

    const { id } = params;
    const updates: Partial<StreamConfig> = await request.json();

    // Validate stream ID
    if (!['UG', 'PG_MEDICAL', 'PG_DENTAL'].includes(id)) {
      return NextResponse.json(
        { error: 'Invalid stream ID' },
        { status: 400 }
      );
    }

    // TODO: Update stream configuration in database
    // await db.collection('streamConfigs').doc(id).update({
    //   ...updates,
    //   updatedAt: new Date()
    // });

    const updatedStream: StreamConfig = {
      ...updates,
      id: id as any,
      updatedAt: new Date()
    } as StreamConfig;

    // Log admin action
    await logAdminAction(
      authCheck.userId!,
      'UPDATE',
      'stream_config',
      id,
      updates
    );

    console.log(`✅ Stream ${id} configuration updated`);

    return NextResponse.json({
      success: true,
      stream: updatedStream
    });
  } catch (error) {
    console.error('Error updating stream:', error);
    return NextResponse.json(
      { error: 'Failed to update stream' },
      { status: 500 }
    );
  }
}
