#!/usr/bin/env tsx

import DataTransformationPipeline from '../src/lib/data/data-pipeline';
import ParquetExporter from '../src/lib/data/parquet-exporter';
import path from 'path';
import fs from 'fs/promises';

interface PipelineOptions {
  validation: boolean;
  parquet: boolean;
  reports: boolean;
  confidenceThreshold: number;
  verbose: boolean;
  dryRun: boolean;
}

async function main() {
  console.log('🚀 Excel Data Pipeline for 2400+ Colleges');
  console.log('==========================================\n');

  const options = parseCommandLineArgs();
  
  if (options.dryRun) {
    console.log('🧪 DRY RUN MODE - No files will be written\n');
  }

  try {
    // Initialize the main pipeline
    const pipeline = new DataTransformationPipeline({
      inputDir: path.join(process.cwd(), 'data/Foundation'),
      outputDir: path.join(process.cwd(), 'data/processed'),
      enableValidation: options.validation,
      exportFormats: ['json', 'csv'],
      confidenceThreshold: options.confidenceThreshold,
      removeDuplicates: true,
      generateReports: options.reports
    });

    // Run the main pipeline
    console.log('📊 Starting main data processing pipeline...\n');
    const pipelineStart = Date.now();
    const result = await pipeline.run();

    if (!result.success) {
      console.error('❌ Pipeline failed:', result.errors?.join(', '));
      process.exit(1);
    }

    const pipelineTime = Date.now() - pipelineStart;
    
    // Print main results
    console.log('\n✅ MAIN PIPELINE COMPLETED');
    console.log('============================');
    console.log(`⏱️  Processing Time: ${pipelineTime}ms`);
    console.log(`📋 Total Excel Records: ${result.summary.totalColleges}`);
    console.log(`✅ Valid Colleges: ${result.summary.validColleges}`);
    console.log(`🔍 Duplicates Removed: ${result.summary.duplicatesRemoved}`);
    console.log(`📄 Data Files Generated: ${result.files.dataFiles.length}`);
    console.log(`📊 Report Files Generated: ${result.files.reportFiles.length}`);

    if (result.validationStats) {
      console.log('\n🔍 VALIDATION SUMMARY');
      console.log('=====================');
      console.log(`Valid Records: ${result.validationStats.valid}`);
      console.log(`Invalid Records: ${result.validationStats.invalid}`);
      console.log(`Warnings: ${result.validationStats.warnings}`);
      console.log(`High Confidence: ${result.validationStats.confidenceDistribution.high}`);
      console.log(`Medium Confidence: ${result.validationStats.confidenceDistribution.medium}`);
      console.log(`Low Confidence: ${result.validationStats.confidenceDistribution.low}`);
    }

    // Export to Parquet if requested
    if (options.parquet && !options.dryRun) {
      console.log('\n☁️ PARQUET EXPORT');
      console.log('=================');
      
      const parquetExporter = new ParquetExporter({
        outputDir: path.join(process.cwd(), 'data/parquet'),
        compressionType: 'GZIP',
        splitByType: true,
        splitByState: false
      });

      const parquetStart = Date.now();
      const { files, manifest } = await parquetExporter.createCloudflareOptimizedParquet(
        result.colleges,
        result.references
      );

      const parquetTime = Date.now() - parquetStart;
      console.log(`⏱️  Parquet Export Time: ${parquetTime}ms`);
      console.log(`📦 Parquet Files: ${files.length}`);
      console.log(`💾 Ready for Cloudflare R2 upload`);

      // Generate Parquet summary
      const parquetSummary = await parquetExporter.generateExportSummary(files);
      await fs.writeFile(
        path.join(process.cwd(), 'data/processed/parquet-summary.txt'), 
        parquetSummary
      );
    }

    // Print file locations
    console.log('\n📁 OUTPUT LOCATIONS');
    console.log('===================');
    console.log(`📊 Processed Data: ${path.join(process.cwd(), 'data/processed')}`);
    if (options.parquet) {
      console.log(`📦 Parquet Files: ${path.join(process.cwd(), 'data/parquet')}`);
    }

    // Print next steps
    console.log('\n🎯 NEXT STEPS');
    console.log('=============');
    console.log('1. 📋 Review generated reports in data/processed/');
    console.log('2. 🔍 Check validation results and fix any data quality issues');
    if (options.parquet) {
      console.log('3. ☁️  Upload Parquet files to Cloudflare R2');
      console.log('4. 🔄 Update your Cloudflare Workers to use the new data');
    }
    console.log('5. 🧪 Test the API endpoints with the new college data');

    // Success statistics
    const successRate = (result.summary.validColleges / result.summary.totalColleges * 100).toFixed(1);
    console.log(`\n🎉 SUCCESS: ${successRate}% of records processed successfully`);
    console.log(`📊 Final dataset contains ${result.summary.validColleges} validated colleges`);

  } catch (error) {
    console.error('\n❌ PIPELINE FAILED');
    console.error('==================');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    
    if (options.verbose && error instanceof Error) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

function parseCommandLineArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  
  const options: PipelineOptions = {
    validation: true,
    parquet: false,
    reports: true,
    confidenceThreshold: 0.3,
    verbose: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--no-validation':
        options.validation = false;
        break;
      case '--parquet':
        options.parquet = true;
        break;
      case '--no-reports':
        options.reports = false;
        break;
      case '--confidence':
        const threshold = parseFloat(args[i + 1]);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          options.confidenceThreshold = threshold;
          i++; // Skip next argument
        }
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Excel Data Pipeline for 2400+ Colleges
======================================

USAGE:
  npm run excel:pipeline [options]
  npx tsx scripts/run-excel-pipeline.ts [options]

OPTIONS:
  --no-validation      Skip data validation (faster but less reliable)
  --parquet           Export to Parquet format for Cloudflare R2
  --no-reports        Skip report generation  
  --confidence N      Set minimum confidence threshold (0.0-1.0, default: 0.3)
  --verbose           Show detailed error messages and stack traces
  --dry-run           Preview what would be processed without writing files
  --help, -h          Show this help message

EXAMPLES:
  # Full pipeline with Parquet export
  npm run excel:pipeline --parquet

  # Quick processing without validation
  npm run excel:pipeline --no-validation --no-reports

  # High confidence threshold for production
  npm run excel:pipeline --confidence 0.8 --parquet

  # Preview mode
  npm run excel:pipeline --dry-run --verbose

OUTPUT:
  data/processed/     - JSON, CSV files and reports
  data/parquet/       - Parquet files for Cloudflare R2 (if --parquet)

PIPELINE STAGES:
  1. 📊 Excel file processing (medical.xlsx, dental.xlsx, dnb.xlsx)
  2. 🔍 Data validation and normalization
  3. 🎯 Duplicate detection and removal
  4. 💾 Export to multiple formats
  5. 📋 Report generation
  6. 📦 Parquet optimization (optional)

For more information, see: /path/to/WARP.md
`);
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n💥 UNCAUGHT EXCEPTION');
  console.error('====================');
  console.error(error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 UNHANDLED PROMISE REJECTION');
  console.error('===============================');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

// Run the pipeline
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ UNEXPECTED ERROR');
    console.error('===================');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}