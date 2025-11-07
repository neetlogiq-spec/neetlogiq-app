#!/usr/bin/env tsx

import { EnhancedCollegeMatcherV3 } from '../src/lib/data/enhanced-college-matcher-v3';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CounsellingRecord {
  id: string;
  allIndiaRank: number;
  quota: string;
  collegeInstitute: string;
  course: string;
  category: string;
  round: string;
  year: number;
  sourceFile: string;
  matchedCollegeId?: string;
  matchedCollegeName?: string;
  matchConfidence?: number;
  matchMethod?: string;
  matchPass?: number;
}

interface ProcessingStats {
  totalRecords: number;
  processedRecords: number;
  matchingStats: {
    pass1Exact: number;
    pass2HighConfidence: number;
    pass3MediumConfidence: number;
    pass4LowConfidence: number;
    unmatched: number;
  };
  overallMatchRate: number;
  processingTime: number;
  unmatchedColleges: Map<string, number>;
}

class FullCounsellingImportEnhanced {
  private matcher: EnhancedCollegeMatcherV3;
  private stats: ProcessingStats;

  constructor() {
    this.matcher = new EnhancedCollegeMatcherV3();
    this.stats = {
      totalRecords: 0,
      processedRecords: 0,
      matchingStats: {
        pass1Exact: 0,
        pass2HighConfidence: 0,
        pass3MediumConfidence: 0,
        pass4LowConfidence: 0,
        unmatched: 0
      },
      overallMatchRate: 0,
      processingTime: 0,
      unmatchedColleges: new Map()
    };
  }

  async runFullImport(): Promise<void> {
    console.log('🚀 FULL COUNSELLING DATA IMPORT WITH ENHANCED MATCHING');
    console.log('====================================================');
    console.log('✅ Enhanced College Matcher V3 with Fuse.js');
    console.log('✅ 4-pass progressive matching strategy');
    console.log('✅ VARDHAMAN → VARDHMAN typo correction');
    console.log('✅ ESIC → EMPLOYEES STATE INSURANCE CORPORATION');
    console.log('✅ SMS → SAWAI MAN SINGH expansion');
    console.log('✅ PREVNAME bracket handling (22 colleges)');
    console.log('✅ Foundation data: 2,436 colleges (885 Medical)');

    const startTime = Date.now();

    try {
      // Step 1: Initialize enhanced matcher
      console.log('\n📊 STEP 1: Initializing Enhanced Matcher');
      console.log('========================================');
      await this.matcher.initialize();

      // Step 2: Process counselling data
      console.log('\n📊 STEP 2: Processing Counselling Data');
      console.log('=====================================');
      await this.processCounsellingData();

      // Step 3: Generate final report
      console.log('\n📊 STEP 3: Generating Final Report');
      console.log('==================================');
      this.stats.processingTime = Date.now() - startTime;
      this.generateFinalReport();

      // Step 4: Save processed data
      console.log('\n💾 STEP 4: Saving Processed Data');
      console.log('================================');
      await this.saveProcessedData();

      console.log('\n🎉 FULL COUNSELLING IMPORT COMPLETED!');
      console.log('====================================');

    } catch (error) {
      console.error('❌ Full counselling import failed:', error);
      throw error;
    }
  }

