import DuckDBParquetManager from '../src/lib/data/duckdb-parquet-manager';

async function main() {
  console.log('🚀 Initializing DuckDB Parquet Schema');
  console.log('=====================================');

  try {
    const manager = new DuckDBParquetManager();

    // Step 1: Initialize schema
    console.log('\n📊 Step 1: Creating Parquet schema...');
    await manager.initializeSchema();

    // Step 2: Load Foundation data
    console.log('\n📊 Step 2: Loading Foundation data...');
    await manager.loadFoundationData();

    // Step 3: Test queries
    console.log('\n📊 Step 3: Testing DuckDB queries...');
    
    // Test colleges query
    const colleges = await manager.query('SELECT COUNT(*) as count FROM colleges');
    console.log(`✅ Colleges count: ${colleges[0]?.count || 0}`);

    // Test states query
    const states = await manager.query('SELECT COUNT(*) as count FROM states');
    console.log(`✅ States count: ${states[0]?.count || 0}`);

    // Test relational query
    const collegeStates = await manager.query(`
      SELECT 
        c.name as college_name,
        c.city,
        c.state,
        c.college_type,
        c.management_type
      FROM colleges c
      WHERE c.status = 'active'
      LIMIT 5
    `);
    
    console.log('\n📋 Sample Colleges:');
    if (Array.isArray(collegeStates)) {
      collegeStates.forEach((college, index) => {
        console.log(`${index + 1}. ${college.college_name} (${college.city}, ${college.state})`);
      });
    } else {
      console.log('No colleges found or query returned unexpected format');
    }

    await manager.close();

    console.log('\n🎉 DuckDB Parquet schema initialized successfully!');
    console.log('\n📁 Parquet files created:');
    console.log('   - data/parquet/colleges.parquet');
    console.log('   - data/parquet/programs.parquet');
    console.log('   - data/parquet/cutoffs.parquet');
    console.log('   - data/parquet/states.parquet');
    console.log('   - data/parquet/cities.parquet');

  } catch (error: any) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
