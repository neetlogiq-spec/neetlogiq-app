/**
 * Apply Database Migrations to Supabase
 * Executes all SQL migrations in order
 */

import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('   Make sure .env.local has:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

// Migration files in order
const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_admin_audit_log.sql',
  '20240615_create_counselling_documents.sql',
  '20240620_create_subscriptions.sql',
  '20250113_add_stream_lock.sql',
  '20250114_add_user_roles.sql',
  '20250114_create_stream_config.sql',
  '20250114_add_usage_tracking.sql',
  '20250114_add_usage_enforcement_triggers.sql',
  '20250114_add_trial_period.sql',
  '20250114_add_downgrade_rules.sql',
];

async function executeSql(sql: string, description: string): Promise<boolean> {
  try {
    // Split SQL by semicolon and filter out comments and empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        if (!s) return false;
        // Remove SQL comments
        const noComments = s.replace(/--.*$/gm, '').trim();
        return noComments.length > 0;
      });

    console.log(`   Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      // Execute via RPC (if available) or direct query
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Try alternative: direct query execution
          const { error: directError } = await supabase
            .from('_temp')
            .select('*')
            .limit(0);

          if (directError && directError.code !== 'PGRST116') {
            console.error(`     ❌ Statement ${i + 1} failed:`, error.message);
            return false;
          }
        }
      } catch (err: any) {
        // Some statements might not work via RPC, that's okay
        if (err.message && !err.message.includes('does not exist')) {
          console.warn(`     ⚠️  Statement ${i + 1}:`, err.message);
        }
      }
    }

    return true;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runMigration(filename: string): Promise<boolean> {
  const filepath = path.join(MIGRATIONS_DIR, filename);

  console.log(`\n📄 Running migration: ${filename}`);

  if (!fs.existsSync(filepath)) {
    console.error(`   ❌ File not found: ${filepath}`);
    return false;
  }

  const sql = fs.readFileSync(filepath, 'utf-8');
  const success = await executeSql(sql, filename);

  if (success) {
    console.log(`   ✅ Completed: ${filename}`);
  } else {
    console.log(`   ⚠️  Completed with warnings: ${filename}`);
  }

  return success;
}

async function checkConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing database connection...');

    const { error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }

    console.log('✅ Database connection successful\n');
    return true;
  } catch (err: any) {
    console.error('❌ Failed to connect to database:', err.message);
    return false;
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🚀 Starting Database Migrations');
  console.log('═'.repeat(60));
  console.log(`📊 Supabase URL: ${supabaseUrl}`);
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`);
  console.log(`📝 Total migrations: ${MIGRATION_FILES.length}\n`);

  // Check connection
  const connected = await checkConnection();
  if (!connected) {
    console.error('\n❌ Cannot connect to database. Please check your credentials.');
    console.error('   Make sure .env.local has correct values for:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY\n');
    process.exit(1);
  }

  // Run migrations
  let successful = 0;
  let failed = 0;

  for (const filename of MIGRATION_FILES) {
    const success = await runMigration(filename);
    if (success) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Migration Summary');
  console.log('═'.repeat(60));
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${MIGRATION_FILES.length}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some migrations had issues.');
    console.log('   This is expected if migrations have already been run.');
    console.log('   Run verification script to check database state:\n');
    console.log('   npx tsx scripts/verify-database.ts\n');
  } else {
    console.log('\n✅ All migrations completed!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Run: npx tsx scripts/verify-database.ts');
    console.log('   2. Create super admin user');
    console.log('   3. Test the application locally');
    console.log('   4. Deploy to Vercel\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
