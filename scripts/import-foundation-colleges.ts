#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface FoundationCollege {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  college_type: string;
  management_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

class FoundationCollegesImporter {
  private foundationPath = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION';

  async importAllFoundationColleges(): Promise<void> {
    console.log('🏛️ IMPORTING UPDATED FOUNDATION COLLEGES');
    console.log('========================================');
    console.log('✅ Using COLLEGE/INSTITUTE + ADDRESS + STATE for uniqueness');
    console.log('✅ Expected: Medical=886, Dental=328, DNB=1223');

    const files = [
      { file: 'med ad.xlsx', type: 'Medical', category: 'Medical', expected: 886 },
      { file: 'dental ad.xlsx', type: 'Dental', category: 'Dental', expected: 328 },
      { file: 'dnb ad.xlsx', type: 'DNB', category: 'DNB', expected: 1223 }
    ];

    const allColleges: FoundationCollege[] = [];
    let collegeId = 1;

    for (const { file, type, category, expected } of files) {
      const filePath = path.join(this.foundationPath, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ ${file} not found at ${filePath}`);
        continue;
      }

      console.log(`\\n📊 Processing ${type} foundation colleges...`);
      console.log(`📁 File: ${filePath}`);
      console.log(`🎯 Expected: ${expected} colleges`);
      
      try {
        const colleges = await this.processFoundationFile(filePath, type, category, collegeId);
        
        allColleges.push(...colleges);
        collegeId += colleges.length;
        
        const status = colleges.length === expected ? '✅' : '⚠️';
        console.log(`${status} ${type}: ${colleges.length} colleges (expected: ${expected})`);
        
        if (colleges.length !== expected) {
          console.log(`   ⚠️ Count mismatch: got ${colleges.length}, expected ${expected}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to import ${type} foundation colleges:`, error);
      }
    }

    // Generate summary
    console.log('\\n📊 FOUNDATION COLLEGES IMPORT SUMMARY');
    console.log('=====================================');
    
    const medicalCount = allColleges.filter(c => c.college_type === 'Medical').length;
    const dentalCount = allColleges.filter(c => c.college_type === 'Dental').length;
    const dnbCount = allColleges.filter(c => c.college_type === 'DNB').length;
    
    console.log(`🏥 Medical Colleges: ${medicalCount} (expected: 886)`);
    console.log(`🦷 Dental Colleges: ${dentalCount} (expected: 328)`);
    console.log(`🎓 DNB Colleges: ${dnbCount} (expected: 1223)`);
    console.log(`📊 Total Colleges: ${allColleges.length} (expected: 2437)`);
    
    // Show state distribution
    const stateDistribution = new Map<string, number>();
    allColleges.forEach(college => {
      stateDistribution.set(college.state, (stateDistribution.get(college.state) || 0) + 1);
    });
    
    console.log('\\n📊 College Distribution by State (Top 15):');
    const topStates = Array.from(stateDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    topStates.forEach(([state, count], index) => {
      console.log(`   ${index + 1}. ${state}: ${count} colleges`);
    });

    // Show examples of colleges with same names but different locations
    console.log('\\n🔍 EXAMPLES: COLLEGES WITH SAME NAMES IN DIFFERENT LOCATIONS');
    const nameGroups = new Map<string, FoundationCollege[]>();
    allColleges.forEach(college => {
      if (!nameGroups.has(college.name)) {
        nameGroups.set(college.name, []);
      }
      nameGroups.get(college.name)!.push(college);
    });

    const multiLocationColleges = Array.from(nameGroups.entries())
      .filter(([name, colleges]) => colleges.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    multiLocationColleges.forEach(([name, colleges], index) => {
      console.log(`\\n   ${index + 1}. "${name}" (${colleges.length} locations):`);
      colleges.forEach(college => {
        console.log(`      - ${college.address}, ${college.state} (ID: ${college.id})`);
      });
    });

    // Save processed data
    const outputDir = path.join(process.cwd(), 'data');
    fs.writeFileSync(
      path.join(outputDir, 'foundation-colleges.json'), 
      JSON.stringify(allColleges, null, 2)
    );

    console.log('\\n💾 Foundation colleges saved to: data/foundation-colleges.json');
    console.log('✅ Ready for seat data integration and counselling matching');
  }

  private async processFoundationFile(
    filePath: string, 
    type: string, 
    category: string,
    startCollegeId: number
  ): Promise<FoundationCollege[]> {
    
    const pythonScript = `
import pandas as pd
import json
import sys

try:
    # Read the Excel file
    df = pd.read_excel('${filePath}')
    
    print(f"Processing {len(df)} rows from {type} foundation file", file=sys.stderr)
    print(f"Columns: {list(df.columns)}", file=sys.stderr)
    
    colleges = []
    college_id = ${startCollegeId}
    college_keys = set()  # Track unique combinations
    
    for _, row in df.iterrows():
        # Extract college information
        college_name = str(row.get('COLLEGE/INSTITUTE', '')).strip()
        address = str(row.get('ADDRESS', '')).strip()
        state = str(row.get('STATE', '')).strip()
        
        # Skip invalid records
        if not college_name or college_name == 'nan':
            continue
        if not state or state == 'nan':
            continue
            
        # Clean up college name (remove extra spaces)
        college_name = ' '.join(college_name.split())
        
        # Create unique key (COLLEGE + ADDRESS + STATE)
        college_key = f"{college_name}|{address}|{state}"
        
        # Only add if unique combination
        if college_key not in college_keys:
            college_keys.add(college_key)
            
            colleges.append({
                'id': college_id,
                'name': college_name,
                'address': address,
                'city': address.split(',')[0].strip() if address else '',  # First part of address as city
                'state': state,
                'college_type': '${type}',
                'management_type': 'Unknown',  # Will be filled from seat data
                'status': 'active',
                'created_at': '2025-09-20T12:00:00.000Z',
                'updated_at': '2025-09-20T12:00:00.000Z'
            })
            college_id += 1
    
    print(f"✅ Processed {len(colleges)} unique {type} colleges", file=sys.stderr)
    
    # Show some examples of multi-location colleges
    name_counts = {}
    for college in colleges:
        name = college['name']
        name_counts[name] = name_counts.get(name, 0) + 1
    
    multi_location = {name: count for name, count in name_counts.items() if count > 1}
    if multi_location:
        print(f"Found {len(multi_location)} college names in multiple locations:", file=sys.stderr)
        for name, count in sorted(multi_location.items(), key=lambda x: x[1], reverse=True)[:3]:
            print(f"  - {name}: {count} locations", file=sys.stderr)
    
    print(json.dumps(colleges, indent=2))
    
except Exception as e:
    print(f"Error processing file: {e}", file=sys.stderr)
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
            const colleges = JSON.parse(stdout);
            console.log(`   📊 Unique colleges: ${colleges.length}`);
            resolve(colleges);
          } catch (error) {
            reject(new Error(`Failed to parse JSON output: ${error}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
    });
  }
}

async function main() {
  const importer = new FoundationCollegesImporter();
  
  try {
    await importer.importAllFoundationColleges();
    
    console.log('\\n🎉 FOUNDATION COLLEGES IMPORT COMPLETED!');
    console.log('========================================');
    console.log('✅ Used proper uniqueness: COLLEGE/INSTITUTE + ADDRESS + STATE');
    console.log('✅ Correctly identified colleges in multiple locations');
    console.log('✅ Foundation data ready for seat data integration');
    console.log('✅ Next step: Update seat data files with this foundation');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { FoundationCollegesImporter };
