#!/usr/bin/env tsx

import { EnhancedCollegeMatcherV3 } from '../src/lib/data/enhanced-college-matcher-v3';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class EnhancedSeatDataReimporter {
  private matcher: EnhancedCollegeMatcherV3;

  constructor() {
    this.matcher = new EnhancedCollegeMatcherV3();
  }

  async runSeatDataReimport(): Promise<void> {
    console.log('🚀 ENHANCED SEAT DATA REIMPORT');
    console.log('==============================');
    console.log('✅ Using corrected foundation data (885 medical colleges)');
    console.log('✅ Enhanced PREVNAME handling');
    console.log('✅ VARDHAMAN → VARDHMAN typo correction');
    console.log('✅ ESIC → EMPLOYEES STATE INSURANCE CORPORATION');
    console.log('✅ 4-pass progressive matching');

    try {
      // Step 1: Initialize enhanced matcher
      console.log('\n📊 STEP 1: Initializing Enhanced Matcher');
      console.log('========================================');
      await this.matcher.initialize();

      // Step 2: Test VARDHAMAN correction specifically
      console.log('\n🧪 STEP 2: Testing VARDHAMAN Correction');
      console.log('======================================');
      await this.testVardhamanCorrection();

      // Step 3: Reimport medical seat data
      console.log('\n📊 STEP 3: Reimporting Medical Seat Data');
      console.log('=======================================');
      await this.reimportMedicalSeatData();

      // Step 4: Reimport dental seat data
      console.log('\n📊 STEP 4: Reimporting Dental Seat Data');
      console.log('======================================');
      await this.reimportDentalSeatData();

      // Step 5: Reimport DNB seat data
      console.log('\n📊 STEP 5: Reimporting DNB Seat Data');
      console.log('===================================');
      await this.reimportDNBSeatData();

      // Step 6: Generate final matching report
      console.log('\n📊 STEP 6: Final Matching Report');
      console.log('================================');
      this.matcher.generateStatsReport();

      console.log('\n🎉 ENHANCED SEAT DATA REIMPORT COMPLETED!');
      console.log('========================================');

    } catch (error) {
      console.error('❌ Seat data reimport failed:', error);
      throw error;
    }
  }

  private async testVardhamanCorrection(): Promise<void> {
    console.log('🧪 Testing VARDHAMAN → VARDHMAN correction...');

    const testCases = [
      { college: 'VARDHAMAN MAHAVIR MEDICAL COLLEGE', state: 'NEW DELHI' },
      { college: 'VARDHMAN MAHAVIR MEDICAL COLLEGE', state: 'NEW DELHI' },
      { college: 'VARDHAMAN INSTITUTE OF MEDICAL SCIENCES', state: 'BIHAR' },
      { college: 'VARDHMAN INSTITUTE OF MEDICAL SCIENCES', state: 'BIHAR' }
    ];

    console.log('\n🎯 VARDHAMAN CORRECTION TEST RESULTS:');
    console.log('====================================');

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const result = await this.matcher.enhancedMatch(testCase.college, testCase.state);
      
      const statusEmoji = result.matchType === 'UNMATCHED' ? '❌' : 
                         result.matchType === 'EXACT' ? '✅' : 
                         result.confidence >= 0.9 ? '🟢' : 
                         result.confidence >= 0.8 ? '🟡' : '🟠';
      
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${statusEmoji} ${testCase.college}`);
      console.log(`    Match: ${result.college.name || 'UNMATCHED'}`);
      console.log(`    Confidence: ${result.confidence.toFixed(3)}`);
      console.log(`    Pass: ${result.pass} | Method: ${result.method}`);
      console.log('');
    }
  }

  private async reimportMedicalSeatData(): Promise<void> {
    console.log('📥 Reimporting medical seat data with enhanced matching...');

    const pythonScript = `
import pandas as pd
import json
import sys
from datetime import datetime

def process_seat_data_file(file_path, data_type):
    '''Process seat data file with enhanced matching'''
    print(f'📖 Processing {data_type} seat data: {file_path}')
    
    try:
        df = pd.read_excel(file_path)
        print(f'📊 Total records: {len(df)}')
        
        # Get unique colleges for matching test
        unique_colleges = df['COLLEGE/INSTITUTE'].unique()
        print(f'📋 Unique colleges: {len(unique_colleges)}')
        
        # Sample first 20 colleges for matching test
        sample_colleges = []
        for i, college_name in enumerate(unique_colleges[:20]):
            if pd.notna(college_name):
                # Try to get state from address
                college_rows = df[df['COLLEGE/INSTITUTE'] == college_name]
                if not college_rows.empty:
                    address = str(college_rows.iloc[0].get('ADDRESS', ''))
                    state = str(college_rows.iloc[0].get('STATE', ''))
                    
                    sample_colleges.append({
                        'college': str(college_name).strip(),
                        'address': address,
                        'state': state,
                        'seat_count': len(college_rows)
                    })
        
        print(f'✅ Prepared {len(sample_colleges)} colleges for matching test')
        return sample_colleges
        
    except Exception as e:
        print(f'❌ Error processing {file_path}: {str(e)}')
        return []

# Process medical seat data
medical_file = '/Users/kashyapanand/Desktop/EXPORT/medical.xlsx'
medical_colleges = process_seat_data_file(medical_file, 'Medical')

# Save for TypeScript matching test
test_file = '/Users/kashyapanand/Public/New/medical_seat_test.json'
with open(test_file, 'w') as f:
    json.dump(medical_colleges, f, indent=2)

print(f'\\n💾 Medical seat test data saved to: {test_file}')
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
          
          // Now run the enhanced matching test on medical seat data
          await this.runSeatDataMatchingTest('medical');
          resolve();
        } else {
          reject(new Error(`Medical seat data processing failed: ${stderr}`));
        }
      });
    });
  }

  private async reimportDentalSeatData(): Promise<void> {
    console.log('📥 Reimporting dental seat data with enhanced matching...');

    const pythonScript = `
import pandas as pd
import json

# Process dental seat data
dental_file = '/Users/kashyapanand/Desktop/EXPORT/dental.xlsx'

try:
    df = pd.read_excel(dental_file)
    print(f'📖 Processing dental seat data: {dental_file}')
    print(f'📊 Total records: {len(df)}')
    
    # Get unique colleges
    unique_colleges = df['COLLEGE/INSTITUTE'].unique()
    print(f'📋 Unique colleges: {len(unique_colleges)}')
    
    # Sample for matching test
    sample_colleges = []
    for i, college_name in enumerate(unique_colleges[:10]):
        if pd.notna(college_name):
            college_rows = df[df['COLLEGE/INSTITUTE'] == college_name]
            if not college_rows.empty:
                address = str(college_rows.iloc[0].get('ADDRESS', ''))
                state = str(college_rows.iloc[0].get('STATE', ''))
                
                sample_colleges.append({
                    'college': str(college_name).strip(),
                    'address': address,
                    'state': state,
                    'seat_count': len(college_rows)
                })
    
    # Save for matching test
    test_file = '/Users/kashyapanand/Public/New/dental_seat_test.json'
    with open(test_file, 'w') as f:
        json.dump(sample_colleges, f, indent=2)
    
    print(f'💾 Dental seat test data saved to: {test_file}')
    print('✅ Dental seat data processing completed!')
    
except Exception as e:
    print(f'❌ Error processing dental seat data: {str(e)}')
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
          await this.runSeatDataMatchingTest('dental');
          resolve();
        } else {
          reject(new Error(`Dental seat data processing failed: ${stderr}`));
        }
      });
    });
  }

  private async reimportDNBSeatData(): Promise<void> {
    console.log('📥 Reimporting DNB seat data with enhanced matching...');

    const pythonScript = `
import pandas as pd
import json

# Process DNB seat data
dnb_file = '/Users/kashyapanand/Desktop/EXPORT/dnb.xlsx'

try:
    df = pd.read_excel(dnb_file)
    print(f'📖 Processing DNB seat data: {dnb_file}')
    print(f'📊 Total records: {len(df)}')
    
    # Get unique colleges
    unique_colleges = df['COLLEGE/INSTITUTE'].unique()
    print(f'📋 Unique colleges: {len(unique_colleges)}')
    
    # Sample for matching test
    sample_colleges = []
    for i, college_name in enumerate(unique_colleges[:10]):
        if pd.notna(college_name):
            college_rows = df[df['COLLEGE/INSTITUTE'] == college_name]
            if not college_rows.empty:
                address = str(college_rows.iloc[0].get('ADDRESS', ''))
                state = str(college_rows.iloc[0].get('STATE', ''))
                
                sample_colleges.append({
                    'college': str(college_name).strip(),
                    'address': address,
                    'state': state,
                    'seat_count': len(college_rows)
                })
    
    # Save for matching test
    test_file = '/Users/kashyapanand/Public/New/dnb_seat_test.json'
    with open(test_file, 'w') as f:
        json.dump(sample_colleges, f, indent=2)
    
    print(f'💾 DNB seat test data saved to: {test_file}')
    print('✅ DNB seat data processing completed!')
    
except Exception as e:
    print(f'❌ Error processing DNB seat data: {str(e)}')
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
          await this.runSeatDataMatchingTest('dnb');
          resolve();
        } else {
          reject(new Error(`DNB seat data processing failed: ${stderr}`));
        }
      });
    });
  }

  private async runSeatDataMatchingTest(dataType: string): Promise<void> {
    console.log(`🔄 Running enhanced matching test on ${dataType} seat data...`);

    const testFilePath = path.join(process.cwd(), `${dataType}_seat_test.json`);
    if (!fs.existsSync(testFilePath)) {
      console.log(`❌ Test file not found: ${testFilePath}`);
      return;
    }

    const testCases = JSON.parse(fs.readFileSync(testFilePath, 'utf-8'));
    console.log(`📊 Testing ${testCases.length} ${dataType} colleges...`);

    let totalTests = 0;
    const passResults = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let vardhamanFound = false;

    for (const testCase of testCases) {
      const result = await this.matcher.enhancedMatch(testCase.college, testCase.state);
      
      totalTests++;
      passResults[result.pass as keyof typeof passResults]++;

      // Check for VARDHAMAN correction
      if (testCase.college.includes('VARDHAMAN')) {
        vardhamanFound = true;
        console.log(`   🎯 VARDHAMAN TEST: ${testCase.college}`);
        console.log(`      → Match: ${result.college.name || 'UNMATCHED'}`);
        console.log(`      → Confidence: ${result.confidence.toFixed(3)}`);
        console.log(`      → Pass: ${result.pass} | Method: ${result.method}`);
      }

      // Show first few results
      if (totalTests <= 5) {
        const statusEmoji = result.matchType === 'UNMATCHED' ? '❌' : '✅';
        console.log(`   ${totalTests}. ${statusEmoji} ${testCase.college} → ${result.college.name || 'UNMATCHED'} (${result.confidence.toFixed(3)})`);
      }
    }

    const totalMatched = totalTests - passResults[5];
    const matchRate = (totalMatched / totalTests) * 100;

    console.log(`\n📊 ${dataType.toUpperCase()} SEAT DATA MATCHING RESULTS:`);
    console.log('='.repeat(50));
    console.log(`📋 Records tested: ${totalTests}`);
    console.log(`📈 Match rate: ${matchRate.toFixed(1)}%`);
    console.log(`Pass 1 (Exact): ${passResults[1]} (${(passResults[1]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 2 (High confidence): ${passResults[2]} (${(passResults[2]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 3 (Medium confidence): ${passResults[3]} (${(passResults[3]/totalTests*100).toFixed(1)}%)`);
    console.log(`Pass 4 (Low confidence): ${passResults[4]} (${(passResults[4]/totalTests*100).toFixed(1)}%)`);
    console.log(`Unmatched: ${passResults[5]} (${(passResults[5]/totalTests*100).toFixed(1)}%)`);

    if (!vardhamanFound && dataType === 'medical') {
      console.log('\n⚠️ VARDHAMAN colleges not found in sample - may need larger test set');
    }

    // Clean up test file
    fs.unlinkSync(testFilePath);
  }
}

async function main() {
  const reimporter = new EnhancedSeatDataReimporter();
  
  try {
    await reimporter.runSeatDataReimport();
    
  } catch (error) {
    console.error('❌ Enhanced seat data reimport failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { EnhancedSeatDataReimporter };
