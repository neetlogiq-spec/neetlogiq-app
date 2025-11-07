import TypesenseManager from '../src/lib/data/typesense-manager';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🔍 Typesense Setup Script');
  console.log('=========================');

  try {
    // Initialize Typesense manager
    const typesenseManager = new TypesenseManager();
    await typesenseManager.initialize();

    // Check Typesense status
    console.log('\n📊 Step 1: Checking Typesense status...');
    const status = await typesenseManager.getStatus();
    
    if (!status.available) {
      console.error('❌ Typesense is not available:', status.message);
      process.exit(1);
    }
    
    console.log('✅ Typesense is running and available');
    console.log(`   Health: ${status.health.ok ? 'OK' : 'NOT OK'}`);
    console.log(`   Collections: ${status.collections.length}`);

    // Index unified colleges
    console.log('\n📊 Step 2: Indexing unified colleges...');
    await typesenseManager.indexUnifiedColleges();

    // Index unified courses
    console.log('\n📊 Step 3: Indexing unified courses...');
    await typesenseManager.indexUnifiedCourses();

    // Test search functionality
    console.log('\n📊 Step 4: Testing search functionality...');
    
    // Test college search
    const collegeResults = await typesenseManager.searchColleges('AIIMS', 3);
    console.log(`✅ College search test: Found ${collegeResults.length} results for "AIIMS"`);
    if (collegeResults.length > 0) {
      console.log(`   Top result: ${collegeResults[0].document.name} (${(collegeResults[0].score * 100).toFixed(1)}%)`);
    }

    // Test course search
    const courseResults = await typesenseManager.searchCourses('MD', 3);
    console.log(`✅ Course search test: Found ${courseResults.length} results for "MD"`);
    if (courseResults.length > 0) {
      console.log(`   Top result: ${courseResults[0].document.name} (${(courseResults[0].score * 100).toFixed(1)}%)`);
    }

    // Get final status
    console.log('\n📊 Step 5: Final Typesense status...');
    const finalStatus = await typesenseManager.getStatus();
    
    console.log('✅ Typesense setup completed successfully!');
    console.log('\n📈 Final Status:');
    console.log(`   Health: ${finalStatus.health.ok ? 'OK' : 'NOT OK'}`);
    console.log(`   Collections: ${finalStatus.collections.length}`);
    
    finalStatus.collections.forEach((collection: any) => {
      console.log(`   - ${collection.name}: ${collection.documentCount} documents`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('   1. Typesense is now ready for enhanced search');
    console.log('   2. Re-run the manual review generation to use Typesense');
    console.log('   3. Use the enhanced search capabilities in the staging manager');

  } catch (error: any) {
    console.error('❌ Typesense setup failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
