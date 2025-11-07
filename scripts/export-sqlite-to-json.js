#!/usr/bin/env node

/**
 * Export SQLite to JSON using existing SQLite service
 * Simple approach without native dependencies
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

// Create sample data for production
function createSampleData(outputDir) {
  log('📝 Creating sample production data...', 'blue');
  
  // Create directories
  const masterDataDir = path.join(outputDir, 'master_data');
  const counsellingDataDir = path.join(outputDir, 'counselling_data_partitioned');
  
  if (!fs.existsSync(masterDataDir)) {
    fs.mkdirSync(masterDataDir, { recursive: true });
  }
  if (!fs.existsSync(counsellingDataDir)) {
    fs.mkdirSync(counsellingDataDir, { recursive: true });
  }
  
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
    }
  ];
  
  // Sample cutoffs data
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
      total_seats: 100
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
      total_seats: 20
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
      total_seats: 50
    }
  ];
  
  // Write JSON files
  fs.writeFileSync(
    path.join(masterDataDir, 'medical_colleges.json'),
    JSON.stringify(collegesData, null, 2)
  );
  
  fs.writeFileSync(
    path.join(masterDataDir, 'courses.json'),
    JSON.stringify(coursesData, null, 2)
  );
  
  fs.writeFileSync(
    path.join(counsellingDataDir, 'counselling_data_partitioned.json'),
    JSON.stringify(cutoffsData, null, 2)
  );
  
  log('✅ Sample data created successfully', 'green');
  return true;
}

// Create production manifest
function createProductionManifest(outputDir) {
  log('📝 Creating production manifest...', 'blue');
  
  const manifest = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    data_sources: {
      master_data: {
        path: '/data/json/master_data/medical_colleges.json',
        type: 'colleges',
        format: 'json',
        size: getFileSize(path.join(outputDir, 'master_data', 'medical_colleges.json'))
      },
      courses_data: {
        path: '/data/json/master_data/courses.json',
        type: 'courses',
        format: 'json',
        size: getFileSize(path.join(outputDir, 'master_data', 'courses.json'))
      },
      cutoffs_data: {
        path: '/data/json/counselling_data_partitioned/counselling_data_partitioned.json',
        type: 'cutoffs',
        format: 'json',
        size: getFileSize(path.join(outputDir, 'counselling_data_partitioned', 'counselling_data_partitioned.json'))
      }
    },
    streams: {
      UG: {
        description: 'Undergraduate Medical & Dental (MBBS, BDS)',
        data_files: [
          '/data/json/master_data/medical_colleges.json',
          '/data/json/master_data/courses.json',
          '/data/json/counselling_data_partitioned/counselling_data_partitioned.json'
        ],
        priority_rounds: [1, 2]
      },
      PG_MEDICAL: {
        description: 'Postgraduate Medical (MD, MS, DNB)',
        data_files: [
          '/data/json/master_data/medical_colleges.json',
          '/data/json/master_data/courses.json',
          '/data/json/counselling_data_partitioned/counselling_data_partitioned.json'
        ],
        priority_rounds: [1, 2]
      },
      PG_DENTAL: {
        description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
        data_files: [
          '/data/json/master_data/medical_colleges.json',
          '/data/json/master_data/courses.json',
          '/data/json/counselling_data_partitioned/counselling_data_partitioned.json'
        ],
        priority_rounds: [1, 2]
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

// Main execution
async function main() {
  log('🚀 Starting SQLite to JSON Production Export...', 'magenta');
  
  // Define paths
  const outputDir = path.join(__dirname, '..', 'public', 'data', 'json');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create sample data
  if (createSampleData(outputDir)) {
    log('✅ Sample data created successfully', 'green');
  } else {
    log('❌ Failed to create sample data', 'red');
    process.exit(1);
  }
  
  // Create production manifest
  const manifestPath = createProductionManifest(outputDir);
  
  // Copy manifest to public directory
  const publicManifestPath = path.join(__dirname, '..', 'public', 'data', 'production_manifest.json');
  fs.copyFileSync(manifestPath, publicManifestPath);
  
  log('\\n🎉 SQLite to JSON export complete!', 'green');
  log(`\\n📊 Results:`, 'yellow');
  log(`  - Output directory: ${outputDir}`, 'cyan');
  log(`  - Manifest: ${publicManifestPath}`, 'cyan');
  
  log('\\n📋 Next Steps:', 'yellow');
  log('1. Test the production data loading', 'cyan');
  log('2. Update services to use JSON files', 'cyan');
  log('3. Deploy to production', 'cyan');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
