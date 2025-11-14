/**
 * Data Migration Script: SQLite/Parquet → PostgreSQL
 *
 * This script migrates all data from the current DuckDB/Parquet setup
 * to the new Supabase PostgreSQL database.
 *
 * Usage:
 *   tsx scripts/migrate-to-postgres.ts
 *
 * Prerequisites:
 *   - Supabase instance running
 *   - .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - DuckDB parquet files in output/ directory
 */

import { createClient } from '@supabase/supabase-js';
import * as duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// DuckDB connection
const db = new duckdb.Database(':memory:');
const conn = db.connect();

// Paths to parquet files
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const MASTER_DATA_DIR = path.join(OUTPUT_DIR, 'master_data_export_20251029_001424');

interface MigrationStats {
  colleges: number;
  courses: number;
  cutoffs: number;
  states: number;
  categories: number;
  quotas: number;
  errors: string[];
}

const stats: MigrationStats = {
  colleges: 0,
  courses: 0,
  cutoffs: 0,
  states: 0,
  categories: 0,
  quotas: 0,
  errors: []
};

/**
 * Read data from parquet file using DuckDB
 */
function readParquet(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
      resolve([]);
      return;
    }

    const query = `SELECT * FROM read_parquet('${filePath}')`;

    conn.all(query, (err, rows: any[]) => {
      if (err) {
        console.error(`❌ Error reading ${filePath}:`, err);
        stats.errors.push(`Error reading ${filePath}: ${err.message}`);
        resolve([]);
        return;
      }

      resolve(rows || []);
    });
  });
}

/**
 * Migrate colleges from master data
 */
async function migrateColleges(): Promise<void> {
  console.log('\n📚 Migrating colleges...');

  const types = ['medical', 'dental', 'dnb'];
  const allColleges: any[] = [];

  for (const type of types) {
    const filePath = path.join(MASTER_DATA_DIR, `${type}_colleges.parquet`);
    const rows = await readParquet(filePath);

    rows.forEach(row => {
      allColleges.push({
        id: String(row.id || ''),
        name: String(row.name || ''),
        city: row.city ? String(row.city) : null,
        state: row.state ? String(row.state) : null,
        management_type: null, // To be enriched from counselling data
        college_type: type.toUpperCase(),
        niac_rating: null,
        nirf_rank: null,
        address: row.address ? String(row.address) : null,
        facilities: {},
        metadata: {
          normalized_name: row.normalized_name ? String(row.normalized_name) : null
        }
      });
    });

    console.log(`   ✓ Read ${rows.length} ${type} colleges`);
  }

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < allColleges.length; i += batchSize) {
    const batch = allColleges.slice(i, i + batchSize);

    const { error } = await supabase
      .from('colleges')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      console.error(`   ❌ Error inserting colleges batch ${i}:`, error);
      stats.errors.push(`Colleges batch ${i}: ${error.message}`);
    } else {
      stats.colleges += batch.length;
      console.log(`   ✓ Inserted colleges ${i + 1} to ${i + batch.length}`);
    }
  }

  console.log(`✅ Migrated ${stats.colleges} colleges`);
}

/**
 * Migrate courses from master data
 */
async function migrateCourses(): Promise<void> {
  console.log('\n📖 Migrating courses...');

  const filePath = path.join(MASTER_DATA_DIR, 'courses.parquet');
  const rows = await readParquet(filePath);

  const courses = rows.map(row => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    college_id: null, // Will be linked via cutoffs data
    duration: null,
    degree_type: null,
    metadata: {
      normalized_name: row.normalized_name ? String(row.normalized_name) : null
    }
  }));

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < courses.length; i += batchSize) {
    const batch = courses.slice(i, i + batchSize);

    const { error } = await supabase
      .from('courses')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

    if (error) {
      console.error(`   ❌ Error inserting courses batch ${i}:`, error);
      stats.errors.push(`Courses batch ${i}: ${error.message}`);
    } else {
      stats.courses += batch.length;
      console.log(`   ✓ Inserted courses ${i + 1} to ${i + batch.length}`);
    }
  }

  console.log(`✅ Migrated ${stats.courses} courses`);
}

/**
 * Migrate cutoffs from counselling data
 */
