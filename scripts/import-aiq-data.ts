import AIQImporter from '../src/lib/data/aiq-importer';
import StagingDatabase from '../src/lib/data/staging-database';

async function main() {
  console.log('🚀 AIQ PG 2024 Data Import Script');
  console.log('==================================');

  try {
    // Initialize AIQ importer
    const aiqDataPath = '/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2024/';
    const importer = new AIQImporter(aiqDataPath);

    // Test data access first
    console.log('\n🧪 Step 1: Testing AIQ data access...');
    const accessTest = await importer.testAIQDataAccess();
    if (!accessTest) {
      console.error('❌ AIQ data access test failed. Please check the file path and permissions.');
      process.exit(1);
    }
    console.log('✅ AIQ data access test passed');

    // Import data
    console.log('\n📊 Step 2: Importing AIQ data...');
    const result = await importer.importAIQData();

    // Display results
    console.log('\n📈 Import Results Summary:');
    console.log('==========================');
    console.log(`📊 Total Records: ${result.totalRecords.toLocaleString()}`);
    console.log(`📊 Processed Cutoffs: ${result.processedCutoffs.toLocaleString()}`);
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

    console.log('\n🏫 Unique Colleges:');
    console.log(`   Total: ${result.unmatchedColleges.length.toLocaleString()}`);
    console.log('   Sample colleges:');
    result.unmatchedColleges.slice(0, 5).forEach(college => {
      console.log(`     - ${college}`);
    });

    console.log('\n📚 Unique Courses:');
    console.log(`   Total: ${result.unmatchedCourses.length.toLocaleString()}`);
    console.log('   Sample courses:');
    result.unmatchedCourses.slice(0, 5).forEach(course => {
      console.log(`     - ${course}`);
    });

    // Get staging database summary
    console.log('\n🗄️ Step 3: Staging Database Summary...');
    const stagingDb = new StagingDatabase();
    const stagingSummary = await stagingDb.getStagingSummary();
    
    if (stagingSummary) {
      console.log('✅ Staging database summary:');
      console.log(`   Total Records: ${stagingSummary.totalRecords.toLocaleString()}`);
      console.log(`   Total Cutoffs: ${stagingSummary.totalCutoffs.toLocaleString()}`);
      console.log(`   Year: ${stagingSummary.year}`);
      console.log(`   Source Files: ${stagingSummary.sourceFiles.join(', ')}`);
    }

    console.log('\n🎉 AIQ PG 2024 data import completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('   1. Review the imported data in data/staging/');
    console.log('   2. Create college/course matching logic');
    console.log('   3. Integrate with unified database');
    console.log('   4. Update cutoffs API with real data');

  } catch (error: any) {
    console.error('❌ AIQ data import failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
