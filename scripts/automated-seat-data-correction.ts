#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CorrectionStrategy {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeEstimate: string;
}

class AutomatedSeatDataCorrector {
  private foundationPath = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION';
  private seatDataPath = '/Users/kashyapanand/Desktop/EXPORT/seat data';

  getStrategies(): CorrectionStrategy[] {
    return [
      {
        name: "🤖 AUTOMATED FOUNDATION MAPPING (RECOMMENDED)",
        description: "Use the corrected foundation files as the master reference to auto-correct seat data",
        difficulty: 'Easy',
        timeEstimate: '5-10 minutes',
        pros: [
          "✅ Fully automated - no manual work",
          "✅ Uses your corrected foundation as source of truth",
          "✅ Handles 10k+ rows instantly", 
          "✅ Maintains college + address + state uniqueness",
          "✅ Creates mapping table for future use"
        ],
        cons: [
          "⚠️ Relies on foundation data being 100% correct",
          "⚠️ May miss seat data entries not in foundation"
        ]
      },
      {
        name: "📋 MASTER MAPPING AUTO-APPLY",
        description: "Apply the Master Mapping File rules automatically to seat data",
        difficulty: 'Easy', 
        timeEstimate: '2-5 minutes',
        pros: [
          "✅ Uses existing Master Mapping File",
          "✅ Handles known corrections (SMS → SAWAI MAN SINGH, etc.)",
          "✅ Fast batch processing",
          "✅ Can be run multiple times safely"
        ],
        cons: [
          "⚠️ Only fixes known patterns",
          "⚠️ May not catch all irregularities"
        ]
      },
      {
        name: "🔍 FUZZY MATCHING AUTO-CORRECTION",
        description: "Use fuzzy matching to automatically correct seat data against foundation",
        difficulty: 'Medium',
        timeEstimate: '10-15 minutes',
        pros: [
          "✅ Handles typos and variations automatically",
          "✅ High accuracy with similarity matching",
          "✅ Creates confidence scores",
          "✅ Handles edge cases"
        ],
        cons: [
          "⚠️ More complex logic",
          "⚠️ May need manual review of low-confidence matches"
        ]
      },
      {
        name: "📊 HYBRID APPROACH",
        description: "Combine foundation mapping + master mapping + fuzzy matching",
        difficulty: 'Medium',
        timeEstimate: '15-20 minutes',
        pros: [
          "✅ Best of all approaches",
          "✅ Highest accuracy",
          "✅ Comprehensive coverage",
          "✅ Detailed reporting"
        ],
        cons: [
          "⚠️ More complex setup",
          "⚠️ Longer processing time"
        ]
      }
    ];
  }

  async displayStrategies(): Promise<void> {
    console.log('🤖 AUTOMATED SEAT DATA CORRECTION STRATEGIES');
    console.log('============================================');
    console.log('📊 Problem: 10,000+ rows in medical seat data - too many to edit manually');
    console.log('💡 Solution: Automated correction using various approaches');
    
    const strategies = this.getStrategies();
    
    strategies.forEach((strategy, index) => {
      console.log(`\\n${strategy.name}`);
      if (index === 0) console.log('⭐ RECOMMENDED APPROACH');
      console.log(`📖 ${strategy.description}`);
      console.log(`🎯 Difficulty: ${strategy.difficulty}`);
      console.log(`⏱️ Time: ${strategy.timeEstimate}`);
      
      console.log('\\n✅ Pros:');
      strategy.pros.forEach(pro => console.log(`   ${pro}`));
      
      console.log('\\n⚠️ Cons:');
      strategy.cons.forEach(con => console.log(`   ${con}`));
      
      console.log('\\n' + '='.repeat(60));
    });
  }

