#!/usr/bin/env tsx

import { freshDB } from '../src/lib/database/fresh-database';

async function initializeFreshDatabase() {
  console.log('🚀 Starting Fresh Database Initialization...');
  
  try {
    // Initialize the database
    await freshDB.initialize();
    
    // Get statistics
    const stats = await freshDB.getStats();
    
    console.log('\n📊 Database Statistics:');
    console.table(stats);
    
    console.log('\n✅ Fresh database initialization completed successfully!');
    console.log('🎯 Database is ready for all 45+ API endpoints');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    freshDB.close();
  }
}

// Run the initialization
initializeFreshDatabase();
