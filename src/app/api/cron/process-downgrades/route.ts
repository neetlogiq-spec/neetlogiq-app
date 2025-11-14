/**
 * Cron Job: Process Subscription Downgrades
 *
 * POST /api/cron/process-downgrades - Process all pending subscription downgrades
 *
 * This endpoint should be called by a cron service daily.
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

    // Call the database function to process downgrades
    const { data, error } = await supabase.rpc('process_subscription_downgrades');

    if (error) {
      console.error('Error processing downgrades:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const downgradesProcessed = data || 0;

    console.log(`Downgrade processing completed. ${downgradesProcessed} users downgraded.`);

    return NextResponse.json({
      success: true,
      message: 'Subscription downgrades processed successfully',
      downgradesProcessed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in process-downgrades cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Prevent this route from being cached
export const dynamic = 'force-dynamic';
export const runtime = 'edge';
