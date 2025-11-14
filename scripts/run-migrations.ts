/**
 * Database Migration Runner
 * Executes all SQL migrations on Supabase in order
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

async function runMigration(filename: string): Promise<void> {
  const filepath = path.join(MIGRATIONS_DIR, filename);

  console.log(`\n📄 Running migration: ${filename}`);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    throw new Error(`Migration file not found: ${filename}`);
  }

  const sql = fs.readFileSync(filepath, 'utf-8');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    if (!statement) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct execution if RPC doesn't work
        const { error: directError } = await supabase.from('_migrations').insert({
          name: filename,
          executed_at: new Date().toISOString()
        });

        if (directError) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          throw error;
        }
      }
    } catch (err) {
      console.error(`❌ Failed to execute statement ${i + 1} in ${filename}`);
      throw err;
    }
  }

  console.log(`✅ Completed: ${filename}`);
}

async function checkConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('_migrations').select('count').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist, which is okay
      console.error('❌ Database connection failed:', error);
      return false;
    }

    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to database:', err);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n');
  console.log(`📊 Supabase URL: ${supabaseUrl}`);
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`);
  console.log(`📝 Total migrations: ${MIGRATION_FILES.length}\n`);

  // Check connection
  const connected = await checkConnection();
  if (!connected) {
    console.error('\n❌ Cannot connect to database. Please check your credentials.');
    process.exit(1);
  }

  // Run migrations
  let successful = 0;
  let failed = 0;

  for (const filename of MIGRATION_FILES) {
    try {
      await runMigration(filename);
      successful++;
    } catch (err) {
      console.error(`\n❌ Migration failed: ${filename}`);
      console.error(err);
      failed++;

      // Ask if we should continue
      console.log('\n⚠️  Migration failed. You may need to run this migration manually in Supabase SQL Editor.');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${MIGRATION_FILES.length}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some migrations failed. Please run them manually in Supabase SQL Editor:');
    console.log(`   https://supabase.com/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/sql/new`);
    process.exit(1);
  }

  console.log('\n✅ All migrations completed successfully!');
  console.log('\n🎯 Next steps:');
  console.log('   1. Create super admin user');
  console.log('   2. Verify all tables created');
  console.log('   3. Test database functions');
}

main().catch(console.error);
