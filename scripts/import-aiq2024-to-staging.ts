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

async function importAIQ2024ToStaging() {
    console.clear();
    console.log('🚀 IMPORTING AIQ2024.xlsx TO STAGING DATABASE');
    console.log('============================================');

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
        const rawData: RawCounsellingRecord[] = XLSX.utils.sheet_to_json(worksheet);

        console.log(`✅ Loaded ${rawData.length} records from Excel`);

        // Clean and prepare data for staging
        console.log('🧹 Cleaning and preparing data...');
        
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
        for (const record of rawData) {
            // Extract clean college name (before first comma)
            const cleanCollegeName = record['COLLEGE/INSTITUTE'].split(',')[0].trim();
            
            // Clean course name
            const cleanCourseName = record.COURSE.trim();
            
            await stmt.run(
                record.YEAR || 2024,
                record.ROUND || 'AIQ_R1',
                record.STATE,
                record['COLLEGE/INSTITUTE'],
                cleanCollegeName,
                record.COURSE,
                cleanCourseName,
                record.CATEGORY,
                record.QUOTA,
                record.ALL_INDIA_RANK
            );

            processed++;
            if (processed % 1000 === 0) {
                process.stdout.write(`\r💫 Processed: ${processed}/${rawData.length} records...`);
            }
        }

        await stmt.finalize();
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        console.log(`✅ Imported ${processed} records to staging database`);

        // Run initial college matching with state + course approach
        console.log('\n🔍 Running enhanced state + course college matching...');
        await stagingManager.runCollegeMatching();
        
        // Calculate opening and closing ranks
        console.log('\n📊 Calculating opening and closing ranks...');
        await stagingManager.calculateRanks();
        
        // Get validation summary
        console.log('\n📊 Generating validation summary...');
        const summary = await stagingManager.getValidationSummary();
        
        console.log('\n📊 IMPORT SUMMARY');
        console.log('=================');
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
        await stagingManager.close();
    }
}

if (require.main === module) {
    importAIQ2024ToStaging().catch(console.error);
}
