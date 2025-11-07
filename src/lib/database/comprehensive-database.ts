import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';

export interface DatabaseConfig {
  dbPath: string;
  dataDir: string;
  parquetDir: string;
}

export class ComprehensiveDatabase {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private config: DatabaseConfig;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      dbPath: path.join(process.cwd(), 'neetlogiq_comprehensive.db'),
      dataDir: path.join(process.cwd(), 'data'),
      parquetDir: path.join(process.cwd(), 'data', 'parquet'),
      ...config
    };

    // Create database
    this.db = new duckdb.Database(this.config.dbPath);
    this.conn = this.db.connect();
  }

  /**
   * Initialize the comprehensive database with all data
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Comprehensive NeetLogIQ Database...');
    
    try {
      // 1. Create core tables
      await this.createCoreTables();
      
      // 2. Load reference data
      await this.loadReferenceData();
      
      // 3. Load counselling data
      await this.loadCounsellingData();
      
      // 4. Create aggregated tables
      await this.createAggregatedTables();
      
      // 5. Create indexes for performance
      await this.createIndexes();
      
      console.log('✅ Database initialization completed successfully!');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create core tables for the database
   */
  private async createCoreTables(): Promise<void> {
    console.log('📋 Creating core tables...');

    // States table
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS states (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) NOT NULL UNIQUE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cities table
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        state_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (state_id) REFERENCES states(id)
      )
    `);

    // Colleges table
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS colleges (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        state VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        type VARCHAR(50),
        management_type VARCHAR(50),
        is_government BOOLEAN DEFAULT FALSE,
        is_private BOOLEAN DEFAULT FALSE,
        is_trust BOOLEAN DEFAULT FALSE,
        established_year INTEGER,
        university VARCHAR(200),
        website VARCHAR(500),
        phone VARCHAR(20),
        email VARCHAR(100),
        accreditation VARCHAR(200),
        recognition VARCHAR(200),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Courses table
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        stream VARCHAR(100),
        branch VARCHAR(100),
        duration_years INTEGER,
        degree_type VARCHAR(50),
        total_seats INTEGER DEFAULT 0,
        cutoff_rank INTEGER,
        fees DECIMAL(10,2),
        college_id VARCHAR(50),
        college_name VARCHAR(500),
        description TEXT,
        eligibility TEXT,
        syllabus TEXT,
        career_prospects TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id)
      )
    `);

    // Cutoffs table
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS cutoffs (
        id VARCHAR(100) PRIMARY KEY,
        college_id VARCHAR(50) NOT NULL,
        college_name VARCHAR(500),
        course_id VARCHAR(50),
        course_name VARCHAR(200),
        year INTEGER NOT NULL,
        category VARCHAR(50),
        opening_rank INTEGER,
        closing_rank INTEGER,
        round VARCHAR(20),
        state VARCHAR(100),
        quota VARCHAR(50),
        seat_type VARCHAR(50),
        all_india_rank INTEGER,
        source_file VARCHAR(100),
        match_confidence DECIMAL(3,2),
        match_method VARCHAR(50),
        needs_manual_review BOOLEAN DEFAULT FALSE,
        is_unmatched BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id),
        FOREIGN KEY (course_id) REFERENCES courses(id)
      )
    `);

    // Analytics table
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id VARCHAR(50) PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL(15,2),
        metric_data JSON,
        year INTEGER,
        month INTEGER,
        day INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Core tables created successfully');
  }

  /**
   * Load reference data (states, cities)
   */
  private async loadReferenceData(): Promise<void> {
    console.log('🌍 Loading reference data...');

    // Load states from parquet
    const statesFile = path.join(this.config.parquetDir, 'states.parquet');
    if (fs.existsSync(statesFile)) {
      await this.conn.exec(`
        INSERT OR REPLACE INTO states (id, name, code, status, created_at)
        SELECT id, name, code, status, created_at FROM '${statesFile}'
      `);
    }

    // Load cities from parquet
    const citiesFile = path.join(this.config.parquetDir, 'cities.parquet');
    if (fs.existsSync(citiesFile)) {
      await this.conn.exec(`
        INSERT OR REPLACE INTO cities (id, name, state_id, status, created_at)
        SELECT id, name, state_id, status, created_at FROM '${citiesFile}'
      `);
    }

    console.log('✅ Reference data loaded successfully');
  }

  /**
   * Load counselling data from all parquet files
   */
  private async loadCounsellingData(): Promise<void> {
    console.log('📊 Loading counselling data...');

    const parquetFiles = [
      'aiq2023_counselling_processed.parquet',
      'aiq2024_counselling_processed.parquet',
      'kea2023_counselling_processed.parquet',
      'kea2024_counselling_processed.parquet',
      'keadental2024_counselling_processed.parquet'
    ];

    for (const file of parquetFiles) {
      const filePath = path.join(this.config.parquetDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`  Loading ${file}...`);
        
        // Load data into temporary table
        await this.conn.exec(`
          CREATE TEMPORARY TABLE temp_counselling AS 
          SELECT * FROM '${filePath}'
        `);

        // Extract and insert colleges
        await this.conn.exec(`
          INSERT OR REPLACE INTO colleges (
            id, name, state, city, address, type, management_type,
            is_government, is_private, is_trust, established_year,
            university, accreditation, recognition, status
          )
          SELECT DISTINCT
            matchedCollegeId as id,
            matchedCollegeName as name,
            state,
            NULL as city,
            collegeAddress as address,
            CASE 
              WHEN course LIKE '%MD%' OR course LIKE '%MS%' THEN 'Medical'
              WHEN course LIKE '%MDS%' THEN 'Dental'
              WHEN course LIKE '%DNB%' THEN 'DNB'
              ELSE 'Other'
            END as type,
            CASE 
              WHEN matchedCollegeName LIKE '%GOVERNMENT%' OR matchedCollegeName LIKE '%GMC%' THEN 'Government'
              WHEN matchedCollegeName LIKE '%PRIVATE%' THEN 'Private'
              ELSE 'Unknown'
            END as management_type,
            CASE WHEN matchedCollegeName LIKE '%GOVERNMENT%' OR matchedCollegeName LIKE '%GMC%' THEN TRUE ELSE FALSE END as is_government,
            CASE WHEN matchedCollegeName LIKE '%PRIVATE%' THEN TRUE ELSE FALSE END as is_private,
            FALSE as is_trust,
            NULL as established_year,
            NULL as university,
            NULL as accreditation,
            NULL as recognition,
            'active' as status
          FROM temp_counselling
          WHERE matchedCollegeId IS NOT NULL 
            AND matchedCollegeName IS NOT NULL
            AND matchConfidence > 0.5
        `);

        // Extract and insert courses
        await this.conn.exec(`
          INSERT OR REPLACE INTO courses (
            id, name, stream, branch, duration_years, degree_type,
            college_id, college_name, description, eligibility, syllabus, career_prospects
          )
          SELECT DISTINCT
            'course_' || ROW_NUMBER() OVER (ORDER BY course) as id,
            course as name,
            CASE 
              WHEN course LIKE '%MD%' THEN 'Medical'
              WHEN course LIKE '%MS%' THEN 'Medical'
              WHEN course LIKE '%MDS%' THEN 'Dental'
              WHEN course LIKE '%DNB%' THEN 'DNB'
              ELSE 'Other'
            END as stream,
            CASE 
              WHEN course LIKE '%GENERAL MEDICINE%' THEN 'General Medicine'
              WHEN course LIKE '%GENERAL SURGERY%' THEN 'General Surgery'
              WHEN course LIKE '%RADIO DIAGNOSIS%' THEN 'Radiology'
              WHEN course LIKE '%PATHOLOGY%' THEN 'Pathology'
              WHEN course LIKE '%ANESTHESIA%' THEN 'Anesthesia'
              WHEN course LIKE '%ORTHOPEDICS%' THEN 'Orthopedics'
              WHEN course LIKE '%PEDIATRICS%' THEN 'Pediatrics'
              WHEN course LIKE '%OBSTETRICS%' THEN 'Obstetrics'
              WHEN course LIKE '%PSYCHIATRY%' THEN 'Psychiatry'
              WHEN course LIKE '%DERMATOLOGY%' THEN 'Dermatology'
              WHEN course LIKE '%OPHTHALMOLOGY%' THEN 'Ophthalmology'
              WHEN course LIKE '%ENT%' THEN 'ENT'
              WHEN course LIKE '%PERIODONTOLOGY%' THEN 'Periodontology'
              WHEN course LIKE '%ORTHODONTICS%' THEN 'Orthodontics'
              WHEN course LIKE '%ORAL SURGERY%' THEN 'Oral Surgery'
              WHEN course LIKE '%CONSERVATIVE%' THEN 'Conservative Dentistry'
              WHEN course LIKE '%PROSTHODONTICS%' THEN 'Prosthodontics'
              ELSE 'Other'
            END as branch,
            CASE 
              WHEN course LIKE '%MD%' THEN 3
              WHEN course LIKE '%MS%' THEN 3
              WHEN course LIKE '%MDS%' THEN 3
              WHEN course LIKE '%DNB%' THEN 3
              ELSE 1
            END as duration_years,
            CASE 
              WHEN course LIKE '%MD%' THEN 'MD'
              WHEN course LIKE '%MS%' THEN 'MS'
              WHEN course LIKE '%MDS%' THEN 'MDS'
              WHEN course LIKE '%DNB%' THEN 'DNB'
              ELSE 'Other'
            END as degree_type,
            matchedCollegeId as college_id,
            matchedCollegeName as college_name,
            NULL as description,
            NULL as eligibility,
            NULL as syllabus,
            NULL as career_prospects
          FROM temp_counselling
          WHERE course IS NOT NULL 
            AND course != ''
            AND course NOT LIKE '%NBEMS%'
            AND course NOT LIKE '%  %'
        `);

        // Insert cutoffs data
        await this.conn.exec(`
          INSERT OR REPLACE INTO cutoffs (
            id, college_id, college_name, course_id, course_name,
            year, category, opening_rank, closing_rank, round, state,
            quota, seat_type, all_india_rank, source_file, match_confidence,
            match_method, needs_manual_review, is_unmatched
          )
          SELECT 
            'cutoff_' || id as id,
            matchedCollegeId as college_id,
            matchedCollegeName as college_name,
            'course_' || ROW_NUMBER() OVER (ORDER BY course) as course_id,
            course as course_name,
            CAST(year AS INTEGER) as year,
            category,
            CAST(allIndiaRank AS INTEGER) as opening_rank,
            CAST(allIndiaRank AS INTEGER) as closing_rank,
            round,
            state,
            quota,
            'General' as seat_type,
            CAST(allIndiaRank AS INTEGER) as all_india_rank,
            sourceFile as source_file,
            CAST(matchConfidence AS DECIMAL(3,2)) as match_confidence,
            matchMethod as match_method,
            CAST(needsManualReview AS BOOLEAN) as needs_manual_review,
            CAST(isUnmatched AS BOOLEAN) as is_unmatched
          FROM temp_counselling
          WHERE matchedCollegeId IS NOT NULL
            AND course IS NOT NULL
            AND year IS NOT NULL
            AND allIndiaRank IS NOT NULL
        `);

        // Drop temporary table
        await this.conn.exec('DROP TABLE temp_counselling');
      }
    }

    console.log('✅ Counselling data loaded successfully');
  }

  /**
   * Create aggregated tables for analytics
   */
  private async createAggregatedTables(): Promise<void> {
    console.log('📈 Creating aggregated tables...');

    // College statistics
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS college_stats AS
      SELECT 
        c.id,
        c.name,
        c.state,
        c.type,
        c.management_type,
        COUNT(DISTINCT co.id) as total_courses,
        COUNT(DISTINCT cu.year) as years_active,
        COUNT(cu.id) as total_cutoffs,
        AVG(cu.match_confidence) as avg_confidence,
        MIN(cu.opening_rank) as best_rank,
        MAX(cu.closing_rank) as worst_rank,
        COUNT(DISTINCT cu.quota) as quota_types,
        COUNT(DISTINCT cu.source_file) as data_sources
      FROM colleges c
      LEFT JOIN courses co ON c.id = co.college_id
      LEFT JOIN cutoffs cu ON c.id = cu.college_id
      GROUP BY c.id, c.name, c.state, c.type, c.management_type
    `);

    // Course statistics
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS course_stats AS
      SELECT 
        co.id,
        co.name,
        co.stream,
        co.branch,
        co.degree_type,
        COUNT(DISTINCT co.college_id) as total_colleges,
        COUNT(DISTINCT cu.year) as years_offered,
        COUNT(cu.id) as total_cutoffs,
        AVG(cu.opening_rank) as avg_opening_rank,
        AVG(cu.closing_rank) as avg_closing_rank,
        MIN(cu.opening_rank) as best_rank,
        MAX(cu.closing_rank) as worst_rank
      FROM courses co
      LEFT JOIN cutoffs cu ON co.id = cu.course_id
      GROUP BY co.id, co.name, co.stream, co.branch, co.degree_type
    `);

    // Year-wise statistics
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS year_stats AS
      SELECT 
        cu.year,
        COUNT(DISTINCT cu.college_id) as total_colleges,
        COUNT(DISTINCT cu.course_id) as total_courses,
        COUNT(cu.id) as total_cutoffs,
        AVG(cu.opening_rank) as avg_opening_rank,
        AVG(cu.closing_rank) as avg_closing_rank,
        AVG(cu.match_confidence) as avg_confidence,
        COUNT(DISTINCT cu.source_file) as data_sources
      FROM cutoffs cu
      GROUP BY cu.year
    `);

    console.log('✅ Aggregated tables created successfully');
  }

  /**
   * Create indexes for performance
   */
  private async createIndexes(): Promise<void> {
    console.log('⚡ Creating indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state)',
      'CREATE INDEX IF NOT EXISTS idx_colleges_type ON colleges(type)',
      'CREATE INDEX IF NOT EXISTS idx_colleges_management ON colleges(management_type)',
      'CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream)',
      'CREATE INDEX IF NOT EXISTS idx_courses_branch ON courses(branch)',
      'CREATE INDEX IF NOT EXISTS idx_courses_college_id ON courses(college_id)',
      'CREATE INDEX IF NOT EXISTS idx_cutoffs_college_id ON cutoffs(college_id)',
      'CREATE INDEX IF NOT EXISTS idx_cutoffs_course_id ON cutoffs(course_id)',
      'CREATE INDEX IF NOT EXISTS idx_cutoffs_year ON cutoffs(year)',
      'CREATE INDEX IF NOT EXISTS idx_cutoffs_rank ON cutoffs(opening_rank, closing_rank)',
      'CREATE INDEX IF NOT EXISTS idx_cutoffs_quota ON cutoffs(quota)',
      'CREATE INDEX IF NOT EXISTS idx_cutoffs_state ON cutoffs(state)'
    ];

    for (const indexQuery of indexes) {
      await this.conn.exec(indexQuery);
    }

    console.log('✅ Indexes created successfully');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    const stats = await this.conn.all(`
      SELECT 
        'colleges' as table_name, COUNT(*) as count FROM colleges
      UNION ALL
      SELECT 'courses', COUNT(*) FROM courses
      UNION ALL
      SELECT 'cutoffs', COUNT(*) FROM cutoffs
      UNION ALL
      SELECT 'states', COUNT(*) FROM states
      UNION ALL
      SELECT 'cities', COUNT(*) FROM cities
    `);

    return stats;
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
export const comprehensiveDB = new ComprehensiveDatabase();
