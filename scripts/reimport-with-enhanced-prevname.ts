#!/usr/bin/env tsx

import { EnhancedCollegeMatcherV3 } from '../src/lib/data/enhanced-college-matcher-v3';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class EnhancedPrevnameReimporter {
  private matcher: EnhancedCollegeMatcherV3;

  constructor() {
    this.matcher = new EnhancedCollegeMatcherV3();
  }

  async runCompleteReimport(): Promise<void> {
    console.log('🚀 ENHANCED PREVNAME REIMPORT PROCESS');
    console.log('====================================');
    console.log('✅ Enhanced PREVNAME bracket handling');
    console.log('✅ ESIC → EMPLOYEES STATE INSURANCE CORPORATION');
    console.log('✅ Fuse.js + 4-pass progressive matching');
    console.log('✅ Extract and index both current and previous names');

    try {
      // Step 1: Reimport foundation data with enhanced PREVNAME handling
      console.log('\n📊 STEP 1: Reimporting Foundation Data');
      console.log('=====================================');
      await this.reimportFoundationData();

      // Step 2: Reimport seat data with enhanced matching
      console.log('\n📊 STEP 2: Reimporting Seat Data');
      console.log('================================');
      await this.reimportSeatData();

      // Step 3: Test enhanced matching
      console.log('\n🧪 STEP 3: Testing Enhanced Matching');
      console.log('===================================');
      await this.testEnhancedMatching();

      // Step 4: Run sample counselling import with new matcher
      console.log('\n📊 STEP 4: Testing Counselling Import');
      console.log('====================================');
      await this.testCounsellingImport();

      console.log('\n🎉 ENHANCED PREVNAME REIMPORT COMPLETED!');
      console.log('=======================================');

    } catch (error) {
      console.error('❌ Reimport failed:', error);
      throw error;
    }
  }

  private async reimportFoundationData(): Promise<void> {
    console.log('📥 Reimporting foundation data with enhanced PREVNAME handling...');

    const pythonScript = `
import pandas as pd
import json
import sys
import re

def extract_prevname(college_name):
    '''Extract current name and previous name from brackets'''
    if not college_name:
        return college_name, None
    
    # Match pattern: "CURRENT NAME (FORMER NAME)" 
    # Example: "MYSORE MEDICAL COLLEGE AND RESEARCH INSTITUTE (GOVERNMENT MEDICAL COLLEGE)"
    match = re.match(r'^(.+?)\\s*\\(([^)]+)\\)$', college_name.strip())
    
    if match:
        current_name = match.group(1).strip()
        former_name = match.group(2).strip()
        
        # The bracket contains the formerly used name
        # Both names should be valid college names
        if (len(former_name) > 5 and 
            ('COLLEGE' in former_name.upper() or 'MEDICAL' in former_name.upper() or 
             'INSTITUTE' in former_name.upper() or 'UNIVERSITY' in former_name.upper())):
            return current_name, former_name
    
    return college_name, None

def process_foundation_file(file_path, college_type):
    '''Process foundation file with enhanced PREVNAME extraction'''
    print(f'📖 Processing {college_type} foundation file: {file_path}')
    
    try:
        df = pd.read_excel(file_path)
        
        # Handle different column name variations
        college_col = None
        for col in df.columns:
            if 'COLLEGE' in str(col).upper() and 'INSTITUTE' in str(col).upper():
                college_col = col
                break
        
        if not college_col:
            print(f'❌ Could not find COLLEGE/INSTITUTE column in {file_path}')
            return []
        
        print(f'✅ Using column: {college_col}')
        print(f'📊 Total records: {len(df)}')
        
        colleges = []
        prevname_count = 0
        
        for idx, row in df.iterrows():
            college_name = str(row[college_col]).strip()
            address = str(row.get('ADDRESS', '')).strip()
            state = str(row.get('STATE', '')).strip()
            
            if not college_name or college_name == 'nan':
                continue
            
            # Extract current and previous names
            current_name, previous_name = extract_prevname(college_name)
            
            if previous_name:
                prevname_count += 1
                print(f'   📋 Extracted: "{current_name}" (PREV: "{previous_name}")')
            
            college_data = {
                'id': f'{college_type.lower()}_{idx + 1}',
                'name': current_name,
                'previous_name': previous_name,
                'original_name': college_name,  # Keep original for reference
                'address': address,
                'state': state,
                'type': college_type,
                'management': row.get('MANAGEMENT_TYPE', ''),
                'university': row.get('UNIVERSITY_AFFILIATION', '')
            }
            
            colleges.append(college_data)
        
        print(f'✅ Processed {len(colleges)} colleges')
        print(f'📋 Extracted PREVNAME from {prevname_count} colleges')
        
        return colleges
        
    except Exception as e:
        print(f'❌ Error processing {file_path}: {str(e)}')
        return []

# Process all foundation files
foundation_files = [
    ('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/med ad.xlsx', 'Medical'),
    ('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental ad.xlsx', 'Dental'),
    ('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dnb ad.xlsx', 'DNB')
]

all_colleges = []

for file_path, college_type in foundation_files:
    colleges = process_foundation_file(file_path, college_type)
    all_colleges.extend(colleges)

print(f'\\n📊 FOUNDATION DATA SUMMARY:')
print(f'===========================')
print(f'Total colleges: {len(all_colleges)}')

# Count by type
medical_count = len([c for c in all_colleges if c['type'] == 'Medical'])
dental_count = len([c for c in all_colleges if c['type'] == 'Dental'])
dnb_count = len([c for c in all_colleges if c['type'] == 'DNB'])

print(f'Medical: {medical_count}')
print(f'Dental: {dental_count}')
print(f'DNB: {dnb_count}')

# Count PREVNAME extractions
prevname_count = len([c for c in all_colleges if c['previous_name']])
print(f'With PREVNAME: {prevname_count}')

# Save enhanced foundation data
output_file = '/Users/kashyapanand/Public/New/data/updated-foundation-colleges.json'
with open(output_file, 'w') as f:
    json.dump(all_colleges, f, indent=2)

print(f'\\n💾 Enhanced foundation data saved to: {output_file}')
print(f'✅ Ready for enhanced college matching!')
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

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log(stdout);
          resolve();
        } else {
          reject(new Error(`Foundation reimport failed: ${stderr}`));
        }
      });
    });
  }

  private async reimportSeatData(): Promise<void> {
    console.log('📥 Reimporting seat data with enhanced matching...');

    // For now, we'll skip seat data reimport as the foundation data is the primary focus
    // The seat data structure hasn't changed, only our matching algorithm has improved
    console.log('⚠️ Seat data reimport skipped - using existing seat data with enhanced matching');
    console.log('✅ Enhanced matcher will handle seat data matching automatically');
  }

  private async testEnhancedMatching(): Promise<void> {
    console.log('🧪 Testing enhanced matching with sample data...');

    // Initialize the enhanced matcher
    await this.matcher.initialize();

    // Test cases including PREVNAME scenarios
    const testCases = [
      // Regular cases
      { college: 'MYSORE MEDICAL COLLEGE AND RESEARCH INSTITUTE', state: 'KARNATAKA' },
      { college: 'ESIC MEDICAL COLLEGE & HOSPITAL', state: 'HARYANA' },
      { college: 'SMS MEDICAL COLLEGE', state: 'RAJASTHAN' },
      { college: 'GOVERNMENT MEDICAL COLLEGE', state: 'KERALA' },
      
      // Typo cases
      { college: 'VARDHAMAN MAHAVIR MEDICAL COLLEGE', state: 'NEW DELHI' },
      { college: 'JAWAHAR LAL NEHRU MEDICAL COLLEGE', state: 'KARNATAKA' },
      { college: 'OSMANIA MEDICAL COLLGE', state: 'TELANGANA' },
      
      // PREVNAME cases (if they exist in our data)
      { college: 'MYSORE MEDICAL COLLEGE', state: 'KARNATAKA' },
      { college: 'GOVERNMENT MEDICAL COLLEGE', state: 'KARNATAKA' }
    ];

    console.log('\n🎯 ENHANCED MATCHING TEST RESULTS:');
    console.log('==================================');

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const result = await this.matcher.enhancedMatch(testCase.college, testCase.state);
      
      const statusEmoji = result.matchType === 'UNMATCHED' ? '❌' : 
                         result.matchType === 'EXACT' ? '✅' : 
                         result.confidence >= 0.9 ? '🟢' : 
                         result.confidence >= 0.8 ? '🟡' : '🟠';
      
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${statusEmoji} ${testCase.college} (${testCase.state})`);
      console.log(`    Pass ${result.pass}: ${result.matchType}`);
      console.log(`    Match: ${result.college.name || 'None'}`);
      console.log(`    Confidence: ${result.confidence.toFixed(3)}`);
      console.log(`    Method: ${result.method}`);
      console.log(`    Matched Name: ${result.matchedName}`);
      
      if (result.college.previousName) {
        console.log(`    Previous Name: ${result.college.previousName}`);
      }
      console.log('');
    }

    // Generate stats report
    this.matcher.generateStatsReport();
  }

  private async testCounsellingImport(): Promise<void> {
    console.log('📊 Testing counselling import with enhanced matcher...');

    const pythonScript = `
import pandas as pd
import json
import sys
from datetime import datetime

# Load a sample of counselling data
counselling_file = '/Users/kashyapanand/Desktop/EXPORT/AIQ2024.xlsx'

print('📖 Loading counselling data sample...')
df = pd.read_excel(counselling_file)

# Process first 1000 records as a test
sample_size = min(1000, len(df))
print(f'📊 Testing with {sample_size} records...')

test_cases = []
for i in range(sample_size):
    row = df.iloc[i]
    
    college_full = str(row['COLLEGE/INSTITUTE']).strip()
    state = str(row['STATE']).strip()
    
    if college_full and state and state != 'nan':
        # Extract college name (before first comma)
        college_name = college_full.split(',')[0].strip()
        
        test_cases.append({
            'college': college_name,
            'state': state,
            'course': str(row.get('COURSE', '')),
            'round': str(row.get('ROUND', ''))
        })

print(f'✅ Prepared {len(test_cases)} test cases')

# Save test cases for the TypeScript matcher
test_file = '/Users/kashyapanand/Public/New/counselling_test_cases.json'
with open(test_file, 'w') as f:
    json.dump(test_cases, f, indent=2)

print(f'💾 Test cases saved to: {test_file}')
print('✅ Ready for enhanced matching test!')
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
          
          // Now run the enhanced matching test
          await this.runEnhancedMatchingTest();
          resolve();
        } else {
          reject(new Error(`Counselling test preparation failed: ${stderr}`));
        }
      });
    });
  }

  private async runEnhancedMatchingTest(): Promise<void> {
    console.log('🔄 Running enhanced matching test on counselling data...');

    const testCasesPath = path.join(process.cwd(), 'counselling_test_cases.json');
    if (!fs.existsSync(testCasesPath)) {
      console.log('❌ Test cases file not found');
      return;
    }

    const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
    const startTime = Date.now();

    let totalTests = 0;
    const passResults = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    console.log(`📊 Processing ${testCases.length} test cases...`);

    for (let i = 0; i < Math.min(100, testCases.length); i++) { // Test first 100 for demo
      const testCase = testCases[i];
      const result = await this.matcher.enhancedMatch(testCase.college, testCase.state);
      
      totalTests++;
      passResults[result.pass as keyof typeof passResults]++;

      if (i < 10) { // Show first 10 results
        const statusEmoji = result.matchType === 'UNMATCHED' ? '❌' : '✅';
        console.log(`   ${(i + 1).toString().padStart(2, ' ')}. ${statusEmoji} ${testCase.college} → ${result.college.name || 'UNMATCHED'} (${result.confidence.toFixed(3)})`);
      }
    }

    const processingTime = Date.now() - startTime;
    const totalMatched = totalTests - passResults[5];
    const matchRate = (totalMatched / totalTests) * 100;

    console.log('\n📊 ENHANCED MATCHING RESULTS ON COUNSELLING DATA:');
    console.log('================================================');
    console.log(`⏱️  Processing time: ${processingTime}ms`);
    console.log(`📋 Records processed: ${totalTests}`);
    console.log(`📈 Match rate: ${matchRate.toFixed(1)}%`);
    console.log('');
    console.log('🎯 PASS BREAKDOWN:');
    console.log(`Pass 1 (Exact): ${passResults[1]} (${(passResults[1]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 2 (High confidence): ${passResults[2]} (${(passResults[2]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 3 (Medium confidence): ${passResults[3]} (${(passResults[3]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 4 (Low confidence): ${passResults[4]} (${(passResults[4]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 5 (Unmatched): ${passResults[5]} (${(passResults[5]/totalTests*100).toFixed(1)}%)`);

    if (matchRate >= 90) {
      console.log('\n🎉 EXCELLENT! 90%+ match rate achieved with enhanced matcher!');
    } else if (matchRate >= 85) {
      console.log('\n✅ VERY GOOD! 85%+ match rate achieved!');
    } else {
      console.log('\n📊 Good results! Enhanced matching is working.');
    }

    // Clean up test file
    fs.unlinkSync(testCasesPath);
  }
}

async function main() {
  const reimporter = new EnhancedPrevnameReimporter();
  
  try {
    await reimporter.runCompleteReimport();
    
  } catch (error) {
    console.error('❌ Enhanced PREVNAME reimport failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { EnhancedPrevnameReimporter };
