import * as parquet from 'parquetjs';
import path from 'path';
import fs from 'fs';

interface CollegeData {
  id: number;
  name: string;
  code?: string;
  city: string;
  state: string;
  district?: string;
  address?: string;
  pincode?: string;
  college_type: string;
  management_type: string;
  establishment_year?: number;
  university?: string;
  website?: string;
  email?: string;
  phone?: string;
  accreditation?: string;
  status: string;
  college_type_category?: string;
  created_at: string;
  updated_at: string;
}

async function main() {
  console.log('🏥 Importing Medical Colleges from Excel');
  console.log('=======================================');

  try {
    // Read and parse the Excel file using Python
    const { execSync } = require('child_process');
    
    const pythonScript = `
import pandas as pd
import json

# Read the Excel file
df = pd.read_excel('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/med.xlsx')
all_values = df.iloc[:, 0].dropna().tolist()

# Parse the data
states_colleges = {}
current_state = None

state_keywords = ['PRADESH', 'BENGAL', 'KASHMIR', 'ISLANDS', 'CHANDIGARH', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'MADHYA', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUDUCHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL', 'TELANGANA', 'TRIPURA', 'UTTAR', 'UTTARAKHAND']

for value in all_values:
    value = str(value).strip()
    
    # Check if this is a state name
    is_state = any(keyword in value.upper() for keyword in state_keywords)
    
    if is_state and len(value.split()) <= 3:
        # This is a state name
        current_state = value
        states_colleges[current_state] = []
    elif current_state and value:
        # This is a college under the current state
        states_colleges[current_state].append(value)

# Convert to JSON
result = []
college_id = 1

for state, colleges in states_colleges.items():
    for college in colleges:
        result.append({
            'id': college_id,
            'name': college,
            'state': state,
            'college_type': 'Medical',
            'management_type': 'Unknown',
            'status': 'active',
            'created_at': '2025-09-19T09:20:06.796Z',
            'updated_at': '2025-09-19T09:20:06.796Z'
        })
        college_id += 1

print(json.dumps(result, indent=2))
`;

    console.log('📊 Parsing Excel file...');
    const result = execSync(`python3 -c "${pythonScript}"`, { encoding: 'utf8' });
    const colleges: CollegeData[] = JSON.parse(result);

    console.log(`✅ Parsed ${colleges.length} medical colleges from ${Object.keys(colleges.reduce((acc, c) => { acc[c.state] = true; return acc; }, {} as any)).length} states`);

    // Create colleges Parquet file
    const collegesPath = path.join(process.cwd(), 'data', 'parquet', 'colleges.parquet');
    
    const schema = new parquet.ParquetSchema({
      id: { type: 'INT64' },
      name: { type: 'UTF8' },
      code: { type: 'UTF8', optional: true },
      city: { type: 'UTF8' },
      state: { type: 'UTF8' },
      district: { type: 'UTF8', optional: true },
      address: { type: 'UTF8', optional: true },
      pincode: { type: 'UTF8', optional: true },
      college_type: { type: 'UTF8' },
      management_type: { type: 'UTF8' },
      establishment_year: { type: 'INT64', optional: true },
      university: { type: 'UTF8', optional: true },
      website: { type: 'UTF8', optional: true },
      email: { type: 'UTF8', optional: true },
      phone: { type: 'UTF8', optional: true },
      accreditation: { type: 'UTF8', optional: true },
      status: { type: 'UTF8' },
      college_type_category: { type: 'UTF8', optional: true },
      created_at: { type: 'UTF8' },
      updated_at: { type: 'UTF8' }
    });

    console.log('📝 Creating colleges.parquet...');
    const writer = await parquet.ParquetWriter.openFile(schema, collegesPath);
    
    for (const college of colleges) {
      await writer.appendRow({
        ...college,
        city: 'Unknown', // We'll need to extract this from college names later
        district: 'Unknown',
        address: 'Unknown',
        pincode: 'Unknown',
        establishment_year: 0,
        university: 'Unknown',
        website: 'Unknown',
        email: 'Unknown',
        phone: 'Unknown',
        accreditation: 'Unknown',
        college_type_category: 'Medical'
      });
    }
    
    await writer.close();
    
    console.log(`✅ Successfully created colleges.parquet with ${colleges.length} medical colleges`);
    
    // Show statistics by state
    console.log('\n📈 Colleges by State:');
    const stateStats = colleges.reduce((acc, college) => {
      acc[college.state] = (acc[college.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(stateStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([state, count]) => {
        console.log(`  ${state}: ${count} colleges`);
      });

  } catch (error: any) {
    console.error('❌ Import failed:', error);
  }
}

main();

