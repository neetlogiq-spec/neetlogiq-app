import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { StateCourseHierarchicalMatcher } from './state-course-hierarchical-matcher';

interface CounsellingRecord {
    id?: number;
    year: number;
    round: string;
    state: string;
    college_institute_raw: string;
    college_institute_clean: string;
    course_raw: string;
    course_clean: string;
    category: string;
    quota: string;
    all_india_rank: number;
    
    // Matching results
    matched_college_id?: number;
    matched_college_name?: string;
    matched_course_id?: number;
    matched_course_name?: string;
    match_confidence?: number;
    match_algorithm?: string;
    is_matched?: boolean;
    
    // Validation flags
    is_suspicious_rank?: boolean;
    validation_notes?: string;
    
    // Calculated ranks
    opening_rank_round?: number;
    closing_rank_round?: number;
    opening_rank_year?: number;
    closing_rank_year?: number;
}

interface ValidationSummary {
    total_records: number;
    matched_records: number;
    unmatched_records: number;
    suspicious_ranks: number;
    match_rate: number;
    by_state: Record<string, any>;
    by_round: Record<string, any>;
    by_college: Record<string, any>;
}

export class StagingDatabaseManager {
    private db: Database | null = null;
    private matcher: StateCourseHierarchicalMatcher;
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(process.cwd(), 'data', 'staging-counselling.db');
        this.matcher = new StateCourseHierarchicalMatcher();
    }

    public async initialize(): Promise<void> {
        console.log('🔧 Initializing staging database...');
        
        // Open SQLite database
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.createTables();
        console.log(`✅ Staging database initialized: ${this.dbPath}`);
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Main counselling records table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS counselling_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                
                -- Hierarchy fields for treeview
                year INTEGER NOT NULL,
                round TEXT NOT NULL,
                state TEXT NOT NULL,
                college_institute_raw TEXT NOT NULL,
                college_institute_clean TEXT,
                course_raw TEXT NOT NULL,
                course_clean TEXT,
                category TEXT NOT NULL,
                quota TEXT NOT NULL,
                all_india_rank INTEGER NOT NULL,
                
                -- Matching results
                matched_college_id INTEGER,
                matched_college_name TEXT,
                matched_course_id INTEGER,
                matched_course_name TEXT,
                match_confidence REAL,
                match_algorithm TEXT,
                is_matched BOOLEAN DEFAULT FALSE,
                
                -- Validation flags
                is_suspicious_rank BOOLEAN DEFAULT FALSE,
                validation_notes TEXT,
                
                -- Calculated ranks
                opening_rank_round INTEGER,
                closing_rank_round INTEGER,
                opening_rank_year INTEGER,
                closing_rank_year INTEGER,
                
                -- Metadata
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

        // Courses reference table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                course_type TEXT NOT NULL,
                specialty TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Manual mappings table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS manual_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unmatched_college TEXT NOT NULL,
                unmatched_state TEXT NOT NULL,
                mapped_college_id INTEGER,
                mapped_college_name TEXT,
                confidence TEXT DEFAULT 'MANUAL',
                created_by TEXT DEFAULT 'USER',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (mapped_college_id) REFERENCES foundation_colleges(id)
            )
        `);

        // Create indexes for performance
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_hierarchy ON counselling_records 
            (year, round, state, college_institute_clean, course_clean, category, quota);
            
            CREATE INDEX IF NOT EXISTS idx_matching ON counselling_records 
            (is_matched, match_confidence);
            
            CREATE INDEX IF NOT EXISTS idx_validation ON counselling_records 
            (is_suspicious_rank);
            
            CREATE INDEX IF NOT EXISTS idx_foundation_state ON foundation_colleges (state);
            CREATE INDEX IF NOT EXISTS idx_foundation_name ON foundation_colleges (name);
        `);

        console.log('✅ Database tables created with indexes');
    }

    public async importRawData(excelFilePath: string): Promise<void> {
        console.log(`📥 Importing raw data from: ${path.basename(excelFilePath)}`);
        
        // This would use your existing Excel parsing logic
        // For now, let's create a placeholder
        console.log('⏳ Excel parsing logic to be implemented...');
    }

    public async loadFoundationData(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('📥 Loading foundation colleges...');
        
        const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        const colleges = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));

        // Clear existing data
        await this.db.run('DELETE FROM foundation_colleges');

        // Insert foundation colleges
        const stmt = await this.db.prepare(`
            INSERT INTO foundation_colleges (name, state, address, previous_name, college_type)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const college of colleges) {
            // Determine college type
            let collegeType = 'OTHER';
            if (college.name.includes('MEDICAL COLLEGE')) collegeType = 'MEDICAL';
            else if (college.name.includes('DENTAL COLLEGE')) collegeType = 'DENTAL';
            else if (college.name.includes('HOSPITAL')) collegeType = 'HOSPITAL';
            else if (college.name.includes('INSTITUTE')) collegeType = 'INSTITUTE';

            await stmt.run(
                college.name,
                college.state,
                college.address,
                college.previous_name || null,
                collegeType
            );
        }

        await stmt.finalize();
        console.log(`✅ Loaded ${colleges.length} foundation colleges`);
    }

    public async runCollegeMatching(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('🔍 Running state + course college matching...');

        // Get all unmatched records
        const records = await this.db.all(`
            SELECT * FROM counselling_records 
            WHERE is_matched = FALSE OR is_matched IS NULL
            ORDER BY year, round, state, college_institute_clean
        `);

        console.log(`📊 Processing ${records.length} unmatched records...`);

        let matched = 0;
        let unmatched = 0;

        for (const record of records) {
            // Use your enhanced state + course matcher
            const result = await this.matcher.match(
                record.college_institute_clean || record.college_institute_raw,
                record.state,
                record.course_clean || record.course_raw
            );

            if (result.college) {
                // Update with match results
                await this.db.run(`
                    UPDATE counselling_records 
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
                    record.id
                ]);
                matched++;
            } else {
                unmatched++;
            }

            // Progress update every 100 records
            if ((matched + unmatched) % 100 === 0) {
                process.stdout.write(`\r💫 Processed: ${matched + unmatched}/${records.length} (${matched} matched)`);
            }
        }

        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        console.log(`✅ Matching complete: ${matched} matched, ${unmatched} unmatched`);
    }

    public async calculateRanks(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('📊 Calculating opening and closing ranks...');

        // Calculate round-wise opening/closing ranks
        await this.db.exec(`
            UPDATE counselling_records
            SET 
                opening_rank_round = (
                    SELECT MIN(all_india_rank)
                    FROM counselling_records cr2
                    WHERE cr2.year = counselling_records.year
                    AND cr2.round = counselling_records.round
                    AND cr2.matched_college_name = counselling_records.matched_college_name
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                    AND cr2.is_matched = TRUE
                ),
                closing_rank_round = (
                    SELECT MAX(all_india_rank)
                    FROM counselling_records cr2
                    WHERE cr2.year = counselling_records.year
                    AND cr2.round = counselling_records.round
                    AND cr2.matched_college_name = counselling_records.matched_college_name
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                    AND cr2.is_matched = TRUE
                )
            WHERE is_matched = TRUE
        `);

        // Calculate year-wise opening/closing ranks
        await this.db.exec(`
            UPDATE counselling_records
            SET 
                opening_rank_year = (
                    SELECT MIN(all_india_rank)
                    FROM counselling_records cr2
                    WHERE cr2.year = counselling_records.year
                    AND cr2.matched_college_name = counselling_records.matched_college_name
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                    AND cr2.is_matched = TRUE
                ),
                closing_rank_year = (
                    SELECT MAX(all_india_rank)
                    FROM counselling_records cr2
                    WHERE cr2.year = counselling_records.year
                    AND cr2.matched_college_name = counselling_records.matched_college_name
                    AND cr2.course_clean = counselling_records.course_clean
                    AND cr2.category = counselling_records.category
                    AND cr2.quota = counselling_records.quota
                    AND COALESCE(cr2.master_source_id, cr2.source_normalized, '') = COALESCE(counselling_records.master_source_id, counselling_records.source_normalized, '')
                    AND COALESCE(cr2.master_level_id, cr2.level_normalized, '') = COALESCE(counselling_records.master_level_id, counselling_records.level_normalized, '')
                    AND cr2.is_matched = TRUE
                )
            WHERE is_matched = TRUE
        `);

        // Flag suspicious ranks (where opening > closing)
        await this.db.exec(`
            UPDATE counselling_records
            SET 
                is_suspicious_rank = TRUE,
                validation_notes = 'Opening rank > Closing rank'
            WHERE opening_rank_round > closing_rank_round
            OR opening_rank_year > closing_rank_year
        `);

        console.log('✅ Rank calculations complete');
    }

    public async getValidationSummary(): Promise<ValidationSummary> {
        if (!this.db) throw new Error('Database not initialized');

        const totalRecords = await this.db.get('SELECT COUNT(*) as count FROM counselling_records');
        const matchedRecords = await this.db.get('SELECT COUNT(*) as count FROM counselling_records WHERE is_matched = TRUE');
        const suspiciousRanks = await this.db.get('SELECT COUNT(*) as count FROM counselling_records WHERE is_suspicious_rank = TRUE');

        const byState = await this.db.all(`
            SELECT 
                state,
                COUNT(*) as total,
                SUM(CASE WHEN is_matched = TRUE THEN 1 ELSE 0 END) as matched,
                ROUND(SUM(CASE WHEN is_matched = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as match_rate
            FROM counselling_records
            GROUP BY state
            ORDER BY total DESC
        `);

        const byRound = await this.db.all(`
            SELECT 
                year, round,
                COUNT(*) as total,
                SUM(CASE WHEN is_matched = TRUE THEN 1 ELSE 0 END) as matched,
                ROUND(SUM(CASE WHEN is_matched = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as match_rate
            FROM counselling_records
            GROUP BY year, round
            ORDER BY year, round
        `);

        const byCollege = await this.db.all(`
            SELECT 
                college_institute_clean,
                state,
                COUNT(*) as total,
                SUM(CASE WHEN is_matched = TRUE THEN 1 ELSE 0 END) as matched,
                matched_college_name,
                AVG(match_confidence) as avg_confidence
            FROM counselling_records
            GROUP BY college_institute_clean, state
            HAVING total > 10
            ORDER BY total DESC
            LIMIT 50
        `);

        return {
            total_records: totalRecords.count,
            matched_records: matchedRecords.count,
            unmatched_records: totalRecords.count - matchedRecords.count,
            suspicious_ranks: suspiciousRanks.count,
            match_rate: (matchedRecords.count / totalRecords.count) * 100,
            by_state: byState,
            by_round: byRound,
            by_college: byCollege
        };
    }

    public async getTreeviewData(): Promise<any> {
        if (!this.db) throw new Error('Database not initialized');

        // Generate hierarchical data: Year → Round → State → College → Course → Category → Quota
        const treeData = await this.db.all(`
            SELECT 
                year,
                round,
                state,
                college_institute_clean as college,
                matched_college_name,
                course_clean as course,
                category,
                quota,
                COUNT(*) as record_count,
                MIN(all_india_rank) as opening_rank,
                MAX(all_india_rank) as closing_rank,
                AVG(match_confidence) as avg_confidence,
                SUM(CASE WHEN is_matched = TRUE THEN 1 ELSE 0 END) as matched_count,
                SUM(CASE WHEN is_suspicious_rank = TRUE THEN 1 ELSE 0 END) as suspicious_count
            FROM counselling_records
            GROUP BY year, round, state, college_institute_clean, course_clean, category, quota
            ORDER BY year, round, state, college_institute_clean, course_clean, category, quota
        `);

        // Transform into hierarchical structure
        const hierarchy: any = {};

        for (const row of treeData) {
            // Build nested structure
            if (!hierarchy[row.year]) hierarchy[row.year] = {};
            if (!hierarchy[row.year][row.round]) hierarchy[row.year][row.round] = {};
            if (!hierarchy[row.year][row.round][row.state]) hierarchy[row.year][row.round][row.state] = {};
            if (!hierarchy[row.year][row.round][row.state][row.college]) hierarchy[row.year][row.round][row.state][row.college] = {};
            if (!hierarchy[row.year][row.round][row.state][row.college][row.course]) hierarchy[row.year][row.round][row.state][row.college][row.course] = {};
            if (!hierarchy[row.year][row.round][row.state][row.college][row.course][row.category]) hierarchy[row.year][row.round][row.state][row.college][row.course][row.category] = {};

            hierarchy[row.year][row.round][row.state][row.college][row.course][row.category][row.quota] = {
                record_count: row.record_count,
                opening_rank: row.opening_rank,
                closing_rank: row.closing_rank,
                matched_college: row.matched_college_name,
                avg_confidence: row.avg_confidence,
                matched_count: row.matched_count,
                suspicious_count: row.suspicious_count,
                match_rate: row.matched_count / row.record_count * 100
            };
        }

        return hierarchy;
    }

    public async getUnmatchedColleges(): Promise<any[]> {
        if (!this.db) throw new Error('Database not initialized');

        return await this.db.all(`
            SELECT 
                college_institute_clean as college,
                state,
                course_clean as course,
                COUNT(*) as record_count,
                GROUP_CONCAT(DISTINCT category) as categories,
                GROUP_CONCAT(DISTINCT quota) as quotas,
                MIN(all_india_rank) as best_rank,
                MAX(all_india_rank) as worst_rank
            FROM counselling_records
            WHERE is_matched = FALSE OR is_matched IS NULL
            GROUP BY college_institute_clean, state, course_clean
            ORDER BY record_count DESC
        `);
    }

    public async exportToMainDatabase(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('📤 Exporting to main database...');

        // First, backup existing main data
        const mainParquetPath = path.join(process.cwd(), 'data', 'cutoffs.parquet');
        if (fs.existsSync(mainParquetPath)) {
            const backupPath = path.join(process.cwd(), 'data', `cutoffs_backup_${Date.now()}.parquet`);
            fs.copyFileSync(mainParquetPath, backupPath);
            console.log(`✅ Backed up main data to: ${path.basename(backupPath)}`);
        }

        // Export only fully validated records
        const validatedRecords = await this.db.all(`
            SELECT 
                matched_college_name as college,
                course_clean as course,
                category,
                quota,
                round,
                year,
                opening_rank_round,
                closing_rank_round,
                opening_rank_year,
                closing_rank_year,
                match_confidence,
                match_algorithm
            FROM counselling_records
            WHERE is_matched = TRUE 
            AND is_suspicious_rank = FALSE
            ORDER BY year, round, matched_college_name, course_clean, category, quota
        `);

        // Save to JSON for now (can be converted to Parquet)
        const exportPath = path.join(process.cwd(), 'data', 'validated_counselling_export.json');
        fs.writeFileSync(exportPath, JSON.stringify(validatedRecords, null, 2));

        console.log(`✅ Exported ${validatedRecords.length} validated records to: ${path.basename(exportPath)}`);
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
