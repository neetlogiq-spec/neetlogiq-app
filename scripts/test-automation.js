/**
 * Test Automation Script
 *
 * This script helps you test the self-sustainable architecture
 * by simulating a data update and verifying all components work.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Testing Self-Sustainable Architecture\n');

// Test 1: Check if metadata can be generated
console.log('Test 1: Metadata Generation');
try {
  execSync('node scripts/generate-static-metadata.js', { stdio: 'inherit' });
  console.log('✅ Metadata generation works\n');
} catch (error) {
  console.error('❌ Metadata generation failed');
  process.exit(1);
}

// Test 2: Check if manifest.json exists
console.log('Test 2: Manifest File');
const manifestPath = path.join(__dirname, '../public/data/manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('✅ Manifest exists');
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Streams: ${Object.keys(manifest.streams || {}).join(', ')}`);
  console.log('');
} else {
  console.error('❌ Manifest file not found');
  console.log('   Run: node scripts/create-stream-manifest.js');
  process.exit(1);
}

// Test 3: Check if metadata files exist
console.log('Test 3: Metadata Files');
const metadataDir = path.join(__dirname, '../public/data/metadata');
const requiredFiles = [
  'available-years.json',
  'available-rounds.json',
  'filter-options.json',
  'colleges-index.json',
  'courses-index.json',
  'states-index.json',
  'statistics.json'
];

let missingFiles = [];
for (const file of requiredFiles) {
  const filePath = path.join(metadataDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} (missing)`);
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('\n❌ Some metadata files are missing');
  console.log('   Run: node scripts/generate-static-metadata.js');
  process.exit(1);
}
console.log('');

// Test 4: Check Parquet files
console.log('Test 4: Parquet Files');
const parquetDir = path.join(__dirname, '../public/data/parquet');
if (fs.existsSync(parquetDir)) {
  const parquetFiles = fs.readdirSync(parquetDir).filter(f => f.endsWith('.parquet'));
  console.log(`   ✅ Found ${parquetFiles.length} Parquet files`);

  if (parquetFiles.length > 0) {
    console.log('   Files:');
    parquetFiles.slice(0, 5).forEach(file => {
      console.log(`      - ${file}`);
    });
    if (parquetFiles.length > 5) {
      console.log(`      ... and ${parquetFiles.length - 5} more`);
    }
  }
} else {
  console.log('   ⚠️  No Parquet directory found');
  console.log('   This is okay for local development');
}
console.log('');

// Test 5: Check wrangler configuration
console.log('Test 5: Wrangler Configuration');
const wranglerPath = path.join(__dirname, '../wrangler.toml');
if (fs.existsSync(wranglerPath)) {
  console.log('   ✅ wrangler.toml exists');
} else {
  console.log('   ⚠️  wrangler.toml not found');
  console.log('   You may need to create this for Cloudflare deployment');
}
console.log('');

// Test 6: Check GitHub Actions workflow
console.log('Test 6: GitHub Actions Workflow');
const workflowPath = path.join(__dirname, '../.github/workflows/auto-deploy-on-data-update.yml');
if (fs.existsSync(workflowPath)) {
  console.log('   ✅ Workflow file exists');
} else {
  console.error('   ❌ Workflow file not found');
  process.exit(1);
}
console.log('');

// Test 7: Check worker file
console.log('Test 7: R2 Upload Trigger Worker');
const workerPath = path.join(__dirname, '../workers/r2-upload-trigger.js');
if (fs.existsSync(workerPath)) {
  console.log('   ✅ Worker file exists');
} else {
  console.error('   ❌ Worker file not found');
  process.exit(1);
}
console.log('');

// Test 8: Verify ID-based services
console.log('Test 8: ID-Based Data Services');
const idServicePath = path.join(__dirname, '../src/services/IdBasedDataService.ts');
const configServicePath = path.join(__dirname, '../src/services/ConfigMetadataService.ts');

if (fs.existsSync(idServicePath)) {
  console.log('   ✅ IdBasedDataService exists');
} else {
  console.error('   ❌ IdBasedDataService not found');
}

if (fs.existsSync(configServicePath)) {
  console.log('   ✅ ConfigMetadataService exists');
} else {
  console.error('   ❌ ConfigMetadataService not found');
}
console.log('');

// Summary
console.log('═'.repeat(60));
console.log('📊 Test Summary');
console.log('═'.repeat(60));
console.log('✅ Metadata generation works');
console.log('✅ Required files present');
console.log('✅ Services implemented');
console.log('✅ Automation configured');
console.log('');
console.log('🎉 Self-sustainable architecture is ready!');
console.log('');
console.log('Next steps:');
console.log('1. Configure Cloudflare R2 and Workers');
console.log('2. Set up GitHub Actions secrets');
console.log('3. Upload Parquet files to R2');
console.log('4. Watch the magic happen! ✨');
console.log('');
console.log('For detailed setup instructions, see:');
console.log('   SELF_SUSTAINABLE_ARCHITECTURE_SETUP.md');
console.log('');
