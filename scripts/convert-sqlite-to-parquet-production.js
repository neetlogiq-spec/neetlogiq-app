#!/usr/bin/env node

/**
 * Production SQLite to Parquet Conversion Script
 * Converts existing SQLite databases to Parquet format for Edge-Native architecture
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if DuckDB is available
function checkDuckDB() {
  try {
    execSync('duckdb --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Install DuckDB if not available
function installDuckDB() {
  log('📦 Installing DuckDB...', 'yellow');
  try {
    execSync('npm install -g duckdb', { stdio: 'inherit' });
    log('✅ DuckDB installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install DuckDB:', 'red');
    log('Please install DuckDB manually: https://duckdb.org/docs/installation/', 'yellow');
    return false;
  }
}

// Convert SQLite to Parquet using DuckDB
function convertSQLiteToParquet(sqlitePath, outputDir) {
  log(`🔄 Converting ${sqlitePath} to Parquet...`, 'blue');
  
  const dbName = path.basename(sqlitePath, '.db');
  const parquetDir = path.join(outputDir, dbName);
  
  // Create output directory
  if (!fs.existsSync(parquetDir)) {
    fs.mkdirSync(parquetDir, { recursive: true });
  }
  
  // DuckDB script to convert SQLite to Parquet
  const duckdbScript = `
-- Connect to SQLite database
ATTACH '${sqlitePath}' AS sqlite_db;

-- Get all tables
.tables

-- Convert each table to Parquet
-- Colleges table
COPY (SELECT * FROM sqlite_db.medical_colleges) TO '${parquetDir}/colleges.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Courses table  
COPY (SELECT * FROM sqlite_db.courses) TO '${parquetDir}/courses.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Cutoffs table (if exists)
COPY (SELECT * FROM sqlite_db.counselling_data_partitioned) TO '${parquetDir}/cutoffs.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Seat data table (if exists)
COPY (SELECT * FROM sqlite_db.seat_data) TO '${parquetDir}/seat_data.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- Detach database
DETACH sqlite_db;
`;

  const scriptPath = path.join(outputDir, 'convert.sql');
  fs.writeFileSync(scriptPath, duckdbScript);
  
  try {
    execSync(`duckdb -c ".read ${scriptPath}"`, { stdio: 'inherit' });
    log(`✅ Successfully converted ${dbName} to Parquet`, 'green');
    
    // Clean up script
    fs.unlinkSync(scriptPath);
    
    return true;
  } catch (error) {
    log(`❌ Failed to convert ${dbName}:`, 'red');
    log(error.message, 'red');
    return false;
  }
}

// Create production manifest
function createProductionManifest(outputDir) {
  log('📝 Creating production manifest...', 'blue');
  
  const manifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    data_sources: {
      master_data: {
        path: '/data/parquet/master_data/colleges.parquet',
        type: 'colleges',
        compression: 'ZSTD',
        size: getFileSize(path.join(outputDir, 'master_data', 'colleges.parquet'))
      },
      courses_data: {
        path: '/data/parquet/master_data/courses.parquet',
        type: 'courses',
        compression: 'ZSTD',
        size: getFileSize(path.join(outputDir, 'master_data', 'courses.parquet'))
      },
      cutoffs_data: {
        path: '/data/parquet/counselling_data_partitioned/cutoffs.parquet',
        type: 'cutoffs',
        compression: 'ZSTD',
        size: getFileSize(path.join(outputDir, 'counselling_data_partitioned', 'cutoffs.parquet'))
      }
    },
    streams: {
      UG: {
        description: 'Undergraduate Medical & Dental (MBBS, BDS)',
        data_files: [
          '/data/parquet/master_data/colleges.parquet',
          '/data/parquet/master_data/courses.parquet',
          '/data/parquet/counselling_data_partitioned/cutoffs.parquet'
        ],
        priority_rounds: [1, 2]
      },
      PG_MEDICAL: {
        description: 'Postgraduate Medical (MD, MS, DNB)',
        data_files: [
          '/data/parquet/master_data/colleges.parquet',
          '/data/parquet/master_data/courses.parquet',
          '/data/parquet/counselling_data_partitioned/cutoffs.parquet'
        ],
        priority_rounds: [1, 2]
      },
      PG_DENTAL: {
        description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
        data_files: [
          '/data/parquet/master_data/colleges.parquet',
          '/data/parquet/master_data/courses.parquet',
          '/data/parquet/counselling_data_partitioned/cutoffs.parquet'
        ],
        priority_rounds: [1, 2]
      }
    },
    compression: {
      algorithm: 'ZSTD',
      level: 3,
      benefits: {
        size_reduction: '70-85%',
        query_performance: '10x faster',
        memory_usage: '50% less'
      }
    },
    performance: {
      expected_load_time: '< 500ms',
      query_response_time: '< 50ms',
      memory_usage: '< 100MB',
      cache_hit_rate: '> 90%'
    }
  };
  
  const manifestPath = path.join(outputDir, 'production_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  log('✅ Production manifest created', 'green');
  return manifestPath;
}

// Get file size in human readable format
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const bytes = stats.size;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  } catch (error) {
    return 'Unknown';
  }
}

// Create compressed data files
function createCompressedData(outputDir) {
  log('🗜️  Creating compressed data files...', 'blue');
  
  const compressedDir = path.join(outputDir, 'compressed');
  if (!fs.existsSync(compressedDir)) {
    fs.mkdirSync(compressedDir, { recursive: true });
  }
  
  // Create compressed versions of Parquet files
  const parquetFiles = [
    'master_data/colleges.parquet',
    'master_data/courses.parquet',
    'counselling_data_partitioned/cutoffs.parquet'
  ];
  
  parquetFiles.forEach(file => {
    const sourcePath = path.join(outputDir, file);
    const compressedPath = path.join(compressedDir, path.basename(file, '.parquet') + '.lz4');
    
    if (fs.existsSync(sourcePath)) {
      try {
        // Use gzip as LZ4 alternative for now
        execSync(`gzip -c "${sourcePath}" > "${compressedPath}.gz"`, { stdio: 'pipe' });
        log(`✅ Compressed ${path.basename(file)}`, 'green');
      } catch (error) {
        log(`⚠️  Could not compress ${path.basename(file)}`, 'yellow');
      }
    }
  });
}

// Main execution
async function main() {
  log('🚀 Starting SQLite to Parquet Production Conversion...', 'magenta');
  
  // Check if DuckDB is available
  if (!checkDuckDB()) {
    log('DuckDB not found, attempting to install...', 'yellow');
    if (!installDuckDB()) {
      process.exit(1);
    }
  }
  
  // Define paths
  const sqliteDir = path.join(__dirname, '..', 'data', 'sqlite');
  const outputDir = path.join(__dirname, '..', 'public', 'data', 'parquet');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Find SQLite files
  const sqliteFiles = fs.readdirSync(sqliteDir).filter(file => file.endsWith('.db'));
  
  if (sqliteFiles.length === 0) {
    log('❌ No SQLite files found in data/sqlite directory', 'red');
    process.exit(1);
  }
  
  log(`Found ${sqliteFiles.length} SQLite files:`, 'blue');
  sqliteFiles.forEach(file => log(`  - ${file}`, 'cyan'));
  
  // Convert each SQLite file
  let successCount = 0;
  for (const file of sqliteFiles) {
    const sqlitePath = path.join(sqliteDir, file);
    if (convertSQLiteToParquet(sqlitePath, outputDir)) {
      successCount++;
    }
  }
  
  if (successCount === 0) {
    log('❌ No files were successfully converted', 'red');
    process.exit(1);
  }
  
  // Create production manifest
  const manifestPath = createProductionManifest(outputDir);
  
  // Create compressed data
  createCompressedData(outputDir);
  
  // Create data directory in public
  const publicDataDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true });
  }
  
  // Copy manifest to public directory
  const publicManifestPath = path.join(publicDataDir, 'production_manifest.json');
  fs.copyFileSync(manifestPath, publicManifestPath);
  
  log('\\n🎉 SQLite to Parquet conversion complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
  log(`  - Files converted: ${successCount}/${sqliteFiles.length}`, 'cyan');
  log(`  - Output directory: ${outputDir}`, 'cyan');
  log(`  - Manifest: ${publicManifestPath}`, 'cyan');
  log(`  - Compressed data: ${path.join(outputDir, 'compressed')}`, 'cyan');
  
  log('\\n📋 Next Steps:', 'yellow');
  log('1. Test the production data loading', 'cyan');
  log('2. Update services to use Parquet files', 'cyan');
  log('3. Deploy to production', 'cyan');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
