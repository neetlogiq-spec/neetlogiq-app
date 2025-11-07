import { Database } from 'duckdb';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Simple DuckDB Parquet Creation');
  console.log('=================================');

  try {
    // Create database connection
    const db = new Database(':memory:');
    const connection = db.connect();
    
    const parquetDir = path.join(process.cwd(), 'data', 'parquet');
    
    // Ensure directory exists
    if (!fs.existsSync(parquetDir)) {
      fs.mkdirSync(parquetDir, { recursive: true });
    }

    // Create sample data
    const sampleColleges = [
      { id: 1, name: 'AIIMS Delhi', city: 'New Delhi', state: 'Delhi', college_type: 'MEDICAL', management_type: 'GOVERNMENT', status: 'active' },
      { id: 2, name: 'CMC Vellore', city: 'Vellore', state: 'Tamil Nadu', college_type: 'MEDICAL', management_type: 'PRIVATE', status: 'active' },
      { id: 3, name: 'JIPMER Puducherry', city: 'Puducherry', state: 'Puducherry', college_type: 'MEDICAL', management_type: 'GOVERNMENT', status: 'active' }
    ];

    const sampleStates = [
      { id: 1, name: 'Delhi', code: 'DL', status: 'active' },
      { id: 2, name: 'Tamil Nadu', code: 'TN', status: 'active' },
      { id: 3, name: 'Puducherry', code: 'PY', status: 'active' }
    ];

    // Create tables and write to Parquet
    console.log('📊 Creating colleges table...');
    connection.exec(`
      CREATE TABLE colleges AS 
      SELECT * FROM read_json_auto('${JSON.stringify(sampleColleges)}')
    `);

    const collegesPath = path.join(parquetDir, 'colleges.parquet');
    connection.exec(`
      COPY colleges TO '${collegesPath}' (FORMAT PARQUET)
    `);

    console.log('📊 Creating states table...');
    connection.exec(`
      CREATE TABLE states AS 
      SELECT * FROM read_json_auto('${JSON.stringify(sampleStates)}')
    `);

    const statesPath = path.join(parquetDir, 'states.parquet');
    connection.exec(`
      COPY states TO '${statesPath}' (FORMAT PARQUET)
    `);

    // Test reading the Parquet files
    console.log('📊 Testing Parquet file reading...');
    
    const collegesFromParquet = connection.all(`
      SELECT * FROM read_parquet('${collegesPath}')
    `);
    
    const statesFromParquet = connection.all(`
      SELECT * FROM read_parquet('${statesPath}')
    `);

    console.log('✅ Colleges from Parquet:', collegesFromParquet);
    console.log('✅ States from Parquet:', statesFromParquet);

    // Test relational query
    console.log('📊 Testing relational query...');
    const joinedData = connection.all(`
      SELECT 
        c.name as college_name,
        c.city,
        s.name as state_name,
        s.code as state_code
      FROM read_parquet('${collegesPath}') c
      JOIN read_parquet('${statesPath}') s ON c.state = s.name
    `);

    console.log('✅ Joined data:', joinedData);

    // Check if files were created
    console.log('\n📁 Checking created files:');
    if (fs.existsSync(collegesPath)) {
      const stats = fs.statSync(collegesPath);
      console.log(`✅ colleges.parquet created (${stats.size} bytes)`);
    } else {
      console.log('❌ colleges.parquet not created');
    }

    if (fs.existsSync(statesPath)) {
      const stats = fs.statSync(statesPath);
      console.log(`✅ states.parquet created (${stats.size} bytes)`);
    } else {
      console.log('❌ states.parquet not created');
    }

    connection.close();
    db.close();

    console.log('\n🎉 Simple DuckDB Parquet test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main();

