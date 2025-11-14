/**
 * Cron Job: Reset Monthly Usage Counters
 *
 * POST /api/cron/reset-usage - Reset all user usage counters (monthly)
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions)
 * on the 1st of every month at 00:00 UTC.
 *
 * Security: Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call the database function to reset usage counters
    const { data, error } = await supabase.rpc('reset_monthly_usage_counters');

    if (error) {
      console.error('Error resetting usage counters:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const usersAffected = data || 0;

    console.log(`Monthly usage reset completed. ${usersAffected} users affected.`);

    return NextResponse.json({
      success: true,
      message: 'Monthly usage counters reset successfully',
      usersAffected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in reset-usage cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Prevent this route from being cached
export const dynamic = 'force-dynamic';
export const runtime = 'edge';
