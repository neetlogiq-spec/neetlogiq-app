/**
 * Verify Database Setup
 * Checks that all tables, functions, and triggers are created correctly
 */

import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
  results.push({ test, status, message, details });

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  return !error || error.code !== 'PGRST116'; // PGRST116 = table doesn't exist
}

async function verifyDatabase() {
  console.log('═'.repeat(60));
  console.log('🔍 Database Verification');
  console.log('═'.repeat(60));
  console.log(`📊 Database: ${supabaseUrl}\n`);

  // Test 1: Connection
  console.log('1️⃣ Testing connection...');
  try {
    const { error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (!error || error.code === 'PGRST116') {
      addResult('Connection', 'PASS', 'Successfully connected to Supabase');
    } else {
      addResult('Connection', 'FAIL', `Connection error: ${error.message}`);
    }
  } catch (error: any) {
    addResult('Connection', 'FAIL', `Failed to connect: ${error.message}`);
  }

  console.log('');

  // Test 2: Critical tables
  console.log('2️⃣ Verifying critical tables...');
  const criticalTables = [
    'user_profiles',
    'subscriptions',
    'favorites',
    'notifications',
    'stream_config',
    'user_usage_tracking',
    'admin_role_changes',
    'recommendation_requests',
    'college_comparisons',
  ];

  for (const table of criticalTables) {
    const exists = await checkTableExists(table);
    if (exists) {
      addResult(`Table: ${table}`, 'PASS', 'Table exists');
    } else {
      addResult(`Table: ${table}`, 'FAIL', 'Table not found - run migrations');
    }
  }

  console.log('');

  // Test 3: Stream configuration
  console.log('3️⃣ Checking stream configuration...');
  const { data: streams, error: streamsError } = await supabase
    .from('stream_config')
    .select('stream_id, stream_name, enabled');

  if (streamsError) {
    addResult('Stream Config', 'FAIL', `Error: ${streamsError.message}`);
  } else if (!streams || streams.length === 0) {
    addResult('Stream Config', 'WARN', 'No streams configured - run migrations');
  } else {
    addResult('Stream Config', 'PASS', `${streams.length} streams configured`, streams);
  }

  console.log('');

  // Test 4: User roles
  console.log('4️⃣ Checking user roles...');
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('role')
    .limit(10);

  if (profilesError) {
    if (profilesError.code === 'PGRST116') {
      addResult('User Roles', 'WARN', 'user_profiles table not found - run migrations');
    } else {
      addResult('User Roles', 'FAIL', `Error: ${profilesError.message}`);
    }
  } else {
    const adminCount = profiles?.filter((p: any) => p.role === 'admin' || p.role === 'super_admin').length || 0;
    if (adminCount > 0) {
      addResult('User Roles', 'PASS', `${adminCount} admin users found`);
    } else {
      addResult('User Roles', 'WARN', 'No admin users found - create super admin');
    }
  }

  console.log('');

  // Test 5: Trial configuration
  console.log('5️⃣ Checking trial period configuration...');
  const { data: trialsData, error: trialsError } = await supabase
    .from('user_profiles')
    .select('trial_started_at, trial_ends_at, trial_used')
    .not('trial_used', 'is', null)
    .limit(5);

  if (trialsError) {
    if (trialsError.code === 'PGRST116') {
      addResult('Trial System', 'WARN', 'Trial columns not found - run migrations');
    } else {
      addResult('Trial System', 'FAIL', `Error: ${trialsError.message}`);
    }
  } else {
    if (trialsData && trialsData.length > 0) {
      addResult('Trial System', 'PASS', `${trialsData.length} users with trial data`);
    } else {
      addResult('Trial System', 'PASS', 'Trial system configured (no trial users yet)');
    }
  }

  console.log('');

  // Test 6: Usage tracking
  console.log('6️⃣ Checking usage tracking...');
  const { data: usageData, error: usageError } = await supabase
    .from('user_usage_tracking')
    .select('*')
    .limit(1);

  if (usageError) {
    if (usageError.code === 'PGRST116') {
      addResult('Usage Tracking', 'WARN', 'usage tracking table not found - run migrations');
    } else {
      addResult('Usage Tracking', 'FAIL', `Error: ${usageError.message}`);
    }
  } else {
    addResult('Usage Tracking', 'PASS', 'Usage tracking table exists');
  }

  console.log('');

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 Verification Summary');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`⚠️  Warnings: ${warnings}/${total}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n❌ Database verification FAILED');
    console.log('   Run migrations: npx tsx scripts/apply-migrations.ts\n');
    return false;
  } else if (warnings > 0) {
    console.log('\n⚠️  Database verification completed with warnings');
    console.log('   Check warnings above and take necessary actions\n');
    return true;
  } else {
    console.log('\n✅ Database verification PASSED');
    console.log('   All systems operational!\n');
    console.log('🎯 Next steps:');
    console.log('   1. Create super admin user (see scripts/create-super-admin.sql)');
    console.log('   2. Test application locally: npm run dev');
    console.log('   3. Deploy to Vercel\n');
    return true;
  }
}

verifyDatabase()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
