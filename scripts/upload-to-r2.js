#!/usr/bin/env node

/**
 * Upload Parquet files to Cloudflare R2
 *
 * This will automatically trigger cache invalidation via R2 events!
 *
 * Usage:
 *   node scripts/upload-to-r2.js                    # Upload all files
 *   node scripts/upload-to-r2.js data/cutoffs.parquet   # Upload specific file
 *
 * Flow after upload:
 *   1. R2 detects file upload
 *   2. R2 sends event to Queue
 *   3. data-sync Worker processes event
 *   4. Worker clears relevant cache keys
 *   5. Next API request gets fresh data
 *
 * Total time: ~10-15 seconds
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = 'neetlogiq-data';

// Files to upload (if not specified)
const DEFAULT_FILES = [
  'data/colleges.parquet',
  'data/cutoffs.parquet',
  'data/courses.parquet',
];

// Get files to upload
const filesToUpload = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : DEFAULT_FILES;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📤 Uploading files to Cloudflare R2');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`Bucket: ${BUCKET_NAME}`);
console.log(`Files: ${filesToUpload.length}`);
console.log('');

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

filesToUpload.forEach((filePath, index) => {
  console.log(`[${index + 1}/${filesToUpload.length}] Processing: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found, skipping\n`);
    skipCount++;
    return;
  }

  // Get file size
  const stats = fs.statSync(filePath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`   📊 Size: ${fileSizeMB} MB`);

  const fileName = path.basename(filePath);
  const remotePath = `data/${fileName}`;

  try {
    console.log(`   ⬆️  Uploading to ${remotePath}...`);

    // Upload to R2
    execSync(
      `wrangler r2 object put ${BUCKET_NAME}/${remotePath} --file="${filePath}"`,
      { stdio: 'pipe' }
    );

    console.log(`   ✅ Upload complete`);
    console.log(`   🔔 R2 event triggered → Queue → data-sync Worker`);
    console.log(`   🗑️  Cache will clear automatically in ~10-15 seconds\n`);

    successCount++;
  } catch (error) {
    console.error(`   ❌ Upload failed: ${error.message}\n`);
    errorCount++;
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Uploaded: ${successCount}`);
console.log(`⚠️  Skipped: ${skipCount}`);
console.log(`❌ Errors: ${errorCount}`);
console.log('');

if (successCount > 0) {
  console.log('🎉 Success!');
  console.log('');
  console.log('What happens next:');
  console.log('  1. R2 event notification sent to Queue (~2s)');
  console.log('  2. data-sync Worker processes event (~3s)');
  console.log('  3. Relevant cache keys cleared (~5s)');
  console.log('  4. Next API request fetches fresh data');
  console.log('');
  console.log('Total delay: ~10-15 seconds');
  console.log('');
  console.log('To verify cache was cleared:');
  console.log(`  wrangler tail neetlogiq-data-sync`);
  console.log('');
  console.log('To monitor Worker logs:');
  console.log(`  wrangler tail neetlogiq-colleges-api`);
  console.log('');
}

if (errorCount > 0) {
  console.log('⚠️  Some uploads failed. Check the errors above.');
  process.exit(1);
}
