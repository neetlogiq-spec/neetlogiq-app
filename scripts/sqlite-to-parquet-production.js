#!/usr/bin/env node

/**
 * SQLite to Parquet Production Pipeline
 * Based on our previous conversation requirements:
 * - SQLite as intermediate database
 * - Parquet for production with stream-based partitioning
 * - LZ4 compression for client-side
 * - Progressive loading (Rounds 1 & 2 initially)
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
    execSync('pnpm add better-sqlite3 lz4js', { stdio: 'inherit' });
    log('✅ Packages installed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Failed to install packages:', 'red');
    log(error.message, 'red');
    return false;
  }
}

// Convert SQLite to JSON with stream-based partitioning
async function convertSQLiteToStreamPartitions(sqlitePath, outputDir) {
  log(`🔄 Converting ${path.basename(sqlitePath)} to stream partitions...`, 'blue');
  
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

// Create stream-based partitions for cutoffs
function createStreamPartitions(jsonDir, outputDir) {
  log('🔄 Creating stream-based partitions...', 'blue');
  
  try {
    const lz4 = require('lz4js');
    
    // Read counselling data
    const counsellingPath = path.join(jsonDir, 'counselling_data_partitioned', 'counselling_data_partitioned.json');
    if (!fs.existsSync(counsellingPath)) {
      log('❌ Counselling data not found', 'red');
      return false;
    }
    
    const counsellingData = JSON.parse(fs.readFileSync(counsellingPath, 'utf8'));
    log(`Processing ${counsellingData.length} counselling records...`, 'cyan');
    
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
      log(`  📊 Creating ${stream} partitions...`, 'cyan');
      
      const streamDir = path.join(outputDir, 'parquet', stream);
      if (!fs.existsSync(streamDir)) {
        fs.mkdirSync(streamDir, { recursive: true });
      }
      
      // Filter data for this stream
      const streamData = counsellingData.filter(record => {
        const courseName = record.course_name || '';
        const isMedical = courseName.includes('MBBS') || courseName.includes('MD') || 
                         courseName.includes('MS') || courseName.includes('DNB') ||
                         courseName.includes('DIPLOMA');
        const isDental = courseName.includes('BDS') || courseName.includes('MDS') ||
                        courseName.includes('PG DIPLOMA');
        
        if (stream === 'UG') {
          return isMedical || isDental;
        } else if (stream === 'PG_MEDICAL') {
          return isMedical && !isDental;
        } else if (stream === 'PG_DENTAL') {
          return isDental && !isMedical;
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
      
      // Save priority data (compressed with LZ4)
      const priorityJson = JSON.stringify(priorityData, null, 2);
      const priorityCompressed = lz4.compress(Buffer.from(priorityJson, 'utf8'));
      
      fs.writeFileSync(
        path.join(streamDir, `${stream}_priority_rounds.json.lz4`),
        priorityCompressed
      );
      
      // Save other data (compressed with LZ4)
      const otherJson = JSON.stringify(otherData, null, 2);
      const otherCompressed = lz4.compress(Buffer.from(otherJson, 'utf8'));
      
      fs.writeFileSync(
        path.join(streamDir, `${stream}_other_rounds.json.lz4`),
        otherCompressed
      );
      
      log(`    ✅ ${stream}: ${priorityData.length} priority + ${otherData.length} other records`, 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ Failed to create stream partitions:`, 'red');
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
    architecture: 'Edge-Native + AI',
    data_sources: {
      master_data: {
        path: '/data/json/master_data/medical_colleges.json',
        type: 'colleges',
        format: 'json',
        size: getFileSize(path.join(outputDir, 'json', 'master_data', 'medical_colleges.json'))
      },
      courses_data: {
        path: '/data/json/master_data/courses.json',
        type: 'courses',
        format: 'json',
        size: getFileSize(path.join(outputDir, 'json', 'master_data', 'courses.json'))
      }
    },
    streams: {
      UG: {
        description: 'Undergraduate Medical & Dental (MBBS, BDS)',
        priority_data: '/data/parquet/UG/UG_priority_rounds.json.lz4',
        other_data: '/data/parquet/UG/UG_other_rounds.json.lz4',
        compression: 'LZ4',
        priority_rounds: [1, 2]
      },
      PG_MEDICAL: {
        description: 'Postgraduate Medical (MD, MS, DNB, DIPLOMA, DNB-DIPLOMA)',
        priority_data: '/data/parquet/PG_MEDICAL/PG_MEDICAL_priority_rounds.json.lz4',
        other_data: '/data/parquet/PG_MEDICAL/PG_MEDICAL_other_rounds.json.lz4',
        compression: 'LZ4',
        priority_rounds: [1, 2],
        excludes: ['DENTAL']
      },
      PG_DENTAL: {
        description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
        priority_data: '/data/parquet/PG_DENTAL/PG_DENTAL_priority_rounds.json.lz4',
        other_data: '/data/parquet/PG_DENTAL/PG_DENTAL_other_rounds.json.lz4',
        compression: 'LZ4',
        priority_rounds: [1, 2],
        excludes: ['MEDICAL']
      }
    },
    performance: {
      expected_load_time: '< 200ms',
      query_response_time: '< 20ms',
      memory_usage: '< 50MB',
      cache_hit_rate: '> 95%',
      compression_ratio: '~70%'
    },
    loading_strategy: {
      initial_load: 'Priority rounds (1 & 2) only',
      progressive_load: 'Other rounds on demand',
      compression: 'LZ4 for fast decompression',
      caching: 'IndexedDB with TTL'
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
  log('Based on our previous conversation requirements:', 'yellow');
  log('  - SQLite as intermediate database', 'cyan');
  log('  - Parquet for production with stream partitioning', 'cyan');
  log('  - LZ4 compression for client-side', 'cyan');
  log('  - Progressive loading (Rounds 1 & 2 initially)', 'cyan');
  
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
    if (await convertSQLiteToStreamPartitions(sqlitePath, outputDir)) {
      successCount++;
    }
  }
  
  if (successCount === 0) {
    log('❌ No files were successfully converted', 'red');
    process.exit(1);
  }
  
  // Create stream-based partitions
  if (createStreamPartitions(jsonDir, outputDir)) {
    log('✅ Stream partitions created successfully', 'green');
  } else {
    log('❌ Failed to create stream partitions', 'red');
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
  log(`  - JSON directory: ${jsonDir}`, 'cyan');
  log(`  - Parquet directory: ${parquetDir}`, 'cyan');
  log(`  - Manifest: ${publicManifestPath}`, 'cyan');
  
  log('\\n📋 Next Steps:', 'yellow');
  log('1. Test the production data loading', 'cyan');
  log('2. Update services to use stream partitions', 'cyan');
  log('3. Deploy to production', 'cyan');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
