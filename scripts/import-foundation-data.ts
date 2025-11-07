#!/usr/bin/env tsx

import FoundationImporter from '../src/lib/data/foundation-importer';

async function main() {
  console.log('🚀 Starting Foundation Data Import Process...');
  
  try {
    const importer = new FoundationImporter();
    
    // Import all foundation data
    await importer.importAllFoundationData();
    
    // Get summary
    const summary = await importer.getFoundationDataSummary();
    
    console.log('\n📊 Foundation Data Import Summary:');
    console.log('=====================================');
    console.log(`States: ${summary.states}`);
    console.log(`Quotas: ${summary.quotas}`);
    console.log(`Categories: ${summary.categories}`);
    console.log(`Medical Colleges: ${summary.medicalColleges}`);
    console.log(`Dental Colleges: ${summary.dentalColleges}`);
    console.log(`DNB Colleges: ${summary.dnbColleges}`);
    console.log(`Total Colleges: ${summary.totalColleges}`);
    console.log('=====================================');
    
    console.log('\n✅ Foundation data import completed successfully!');
    console.log('🎯 Next steps:');
    console.log('   1. Import seat data and link to foundation colleges');
    console.log('   2. Import counselling data and link to foundation colleges');
    console.log('   3. Create unified API endpoints');
    
  } catch (error) {
    console.error('❌ Foundation data import failed:', error);
    process.exit(1);
  }
}

// Run the import
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
