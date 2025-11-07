#!/usr/bin/env tsx

import { OptimizedStagingDatabase } from '../src/lib/data/optimized-staging-database';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

interface RawRecord {
    ALL_INDIA_RANK: any;
    QUOTA: any;
    'COLLEGE/INSTITUTE': any;
    STATE: any;
    COURSE: any;
    CATEGORY: any;
    ROUND: any;
    YEAR: any;
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

async function importAIQ2024Optimized() {
    console.clear();
    console.log('🚀 IMPORTING AIQ2024.xlsx WITH OPTIMIZED STRUCTURE');
    console.log('=================================================');
    console.log('📋 Drill-down: State → College → Year → Round → Course → Category → Quota → Rank');

    const stagingDb = new OptimizedStagingDatabase();
    
    try {
        // Initialize optimized staging database
        await stagingDb.initialize();
        
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
        const rawData: RawRecord[] = XLSX.utils.sheet_to_json(worksheet);

        console.log(`✅ Loaded ${rawData.length.toLocaleString()} records from Excel`);

        // Step 1: Clean and validate data
        console.log('🧹 Cleaning and validating data...');
        const cleanedData: any[] = [];
        let validRecords = 0;
        let invalidRecords = 0;

        for (let i = 0; i < rawData.length; i++) {
            const record = rawData[i];
            
            const state = safeString(record.STATE);
            const college = safeString(record['COLLEGE/INSTITUTE']);
            const course = safeString(record.COURSE);
            const rank = safeNumber(record.ALL_INDIA_RANK);
            const category = safeString(record.CATEGORY);
            const quota = safeString(record.QUOTA);
            const round = safeString(record.ROUND);
            const year = safeNumber(record.YEAR);

            // Validate required fields
            if (state && college && course && rank > 0 && category && quota && round && year > 2020) {
                cleanedData.push({
                    state,
                    college_raw: college,
                    college_clean: college.split(',')[0].trim(),
                    course_raw: course,
                    course_clean: course.trim(),
                    category,
                    quota,
                    round,
                    year,
                    rank
                });
                validRecords++;
            } else {
                invalidRecords++;
            }
        }

        console.log(`📊 Data Quality: ${validRecords.toLocaleString()} valid, ${invalidRecords.toLocaleString()} invalid`);

        // Step 2: Build optimized structure - Extract unique colleges first
        console.log('🏗️ Building optimized structure...');
        console.log('   Step 1: Extracting unique colleges (State → College level)...');

        const uniqueCollegesMap = new Map<string, any>();
        
        // Group by state + FULL college/institute to get unique colleges (as you specified)
        for (const record of cleanedData) {
            const key = `${record.state}|${record.college_raw}`; // Use FULL college name + state
            
            if (!uniqueCollegesMap.has(key)) {
                uniqueCollegesMap.set(key, {
                    state: record.state,
                    college_raw: record.college_raw,
                    college_clean: record.college_clean,
                    total_records: 0,
                    records: []
                });
            }
            
            const collegeData = uniqueCollegesMap.get(key);
            collegeData.total_records++;
            collegeData.records.push(record);
        }

        const uniqueColleges = Array.from(uniqueCollegesMap.values());
        console.log(`   ✅ Extracted ${uniqueColleges.length.toLocaleString()} unique colleges from ${validRecords.toLocaleString()} records`);
        console.log(`   📊 Efficiency gain: ${((1 - uniqueColleges.length / validRecords) * 100).toFixed(1)}% reduction in matching workload`);

        // Step 3: Insert unique colleges
        console.log('   Step 2: Inserting unique colleges...');
        
        const db = (stagingDb as any).db;
        await db.run('DELETE FROM unique_colleges');
        await db.run('DELETE FROM counselling_records');

        const collegeStmt = await db.prepare(`
            INSERT INTO unique_colleges (state, college_raw, college_clean, total_records)
            VALUES (?, ?, ?, ?)
        `);

        const collegeIdMap = new Map<string, number>();
        
        for (const college of uniqueColleges) {
            const result = await collegeStmt.run(
                college.state,
                college.college_raw,
                college.college_clean,
                college.total_records
            );
            
            const key = `${college.state}|${college.college_clean}`;
            collegeIdMap.set(key, result.lastID as number);
        }

        await collegeStmt.finalize();
        console.log(`   ✅ Inserted ${uniqueColleges.length.toLocaleString()} unique colleges`);

        // Step 4: Insert counselling records with foreign keys
        console.log('   Step 3: Linking counselling records to unique colleges...');
        
        const recordStmt = await db.prepare(`
            INSERT INTO counselling_records (
                unique_college_id, year, round, course_raw, course_clean, 
                category, quota, all_india_rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let processed = 0;
        for (const college of uniqueColleges) {
            const key = `${college.state}|${college.college_clean}`;
            const collegeId = collegeIdMap.get(key);
            
            for (const record of college.records) {
                await recordStmt.run(
                    collegeId,
                    record.year,
                    record.round,
                    record.course_raw,
                    record.course_clean,
                    record.category,
                    record.quota,
                    record.rank
                );
                
                processed++;
                if (processed % 5000 === 0) {
                    process.stdout.write(`\r💫 Linked: ${processed.toLocaleString()}/${validRecords.toLocaleString()} records...`);
                }
            }
        }

        await recordStmt.finalize();
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        console.log(`   ✅ Linked ${processed.toLocaleString()} records to unique colleges`);

        // Step 5: Load foundation data
        console.log('📥 Loading foundation colleges...');
        const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        const foundationColleges = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));

        await db.run('DELETE FROM foundation_colleges');
        const foundationStmt = await db.prepare(`
            INSERT INTO foundation_colleges (name, state, address, previous_name, college_type)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const college of foundationColleges) {
            let collegeType = 'OTHER';
            if (college.name.includes('MEDICAL COLLEGE')) collegeType = 'MEDICAL';
            else if (college.name.includes('DENTAL COLLEGE')) collegeType = 'DENTAL';
            else if (college.name.includes('HOSPITAL')) collegeType = 'HOSPITAL';
            else if (college.name.includes('INSTITUTE')) collegeType = 'INSTITUTE';

            await foundationStmt.run(
                college.name,
                college.state,
                college.address,
                college.previous_name || null,
                collegeType
            );
        }

        await foundationStmt.finalize();
        console.log(`✅ Loaded ${foundationColleges.length.toLocaleString()} foundation colleges`);

        // Step 6: Run optimized matching (only on unique colleges!)
        console.log('\n🔍 Running optimized college matching...');
        await stagingDb.runOptimizedMatching();
        
        // Step 7: Calculate ranks using optimized structure
        console.log('\n📊 Calculating ranks with optimized structure...');
        await stagingDb.calculateOptimizedRanks();
        
        // Step 8: Generate summary
        console.log('\n📊 Generating validation summary...');
        const summary = await stagingDb.getValidationSummary();
        
        console.log('\n📊 OPTIMIZED IMPORT SUMMARY');
        console.log('===========================');
        console.log(`Total Records: ${summary.total_records.toLocaleString()}`);
        console.log(`Unique Colleges: ${summary.total_colleges.toLocaleString()}`);
        console.log(`Matched Colleges: ${summary.matched_colleges.toLocaleString()} (${summary.college_match_rate.toFixed(1)}%)`);
        console.log(`Unmatched Colleges: ${summary.unmatched_colleges.toLocaleString()}`);
        console.log(`Suspicious Ranks: ${summary.suspicious_ranks.toLocaleString()}`);

        console.log('\n📋 TOP 10 STATES BY RECORDS:');
        summary.by_state.slice(0, 10).forEach((s: any, i: number) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${s.state}: ${s.matched_colleges}/${s.unique_colleges} colleges (${s.match_rate}%)`);
        });

        // Get unmatched colleges
        const unmatchedColleges = await stagingDb.getUnmatchedColleges();
        console.log(`\n❌ TOP 10 UNMATCHED COLLEGES:`);
        unmatchedColleges.slice(0, 10).forEach((c: any, i: number) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${c.college_clean} (${c.state}) - ${c.total_records} records`);
        });

