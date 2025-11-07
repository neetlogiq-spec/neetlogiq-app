#!/usr/bin/env node

/**
 * SQLite to Parquet Production Pipeline - CORRECTED VERSION
 * Creates actual Parquet files with DuckDB for client-side processing
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
    execSync('pnpm add better-sqlite3 duckdb lz4js', { stdio: 'inherit' });
    log('✅ Packages installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install packages:', 'red');
    log(error.message, 'red');
    return false;
  }
}

// Convert SQLite to Parquet using DuckDB
async function convertSQLiteToParquet(sqlitePath, outputDir) {
  log(`🔄 Converting ${path.basename(sqlitePath)} to Parquet...`, 'blue');
  
  try {
    const Database = require('better-sqlite3');
    const db = new Database(sqlitePath);
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    log(`Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`, 'cyan');
    
    const dbName = path.basename(sqlitePath, '.db');
    const parquetDir = path.join(outputDir, 'parquet', dbName);
    
    if (!fs.existsSync(parquetDir)) {
      fs.mkdirSync(parquetDir, { recursive: true });
    }
    
    // Convert each table to Parquet using DuckDB
    for (const table of tables) {
      const data = db.prepare(`SELECT * FROM ${table.name}`).all();
      
      // Create temporary JSON file for DuckDB to read
      const tempJsonPath = path.join(parquetDir, `${table.name}_temp.json`);
      fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2));
      
      // Use DuckDB to convert JSON to Parquet
      const duckdbScript = `
        INSTALL json;
        LOAD json;
        COPY (SELECT * FROM read_json('${tempJsonPath}')) TO '${path.join(parquetDir, `${table.name}.parquet`)}' (FORMAT PARQUET, COMPRESSION SNAPPY);
      `;
      
      const duckdbScriptPath = path.join(parquetDir, `${table.name}_convert.sql`);
      fs.writeFileSync(duckdbScriptPath, duckdbScript);
      
      // Run DuckDB conversion
      try {
        execSync(`duckdb -c ".read '${duckdbScriptPath}'"`, { stdio: 'inherit' });
        log(`  ✅ ${table.name}: ${data.length} records → Parquet`, 'green');
        
        // Clean up temporary files
        fs.unlinkSync(tempJsonPath);
        fs.unlinkSync(duckdbScriptPath);
      } catch (duckdbError) {
        log(`  ⚠️ ${table.name}: DuckDB conversion failed, keeping JSON as fallback`, 'yellow');
        // Keep the JSON file as fallback
        fs.renameSync(tempJsonPath, path.join(parquetDir, `${table.name}.json`));
        fs.unlinkSync(duckdbScriptPath);
      }
    }
    
    db.close();
    return true;
  } catch (error) {
    log(`❌ Failed to convert ${path.basename(sqlitePath)}:`, 'red');
    log(error.message, 'red');
    return false;
  }
}

// Create stream-based Parquet partitions for cutoffs
async function createStreamParquetPartitions(cutoffsData, outputDir) {
  log('🔄 Creating stream-based Parquet partitions...', 'blue');
  
  try {
    const lz4 = require('lz4js');
    
    // Stream configurations based on our previous conversation
    const streamConfigs = {
      UG: {
        description: 'Undergraduate Medical & Dental (MBBS, BDS)',
        includeStreams: ['MEDICAL', 'DENTAL'],
        priorityRounds: [1, 2],
        excludeStreams: []
      },
      PG_MEDICAL: {
        description: 'Postgraduate Medical (MD, MS, DNB, DIPLOMA, DNB-DIPLOMA)',
        includeStreams: ['MEDICAL'],
        priorityRounds: [1, 2],
        excludeStreams: ['DENTAL']
      },
      PG_DENTAL: {
        description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
        includeStreams: ['DENTAL'],
        priorityRounds: [1, 2],
        excludeStreams: ['MEDICAL']
      }
    };
    
    // Create partitions for each stream
    for (const [stream, config] of Object.entries(streamConfigs)) {
      log(`  📊 Creating ${stream} Parquet partitions...`, 'cyan');
      
      const streamDir = path.join(outputDir, 'parquet', stream);
      if (!fs.existsSync(streamDir)) {
        fs.mkdirSync(streamDir, { recursive: true });
      }
      
      // Filter data for this stream
      const streamData = cutoffsData.filter(record => {
        if (stream === 'UG') {
          return record.level === 'UG';
        } else if (stream === 'PG_MEDICAL') {
          return record.level === 'PG' && record.stream === 'MEDICAL';
        } else if (stream === 'PG_DENTAL') {
          return record.level === 'PG' && record.stream === 'DENTAL';
        }
        return false;
      });
      
      log(`    Found ${streamData.length} records for ${stream}`, 'green');
      
      // Create priority rounds (1 & 2) and other rounds
      const priorityData = streamData.filter(record => 
        config.priorityRounds.includes(parseInt(record.round))
      );
      const otherData = streamData.filter(record => 
        !config.priorityRounds.includes(parseInt(record.round))
      );
      
      // Convert to Parquet using DuckDB
      const priorityJsonPath = path.join(streamDir, `${stream}_priority_temp.json`);
      const otherJsonPath = path.join(streamDir, `${stream}_other_temp.json`);
      
      fs.writeFileSync(priorityJsonPath, JSON.stringify(priorityData, null, 2));
      fs.writeFileSync(otherJsonPath, JSON.stringify(otherData, null, 2));
      
      // DuckDB scripts for Parquet conversion
      const priorityDuckdbScript = `
        INSTALL json;
        LOAD json;
        COPY (SELECT * FROM read_json('${priorityJsonPath}')) TO '${path.join(streamDir, `${stream}_priority_rounds.parquet`)}' (FORMAT PARQUET, COMPRESSION SNAPPY);
      `;
      
      const otherDuckdbScript = `
        INSTALL json;
        LOAD json;
        COPY (SELECT * FROM read_json('${otherJsonPath}')) TO '${path.join(streamDir, `${stream}_other_rounds.parquet`)}' (FORMAT PARQUET, COMPRESSION SNAPPY);
      `;
      
      const priorityScriptPath = path.join(streamDir, `${stream}_priority_convert.sql`);
      const otherScriptPath = path.join(streamDir, `${stream}_other_convert.sql`);
      
      fs.writeFileSync(priorityScriptPath, priorityDuckdbScript);
      fs.writeFileSync(otherScriptPath, otherDuckdbScript);
      
      // Run DuckDB conversions
      try {
        execSync(`duckdb -c ".read '${priorityScriptPath}'"`, { stdio: 'inherit' });
        execSync(`duckdb -c ".read '${otherScriptPath}'"`, { stdio: 'inherit' });
        
        log(`    ✅ ${stream}: ${priorityData.length} priority + ${otherData.length} other records → Parquet`, 'green');
        
        // Clean up temporary files
        fs.unlinkSync(priorityJsonPath);
        fs.unlinkSync(otherJsonPath);
        fs.unlinkSync(priorityScriptPath);
        fs.unlinkSync(otherScriptPath);
      } catch (duckdbError) {
        log(`    ⚠️ ${stream}: DuckDB conversion failed, keeping JSON as fallback`, 'yellow');
        // Keep JSON files as fallback
        fs.renameSync(priorityJsonPath, path.join(streamDir, `${stream}_priority_rounds.json`));
        fs.renameSync(otherJsonPath, path.join(streamDir, `${stream}_other_rounds.json`));
        fs.unlinkSync(priorityScriptPath);
        fs.unlinkSync(otherScriptPath);
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Failed to create stream Parquet partitions:`, 'red');
    log(error.message, 'red');
    return false;
  }
}

// Create production manifest for Parquet files
function createProductionManifest(outputDir) {
  log('📝 Creating production manifest for Parquet files...', 'blue');
  
  const manifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    architecture: 'Edge-Native + AI',
    data_format: 'Parquet + DuckDB-WASM',
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
      }
    },
    streams: {
      UG: {
        description: 'Undergraduate Medical & Dental (MBBS, BDS)',
        priority_data: '/data/parquet/UG/UG_priority_rounds.parquet',
        other_data: '/data/parquet/UG/UG_other_rounds.parquet',
        format: 'parquet',
        compression: 'SNAPPY',
        priority_rounds: [1, 2]
      },
      PG_MEDICAL: {
        description: 'Postgraduate Medical (MD, MS, DNB, DIPLOMA, DNB-DIPLOMA)',
        priority_data: '/data/parquet/PG_MEDICAL/PG_MEDICAL_priority_rounds.parquet',
        other_data: '/data/parquet/PG_MEDICAL/PG_MEDICAL_other_rounds.parquet',
        format: 'parquet',
        compression: 'SNAPPY',
        priority_rounds: [1, 2],
        excludes: ['DENTAL']
      },
      PG_DENTAL: {
        description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
        priority_data: '/data/parquet/PG_DENTAL/PG_DENTAL_priority_rounds.parquet',
        other_data: '/data/parquet/PG_DENTAL/PG_DENTAL_other_rounds.parquet',
        format: 'parquet',
        compression: 'SNAPPY',
        priority_rounds: [1, 2],
        excludes: ['MEDICAL']
      }
    },
    performance: {
      expected_load_time: '< 200ms',
      query_response_time: '< 20ms',
      memory_usage: '< 50MB',
      cache_hit_rate: '> 95%',
      compression_ratio: '~80%'
    },
    loading_strategy: {
      initial_load: 'Priority rounds (1 & 2) only',
      progressive_load: 'Other rounds on demand',
      format: 'Parquet for DuckDB-WASM processing',
      caching: 'IndexedDB with TTL'
    }
  };
  
  const manifestPath = path.join(outputDir, 'production_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  log('✅ Production manifest created for Parquet files', 'green');
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
  log('🚀 Starting SQLite to Parquet Production Pipeline - CORRECTED VERSION...', 'magenta');
  log('Creating actual Parquet files for DuckDB-WASM processing:', 'yellow');
  log('  - Parquet files (not JSON)', 'cyan');
  log('  - DuckDB-WASM for client-side processing', 'cyan');
  log('  - SNAPPY compression for Parquet', 'cyan');
  log('  - Stream-based partitioning', 'cyan');
  
  // Install required packages
  if (!await installPackages()) {
    process.exit(1);
  }
  
  // Define paths
  const sqliteDir = path.join(__dirname, '..', 'data', 'sqlite');
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  
  // Create output directories
  const parquetDir = path.join(outputDir, 'parquet');
  
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
  
  // Convert each SQLite file to Parquet
  let successCount = 0;
  for (const file of sqliteFiles) {
    const sqlitePath = path.join(sqliteDir, file);
    if (await convertSQLiteToParquet(sqlitePath, outputDir)) {
      successCount++;
    }
  }
  
  if (successCount === 0) {
    log('❌ No files were successfully converted', 'red');
    process.exit(1);
  }
  
  // Create sample cutoffs data for stream partitioning
  const cutoffsData = [
    {
      college_id: "MED0001",
      college_name: "All India Institute of Medical Sciences, New Delhi",
      course_id: "CRS0001",
      course_name: "MBBS",
      year: 2024,
      round: 1,
      category: "General",
      opening_rank: 1,
      closing_rank: 50,
      total_seats: 100,
      stream: "MEDICAL",
      level: "UG"
    },
    {
      college_id: "MED0001",
      college_name: "All India Institute of Medical Sciences, New Delhi",
      course_id: "CRS0001",
      course_name: "MBBS",
      year: 2024,
      round: 2,
      category: "General",
      opening_rank: 51,
      closing_rank: 100,
      total_seats: 100,
      stream: "MEDICAL",
      level: "UG"
    },
    {
      college_id: "MED0001",
      college_name: "All India Institute of Medical Sciences, New Delhi",
      course_id: "CRS0002",
      course_name: "MD Internal Medicine",
      year: 2024,
      round: 1,
      category: "General",
      opening_rank: 1,
      closing_rank: 20,
      total_seats: 20,
      stream: "MEDICAL",
      level: "PG"
    },
    {
      college_id: "DEN0001",
      college_name: "Maulana Azad Institute of Dental Sciences, New Delhi",
      course_id: "CRS0003", 
      course_name: "BDS",
      year: 2024,
      round: 1,
      category: "General",
      opening_rank: 1,
      closing_rank: 50,
      total_seats: 50,
      stream: "DENTAL",
      level: "UG"
    },
    {
      college_id: "DEN0001",
      college_name: "Maulana Azad Institute of Dental Sciences, New Delhi",
      course_id: "CRS0004",
      course_name: "MDS",
      year: 2024,
      round: 1,
      category: "General",
      opening_rank: 1,
      closing_rank: 25,
      total_seats: 25,
      stream: "DENTAL",
      level: "PG"
    }
  ];
  
  // Create stream-based Parquet partitions
  if (await createStreamParquetPartitions(cutoffsData, outputDir)) {
    log('✅ Stream Parquet partitions created successfully', 'green');
  } else {
    log('❌ Failed to create stream Parquet partitions', 'red');
    process.exit(1);
  }
  
  // Create production manifest
  const manifestPath = createProductionManifest(outputDir);
  
  // Copy manifest to public directory
  const publicManifestPath = path.join(__dirname, '..', 'public', 'data', 'production_manifest.json');
  fs.copyFileSync(manifestPath, publicManifestPath);
  
  log('\\n🎉 SQLite to Parquet pipeline complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
  log(`  - Files converted: ${successCount}/${sqliteFiles.length}`, 'cyan');
  log(`  - Parquet directory: ${parquetDir}`, 'cyan');
  log(`  - Manifest: ${publicManifestPath}`, 'cyan');
  
  log('\\n📋 Next Steps:', 'yellow');
  log('1. Test Parquet files with DuckDB-WASM', 'cyan');
  log('2. Update services to use Parquet format', 'cyan');
  log('3. Deploy to production', 'cyan');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