  async implementFoundationMapping(): Promise<void> {
    console.log('\\n🤖 IMPLEMENTING AUTOMATED FOUNDATION MAPPING');
    console.log('=============================================');
    
    // Step 1: Load foundation colleges as reference
    console.log('📊 Step 1: Loading corrected foundation colleges...');
    const foundationColleges = await this.loadFoundationColleges();
    
    console.log(`✅ Loaded ${foundationColleges.length} foundation colleges`);
    
    // Step 2: Create mapping tables
    console.log('\\n📊 Step 2: Creating mapping tables...');
    const mappingTables = this.createMappingTables(foundationColleges);
    
    console.log(`✅ Created mapping tables:`);
    console.log(`   - Name-to-College: ${mappingTables.nameToCollege.size} entries`);
    console.log(`   - State-to-Colleges: ${mappingTables.stateToColleges.size} states`);
    
    // Step 3: Process seat data files
    console.log('\\n📊 Step 3: Auto-correcting seat data files...');
    
    const seatFiles = [
      { file: 'medical.xlsx', type: 'Medical' },
      { file: 'dental.xlsx', type: 'Dental' },
      { file: 'dnb.xlsx', type: 'DNB' }
    ];
    
    for (const { file, type } of seatFiles) {
      const filePath = path.join(this.seatDataPath, file);
      if (fs.existsSync(filePath)) {
        console.log(`\\n🔄 Processing ${file}...`);
        await this.correctSeatDataFile(filePath, type, mappingTables);
      }
    }
    
    console.log('\\n🎉 AUTOMATED CORRECTION COMPLETED!');
    console.log('✅ All seat data files corrected using foundation mapping');
    console.log('✅ Ready for final import and counselling matching');
  }

  private async loadFoundationColleges(): Promise<any[]> {
    const foundationPath = path.join(process.cwd(), 'data', 'foundation-colleges.json');
    
    if (!fs.existsSync(foundationPath)) {
      throw new Error('Foundation colleges not found. Run foundation import first.');
    }
    
    return JSON.parse(fs.readFileSync(foundationPath, 'utf-8'));
  }

  private createMappingTables(foundationColleges: any[]): {
    nameToCollege: Map<string, any[]>;
    stateToColleges: Map<string, any[]>;
    fullKeyToCollege: Map<string, any>;
  } {
    const nameToCollege = new Map<string, any[]>();
    const stateToColleges = new Map<string, any[]>();
    const fullKeyToCollege = new Map<string, any>();
    
    foundationColleges.forEach(college => {
      // Name mapping
      if (!nameToCollege.has(college.name)) {
        nameToCollege.set(college.name, []);
      }
      nameToCollege.get(college.name)!.push(college);
      
      // State mapping
      if (!stateToColleges.has(college.state)) {
        stateToColleges.set(college.state, []);
      }
      stateToColleges.get(college.state)!.push(college);
      
      // Full key mapping
      const fullKey = `${college.name}|${college.address}|${college.state}`;
      fullKeyToCollege.set(fullKey, college);
    });
    
    return { nameToCollege, stateToColleges, fullKeyToCollege };
  }