        console.log('\n🎯 OPTIMIZED STAGING DATABASE READY!');
        console.log('====================================');
        console.log(`📁 SQLite Database: ${stagingDb.getDatabasePath()}`);
        console.log('📝 Open with DB Browser for SQLite to edit');
        console.log('🌐 Web interface: http://localhost:3500/staging-editor');
        
        console.log('\n🔄 OPTIMIZED WORKFLOW:');
        console.log('1. 📝 Open optimized-staging.db in DB Browser for SQLite');
        console.log('2. 🎯 Edit unique_colleges table (one edit affects all records)');
        console.log('3. 🔍 Review unmatched colleges by state');
        console.log('4. ✏️ Fix college_clean field for corrections');
        console.log('5. 🔄 Re-run optimized matching');
        console.log('6. 📊 Re-calculate ranks');
        console.log('7. ✅ Export when 100% validated');

        console.log('\n📊 EFFICIENCY GAINS:');
        console.log(`✅ Matching operations: ${uniqueColleges.length.toLocaleString()} instead of ${validRecords.toLocaleString()}`);
        console.log(`✅ Reduction: ${((1 - uniqueColleges.length / validRecords) * 100).toFixed(1)}%`);
        console.log('✅ State-first organization (perfect for your algorithm)');
        console.log('✅ College-centric editing (one change affects all records)');
        console.log('✅ Hierarchical drill-down for easy navigation');

        await stagingDb.close();

    } catch (error) {
        console.error('❌ Import failed:', error);
        await stagingDb.close();
    }
}

if (require.main === module) {
    importAIQ2024Optimized().catch(console.error);
}
