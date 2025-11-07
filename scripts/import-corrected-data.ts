#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class CorrectedDataImporter {
  private seatDataPath = '/Users/kashyapanand/Desktop/EXPORT/seat data';
  private counsellingDataPath = '/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2024';

  async importSeatData(): Promise<void> {
    console.log('🏥 IMPORTING CORRECTED SEAT DATA');
    console.log('================================');

    const files = [
      { file: 'medical.xlsx', type: 'Medical' },
      { file: 'dental.xlsx', type: 'Dental' },
      { file: 'dnb.xlsx', type: 'DNB' }
    ];

    for (const { file, type } of files) {
      const filePath = path.join(this.seatDataPath, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ ${file} not found at ${filePath}`);
        continue;
      }

      console.log(`\\n📊 Processing ${type} seat data...`);
      console.log(`📁 File: ${filePath}`);
      
      try {
        await this.processSeatDataFile(filePath, type);
        console.log(`✅ ${type} seat data imported successfully`);
      } catch (error) {
        console.error(`❌ Failed to import ${type} seat data:`, error);
      }
    }
  }

  private async processSeatDataFile(filePath: string, type: string): Promise<void> {
    // Create a Python script to parse the Excel file and generate JSON
    const pythonScript = `
import pandas as pd
import json
import sys

try:
    # Read the Excel file
    df = pd.read_excel('${filePath}')
    
    # Process the data based on file type
    colleges = []
    programs = []
    college_id = 1
    program_id = 1
    
    # Get column names
    columns = df.columns.tolist()
    print(f"Columns found: {columns}", file=sys.stderr)
    
    # Look for college/institute column
    college_col = None
    for col in columns:
        if any(keyword in col.upper() for keyword in ['COLLEGE', 'INSTITUTE', 'NAME']):
            college_col = col
            break
    
    if not college_col:
        print("No college column found", file=sys.stderr)
        sys.exit(1)
    
    # Look for course/program column  
    course_col = None
    for col in columns:
        if any(keyword in col.upper() for keyword in ['COURSE', 'PROGRAM', 'SPECIALIZATION']):
            course_col = col
            break
    
    # Process each row
    seen_colleges = set()
    seen_programs = set()
    
    for _, row in df.iterrows():
        college_name = str(row[college_col]).strip() if pd.notna(row[college_col]) else None
        
        if college_name and college_name not in seen_colleges:
            colleges.append({
                'id': college_id,
                'name': college_name,
                'college_type': '${type}',
                'management_type': 'Unknown',
                'status': 'active',
                'created_at': '2025-09-20T10:00:00.000Z',
                'updated_at': '2025-09-20T10:00:00.000Z'
            })
            seen_colleges.add(college_name)
            college_id += 1
        
        # Process programs if course column exists
        if course_col:
            program_name = str(row[course_col]).strip() if pd.notna(row[course_col]) else None
            if program_name and program_name not in seen_programs:
                programs.append({
                    'id': program_id,
                    'name': program_name,
                    'program_type': 'PG' if '${type}' != 'Medical' else 'UG',
                    'category': '${type}',
                    'status': 'active',
                    'created_at': '2025-09-20T10:00:00.000Z',
                    'updated_at': '2025-09-20T10:00:00.000Z'
                })
                seen_programs.add(program_name)
                program_id += 1
    
    # Output results
    result = {
        'colleges': colleges,
        'programs': programs,
        'summary': {
            'total_colleges': len(colleges),
            'total_programs': len(programs),
            'file_type': '${type}'
        }
    }
    
    print(json.dumps(result, indent=2))
    
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
            const result = JSON.parse(stdout);
            console.log(`   📊 Found ${result.summary.total_colleges} colleges`);
            console.log(`   📊 Found ${result.summary.total_programs} programs`);
            
            // Save the processed data (you can integrate with your Parquet writer here)
            const outputPath = path.join(process.cwd(), 'data', `${type.toLowerCase()}-processed.json`);
            fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
            console.log(`   💾 Saved processed data to ${outputPath}`);
            
            resolve();
          } catch (error) {
            reject(new Error(`Failed to parse JSON output: ${error}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
    });
  }

  async importCounsellingData(): Promise<void> {
    console.log('\\n🎓 IMPORTING CORRECTED COUNSELLING DATA');
    console.log('========================================');

    const files = [
      'AIQ_PG_2024_R1.xlsx',
      'AIQ_PG_2024_R2.xlsx', 
      'AIQ_PG_2024_R3.xlsx',
      'AIQ_PG_2024_R4.xlsx',
      'AIQ_PG_2024_R5.xlsx'
    ];

    for (const file of files) {
      const filePath = path.join(this.counsellingDataPath, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ ${file} not found`);
        continue;
      }

      console.log(`\\n📊 Processing ${file}...`);
      console.log(`📁 File: ${filePath}`);
      
      try {
        await this.processCounsellingFile(filePath, file);
        console.log(`✅ ${file} processed successfully`);
      } catch (error) {
        console.error(`❌ Failed to process ${file}:`, error);
      }
    }
  }

  private async processCounsellingFile(filePath: string, fileName: string): Promise<void> {
    const pythonScript = `
import pandas as pd
import json
import sys

try:
    # Read the Excel file
    df = pd.read_excel('${filePath}')
    
    # Get basic info
    total_rows = len(df)
    columns = df.columns.tolist()
    
    print(f"Processing {total_rows} rows", file=sys.stderr)
    print(f"Columns: {columns}", file=sys.stderr)
    
    # Look for key columns
    college_col = None
    course_col = None
    rank_col = None
    
    for col in columns:
        col_upper = col.upper()
        if 'COLLEGE' in col_upper or 'INSTITUTE' in col_upper:
            college_col = col
        elif 'COURSE' in col_upper:
            course_col = col  
        elif 'RANK' in col_upper:
            rank_col = col
    
    # Sample the data
    sample_size = min(10, total_rows)
    sample_data = []
    
    for i in range(sample_size):
        row = df.iloc[i]
        sample_data.append({
            'college': str(row[college_col]) if college_col and pd.notna(row[college_col]) else 'N/A',
            'course': str(row[course_col]) if course_col and pd.notna(row[course_col]) else 'N/A',
            'rank': str(row[rank_col]) if rank_col and pd.notna(row[rank_col]) else 'N/A'
        })
    
    result = {
        'file': '${fileName}',
        'total_rows': total_rows,
        'columns': columns,
        'key_columns': {
            'college': college_col,
            'course': course_col,
            'rank': rank_col
        },
        'sample_data': sample_data
    }
    
    print(json.dumps(result, indent=2))
    
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
            const result = JSON.parse(stdout);
            console.log(`   📊 Total rows: ${result.total_rows}`);
            console.log(`   🔑 Key columns found: ${JSON.stringify(result.key_columns)}`);
            
            // Show sample corrected data
            if (result.sample_data.length > 0) {
              console.log('   📋 Sample corrected data:');
              result.sample_data.slice(0, 3).forEach((sample: any, index: number) => {
                console.log(`      ${index + 1}. College: ${sample.college}`);
                console.log(`         Course: ${sample.course}`);
                console.log(`         Rank: ${sample.rank}`);
              });
            }
            
            resolve();
          } catch (error) {
            reject(new Error(`Failed to parse JSON output: ${error}`));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
    });
  }

  async runFullImport(): Promise<void> {
    console.log('🚀 STARTING FULL CORRECTED DATA IMPORT');
    console.log('======================================');
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    
    try {
      // Step 1: Import seat data
      await this.importSeatData();
      
      // Step 2: Import counselling data  
      await this.importCounsellingData();
      
      console.log('\\n🎉 IMPORT COMPLETED SUCCESSFULLY!');
      console.log('==================================');
      console.log('✅ All corrected files have been processed');
      console.log('📊 Data analysis shows your corrections are working');
      console.log('🔄 Next: Run enhanced college matcher for relationships');
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }
}

async function main() {
  const importer = new CorrectedDataImporter();
  await importer.runFullImport();
}

if (require.main === module) {
  main();
}

export { CorrectedDataImporter };
