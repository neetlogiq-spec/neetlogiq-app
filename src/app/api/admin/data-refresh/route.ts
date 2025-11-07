import { NextRequest, NextResponse } from 'next/server';
import { getIdBasedDataService } from '@/services/id-based-data-service';

/**
 * GET /api/admin/data-refresh
 * Get data refresh status (last check, next check, partition info)
 */
export async function GET(request: NextRequest) {
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
  try {
    const service = getIdBasedDataService();
    
    // Force refresh
    service.refreshPartitions();
    
    // Get updated status
    const status = service.getPartitionRefreshStatus();

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


