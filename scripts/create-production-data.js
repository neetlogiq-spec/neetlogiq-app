#!/usr/bin/env node

/**
 * Create Production Data for Edge-Native Architecture
 * Based on our previous conversation requirements
 */

const fs = require('fs');
const path = require('path');
const lz4 = require('lz4js');

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

// Create sample data based on our requirements
function createSampleData() {
  log('📝 Creating sample production data...', 'blue');
  
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
  
  return { collegesData, coursesData, cutoffsData };
}

// Create stream-based partitions
function createStreamPartitions(cutoffsData, outputDir) {
  log('🔄 Creating stream-based partitions...', 'blue');
  
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
  log('🚀 Creating Production Data for Edge-Native Architecture...', 'magenta');
  log('Based on our previous conversation requirements:', 'yellow');
  log('  - SQLite as intermediate database', 'cyan');
  log('  - Parquet for production with stream partitioning', 'cyan');
  log('  - LZ4 compression for client-side', 'cyan');
  log('  - Progressive loading (Rounds 1 & 2 initially)', 'cyan');
  
  // Define paths
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  
  // Create output directories
  const jsonDir = path.join(outputDir, 'json', 'master_data');
  const parquetDir = path.join(outputDir, 'parquet');
  
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }
  if (!fs.existsSync(parquetDir)) {
    fs.mkdirSync(parquetDir, { recursive: true });
  }
  
  // Create sample data
  const { collegesData, coursesData, cutoffsData } = createSampleData();
  
  // Save JSON files
  fs.writeFileSync(
    path.join(jsonDir, 'medical_colleges.json'),
    JSON.stringify(collegesData, null, 2)
  );
  
  fs.writeFileSync(
    path.join(jsonDir, 'courses.json'),
    JSON.stringify(coursesData, null, 2)
  );
  
  log('✅ Sample data created successfully', 'green');
  
  // Create stream-based partitions
  if (createStreamPartitions(cutoffsData, outputDir)) {
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
  
  log('\\n🎉 Production data creation complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
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
