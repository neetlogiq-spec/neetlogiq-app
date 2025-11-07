import { NextRequest, NextResponse } from 'next/server';
import { getIdBasedDataService } from '@/services/id-based-data-service';

/**
 * GET /api/id-based-data/available
 * Get available years, sources, and levels from partitions
 * Automatically discovers new partitions when added
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // all, years, sources, levels

    const service = getIdBasedDataService();
    await service.initialize();

    switch (type) {
      case 'years':
        const years = await service.getAvailableYears();
        return NextResponse.json({
          success: true,
          years,
          type: 'years',
        });

      case 'sources':
        const sources = await service.getAvailableSources();
        return NextResponse.json({
          success: true,
          sources,
          type: 'sources',
        });

      case 'levels':
        const levels = await service.getAvailableLevels();
        return NextResponse.json({
          success: true,
          levels,
          type: 'levels',
        });

      case 'all':
      default:
        const [allYears, allSources, allLevels] = await Promise.all([
          service.getAvailableYears(),
          service.getAvailableSources(),
          service.getAvailableLevels(),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            years: allYears,
            sources: allSources,
            levels: allLevels,
          },
          type: 'all',
        });
    }
  } catch (error) {
    console.error('Error fetching available data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch available data',
      },
      { status: 500 }
    );
  }
}


