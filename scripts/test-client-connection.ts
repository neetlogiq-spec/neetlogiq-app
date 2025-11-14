#!/usr/bin/env tsx
/**
 * Test Client-Side Supabase Connection
 * 
 * This script tests if the Supabase client can connect from the browser context
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

console.log('🔍 Testing Client-Side Supabase Connection...\n');
console.log(`📊 URL: ${supabaseUrl}`);
console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

// Create client (simulating browser environment)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function testConnection() {
  try {
    // Test 1: Basic connection (public table, no auth required)
    console.log('1️⃣ Testing basic connection (public access)...');
    const { data, error } = await supabase
      .from('states')
      .select('id, name')
      .limit(5);

    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('JWT')) {
        console.log('⚠️  RLS Policy Issue:');
        console.log('   The table exists but RLS policies may be blocking access');
        console.log('   This is normal for protected tables');
        console.log(`   Error: ${error.message}\n`);
      } else {
        throw error;
      }
    } else {
      console.log('✅ Connection successful!');
      console.log(`   Found ${data?.length || 0} states\n`);
    }

    // Test 2: Check if we can read public data
    console.log('2️⃣ Testing public data access...');
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .limit(5);

    if (catError) {
      console.log(`⚠️  Categories access: ${catError.message}`);
    } else {
      console.log(`✅ Categories accessible (${categories?.length || 0} found)\n`);
    }

    // Test 3: Test authentication
    console.log('3️⃣ Testing authentication system...');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.log(`⚠️  Auth check: ${authError.message}`);
    } else {
      console.log(`✅ Auth system accessible`);
      console.log(`   Session: ${session ? 'Active' : 'No active session'}\n`);
    }

    console.log('═'.repeat(60));
    console.log('📊 CLIENT CONNECTION TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log('✅ Supabase client: CREATED');
    console.log('✅ Connection: WORKING');
    console.log('⚠️  RLS Policies: May restrict some tables (expected)');
    console.log('\n💡 Note:');
    console.log('   - Server-side connection uses service role (bypasses RLS)');
    console.log('   - Client-side connection uses anon key (respects RLS)');
    console.log('   - Some tables require authentication to access');
    console.log('   - This is normal and expected behavior\n');

    return true;
  } catch (error: any) {
    console.error('❌ Connection test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check .env.local has correct credentials');
    console.error('   2. Verify Supabase project is active');
    console.error('   3. Check network connectivity');
    console.error('   4. Verify anon key is correct\n');
    return false;
  }
}

// Run the test
testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

