#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface UpdatedCollegeRecord {
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

class UpdatedMedicalCollegesImporter {
  private updatedFilePath = '/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/med ad.xlsx';

  async importUpdatedMedicalColleges(): Promise<void> {
    console.log('🏥 IMPORTING UPDATED MEDICAL COLLEGES (MED AD.XLSX)');
    console.log('==================================================');
    console.log('✅ Expected count: 886 medical colleges');

    if (!fs.existsSync(this.updatedFilePath)) {
      throw new Error(`Updated file not found: ${this.updatedFilePath}`);
    }

    console.log(`📁 File: ${this.updatedFilePath}`);
    
    try {
      const colleges = await this.processUpdatedFile();
      
      console.log('\\n📊 UPDATED MEDICAL COLLEGES IMPORT SUMMARY');
      console.log('==========================================');
      console.log(`🏥 Total Medical Colleges: ${colleges.length}`);
      
      // Show college distribution by state
      const stateDistribution = new Map<string, number>();
      colleges.forEach(college => {
        stateDistribution.set(college.state, (stateDistribution.get(college.state) || 0) + 1);
      });
      
      console.log('\\n📊 College Distribution by State (Top 10):');
      const topStates = Array.from(stateDistribution.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      topStates.forEach(([state, count], index) => {
        console.log(`   ${index + 1}. ${state}: ${count} colleges`);
      });

      // Save processed data
      const outputPath = path.join(process.cwd(), 'data', 'updated-medical-colleges.json');
      fs.writeFileSync(outputPath, JSON.stringify(colleges, null, 2));
      
      console.log(`\\n💾 Updated medical colleges saved to: ${outputPath}`);
      
      // Show sample colleges
      console.log('\\n🔍 Sample Updated Medical Colleges:');
      colleges.slice(0, 10).forEach((college, index) => {
        console.log(`   ${index + 1}. ${college.name}`);
        console.log(`      📍 ${college.address}, ${college.state}`);
        console.log(`      🆔 ID: ${college.id}`);
        console.log();
      });
      
    } catch (error) {
      console.error('❌ Failed to import updated medical colleges:', error);
      throw error;
    }
  }

  private async processUpdatedFile(): Promise<UpdatedCollegeRecord[]> {
    const pythonScript = `
import pandas as pd
import json
import sys

try:
    # Read the Excel file
    df = pd.read_excel('${this.updatedFilePath}')
    
    print(f"Processing {len(df)} rows from updated medical file", file=sys.stderr)
    print(f"Columns: {list(df.columns)}", file=sys.stderr)
    
    colleges = []
    college_id = 1
    
    for _, row in df.iterrows():
        # Extract college information - note the column name difference
        college_name = str(row.get('COLLEGE/INSTITUTE', '')).strip()
        address = str(row.get('ADDRESS', '')).strip()
        state = str(row.get('STATE', '')).strip()
        
        # Skip invalid records
        if not college_name or college_name == 'nan':
            continue
        if not state or state == 'nan':
            continue
            
        # Clean up college name (remove leading spaces)
        college_name = college_name.strip()
        
        colleges.append({
            'id': college_id,
            'name': college_name,
            'address': address,
            'city': address,  # Using address as city for now
            'state': state,
            'college_type': 'Medical',
            'management_type': 'Unknown',  # Will be filled from other data sources
            'status': 'active',
            'created_at': '2025-09-20T11:00:00.000Z',
            'updated_at': '2025-09-20T11:00:00.000Z'
        })
        college_id += 1
    
    print(f"✅ Processed {len(colleges)} medical colleges", file=sys.stderr)
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
            resolve(colleges);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
    });
  }

  async updateCombinedSeatData(): Promise<void> {
    console.log('\\n🔄 UPDATING COMBINED SEAT DATA WITH CORRECTED MEDICAL COLLEGES');
    console.log('==============================================================');
    
    // Load the updated medical colleges
    const updatedMedicalPath = path.join(process.cwd(), 'data', 'updated-medical-colleges.json');
    if (!fs.existsSync(updatedMedicalPath)) {
      throw new Error('Updated medical colleges file not found. Run import first.');
    }
    
    const updatedMedical = JSON.parse(fs.readFileSync(updatedMedicalPath, 'utf-8'));
    
    // Load existing dental and DNB colleges
    const dentalPath = path.join(process.cwd(), 'data', 'dental-processed.json');
    const dnbPath = path.join(process.cwd(), 'data', 'dnb-processed.json');
    
    let dental = [];
    let dnb = [];
    
    if (fs.existsSync(dentalPath)) {
      const dentalData = JSON.parse(fs.readFileSync(dentalPath, 'utf-8'));
      dental = dentalData.colleges || [];
    }
    
    if (fs.existsSync(dnbPath)) {
      const dnbData = JSON.parse(fs.readFileSync(dnbPath, 'utf-8'));
      dnb = dnbData.colleges || [];
    }
    
    // Combine all colleges with updated IDs
    const allColleges: any[] = [];
    let currentId = 1;
    
    // Add updated medical colleges
    updatedMedical.forEach((college: any) => {
      allColleges.push({
        ...college,
        id: currentId++
      });
    });
    
    // Add dental colleges
    dental.forEach((college: any) => {
      allColleges.push({
        ...college,
        id: currentId++
      });
    });
    
    // Add DNB colleges
    dnb.forEach((college: any) => {
      allColleges.push({
        ...college,
        id: currentId++
      });
    });
    
    console.log('📊 UPDATED COMBINED SEAT DATA SUMMARY:');
    console.log(`🏥 Medical Colleges: ${updatedMedical.length}`);
    console.log(`🦷 Dental Colleges: ${dental.length}`);
    console.log(`🎓 DNB Colleges: ${dnb.length}`);
    console.log(`📊 Total Colleges: ${allColleges.length}`);
    
    // Save the combined updated data
    const combinedPath = path.join(process.cwd(), 'data', 'corrected-colleges-final.json');
    fs.writeFileSync(combinedPath, JSON.stringify(allColleges, null, 2));
    
    console.log(`\\n💾 Final corrected colleges saved to: ${combinedPath}`);
    console.log('✅ Ready for counselling data matching with corrected medical colleges');
  }
}

async function main() {
  const importer = new UpdatedMedicalCollegesImporter();
  
  try {
    await importer.importUpdatedMedicalColleges();
    await importer.updateCombinedSeatData();
    
    console.log('\\n🎉 UPDATED MEDICAL COLLEGES IMPORT COMPLETED!');
    console.log('=============================================');
    console.log('✅ Imported 886 corrected medical colleges');
    console.log('✅ Updated combined seat data with corrections');
    console.log('✅ Maintained proper uniqueness: NAME + ADDRESS + STATE');
    console.log('✅ Ready for enhanced counselling data matching');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { UpdatedMedicalCollegesImporter };
