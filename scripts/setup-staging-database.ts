#!/usr/bin/env tsx

import { StagingDatabaseManager } from '../src/lib/data/staging-database-manager';
import fs from 'fs';
import path from 'path';

async function setupStagingDatabase() {
    console.clear();
    console.log('🚀 SETTING UP STAGING DATABASE');
    console.log('==============================');

    const stagingManager = new StagingDatabaseManager();
    
    try {
        // Initialize database
        await stagingManager.initialize();
        
        // Load foundation data
        await stagingManager.loadFoundationData();
        
        // Create sample counselling data for testing
        console.log('📝 Creating sample counselling data...');
        
        // This simulates your treeview structure
        const sampleData = [
            {
                year: 2024,
                round: 'AIQ_R1',
                state: 'ANDAMAN AND NICOBAR ISLANDS',
                college_institute_raw: 'ANDAMAN AND NICOBAR ISLANDS INSTITUTE OF MEDICAL SCIENCES, ANDAMAN AND NICOBAR,DHS ANNEXE BUILDING, ATLANTA POINT, PORT BLAIR, SOUTH ANDAMAN, ANDAMAN AND NICOBAR ISLANDS',
                college_institute_clean: 'ANDAMAN AND NICOBAR ISLANDS INSTITUTE OF MEDICAL SCIENCES',
                course_raw: 'DNB IN GENERAL MEDICINE',
                course_clean: 'DNB IN GENERAL MEDICINE',
                category: 'EWS',
                quota: 'DNB QUOTA',
                all_india_rank: 11337
            },
            {
                year: 2024,
                round: 'AIQ_R1',
                state: 'ANDAMAN AND NICOBAR ISLANDS',
                college_institute_raw: 'ANDAMAN AND NICOBAR ISLANDS INSTITUTE OF MEDICAL SCIENCES, ANDAMAN AND NICOBAR,DHS ANNEXE BUILDING, ATLANTA POINT, PORT BLAIR, SOUTH ANDAMAN, ANDAMAN AND NICOBAR ISLANDS',
                college_institute_clean: 'ANDAMAN AND NICOBAR ISLANDS INSTITUTE OF MEDICAL SCIENCES',
                course_raw: 'DNB IN GENERAL SURGERY',
                course_clean: 'DNB IN GENERAL SURGERY',
                category: 'OPEN',
                quota: 'DNB QUOTA',
                all_india_rank: 14029
            },
            {
                year: 2024,
                round: 'AIQ_R1',
                state: 'ANDHRA PRADESH',
                college_institute_raw: 'AAYUSH NRI EPL HEALTHCARE PRIVATE LIMITED, ANDHRA PRADESH,48-13-3 A, SRI RAMACHANDRA NAGAR VIJAYAWADA, ANDHRA PRADESH',
                college_institute_clean: 'AAYUSH NRI EPL HEALTHCARE PRIVATE LIMITED',
                course_raw: 'DNB IN EMERGENCY MEDICINE',
                course_clean: 'DNB IN EMERGENCY MEDICINE',
                category: 'OPEN',
                quota: 'DNB QUOTA',
                all_india_rank: 15089
            },
            {
                year: 2024,
                round: 'AIQ_R1',
                state: 'ANDHRA PRADESH',
                college_institute_raw: 'ACSR GOVERNMENT MEDICAL COLLEGE,NELLORE,OPP AC SUBBAREDDY STADIUM DARGAMITTA NELLORE, SPSR NELLORE DISTRICT, ANDHRA PRADESH',
                college_institute_clean: 'ACSR GOVERNMENT MEDICAL COLLEGE',
                course_raw: 'MD IN GENERAL MEDICINE',
                course_clean: 'MD IN GENERAL MEDICINE',
                category: 'OPEN',
                quota: 'ALL INDIA',
                all_india_rank: 2275
            }
        ];

        // Insert sample data
        const db = (stagingManager as any).db;
        const stmt = await db.prepare(`
            INSERT INTO counselling_records (
                year, round, state, college_institute_raw, college_institute_clean,
                course_raw, course_clean, category, quota, all_india_rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const record of sampleData) {
            await stmt.run(
                record.year,
                record.round,
                record.state,
                record.college_institute_raw,
                record.college_institute_clean,
                record.course_raw,
                record.course_clean,
                record.category,
                record.quota,
                record.all_india_rank
            );
        }

        await stmt.finalize();
        console.log(`✅ Inserted ${sampleData.length} sample records`);

        // Run college matching
        await stagingManager.runCollegeMatching();
        
        // Calculate ranks
        await stagingManager.calculateRanks();
        
        // Get validation summary
        const summary = await stagingManager.getValidationSummary();
        
        console.log('\n📊 VALIDATION SUMMARY');
        console.log('====================');
        console.log(`Total Records: ${summary.total_records}`);
        console.log(`Matched: ${summary.matched_records} (${summary.match_rate.toFixed(1)}%)`);
        console.log(`Unmatched: ${summary.unmatched_records}`);
        console.log(`Suspicious Ranks: ${summary.suspicious_ranks}`);

        console.log('\n📋 BY STATE:');
        summary.by_state.forEach((s: any) => {
            console.log(`  ${s.state}: ${s.matched}/${s.total} (${s.match_rate}%)`);
        });

        console.log('\n📋 BY ROUND:');
        summary.by_round.forEach((r: any) => {
            console.log(`  ${r.year} ${r.round}: ${r.matched}/${r.total} (${r.match_rate}%)`);
        });

        // Get treeview data
        console.log('\n🌳 GENERATING TREEVIEW DATA...');
        const treeData = await stagingManager.getTreeviewData();
        
        // Save treeview for web interface
        const treeviewPath = path.join(process.cwd(), 'data', 'staging-treeview.json');
        fs.writeFileSync(treeviewPath, JSON.stringify(treeData, null, 2));
        console.log(`✅ Treeview data saved to: ${path.basename(treeviewPath)}`);

        console.log('\n🎯 STAGING DATABASE READY!');
        console.log('==========================');
        console.log(`📁 Database file: ${stagingManager.getDatabasePath()}`);
        console.log('📝 Open with DB Browser for SQLite to edit');
        console.log('🌐 Web interface will be available at http://localhost:3500/staging-editor');
        console.log('\n🔄 NEXT STEPS:');
        console.log('1. Review unmatched colleges in DB Browser');
        console.log('2. Edit college mappings directly in SQLite');
        console.log('3. Re-run matching and rank calculations');
        console.log('4. Export to main database when 100% validated');

        await stagingManager.close();

    } catch (error) {
        console.error('❌ Setup failed:', error);
        await stagingManager.close();
    }
}

if (require.main === module) {
    setupStagingDatabase().catch(console.error);
}
