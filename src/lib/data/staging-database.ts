import fs from 'fs';
import path from 'path';

export interface StagingCounsellingRecord {
  id: string;
  allIndiaRank: number;
  quota: string;
  collegeInstitute: string;
  course: string;
  category: string;
  round: number;
  year: number;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedCutoff {
  id: string;
  collegeId: string;
  courseId: string;
  year: number;
  round: number;
  quota: string;
  category: string;
  openingRank: number;
  closingRank: number;
  totalRecords: number;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
}

export class StagingDatabase {
  private dataDir: string;
  private stagingDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.stagingDir = path.join(this.dataDir, 'staging');
  }

  /**
   * Initialize staging database structure
   */
  async initializeStagingDatabase(): Promise<void> {
    console.log('🏗️ Initializing staging database...');
    
    // Create staging directory
    if (!fs.existsSync(this.stagingDir)) {
      fs.mkdirSync(this.stagingDir, { recursive: true });
      console.log(`✅ Created staging directory: ${this.stagingDir}`);
    }

    // Create staging schema file
    const schemaPath = path.join(this.stagingDir, 'schema.sql');
    const schema = this.generateStagingSchema();
    fs.writeFileSync(schemaPath, schema);
    console.log(`✅ Created staging schema: ${schemaPath}`);
  }

  /**
   * Generate staging database schema
   */
  private generateStagingSchema(): string {
    return `
-- Staging Database Schema for Counselling Data Processing
-- This schema is used for importing and processing raw counselling data before unified database integration

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

-- Processed cutoffs table (after rank calculation)
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

-- College matching table (for linking to unified database)
CREATE TABLE IF NOT EXISTS staging_college_matches (
  id TEXT PRIMARY KEY,
  staging_college_name TEXT NOT NULL,
  unified_college_id TEXT,
  match_confidence REAL,
  match_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Course matching table (for linking to unified database)
CREATE TABLE IF NOT EXISTS staging_course_matches (
  id TEXT PRIMARY KEY,
  staging_course_name TEXT NOT NULL,
  unified_course_id TEXT,
  match_confidence REAL,
  match_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staging_counselling_year_round ON staging_counselling_records(year, round);
CREATE INDEX IF NOT EXISTS idx_staging_counselling_college_course ON staging_counselling_records(college_institute, course);
CREATE INDEX IF NOT EXISTS idx_staging_counselling_quota_category ON staging_counselling_records(quota, category);
CREATE INDEX IF NOT EXISTS idx_staging_counselling_rank ON staging_counselling_records(all_india_rank);

CREATE INDEX IF NOT EXISTS idx_staging_cutoffs_year_round ON staging_processed_cutoffs(year, round);
CREATE INDEX IF NOT EXISTS idx_staging_cutoffs_college_course ON staging_processed_cutoffs(college_id, course_id);
CREATE INDEX IF NOT EXISTS idx_staging_cutoffs_quota_category ON staging_processed_cutoffs(quota, category);
CREATE INDEX IF NOT EXISTS idx_staging_cutoffs_ranks ON staging_processed_cutoffs(opening_rank, closing_rank);
`;
  }

  /**
   * Save staging counselling records to JSON file
   */
  async saveStagingRecords(records: StagingCounsellingRecord[]): Promise<void> {
    const filePath = path.join(this.stagingDir, 'staging_counselling_records.json');
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
    console.log(`✅ Saved ${records.length} staging counselling records to ${filePath}`);
  }

  /**
   * Save processed cutoffs to JSON file
   */
  async saveProcessedCutoffs(cutoffs: ProcessedCutoff[]): Promise<void> {
    const filePath = path.join(this.stagingDir, 'staging_processed_cutoffs.json');
    fs.writeFileSync(filePath, JSON.stringify(cutoffs, null, 2));
    console.log(`✅ Saved ${cutoffs.length} processed cutoffs to ${filePath}`);
  }

  /**
   * Load staging counselling records from JSON file
   */
  async loadStagingRecords(): Promise<StagingCounsellingRecord[]> {
    const filePath = path.join(this.stagingDir, 'staging_counselling_records.json');
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Load processed cutoffs from JSON file
   */
  async loadProcessedCutoffs(): Promise<ProcessedCutoff[]> {
    const filePath = path.join(this.stagingDir, 'staging_processed_cutoffs.json');
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Get staging database summary
   */
  async getStagingSummary(): Promise<any> {
    try {
      const records = await this.loadStagingRecords();
      const cutoffs = await this.loadProcessedCutoffs();

      // Analyze records by round
      const recordsByRound = records.reduce((acc, record) => {
        acc[record.round] = (acc[record.round] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Analyze records by quota
      const recordsByQuota = records.reduce((acc, record) => {
        acc[record.quota] = (acc[record.quota] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Analyze records by category
      const recordsByCategory = records.reduce((acc, record) => {
        acc[record.category] = (acc[record.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Analyze cutoffs by round
      const cutoffsByRound = cutoffs.reduce((acc, cutoff) => {
        acc[cutoff.round] = (acc[cutoff.round] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      return {
        totalRecords: records.length,
        totalCutoffs: cutoffs.length,
        recordsByRound,
        recordsByQuota,
        recordsByCategory,
        cutoffsByRound,
        year: records.length > 0 ? records[0].year : null,
        sourceFiles: [...new Set(records.map(r => r.sourceFile))]
      };
    } catch (error: any) {
      console.error('❌ Failed to get staging summary:', error);
      return null;
    }
  }
}

export default StagingDatabase;
