import ParquetImporter from '../src/lib/data/parquet-importer';

async function main() {
  console.log('🚀 Converting Unified Database to Parquet Format...');
  console.log('==================================================');

  const importer = new ParquetImporter();

  try {
    // Convert to Parquet
    await importer.convertToParquet();

    // Test performance
    console.log('\n🧪 Testing Parquet Performance...');
    console.log('=================================');
    await importer.testPerformance();

    // Get summary
    console.log('\n📊 Parquet Database Summary...');
    console.log('==============================');
    const summary = await importer.getParquetSummary();
    if (summary) {
      console.log('Summary statistics loaded successfully!');
    }

    console.log('\n🎉 Parquet Conversion Completed Successfully!');
    console.log('=============================================');
    console.log('📁 Parquet files created in: data/parquet/');
    console.log('📊 Summary statistics: data/parquet/summary_stats.json');
    console.log('\n🎯 Next steps:');
    console.log('   1. Create API endpoints to serve Parquet data');
    console.log('   2. Update frontend to use Parquet-based APIs');
    console.log('   3. Test performance improvements');

  } catch (error: any) {
    console.error('❌ Parquet conversion failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
