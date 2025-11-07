import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';

export interface FreshMasterDatabaseConfig {
  dbPath: string;
  foundationDir: string;
}

export class FreshMasterDatabase {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private config: FreshMasterDatabaseConfig;

  constructor(config?: Partial<FreshMasterDatabaseConfig>) {
    this.config = {
      dbPath: path.join(process.cwd(), 'neetlogiq_master.db'),
      foundationDir: '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/',
      ...config
    };

    // Remove existing database if it exists
    if (fs.existsSync(this.config.dbPath)) {
      fs.unlinkSync(this.config.dbPath);
    }

    // Create fresh database
    this.db = new duckdb.Database(this.config.dbPath);
    this.conn = this.db.connect();
  }

  /**
   * Initialize the fresh master database with Foundation data
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Fresh Master Database...');
    
    try {
      // 1. Create all tables
      await this.createAllTables();
      
      // 2. Load Foundation data
      await this.loadFoundationData();
      
      // 3. Create indexes
      await this.createAllIndexes();
      
      // 4. Generate statistics
      await this.generateStatistics();
      
      console.log('✅ Fresh master database initialization completed successfully!');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create all database tables
   */
  private async createAllTables(): Promise<void> {
    console.log('📋 Creating all tables...');

    // States table
    await this.conn.exec(`
      CREATE TABLE states (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(10),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Categories table
    await this.conn.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(200),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Quotas table
    await this.conn.exec(`
      CREATE TABLE quotas (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(200),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Courses table
    await this.conn.exec(`
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        stream VARCHAR(50),
        degree_type VARCHAR(50),
        duration_years INTEGER,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Colleges table
    await this.conn.exec(`
      CREATE TABLE colleges (
        id INTEGER PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        state VARCHAR(100),
        address VARCHAR(500),
        type VARCHAR(50),
        management_type VARCHAR(50),
        university_affiliation VARCHAR(200),
        website VARCHAR(200),
        phone VARCHAR(20),
        email VARCHAR(100),
        established_year INTEGER,
        accreditation VARCHAR(200),
        recognition VARCHAR(200),
        total_courses INTEGER DEFAULT 0,
        total_seats INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // College courses table (seats data)
    await this.conn.exec(`
      CREATE TABLE college_courses (
        id INTEGER PRIMARY KEY,
        college_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        seats INTEGER DEFAULT 0,
        management_type VARCHAR(50),
        university_affiliation VARCHAR(200),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
      )
    `);

    // Counselling sessions table
    await this.conn.exec(`
      CREATE TABLE counselling_sessions (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        description VARCHAR(200),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Counselling records table
    await this.conn.exec(`
      CREATE TABLE counselling_records (
        id VARCHAR(100) PRIMARY KEY,
        session_id INTEGER NOT NULL,
        college_id INTEGER,
        course_id INTEGER,
        all_india_rank INTEGER,
        quota VARCHAR(100),
        category VARCHAR(50),
        round VARCHAR(50),
        year INTEGER,
        state VARCHAR(100),
        college_name VARCHAR(500),
        course_name VARCHAR(200),
        match_confidence DECIMAL(3,2) DEFAULT 0.0,
        match_method VARCHAR(50),
        needs_manual_review BOOLEAN DEFAULT FALSE,
        is_unmatched BOOLEAN DEFAULT FALSE,
        source_file VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES counselling_sessions(id),
        FOREIGN KEY (college_id) REFERENCES colleges(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
      )
    `);

    console.log('✅ All tables created successfully');
  }

  /**
   * Load Foundation data from Excel files
   */
  private async loadFoundationData(): Promise<void> {
    console.log('📊 Loading Foundation data...');

    // Load states
    await this.loadStates();
    
    // Load categories
    await this.loadCategories();
    
    // Load quotas
    await this.loadQuotas();
    
    // Load courses
    await this.loadCourses();
    
    // Load colleges
    await this.loadColleges();

    console.log('✅ Foundation data loaded successfully');
  }

  /**
   * Load states data
   */
  private async loadStates(): Promise<void> {
    const statesFile = path.join(this.config.foundationDir, 'STATES.xlsx');
    if (fs.existsSync(statesFile)) {
      // Read from Sheet1 with proper header
      const df = await this.readExcelFile(statesFile, 'Sheet1');
      
      for (let i = 0; i < df.length; i++) {
        const stateName = df[i][0];
        if (stateName && stateName !== 'STATES OF INDIA') {
          await this.conn.exec(`
            INSERT INTO states (id, name) VALUES (?, ?)
          `, [i, stateName]);
        }
      }
      console.log('  ✅ States loaded');
    }
  }

  /**
   * Load categories data
   */
  private async loadCategories(): Promise<void> {
    const categoriesFile = path.join(this.config.foundationDir, 'CATEGORY.xlsx');
    if (fs.existsSync(categoriesFile)) {
      const df = await this.readExcelFile(categoriesFile, 'Sheet1');
      
      for (let i = 0; i < df.length; i++) {
        const categoryName = df[i][0];
        if (categoryName && categoryName !== 'CATEGORY') {
          await this.conn.exec(`
            INSERT INTO categories (id, name) VALUES (?, ?)
          `, [i, categoryName]);
        }
      }
      console.log('  ✅ Categories loaded');
    }
  }

  /**
   * Load quotas data
   */
  private async loadQuotas(): Promise<void> {
    const quotasFile = path.join(this.config.foundationDir, 'QUOTA.xlsx');
    if (fs.existsSync(quotasFile)) {
      const df = await this.readExcelFile(quotasFile, 'Sheet1');
      
      for (let i = 0; i < df.length; i++) {
        const quotaName = df[i][0];
        if (quotaName && quotaName !== 'QUOTA') {
          await this.conn.exec(`
            INSERT INTO quotas (id, name) VALUES (?, ?)
          `, [i, quotaName]);
        }
      }
      console.log('  ✅ Quotas loaded');
    }
  }

  /**
   * Load courses data
   */
  private async loadCourses(): Promise<void> {
    const coursesFile = path.join(this.config.foundationDir, 'standard_courses.txt');
    if (fs.existsSync(coursesFile)) {
      const courses = fs.readFileSync(coursesFile, 'utf8').trim().split('\n');
      
      for (let i = 0; i < courses.length; i++) {
        const courseName = courses[i].trim();
        if (courseName) {
          // Determine stream and degree type
          let stream = 'Other';
          let degreeType = 'Other';
          let durationYears = 1;
          
          if (courseName.includes('MBBS') || courseName.includes('BDS')) {
            stream = 'Medical';
            degreeType = 'UG';
            durationYears = courseName.includes('MBBS') ? 5 : 4;
          } else if (courseName.includes('MD') || courseName.includes('MS') || courseName.includes('MDS')) {
            stream = courseName.includes('MDS') ? 'Dental' : 'Medical';
            degreeType = 'PG';
            durationYears = 3;
          } else if (courseName.includes('DNB')) {
            stream = 'DNB';
            degreeType = 'PG';
            durationYears = 3;
          } else if (courseName.includes('DIPLOMA')) {
            stream = 'Medical';
            degreeType = 'Diploma';
            durationYears = 2;
          }

          await this.conn.exec(`
            INSERT INTO courses (id, name, stream, degree_type, duration_years) VALUES (?, ?, ?, ?, ?)
          `, [i + 1, courseName, stream, degreeType, durationYears]);
        }
      }
      console.log('  ✅ Courses loaded');
    }
  }

  /**
   * Load colleges data
   */
  private async loadColleges(): Promise<void> {
    let collegeId = 1;

    // Load medical colleges
    await this.loadCollegesFromFile('med ad.xlsx', 'Medical', collegeId);
    collegeId += 1000; // Reserve space for medical colleges

    // Load dental colleges
    await this.loadCollegesFromFile('dental ad.xlsx', 'Dental', collegeId);
    collegeId += 1000; // Reserve space for dental colleges

    // Load DNB colleges
    await this.loadCollegesFromFile('dnb ad.xlsx', 'DNB', collegeId);
  }

  /**
   * Load colleges from specific file
   */
  private async loadCollegesFromFile(filename: string, type: string, startId: number): Promise<void> {
    const filePath = path.join(this.config.foundationDir, filename);
    if (fs.existsSync(filePath)) {
      const df = await this.readExcelFile(filePath, 'Sheet1');
      
      let collegeId = startId;
      for (let i = 1; i < df.length; i++) { // Skip header row
        const row = df[i];
        if (row && row.length >= 3) {
          const state = row[0];
          const collegeName = row[1];
          const address = row[2];

          if (state && collegeName) {
            await this.conn.exec(`
              INSERT INTO colleges (id, name, state, address, type) VALUES (?, ?, ?, ?, ?)
            `, [collegeId, collegeName, state, address, type]);
            collegeId++;
          }
        }
      }
      console.log(`  ✅ ${type} colleges loaded`);
    }
  }

  /**
   * Read Excel file and return data as array
   */
  private async readExcelFile(filePath: string, sheetName: string): Promise<any[][]> {
    // This is a simplified version - in production, you'd use a proper Excel reader
    // For now, we'll use a Python script to read the Excel file
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const { stdout } = await execAsync(`python3 -c "
import pandas as pd
import json
import sys

try:
    df = pd.read_excel('${filePath}', sheet_name='${sheetName}', header=None)
    data = df.values.tolist()
    print(json.dumps(data))
except Exception as e:
    print('[]')
    sys.exit(1)
"`);
      
      return JSON.parse(stdout);
    } catch (error) {
      console.error(`Error reading Excel file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Create all indexes for performance
   */
  private async createAllIndexes(): Promise<void> {
    console.log('⚡ Creating all indexes...');

    const indexes = [
      'CREATE INDEX idx_colleges_state ON colleges(state)',
      'CREATE INDEX idx_colleges_type ON colleges(type)',
      'CREATE INDEX idx_colleges_name ON colleges(name)',
      'CREATE INDEX idx_courses_stream ON courses(stream)',
      'CREATE INDEX idx_courses_degree_type ON courses(degree_type)',
      'CREATE INDEX idx_college_courses_college_id ON college_courses(college_id)',
      'CREATE INDEX idx_college_courses_course_id ON college_courses(course_id)',
      'CREATE INDEX idx_counselling_records_session_id ON counselling_records(session_id)',
      'CREATE INDEX idx_counselling_records_college_id ON counselling_records(college_id)',
      'CREATE INDEX idx_counselling_records_rank ON counselling_records(all_india_rank)',
      'CREATE INDEX idx_counselling_records_year ON counselling_records(year)',
      'CREATE INDEX idx_counselling_records_quota ON counselling_records(quota)',
      'CREATE INDEX idx_counselling_records_category ON counselling_records(category)'
    ];

    for (const indexQuery of indexes) {
      await this.conn.exec(indexQuery);
    }

    console.log('✅ All indexes created successfully');
  }

  /**
   * Generate initial statistics
   */
  private async generateStatistics(): Promise<void> {
    console.log('📊 Generating statistics...');

    const stats = await this.conn.all(`
      SELECT 
        'states' as table_name, COUNT(*) as count FROM states
      UNION ALL
      SELECT 'categories', COUNT(*) FROM categories
      UNION ALL
      SELECT 'quotas', COUNT(*) FROM quotas
      UNION ALL
      SELECT 'courses', COUNT(*) FROM courses
      UNION ALL
      SELECT 'colleges', COUNT(*) FROM colleges
      UNION ALL
      SELECT 'college_courses', COUNT(*) FROM college_courses
    `);

    console.log('📊 Master Database Statistics:');
    for (const stat of stats) {
      console.log(`  ${stat.table_name}: ${stat.count}`);
    }

    console.log('✅ Statistics generated successfully');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    return await this.conn.all(`
      SELECT 
        'states' as table_name, COUNT(*) as count FROM states
      UNION ALL
      SELECT 'categories', COUNT(*) FROM categories
      UNION ALL
      SELECT 'quotas', COUNT(*) FROM quotas
      UNION ALL
      SELECT 'courses', COUNT(*) FROM courses
      UNION ALL
      SELECT 'colleges', COUNT(*) FROM colleges
      UNION ALL
      SELECT 'college_courses', COUNT(*) FROM college_courses
      UNION ALL
      SELECT 'counselling_sessions', COUNT(*) FROM counselling_sessions
      UNION ALL
      SELECT 'counselling_records', COUNT(*) FROM counselling_records
    `);
  }

  /**
   * Execute query
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    return await this.conn.all(sql, params);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.conn.close();
    this.db.close();
  }
}

// Export singleton instance
export const freshMasterDB = new FreshMasterDatabase();
