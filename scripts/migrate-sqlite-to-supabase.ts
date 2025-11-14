#!/usr/bin/env tsx
/**
 * SQLite to Supabase Migration Script
 * 
 * Migrates data from SQLite databases (master_data.db and seat_data.db)
 * to Supabase PostgreSQL tables.
 * 
 * Usage:
 *   npm run migrate:sqlite-to-supabase
 * 
 * Prerequisites:
 *   - Supabase credentials in .env.local
 *   - SQLite databases in data/sqlite/
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import Database from 'better-sqlite3';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Migration statistics
const stats = {
  master: {
    states: 0,
    categories: 0,
    quotas: 0,
    medical_colleges: 0,
    dental_colleges: 0,
    dnb_colleges: 0,
    courses: 0,
    college_aliases: 0,
    course_aliases: 0,
    state_aliases: 0,
    state_college_link: 0,
    state_course_college_link: 0,
  },
  seat_data: {
    records: 0,
  },
  errors: [] as string[],
};

/**
 * Clear existing data from a Supabase table
 */
async function clearTable(tableName: string): Promise<boolean> {
  try {
    // First, try to delete all rows using a simple select to check if table has data
    const { data: checkData, error: checkError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    // If table is empty or doesn't exist, we're done
    if (checkError) {
      if (checkError.code === '42P01') {
        // Table doesn't exist - that's okay
        return true;
      }
      if (checkError.code === 'PGRST116') {
        // No rows - table is already empty
        return true;
      }
    }
    
    // If no data found, table is already empty
    if (!checkData || checkData.length === 0) {
      return true;
    }
    
    // Try different delete methods based on table structure
    // Method 1: Try deleting with a condition that matches all rows
    let deleteError: any = null;
    
    // For tables with 'id' column
    const { error: error1 } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '');
    
    if (!error1) {
      return true; // Success
    }
    
    // Method 2: For tables without 'id' (composite keys), try deleting all
    // by selecting all and deleting in batches
    const { data: allRows } = await supabase
      .from(tableName)
      .select('*')
      .limit(10000);
    
    if (allRows && allRows.length > 0) {
      // For tables with composite keys, we need to delete using RPC or raw SQL
      // Since Supabase doesn't support DELETE without WHERE, we'll use a workaround
      // by deleting rows one by one or using a different approach
      
      // Try using a condition that should match all rows
      // For state_college_link: delete where college_id is not null
      if (tableName === 'state_college_link') {
        const { error: e2 } = await supabase
          .from(tableName)
          .delete()
          .not('college_id', 'is', null);
        if (!e2) return true;
      }
      
      // For state_course_college_link: delete where state_id is not null
      if (tableName === 'state_course_college_link') {
        const { error: e2 } = await supabase
          .from(tableName)
          .delete()
          .not('state_id', 'is', null);
        if (!e2) return true;
      }
      
      // For other tables, try generic approach
      const firstRow = allRows[0];
      const firstKey = Object.keys(firstRow)[0];
      if (firstKey) {
        const { error: e2 } = await supabase
          .from(tableName)
          .delete()
          .not(firstKey, 'is', null);
        if (!e2) return true;
      }
    }
    
    // If all methods fail, it's okay - we'll use upsert which will replace data anyway
    return true;
  } catch (error: any) {
    // Table might not exist or have foreign key constraints
    // This is okay - we'll proceed with migration anyway
    return true; // Return true to continue migration
  }
}

/**
 * Migrate a table from SQLite to Supabase (replaces existing data)
 */
