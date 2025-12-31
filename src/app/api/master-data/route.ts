/**
 * Master Data API Route
 * GET /api/master-data - Get all colleges, states, categories, quotas
 * Replaces /api/id-based-data/master with Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';

    const service = getSupabaseDataService();

    switch (type) {
      case 'colleges':
        const colleges = await service.getAllColleges();
        return NextResponse.json({
          success: true,
          data: colleges,
          type: 'colleges'
        });

      case 'states':
        const states = await service.getAvailableStates();
        return NextResponse.json({
          success: true,
          data: states, // Now returns {id, name}[]
          type: 'states'
        });

      case 'courses':
        const courses = await service.getAllCourses();
        return NextResponse.json({
          success: true,
          data: courses, // Now returns {id, name}[]
          type: 'courses'
        });

      case 'categories':
        const categories = await service.getAvailableCategories();
        return NextResponse.json({
          success: true,
          data: categories.map(name => ({ id: name, name })),
          type: 'categories'
        });

      case 'quotas':
        const quotas = await service.getAvailableQuotas();
        return NextResponse.json({
          success: true,
          data: quotas.map(name => ({ id: name, name })),
          type: 'quotas'
        });

      case 'years':
        const years = await service.getAvailableYears();
        return NextResponse.json({
          success: true,
          data: years.map(year => ({ id: year.toString(), year })),
          type: 'years'
        });

      case 'all':
      default:
        const masterData = await service.getMasterData();
        // Static college types for filter
        const collegeTypes = [
          { id: 'Government', name: 'Government' },
          { id: 'Private', name: 'Private' },
          { id: 'Deemed', name: 'Deemed' },
          { id: 'Trust', name: 'Trust' }
        ];
        return NextResponse.json({
          success: true,
          data: {
            colleges: masterData.colleges,
            states: masterData.states,
            courses: masterData.courses,
            categories: masterData.categories.map(name => ({ id: name, name })),
            quotas: masterData.quotas.map(name => ({ id: name, name })),
            collegeTypes
          },
          type: 'all'
        });
    }
  } catch (error) {
    console.error('Error fetching master data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch master data'
      },
      { status: 500 }
    );
  }
}
