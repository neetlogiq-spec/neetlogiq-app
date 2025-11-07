#!/usr/bin/env tsx

import * as duckdb from 'duckdb';
import fs from 'fs';
import path from 'path';

class DatabaseCreator {
  private db: duckdb.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'neetlogiq.duckdb');
    this.db = new duckdb.Database(dbPath);
  }

  async createTables() {
    console.log('🗄️ Creating database tables with correct schema...');
    
    return new Promise<void>((resolve, reject) => {
      // Create colleges table with correct schema
      this.db.run(`
        CREATE TABLE IF NOT EXISTS colleges (
          id VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          state VARCHAR,
          city VARCHAR,
          type VARCHAR NOT NULL,
          management VARCHAR,
          university_affiliation VARCHAR,
          website VARCHAR,
          address VARCHAR,
          established_year JSON,
          recognition VARCHAR,
          affiliation VARCHAR,
          created_at VARCHAR,
          updated_at VARCHAR
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create courses table with correct schema
        this.db.run(`
          CREATE TABLE IF NOT EXISTS courses (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            code VARCHAR,
            stream VARCHAR NOT NULL,
            branch VARCHAR,
            degree_type VARCHAR,
            duration_years DOUBLE,
            syllabus VARCHAR,
            career_prospects VARCHAR,
            created_at VARCHAR,
            updated_at VARCHAR
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Create cutoffs table with correct schema
          this.db.run(`
            CREATE TABLE IF NOT EXISTS cutoffs (
              id VARCHAR PRIMARY KEY,
              allIndiaRank BIGINT,
              quota VARCHAR,
              collegeInstitute VARCHAR,
              course VARCHAR,
              category VARCHAR,
              round BIGINT,
              year BIGINT,
              sourceFile VARCHAR,
              createdAt VARCHAR,
              updatedAt VARCHAR
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }

            console.log('✅ Database tables created with correct schema');
            resolve();
          });
        });
      });
    });
  }

  async loadData() {
    console.log('📊 Loading data from parquet files...');
    
    const parquetDir = path.join(process.cwd(), 'data', 'parquet');
    
    // Load colleges
    const collegesParquet = path.join(parquetDir, '2024', 'colleges_2024.parquet');
    if (fs.existsSync(collegesParquet)) {
      await new Promise<void>((resolve, reject) => {
        this.db.run(`
          INSERT OR REPLACE INTO colleges 
          SELECT * FROM read_parquet('${collegesParquet}')
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('✅ Colleges loaded into database');
          resolve();
        });
      });
    }

    // Load courses
    const coursesParquet = path.join(parquetDir, '2024', 'courses_2024.parquet');
    if (fs.existsSync(coursesParquet)) {
      await new Promise<void>((resolve, reject) => {
        this.db.run(`
          INSERT OR REPLACE INTO courses 
          SELECT * FROM read_parquet('${coursesParquet}')
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('✅ Courses loaded into database');
          resolve();
        });
      });
    }

    // Load cutoffs for all years
    const years = ['2023', '2024'];
    for (const year of years) {
      const cutoffsParquet = path.join(parquetDir, year, `cutoffs_${year}.parquet`);
      if (fs.existsSync(cutoffsParquet)) {
        await new Promise<void>((resolve, reject) => {
          this.db.run(`
            INSERT OR REPLACE INTO cutoffs 
            SELECT * FROM read_parquet('${cutoffsParquet}')
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log(`✅ Year ${year} cutoffs loaded into database`);
            resolve();
          });
        });
      }
    }
  }

  async getStats() {
    console.log('📈 Getting database statistics...');
    
    return new Promise<void>((resolve, reject) => {
      this.db.all('SELECT COUNT(*) as count FROM colleges', (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`📚 Colleges: ${rows[0].count}`);

        this.db.all('SELECT COUNT(*) as count FROM courses', (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`📖 Courses: ${rows[0].count}`);

          this.db.all('SELECT COUNT(*) as count FROM cutoffs', (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            console.log(`🎓 Cutoffs: ${rows[0].count}`);
            resolve();
          });
        });
      });
    });
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const creator = new DatabaseCreator();
  
  try {
    await creator.createTables();
    await creator.loadData();
    await creator.getStats();
    
    console.log('🎉 Database setup completed successfully!');
    console.log('\n📁 Database file created at: data/neetlogiq.duckdb');
    
  } catch (error) {
    console.error('❌ Error during database setup:', error);
    process.exit(1);
  } finally {
    creator.close();
  }
}

if (require.main === module) {
  main();
}

export { DatabaseCreator };