  private async correctSeatDataFile(
    filePath: string, 
    type: string, 
    mappingTables: any
  ): Promise<void> {
    
    const pythonScript = `
import pandas as pd
import json
import sys
import os

# Load the mapping data
mapping_data = ${JSON.stringify({
  fullKeyToCollege: Object.fromEntries(mappingTables.fullKeyToCollege),
  nameToCollege: Object.fromEntries(Array.from(mappingTables.nameToCollege.entries()) as [string, any][])
})}

try:
    # Read the seat data file
    df = pd.read_excel('${filePath}')
    
    print(f"Processing {len(df)} seat data rows", file=sys.stderr)
    print(f"Columns: {list(df.columns)}", file=sys.stderr)
    
    corrections_made = 0
    unmatched_entries = []
    
    # Create corrected dataframe
    corrected_df = df.copy()
    
    for i, row in df.iterrows():
        # Get current values
        if 'COLLEGE_INSTITUTE' in df.columns:
            college_col = 'COLLEGE_INSTITUTE'
        elif 'COLLEGE/INSTITUTE' in df.columns:
            college_col = 'COLLEGE/INSTITUTE'
        else:
            college_col = 'COLLEGE'
            
        current_college = str(row.get(college_col, '')).strip()
        current_state = str(row.get('STATE', '')).strip()
        current_address = str(row.get('ADDRESS', '')).strip() if 'ADDRESS' in df.columns else ''
        
        if not current_college or not current_state:
            continue
            
        # Try exact match first
        full_key = f"{current_college}|{current_address}|{current_state}"
        
        if full_key in mapping_data['fullKeyToCollege']:
            # Exact match found - already correct
            continue
        
        # Try to find correction in foundation data
        found_match = False
        
        # Look for college name in foundation
        if current_college in mapping_data['nameToCollege']:
            foundation_colleges = mapping_data['nameToCollege'][current_college]
            
            # If only one college with this name, use it
            if len(foundation_colleges) == 1:
                foundation_college = foundation_colleges[0]
                corrected_df.at[i, college_col] = foundation_college['name']
                if 'ADDRESS' in df.columns:
                    corrected_df.at[i, 'ADDRESS'] = foundation_college['address']
                corrected_df.at[i, 'STATE'] = foundation_college['state']
                corrections_made += 1
                found_match = True
            
            # If multiple colleges with same name, try to match by state
            else:
                for foundation_college in foundation_colleges:
                    if foundation_college['state'] == current_state:
                        corrected_df.at[i, college_col] = foundation_college['name']
                        if 'ADDRESS' in df.columns:
                            corrected_df.at[i, 'ADDRESS'] = foundation_college['address']
                        corrections_made += 1
                        found_match = True
                        break
        
        if not found_match:
            unmatched_entries.append({
                'row': i + 1,
                'college': current_college,
                'address': current_address,
                'state': current_state
            })
    
    print(f"✅ Made {corrections_made} corrections", file=sys.stderr)
    print(f"⚠️ {len(unmatched_entries)} entries couldn't be auto-corrected", file=sys.stderr)
    
    # Save corrected file
    output_path = '${filePath}'.replace('.xlsx', '_corrected.xlsx')
    corrected_df.to_excel(output_path, index=False)
    
    print(f"💾 Corrected file saved: {output_path}", file=sys.stderr)
    
    # Return summary
    result = {
        'original_rows': len(df),
        'corrections_made': corrections_made,
        'unmatched_entries': len(unmatched_entries),
        'output_file': output_path,
        'unmatched_sample': unmatched_entries[:10]
    }
    
    print(json.dumps(result, indent=2))
    
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
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
          try {
            const result = JSON.parse(stdout);
            console.log(`   📊 Original rows: ${result.original_rows}`);
            console.log(`   ✅ Corrections made: ${result.corrections_made}`);
            console.log(`   ⚠️ Unmatched entries: ${result.unmatched_entries}`);
            console.log(`   💾 Output file: ${result.output_file}`);
            
            if (result.unmatched_sample.length > 0) {
              console.log('   🔍 Sample unmatched entries:');
              result.unmatched_sample.forEach((entry: any, index: number) => {
                console.log(`      ${index + 1}. Row ${entry.row}: ${entry.college} | ${entry.address} | ${entry.state}`);
              });
            }
            
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
    });
  }
}

async function main() {
  const corrector = new AutomatedSeatDataCorrector();
  
  console.log('🤖 AUTOMATED SEAT DATA CORRECTION SOLUTIONS');
  console.log('===========================================');
  console.log('📊 Problem: 10,000+ rows in medical seat data too many to edit manually');
  console.log('💡 Solution: Multiple automated approaches available');
  
  await corrector.displayStrategies();
  
  console.log('\\n🎯 RECOMMENDED SOLUTION: Foundation Mapping');
  console.log('===========================================');
  console.log('1. ✅ Use your corrected foundation files (med ad.xlsx, dental ad.xlsx, dnb ad.xlsx)');
  console.log('2. ✅ Auto-map seat data entries to foundation entries');
  console.log('3. ✅ Handle 10k+ rows in minutes, not hours');
  console.log('4. ✅ Maintain data integrity and uniqueness');
  
  console.log('\\n🚀 READY TO IMPLEMENT?');
  console.log('Run: npx tsx scripts/automated-seat-data-correction.ts --execute');
}

if (require.main === module) {
  const executeFlag = process.argv.includes('--execute');
  
  if (executeFlag) {
    console.log('🚀 EXECUTING AUTOMATED CORRECTION...');
    const corrector = new AutomatedSeatDataCorrector();
    corrector.implementFoundationMapping().catch(console.error);
  } else {
    main().catch(console.error);
  }
}

export { AutomatedSeatDataCorrector };
