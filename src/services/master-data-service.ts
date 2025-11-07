/**
 * Master Data Service
 * Loads and caches master data from parquet files
 * Provides ID-based lookups for standardized names
 */

import * as duckdb from 'duckdb';
import path from 'path';

export interface MasterCollege {
  id: string;
  name: string;
  normalized_name?: string;
  type?: 'MEDICAL' | 'DENTAL' | 'DNB';
  state?: string;
  address?: string;
}

export interface MasterCourse {
  id: string;
  name: string;
  normalized_name?: string;
}

export interface MasterState {
  id: string;
  name: string;
  code?: string;
}

export interface MasterCategory {
  id: string;
  name: string;
  code?: string;
}

export interface MasterQuota {
  id: string;
  name: string;
  code?: string;
}

export interface MasterSource {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface MasterLevel {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export class MasterDataService {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private initialized = false;

  // In-memory caches
  private collegesCache: Map<string, MasterCollege> = new Map();
  private coursesCache: Map<string, MasterCourse> = new Map();
  private statesCache: Map<string, MasterState> = new Map();
  private categoriesCache: Map<string, MasterCategory> = new Map();
  private quotasCache: Map<string, MasterQuota> = new Map();
  private sourcesCache: Map<string, MasterSource> = new Map();
  private levelsCache: Map<string, MasterLevel> = new Map();
  
  // Reverse lookup maps (code/name -> id) for sources and levels
  private sourceCodeToId: Map<string, string> = new Map();
  private levelCodeToId: Map<string, string> = new Map();

  private masterDataPath: string;

  constructor(masterDataPath?: string) {
    this.db = new duckdb.Database(':memory:');
    this.conn = this.db.connect();
    this.masterDataPath = masterDataPath || path.join(process.cwd(), 'output', 'master_data_export_20251029_001424');
  }

  /**
   * Initialize and load all master data
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('📚 Initializing Master Data Service...');
    console.log(`   Master data path: ${this.masterDataPath}`);

    try {
      // Load medical colleges
      await this.loadColleges('medical');
      
      // Load dental colleges
      await this.loadColleges('dental');
      
      // Load DNB colleges
      await this.loadColleges('dnb');
      
      // Load courses
      await this.loadCourses();
      
      // Load states
      await this.loadStates();
      
      // Load categories
      await this.loadCategories();
      
      // Load quotas
      await this.loadQuotas();
      
      // Load sources (create default if file doesn't exist)
      await this.loadSources();
      
      // Load levels (create default if file doesn't exist)
      await this.loadLevels();

      console.log('✅ Master Data Service initialized');
      console.log(`   Colleges: ${this.collegesCache.size}`);
      console.log(`   Courses: ${this.coursesCache.size}`);
      console.log(`   States: ${this.statesCache.size}`);
      console.log(`   Categories: ${this.categoriesCache.size}`);
      console.log(`   Quotas: ${this.quotasCache.size}`);
      console.log(`   Sources: ${this.sourcesCache.size}`);
      console.log(`   Levels: ${this.levelsCache.size}`);

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Master Data Service:', error);
      throw error;
    }
  }

  /**
   * Load colleges from parquet file
   */
  private async loadColleges(type: 'medical' | 'dental' | 'dnb'): Promise<void> {
    const filePath = path.join(this.masterDataPath, `${type}_colleges.parquet`);
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          // File might not exist, continue
          console.warn(`⚠️ Could not load ${type} colleges: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const college: MasterCollege = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            normalized_name: row.normalized_name ? String(row.normalized_name) : undefined,
            type: type.toUpperCase() as 'MEDICAL' | 'DENTAL' | 'DNB',
            state: row.state ? String(row.state) : undefined,
            address: row.address ? String(row.address) : undefined,
          };

          this.collegesCache.set(college.id, college);
        });

        console.log(`   Loaded ${rows.length} ${type} colleges`);
        resolve();
      });
    });
  }

  /**
   * Load courses from parquet file
   */
  private async loadCourses(): Promise<void> {
    const filePath = path.join(this.masterDataPath, 'courses.parquet');
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          console.warn(`⚠️ Could not load courses: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const course: MasterCourse = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            normalized_name: row.normalized_name ? String(row.normalized_name) : undefined,
          };

          this.coursesCache.set(course.id, course);
        });

