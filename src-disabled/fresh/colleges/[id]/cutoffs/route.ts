import { NextRequest, NextResponse } from 'next/server';
import { getSimpleParquetService } from '@/lib/database/simple-parquet-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'College ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2024');
    const course = searchParams.get('course') || '';
    const quota = searchParams.get('quota') || '';
    const category = searchParams.get('category') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    const parquetService = getSimpleParquetService();

    // First get the college details
    const college = await parquetService.getCollegeById(id);
    if (!college) {
      return NextResponse.json(
        { error: 'College not found' },
        { status: 404 }
      );
    }

    // Then search for counselling data using college name
    const counsellingData = await parquetService.getCounsellingData({
      query: college.name, // Use query parameter instead of college_id
      year,
      limit,
      sort_by: 'allIndiaRank',
      sort_order: 'asc'
    });

    // Filter by additional criteria
    let filteredData = counsellingData.data;

    if (course) {
      filteredData = filteredData.filter(record => 
        record.course.toLowerCase().includes(course.toLowerCase())
      );
    }

    if (quota) {
      filteredData = filteredData.filter(record => 
        record.quota.toLowerCase().includes(quota.toLowerCase())
      );
    }

    if (category) {
      filteredData = filteredData.filter(record => 
        record.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Group by course and quota to get opening/closing ranks
    const cutoffSummary = filteredData.reduce((acc: any, record) => {
      const key = `${record.course}_${record.quota}_${record.category}`;
      
      if (!acc[key]) {
        acc[key] = {
          course: record.course,
          quota: record.quota,
          category: record.category,
          openingRank: record.allIndiaRank,
          closingRank: record.allIndiaRank,
          totalSeats: 1,
          records: []
        };
      } else {
        acc[key].openingRank = Math.min(acc[key].openingRank, Number(record.allIndiaRank));
        acc[key].closingRank = Math.max(acc[key].closingRank, Number(record.allIndiaRank));
        acc[key].totalSeats += 1;
      }
      
      acc[key].records.push(record);
      return acc;
    }, {});

    const cutoffSummaryArray = Object.values(cutoffSummary).map((summary: any) => ({
      ...summary,
      records: summary.records.slice(0, 10) // Limit individual records
    }));

    return NextResponse.json({
      success: true,
      college: {
        id: college.id,
        name: college.name,
        state: college.state,
        city: college.city,
        type: college.type,
        management: college.management
      },
      cutoffs: cutoffSummaryArray,
      total_cutoffs: filteredData.length,
      filters: {
        year,
        course,
        quota,
        category
      }
    });

  } catch (error: any) {
    console.error('College cutoffs API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
