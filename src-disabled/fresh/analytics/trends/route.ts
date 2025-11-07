import { NextRequest, NextResponse } from 'next/server';
import { getParquetService } from '@/lib/database/parquet-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const category = searchParams.get('category') || '';

    const parquetService = getParquetService();
    
    // Get counselling data for trend analysis
    const counsellingResult = await parquetService.getCounsellingData({
      year,
      category,
      limit: 10000
    });

    // Calculate trends
    const yearData: { [key: number]: number } = {};
    const categoryData: { [key: string]: number } = {};
    const quotaData: { [key: string]: number } = {};

    counsellingResult.data.forEach(record => {
      // Year trends
      yearData[record.year] = (yearData[record.year] || 0) + 1;
      
      // Category trends
      categoryData[record.category] = (categoryData[record.category] || 0) + 1;
      
      // Quota trends
      quotaData[record.quota] = (quotaData[record.quota] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        year_trends: Object.entries(yearData).map(([year, count]) => ({
          year: parseInt(year),
          count
        })),
        category_trends: Object.entries(categoryData).map(([category, count]) => ({
          category,
          count
        })),
        quota_trends: Object.entries(quotaData).map(([quota, count]) => ({
          quota,
          count
        })),
        total_records: counsellingResult.total
      }
    });
  } catch (error: any) {
    console.error('Analytics trends API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}