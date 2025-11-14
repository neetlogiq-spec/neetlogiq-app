/**
 * Cron Job: Expire Trials
 *
 * POST /api/cron/expire-trials - Expire all trials that have ended
 *
 * This endpoint should be called by a cron service daily to check and expire trials.
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

    // Call the database function to expire trials
    const { data, error } = await supabase.rpc('expire_trials');

    if (error) {
      console.error('Error expiring trials:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const trialsExpired = data || 0;

    console.log(`Trial expiration completed. ${trialsExpired} trials expired.`);

    return NextResponse.json({
      success: true,
      message: 'Trials expired successfully',
      trialsExpired,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in expire-trials cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Prevent this route from being cached
export const dynamic = 'force-dynamic';
export const runtime = 'edge';
