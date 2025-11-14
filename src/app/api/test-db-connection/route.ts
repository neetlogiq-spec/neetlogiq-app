/**
 * Database Connection & Schema Verification API Route
 *
 * GET /api/test-db-connection
 * Tests Supabase connection and verifies complete hybrid schema
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering for API route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Expected tables from complete hybrid schema (50+ tables)
const expectedTables = [
  // Part 1: Foundation Schema
  'states', 'categories', 'quotas', 'master_courses', 'sources', 'levels',
  // Part 2: College Tables
  'medical_colleges', 'dental_colleges', 'dnb_colleges',
  // Part 3: Application Colleges
  'colleges', 'courses',
  // Part 4: Alias Tables
  'college_aliases', 'course_aliases', 'state_aliases', 'category_aliases', 'quota_aliases',
  // Part 5: Link Tables
  'state_college_link', 'state_course_college_link', 'state_mappings',
  // Part 6: Data Tables
  'seat_data', 'counselling_records', 'counselling_rounds', 'partition_metadata',
  // Part 7: CRITICAL - Cutoffs
  'cutoffs',
  // Part 8: User Management
  'user_profiles', 'user_roles', 'admin_users', 'admin_audit_log',
  // Part 9: Subscriptions & Payments
  'subscriptions', 'payment_transactions', 'premium_features', 'user_feature_usage',
  // Part 10: User Interactions
  'favorites', 'college_notes', 'watchlist', 'recommendations', 'user_activity',
  'search_history', 'user_preferences',
  // Part 11: Real-Time Features
  'live_seat_updates', 'notifications', 'alert_subscriptions',
  // Part 12: Counselling Features
  'counselling_documents', 'counselling_packages', 'counselling_bookings',
  // Part 13: Stream Management
  'stream_configurations', 'user_streams', 'stream_locks', 'stream_change_requests',
  // Part 14: Analytics
  'user_usage_tracking', 'recommendation_requests', 'college_comparisons'
];

const foundationChecks = [
  { table: 'states', expected: 36, description: 'Indian states & UTs' },
  { table: 'categories', expected: 11, description: 'NEET categories' },
  { table: 'quotas', expected: 12, description: 'Quota types' },
  { table: 'master_courses', expected: 40, description: 'Medical courses' },
  { table: 'stream_configurations', expected: 4, description: 'Stream configs' },
  { table: 'user_roles', expected: 4, description: 'User roles' }
];

const views = ['colleges_unified', 'v_counselling_details'];

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      status: 'checking',
      connection: { status: 'unknown', message: '' },
      schema: {
        expectedTables: expectedTables.length,
        existingTables: 0,
        missingTables: [],
        tableDetails: []
      },
      foundationData: [],
      views: [],
      criticalTables: [],
      summary: {
        allTablesExist: false,
        foundationDataPopulated: false,
        viewsExist: false,
        ready: false
      }
    };

    // Test 1: Basic connection
    try {
      const { data, error } = await supabaseAdmin
        .from('states')
        .select('count')
        .limit(1);

      if (error) throw error;

      results.connection = {
        status: 'success',
        message: 'Connected to Supabase successfully',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'N/A'
      };
    } catch (error: any) {
      results.connection = {
        status: 'failed',
        message: error.message,
        error: error
      };
      results.status = 'failed';
      return NextResponse.json(results, { status: 500 });
    }

    // Test 2: Verify all tables exist
    const missingTables: string[] = [];
    const existingTables: string[] = [];

    for (const table of expectedTables) {
      try {
        const { error } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(0);

        if (error) {
          if (error.code === '42P01') {
            missingTables.push(table);
          }
        } else {
          existingTables.push(table);
        }
      } catch (error) {
        missingTables.push(table);
      }
    }

    results.schema.existingTables = existingTables.length;
    results.schema.missingTables = missingTables;
    results.summary.allTablesExist = missingTables.length === 0;

    // Test 3: Check foundation data
    for (const check of foundationChecks) {
      try {
        const { data, error } = await supabaseAdmin
          .from(check.table)
          .select('*', { count: 'exact' });

        const count = data?.length || 0;
        const status = count >= check.expected ? 'complete' : count > 0 ? 'partial' : 'empty';

        results.foundationData.push({
          table: check.table,
          expected: check.expected,
          actual: count,
          status,
          description: check.description
        });
      } catch (error: any) {
        results.foundationData.push({
          table: check.table,
          expected: check.expected,
          actual: 0,
          status: 'error',
          description: check.description,
          error: error.message
        });
      }
    }

    const allFoundationComplete = results.foundationData.every(
      (f: any) => f.status === 'complete'
    );
    results.summary.foundationDataPopulated = allFoundationComplete;

    // Test 4: Check views
    for (const view of views) {
      try {
        const { error } = await supabaseAdmin
          .from(view)
          .select('*')
          .limit(1);

        results.views.push({
          name: view,
          status: error ? 'missing' : 'exists',
          error: error?.message
        });
      } catch (error: any) {
        results.views.push({
          name: view,
          status: 'missing',
          error: error.message
        });
      }
    }

    results.summary.viewsExist = results.views.every((v: any) => v.status === 'exists');

    // Test 5: Check critical tables
    const criticalTables = ['colleges', 'courses', 'cutoffs', 'user_profiles'];
    for (const table of criticalTables) {
      try {
        const { count, error } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        results.criticalTables.push({
          name: table,
          status: error ? 'error' : 'ready',
          rows: count || 0,
          error: error?.message
        });
      } catch (error: any) {
        results.criticalTables.push({
          name: table,
          status: 'error',
          rows: 0,
          error: error.message
        });
      }
    }

    // Final summary
    results.summary.ready =
      results.summary.allTablesExist &&
      results.summary.foundationDataPopulated &&
      results.summary.viewsExist;

    results.status = results.summary.ready ? 'ready' : 'incomplete';

    return NextResponse.json(results, {
      status: results.summary.ready ? 200 : 206
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Unexpected error during verification',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
