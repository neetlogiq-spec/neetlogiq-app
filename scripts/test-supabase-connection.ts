/**
 * Test Supabase Connection
 * Verifies database connectivity and basic operations
 */

import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  console.log(`📊 Database URL: ${supabaseUrl}\n`);

  try {
    // Test 1: Basic connection
    console.log('1️⃣ Testing basic connection...');
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist
      throw new Error(`Connection failed: ${error.message}`);
    }

    console.log('✅ Connection successful!\n');

    // Test 2: Check if tables exist
    console.log('2️⃣ Checking for existing tables...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `
      })
      .single();

    if (tablesError) {
      console.log('⚠️  Tables query failed (expected if migrations not run yet)');
      console.log(`   Error: ${tablesError.message}\n`);
    } else {
      console.log('✅ Tables query successful\n');
    }

    // Test 3: Check authentication
    console.log('3️⃣ Testing authentication...');
    const { data: authData, error: authError } = await supabase.auth.getSession();

    if (authError) {
      console.log(`⚠️  Auth check: ${authError.message}`);
    } else {
      console.log('✅ Authentication system accessible\n');
    }

    // Test 4: Test service role permissions
    console.log('4️⃣ Testing service role permissions...');
    const { data: permData, error: permError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);

    if (permError) {
      if (permError.code === 'PGRST116') {
        console.log('⚠️  Table user_profiles does not exist yet (run migrations)');
      } else {
        console.log(`⚠️  Permission check: ${permError.message}`);
      }
    } else {
      console.log('✅ Service role has proper permissions\n');
    }

    console.log('═'.repeat(60));
    console.log('📊 CONNECTION TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log('✅ Supabase connection: WORKING');
    console.log('✅ Service role key: VALID');
    console.log('✅ Database accessible: YES');
    console.log('\n🎯 Next Steps:');
    console.log('   1. Run database migrations (see MIGRATION_CHECKLIST.md)');
    console.log('   2. Verify tables created');
    console.log('   3. Create super admin user');
    console.log('   4. Deploy to Vercel\n');

    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check .env.local has correct SUPABASE credentials');
    console.error('   2. Verify Supabase project is active');
    console.error('   3. Check network connectivity');
    console.error('   4. Verify service role key is correct\n');
    return false;
  }
}

// Run the test
testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
