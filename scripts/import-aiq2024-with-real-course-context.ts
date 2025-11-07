#!/usr/bin/env tsx

import { OptimizedStagingDatabase } from '../src/lib/data/optimized-staging-database';
import { StateCourseHierarchicalMatcher } from '../src/lib/data/state-course-hierarchical-matcher';
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

interface UniqueCollege {
    state: string;
    college_raw: string;
    college_clean: string;
    total_records: number;
    courses: string[];
    sample_course: string;
    records: any[];
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

async function processInChunks<T>(items: T[], chunkSize: number, processor: (chunk: T[]) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await processor(chunk);
        
        const progress = Math.min(i + chunkSize, items.length);
        process.stdout.write(`\r💫 Processed: ${progress.toLocaleString()}/${items.length.toLocaleString()} records...`);
    }
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
}

async function importWithRealCourseContext() {
    console.clear();
    console.log('🚀 IMPORTING WITH REAL COURSE CONTEXT');
    console.log('====================================');
    console.log('📋 Enhanced: State → College (with REAL course context) → Hierarchy');

    const stagingDb = new OptimizedStagingDatabase();
    const matcher = new StateCourseHierarchicalMatcher();
    
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

        // Step 1: Clean and validate data in chunks
        console.log('🧹 Cleaning and validating data in chunks...');
        const cleanedData: any[] = [];
        const CHUNK_SIZE = 1000;

        await processInChunks(rawData, CHUNK_SIZE, async (chunk) => {
            for (const record of chunk) {
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
                }
            }
        });

        console.log(`✅ Cleaned ${cleanedData.length.toLocaleString()} valid records`);

        // Step 2: Extract unique colleges with REAL course context
        console.log('🏗️ Extracting unique colleges with REAL course context...');
        const uniqueCollegesMap = new Map<string, UniqueCollege>();
        
        for (const record of cleanedData) {
            const key = `${record.state}|${record.college_raw}`; // Full college + state for uniqueness
            
            if (!uniqueCollegesMap.has(key)) {
                uniqueCollegesMap.set(key, {
                    state: record.state,
                    college_raw: record.college_raw,
                    college_clean: record.college_clean,
                    total_records: 0,
                    courses: [],
                    sample_course: record.course_clean, // REAL course from data
                    records: []
                });
            }
            
            const collegeData = uniqueCollegesMap.get(key)!;
            collegeData.total_records++;
            collegeData.records.push(record);
            
            // Collect all unique courses for this college
            if (!collegeData.courses.includes(record.course_clean)) {
                collegeData.courses.push(record.course_clean);
            }
        }

        const uniqueColleges = Array.from(uniqueCollegesMap.values());
        console.log(`✅ Extracted ${uniqueColleges.length.toLocaleString()} unique colleges`);
        console.log(`📊 Efficiency gain: ${((1 - uniqueColleges.length / cleanedData.length) * 100).toFixed(1)}% reduction in matching workload`);

        // Step 3: Pre-match colleges using REAL course context (before database insert!)
        console.log('🎯 Pre-matching colleges with REAL course context...');
        
        let matched = 0;
        let unmatched = 0;
        const matchResults = new Map<string, any>();

        await processInChunks(uniqueColleges, 50, async (chunk) => {
            for (const college of chunk) {
                // Use REAL course from this college's actual data
                const realCourse = college.sample_course;
                
                // Apply your enhanced state + course algorithm
                const result = await matcher.match(
                    college.college_clean,
                    college.state,
                    realCourse // REAL course context!
                );

                const key = `${college.state}|${college.college_raw}`;
                
                if (result.college) {
                    matchResults.set(key, {
                        matched_college_name: result.college.name,
                        match_confidence: result.confidence,
                        match_algorithm: result.algorithmUsed,
                        is_matched: true,
                        search_reduction: result.searchSpaceReduction
                    });
                    matched++;
                } else {
                    matchResults.set(key, {
                        matched_college_name: null,
                        match_confidence: 0,
                        match_algorithm: 'NONE',
                        is_matched: false,
                        search_reduction: 'No match found'
                    });
                    unmatched++;
                }
            }
        });

        console.log(`✅ Pre-matching complete: ${matched} matched, ${unmatched} unmatched`);
        console.log(`📊 Match rate: ${(matched / uniqueColleges.length * 100).toFixed(1)}%`);

        // Step 4: Insert pre-matched data into staging database
        console.log('📥 Inserting pre-matched data into staging database...');
        
        const db = (stagingDb as any).db;
        await db.run('DELETE FROM unique_colleges');
        await db.run('DELETE FROM counselling_records');
        await db.run('DELETE FROM foundation_colleges');

        // Insert foundation colleges
        console.log('📚 Loading foundation colleges...');
        const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        const foundationColleges = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));

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

        // Insert unique colleges with pre-match results
        console.log('🏗️ Inserting unique colleges with match results...');
        const collegeStmt = await db.prepare(`
            INSERT INTO unique_colleges (
                state, college_raw, college_clean, total_records,
                matched_college_name, match_confidence, match_algorithm, is_matched
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const collegeIdMap = new Map<string, number>();
        
        for (const college of uniqueColleges) {
            const key = `${college.state}|${college.college_raw}`;
            const matchResult = matchResults.get(key);
            
            const result = await collegeStmt.run(
                college.state,
                college.college_raw,
                college.college_clean,
                college.total_records,
                matchResult?.matched_college_name || null,
                matchResult?.match_confidence || null,
                matchResult?.match_algorithm || null,
                matchResult?.is_matched || false
            );
            
            collegeIdMap.set(key, result.lastID as number);
        }

        await collegeStmt.finalize();
        console.log(`✅ Inserted ${uniqueColleges.length.toLocaleString()} pre-matched unique colleges`);

        // Step 5: Insert counselling records in chunks
        console.log('🔗 Linking counselling records to pre-matched colleges...');
        
        const recordStmt = await db.prepare(`
            INSERT INTO counselling_records (
                unique_college_id, year, round, course_raw, course_clean, 
                category, quota, all_india_rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let totalProcessed = 0;
        
        for (const college of uniqueColleges) {
            const key = `${college.state}|${college.college_raw}`;
            const collegeId = collegeIdMap.get(key);
            
            // Process this college's records in chunks
            await processInChunks(college.records, 500, async (chunk) => {
                for (const record of chunk) {
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
                    totalProcessed++;
                }
            });
        }

        await recordStmt.finalize();
        console.log(`✅ Linked ${totalProcessed.toLocaleString()} records to pre-matched colleges`);

        // Step 6: Calculate ranks using optimized structure
        console.log('📊 Calculating ranks with pre-matched structure...');
        await stagingDb.calculateOptimizedRanks();
        
        // Step 7: Generate comprehensive summary
        console.log('📊 Generating final summary...');
        const summary = await stagingDb.getValidationSummary();
        
        console.log('\n📊 FINAL IMPORT SUMMARY WITH REAL COURSE CONTEXT');
        console.log('================================================');
        console.log(`Total Records: ${summary.total_records.toLocaleString()}`);
        console.log(`Unique Colleges: ${summary.total_colleges.toLocaleString()}`);
        console.log(`Pre-Matched Colleges: ${summary.matched_colleges.toLocaleString()} (${summary.college_match_rate.toFixed(1)}%)`);
        console.log(`Unmatched Colleges: ${summary.unmatched_colleges.toLocaleString()}`);
        console.log(`Suspicious Ranks: ${summary.suspicious_ranks.toLocaleString()}`);

        console.log('\n📋 TOP 10 STATES BY RECORDS:');
        summary.by_state.slice(0, 10).forEach((s: any, i: number) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${s.state}: ${s.matched_colleges}/${s.unique_colleges} colleges (${s.match_rate}%)`);
        });

        // Get unmatched colleges for review
        const unmatchedColleges = await stagingDb.getUnmatchedColleges();
        console.log(`\n❌ TOP 10 UNMATCHED COLLEGES (Need Review):`);
        unmatchedColleges.slice(0, 10).forEach((c: any, i: number) => {
            console.log(`${(i + 1).toString().padStart(2)}. ${c.college_clean} (${c.state}) - ${c.total_records} records`);
        });

        // Save detailed results
        const resultsPath = path.join(process.cwd(), 'data', 'pre-matched-results.json');
        const detailedResults = {
            summary,
            unmatched_colleges: unmatchedColleges,
            match_efficiency: {
                total_records: cleanedData.length,
                unique_colleges: uniqueColleges.length,
                efficiency_gain: ((1 - uniqueColleges.length / cleanedData.length) * 100).toFixed(1) + '%',
                approach: 'State + Real Course Context'
            }
        };
        fs.writeFileSync(resultsPath, JSON.stringify(detailedResults, null, 2));

        console.log('\n🎯 STAGING DATABASE WITH REAL COURSE CONTEXT READY!');
        console.log('==================================================');
        console.log(`📁 SQLite Database: ${stagingDb.getDatabasePath()}`);
        console.log('📝 Open with DB Browser for SQLite to edit');
        console.log('🌐 Web interface: http://localhost:3500/staging-editor');
        console.log(`📊 Detailed results: ${path.basename(resultsPath)}`);
        
        console.log('\n🔄 OPTIMIZED WORKFLOW:');
        console.log('1. 📊 Review pre-matched results in staging database');
        console.log('2. 🔍 Focus on unmatched colleges (side-by-side review)');
        console.log('3. ✏️ Edit college mappings in unique_colleges table');
        console.log('4. 🔄 Re-calculate ranks if needed');
        console.log('5. ✅ Approve and export when 100% validated');

        console.log('\n📈 REAL COURSE CONTEXT BENEFITS:');
        console.log('===============================');
        console.log('✅ Uses ACTUAL courses from college data (not assumptions)');
        console.log('✅ Maximum search precision (99.6% reduction possible)');
        console.log('✅ Prevents medical/dental/hospital cross-matches');
        console.log('✅ Perfect alignment with your hierarchical algorithm');
        console.log(`✅ Pre-matched ${matched} colleges using real course context`);
        console.log(`✅ ${((1 - uniqueColleges.length / cleanedData.length) * 100).toFixed(1)}% efficiency gain`);

        await stagingDb.close();

    } catch (error) {
        console.error('❌ Import failed:', error);
        await stagingDb.close();
    }
}

if (require.main === module) {
    importWithRealCourseContext().catch(console.error);
}
