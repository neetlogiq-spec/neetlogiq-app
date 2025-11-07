import fs from 'fs';
import path from 'path';
import * as parquet from 'parquetjs';

async function performanceTest() {
  console.log('🧪 Performance Comparison: JSON vs Parquet');
  console.log('==========================================');

  const dataDir = path.join(process.cwd(), 'data');
  const parquetDir = path.join(dataDir, 'parquet');

  try {
    // Test 1: File Size Comparison
    console.log('\n📊 File Size Comparison:');
    console.log('========================');
    
    const jsonFiles = ['unified_colleges.json', 'unified_courses.json', 'unified_seat_data.json', 'dnb_aggregations.json'];
    const parquetFiles = ['colleges.parquet', 'courses.parquet', 'seat_data.parquet', 'dnb_aggregations.parquet'];
    
    let jsonTotalSize = 0;
    let parquetTotalSize = 0;
    
    jsonFiles.forEach((jsonFile, index) => {
      const jsonPath = path.join(dataDir, jsonFile);
      const parquetPath = path.join(parquetDir, parquetFiles[index]);
      
      if (fs.existsSync(jsonPath) && fs.existsSync(parquetPath)) {
        const jsonSize = fs.statSync(jsonPath).size;
        const parquetSize = fs.statSync(parquetPath).size;
        
        jsonTotalSize += jsonSize;
        parquetTotalSize += parquetSize;
        
        const compressionRatio = ((jsonSize - parquetSize) / jsonSize * 100).toFixed(1);
        console.log(`${jsonFile}: ${(jsonSize / 1024).toFixed(1)} KB → ${(parquetSize / 1024).toFixed(1)} KB (${compressionRatio}% smaller)`);
      }
    });
    
    const totalCompressionRatio = ((jsonTotalSize - parquetTotalSize) / jsonTotalSize * 100).toFixed(1);
    console.log(`\nTotal: ${(jsonTotalSize / 1024).toFixed(1)} KB → ${(parquetTotalSize / 1024).toFixed(1)} KB (${totalCompressionRatio}% smaller)`);

    // Test 2: Read Performance Comparison
    console.log('\n⚡ Read Performance Comparison:');
    console.log('=================================');
    
    // Test JSON read
    console.log('Testing JSON read performance...');
    const jsonStartTime = Date.now();
    const colleges = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_colleges.json'), 'utf8'));
    const courses = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_courses.json'), 'utf8'));
    const seatData = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_seat_data.json'), 'utf8'));
    const jsonEndTime = Date.now();
    const jsonReadTime = jsonEndTime - jsonStartTime;
    
    console.log(`JSON read time: ${jsonReadTime}ms`);
    console.log(`JSON data loaded: ${colleges.length} colleges, ${courses.length} courses, ${seatData.length} seat records`);

    // Test Parquet read
    console.log('\nTesting Parquet read performance...');
    const parquetStartTime = Date.now();
    
    const collegeReader = await parquet.ParquetReader.openFile(path.join(parquetDir, 'colleges.parquet'));
    const collegeCursor = collegeReader.getCursor();
    const parquetColleges: any[] = [];
    let record: any;
    while (record = await collegeCursor.next()) {
      parquetColleges.push(record);
    }
    await collegeReader.close();
    
    const courseReader = await parquet.ParquetReader.openFile(path.join(parquetDir, 'courses.parquet'));
    const courseCursor = courseReader.getCursor();
    const parquetCourses: any[] = [];
    while (record = await courseCursor.next()) {
      parquetCourses.push(record);
    }
    await courseReader.close();
    
    const seatDataReader = await parquet.ParquetReader.openFile(path.join(parquetDir, 'seat_data.parquet'));
    const seatDataCursor = seatDataReader.getCursor();
    const parquetSeatData: any[] = [];
    while (record = await seatDataCursor.next()) {
      parquetSeatData.push(record);
    }
    await seatDataReader.close();
    
    const parquetEndTime = Date.now();
    const parquetReadTime = parquetEndTime - parquetStartTime;
    
    console.log(`Parquet read time: ${parquetReadTime}ms`);
    console.log(`Parquet data loaded: ${parquetColleges.length} colleges, ${parquetCourses.length} courses, ${parquetSeatData.length} seat records`);

    // Test 3: Query Performance Comparison
    console.log('\n🔍 Query Performance Comparison:');
    console.log('=================================');
    
    // Test JSON filtering
    console.log('Testing JSON filtering...');
    const jsonFilterStartTime = Date.now();
    const medicalCollegesJson = colleges.filter((c: any) => c.type === 'MEDICAL');
    const andhraCollegesJson = colleges.filter((c: any) => c.state === 'ANDHRA PRADESH');
    const governmentCollegesJson = colleges.filter((c: any) => c.management === 'GOVERNMENT');
    const jsonFilterEndTime = Date.now();
    const jsonFilterTime = jsonFilterEndTime - jsonFilterStartTime;
    
    console.log(`JSON filtering time: ${jsonFilterTime}ms`);
    console.log(`JSON results: ${medicalCollegesJson.length} medical, ${andhraCollegesJson.length} Andhra Pradesh, ${governmentCollegesJson.length} government colleges`);

    // Test Parquet filtering
    console.log('\nTesting Parquet filtering...');
    const parquetFilterStartTime = Date.now();
    
    // Read and filter medical colleges
    const medicalReader = await parquet.ParquetReader.openFile(path.join(parquetDir, 'colleges.parquet'));
    const medicalCursor = medicalReader.getCursor();
    const medicalCollegesParquet: any[] = [];
    while (record = await medicalCursor.next()) {
      if (record.type === 'MEDICAL') {
        medicalCollegesParquet.push(record);
      }
    }
    await medicalReader.close();
    
    // Read and filter Andhra Pradesh colleges
    const andhraReader = await parquet.ParquetReader.openFile(path.join(parquetDir, 'colleges.parquet'));
    const andhraCursor = andhraReader.getCursor();
    const andhraCollegesParquet: any[] = [];
    while (record = await andhraCursor.next()) {
      if (record.state === 'ANDHRA PRADESH') {
        andhraCollegesParquet.push(record);
      }
    }
    await andhraReader.close();
    
    // Read and filter government colleges
    const govtReader = await parquet.ParquetReader.openFile(path.join(parquetDir, 'colleges.parquet'));
    const govtCursor = govtReader.getCursor();
    const governmentCollegesParquet: any[] = [];
    while (record = await govtCursor.next()) {
      if (record.management === 'GOVERNMENT') {
        governmentCollegesParquet.push(record);
      }
    }
    await govtReader.close();
    
    const parquetFilterEndTime = Date.now();
    const parquetFilterTime = parquetFilterEndTime - parquetFilterStartTime;
    
    console.log(`Parquet filtering time: ${parquetFilterTime}ms`);
    console.log(`Parquet results: ${medicalCollegesParquet.length} medical, ${andhraCollegesParquet.length} Andhra Pradesh, ${governmentCollegesParquet.length} government colleges`);

    // Summary
    console.log('\n📈 Performance Summary:');
    console.log('=======================');
    console.log(`File Size Reduction: ${totalCompressionRatio}% smaller`);
    console.log(`Read Performance: JSON ${jsonReadTime}ms vs Parquet ${parquetReadTime}ms (${parquetReadTime > jsonReadTime ? 'JSON faster' : 'Parquet faster'})`);
    console.log(`Filter Performance: JSON ${jsonFilterTime}ms vs Parquet ${parquetFilterTime}ms (${parquetFilterTime > jsonFilterTime ? 'JSON faster' : 'Parquet faster'})`);
    
    const readImprovement = ((jsonReadTime - parquetReadTime) / jsonReadTime * 100).toFixed(1);
    const filterImprovement = ((jsonFilterTime - parquetFilterTime) / jsonFilterTime * 100).toFixed(1);
    
    console.log(`\n🎯 Key Benefits:`);
    console.log(`   • Storage: ${totalCompressionRatio}% space savings`);
    console.log(`   • Read Speed: ${readImprovement}% ${parquetReadTime < jsonReadTime ? 'improvement' : 'degradation'}`);
    console.log(`   • Filter Speed: ${filterImprovement}% ${parquetFilterTime < jsonFilterTime ? 'improvement' : 'degradation'}`);
    console.log(`   • Analytics: Columnar format enables faster aggregations`);
    console.log(`   • Scalability: Better performance with larger datasets`);

  } catch (error: any) {
    console.error('❌ Performance test failed:', error);
  }
}

performanceTest().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
});