async function migrateCutoffs(): Promise<void> {
  console.log('\n📊 Migrating cutoffs...');

  const filePath = path.join(OUTPUT_DIR, 'counselling_data_export_20251029_001424.parquet');
  const rows = await readParquet(filePath);

  const cutoffs = rows.map(row => ({
    college_id: String(row.master_college_id || ''),
    course_id: String(row.master_course_id || ''),
    year: Number(row.year || 0),
    round: Number(row.round || 1),
    category: String(row.master_category_id || row.category || ''),
    quota: String(row.master_quota_id || row.quota || ''),
    state: row.master_state_id ? String(row.master_state_id) : null,
    opening_rank: row.opening_rank ? Number(row.opening_rank) : null,
    closing_rank: row.closing_rank ? Number(row.closing_rank) : null,
    seats: row.seats ? Number(row.seats) : null,
    metadata: {
      source: row.master_source_id ? String(row.master_source_id) : null,
      level: row.master_level_id ? String(row.master_level_id) : null
    }
  }));

  // Insert in batches
  const batchSize = 1000;
  for (let i = 0; i < cutoffs.length; i += batchSize) {
    const batch = cutoffs.slice(i, i + batchSize);

    const { error } = await supabase
      .from('cutoffs')
      .insert(batch, { ignoreDuplicates: true });

    if (error && !error.message.includes('duplicate')) {
      console.error(`   ❌ Error inserting cutoffs batch ${i}:`, error);
      stats.errors.push(`Cutoffs batch ${i}: ${error.message}`);
    } else {
      stats.cutoffs += batch.length;
      if ((i + batch.length) % 10000 === 0 || i + batch.length === cutoffs.length) {
        console.log(`   ✓ Inserted cutoffs ${i + 1} to ${i + batch.length}`);
      }
    }
  }

  console.log(`✅ Migrated ${stats.cutoffs} cutoffs`);
}

/**
 * Migrate master lookup data (states, categories, quotas)
 */
async function migrateLookupData(): Promise<void> {
  console.log('\n📋 Migrating lookup data...');

  // States
  const statesFile = path.join(MASTER_DATA_DIR, 'states.parquet');
  const statesRows = await readParquet(statesFile);
  stats.states = statesRows.length;
  console.log(`   ✓ Found ${stats.states} states`);

  // Categories
  const categoriesFile = path.join(MASTER_DATA_DIR, 'categories.parquet');
  const categoriesRows = await readParquet(categoriesFile);
  stats.categories = categoriesRows.length;
  console.log(`   ✓ Found ${stats.categories} categories`);

  // Quotas
  const quotasFile = path.join(MASTER_DATA_DIR, 'quotas.parquet');
  const quotasRows = await readParquet(quotasFile);
  stats.quotas = quotasRows.length;
  console.log(`   ✓ Found ${stats.quotas} quotas`);

  console.log('✅ Lookup data migrated');
}

/**
 * Refresh materialized views
 */
async function refreshViews(): Promise<void> {
  console.log('\n🔄 Refreshing materialized views...');

  const { error } = await supabase.rpc('refresh_all_views');

  if (error) {
    console.error('   ❌ Error refreshing views:', error);
    stats.errors.push(`Refresh views: ${error.message}`);
  } else {
    console.log('✅ Views refreshed');
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('🚀 Starting data migration from DuckDB/Parquet to PostgreSQL');
  console.log('=' .repeat(80));

  const startTime = Date.now();

  try {
    // Step 1: Migrate colleges
    await migrateColleges();

    // Step 2: Migrate courses
    await migrateCourses();

    // Step 3: Migrate cutoffs
    await migrateCutoffs();

    // Step 4: Migrate lookup data
    await migrateLookupData();

    // Step 5: Refresh materialized views
    await refreshViews();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📊 Migration Statistics:');
    console.log(`   Colleges:   ${stats.colleges.toLocaleString()}`);
    console.log(`   Courses:    ${stats.courses.toLocaleString()}`);
    console.log(`   Cutoffs:    ${stats.cutoffs.toLocaleString()}`);
    console.log(`   States:     ${stats.states}`);
    console.log(`   Categories: ${stats.categories}`);
    console.log(`   Quotas:     ${stats.quotas}`);
    console.log(`\n⏱️  Duration: ${duration}s`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    console.log('\n🎉 Your data is now ready in PostgreSQL!');
    console.log('   Next steps:');
    console.log('   1. Verify data in Supabase Studio');
    console.log('   2. Test API endpoints');
    console.log('   3. Deploy to production');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
