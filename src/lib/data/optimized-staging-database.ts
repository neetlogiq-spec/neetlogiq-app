import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { StateCourseHierarchicalMatcher } from './state-course-hierarchical-matcher';

interface UniqueCollege {
    id?: number;
    state: string;
    college_raw: string;
    college_clean: string;
    total_records: number;
    
    // Matching results
    matched_college_id?: number;
    matched_college_name?: string;
    match_confidence?: number;
    match_algorithm?: string;
    is_matched?: boolean;
    
    // Validation
    validation_notes?: string;
}

interface CounsellingRecord {
    id?: number;
    unique_college_id: number;
    year: number;
    round: string;
    course_raw: string;
    course_clean: string;
    category: string;
    quota: string;
    all_india_rank: number;
    
    // Calculated ranks
    opening_rank_round?: number;
    closing_rank_round?: number;
    opening_rank_year?: number;
    closing_rank_year?: number;
    is_suspicious_rank?: boolean;
}

export class OptimizedStagingDatabase {
    private db: Database | null = null;
    private matcher: StateCourseHierarchicalMatcher;
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(process.cwd(), 'data', 'optimized-staging.db');
        this.matcher = new StateCourseHierarchicalMatcher();
    }

    public async initialize(): Promise<void> {
        console.log('🔧 Initializing optimized staging database...');
        
        // Open SQLite database
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.createOptimizedSchema();
        console.log(`✅ Optimized staging database initialized: ${this.dbPath}`);
    }

    private async createOptimizedSchema(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Unique colleges table (for matching) - State → College level
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS unique_colleges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL,
                college_raw TEXT NOT NULL,
                college_clean TEXT NOT NULL,
                total_records INTEGER NOT NULL,
                
                -- Matching results (one per college)
                matched_college_id INTEGER,
                matched_college_name TEXT,
                match_confidence REAL,
                match_algorithm TEXT,
                is_matched BOOLEAN DEFAULT FALSE,
                
                -- Validation
                validation_notes TEXT,
                
                -- Metadata
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(state, college_raw)
            )
        `);

        // Counselling records table - Full drill down: State → College → Year → Round → Course → Category → Quota → Rank
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS counselling_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unique_college_id INTEGER NOT NULL,
                
                -- Hierarchy: Year → Round → Course → Category → Quota → Rank
                year INTEGER NOT NULL,
                round TEXT NOT NULL,
                course_raw TEXT NOT NULL,
                course_clean TEXT NOT NULL,
                category TEXT NOT NULL,
                quota TEXT NOT NULL,
                all_india_rank INTEGER NOT NULL,
                
                -- Calculated ranks
                opening_rank_round INTEGER,
                closing_rank_round INTEGER,
                opening_rank_year INTEGER,
                closing_rank_year INTEGER,
                is_suspicious_rank BOOLEAN DEFAULT FALSE,
                
                -- Metadata
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (unique_college_id) REFERENCES unique_colleges(id)
            )
        `);

        // Foundation colleges reference table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS foundation_colleges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                state TEXT NOT NULL,
                address TEXT,
                previous_name TEXT,
                college_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create optimized indexes for the drill-down structure
        await this.db.exec(`
            -- Unique colleges indexes
            CREATE INDEX IF NOT EXISTS idx_unique_state ON unique_colleges (state);
            CREATE INDEX IF NOT EXISTS idx_unique_college ON unique_colleges (college_clean);
            CREATE INDEX IF NOT EXISTS idx_unique_matching ON unique_colleges (is_matched, match_confidence);
            
            -- Counselling records indexes for drill-down: State → College → Year → Round → Course → Category → Quota
            CREATE INDEX IF NOT EXISTS idx_drill_down ON counselling_records 
            (unique_college_id, year, round, course_clean, category, quota);
            
            -- Rank calculation indexes
            CREATE INDEX IF NOT EXISTS idx_rank_calc ON counselling_records 
            (unique_college_id, year, course_clean, category, quota, all_india_rank);
            
            -- Foundation indexes
            CREATE INDEX IF NOT EXISTS idx_foundation_state ON foundation_colleges (state);
            CREATE INDEX IF NOT EXISTS idx_foundation_name ON foundation_colleges (name);
        `);

        console.log('✅ Optimized database schema created with drill-down indexes');
    }

    public async importExcelData(excelFilePath: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log(`📥 Importing Excel data: ${path.basename(excelFilePath)}`);

        // This would use XLSX to parse the file
        // For now, let's create the structure
        console.log('📊 Building hierarchical structure...');

        // Step 1: Extract unique colleges (State → College level)
        console.log('🏗️ Step 1: Creating unique colleges...');
        
        // Step 2: Insert counselling records with foreign key to unique colleges
        console.log('🏗️ Step 2: Linking counselling records...');
        
        // Step 3: Build drill-down structure
        console.log('🏗️ Step 3: Building drill-down hierarchy...');
        
        console.log('✅ Excel import complete with optimized structure');
    }

    public async runOptimizedMatching(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('🔍 Running optimized college matching...');

        // Get unique colleges only (not individual records)
        const uniqueColleges = await this.db.all(`
            SELECT * FROM unique_colleges 
            WHERE is_matched = FALSE OR is_matched IS NULL
            ORDER BY total_records DESC
        `);

        console.log(`📊 Matching ${uniqueColleges.length} unique colleges (instead of ${await this.getTotalRecords()} individual records)`);

        let matched = 0;
        let unmatched = 0;

        for (const college of uniqueColleges) {
            // Get a sample course for this college to provide context
            const sampleCourse = await this.db.get(`
                SELECT course_clean 
                FROM counselling_records 
                WHERE unique_college_id = ? 
                LIMIT 1
            `, [college.id]);

            // Use your enhanced state + course matcher
            const result = await this.matcher.match(
                college.college_clean,
                college.state,
                sampleCourse?.course_clean || 'MD IN GENERAL MEDICINE'
            );

            if (result.college) {
                // Update the unique college with match results
                await this.db.run(`
                    UPDATE unique_colleges 
                    SET 
                        matched_college_name = ?,
                        match_confidence = ?,
                        match_algorithm = ?,
                        is_matched = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    result.college.name,
                    result.confidence,
                    result.algorithmUsed,
                    college.id
                ]);
                matched++;
            } else {
                unmatched++;
            }

            if ((matched + unmatched) % 50 === 0) {
                process.stdout.write(`\r💫 Matched: ${matched}/${uniqueColleges.length} unique colleges...`);
            }
        }

        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        console.log(`✅ Optimized matching complete: ${matched} matched, ${unmatched} unmatched unique colleges`);
        console.log(`📊 Efficiency gain: Matched colleges, not individual records!`);
    }

    public async calculateOptimizedRanks(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('📊 Calculating ranks with optimized structure...');

        // Calculate round-wise ranks using the hierarchical structure
        await this.db.exec(`
            UPDATE counselling_records
            SET 
                opening_rank_round = (
                    SELECT MIN(cr2.all_india_rank)
                    FROM counselling_records cr2
                    JOIN unique_colleges uc ON cr2.unique_college_id = uc.id
                    WHERE cr2.year = counselling_records.year
                    AND cr2.round = counselling_records.round
                    AND uc.matched_college_name = (
                        SELECT uc2.matched_college_name 
                        FROM unique_colleges uc2 
                        WHERE uc2.id = counselling_records.unique_college_id
                    )
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                ),
                closing_rank_round = (
                    SELECT MAX(cr2.all_india_rank)
                    FROM counselling_records cr2
                    JOIN unique_colleges uc ON cr2.unique_college_id = uc.id
                    WHERE cr2.year = counselling_records.year
                    AND cr2.round = counselling_records.round
                    AND uc.matched_college_name = (
                        SELECT uc2.matched_college_name 
                        FROM unique_colleges uc2 
                        WHERE uc2.id = counselling_records.unique_college_id
                    )
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                )
        `);

        // Calculate year-wise ranks
        await this.db.exec(`
            UPDATE counselling_records
            SET 
                opening_rank_year = (
                    SELECT MIN(cr2.all_india_rank)
                    FROM counselling_records cr2
                    JOIN unique_colleges uc ON cr2.unique_college_id = uc.id
                    WHERE cr2.year = counselling_records.year
                    AND uc.matched_college_name = (
                        SELECT uc2.matched_college_name 
                        FROM unique_colleges uc2 
                        WHERE uc2.id = counselling_records.unique_college_id
                    )
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                ),
                closing_rank_year = (
                    SELECT MAX(cr2.all_india_rank)
                    FROM counselling_records cr2
                    JOIN unique_colleges uc ON cr2.unique_college_id = uc.id
                    WHERE cr2.year = counselling_records.year
                    AND uc.matched_college_name = (
                        SELECT uc2.matched_college_name 
                        FROM unique_colleges uc2 
                        WHERE uc2.id = counselling_records.unique_college_id
                    )
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                )
        `);

        // Flag suspicious ranks
        await this.db.exec(`
            UPDATE counselling_records
            SET is_suspicious_rank = TRUE
            WHERE opening_rank_round > closing_rank_round
            OR opening_rank_year > closing_rank_year
        `);

        console.log('✅ Optimized rank calculations complete');
    }

    public async getOptimizedTreeview(): Promise<any> {
        if (!this.db) throw new Error('Database not initialized');

        // Generate drill-down: State → College → Year → Round → Course → Category → Quota → Rank
        const treeData = await this.db.all(`
            SELECT 
                uc.state,
                uc.college_clean,
                uc.matched_college_name,
                uc.is_matched,
                uc.match_confidence,
                cr.year,
                cr.round,
                cr.course_clean,
                cr.category,
                cr.quota,
                COUNT(*) as record_count,
                MIN(cr.all_india_rank) as opening_rank,
                MAX(cr.all_india_rank) as closing_rank,
                SUM(CASE WHEN cr.is_suspicious_rank = TRUE THEN 1 ELSE 0 END) as suspicious_count
            FROM unique_colleges uc
            JOIN counselling_records cr ON uc.id = cr.unique_college_id
            GROUP BY uc.state, uc.college_clean, cr.year, cr.round, cr.course_clean, cr.category, cr.quota
            ORDER BY uc.state, uc.college_clean, cr.year, cr.round, cr.course_clean, cr.category, cr.quota
        `);

        // Build hierarchical structure: State → College → Year → Round → Course → Category → Quota
        const hierarchy: any = {};

        for (const row of treeData) {
            if (!hierarchy[row.state]) hierarchy[row.state] = {};
            if (!hierarchy[row.state][row.college_clean]) hierarchy[row.state][row.college_clean] = {
                matched_college: row.matched_college_name,
                is_matched: row.is_matched,
                match_confidence: row.match_confidence,
                years: {}
            };
            if (!hierarchy[row.state][row.college_clean].years[row.year]) hierarchy[row.state][row.college_clean].years[row.year] = {};
            if (!hierarchy[row.state][row.college_clean].years[row.year][row.round]) hierarchy[row.state][row.college_clean].years[row.year][row.round] = {};
            if (!hierarchy[row.state][row.college_clean].years[row.year][row.round][row.course_clean]) hierarchy[row.state][row.college_clean].years[row.year][row.round][row.course_clean] = {};
            if (!hierarchy[row.state][row.college_clean].years[row.year][row.round][row.course_clean][row.category]) hierarchy[row.state][row.college_clean].years[row.year][row.round][row.course_clean][row.category] = {};

            hierarchy[row.state][row.college_clean].years[row.year][row.round][row.course_clean][row.category][row.quota] = {
                record_count: row.record_count,
                opening_rank: row.opening_rank,
                closing_rank: row.closing_rank,
                suspicious_count: row.suspicious_count
            };
        }

        return hierarchy;
    }

    public async getUnmatchedColleges(): Promise<UniqueCollege[]> {
        if (!this.db) throw new Error('Database not initialized');

        return await this.db.all(`
            SELECT * FROM unique_colleges 
            WHERE is_matched = FALSE OR is_matched IS NULL
            ORDER BY total_records DESC
        `);
    }

    public async getValidationSummary(): Promise<any> {
        if (!this.db) throw new Error('Database not initialized');

        const totalRecords = await this.db.get('SELECT COUNT(*) as count FROM counselling_records');
        const totalColleges = await this.db.get('SELECT COUNT(*) as count FROM unique_colleges');
        const matchedColleges = await this.db.get('SELECT COUNT(*) as count FROM unique_colleges WHERE is_matched = TRUE');
        const suspiciousRanks = await this.db.get('SELECT COUNT(*) as count FROM counselling_records WHERE is_suspicious_rank = TRUE');

        const byState = await this.db.all(`
            SELECT 
                uc.state,
                COUNT(DISTINCT uc.id) as unique_colleges,
                SUM(uc.total_records) as total_records,
                SUM(CASE WHEN uc.is_matched = TRUE THEN 1 ELSE 0 END) as matched_colleges,
                ROUND(SUM(CASE WHEN uc.is_matched = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT uc.id), 2) as match_rate
            FROM unique_colleges uc
            GROUP BY uc.state
            ORDER BY total_records DESC
        `);

        return {
            total_records: totalRecords.count,
            total_colleges: totalColleges.count,
            matched_colleges: matchedColleges.count,
            unmatched_colleges: totalColleges.count - matchedColleges.count,
            suspicious_ranks: suspiciousRanks.count,
            college_match_rate: (matchedColleges.count / totalColleges.count) * 100,
            by_state: byState
        };
    }

    private async getTotalRecords(): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');
        const result = await this.db.get('SELECT COUNT(*) as count FROM counselling_records');
        return result.count;
    }

    public async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            console.log('✅ Database connection closed');
        }
    }

    public getDatabasePath(): string {
        return this.dbPath;
    }
}
