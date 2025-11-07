import AIQImporterEnhanced from '../src/lib/data/aiq-importer-enhanced';
import { ProgressCallback } from '../src/lib/data/staging-manager';

async function main() {
  console.log('🚀 Enhanced AIQ PG 2023 Data Import Script');
  console.log('==========================================');

  try {
    // Initialize enhanced AIQ importer for 2023 data
    const aiqDataPath = '/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2023/';
    const importer = new AIQImporterEnhanced(aiqDataPath);

    // Set up progress monitoring
    const progressCallback: ProgressCallback = (step, progress, message) => {
      const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
      console.log(`\r${step.toUpperCase()}: [${progressBar}] ${progress.toFixed(1)}% ${message || ''}`);
    };
    
    importer.setProgressCallback(progressCallback);

    // Test data access first
    console.log('\n🧪 Step 1: Testing enhanced AIQ data access...');
    const accessTest = await importer.testAIQDataAccess();
    if (!accessTest) {
      console.error('❌ Enhanced AIQ data access test failed. Please check the file path and permissions.');
      process.exit(1);
    }
    console.log('✅ Enhanced AIQ data access test passed');

    // Import data with complete staging workflow
    console.log('\n📊 Step 2: Running enhanced AIQ data import...');
    const result = await importer.importAIQData();

    // Display comprehensive results
    console.log('\n📈 Enhanced Import Results Summary:');
    console.log('====================================');
    console.log(`📊 Total Records: ${result.totalRecords.toLocaleString()}`);
    console.log(`📊 Processed Cutoffs: ${result.processedCutoffs.toLocaleString()}`);
    console.log(`🏫 Matched Colleges: ${result.matchedColleges.toLocaleString()}`);
    console.log(`📚 Matched Courses: ${result.matchedCourses.toLocaleString()}`);
    console.log(`❌ Unmatched Colleges: ${result.unmatchedColleges.toLocaleString()}`);
    console.log(`❌ Unmatched Courses: ${result.unmatchedCourses.toLocaleString()}`);
    console.log(`📁 Source Files: ${result.sourceFiles.length}`);
    
    console.log('\n📊 Records by Round:');
    Object.entries(result.recordsByRound)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([round, count]) => {
        console.log(`   Round ${round}: ${count.toLocaleString()} records`);
      });

    console.log('\n📊 Records by Quota:');
    Object.entries(result.recordsByQuota)
      .sort(([,a], [,b]) => b - a)
      .forEach(([quota, count]) => {
        console.log(`   ${quota}: ${count.toLocaleString()} records`);
      });

    console.log('\n📊 Records by Category:');
    Object.entries(result.recordsByCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count.toLocaleString()} records`);
      });

    console.log('\n🔍 Data Quality Metrics:');
    console.log(`   Valid Records: ${result.dataQuality.validRecords.toLocaleString()}`);
    console.log(`   Invalid Records: ${result.dataQuality.invalidRecords.toLocaleString()}`);
    console.log(`   Rank Validation Errors: ${result.dataQuality.rankValidationErrors}`);
    console.log(`   Completeness Errors: ${result.dataQuality.completenessErrors}`);
    console.log(`   Business Logic Errors: ${result.dataQuality.businessLogicErrors}`);
    
    if (result.dataQuality.validationErrors.length > 0) {
      console.log('\n⚠️ Validation Errors:');
      result.dataQuality.validationErrors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }

    console.log('\n⚡ Performance Metrics:');
    console.log(`   Import Time: ${result.performance.importTime}ms`);
    console.log(`   Processing Time: ${result.performance.processingTime}ms`);
    console.log(`   Matching Time: ${result.performance.matchingTime}ms`);
    console.log(`   Total Time: ${result.performance.totalTime}ms`);
    console.log(`   Memory Usage: ${result.performance.memoryUsage.toFixed(2)}MB`);

    console.log('\n🎯 Matching Summary:');
    const totalColleges = result.matchedColleges + result.unmatchedColleges;
    const totalCourses = result.matchedCourses + result.unmatchedCourses;
    const collegeMatchRate = totalColleges > 0 ? (result.matchedColleges / totalColleges * 100).toFixed(1) : '0';
    const courseMatchRate = totalCourses > 0 ? (result.matchedCourses / totalCourses * 100).toFixed(1) : '0';
    
    console.log(`   College Match Rate: ${collegeMatchRate}% (${result.matchedColleges}/${totalColleges})`);
    console.log(`   Course Match Rate: ${courseMatchRate}% (${result.matchedCourses}/${totalCourses})`);

    console.log('\n🎉 Enhanced AIQ PG 2023 data import completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('   1. Review unmatched colleges/courses for manual matching');
    console.log('   2. Verify data quality metrics');
    console.log('   3. Integrate with unified database');
    console.log('   4. Update cutoffs API with real data');
    console.log('   5. Clear staging database for next dataset');

  } catch (error: any) {
    console.error('❌ Enhanced AIQ data import failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
