#!/usr/bin/env tsx

import * as duckdb from 'duckdb';
import path from 'path';

class SchemaChecker {
  private db: duckdb.Database;

  constructor() {
    this.db = new duckdb.Database(':memory:');
  }

  async checkSchema() {
    const parquetDir = path.join(process.cwd(), 'data', 'parquet');
    
    // Check colleges schema
    const collegesParquet = path.join(parquetDir, '2024', 'colleges_2024.parquet');
    console.log('📚 Colleges schema:');
    await this.checkTableSchema(collegesParquet);

    // Check courses schema
    const coursesParquet = path.join(parquetDir, '2024', 'courses_2024.parquet');
    console.log('\n📖 Courses schema:');
    await this.checkTableSchema(coursesParquet);

    // Check cutoffs schema
    const cutoffsParquet = path.join(parquetDir, '2024', 'cutoffs_2024.parquet');
    console.log('\n🎓 Cutoffs schema:');
    await this.checkTableSchema(cutoffsParquet);
  }

  async checkTableSchema(parquetPath: string) {
    return new Promise<void>((resolve, reject) => {
      this.db.all(`DESCRIBE SELECT * FROM read_parquet('${parquetPath}')`, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('Columns:');
        rows.forEach((row: any) => {
          console.log(`  ${row.column_name}: ${row.column_type}`);
        });
        
        resolve();
      });
    });
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const checker = new SchemaChecker();
  
  try {
    await checker.checkSchema();
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    checker.close();
  }
}

if (require.main === module) {
  main();
}
