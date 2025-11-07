import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';

export interface FreshDatabaseConfig {
  dbPath: string;
  dataDir: string;
  parquetDir: string;
}

export class FreshDatabase {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private config: FreshDatabaseConfig;

  constructor(config?: Partial<FreshDatabaseConfig>) {
    this.config = {
      dbPath: path.join(process.cwd(), 'neetlogiq_fresh.db'),
      dataDir: path.join(process.cwd(), 'data'),
      parquetDir: path.join(process.cwd(), 'data', 'parquet'),
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
   * Initialize the fresh database with all data
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Fresh NeetLogIQ Database...');
    
    try {
      // 1. Create all tables
      await this.createAllTables();
      
      // 2. Load all data
      await this.loadAllData();
      
      // 3. Create indexes
      await this.createAllIndexes();
      
      // 4. Generate statistics
      await this.generateStatistics();
      
      console.log('✅ Fresh database initialization completed successfully!');
      
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
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) NOT NULL UNIQUE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cities table
    await this.conn.exec(`
      CREATE TABLE cities (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        state_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (state_id) REFERENCES states(id)
      )
    `);

    // Colleges table - Main college information
    await this.conn.exec(`
      CREATE TABLE colleges (
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
        total_courses INTEGER DEFAULT 0,
        total_seats INTEGER DEFAULT 0,
        avg_cutoff_rank INTEGER,
        best_rank INTEGER,
        worst_rank INTEGER,
        years_active INTEGER DEFAULT 0,
        match_confidence DECIMAL(3,2) DEFAULT 0.0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Courses table - Course information
    await this.conn.exec(`
      CREATE TABLE courses (
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
        total_colleges INTEGER DEFAULT 0,
        years_offered INTEGER DEFAULT 0,
        avg_opening_rank INTEGER,
        avg_closing_rank INTEGER,
        best_rank INTEGER,
        worst_rank INTEGER,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (college_id) REFERENCES colleges(id)
      )
    `);

    // Cutoffs table - Cutoff data
    await this.conn.exec(`
      CREATE TABLE cutoffs (
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

    // Analytics table - Platform analytics
    await this.conn.exec(`
      CREATE TABLE analytics (
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

    // User preferences table
    await this.conn.exec(`
      CREATE TABLE user_preferences (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        preferences JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Search history table
    await this.conn.exec(`
      CREATE TABLE search_history (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50),
        query VARCHAR(500),
        results_count INTEGER,
        search_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All tables created successfully');
  }

  /**
   * Load all data from parquet files
   */
  private async loadAllData(): Promise<void> {
    console.log('📊 Loading all data...');

    // Load states
    await this.loadStates();
    
    // Load cities
    await this.loadCities();
    
    // Load counselling data
    await this.loadCounsellingData();
    
    // Update college statistics
    await this.updateCollegeStatistics();
    
    // Update course statistics
    await this.updateCourseStatistics();

    console.log('✅ All data loaded successfully');
  }

  /**
   * Load states data
   */
  private async loadStates(): Promise<void> {
    const statesFile = path.join(this.config.parquetDir, 'states.parquet');
    if (fs.existsSync(statesFile)) {
      await this.conn.exec(`
        INSERT INTO states (id, name, code, status, created_at)
        SELECT id, name, code, status, created_at FROM '${statesFile}'
      `);
      console.log('  ✅ States loaded');
    }
  }

  /**
   * Load cities data
   */
  private async loadCities(): Promise<void> {
    const citiesFile = path.join(this.config.parquetDir, 'cities.parquet');
    if (fs.existsSync(citiesFile)) {
      await this.conn.exec(`
        INSERT INTO cities (id, name, state_id, status, created_at)
        SELECT id, name, state_id, status, created_at FROM '${citiesFile}'
      `);
      console.log('  ✅ Cities loaded');
    }
  }

  /**
   * Load counselling data from all parquet files
   */
  private async loadCounsellingData(): Promise<void> {
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
        
        // Create temporary table
        await this.conn.exec(`
          CREATE TEMPORARY TABLE temp_data AS 
          SELECT * FROM '${filePath}'
        `);

        // Insert colleges
        await this.conn.exec(`
          INSERT OR IGNORE INTO colleges (
            id, name, state, address, type, management_type,
            is_government, is_private, match_confidence
          )
          SELECT DISTINCT
            matchedCollegeId as id,
            matchedCollegeName as name,
            state,
            collegeInstitute as address,
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
            CAST(matchConfidence AS DECIMAL(3,2)) as match_confidence
          FROM temp_data
          WHERE matchedCollegeId IS NOT NULL 
            AND matchedCollegeName IS NOT NULL
            AND matchConfidence > 0.5
        `);

        // Insert courses
        await this.conn.exec(`
          INSERT OR IGNORE INTO courses (
            id, name, stream, branch, duration_years, degree_type,
            college_id, college_name
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
            matchedCollegeName as college_name
          FROM temp_data
          WHERE course IS NOT NULL 
            AND course != ''
            AND course NOT LIKE '%NBEMS%'
            AND course NOT LIKE '%  %'
        `);

        // Insert cutoffs
        await this.conn.exec(`
          INSERT INTO cutoffs (
            id, college_id, college_name, course_id, course_name,
            year, category, opening_rank, closing_rank, round, state,
            quota, all_india_rank, source_file, match_confidence,
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
            CAST(allIndiaRank AS INTEGER) as all_india_rank,
            sourceFile as source_file,
            CAST(matchConfidence AS DECIMAL(3,2)) as match_confidence,
            matchMethod as match_method,
            CAST(needsManualReview AS BOOLEAN) as needs_manual_review,
            CAST(isUnmatched AS BOOLEAN) as is_unmatched
          FROM temp_data
          WHERE matchedCollegeId IS NOT NULL
            AND course IS NOT NULL
            AND year IS NOT NULL
            AND allIndiaRank IS NOT NULL
        `);

        // Drop temporary table
        await this.conn.exec('DROP TABLE temp_data');
      }
    }
  }

  /**
   * Update college statistics
   */
  private async updateCollegeStatistics(): Promise<void> {
    await this.conn.exec(`
      UPDATE colleges SET
        total_courses = (
          SELECT COUNT(DISTINCT course_id) 
          FROM cutoffs 
          WHERE cutoffs.college_id = colleges.id
        ),
        total_seats = (
          SELECT COUNT(*) 
          FROM cutoffs 
          WHERE cutoffs.college_id = colleges.id
        ),
        avg_cutoff_rank = (
          SELECT AVG(opening_rank) 
          FROM cutoffs 
          WHERE cutoffs.college_id = colleges.id
        ),
        best_rank = (
          SELECT MIN(opening_rank) 
          FROM cutoffs 
          WHERE cutoffs.college_id = colleges.id
        ),
        worst_rank = (
          SELECT MAX(closing_rank) 
          FROM cutoffs 
          WHERE cutoffs.college_id = colleges.id
        ),
        years_active = (
          SELECT COUNT(DISTINCT year) 
          FROM cutoffs 
          WHERE cutoffs.college_id = colleges.id
        )
    `);
  }

  /**
   * Update course statistics
   */
  private async updateCourseStatistics(): Promise<void> {
    await this.conn.exec(`
      UPDATE courses SET
        total_colleges = (
          SELECT COUNT(DISTINCT college_id) 
          FROM cutoffs 
          WHERE cutoffs.course_id = courses.id
        ),
        years_offered = (
          SELECT COUNT(DISTINCT year) 
          FROM cutoffs 
          WHERE cutoffs.course_id = courses.id
        ),
        avg_opening_rank = (
          SELECT AVG(opening_rank) 
          FROM cutoffs 
          WHERE cutoffs.course_id = courses.id
        ),
        avg_closing_rank = (
          SELECT AVG(closing_rank) 
          FROM cutoffs 
          WHERE cutoffs.course_id = courses.id
        ),
        best_rank = (
          SELECT MIN(opening_rank) 
          FROM cutoffs 
          WHERE cutoffs.course_id = courses.id
        ),
        worst_rank = (
          SELECT MAX(closing_rank) 
          FROM cutoffs 
          WHERE cutoffs.course_id = courses.id
        )
    `);
  }

  /**
   * Create all indexes for performance
   */
  private async createAllIndexes(): Promise<void> {
    console.log('⚡ Creating all indexes...');

    const indexes = [
      'CREATE INDEX idx_colleges_state ON colleges(state)',
      'CREATE INDEX idx_colleges_type ON colleges(type)',
      'CREATE INDEX idx_colleges_management ON colleges(management_type)',
      'CREATE INDEX idx_colleges_rank ON colleges(best_rank, worst_rank)',
      'CREATE INDEX idx_courses_stream ON courses(stream)',
      'CREATE INDEX idx_courses_branch ON courses(branch)',
      'CREATE INDEX idx_courses_college_id ON courses(college_id)',
      'CREATE INDEX idx_cutoffs_college_id ON cutoffs(college_id)',
      'CREATE INDEX idx_cutoffs_course_id ON cutoffs(course_id)',
      'CREATE INDEX idx_cutoffs_year ON cutoffs(year)',
      'CREATE INDEX idx_cutoffs_rank ON cutoffs(opening_rank, closing_rank)',
      'CREATE INDEX idx_cutoffs_quota ON cutoffs(quota)',
      'CREATE INDEX idx_cutoffs_state ON cutoffs(state)',
      'CREATE INDEX idx_cutoffs_category ON cutoffs(category)',
      'CREATE INDEX idx_analytics_metric ON analytics(metric_name)',
      'CREATE INDEX idx_analytics_date ON analytics(year, month, day)'
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

    // Platform statistics
    const stats = await this.conn.all(`
      SELECT 
        'total_colleges' as metric_name, COUNT(*) as metric_value FROM colleges
      UNION ALL
      SELECT 'total_courses', COUNT(*) FROM courses
      UNION ALL
      SELECT 'total_cutoffs', COUNT(*) FROM cutoffs
      UNION ALL
      SELECT 'total_states', COUNT(*) FROM states
      UNION ALL
      SELECT 'total_cities', COUNT(*) FROM cities
      UNION ALL
      SELECT 'avg_confidence', AVG(match_confidence) FROM colleges
      UNION ALL
      SELECT 'years_covered', COUNT(DISTINCT year) FROM cutoffs
    `);

    if (stats && stats.length > 0) {
      for (let i = 0; i < stats.length; i++) {
        const stat = stats[i];
        await this.conn.exec(`
          INSERT INTO analytics (id, metric_name, metric_value, created_at)
          VALUES ('stat_${i + 1}', '${stat.metric_name}', ${stat.metric_value}, CURRENT_TIMESTAMP)
        `);
      }
    }

    console.log('✅ Statistics generated successfully');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    return await this.conn.all(`
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
      UNION ALL
      SELECT 'analytics', COUNT(*) FROM analytics
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
export const freshDB = new FreshDatabase();
