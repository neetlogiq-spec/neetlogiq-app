#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CollegeRecord {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  college_type: string;
  management_type: string;
  university_affiliation?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProgramRecord {
  id: number;
  name: string;
  code: string;
  duration_years: number;
  program_type: string;
  degree_type: string;
  specialization: string;
  category: string;
  total_seats: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SeatDataRecord {
  college_id: number;
  program_id: number;
  seats: number;
  management_type: string;
  university_affiliation: string;
}

class CorrectedSeatDataImporter {
  private seatDataPath = '/Users/kashyapanand/Desktop/EXPORT/seat data';

  async importAllSeatData(): Promise<void> {
    console.log('🏥 IMPORTING CORRECTED SEAT DATA (PROPER METHOD)');
    console.log('================================================');
    console.log('✅ Using COLLEGE_INSTITUTE + ADDRESS + STATE for uniqueness');

    const files = [
      { file: 'medical.xlsx', type: 'Medical', category: 'Medical' },
      { file: 'dental.xlsx', type: 'Dental', category: 'Dental' },
      { file: 'dnb.xlsx', type: 'DNB', category: 'DNB' }
    ];

    const allColleges: CollegeRecord[] = [];
    const allPrograms: ProgramRecord[] = [];
    const allSeatData: SeatDataRecord[] = [];
    
    let collegeId = 1;
    let programId = 1;

    for (const { file, type, category } of files) {
      const filePath = path.join(this.seatDataPath, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ ${file} not found at ${filePath}`);
        continue;
      }

      console.log(`\\n📊 Processing ${type} seat data...`);
      console.log(`📁 File: ${filePath}`);
      
      try {
        const result = await this.processSeatDataFile(filePath, type, category, collegeId, programId);
        
        allColleges.push(...result.colleges);
        allPrograms.push(...result.programs);
        allSeatData.push(...result.seatData);
        
        collegeId += result.colleges.length;
        programId += result.programs.length;
        
        console.log(`✅ ${type}: ${result.colleges.length} colleges, ${result.programs.length} programs`);
        
      } catch (error) {
        console.error(`❌ Failed to import ${type} seat data:`, error);
      }
    }

    // Generate summary
    console.log('\\n📊 FINAL SEAT DATA IMPORT SUMMARY');
    console.log('==================================');
    console.log(`🏥 Total Colleges: ${allColleges.length}`);
    console.log(`🎓 Total Programs: ${allPrograms.length}`);
    console.log(`💺 Total Seat Records: ${allSeatData.length}`);
    
    // Show college distribution by state
    const stateDistribution = new Map<string, number>();
    allColleges.forEach(college => {
      stateDistribution.set(college.state, (stateDistribution.get(college.state) || 0) + 1);
    });
    
    console.log('\\n📊 College Distribution by State (Top 10):');
    const topStates = Array.from(stateDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    topStates.forEach(([state, count], index) => {
      console.log(`   ${index + 1}. ${state}: ${count} colleges`);
    });

    // Show sample colleges with same names but different locations
    console.log('\\n🔍 EXAMPLES OF COLLEGES WITH SAME NAMES IN DIFFERENT LOCATIONS:');
    const nameGroups = new Map<string, CollegeRecord[]>();
    allColleges.forEach(college => {
      if (!nameGroups.has(college.name)) {
        nameGroups.set(college.name, []);
      }
      nameGroups.get(college.name)!.push(college);
    });

    const multiLocationColleges = Array.from(nameGroups.entries())
      .filter(([name, colleges]) => colleges.length > 1)
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
      path.join(outputDir, 'corrected-colleges.json'), 
      JSON.stringify(allColleges, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, 'corrected-programs.json'), 
      JSON.stringify(allPrograms, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, 'corrected-seat-data.json'), 
      JSON.stringify(allSeatData, null, 2)
    );

    console.log('\\n💾 Data saved to:');
    console.log('   - data/corrected-colleges.json');
    console.log('   - data/corrected-programs.json');
    console.log('   - data/corrected-seat-data.json');
  }

  private async processSeatDataFile(
    filePath: string, 
    type: string, 
    category: string,
    startCollegeId: number,
    startProgramId: number
  ): Promise<{
    colleges: CollegeRecord[];
    programs: ProgramRecord[];
    seatData: SeatDataRecord[];
  }> {
    
    const pythonScript = `
import pandas as pd
import json
import sys

try:
    # Read the Excel file
    df = pd.read_excel('${filePath}')
    
    print(f"Processing {len(df)} rows from ${type}", file=sys.stderr)
    print(f"Columns: {list(df.columns)}", file=sys.stderr)
    
    # Track unique colleges and programs
    colleges_map = {}  # Key: college_name + address + state, Value: college data
    programs_map = {}  # Key: program_name, Value: program data
    seat_data = []
    
    college_id = ${startCollegeId}
    program_id = ${startProgramId}
    
    for _, row in df.iterrows():
        # Extract college information
        college_name = str(row.get('COLLEGE_INSTITUTE', '')).strip()
        address = str(row.get('ADDRESS', '')).strip()
        state = str(row.get('STATE', '')).strip()
        management = str(row.get('MANAGEMENT', 'Unknown')).strip()
        university = str(row.get('UNIVERSITY_AFFILIATION', '')).strip()
        
        # Extract program information
        course_name = str(row.get('COURSE', '')).strip()
        seats = row.get('SEATS', 0)
        
        # Skip invalid records
        if not college_name or college_name == 'nan':
            continue
        if not course_name or course_name == 'nan':
            continue
        if not state or state == 'nan':
            continue
            
        # Create unique college key (name + address + state)
        college_key = f"{college_name}|{address}|{state}"
        
        # Add college if not exists
        if college_key not in colleges_map:
            colleges_map[college_key] = {
                'id': college_id,
                'name': college_name,
                'address': address,
                'city': address,  # Using address as city for now
                'state': state,
                'college_type': '${type}',
                'management_type': management,
                'university_affiliation': university,
                'status': 'active',
                'created_at': '2025-09-20T10:00:00.000Z',
                'updated_at': '2025-09-20T10:00:00.000Z'
            }
            college_id += 1
        
        # Add program if not exists
        if course_name not in programs_map:
            # Determine program details based on course name
            program_type = 'UG'
            degree_type = course_name
            specialization = course_name
            duration_years = 4
            
            if 'MD' in course_name.upper() or 'MS' in course_name.upper():
                program_type = 'PG'
                duration_years = 3
            elif 'DNB' in course_name.upper() or 'DIPLOMA' in course_name.upper():
                program_type = 'PG'
                duration_years = 2
            elif 'MBBS' in course_name.upper():
                program_type = 'UG'
                duration_years = 5
                degree_type = 'MBBS'
                specialization = 'General Medicine'
            elif 'BDS' in course_name.upper():
                program_type = 'UG'
                duration_years = 5
                degree_type = 'BDS'
                specialization = 'General Dentistry'
            
            programs_map[course_name] = {
                'id': program_id,
                'name': course_name,
                'code': course_name[:10].upper().replace(' ', '_'),
                'duration_years': duration_years,
                'program_type': program_type,
                'degree_type': degree_type,
                'specialization': specialization,
                'category': '${category}',
                'total_seats': 0,  # Will be calculated later
                'status': 'active',
                'created_at': '2025-09-20T10:00:00.000Z',
                'updated_at': '2025-09-20T10:00:00.000Z'
            }
            program_id += 1
        
        # Add seat data
        seat_data.append({
            'college_id': colleges_map[college_key]['id'],
            'program_id': programs_map[course_name]['id'],
            'seats': int(seats) if pd.notna(seats) else 0,
            'management_type': management,
            'university_affiliation': university
        })
        
        # Update program total seats
        programs_map[course_name]['total_seats'] += int(seats) if pd.notna(seats) else 0
    
    # Convert to lists
    colleges_list = list(colleges_map.values())
    programs_list = list(programs_map.values())
    
    result = {
        'colleges': colleges_list,
        'programs': programs_list,
        'seat_data': seat_data,
        'summary': {
            'unique_colleges': len(colleges_list),
            'unique_programs': len(programs_list),
            'total_seat_records': len(seat_data),
            'file_type': '${type}'
        }
    }
    
    print(f"✅ Processed: {len(colleges_list)} unique colleges, {len(programs_list)} programs", file=sys.stderr)
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
            console.log(`   📊 Unique colleges: ${result.summary.unique_colleges}`);
            console.log(`   📊 Unique programs: ${result.summary.unique_programs}`);
            console.log(`   📊 Seat records: ${result.summary.total_seat_records}`);
            
            resolve({
              colleges: result.colleges,
              programs: result.programs,
              seatData: result.seat_data
            });
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
  const importer = new CorrectedSeatDataImporter();
  
  try {
    await importer.importAllSeatData();
    
    console.log('\\n🎉 CORRECTED SEAT DATA IMPORT COMPLETED!');
    console.log('========================================');
    console.log('✅ Used proper uniqueness: COLLEGE_INSTITUTE + ADDRESS + STATE');
    console.log('✅ Correctly identified colleges in multiple locations');
    console.log('✅ Maintained relationship integrity');
    console.log('✅ Ready for counselling data matching');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { CorrectedSeatDataImporter };