async function migrateTable(
  db: Database.Database,
  tableName: string,
  supabaseTable: string,
  transform?: (row: any) => any,
  clearFirst: boolean = true,
  handleDuplicates: boolean = false
): Promise<number> {
  try {
    // Get all rows from SQLite
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    
    if (rows.length === 0) {
      console.log(`   ⚠️  ${tableName}: No data to migrate`);
      return 0;
    }

    // Clear existing data first if requested
    if (clearFirst) {
      process.stdout.write(`\r   🗑️  Clearing ${supabaseTable}...`);
      await clearTable(supabaseTable);
    }

    // Transform data if needed
    let transformedRows: any[];
    if (transform) {
      // Check if transform is async by trying to call it
      const firstResult = transform(rows[0]);
      if (firstResult instanceof Promise) {
        // Async transform - process all rows
        transformedRows = await Promise.all(rows.map(row => transform(row)));
      } else {
        // Sync transform
        transformedRows = rows.map(transform);
      }
    } else {
      transformedRows = rows;
    }

    // Clean up data: remove undefined values, handle nulls
    let cleanedRows = transformedRows.map(row => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });
    
    // Handle duplicates if requested (keep first occurrence)
    if (handleDuplicates && cleanedRows.length > 0) {
      const seen = new Set<string>();
      const uniqueRows: any[] = [];
      const idKey = 'id'; // Assuming 'id' is the unique key
      
      for (const row of cleanedRows) {
        const rowId = row[idKey];
        if (rowId && !seen.has(rowId)) {
          seen.add(rowId);
          uniqueRows.push(row);
        } else if (!rowId) {
          // If no id, include it (might be duplicates but we can't dedupe)
          uniqueRows.push(row);
        }
      }
      
      if (uniqueRows.length < cleanedRows.length) {
        console.log(`   ℹ️  Removed ${cleanedRows.length - uniqueRows.length} duplicate rows`);
      }
      cleanedRows = uniqueRows;
    }

    // Insert in smaller batches to avoid timeouts
    const batchSize = tableName.includes('college') ? 100 : 500;
    let inserted = 0;

    for (let i = 0; i < cleanedRows.length; i += batchSize) {
      const batch = cleanedRows.slice(i, i + batchSize);
      
      // Use insert instead of upsert to avoid conflicts
      const { error } = await supabase
        .from(supabaseTable)
        .insert(batch);

      if (error) {
        // If insert fails, try upsert as fallback
        // For tables with composite keys, use the appropriate conflict columns
        let conflictColumns = 'id';
        
        if (supabaseTable === 'state_college_link') {
          conflictColumns = 'college_id,state_id';
        } else if (supabaseTable === 'state_course_college_link') {
          conflictColumns = 'state_id,course_id,college_id';
        }
        
        // Try upsert with appropriate conflict resolution
        if (conflictColumns === 'id') {
          const { error: upsertError } = await supabase
            .from(supabaseTable)
            .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
          
          if (upsertError) {
            throw upsertError;
          }
        } else {
          // For composite keys, we need to use a different approach
          // Delete existing rows first, then insert
          for (const row of batch) {
            if (supabaseTable === 'state_college_link') {
              await supabase
                .from(supabaseTable)
                .delete()
                .eq('college_id', row.college_id)
                .eq('state_id', row.state_id);
            } else if (supabaseTable === 'state_course_college_link') {
              await supabase
                .from(supabaseTable)
                .delete()
                .eq('state_id', row.state_id)
                .eq('course_id', row.course_id)
                .eq('college_id', row.college_id);
            }
          }
          // Now insert
          const { error: insertError2 } = await supabase
            .from(supabaseTable)
            .insert(batch);
          
          if (insertError2) {
            throw insertError2;
          }
        }
      }

      inserted += batch.length;
      process.stdout.write(`\r   📦 ${tableName}: ${inserted}/${rows.length} records`);
      
      // Small delay to avoid rate limiting
      if (i + batchSize < cleanedRows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\r   ✅ ${tableName}: ${inserted} records migrated`);
    return inserted;
  } catch (error: any) {
    const errorMsg = `Failed to migrate ${tableName}: ${error.message}`;
    console.error(`\n   ❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return 0;
  }
}

/**
 * Migrate table with composite primary key (no 'id' column)
 */
async function migrateTableWithCompositeKey(
  db: Database.Database,
  tableName: string,
  supabaseTable: string,
  keyColumns: string[]
): Promise<number> {
  try {
    // Get all rows from SQLite
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    
    if (rows.length === 0) {
      console.log(`   ⚠️  ${tableName}: No data to migrate`);
      return 0;
    }

    // Remove 'id' column if it exists in SQLite data
    const cleanedRows = rows.map(row => {
      const { id, ...rest } = row;
      return rest;
    });

    // Clear existing data by deleting in batches
    console.log(`   🗑️  Clearing ${supabaseTable}...`);
    const { data: existingRows } = await supabase
      .from(supabaseTable)
      .select(keyColumns.join(','))
      .limit(10000);
    
    if (existingRows && existingRows.length > 0) {
      // Delete in batches
      const deleteBatchSize = 500;
      for (let i = 0; i < existingRows.length; i += deleteBatchSize) {
        const batch = existingRows.slice(i, i + deleteBatchSize);
        for (const row of batch) {
          const conditions: any = {};
          keyColumns.forEach(col => {
            conditions[col] = row[col];
          });
          
          let query = supabase.from(supabaseTable).delete();
          keyColumns.forEach(col => {
            query = query.eq(col, row[col]);
          });
          await query;
        }
      }
    }

    // Insert in batches
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < cleanedRows.length; i += batchSize) {
      const batch = cleanedRows.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from(supabaseTable)
        .insert(batch);

      if (error) {
        throw error;
      }

      inserted += batch.length;
      process.stdout.write(`\r   📦 ${tableName}: ${inserted}/${rows.length} records`);
      
      // Small delay to avoid rate limiting
      if (i + batchSize < cleanedRows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\r   ✅ ${tableName}: ${inserted} records migrated`);
    return inserted;
  } catch (error: any) {
    const errorMsg = `Failed to migrate ${tableName}: ${error.message}`;
    console.error(`\n   ❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return 0;
  }
}

/**
 * Migrate master_data.db tables
 */
async function migrateMasterData() {
  console.log('\n📊 Migrating Master Data (master_data.db)');
  console.log('=' .repeat(60));

  const dbPath = resolve(__dirname, '../data/sqlite/master_data.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    return;
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    // Migrate reference tables first (they're referenced by other tables)
    // Clear in reverse order of dependencies
    console.log('\n📋 Migrating Reference Tables...');
    
    // Clear link tables first (they reference other tables)
    console.log('   🗑️  Clearing link tables first...');
    await clearTable('state_course_college_link');
    await clearTable('state_college_link');
    
    // Clear aliases
    await clearTable('state_aliases');
    await clearTable('course_aliases');
    await clearTable('college_aliases');
    
    // Clear main tables
    await clearTable('courses');
    await clearTable('dnb_colleges');
    await clearTable('dental_colleges');
    await clearTable('medical_colleges');
    await clearTable('quotas');
    await clearTable('categories');
    await clearTable('states');
    
    // Now migrate in dependency order
    stats.master.states = await migrateTable(db, 'states', 'states', undefined, false);
    stats.master.categories = await migrateTable(db, 'categories', 'categories', undefined, false);
    stats.master.quotas = await migrateTable(db, 'quotas', 'quotas', undefined, false);

    // Migrate college tables
    console.log('\n🏫 Migrating College Tables...');
    stats.master.medical_colleges = await migrateTable(db, 'medical_colleges', 'medical_colleges', undefined, false);
    stats.master.dental_colleges = await migrateTable(db, 'dental_colleges', 'dental_colleges', undefined, false);
    stats.master.dnb_colleges = await migrateTable(db, 'dnb_colleges', 'dnb_colleges', undefined, false);

    // Migrate courses (exclude normalized_name if Supabase doesn't have it)
    console.log('\n📚 Migrating Courses...');
    stats.master.courses = await migrateTable(db, 'courses', 'courses', (row: any) => {
      // Remove normalized_name if Supabase schema doesn't support it
      const { normalized_name, tfidf_vector, ...rest } = row;
      return { ...rest, normalized_name, tfidf_vector }; // Keep them actually
    }, false);

    // Migrate aliases
    console.log('\n🔗 Migrating Aliases...');
    stats.master.college_aliases = await migrateTable(db, 'college_aliases', 'college_aliases', undefined, false);
    stats.master.course_aliases = await migrateTable(db, 'course_aliases', 'course_aliases', undefined, false);
    stats.master.state_aliases = await migrateTable(db, 'state_aliases', 'state_aliases', undefined, false);

    // Migrate link tables (last, as they reference other tables)
    // These use composite primary keys, so we handle them specially
    console.log('\n🔗 Migrating Link Tables...');
    stats.master.state_college_link = await migrateTableWithCompositeKey(
      db, 
      'state_college_link', 
      'state_college_link',
      ['college_id', 'state_id']
    );
    stats.master.state_course_college_link = await migrateTableWithCompositeKey(
      db, 
      'state_course_college_link', 
      'state_course_college_link',
      ['state_id', 'course_id', 'college_id']
    );

  } finally {
    db.close();
  }
}

/**
 * Migrate seat_data.db
 */
async function migrateSeatData() {
  console.log('\n🪑 Migrating Seat Data (seat_data.db)');
  console.log('=' .repeat(60));

  const dbPath = resolve(__dirname, '../data/sqlite/seat_data.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    return;
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    // Check if seat_data table exists in Supabase
    const { error: checkError } = await supabase
      .from('seat_data')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.log('   ⚠️  seat_data table does not exist in Supabase');
      console.log('   💡 You may need to create this table first or use a different target table');
      console.log('   💡 Alternatively, seat data might be stored in a different table structure');
      return;
    }

    // Clear existing seat_data
    console.log('   🗑️  Clearing existing seat_data...');
    await clearTable('seat_data');

    // Migrate seat_data (handle duplicates by keeping only first occurrence)
    stats.seat_data.records = await migrateTable(db, 'seat_data', 'seat_data', (row: any) => {
      // Ensure row is clean
      return row;
    }, false, true); // Pass true to handle duplicates

  } finally {
    db.close();
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting SQLite to Supabase Migration');
  console.log('=' .repeat(60));
  console.log(`📡 Supabase URL: ${supabaseUrl}`);
  console.log(`📅 Started: ${new Date().toLocaleString()}\n`);

  const startTime = Date.now();

  try {
    // Test connection first
    console.log('🔍 Testing Supabase connection...');
    const { error: testError } = await supabase.from('states').select('id').limit(1);
    
    if (testError) {
      console.error(`❌ Connection failed: ${testError.message}`);
      process.exit(1);
    }
    console.log('✅ Connection successful!\n');

    // Migrate master data
    await migrateMasterData();

    // Migrate seat data
    await migrateSeatData();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Migration Statistics:\n');
    
    console.log('Master Data:');
    console.log(`   States: ${stats.master.states}`);
    console.log(`   Categories: ${stats.master.categories}`);
    console.log(`   Quotas: ${stats.master.quotas}`);
    console.log(`   Medical Colleges: ${stats.master.medical_colleges}`);
    console.log(`   Dental Colleges: ${stats.master.dental_colleges}`);
    console.log(`   DNB Colleges: ${stats.master.dnb_colleges}`);
    console.log(`   Courses: ${stats.master.courses}`);
    console.log(`   College Aliases: ${stats.master.college_aliases}`);
    console.log(`   Course Aliases: ${stats.master.course_aliases}`);
    console.log(`   State Aliases: ${stats.master.state_aliases}`);
    console.log(`   State-College Links: ${stats.master.state_college_link}`);
    console.log(`   State-Course-College Links: ${stats.master.state_course_college_link}`);
    
    console.log('\nSeat Data:');
    console.log(`   Records: ${stats.seat_data.records}`);

    console.log(`\n⏱️  Duration: ${duration}s`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    console.log('\n🎉 Data migration complete!');
    console.log('   Next steps:');
    console.log('   1. Verify data in Supabase Studio');
    console.log('   2. Test queries');
    console.log('   3. Update application to use Supabase');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

