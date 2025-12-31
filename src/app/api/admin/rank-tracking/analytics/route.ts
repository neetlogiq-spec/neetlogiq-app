/**
 * Analytics API Route
 * GET /api/admin/rank-tracking/analytics
 *
 * Provides comprehensive statistics for the rank tracking system
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "overview": {...},
 *     "dataQuality": {...},
 *     "coverage": {...},
 *     "userEngagement": {...},
 *     "trends": {...}
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    // Check admin role
    const { error: adminError, status: adminStatus } = await requireAdmin();
    if (adminError) {
      return NextResponse.json(
        { success: false, error: adminError },
        { status: adminStatus }
      );
    }

    const supabase = await createClient();
    const analytics: Record<string, any> = {
      overview: {},
      dataQuality: {},
      coverage: {},
      userEngagement: {},
      trends: {},
    };

    // 1. Overview Statistics
    const { data: totalRecords, error: totalError } = await supabase
      .from('rank_allocations')
      .select('id', { count: 'exact', head: true });

    const { data: verifiedRecords } = await supabase
      .from('rank_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', true);

    const { data: unverifiedRecords } = await supabase
      .from('rank_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', false);

    const { data: upgradeRecords } = await supabase
      .from('rank_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('allocation_status', 'UPGRADED');

    const { data: todayRecords } = await supabase
      .from('rank_allocations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    analytics.overview = {
      totalRecords: totalRecords?.length || 0,
      verifiedRecords: verifiedRecords?.length || 0,
      unverifiedRecords: unverifiedRecords?.length || 0,
      upgradeRecords: upgradeRecords?.length || 0,
      recordsAddedToday: todayRecords?.length || 0,
      dataQualityScore:
        totalRecords?.length > 0
          ? Math.round(((verifiedRecords?.length || 0) / totalRecords.length) * 100)
          : 0,
    };

    // 2. Data Quality Metrics
    const { data: qualityMetrics } = await supabase.rpc('get_data_quality_metrics').single();

    analytics.dataQuality = qualityMetrics || {
      verificationRate: 0,
      duplicatesCount: 0,
      missingDataCount: 0,
      averageRecordsPerRank: 0,
    };

    // 3. Coverage by Source and Level
    const { data: coverageData } = await supabase
      .from('rank_tracking_coverage')
      .select('*')
      .order('year', { ascending: false })
      .limit(50);

    analytics.coverage = {
      byYear: {},
      bySource: {},
      byLevel: {},
      detailed: coverageData || [],
    };

    // Aggregate coverage
    coverageData?.forEach((row: any) => {
      // By year
      if (!analytics.coverage.byYear[row.year]) {
        analytics.coverage.byYear[row.year] = 0;
      }
      analytics.coverage.byYear[row.year] += row.total_allocations;

      // By source
      if (!analytics.coverage.bySource[row.source_id]) {
        analytics.coverage.bySource[row.source_id] = 0;
      }
      analytics.coverage.bySource[row.source_id] += row.total_allocations;

      // By level
      if (!analytics.coverage.byLevel[row.level_id]) {
        analytics.coverage.byLevel[row.level_id] = 0;
      }
      analytics.coverage.byLevel[row.level_id] += row.total_allocations;
    });

    // 4. User Engagement
    const { data: submissionStats } = await supabase
      .from('user_submission_stats')
      .select('*')
      .single();

    const { data: reportStats } = await supabase
      .from('error_report_stats')
      .select('*')
      .single();

    analytics.userEngagement = {
      submissions: submissionStats || {},
      reports: reportStats || {},
    };

    // 5. Trends (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentRecords } = await supabase
      .from('rank_allocations')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // Group by day
    const dailyCount: Record<string, number> = {};
    recentRecords?.forEach((record: any) => {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      dailyCount[date] = (dailyCount[date] || 0) + 1;
    });

    analytics.trends = {
      last30Days: dailyCount,
      growthRate: calculateGrowthRate(dailyCount),
    };

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
      },
      { status: 500 }
    );
  }
}

function calculateGrowthRate(dailyCount: Record<string, number>): number {
  const values = Object.values(dailyCount);
  if (values.length < 2) return 0;

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (firstAvg === 0) return 0;

  return Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
}
