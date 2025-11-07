import SeatDataImporter from '../src/lib/data/seat-data-importer';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Creating Unified Database...');
  const importer = new SeatDataImporter();

  try {
    // Import all seat data
    console.log('📊 Importing seat data with DNB aggregation...');
    const result = await importer.importSeatDataWithAggregation();

    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save unified colleges
    const collegesPath = path.join(dataDir, 'unified_colleges.json');
    fs.writeFileSync(collegesPath, JSON.stringify(result.colleges, null, 2));
    console.log(`✅ Created ${collegesPath} with ${result.colleges.length} colleges`);

    // Save unified courses
    const coursesPath = path.join(dataDir, 'unified_courses.json');
    fs.writeFileSync(coursesPath, JSON.stringify(result.courses, null, 2));
    console.log(`✅ Created ${coursesPath} with ${result.courses.length} courses`);

    // Save unified seat data
    const seatDataPath = path.join(dataDir, 'unified_seat_data.json');
    fs.writeFileSync(seatDataPath, JSON.stringify(result.seatData, null, 2));
    console.log(`✅ Created ${seatDataPath} with ${result.seatData.length} seat records`);

    // Save DNB aggregations
    const dnbAggregationsPath = path.join(dataDir, 'dnb_aggregations.json');
    fs.writeFileSync(dnbAggregationsPath, JSON.stringify(result.dnbAggregations, null, 2));
    console.log(`✅ Created ${dnbAggregationsPath} with ${result.dnbAggregations.length} DNB aggregations`);

    // Create metadata summary
    const metadata = {
      createdAt: new Date().toISOString(),
      totalColleges: result.colleges.length,
      totalCourses: result.courses.length,
      totalSeatRecords: result.seatData.length,
      totalDnbAggregations: result.dnbAggregations.length,
      summary: {
        medical: {
          colleges: result.colleges.filter(c => c.type === 'MEDICAL').length,
          courses: result.courses.filter(c => c.type === 'MEDICAL').length,
          seatRecords: result.seatData.filter(s => s.sourceFile.includes('medical')).length
        },
        dental: {
          colleges: result.colleges.filter(c => c.type === 'DENTAL').length,
          courses: result.courses.filter(c => c.type === 'DENTAL').length,
          seatRecords: result.seatData.filter(s => s.sourceFile.includes('dental')).length
        },
        dnb: {
          colleges: result.colleges.filter(c => c.type === 'DNB').length,
          courses: result.courses.filter(c => c.type === 'DNB').length,
          seatRecords: result.seatData.filter(s => s.sourceFile.includes('dnb')).length,
          aggregations: result.dnbAggregations.length
        }
      }
    };

    const metadataPath = path.join(dataDir, 'unified_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Created ${metadataPath} with metadata summary`);

    console.log('\n🎉 Unified Database Created Successfully!');
    console.log('==========================================');
    console.log(`📊 Total Colleges: ${result.colleges.length}`);
    console.log(`📊 Total Courses: ${result.courses.length}`);
    console.log(`📊 Total Seat Records: ${result.seatData.length}`);
    console.log(`📊 Total DNB Aggregations: ${result.dnbAggregations.length}`);
    
    console.log('\n📁 Files Created:');
    console.log('================');
    console.log(`   ${collegesPath}`);
    console.log(`   ${coursesPath}`);
    console.log(`   ${seatDataPath}`);
    console.log(`   ${dnbAggregationsPath}`);
    console.log(`   ${metadataPath}`);

    console.log('\n🎯 Next Steps:');
    console.log('==============');
    console.log('   1. Review the generated JSON files');
    console.log('   2. Create API endpoints to serve the unified data');
    console.log('   3. Link with foundation data for complete college registry');
    console.log('   4. Create frontend components to display the data');

  } catch (error: any) {
    console.error('❌ Failed to create unified database:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