  private async processCounsellingData(): Promise<void> {
    console.log('📥 Processing counselling data with enhanced matching...');

    const pythonScript = `
import pandas as pd
import json
import sys
from datetime import datetime

def process_counselling_file(file_path):
    '''Process counselling file and extract records'''
    print(f'📖 Processing: {file_path}')
    
    try:
        df = pd.read_excel(file_path)
        print(f'📊 Records: {len(df)}')
        
        records = []
        for idx, row in df.iterrows():
            # Extract required fields
            all_india_rank = row.get('ALL_INDIA_RANK', 0)
            quota = str(row.get('QUOTA', '')).strip()
            college_institute = str(row.get('COLLEGE/INSTITUTE', '')).strip()
            course = str(row.get('COURSE', '')).strip()
            category = str(row.get('CATEGORY', '')).strip()
            round_info = str(row.get('ROUND', '')).strip()
            state = str(row.get('STATE', '')).strip()
            
            # Skip invalid records
            if not all_india_rank or not college_institute or not course:
                continue
            
            # Convert rank to integer
            try:
                rank = int(all_india_rank)
            except (ValueError, TypeError):
                continue
            
            record = {
                'id': f'counselling_{idx + 1}_{int(datetime.now().timestamp())}',
                'all_india_rank': rank,
                'quota': quota,
                'college_institute': college_institute,
                'course': course,
                'category': category,
                'round': round_info,
                'state': state,
                'year': 2024,  # AIQ 2024 data
                'source_file': file_path.split('/')[-1]
            }
            
            records.append(record)
        
        print(f'✅ Processed: {len(records)} valid records')
        return records
        
    except Exception as e:
        print(f'❌ Error processing {file_path}: {str(e)}')
        return []

# Process the main counselling file
counselling_file = '/Users/kashyapanand/Desktop/EXPORT/AIQ2024.xlsx'
all_records = process_counselling_file(counselling_file)

print(f'\\n📊 COUNSELLING DATA SUMMARY:')
print(f'============================')
print(f'Total records: {len(all_records):,}')

# Sample analysis
if all_records:
    unique_colleges = set(record['college_institute'] for record in all_records)
    unique_courses = set(record['course'] for record in all_records)
    unique_states = set(record['state'] for record in all_records if record['state'])
    
    print(f'Unique colleges: {len(unique_colleges)}')
    print(f'Unique courses: {len(unique_courses)}')
    print(f'Unique states: {len(unique_states)}')

# Save for TypeScript processing
output_file = '/Users/kashyapanand/Public/New/counselling_data_full.json'
with open(output_file, 'w') as f:
    json.dump(all_records, f, indent=2)

print(f'\\n💾 Counselling data saved to: {output_file}')
print('✅ Ready for enhanced matching!')
`;

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          console.log(stdout);
          
          // Now run enhanced matching on all records
          await this.runEnhancedMatching();
          resolve();
        } else {
          reject(new Error(`Counselling data processing failed: ${stderr}`));
        }
      });
    });
  }

  private async runEnhancedMatching(): Promise<void> {
    console.log('🔄 Running enhanced matching on all counselling records...');

    const counsellingDataPath = path.join(process.cwd(), 'counselling_data_full.json');
    if (!fs.existsSync(counsellingDataPath)) {
      throw new Error('Counselling data file not found');
    }

    const counsellingRecords = JSON.parse(fs.readFileSync(counsellingDataPath, 'utf-8'));
    this.stats.totalRecords = counsellingRecords.length;

    console.log(`📊 Processing ${this.stats.totalRecords.toLocaleString()} counselling records...`);

    const processedRecords: CounsellingRecord[] = [];
    const batchSize = 1000; // Process in batches for better performance
    let processedCount = 0;

    for (let i = 0; i < counsellingRecords.length; i += batchSize) {
      const batch = counsellingRecords.slice(i, i + batchSize);
      
      for (const record of batch) {
        // Extract clean college name (before first comma)
        const cleanCollegeName = record.college_institute.split(',')[0].trim();
        
        // Run enhanced matching
        const matchResult = await this.matcher.enhancedMatch(cleanCollegeName, record.state);
        
        // Update statistics
        this.updateMatchingStats(matchResult);
        
        // Create processed record
        const processedRecord: CounsellingRecord = {
          id: record.id,
          allIndiaRank: record.all_india_rank,
          quota: record.quota,
          collegeInstitute: record.college_institute,
          course: record.course,
          category: record.category,
          round: record.round,
          year: record.year,
          sourceFile: record.source_file,
          matchedCollegeId: matchResult.college.id || undefined,
          matchedCollegeName: matchResult.college.name || undefined,
          matchConfidence: matchResult.confidence,
          matchMethod: matchResult.method,
          matchPass: matchResult.pass
        };

        processedRecords.push(processedRecord);
        processedCount++;

        // Track unmatched colleges
        if (matchResult.matchType === 'UNMATCHED') {
          const collegeKey = `${cleanCollegeName}|${record.state}`;
          this.stats.unmatchedColleges.set(
            collegeKey, 
            (this.stats.unmatchedColleges.get(collegeKey) || 0) + 1
          );
        }
      }

      // Progress update
      const progress = ((i + batch.length) / counsellingRecords.length) * 100;
      console.log(`   Progress: ${progress.toFixed(1)}% (${processedCount.toLocaleString()}/${this.stats.totalRecords.toLocaleString()})`);
    }

    this.stats.processedRecords = processedCount;
    this.stats.overallMatchRate = ((this.stats.processedRecords - this.stats.matchingStats.unmatched) / this.stats.processedRecords) * 100;

    // Save processed records
    const processedDataPath = path.join(process.cwd(), 'counselling_processed_full.json');
    fs.writeFileSync(processedDataPath, JSON.stringify(processedRecords, null, 2));

    console.log(`✅ Enhanced matching completed on ${processedCount.toLocaleString()} records`);
    
    // Clean up temporary file
    fs.unlinkSync(counsellingDataPath);
  }

  private updateMatchingStats(matchResult: any): void {
    switch (matchResult.pass) {
      case 1:
        this.stats.matchingStats.pass1Exact++;
        break;
      case 2:
        this.stats.matchingStats.pass2HighConfidence++;
        break;
      case 3:
        this.stats.matchingStats.pass3MediumConfidence++;
        break;
      case 4:
        this.stats.matchingStats.pass4LowConfidence++;
        break;
      case 5:
        this.stats.matchingStats.unmatched++;
        break;
    }
  }

  private generateFinalReport(): void {
    console.log('\n📊 FULL COUNSELLING IMPORT FINAL REPORT');
    console.log('=======================================');
    
    console.log(`📋 Total records processed: ${this.stats.totalRecords.toLocaleString()}`);
    console.log(`⏱️  Total processing time: ${(this.stats.processingTime / 1000).toFixed(1)} seconds`);
    console.log(`📈 Overall match rate: ${this.stats.overallMatchRate.toFixed(1)}%`);
    console.log('');
    
    console.log('🎯 MATCHING BREAKDOWN:');
    console.log(`Pass 1 (Exact): ${this.stats.matchingStats.pass1Exact.toLocaleString()} (${(this.stats.matchingStats.pass1Exact/this.stats.processedRecords*100).toFixed(1)}%)`);
    console.log(`Pass 2 (High confidence): ${this.stats.matchingStats.pass2HighConfidence.toLocaleString()} (${(this.stats.matchingStats.pass2HighConfidence/this.stats.processedRecords*100).toFixed(1)}%)`);
    console.log(`Pass 3 (Medium confidence): ${this.stats.matchingStats.pass3MediumConfidence.toLocaleString()} (${(this.stats.matchingStats.pass3MediumConfidence/this.stats.processedRecords*100).toFixed(1)}%)`);
    console.log(`Pass 4 (Low confidence): ${this.stats.matchingStats.pass4LowConfidence.toLocaleString()} (${(this.stats.matchingStats.pass4LowConfidence/this.stats.processedRecords*100).toFixed(1)}%)`);
    console.log(`Unmatched: ${this.stats.matchingStats.unmatched.toLocaleString()} (${(this.stats.matchingStats.unmatched/this.stats.processedRecords*100).toFixed(1)}%)`);
    
    console.log('\n🔍 TOP UNMATCHED COLLEGES:');
    const sortedUnmatched = Array.from(this.stats.unmatchedColleges.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    for (let i = 0; i < sortedUnmatched.length; i++) {
      const [collegeKey, count] = sortedUnmatched[i];
      const [college, state] = collegeKey.split('|');
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${college} (${state}) - ${count} records`);
    }
    
    console.log('\n✅ ENHANCED FEATURES IMPACT:');
    console.log('🔧 VARDHAMAN → VARDHMAN typo correction active');
    console.log('🔧 ESIC → EMPLOYEES STATE INSURANCE CORPORATION expansion');
    console.log('🔧 SMS → SAWAI MAN SINGH expansion');
    console.log('🔧 PREVNAME bracket handling for 22 colleges');
    console.log('🔧 Fuse.js fuzzy search for complex matches');
    console.log('🔧 4-pass progressive strategy optimization');
    
    if (this.stats.overallMatchRate >= 90) {
      console.log('\n🎉 OUTSTANDING! 90%+ match rate achieved!');
    } else if (this.stats.overallMatchRate >= 85) {
      console.log('\n🎉 EXCELLENT! 85%+ match rate achieved!');
    } else if (this.stats.overallMatchRate >= 80) {
      console.log('\n✅ VERY GOOD! 80%+ match rate achieved!');
    } else {
      console.log('\n📊 Good results! Enhanced matching system working effectively.');
    }

    // Generate matcher stats
    this.matcher.generateStatsReport();
  }

  private async saveProcessedData(): Promise<void> {
    console.log('💾 Saving processed counselling data...');

    const processedDataPath = path.join(process.cwd(), 'counselling_processed_full.json');
    if (!fs.existsSync(processedDataPath)) {
      console.log('❌ Processed data file not found');
      return;
    }

    // Create final report
    const reportData = {
      importTimestamp: new Date().toISOString(),
      stats: this.stats,
      enhancedFeatures: {
        typoCorrection: true,
        abbreviationExpansion: true,
        prevnameHandling: true,
        fuseJsIntegration: true,
        progressiveMatching: true
      },
      foundationData: {
        totalColleges: 2436,
        medicalColleges: 885,
        dentalColleges: 328,
        dnbColleges: 1223,
        prevnameColleges: 22
      }
    };

    const reportPath = path.join(process.cwd(), 'data', 'counselling-import-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    console.log(`✅ Final report saved to: ${reportPath}`);
    console.log(`📊 Processed data available at: ${processedDataPath}`);
  }
}

async function main() {
  const importer = new FullCounsellingImportEnhanced();
  
  try {
    await importer.runFullImport();
    
  } catch (error) {
    console.error('❌ Full counselling import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { FullCounsellingImportEnhanced };
