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
  console.log('🦷 Importing Dental Colleges Dataset');
  console.log('====================================');

  try {
    // Read and parse the dental colleges Excel file using Python
    const { execSync } = require('child_process');
    
    const pythonScript = `
import pandas as pd
import json

# Read the dental colleges Excel file
df = pd.read_excel('/Users/kashyapanand/Desktop/EXPORT/FOUNDATION/dental ad.xlsx')

# Convert to JSON
result = []
college_id = 1

for _, row in df.iterrows():
    college_data = {
        'id': college_id,
        'name': str(row['COLLEGE/INSTITUTE']).strip(),
        'state': str(row['STATE']).strip(),
        'city': str(row['ADDRESS']).strip() if pd.notna(row['ADDRESS']) else 'Unknown',
        'college_type': 'Dental',
        'management_type': 'Unknown',
        'status': 'active',
        'created_at': '2025-09-19T09:20:06.796Z',
        'updated_at': '2025-09-19T09:20:06.796Z'
    }
    result.append(college_data)
    college_id += 1

print(json.dumps(result, indent=2))
`;

    console.log('📊 Parsing dental colleges Excel file...');
    const result = execSync(`python3 -c "${pythonScript}"`, { encoding: 'utf8' });
    const dentalColleges: CollegeData[] = JSON.parse(result);

    console.log(`✅ Parsed ${dentalColleges.length} dental colleges from ${new Set(dentalColleges.map(c => c.state)).size} states`);

    // Read existing medical colleges
    console.log('📖 Reading existing medical colleges...');
    const medicalCollegesPath = path.join(process.cwd(), 'data', 'parquet', 'colleges.parquet');
    const reader = await parquet.ParquetReader.openFile(medicalCollegesPath);
    const medicalColleges: CollegeData[] = [];
    
    const cursor = reader.getCursor();
    let row;
    while ((row = await cursor.next()) !== null) {
      medicalColleges.push(row as unknown as CollegeData);
    }
    await reader.close();

    console.log(`📚 Found ${medicalColleges.length} existing medical colleges`);

    // Combine medical and dental colleges
    const allColleges = [...medicalColleges, ...dentalColleges];
    
    // Update IDs to be sequential
    allColleges.forEach((college, index) => {
      college.id = index + 1;
    });

    console.log(`🔄 Combined dataset: ${allColleges.length} total colleges (${medicalColleges.length} medical + ${dentalColleges.length} dental)`);

    // Create updated colleges Parquet file
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

    console.log('📝 Creating updated colleges.parquet with medical + dental colleges...');
    const writer = await parquet.ParquetWriter.openFile(schema, collegesPath);
    
    for (const college of allColleges) {
      await writer.appendRow({
        ...college,
        code: college.name.substring(0, 10).replace(/\s+/g, '').toUpperCase(), // Generate code from name
        district: 'Unknown',
        address: college.city !== 'Unknown' ? college.city : 'Unknown',
        pincode: 'Unknown',
        establishment_year: 0,
        university: 'Unknown',
        website: 'Unknown',
        email: 'Unknown',
        phone: 'Unknown',
        accreditation: 'Unknown',
        college_type_category: college.college_type
      });
    }
    
    await writer.close();
    
    console.log(`✅ Successfully created colleges.parquet with ${allColleges.length} total colleges`);
    
    // Show statistics by college type
    console.log('\n📈 Colleges by Type:');
    const typeStats = allColleges.reduce((acc, college) => {
      acc[college.college_type] = (acc[college.college_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} colleges`);
    });

    // Show statistics by state (top 10)
    console.log('\n📈 Colleges by State (Top 10):');
    const stateStats = allColleges.reduce((acc, college) => {
      acc[college.state] = (acc[college.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(stateStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([state, count]) => {
        console.log(`  ${state}: ${count} colleges`);
      });

    // Show data quality metrics
    const collegesWithAddress = allColleges.filter(c => c.city !== 'Unknown').length;
    console.log(`\n📊 Data Quality:`);
    console.log(`  Total colleges: ${allColleges.length}`);
    console.log(`  Medical colleges: ${medicalColleges.length}`);
    console.log(`  Dental colleges: ${dentalColleges.length}`);
    console.log(`  Colleges with address: ${collegesWithAddress}`);
    console.log(`  Colleges without address: ${allColleges.length - collegesWithAddress}`);
    console.log(`  States covered: ${Object.keys(stateStats).length}`);

  } catch (error: any) {
    console.error('❌ Import failed:', error);
  }
}

main();
