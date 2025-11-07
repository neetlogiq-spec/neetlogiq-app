#!/usr/bin/env node

/**
 * Create Parquet File Structure for Edge-Native Architecture
 * This creates the correct directory structure and sample Parquet files
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

// Create Parquet file structure
function createParquetStructure(outputDir) {
  log('📝 Creating Parquet file structure for Edge-Native architecture...', 'blue');
  
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
  
  // Create sample data
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
  
  // Create master data files
  fs.writeFileSync(
    path.join(masterDataDir, 'colleges.parquet'),
    JSON.stringify(collegesData, null, 2) // Placeholder - will be converted to actual Parquet
  );
  
  fs.writeFileSync(
    path.join(masterDataDir, 'courses.parquet'),
    JSON.stringify(coursesData, null, 2) // Placeholder - will be converted to actual Parquet
  );
  
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
  
  for (const [stream, config] of Object.entries(streamConfigs)) {
    log(`  📊 Creating ${stream} Parquet files...`, 'cyan');
    
    // Priority rounds (1 & 2)
    const priorityData = config.data.filter(record => [1, 2].includes(record.round));
    const otherData = config.data.filter(record => ![1, 2].includes(record.round));
    
    // Create priority rounds Parquet (placeholder)
    fs.writeFileSync(
      path.join(config.dir, `${stream}_priority_rounds.parquet`),
      JSON.stringify(priorityData, null, 2) // Placeholder - will be converted to actual Parquet
    );
    
    // Create other rounds Parquet (placeholder)
    fs.writeFileSync(
      path.join(config.dir, `${stream}_other_rounds.parquet`),
      JSON.stringify(otherData, null, 2) // Placeholder - will be converted to actual Parquet
    );
    
    log(`    ✅ ${stream}: ${priorityData.length} priority + ${otherData.length} other records`, 'green');
  }
  
  return true;
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
    },
    note: 'These are placeholder files. In production, they will be converted to actual Parquet format using DuckDB.'
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
  log('🚀 Creating Parquet File Structure for Edge-Native Architecture...', 'magenta');
  log('Creating correct structure for Parquet + DuckDB-WASM processing:', 'yellow');
  log('  - Parquet file structure (placeholder files)', 'cyan');
  log('  - DuckDB-WASM for client-side processing', 'cyan');
  log('  - SNAPPY compression for Parquet', 'cyan');
  log('  - Stream-based partitioning', 'cyan');
  
  // Define paths
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  
  // Create Parquet structure
  if (createParquetStructure(outputDir)) {
    log('✅ Parquet file structure created successfully', 'green');
  } else {
    log('❌ Failed to create Parquet file structure', 'red');
    process.exit(1);
  }
  
  // Create production manifest
  const manifestPath = createProductionManifest(outputDir);
  
  // Copy manifest to public directory
  const publicManifestPath = path.join(__dirname, '..', 'public', 'data', 'production_manifest.json');
  fs.copyFileSync(manifestPath, publicManifestPath);
  
  log('\\n🎉 Parquet file structure creation complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
  log(`  - Parquet directory: ${path.join(outputDir, 'parquet')}`, 'cyan');
  log(`  - Manifest: ${publicManifestPath}`, 'cyan');
  
  log('\\n📋 Next Steps:', 'yellow');
  log('1. Convert placeholder files to actual Parquet format', 'cyan');
  log('2. Test Parquet files with DuckDB-WASM', 'cyan');
  log('3. Update services to use Parquet format', 'cyan');
  log('4. Deploy to production', 'cyan');
  
  log('\\n⚠️  Note:', 'yellow');
  log('The current files are placeholders. In production, they need to be converted to actual Parquet format using DuckDB.', 'cyan');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
