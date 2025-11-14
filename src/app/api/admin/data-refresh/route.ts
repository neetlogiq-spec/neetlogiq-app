import { NextRequest, NextResponse } from 'next/server';
import { getIdBasedDataService } from '@/services/id-based-data-service';
import { checkAdminAccess, logAdminAction } from '@/lib/admin-middleware';

/**
 * GET /api/admin/data-refresh
 * Get data refresh status (last check, next check, partition info)
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const service = getIdBasedDataService();
    const status = service.getPartitionRefreshStatus();

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Error fetching refresh status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch refresh status',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/data-refresh
 * Manually trigger data refresh
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authCheck = await checkAdminAccess(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: 401 }
    );
  }

  try {
    const service = getIdBasedDataService();

    // Force refresh
    service.refreshPartitions();

    // Get updated status
    const status = service.getPartitionRefreshStatus();

    // Log admin action
    await logAdminAction(
      authCheck.userId!,
      'REFRESH',
      'data',
      'partitions',
      status
    );

    return NextResponse.json({
      success: true,
      message: 'Data refreshed successfully',
      status,
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh data',
      },
      { status: 500 }
    );
  }
}


