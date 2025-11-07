import { NextRequest, NextResponse } from 'next/server';
import { getMasterDataService } from '@/services/master-data-service';

/**
 * GET /api/id-based-data/master
 * Get master data (colleges, courses, states, categories, quotas)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // all, colleges, courses, states, categories, quotas, sources, levels

    const service = getMasterDataService();
    
    // Ensure service is initialized
    if (!service.isInitialized()) {
      await service.initialize();
    }

    switch (type) {
      case 'colleges':
        return NextResponse.json({
          success: true,
          data: service.getAllColleges(),
          type: 'colleges',
        });

      case 'courses':
        return NextResponse.json({
          success: true,
          data: service.getAllCourses(),
          type: 'courses',
        });

      case 'states':
        return NextResponse.json({
          success: true,
          data: service.getAllStates(),
          type: 'states',
        });

      case 'categories':
        return NextResponse.json({
          success: true,
          data: service.getAllCategories(),
          type: 'categories',
        });

      case 'quotas':
        return NextResponse.json({
          success: true,
          data: service.getAllQuotas(),
          type: 'quotas',
        });

      case 'sources':
        return NextResponse.json({
          success: true,
          data: service.getAllSources(),
          type: 'sources',
        });

      case 'levels':
        return NextResponse.json({
          success: true,
          data: service.getAllLevels(),
          type: 'levels',
        });

      case 'all':
      default:
        return NextResponse.json({
          success: true,
          data: {
            colleges: service.getAllColleges(),
            courses: service.getAllCourses(),
            states: service.getAllStates(),
            categories: service.getAllCategories(),
            quotas: service.getAllQuotas(),
            sources: service.getAllSources(),
            levels: service.getAllLevels(),
          },
          type: 'all',
        });
    }
  } catch (error) {
    console.error('Error fetching master data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch master data',
      },
      { status: 500 }
    );
  }
}

