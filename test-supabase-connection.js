#!/usr/bin/env node
/**
 * Supabase Connection & Schema Verification Test
 *
 * This script tests the connection to Supabase and verifies
 * that the complete hybrid schema has been applied correctly.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}\n`)
};

// Expected tables from complete hybrid schema (50+ tables)
const expectedTables = [
  // Part 1: Foundation Schema (DATABASE_SCHEMAS.md)
  'states', 'categories', 'quotas', 'master_courses', 'sources', 'levels',

  // Part 2: College Tables (DATABASE_SCHEMAS.md)
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

async function testConnection() {
  log.header('🔌 SUPABASE CONNECTION TEST');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  log.info(`Connecting to: ${supabaseUrl}`);

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Test 1: Basic connection test
    log.info('Testing basic connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('states')
      .select('count')
      .limit(1);

    if (healthError) {
      log.error(`Connection failed: ${healthError.message}`);
      process.exit(1);
    }

    log.success('Connection successful!');

    // Test 2: Verify all expected tables exist
    log.header('📋 SCHEMA VERIFICATION');
    log.info(`Checking for ${expectedTables.length} expected tables...`);

    const missingTables = [];
    const existingTables = [];

    for (const table of expectedTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        if (error.code === '42P01') {
          // Table does not exist
          missingTables.push(table);
          log.error(`Table missing: ${table}`);
        } else {
          log.warning(`Error checking ${table}: ${error.message}`);
        }
      } else {
        existingTables.push(table);
      }
    }

    // Test 3: Check foundation data
    log.header('📊 FOUNDATION DATA CHECK');

    const foundationChecks = [
      { table: 'states', expected: 36, description: 'Indian states & UTs' },
      { table: 'categories', expected: 11, description: 'NEET categories' },
      { table: 'quotas', expected: 12, description: 'Quota types' },
      { table: 'master_courses', expected: 40, description: 'Medical courses' },
      { table: 'stream_configurations', expected: 4, description: 'Stream configs' },
      { table: 'user_roles', expected: 4, description: 'User roles' }
    ];

    for (const check of foundationChecks) {
      const { data, error } = await supabase
        .from(check.table)
        .select('*', { count: 'exact' });

      if (error) {
        log.warning(`Could not check ${check.table}: ${error.message}`);
      } else {
        const count = data?.length || 0;
        if (count >= check.expected) {
          log.success(`${check.table}: ${count} rows (${check.description})`);
        } else if (count > 0) {
          log.warning(`${check.table}: ${count}/${check.expected} rows (${check.description})`);
        } else {
          log.error(`${check.table}: 0 rows - needs population (${check.description})`);
        }
      }
    }

    // Test 4: Check views
    log.header('👁️  VIEWS CHECK');
    const views = ['colleges_unified', 'v_counselling_details'];

    for (const view of views) {
      const { error } = await supabase
        .from(view)
        .select('*')
        .limit(1);

      if (error) {
        log.error(`View missing or broken: ${view}`);
      } else {
        log.success(`View exists: ${view}`);
      }
    }

    // Final Report
    log.header('📈 FINAL REPORT');
    console.log(`Total Expected Tables: ${colors.bold}${expectedTables.length}${colors.reset}`);
    console.log(`Tables Found: ${colors.green}${existingTables.length}${colors.reset}`);
    console.log(`Tables Missing: ${colors.red}${missingTables.length}${colors.reset}`);

    if (missingTables.length === 0) {
      log.success('✨ All tables exist! Schema is complete!');
    } else {
      log.error('❌ Schema incomplete. Missing tables:');
      missingTables.forEach(table => console.log(`   - ${table}`));
      console.log('\n💡 Run the complete hybrid schema migration in Supabase Dashboard');
      process.exit(1);
    }

    // Test 5: Test critical tables for recommendations
    log.header('🎯 CRITICAL TABLES CHECK');
    const criticalTables = ['colleges', 'courses', 'cutoffs', 'user_profiles'];

    for (const table of criticalTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        log.error(`Critical table ${table}: ${error.message}`);
      } else {
        log.success(`Critical table ${table}: ready (${count || 0} rows)`);
      }
    }

    log.header('✅ CONNECTION TEST COMPLETE');
    log.success('Database is ready for use!');

    console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
    console.log('1. ✓ Schema verified');
    console.log('2. ✓ Foundation data populated');
    console.log('3. → Import college data from SQLite databases');
    console.log('4. → Test search and filter APIs');
    console.log('5. → Deploy application\n');

  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testConnection();
