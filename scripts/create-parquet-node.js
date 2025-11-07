#!/usr/bin/env node

/**
 * Create Parquet Files using DuckDB Node.js package
 * This creates actual Parquet files for DuckDB-WASM processing
 */

const fs = require('fs');
const path = require('path');

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

// Create Parquet files using DuckDB Node.js package
async function createParquetFiles(outputDir) {
  log('📝 Creating Parquet files using DuckDB Node.js package...', 'blue');
  
  try {
    const duckdb = require('duckdb');
    const db = new duckdb.Database(':memory:');
    
    // Sample colleges data
    const collegesData = [
      {
        id: "MED0001",
        name: "All India Institute of Medical Sciences, New Delhi",
        state: "Delhi",
        city: "New Delhi",
        type: "Government",
        established_year: 1956,
        rating: 4.8,
        total_seats: 100,
        stream: "MEDICAL",
        courses: ["MBBS", "MD", "MS", "DNB"]
      },
      {
        id: "MED0002", 
        name: "Post Graduate Institute of Medical Education and Research, Chandigarh",
        state: "Punjab",
        city: "Chandigarh",
        type: "Government",
        established_year: 1962,
        rating: 4.7,
        total_seats: 80,
        stream: "MEDICAL",
        courses: ["MBBS", "MD", "MS", "DNB"]
      },
      {
        id: "DEN0001",
        name: "Maulana Azad Institute of Dental Sciences, New Delhi",
        state: "Delhi", 
        city: "New Delhi",
        type: "Government",
        established_year: 2003,
        rating: 4.5,
        total_seats: 50,
        stream: "DENTAL",
        courses: ["BDS", "MDS"]
      }
    ];
    
    // Sample courses data
    const coursesData = [
      {
        id: "CRS0001",
        name: "MBBS",
        duration: 5.5,
        level: "UG",
        stream: "MEDICAL",
        total_seats: 100,
        fee_min: 0,
        fee_max: 50000
      },
      {
        id: "CRS0002",
        name: "MD Internal Medicine",
        duration: 3,
        level: "PG",
        stream: "MEDICAL", 
        total_seats: 20,
        fee_min: 0,
        fee_max: 100000
      },
      {
        id: "CRS0003",
        name: "BDS",
        duration: 5,
        level: "UG",
        stream: "DENTAL",
        total_seats: 50,
        fee_min: 0,
        fee_max: 40000
      },
      {
        id: "CRS0004",
        name: "MDS",
        duration: 3,
        level: "PG",
        stream: "DENTAL",
        total_seats: 25,
        fee_min: 0,
        fee_max: 80000
      }
    ];
    
    // Sample cutoffs data with stream-based partitioning
    const cutoffsData = [
      // UG Medical (MBBS)
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
      // PG Medical (MD)
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
      // UG Dental (BDS)
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
      // PG Dental (MDS)
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
    
    // Create directories
    const masterDataDir = path.join(outputDir, 'parquet', 'master_data');
    const ugDir = path.join(outputDir, 'parquet', 'UG');
    const pgMedicalDir = path.join(outputDir, 'parquet', 'PG_MEDICAL');
    const pgDentalDir = path.join(outputDir, 'parquet', 'PG_DENTAL');
    
    [masterDataDir, ugDir, pgMedicalDir, pgDentalDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Convert to Parquet using DuckDB
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Convert colleges data
        const collegesJsonPath = path.join(masterDataDir, 'colleges_temp.json');
        fs.writeFileSync(collegesJsonPath, JSON.stringify(collegesData, null, 2));
        
        db.run(`INSTALL json;`, (err) => {
          if (err) {
            log(`❌ Failed to install json extension: ${err.message}`, 'red');
            reject(err);
            return;
          }
          
          db.run(`LOAD json;`, (err) => {
            if (err) {
              log(`❌ Failed to load json extension: ${err.message}`, 'red');
              reject(err);
              return;
            }
            
            // Create colleges Parquet
            db.run(`
              COPY (SELECT * FROM read_json('${collegesJsonPath}')) 
              TO '${path.join(masterDataDir, 'colleges.parquet')}' 
              (FORMAT PARQUET, COMPRESSION SNAPPY);
            `, (err) => {
              if (err) {
                log(`❌ Failed to create colleges.parquet: ${err.message}`, 'red');
                reject(err);
                return;
              }
              
              log('  ✅ colleges.parquet created', 'green');
              
              // Convert courses data
              const coursesJsonPath = path.join(masterDataDir, 'courses_temp.json');
              fs.writeFileSync(coursesJsonPath, JSON.stringify(coursesData, null, 2));
              
              db.run(`
                COPY (SELECT * FROM read_json('${coursesJsonPath}')) 
                TO '${path.join(masterDataDir, 'courses.parquet')}' 
                (FORMAT PARQUET, COMPRESSION SNAPPY);
              `, (err) => {
                if (err) {
                  log(`❌ Failed to create courses.parquet: ${err.message}`, 'red');
                  reject(err);
                  return;
                }
                
                log('  ✅ courses.parquet created', 'green');
                
                // Create stream-based partitions
                const streamConfigs = {
                  UG: {
                    data: cutoffsData.filter(record => record.level === 'UG'),
                    dir: ugDir
                  },
                  PG_MEDICAL: {
                    data: cutoffsData.filter(record => record.level === 'PG' && record.stream === 'MEDICAL'),
                    dir: pgMedicalDir
                  },
                  PG_DENTAL: {
                    data: cutoffsData.filter(record => record.level === 'PG' && record.stream === 'DENTAL'),
                    dir: pgDentalDir
                  }
                };
                
                let completedStreams = 0;
                const totalStreams = Object.keys(streamConfigs).length;
                
                for (const [stream, config] of Object.entries(streamConfigs)) {
                  log(`  📊 Creating ${stream} Parquet files...`, 'cyan');
                  
                  // Priority rounds (1 & 2)
                  const priorityData = config.data.filter(record => [1, 2].includes(record.round));
                  const otherData = config.data.filter(record => ![1, 2].includes(record.round));
                  
                  // Create priority rounds Parquet
                  if (priorityData.length > 0) {
                    const priorityJsonPath = path.join(config.dir, `${stream}_priority_temp.json`);
                    fs.writeFileSync(priorityJsonPath, JSON.stringify(priorityData, null, 2));
                    
                    db.run(`
                      COPY (SELECT * FROM read_json('${priorityJsonPath}')) 
                      TO '${path.join(config.dir, `${stream}_priority_rounds.parquet`)}' 
                      (FORMAT PARQUET, COMPRESSION SNAPPY);
                    `, (err) => {
                      if (err) {
                        log(`❌ Failed to create ${stream}_priority_rounds.parquet: ${err.message}`, 'red');
                        reject(err);
                        return;
                      }
                      
                      log(`    ✅ ${stream}_priority_rounds.parquet (${priorityData.length} records)`, 'green');
                      
                      // Clean up
                      fs.unlinkSync(priorityJsonPath);
                      
                      completedStreams++;
                      if (completedStreams === totalStreams) {
                        // Clean up temporary files
                        fs.unlinkSync(collegesJsonPath);
                        fs.unlinkSync(coursesJsonPath);
                        
                        db.close();
                        resolve(true);
                      }
                    });
                  } else {
                    completedStreams++;
                    if (completedStreams === totalStreams) {
                      // Clean up temporary files
                      fs.unlinkSync(collegesJsonPath);
                      fs.unlinkSync(coursesJsonPath);
                      
                      db.close();
                      resolve(true);
                    }
                  }
                }
              });
            });
          });
        });
      });
    });
  } catch (error) {
    log(`❌ Failed to create Parquet files:`, 'red');
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
        path: '/data/parquet/master_data/colleges.parquet',
        type: 'colleges',
        format: 'parquet',
        size: getFileSize(path.join(outputDir, 'parquet', 'master_data', 'colleges.parquet'))
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
  log('🚀 Creating Parquet Files using DuckDB Node.js package...', 'magenta');
  log('Creating actual Parquet files for DuckDB-WASM processing:', 'yellow');
  log('  - Parquet files (not JSON)', 'cyan');
  log('  - DuckDB-WASM for client-side processing', 'cyan');
  log('  - SNAPPY compression for Parquet', 'cyan');
  log('  - Stream-based partitioning', 'cyan');
  
  // Define paths
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  
  // Create output directories
  const parquetDir = path.join(outputDir, 'parquet');
  
  if (!fs.existsSync(parquetDir)) {
    fs.mkdirSync(parquetDir, { recursive: true });
  }
  
  // Create Parquet files
  try {
    await createParquetFiles(outputDir);
    log('✅ Parquet files created successfully', 'green');
  } catch (error) {
    log('❌ Failed to create Parquet files', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
  
  // Create production manifest
  const manifestPath = createProductionManifest(outputDir);
  
  // Copy manifest to public directory
  const publicManifestPath = path.join(__dirname, '..', 'public', 'data', 'production_manifest.json');
  fs.copyFileSync(manifestPath, publicManifestPath);
  
  log('\\n🎉 Parquet files creation complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
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
