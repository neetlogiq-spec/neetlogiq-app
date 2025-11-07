import { NextRequest, NextResponse } from 'next/server';
import { getSimpleParquetService } from '@/lib/database/simple-parquet-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const collegeName = searchParams.get('college') || '';
    const courseName = searchParams.get('course') || '';
    const year = parseInt(searchParams.get('year') || '2024');
    const quota = searchParams.get('quota') || '';
    const category = searchParams.get('category') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!collegeName && !courseName) {
      return NextResponse.json(
        { error: 'Either college name or course name is required' },
        { status: 400 }
      );
    }

    const parquetService = getSimpleParquetService();

    // Step 1: Search for colleges if college name provided
    let colleges = [];
    if (collegeName) {
      const collegeResults = await parquetService.getColleges({
        query: collegeName,
        limit: 10
      });
      colleges = collegeResults.data;
    }

    // Step 2: Search for courses if course name provided
    let courses = [];
    if (courseName) {
      const courseResults = await parquetService.getCourses({
        query: courseName,
        limit: 10
      });
      courses = courseResults.data;
    }

    // Step 3: Search counselling data
    const counsellingData = await parquetService.getCounsellingData({
      query: collegeName || courseName,
      year,
      limit: 100
    });

    // Step 4: Filter counselling data by additional criteria
    let filteredCounsellingData = counsellingData.data;

    if (quota) {
      filteredCounsellingData = filteredCounsellingData.filter(record => 
        record.quota.toLowerCase().includes(quota.toLowerCase())
      );
    }

    if (category) {
      filteredCounsellingData = filteredCounsellingData.filter(record => 
        record.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Step 5: Group by college and course to show opening/closing ranks
    const collegeCutoffMap = new Map();

    filteredCounsellingData.forEach(record => {
      const key = `${record.collegeInstitute}_${record.course}`;
      
      if (!collegeCutoffMap.has(key)) {
        collegeCutoffMap.set(key, {
          college: record.collegeInstitute,
          course: record.course,
          quotas: new Map(),
          totalRecords: 0
        });
      }

      const collegeData = collegeCutoffMap.get(key);
      collegeData.totalRecords += 1;

      const quotaKey = `${record.quota}_${record.category}`;
      if (!collegeData.quotas.has(quotaKey)) {
        collegeData.quotas.set(quotaKey, {
          quota: record.quota,
          category: record.category,
          openingRank: record.allIndiaRank,
          closingRank: record.allIndiaRank,
          records: []
        });
      }

      const quotaData = collegeData.quotas.get(quotaKey);
      quotaData.openingRank = Math.min(quotaData.openingRank, Number(record.allIndiaRank));
      quotaData.closingRank = Math.max(quotaData.closingRank, Number(record.allIndiaRank));
      quotaData.records.push(record);
    });

    // Step 6: Convert to array format
    const results = Array.from(collegeCutoffMap.values()).map(collegeData => ({
      college: collegeData.college,
      course: collegeData.course,
      totalRecords: collegeData.totalRecords,
      quotas: Array.from(collegeData.quotas.values()).map((quotaData: any) => ({
        quota: quotaData.quota,
        category: quotaData.category,
        openingRank: quotaData.openingRank,
        closingRank: quotaData.closingRank,
        totalSeats: quotaData.records.length,
        sampleRecords: quotaData.records.slice(0, 5) // Show first 5 records
      }))
    }));

    return NextResponse.json({
      success: true,
      search_criteria: {
        college: collegeName,
        course: courseName,
        year,
        quota,
        category
      },
      results: results.slice(0, limit),
      total_results: results.length,
      master_data: {
        colleges_found: colleges.length,
        courses_found: courses.length,
        counselling_records_found: filteredCounsellingData.length
      }
    });

  } catch (error: any) {
    console.error('College cutoffs search API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
