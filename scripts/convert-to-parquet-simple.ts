#!/usr/bin/env tsx

import * as duckdb from 'duckdb';
import fs from 'fs';
import path from 'path';

interface College {
  id: string;
  name: string;
  state: string;
  city: string;
  type: string;
  management: string;
  university_affiliation?: string;
  website?: string;
  address?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  established_year?: number;
  recognition?: string;
  affiliation?: string;
  created_at?: string;
  updated_at?: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  stream: string;
  branch: string;
  degree_type: string;
  duration_years?: number;
  syllabus?: string;
  career_prospects?: string;
  created_at?: string;
  updated_at?: string;
}

interface CounsellingRecord {
  id: string;
  allIndiaRank: number;
  quota: string;
  collegeInstitute: string;
  course: string;
  category: string;
  round: number;
  year: number;
  openingRank?: number;
  closingRank?: number;
  openingPercentile?: number;
  closingPercentile?: number;
  seatsTotal?: number;
  seatsFilled?: number;
  counsellingType?: string;
  source?: string;
  verified?: boolean;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

class ParquetConverter {
  private db: duckdb.Database;

  constructor() {
    this.db = new duckdb.Database(':memory:');
  }

  async convertColleges() {
    console.log('📚 Converting colleges data...');
    
    const collegesPath = path.join(process.cwd(), 'data', 'colleges_master.json');
    const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
    const colleges: College[] = collegesData.colleges || [];

    console.log(`Found ${colleges.length} colleges`);

    // Create parquet directory structure
    const parquetDir = path.join(process.cwd(), 'data', 'parquet', '2024');
    if (!fs.existsSync(parquetDir)) {
      fs.mkdirSync(parquetDir, { recursive: true });
    }

    // Convert to parquet
    const parquetPath = path.join(parquetDir, 'colleges_2024.parquet');
    
    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE OR REPLACE TABLE colleges_temp AS 
        SELECT * FROM read_json_auto('${JSON.stringify(colleges)}')
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(`
          COPY colleges_temp TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY)
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`✅ Colleges converted to ${parquetPath}`);
          resolve();
        });
      });
    });
  }

  async convertCourses() {
    console.log('📖 Converting courses data...');
    
    const coursesPath = path.join(process.cwd(), 'data', 'courses_master.json');
    const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
    const courses: Course[] = coursesData.courses || [];

    console.log(`Found ${courses.length} courses`);

    const parquetDir = path.join(process.cwd(), 'data', 'parquet', '2024');
    const parquetPath = path.join(parquetDir, 'courses_2024.parquet');
    
    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE OR REPLACE TABLE courses_temp AS 
        SELECT * FROM read_json_auto('${JSON.stringify(courses)}')
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(`
          COPY courses_temp TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY)
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`✅ Courses converted to ${parquetPath}`);
          resolve();
        });
      });
    });
  }

  async convertCounsellingData() {
    console.log('🎓 Converting counselling data...');
    
    const counsellingPath = path.join(process.cwd(), 'data', 'staging', 'staging_counselling_records.json');
    const counsellingData: CounsellingRecord[] = JSON.parse(fs.readFileSync(counsellingPath, 'utf8'));

    console.log(`Found ${counsellingData.length} counselling records`);

    // Group by year
    const recordsByYear: { [year: number]: CounsellingRecord[] } = {};
    
    counsellingData.forEach(record => {
      const year = record.year || 2024;
      if (!recordsByYear[year]) {
        recordsByYear[year] = [];
      }
      recordsByYear[year].push(record);
    });

    // Convert each year to parquet
    for (const [year, records] of Object.entries(recordsByYear)) {
      console.log(`Converting ${records.length} records for year ${year}...`);
      
      const parquetDir = path.join(process.cwd(), 'data', 'parquet', year);
      if (!fs.existsSync(parquetDir)) {
        fs.mkdirSync(parquetDir, { recursive: true });
      }
      
      const parquetPath = path.join(parquetDir, `cutoffs_${year}.parquet`);
      
      await new Promise<void>((resolve, reject) => {
        this.db.run(`
          CREATE OR REPLACE TABLE cutoffs_temp AS 
          SELECT * FROM read_json_auto('${JSON.stringify(records)}')
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.run(`
            COPY cutoffs_temp TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION SNAPPY)
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log(`✅ Year ${year} counselling data converted to ${parquetPath}`);
            resolve();
          });
        });
      });
    }
  }

  async createUnifiedDatabase() {
    console.log('🗄️ Creating unified DuckDB database...');
    
    const dbPath = path.join(process.cwd(), 'data', 'neetlogiq.duckdb');
    
    return new Promise<void>((resolve, reject) => {
      // Create the main database
      this.db.run(`
        ATTACH '${dbPath}' AS main_db
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create tables
        this.db.run(`
          CREATE TABLE IF NOT EXISTS main_db.colleges (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            state TEXT,
            city TEXT,
            type TEXT NOT NULL,
            management TEXT,
            university_affiliation TEXT,
            website TEXT,
            address TEXT,
            pincode TEXT,
            phone TEXT,
            email TEXT,
            established_year INTEGER,
            recognition TEXT,
            affiliation TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.run(`
            CREATE TABLE IF NOT EXISTS main_db.courses (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              code TEXT,
              stream TEXT NOT NULL,
              branch TEXT,
              degree_type TEXT,
              duration_years INTEGER,
              syllabus TEXT,
              career_prospects TEXT,
              created_at TIMESTAMP,
              updated_at TIMESTAMP
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }

            this.db.run(`
              CREATE TABLE IF NOT EXISTS main_db.cutoffs (
                id TEXT PRIMARY KEY,
                allIndiaRank INTEGER,
                quota TEXT,
                collegeInstitute TEXT,
                course TEXT,
                category TEXT,
                round INTEGER,
                year INTEGER,
                openingRank INTEGER,
                closingRank INTEGER,
                openingPercentile DECIMAL,
                closingPercentile DECIMAL,
                seatsTotal INTEGER,
                seatsFilled INTEGER,
                counsellingType TEXT,
                source TEXT,
                verified BOOLEAN,
                metadata JSON,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
              )
            `, (err) => {
              if (err) {
                reject(err);
                return;
              }

              // Load data from parquet files
              this.loadDataFromParquet().then(resolve).catch(reject);
            });
          });
        });
      });
    });
  }

  async loadDataFromParquet() {
    const parquetDir = path.join(process.cwd(), 'data', 'parquet');
    
    // Load colleges
    const collegesParquet = path.join(parquetDir, '2024', 'colleges_2024.parquet');
    if (fs.existsSync(collegesParquet)) {
      await new Promise<void>((resolve, reject) => {
        this.db.run(`
          INSERT OR REPLACE INTO main_db.colleges 
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
          INSERT OR REPLACE INTO main_db.courses 
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
            INSERT OR REPLACE INTO main_db.cutoffs 
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

    const dbPath = path.join(process.cwd(), 'data', 'neetlogiq.duckdb');
    console.log(`✅ Unified database created at ${dbPath}`);
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const converter = new ParquetConverter();
  
  try {
    await converter.convertColleges();
    await converter.convertCourses();
    await converter.convertCounsellingData();
    await converter.createUnifiedDatabase();
    
    console.log('🎉 All data successfully converted to DuckDB + Parquet format!');
    console.log('\n📁 File structure created:');
    console.log('data/parquet/');
    console.log('├── 2023/');
    console.log('│   └── cutoffs_2023.parquet');
    console.log('├── 2024/');
    console.log('│   ├── colleges_2024.parquet');
    console.log('│   ├── courses_2024.parquet');
    console.log('│   └── cutoffs_2024.parquet');
    console.log('└── neetlogiq.duckdb');
    
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    process.exit(1);
  } finally {
    converter.close();
  }
}

if (require.main === module) {
  main();
}

export { ParquetConverter };