        console.log(`   Loaded ${rows.length} courses`);
        resolve();
      });
    });
  }

  /**
   * Load states from parquet file
   */
  private async loadStates(): Promise<void> {
    const filePath = path.join(this.masterDataPath, 'states.parquet');
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          console.warn(`⚠️ Could not load states: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const state: MasterState = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            code: row.code ? String(row.code) : undefined,
          };

          this.statesCache.set(state.id, state);
        });

        console.log(`   Loaded ${rows.length} states`);
        resolve();
      });
    });
  }

  /**
   * Load categories from parquet file
   */
  private async loadCategories(): Promise<void> {
    const filePath = path.join(this.masterDataPath, 'categories.parquet');
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          console.warn(`⚠️ Could not load categories: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const category: MasterCategory = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            code: row.code ? String(row.code) : undefined,
          };

          this.categoriesCache.set(category.id, category);
        });

        console.log(`   Loaded ${rows.length} categories`);
        resolve();
      });
    });
  }

  /**
   * Load quotas from parquet file
   */
  private async loadQuotas(): Promise<void> {
    const filePath = path.join(this.masterDataPath, 'quotas.parquet');
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          console.warn(`⚠️ Could not load quotas: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const quota: MasterQuota = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            code: row.code ? String(row.code) : undefined,
          };

          this.quotasCache.set(quota.id, quota);
        });

        console.log(`   Loaded ${rows.length} quotas`);
        resolve();
      });
    });
  }

  /**
   * Load sources from parquet file or create defaults
   */
  private async loadSources(): Promise<void> {
    const filePath = path.join(this.masterDataPath, 'sources.parquet');
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      // Create default sources based on known values
      const defaultSources: MasterSource[] = [
        { id: 'SRC001', name: 'Medical Counseling Committee', code: 'MCC', description: 'Medical Counseling Committee (MCC) Counselling' },
        { id: 'SRC002', name: 'Karnataka Engineering Admission', code: 'KEA', description: 'KEA Counselling' },
      ];
      
      defaultSources.forEach(source => {
        this.sourcesCache.set(source.id, source);
        if (source.code) {
          this.sourceCodeToId.set(source.code, source.id);
          this.sourceCodeToId.set(source.name.toUpperCase(), source.id);
        }
      });
      
      console.log(`   Created ${defaultSources.length} default sources (MCC, KEA)`);
      return;
    }
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          console.warn(`⚠️ Could not load sources: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const source: MasterSource = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            code: row.code ? String(row.code) : undefined,
            description: row.description ? String(row.description) : undefined,
          };

          this.sourcesCache.set(source.id, source);
          if (source.code) {
            this.sourceCodeToId.set(source.code, source.id);
            this.sourceCodeToId.set(source.name.toUpperCase(), source.id);
          }
        });

        console.log(`   Loaded ${rows.length} sources`);
        resolve();
      });
    });
  }

  /**
   * Load levels from parquet file or create defaults
   */
  private async loadLevels(): Promise<void> {
    const filePath = path.join(this.masterDataPath, 'levels.parquet');
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      // Create default levels based on known values
      const defaultLevels: MasterLevel[] = [
        { id: 'LVL001', name: 'Undergraduate', code: 'UG', description: 'Undergraduate Programs' },
        { id: 'LVL002', name: 'Postgraduate', code: 'PG', description: 'Postgraduate Programs' },
        { id: 'LVL003', name: 'Dental', code: 'DEN', description: 'Dental Programs' },
      ];
      
      defaultLevels.forEach(level => {
        this.levelsCache.set(level.id, level);
        if (level.code) {
          this.levelCodeToId.set(level.code, level.id);
          this.levelCodeToId.set(level.name.toUpperCase(), level.id);
        }
      });
      
      console.log(`   Created ${defaultLevels.length} default levels (UG, PG, DEN)`);
      return;
    }
    
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM read_parquet('${filePath}')`;
      
      this.conn.all(query, (err, rows: any[]) => {
        if (err) {
          console.warn(`⚠️ Could not load levels: ${err.message}`);
          resolve();
          return;
        }

        rows.forEach((row: any) => {
          const level: MasterLevel = {
            id: String(row.id || ''),
            name: String(row.name || ''),
            code: row.code ? String(row.code) : undefined,
            description: row.description ? String(row.description) : undefined,
          };

          this.levelsCache.set(level.id, level);
          if (level.code) {
            this.levelCodeToId.set(level.code, level.id);
            this.levelCodeToId.set(level.name.toUpperCase(), level.id);
          }
        });

        console.log(`   Loaded ${rows.length} levels`);
        resolve();
      });
    });
  }

  /**
   * Get college by ID
   */
  getCollege(id: string): MasterCollege | null {
    return this.collegesCache.get(id) || null;
  }

  /**
   * Get college name by ID
   */
  getCollegeName(id: string): string {
    const college = this.getCollege(id);
    return college?.name || `Unknown College (${id})`;
  }

  /**
   * Get course by ID
   */
  getCourse(id: string): MasterCourse | null {
    return this.coursesCache.get(id) || null;
  }

  /**
   * Get course name by ID
   */
  getCourseName(id: string): string {
    const course = this.getCourse(id);
    return course?.name || `Unknown Course (${id})`;
  }

  /**
   * Get state by ID
   */
  getState(id: string): MasterState | null {
    return this.statesCache.get(id) || null;
  }

  /**
   * Get state name by ID
   */
  getStateName(id: string): string {
    const state = this.getState(id);
    return state?.name || `Unknown State (${id})`;
  }

  /**
   * Get category by ID
   */
  getCategory(id: string): MasterCategory | null {
    return this.categoriesCache.get(id) || null;
  }

  /**
   * Get category name by ID
   */
  getCategoryName(id: string): string {
    const category = this.getCategory(id);
    return category?.name || `Unknown Category (${id})`;
  }

  /**
   * Get quota by ID
   */
  getQuota(id: string): MasterQuota | null {
    return this.quotasCache.get(id) || null;
  }

  /**
   * Get quota name by ID
   */
  getQuotaName(id: string): string {
    const quota = this.getQuota(id);
    return quota?.name || `Unknown Quota (${id})`;
  }

  /**
   * Get all colleges
   */
  getAllColleges(): MasterCollege[] {
    return Array.from(this.collegesCache.values());
  }

  /**
   * Get all courses
   */
  getAllCourses(): MasterCourse[] {
    return Array.from(this.coursesCache.values());
  }

  /**
   * Get all states
   */
  getAllStates(): MasterState[] {
    return Array.from(this.statesCache.values());
  }

  /**
   * Get all categories
   */
  getAllCategories(): MasterCategory[] {
    return Array.from(this.categoriesCache.values());
  }

  /**
   * Get all quotas
   */
  getAllQuotas(): MasterQuota[] {
    return Array.from(this.quotasCache.values());
  }

  /**
   * Get source by ID
   */
  getSource(id: string): MasterSource | null {
    return this.sourcesCache.get(id) || null;
  }

  /**
   * Get source by code or name (looks up ID)
   */
  getSourceByCode(code: string): MasterSource | null {
    const id = this.sourceCodeToId.get(code.toUpperCase());
    return id ? this.getSource(id) : null;
  }

  /**
   * Get source name by ID or code
   */
  getSourceName(idOrCode: string): string {
    // Try as ID first
    const byId = this.getSource(idOrCode);
    if (byId) return byId.name;
    
    // Try as code
    const byCode = this.getSourceByCode(idOrCode);
    if (byCode) return byCode.name;
    
    return `Unknown Source (${idOrCode})`;
  }

  /**
   * Get all sources
   */
  getAllSources(): MasterSource[] {
    return Array.from(this.sourcesCache.values());
  }

  /**
   * Get level by ID
   */
  getLevel(id: string): MasterLevel | null {
    return this.levelsCache.get(id) || null;
  }

  /**
   * Get level by code or name (looks up ID)
   */
  getLevelByCode(code: string): MasterLevel | null {
    const id = this.levelCodeToId.get(code.toUpperCase());
    return id ? this.getLevel(id) : null;
  }

  /**
   * Get level name by ID or code
   */
  getLevelName(idOrCode: string): string {
    // Try as ID first
    const byId = this.getLevel(idOrCode);
    if (byId) return byId.name;
    
    // Try as code
    const byCode = this.getLevelByCode(idOrCode);
    if (byCode) return byCode.name;
    
    return `Unknown Level (${idOrCode})`;
  }

  /**
   * Get all levels
   */
  getAllLevels(): MasterLevel[] {
    return Array.from(this.levelsCache.values());
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let masterDataServiceInstance: MasterDataService | null = null;

/**
 * Get the singleton Master Data Service instance
 */
export function getMasterDataService(masterDataPath?: string): MasterDataService {
  if (!masterDataServiceInstance) {
    masterDataServiceInstance = new MasterDataService(masterDataPath);
  }
  return masterDataServiceInstance;
}

