#!/usr/bin/env tsx

import { StagingDatabaseManager } from '../src/lib/data/staging-database-manager';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

interface RawCounsellingRecord {
    ALL_INDIA_RANK: number;
    QUOTA: string;
    'COLLEGE/INSTITUTE': string;
    STATE: string;
    COURSE: string;
    CATEGORY: string;
    ROUND: string;
    YEAR: number;
}

function safeString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function safeNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
}

async function importAIQ2024ToStaging() {
    console.clear();
    console.log('🚀 IMPORTING AIQ2024.xlsx TO STAGING DATABASE (V2)');
    console.log('=================================================');

    const stagingManager = new StagingDatabaseManager();
    
    try {
        // Initialize staging database
        await stagingManager.initialize();
        
        // Load foundation data
        await stagingManager.loadFoundationData();
        
        // Load and parse Excel file
        const excelPath = '/Users/kashyapanand/Desktop/EXPORT/AIQ2024.xlsx';
        
        if (!fs.existsSync(excelPath)) {
            console.log('❌ AIQ2024.xlsx file not found at expected location');
            return;
        }

        console.log('📥 Loading Excel file...');
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

        console.log(`✅ Loaded ${rawData.length} records from Excel`);

        // Data quality check and cleaning
        console.log('🔍 Checking data quality...');
        let validRecords = 0;
        let invalidRecords = 0;
        const issues: string[] = [];
        const cleanedData: any[] = [];

        for (let i = 0; i < rawData.length; i++) {
            const record = rawData[i];
            const problems: string[] = [];
            
            // Clean and validate each field
            const state = safeString(record.STATE);
            const college = safeString(record['COLLEGE/INSTITUTE']);
            const course = safeString(record.COURSE);
            const rank = safeNumber(record.ALL_INDIA_RANK);
            const category = safeString(record.CATEGORY);
            const quota = safeString(record.QUOTA);
            const round = safeString(record.ROUND);
            const year = safeNumber(record.YEAR);

            if (!state) problems.push('Missing STATE');
            if (!college) problems.push('Missing COLLEGE/INSTITUTE');
            if (!course) problems.push('Missing COURSE');
            if (!rank || rank <= 0) problems.push('Invalid ALL_INDIA_RANK');
            if (!category) problems.push('Missing CATEGORY');
            if (!quota) problems.push('Missing QUOTA');
            if (!round) problems.push('Missing ROUND');
            if (!year || year < 2020) problems.push('Invalid YEAR');

            if (problems.length > 0) {
                invalidRecords++;
                if (issues.length < 10) { // Show first 10 issues
                    issues.push(`Row ${i + 1}: ${problems.join(', ')}`);
                }
            } else {
                validRecords++;
                cleanedData.push({
                    state,
                    college,
                    course,
                    rank,
                    category,
                    quota,
                    round,
                    year
                });
            }
        }

        console.log(`📊 Data Quality Results:`);
        console.log(`  Valid Records: ${validRecords.toLocaleString()}`);
        console.log(`  Invalid Records: ${invalidRecords.toLocaleString()}`);
        
        if (issues.length > 0) {
            console.log(`\n⚠️ Sample Issues Found:`);
            issues.forEach(issue => console.log(`  - ${issue}`));
        }

        if (validRecords === 0) {
            console.log('❌ No valid records found. Please check the Excel file format.');
            return;
        }

        // Import valid data to staging
        console.log(`\n📥 Importing ${validRecords.toLocaleString()} valid records to staging...`);

        const db = (stagingManager as any).db;
        
        // Clear existing records
        await db.run('DELETE FROM counselling_records');
        
        // Prepare insert statement
        const stmt = await db.prepare(`
            INSERT INTO counselling_records (
                year, round, state, college_institute_raw, college_institute_clean,
                course_raw, course_clean, category, quota, all_india_rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let processed = 0;
        for (const record of cleanedData) {
            try {
                // Extract clean college name (before first comma)
                const cleanCollegeName = record.college.split(',')[0].trim();
                
                await stmt.run(
                    record.year,
                    record.round,
                    record.state,
                    record.college,
                    cleanCollegeName,
                    record.course,
                    record.course, // course_clean same as course_raw for now
                    record.category,
                    record.quota,
                    record.rank
                );

                processed++;
                if (processed % 5000 === 0) {
                    process.stdout.write(`\r💫 Processed: ${processed.toLocaleString()}/${validRecords.toLocaleString()} records...`);
                }
            } catch (error) {
                console.error(`\n❌ Error processing record ${processed + 1}:`, error);
                break;
            }
        }

        await stmt.finalize();
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        console.log(`✅ Imported ${processed.toLocaleString()} records to staging database`);

        // Run initial college matching with state + course approach
        console.log('\n🔍 Running enhanced state + course college matching...');
        await stagingManager.runCollegeMatching();
        
        // Calculate opening and closing ranks
        console.log('\n📊 Calculating opening and closing ranks...');
        await stagingManager.calculateRanks();
        
        // Get validation summary
        console.log('\n📊 Generating validation summary...');
        const summary = await stagingManager.getValidationSummary();
        
        console.log('\n📊 FINAL IMPORT SUMMARY');
        console.log('=======================');
        console.log(`Total Records: ${summary.total_records.toLocaleString()}`);
        console.log(`Matched: ${summary.matched_records.toLocaleString()} (${summary.match_rate.toFixed(1)}%)`);
        console.log(`Unmatched: ${summary.unmatched_records.toLocaleString()}`);
        console.log(`Suspicious Ranks: ${summary.suspicious_ranks.toLocaleString()}`);

        console.log('\n📋 TOP 10 STATES BY RECORDS:');
        summary.by_state.slice(0, 10).forEach((s: any, i: number) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${s.state}: ${s.matched}/${s.total} (${s.match_rate}%)`);
        });

        console.log('\n📋 ROUNDS:');
        summary.by_round.forEach((r: any) => {
            console.log(`  ${r.year} ${r.round}: ${r.matched}/${r.total} (${r.match_rate}%)`);
        });

        // Get unmatched colleges for review
        const unmatchedColleges = await stagingManager.getUnmatchedColleges();
        console.log(`\n❌ TOP 10 UNMATCHED COLLEGES:`);
        unmatchedColleges.slice(0, 10).forEach((c: any, i: number) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${c.college} (${c.state}) - ${c.record_count} records`);
        });

        // Save unmatched for manual review
        const unmatchedPath = path.join(process.cwd(), 'data', 'staging-unmatched-colleges.json');
        fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedColleges, null, 2));

        console.log('\n🎯 STAGING DATABASE READY!');
        console.log('==========================');
        console.log(`📁 SQLite Database: ${stagingManager.getDatabasePath()}`);
        console.log('📝 Open with DB Browser for SQLite to edit');
        console.log('🌐 Web interface: http://localhost:3500/staging-editor');
        console.log(`📋 Unmatched colleges: ${path.basename(unmatchedPath)}`);
        
        console.log('\n🔄 RECOMMENDED WORKFLOW:');
        console.log('1. 📝 Open staging-counselling.db in DB Browser for SQLite');
        console.log('2. 🔍 Review unmatched colleges in counselling_records table');
        console.log('3. ✏️ Edit college_institute_clean field for corrections');
        console.log('4. 🔄 Re-run matching: POST /api/staging/match');
        console.log('5. 📊 Re-calculate ranks: POST /api/staging/calculate-ranks');
        console.log('6. ✅ Export when 100% validated: POST /api/staging/export');

        await stagingManager.close();

    } catch (error) {
        console.error('❌ Import failed:', error);
        try {
            await stagingManager.close();
        } catch (closeError) {
            console.error('❌ Failed to close database:', closeError);
        }
    }
}

if (require.main === module) {
    importAIQ2024ToStaging().catch(console.error);
}
