#!/usr/bin/env node

/**
 * SQLite to Parquet Production Pipeline
 * Uses SQLite as intermediate database and converts to Parquet for production
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

// Install required packages
async function installPackages() {
  log('📦 Installing required packages...', 'blue');
  
  try {
    execSync('pnpm add better-sqlite3 parquet-wasm', { stdio: 'inherit' });
    log('✅ Packages installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install packages:', 'red');
    log(error.message, 'red');
    return false;
  }
}

// Convert SQLite to JSON using better-sqlite3
async function convertSQLiteToJSON(sqlitePath, outputDir) {
  log(`🔄 Converting ${path.basename(sqlitePath)} to JSON...`, 'blue');
  
  try {
    const Database = require('better-sqlite3');
    const db = new Database(sqlitePath);
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    log(`Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`, 'cyan');
    
    const dbName = path.basename(sqlitePath, '.db');
    const jsonDir = path.join(outputDir, 'json', dbName);
    
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    // Convert each table to JSON
    for (const table of tables) {
      const data = db.prepare(`SELECT * FROM ${table.name}`).all();
      const jsonPath = path.join(jsonDir, `${table.name}.json`);
      
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
      log(`  ✅ ${table.name}: ${data.length} records`, 'green');
    }
    
    db.close();
    return true;
  } catch (error) {
    log(`❌ Failed to convert ${path.basename(sqlitePath)}:`, 'red');
    log(error.message, 'red');
    return false;
  }
}

// Convert JSON to Parquet using parquet-wasm
async function convertJSONToParquet(jsonDir, parquetDir) {
  log(`🔄 Converting JSON to Parquet...`, 'blue');
  
  try {
    const { writeParquet } = require('parquet-wasm');
    
    // Find all JSON files
    const jsonFiles = fs.readdirSync(jsonDir).filter(file => file.endsWith('.json'));
    
    for (const jsonFile of jsonFiles) {
      const jsonPath = path.join(jsonDir, jsonFile);
      const parquetFile = jsonFile.replace('.json', '.parquet');
      const parquetPath = path.join(parquetDir, parquetFile);
      
      // Read JSON data
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      
      // Convert to Parquet
      const parquetData = writeParquet(jsonData, {
        compression: 'snappy',
        rowGroupSize: 10000
      });
      
      fs.writeFileSync(parquetPath, parquetData);
      log(`  ✅ ${parquetFile}: ${jsonData.length} records`, 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ Failed to convert JSON to Parquet:`, 'red');
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
        path: '/data/parquet/master_data/medical_colleges.parquet',
        type: 'colleges',
        format: 'parquet',
        size: getFileSize(path.join(outputDir, 'parquet', 'master_data', 'medical_colleges.parquet'))
      },
      courses_data: {
        path: '/data/parquet/master_data/courses.parquet',
        type: 'courses',
        format: 'parquet',
        size: getFileSize(path.join(outputDir, 'parquet', 'master_data', 'courses.parquet'))
      },
      cutoffs_data: {
        path: '/data/parquet/counselling_data_partitioned/counselling_data_partitioned.parquet',
        type: 'cutoffs',
        format: 'parquet',
        size: getFileSize(path.join(outputDir, 'parquet', 'counselling_data_partitioned', 'counselling_data_partitioned.parquet'))
      }
    },
    streams: {
      UG: {
        description: 'Undergraduate Medical & Dental (MBBS, BDS)',
        data_files: [
          '/data/parquet/master_data/medical_colleges.parquet',
          '/data/parquet/master_data/courses.parquet',
          '/data/parquet/counselling_data_partitioned/counselling_data_partitioned.parquet'
        ],
        priority_rounds: [1, 2]
      },
      PG_MEDICAL: {
        description: 'Postgraduate Medical (MD, MS, DNB)',
        data_files: [
          '/data/parquet/master_data/medical_colleges.parquet',
          '/data/parquet/master_data/courses.parquet',
          '/data/parquet/counselling_data_partitioned/counselling_data_partitioned.parquet'
        ],
        priority_rounds: [1, 2]
      },
      PG_DENTAL: {
        description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
        data_files: [
          '/data/parquet/master_data/medical_colleges.parquet',
          '/data/parquet/master_data/courses.parquet',
          '/data/parquet/counselling_data_partitioned/counselling_data_partitioned.parquet'
        ],
        priority_rounds: [1, 2]
      }
    },
    performance: {
      expected_load_time: '< 200ms',
      query_response_time: '< 20ms',
      memory_usage: '< 50MB',
      cache_hit_rate: '> 95%'
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

// Main execution
async function main() {
  log('🚀 Starting SQLite to Parquet Production Pipeline...', 'magenta');
  
  // Install required packages
  if (!await installPackages()) {
    process.exit(1);
  }
  
  // Define paths
  const sqliteDir = path.join(__dirname, '..', 'data', 'sqlite');
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  
  // Create output directories
  const jsonDir = path.join(outputDir, 'json');
  const parquetDir = path.join(outputDir, 'parquet');
  
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }
  if (!fs.existsSync(parquetDir)) {
    fs.mkdirSync(parquetDir, { recursive: true });
  }
  
  // Find SQLite files
  const sqliteFiles = fs.readdirSync(sqliteDir).filter(file => file.endsWith('.db'));
  
  if (sqliteFiles.length === 0) {
    log('❌ No SQLite files found in data/sqlite directory', 'red');
    process.exit(1);
  }
  
  log(`Found ${sqliteFiles.length} SQLite files:`, 'blue');
  sqliteFiles.forEach(file => log(`  - ${file}`, 'cyan'));
  
  // Convert each SQLite file to JSON
  let successCount = 0;
  for (const file of sqliteFiles) {
    const sqlitePath = path.join(sqliteDir, file);
    if (await convertSQLiteToJSON(sqlitePath, outputDir)) {
      successCount++;
    }
  }
  
  if (successCount === 0) {
    log('❌ No files were successfully converted', 'red');
    process.exit(1);
  }
  
  // Convert JSON to Parquet
  log('🔄 Converting JSON to Parquet...', 'blue');
  for (const file of sqliteFiles) {
    const dbName = path.basename(file, '.db');
    const jsonDirPath = path.join(jsonDir, dbName);
    const parquetDirPath = path.join(parquetDir, dbName);
    
    if (fs.existsSync(jsonDirPath)) {
      if (!fs.existsSync(parquetDirPath)) {
        fs.mkdirSync(parquetDirPath, { recursive: true });
      }
      
      await convertJSONToParquet(jsonDirPath, parquetDirPath);
    }
  }
  
  // Create production manifest
  const manifestPath = createProductionManifest(outputDir);
  
  // Copy manifest to public directory
  const publicManifestPath = path.join(__dirname, '..', 'public', 'data', 'production_manifest.json');
  fs.copyFileSync(manifestPath, publicManifestPath);
  
  log('\\n🎉 SQLite to Parquet pipeline complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
  log(`  - Files converted: ${successCount}/${sqliteFiles.length}`, 'cyan');
  log(`  - JSON directory: ${jsonDir}`, 'cyan');
  log(`  - Parquet directory: ${parquetDir}`, 'cyan');
  log(`  - Manifest: ${publicManifestPath}`, 'cyan');
  
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
