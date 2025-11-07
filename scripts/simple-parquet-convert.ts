import fs from 'fs';
import path from 'path';
import { AsyncDuckDB } from '@duckdb/duckdb-wasm';

async function main() {
  console.log('🚀 Simple Parquet Conversion...');
  console.log('================================');

  const dataDir = path.join(process.cwd(), 'data');
  const parquetDir = path.join(dataDir, 'parquet');

  try {
    // Ensure parquet directory exists
    if (!fs.existsSync(parquetDir)) {
      fs.mkdirSync(parquetDir, { recursive: true });
    }

    // Initialize DuckDB
    const db = new AsyncDuckDB();
    await db.instantiate();

    // Read JSON data
    console.log('📊 Reading JSON data...');
    const colleges = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_colleges.json'), 'utf8'));
    const courses = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_courses.json'), 'utf8'));
    const seatData = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_seat_data.json'), 'utf8'));
    const dnbAggregations = JSON.parse(fs.readFileSync(path.join(dataDir, 'dnb_aggregations.json'), 'utf8'));

    console.log(`📊 Converting ${colleges.length} colleges to Parquet...`);
    await db.runQuery(`CREATE OR REPLACE TABLE colleges AS SELECT * FROM read_json_auto('${JSON.stringify(colleges)}')`, 0);
    await db.runQuery(`COPY colleges TO '${path.join(parquetDir, 'colleges.parquet')}' (FORMAT PARQUET, COMPRESSION SNAPPY)`, 0);

    console.log(`📊 Converting ${courses.length} courses to Parquet...`);
    await db.runQuery(`CREATE OR REPLACE TABLE courses AS SELECT * FROM read_json_auto('${JSON.stringify(courses)}')`, 0);
    await db.runQuery(`COPY courses TO '${path.join(parquetDir, 'courses.parquet')}' (FORMAT PARQUET, COMPRESSION SNAPPY)`, 0);

    console.log(`📊 Converting ${seatData.length} seat records to Parquet...`);
    await db.runQuery(`CREATE OR REPLACE TABLE seat_data AS SELECT * FROM read_json_auto('${JSON.stringify(seatData)}')`, 0);
    await db.runQuery(`COPY seat_data TO '${path.join(parquetDir, 'seat_data.parquet')}' (FORMAT PARQUET, COMPRESSION SNAPPY)`, 0);

    console.log(`📊 Converting ${dnbAggregations.length} DNB aggregations to Parquet...`);
    await db.runQuery(`CREATE OR REPLACE TABLE dnb_aggregations AS SELECT * FROM read_json_auto('${JSON.stringify(dnbAggregations)}')`, 0);
    await db.runQuery(`COPY dnb_aggregations TO '${path.join(parquetDir, 'dnb_aggregations.parquet')}' (FORMAT PARQUET, COMPRESSION SNAPPY)`, 0);

    await db.terminate();

    console.log('✅ Successfully converted to Parquet format!');
    console.log(`📁 Parquet files created in: ${parquetDir}`);

    // List created files
    const files = fs.readdirSync(parquetDir);
    console.log('\n📁 Created files:');
    files.forEach(file => {
      const filePath = path.join(parquetDir, file);
      const stats = fs.statSync(filePath);
      console.log(`   ${file}: ${(stats.size / 1024).toFixed(1)} KB`);
    });

  } catch (error: any) {
    console.error('❌ Parquet conversion failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
