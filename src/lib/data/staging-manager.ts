import fs from 'fs';
import path from 'path';
import * as _ from 'lodash';
import Fuse from 'fuse.js';
import { compareTwoStrings } from 'string-similarity';
import leven from 'leven';
import { z } from 'zod';
import Database from 'better-sqlite3';
import { StagingCounsellingRecord, ProcessedCutoff } from './staging-database';
import TypesenseManager from './typesense-manager';

// Validation schemas
const CounsellingRecordSchema = z.object({
  id: z.string(),
  allIndiaRank: z.number().positive(),
  quota: z.string().min(1),
  collegeInstitute: z.string().min(1),
  course: z.string().min(1),
  category: z.string().min(1),
  round: z.number().positive(),
  year: z.number().positive(),
  sourceFile: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const ProcessedCutoffSchema = z.object({
  id: z.string(),
  collegeId: z.string(),
  courseId: z.string(),
  year: z.number().positive(),
  round: z.number().positive(),
  quota: z.string().min(1),
  category: z.string().min(1),
  openingRank: z.number().positive(),
  closingRank: z.number().positive(),
  totalRecords: z.number().positive(),
  sourceFile: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export interface CollegeMatch {
  stagingName: string;
  unifiedId: string;
  unifiedName: string;
  confidence: number;
  matchMethod: 'exact' | 'fuzzy' | 'manual';
  distance: number;
}

export interface CourseMatch {
  stagingName: string;
  unifiedId: string;
  unifiedName: string;
  confidence: number;
  matchMethod: 'exact' | 'fuzzy' | 'manual';
  distance: number;
}

export interface StagingStatus {
  totalRecords: number;
  totalCutoffs: number;
  matchedColleges: number;
  matchedCourses: number;
  unmatchedColleges: number;
  unmatchedCourses: number;
  dataQuality: {
    validRecords: number;
    invalidRecords: number;
    validationErrors: string[];
    rankValidationErrors: number;
    completenessErrors: number;
    businessLogicErrors: number;
  };
  processingStatus: 'idle' | 'importing' | 'processing' | 'matching' | 'validating' | 'pushing' | 'clearing';
  progress: {
    currentStep: string;
    completedSteps: number;
    totalSteps: number;
    percentage: number;
  };
  performance: {
    importTime: number;
    processingTime: number;
    matchingTime: number;
    totalTime: number;
    memoryUsage: number;
  };
  errors: {
    importErrors: string[];
    processingErrors: string[];
    matchingErrors: string[];
    validationErrors: string[];
  };
  lastUpdated: string;
}

export interface ProgressCallback {
  (step: string, progress: number, message?: string): void;
}

export interface MatchingConfig {
  exactMatchThreshold: number;
  fuzzyMatchThreshold: number;
  manualReviewThreshold: number;
  maxDistance: number;
  enableParallelProcessing: boolean;
  batchSize: number;
}

export class StagingManager {
  private dataDir: string;
  private stagingDir: string;
  private db: Database.Database | null = null;
  private fuseColleges: Fuse<any> | null = null;
  private fuseCourses: Fuse<any> | null = null;
  private typesenseManager: TypesenseManager | null = null;
  private matchingConfig: MatchingConfig;
  private progressCallback: ProgressCallback | null = null;
  private startTime: number = 0;
  private performanceMetrics: any = {};

  constructor(config?: Partial<MatchingConfig>) {
    this.dataDir = path.join(process.cwd(), 'data');
    this.stagingDir = path.join(this.dataDir, 'staging');
    this.matchingConfig = {
      exactMatchThreshold: 1.0,
      fuzzyMatchThreshold: 0.7,
      manualReviewThreshold: 0.5,
      maxDistance: 10,
      enableParallelProcessing: true,
      batchSize: 1000,
      ...config
    };
  }

  /**
   * Set progress callback for monitoring
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Update progress
   */
  private updateProgress(step: string, progress: number, message?: string): void {
    if (this.progressCallback) {
      this.progressCallback(step, progress, message);
    }
  }

  /**
   * Start performance tracking
   */
  private startPerformanceTracking(): void {
    this.startTime = Date.now();
    this.performanceMetrics = {
      importTime: 0,
      processingTime: 0,
      matchingTime: 0,
      totalTime: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    };
  }

  /**
   * End performance tracking
   */
  private endPerformanceTracking(): void {
    this.performanceMetrics.totalTime = Date.now() - this.startTime;
    this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  /**
   * Initialize staging database with SQLite
   */
  async initializeStagingDatabase(): Promise<void> {
    console.log('🏗️ Initializing enhanced staging database...');
    
    // Create staging directory
    if (!fs.existsSync(this.stagingDir)) {
      fs.mkdirSync(this.stagingDir, { recursive: true });
    }

    // Initialize SQLite database
    const dbPath = path.join(this.stagingDir, 'staging.db');
    this.db = new Database(dbPath);
    
    // Create tables
    this.createTables();
    
    // Load unified database for matching
    await this.loadUnifiedDataForMatching();
    
    console.log('✅ Enhanced staging database initialized');
  }

  /**
   * Create staging database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    const schema = `
      -- Raw counselling records table
      CREATE TABLE IF NOT EXISTS staging_counselling_records (
        id TEXT PRIMARY KEY,
        all_india_rank INTEGER NOT NULL,
        quota TEXT NOT NULL,
        college_institute TEXT NOT NULL,
        course TEXT NOT NULL,
        category TEXT NOT NULL,
        round INTEGER NOT NULL,
        year INTEGER NOT NULL,
        source_file TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Processed cutoffs table
      CREATE TABLE IF NOT EXISTS staging_processed_cutoffs (
        id TEXT PRIMARY KEY,
        college_id TEXT,
        course_id TEXT,
        year INTEGER NOT NULL,
        round INTEGER NOT NULL,
        quota TEXT NOT NULL,
        category TEXT NOT NULL,
        opening_rank INTEGER NOT NULL,
        closing_rank INTEGER NOT NULL,
        total_records INTEGER NOT NULL,
        source_file TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- College matching table
      CREATE TABLE IF NOT EXISTS staging_college_matches (
        id TEXT PRIMARY KEY,
        staging_college_name TEXT NOT NULL,
        unified_college_id TEXT,
        unified_college_name TEXT,
        match_confidence REAL,
        match_method TEXT,
        distance INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Course matching table
      CREATE TABLE IF NOT EXISTS staging_course_matches (
        id TEXT PRIMARY KEY,
        staging_course_name TEXT NOT NULL,
        unified_course_id TEXT,
        unified_course_name TEXT,
        match_confidence REAL,
        match_method TEXT,
        distance INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_staging_counselling_year_round ON staging_counselling_records(year, round);
      CREATE INDEX IF NOT EXISTS idx_staging_counselling_college_course ON staging_counselling_records(college_institute, course);
      CREATE INDEX IF NOT EXISTS idx_staging_counselling_quota_category ON staging_counselling_records(quota, category);
      CREATE INDEX IF NOT EXISTS idx_staging_counselling_rank ON staging_counselling_records(all_india_rank);
    `;

    this.db.exec(schema);
  }

  /**
   * Load unified database data for matching
   */
  private async loadUnifiedDataForMatching(): Promise<void> {
    try {
      // Load colleges from unified database
      const collegesPath = path.join(this.dataDir, 'unified_colleges.json');
      if (fs.existsSync(collegesPath)) {
        const collegesData = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
        const colleges = collegesData.data || collegesData;
        
        // Initialize Fuse.js for fuzzy college matching with multiple fields
        this.fuseColleges = new Fuse(colleges, {
          keys: [
            'name',
            'fullName', 
            { name: 'name', weight: 0.4 },
            { name: 'state', weight: 0.3 },
            { name: 'address', weight: 0.2 },
            { name: 'type', weight: 0.1 }
          ],
          threshold: 0.6,
          includeScore: true,
          includeMatches: true
        });
        
        console.log(`✅ Loaded ${colleges.length} colleges for matching`);
        
        // Initialize Typesense for enhanced matching
        try {
          this.typesenseManager = new TypesenseManager();
          await this.typesenseManager.initialize();
          console.log('✅ Typesense initialized for enhanced matching');
        } catch (error) {
          console.warn('⚠️ Typesense initialization failed, using Fuse.js only:', error);
          this.typesenseManager = null;
        }
      }

      // Load courses from unified database
      const coursesPath = path.join(this.dataDir, 'unified_courses.json');
      if (fs.existsSync(coursesPath)) {
        const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
        const courses = coursesData.data || coursesData;
        
        // Initialize Fuse.js for fuzzy course matching
        this.fuseCourses = new Fuse(courses, {
          keys: ['name'],
          threshold: 0.6,
          includeScore: true,
          includeMatches: true
        });
        
        console.log(`✅ Loaded ${courses.length} courses for matching`);
      }
    } catch (error: any) {
      console.warn('⚠️ Could not load unified data for matching:', error.message);
    }
  }

  /**
   * Import counselling data to staging database with batch processing
   */
  async importCounsellingData(records: StagingCounsellingRecord[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const startTime = Date.now();
    console.log(`📊 Importing ${records.length} counselling records to staging database...`);
    
    this.updateProgress('importing', 0, `Starting import of ${records.length} records`);
    
    // Validate records before import
    const validationErrors: string[] = [];
    const validRecords: StagingCounsellingRecord[] = [];
    
    for (let i = 0; i < records.length; i++) {
      try {
        const validatedRecord = CounsellingRecordSchema.parse(records[i]);
        validRecords.push(validatedRecord);
      } catch (error: any) {
        validationErrors.push(`Record ${i}: ${error.message}`);
      }
      
      // Update progress every 1000 records
      if (i % 1000 === 0) {
        this.updateProgress('importing', (i / records.length) * 50, `Validated ${i} records`);
      }
    }
    
    console.log(`✅ Validated ${validRecords.length} records, ${validationErrors.length} errors`);
    
    // Batch processing for large datasets
    const batchSize = this.matchingConfig.batchSize;
    const batches = _.chunk(validRecords, batchSize);
    
    const insertStmt = this.db.prepare(`
      INSERT INTO staging_counselling_records 
      (id, all_india_rank, quota, college_institute, course, category, round, year, source_file, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((records: StagingCounsellingRecord[]) => {
      for (const record of records) {
        insertStmt.run(
          record.id,
          record.allIndiaRank,
          record.quota,
          record.collegeInstitute,
          record.course,
          record.category,
          record.round,
          record.year,
          record.sourceFile,
          record.createdAt,
          record.updatedAt
        );
      }
    });

    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      insertMany(batch);
      
      const progress = 50 + ((i + 1) / batches.length) * 50;
      this.updateProgress('importing', progress, `Imported batch ${i + 1}/${batches.length}`);
    }
    
    this.performanceMetrics.importTime = Date.now() - startTime;
    console.log(`✅ Imported ${validRecords.length} records in ${this.performanceMetrics.importTime}ms`);
  }

  /**
   * Process and calculate ranks
   */
  async processAndCalculateRanks(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('📈 Processing cutoffs and calculating ranks...');
    
    // Clear existing processed cutoffs
    this.db.exec('DELETE FROM staging_processed_cutoffs');
    
    // Get grouped records for rank calculation
    const groupedRecords = this.db.prepare(`
      SELECT 
        year, round, quota, category, college_institute, course,
        MIN(all_india_rank) as opening_rank,
        MAX(all_india_rank) as closing_rank,
        COUNT(*) as total_records,
        source_file
      FROM staging_counselling_records
      GROUP BY year, round, quota, category, college_institute, course,
               COALESCE(master_source_id, source_normalized, ''), COALESCE(master_level_id, level_normalized, '')
    `).all();

    const insertCutoffStmt = this.db.prepare(`
      INSERT INTO staging_processed_cutoffs
      (id, college_id, course_id, year, round, quota, category, opening_rank, closing_rank, total_records, source_file, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCutoffs = this.db.transaction((cutoffs: any[]) => {
      for (const cutoff of cutoffs) {
        const id = `cutoff_${cutoff.year}_${cutoff.round}_${cutoff.quota.replace(/\s+/g, '_')}_${cutoff.category}_${cutoff.college_institute.replace(/[^a-zA-Z0-9]/g, '_')}_${cutoff.course.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        insertCutoffStmt.run(
          id,
          '', // college_id - will be filled during matching
          '', // course_id - will be filled during matching
          cutoff.year,
          cutoff.round,
          cutoff.quota,
          cutoff.category,
          cutoff.opening_rank,
          cutoff.closing_rank,
          cutoff.total_records,
          cutoff.source_file,
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    });

    insertCutoffs(groupedRecords);
    console.log(`✅ Processed ${groupedRecords.length} cutoffs`);
  }

  /**
   * Match colleges with unified database
   */
  async matchCollegesAndCourses(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('🔍 Matching colleges and courses with unified database...');
    
    // Clear existing matches
    this.db.exec('DELETE FROM staging_college_matches');
    this.db.exec('DELETE FROM staging_course_matches');
    
    // Get unique colleges and courses from staging
    const uniqueColleges = this.db.prepare(`
      SELECT DISTINCT college_institute as name FROM staging_counselling_records
    `).all() as { name: string }[];
    
    const uniqueCourses = this.db.prepare(`
      SELECT DISTINCT course as name FROM staging_counselling_records
    `).all() as { name: string }[];

    // Match colleges
    await this.matchColleges(uniqueColleges);
    
    // Match courses
    await this.matchCourses(uniqueCourses);
    
    console.log('✅ College and course matching completed');
  }

  /**
   * Match colleges using exact match first, then fuzzy matching with batch processing
   */
  private async matchColleges(colleges: { name: string }[]): Promise<void> {
    if (!this.db || !this.fuseColleges) return;
    
    const startTime = Date.now();
    console.log(`🔍 Matching ${colleges.length} colleges with batch processing...`);
    
    const insertMatchStmt = this.db.prepare(`
      INSERT INTO staging_college_matches
      (id, staging_college_name, unified_college_id, unified_college_name, match_confidence, match_method, distance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Get unified colleges for exact matching
    const unifiedCollegesPath = path.join(this.dataDir, 'unified_colleges.json');
    const unifiedColleges = fs.existsSync(unifiedCollegesPath) 
      ? JSON.parse(fs.readFileSync(unifiedCollegesPath, 'utf8')).data || []
      : [];

    // Create exact match lookup with multiple field combinations
    const exactMatchLookup = new Map<string, any>();
    for (const college of unifiedColleges) {
      // Primary: Name only
      const normalizedName = this.normalizeCollegeName(college.name);
      exactMatchLookup.set(normalizedName, college);
      
      if (college.fullName) {
        const normalizedFullName = this.normalizeCollegeName(college.fullName);
        exactMatchLookup.set(normalizedFullName, college);
      }
      
      // Enhanced: Name + State combination
      if (college.state) {
        const nameStateKey = `${normalizedName}|${this.normalizeText(college.state)}`;
        exactMatchLookup.set(nameStateKey, college);
        
        if (college.fullName) {
          const fullNameStateKey = `${normalizedFullName}|${this.normalizeText(college.state)}`;
          exactMatchLookup.set(fullNameStateKey, college);
        }
      }
      
      // Enhanced: Name + Address combination  
      if (college.address) {
        const nameAddressKey = `${normalizedName}|${this.normalizeText(college.address)}`;
        exactMatchLookup.set(nameAddressKey, college);
        
        if (college.fullName) {
          const fullNameAddressKey = `${normalizedFullName}|${this.normalizeText(college.address)}`;
          exactMatchLookup.set(fullNameAddressKey, college);
        }
      }
    }

    let exactMatches = 0;
    let fuzzyMatches = 0;
    let manualReviews = 0;
    let noMatches = 0;

    // Process colleges in batches for better performance
    const batchSize = 50; // Smaller batches for better progress tracking
    const batches = _.chunk(colleges, batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      for (let i = 0; i < batch.length; i++) {
        const college = batch[i];
        const globalIndex = batchIndex * batchSize + i;
        
        // Step 1: Try exact match with multiple field combinations
        const normalizedName = this.normalizeCollegeName(college.name);
        let exactMatch = exactMatchLookup.get(normalizedName);
        
        // If no direct name match, try enhanced combinations
        if (!exactMatch) {
          // Try to extract state/address from staging college name if possible
          const collegeParts = college.name.split(',').map(part => part.trim());
          if (collegeParts.length > 1) {
            const possibleState = collegeParts[collegeParts.length - 1];
            const nameStateKey = `${normalizedName}|${this.normalizeText(possibleState)}`;
            exactMatch = exactMatchLookup.get(nameStateKey);
            
            if (!exactMatch && collegeParts.length > 2) {
              const possibleAddress = collegeParts[collegeParts.length - 2];
              const nameAddressKey = `${normalizedName}|${this.normalizeText(possibleAddress)}`;
              exactMatch = exactMatchLookup.get(nameAddressKey);
            }
          }
          
          // Try extracting just the hospital name (first part before comma)
          if (!exactMatch && college.name.includes(',')) {
            const hospitalName = college.name.split(',')[0].trim();
            const normalizedHospitalName = this.normalizeCollegeName(hospitalName);
            exactMatch = exactMatchLookup.get(normalizedHospitalName);
          }
        }
        
        if (exactMatch) {
          insertMatchStmt.run(
            `college_${college.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
            college.name,
            exactMatch.id,
            exactMatch.name,
            this.matchingConfig.exactMatchThreshold,
            'exact',
            0,
            new Date().toISOString(),
            new Date().toISOString()
          );
          exactMatches++;
        } else {
          // Step 2: Try Typesense matching first (faster and more accurate)
          let bestMatch: any = null;
          let confidence = 0;
          let matchMethod: 'exact' | 'fuzzy' | 'typesense' | 'manual' = 'manual';
          
          if (this.typesenseManager) {
            try {
              const typesenseResults = await this.typesenseManager.searchColleges(college.name, { limit: 3 });
              if (typesenseResults.length > 0) {
                bestMatch = { item: typesenseResults[0] }; // Wrap in Fuse.js format
                confidence = typesenseResults[0].score || 0;
                matchMethod = 'typesense';
              }
            } catch (error) {
              console.warn('⚠️ Typesense search failed, falling back to Fuse.js:', error);
            }
          }
          
          // Step 3: Fallback to Fuse.js fuzzy matching if Typesense fails
          if (!bestMatch && this.fuseColleges) {
            const fuzzyResults = this.fuseColleges.search(college.name, { limit: 3 });
            if (fuzzyResults.length > 0) {
              bestMatch = fuzzyResults[0];
              confidence = 1 - (bestMatch.score || 0);
              matchMethod = 'fuzzy';
            }
          }
          
          if (bestMatch && bestMatch.item && bestMatch.item.name) {
            const distance = leven(college.name, bestMatch.item.name);
            
            if (confidence >= this.matchingConfig.fuzzyMatchThreshold) {
              fuzzyMatches++;
            } else if (confidence >= this.matchingConfig.manualReviewThreshold) {
              matchMethod = 'manual';
              manualReviews++;
            } else {
              // No good match found
              insertMatchStmt.run(
                `college_${college.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
                college.name,
                null,
                null,
                0,
                'manual',
                distance,
                new Date().toISOString(),
                new Date().toISOString()
              );
              noMatches++;
              continue;
            }
            
            insertMatchStmt.run(
              `college_${college.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
              college.name,
              bestMatch.item.id,
              bestMatch.item.name,
              confidence,
              matchMethod,
              distance,
              new Date().toISOString(),
              new Date().toISOString()
            );
          } else {
            // No match found
            insertMatchStmt.run(
              `college_${college.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
              college.name,
              null,
              null,
              0,
              'manual',
              999,
              new Date().toISOString(),
              new Date().toISOString()
            );
            noMatches++;
          }
        }
      }
      
      // Update progress after each batch
      const progress = ((batchIndex + 1) / batches.length) * 100;
      const currentGlobalIndex = (batchIndex + 1) * batchSize;
      this.updateProgress('matching', progress, `Matched batch ${batchIndex + 1}/${batches.length} (${Math.min(currentGlobalIndex, colleges.length)}/${colleges.length} colleges)`);
      
      // Add small delay to prevent overwhelming the system
      if (batchIndex % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    this.performanceMetrics.matchingTime = Date.now() - startTime;
    console.log(`✅ College matching completed: ${exactMatches} exact, ${fuzzyMatches} fuzzy, ${manualReviews} manual review, ${noMatches} no matches`);
  }

  /**
   * Normalize college name for better matching
   */
  private normalizeCollegeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/drbb/g, 'dr b b') // Fix DRBB spacing first
      .replace(/drb/g, 'dr b') // Fix DRB spacing
      .replace(/\s+/g, ' ') // Normalize whitespace again
      .trim();
  }

  /**
   * Normalize text for matching (general purpose)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Match courses using exact match first, then fuzzy matching with batch processing
   */
  private async matchCourses(courses: { name: string }[]): Promise<void> {
    if (!this.db || !this.fuseCourses) return;
    
    const startTime = Date.now();
    console.log(`🔍 Matching ${courses.length} courses with batch processing...`);
    
    const insertMatchStmt = this.db.prepare(`
      INSERT INTO staging_course_matches
      (id, staging_course_name, unified_course_id, unified_course_name, match_confidence, match_method, distance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Get unified courses for exact matching
    const unifiedCoursesPath = path.join(this.dataDir, 'unified_courses.json');
    const unifiedCourses = fs.existsSync(unifiedCoursesPath) 
      ? JSON.parse(fs.readFileSync(unifiedCoursesPath, 'utf8')).data || []
      : [];

    // Create exact match lookup with normalized names
    const exactMatchLookup = new Map<string, any>();
    for (const course of unifiedCourses) {
      const normalizedName = this.normalizeCourseName(course.name);
      exactMatchLookup.set(normalizedName, course);
    }

    let exactMatches = 0;
    let fuzzyMatches = 0;
    let manualReviews = 0;
    let noMatches = 0;

    // Process courses in batches
    const batchSize = 100; // Courses are fewer, can use larger batches
    const batches = _.chunk(courses, batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      for (let i = 0; i < batch.length; i++) {
        const course = batch[i];
        const globalIndex = batchIndex * batchSize + i;
        
        // Step 1: Try exact match with normalized name
        const normalizedName = this.normalizeCourseName(course.name);
        const exactMatch = exactMatchLookup.get(normalizedName);
        
        if (exactMatch) {
          insertMatchStmt.run(
            `course_${course.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
            course.name,
            exactMatch.id,
            exactMatch.name,
            this.matchingConfig.exactMatchThreshold,
            'exact',
            0,
            new Date().toISOString(),
            new Date().toISOString()
          );
          exactMatches++;
        } else {
          // Step 2: Try fuzzy matching (limit to top 3 results for performance)
          const fuzzyResults = this.fuseCourses.search(course.name, { limit: 3 });
          
          if (fuzzyResults.length > 0) {
            const bestMatch = fuzzyResults[0];
            const confidence = 1 - (bestMatch.score || 0);
            const distance = leven(course.name, bestMatch.item.name);
            
            let matchMethod: 'exact' | 'fuzzy' | 'manual' = 'fuzzy';
            
            if (confidence >= this.matchingConfig.fuzzyMatchThreshold) {
              matchMethod = 'fuzzy';
              fuzzyMatches++;
            } else if (confidence >= this.matchingConfig.manualReviewThreshold) {
              matchMethod = 'manual';
              manualReviews++;
            } else {
              // No good match found
              insertMatchStmt.run(
                `course_${course.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
                course.name,
                null,
                null,
                0,
                'manual',
                distance,
                new Date().toISOString(),
                new Date().toISOString()
              );
              noMatches++;
              continue;
            }
            
            insertMatchStmt.run(
              `course_${course.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
              course.name,
              bestMatch.item.id,
              bestMatch.item.name,
              confidence,
              matchMethod,
              distance,
              new Date().toISOString(),
              new Date().toISOString()
            );
          } else {
            // No fuzzy match found
            insertMatchStmt.run(
              `course_${course.name.replace(/[^a-zA-Z0-9]/g, '_')}_${globalIndex}`,
              course.name,
              null,
              null,
              0,
              'manual',
              999,
              new Date().toISOString(),
              new Date().toISOString()
            );
            noMatches++;
          }
        }
      }
      
      // Update progress after each batch
      const progress = ((batchIndex + 1) / batches.length) * 100;
      const currentGlobalIndex = (batchIndex + 1) * batchSize;
      this.updateProgress('matching', progress, `Matched course batch ${batchIndex + 1}/${batches.length} (${Math.min(currentGlobalIndex, courses.length)}/${courses.length} courses)`);
    }
    
    console.log(`✅ Course matching completed: ${exactMatches} exact, ${fuzzyMatches} fuzzy, ${manualReviews} manual review, ${noMatches} no matches`);
  }

  /**
   * Normalize course name for better matching
   */
  private normalizeCourseName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\bmd\b/g, 'md') // Normalize MD
      .replace(/\bms\b/g, 'ms') // Normalize MS
      .trim();
  }

  /**
   * Comprehensive data quality validation
   */
  async validateDataQuality(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('🔍 Validating data quality...');
    this.updateProgress('validating', 0, 'Starting data validation');
    
    const validationErrors: string[] = [];
    let rankValidationErrors = 0;
    let completenessErrors = 0;
    let businessLogicErrors = 0;
    
    // 1. Data Completeness Checks
    this.updateProgress('validating', 20, 'Checking data completeness');
    const incompleteRecords = this.db.prepare(`
      SELECT * FROM staging_counselling_records 
      WHERE all_india_rank <= 0 OR college_institute = '' OR course = '' OR quota = '' OR category = ''
    `).all();
    
    completenessErrors = incompleteRecords.length;
    validationErrors.push(`Incomplete records: ${completenessErrors}`);
    
    // 2. Rank Validation (opening ≤ closing)
    this.updateProgress('validating', 40, 'Validating rank logic');
    const invalidRanks = this.db.prepare(`
      SELECT * FROM staging_processed_cutoffs 
      WHERE opening_rank > closing_rank OR opening_rank <= 0 OR closing_rank <= 0
    `).all();
    
    rankValidationErrors = invalidRanks.length;
    validationErrors.push(`Invalid rank logic: ${rankValidationErrors}`);
    
    // 3. Business Logic Validation
    this.updateProgress('validating', 60, 'Validating business logic');
    
    // Check for unrealistic rank values
    const unrealisticRanks = this.db.prepare(`
      SELECT * FROM staging_counselling_records 
      WHERE all_india_rank > 1000000
    `).all();
    
    businessLogicErrors += unrealisticRanks.length;
    validationErrors.push(`Unrealistic ranks (>1M): ${unrealisticRanks.length}`);
    
    // Check for duplicate records
    const duplicateRecords = this.db.prepare(`
      SELECT college_institute, course, quota, category, round, year, COUNT(*) as count
      FROM staging_counselling_records 
      GROUP BY college_institute, course, quota, category, round, year
      HAVING COUNT(*) > 1
    `).all();
    
    businessLogicErrors += duplicateRecords.length;
    validationErrors.push(`Duplicate record groups: ${duplicateRecords.length}`);
    
    // Check for missing required fields
    const missingFields = this.db.prepare(`
      SELECT COUNT(*) as count FROM staging_counselling_records 
      WHERE source_file = '' OR created_at = '' OR updated_at = ''
    `).get() as { count: number };
    
    businessLogicErrors += missingFields.count;
    validationErrors.push(`Missing metadata fields: ${missingFields.count}`);
    
    // 4. Data Consistency Checks
    this.updateProgress('validating', 80, 'Checking data consistency');
    
    // Check if all cutoffs have corresponding records
    const orphanedCutoffs = this.db.prepare(`
      SELECT COUNT(*) as count FROM staging_processed_cutoffs c
      LEFT JOIN staging_counselling_records r ON c.college_id = r.college_institute AND c.course_id = r.course
      WHERE r.id IS NULL
    `).get() as { count: number };
    
    businessLogicErrors += orphanedCutoffs.count;
    validationErrors.push(`Orphaned cutoffs: ${orphanedCutoffs.count}`);
    
    // 5. Final validation summary
    this.updateProgress('validating', 100, 'Validation completed');
    
    console.log(`✅ Data validation completed`);
    console.log(`   Completeness errors: ${completenessErrors}`);
    console.log(`   Rank validation errors: ${rankValidationErrors}`);
    console.log(`   Business logic errors: ${businessLogicErrors}`);
    console.log(`   Total validation issues: ${validationErrors.length}`);
    
    // Store validation results
    this.performanceMetrics.validationErrors = validationErrors;
    this.performanceMetrics.rankValidationErrors = rankValidationErrors;
    this.performanceMetrics.completenessErrors = completenessErrors;
    this.performanceMetrics.businessLogicErrors = businessLogicErrors;
  }

  /**
   * Push processed data to unified database
   */
  async pushToUnifiedDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('📤 Pushing processed data to unified database...');
    
    // Get processed cutoffs with matches
    const cutoffsWithMatches = this.db.prepare(`
      SELECT 
        c.*,
        cm.unified_college_id,
        cm.unified_college_name,
        cm.match_confidence as college_confidence,
        cm.match_method as college_match_method,
        course_m.unified_course_id,
        course_m.unified_course_name,
        course_m.match_confidence as course_confidence,
        course_m.match_method as course_match_method
      FROM staging_processed_cutoffs c
      LEFT JOIN staging_college_matches cm ON c.college_id = cm.staging_college_name
      LEFT JOIN staging_course_matches course_m ON c.course_id = course_m.staging_course_name
    `).all();
    
    // TODO: Implement unified database integration
    console.log(`✅ Ready to push ${cutoffsWithMatches.length} cutoffs to unified database`);
  }

  /**
   * Clear staging database
   */
  async clearStagingDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('🧹 Clearing staging database...');
    
    this.db.exec('DELETE FROM staging_counselling_records');
    this.db.exec('DELETE FROM staging_processed_cutoffs');
    this.db.exec('DELETE FROM staging_college_matches');
    this.db.exec('DELETE FROM staging_course_matches');
    
    console.log('✅ Staging database cleared');
  }

  /**
   * Complete staging workflow: import → process → match → verify → push → clear
   */
  async runCompleteWorkflow(records: StagingCounsellingRecord[]): Promise<StagingStatus> {
    console.log('🚀 Starting complete staging workflow...');
    this.startPerformanceTracking();
    
    try {
      // Step 1: Initialize staging database
      this.updateProgress('importing', 0, 'Initializing staging database');
      await this.initializeStagingDatabase();
      
      // Step 1.5: Clear existing data
      this.updateProgress('importing', 5, 'Clearing existing staging data');
      await this.clearStagingDatabase();
      
      // Step 2: Import counselling data
      this.updateProgress('importing', 10, 'Importing counselling data');
      await this.importCounsellingData(records);
      
      // Step 3: Process and calculate ranks
      this.updateProgress('processing', 30, 'Processing cutoffs and calculating ranks');
      await this.processAndCalculateRanks();
      
      // Step 4: Match colleges and courses
      this.updateProgress('matching', 50, 'Matching colleges and courses');
      await this.matchCollegesAndCourses();
      
      // Step 5: Validate data quality
      this.updateProgress('validating', 70, 'Validating data quality');
      await this.validateDataQuality();
      
      // Step 6: Push to unified database
      this.updateProgress('pushing', 90, 'Pushing to unified database');
      await this.pushToUnifiedDatabase();
      
      // Step 7: Get final status
      this.updateProgress('idle', 100, 'Workflow completed');
      const status = await this.getStagingStatus();
      
      this.endPerformanceTracking();
      console.log('✅ Complete staging workflow finished successfully!');
      
      return status;
      
    } catch (error: any) {
      console.error('❌ Staging workflow failed:', error);
      this.endPerformanceTracking();
      throw error;
    }
  }

  /**
   * Get comprehensive staging database status
   */
  async getStagingStatus(): Promise<StagingStatus> {
    if (!this.db) throw new Error('Database not initialized');
    
    const totalRecords = this.db.prepare('SELECT COUNT(*) as count FROM staging_counselling_records').get() as { count: number };
    const totalCutoffs = this.db.prepare('SELECT COUNT(*) as count FROM staging_processed_cutoffs').get() as { count: number };
    const matchedColleges = this.db.prepare('SELECT COUNT(*) as count FROM staging_college_matches WHERE unified_college_id IS NOT NULL').get() as { count: number };
    const matchedCourses = this.db.prepare('SELECT COUNT(*) as count FROM staging_course_matches WHERE unified_course_id IS NOT NULL').get() as { count: number };
    const unmatchedColleges = this.db.prepare('SELECT COUNT(*) as count FROM staging_college_matches WHERE unified_college_id IS NULL').get() as { count: number };
    const unmatchedCourses = this.db.prepare('SELECT COUNT(*) as count FROM staging_course_matches WHERE unified_course_id IS NULL').get() as { count: number };
    
    return {
      totalRecords: totalRecords.count,
      totalCutoffs: totalCutoffs.count,
      matchedColleges: matchedColleges.count,
      matchedCourses: matchedCourses.count,
      unmatchedColleges: unmatchedColleges.count,
      unmatchedCourses: unmatchedCourses.count,
      dataQuality: {
        validRecords: totalRecords.count,
        invalidRecords: this.performanceMetrics.completenessErrors || 0,
        validationErrors: this.performanceMetrics.validationErrors || [],
        rankValidationErrors: this.performanceMetrics.rankValidationErrors || 0,
        completenessErrors: this.performanceMetrics.completenessErrors || 0,
        businessLogicErrors: this.performanceMetrics.businessLogicErrors || 0
      },
      processingStatus: 'idle',
      progress: {
        currentStep: 'idle',
        completedSteps: 7,
        totalSteps: 7,
        percentage: 100
      },
      performance: this.performanceMetrics,
      errors: {
        importErrors: [],
        processingErrors: [],
        matchingErrors: [],
        validationErrors: this.performanceMetrics.validationErrors || []
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default StagingManager;
