#!/usr/bin/env node

/**
 * Upload Parquet files to Cloudflare R2
 *
 * Usage: node scripts/upload-to-r2.js [file]
 * Example: node scripts/upload-to-r2.js data/colleges.parquet
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = 'neetlogiq-data';

// Files to upload
const filesToUpload = process.argv[2]
  ? [process.argv[2]]
  : [
      'data/colleges.parquet',
      'data/cutoffs.parquet',
      'data/courses.parquet',
    ];

console.log('📤 Uploading files to R2...\n');

filesToUpload.forEach((filePath) => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return;
  }

  const fileName = path.basename(filePath);
  const remotePath = `data/${fileName}`;

  try {
    console.log(`Uploading ${fileName}...`);

    execSync(
      `wrangler r2 object put ${BUCKET_NAME}/${remotePath} --file="${filePath}"`,
      { stdio: 'inherit' }
    );

    console.log(`✅ Uploaded ${fileName} → ${remotePath}\n`);
  } catch (error) {
    console.error(`❌ Failed to upload ${fileName}:`, error.message);
  }
});

console.log('✅ Upload complete!\n');
console.log('The data-sync Worker will automatically clear caches.');
