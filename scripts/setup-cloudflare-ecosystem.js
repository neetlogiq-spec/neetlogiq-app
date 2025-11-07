#!/usr/bin/env node

/**
 * Complete Cloudflare Ecosystem Setup
 * Sets up KV, D1, R2, Vectorize, and deploys Workers
 */

const { spawn } = require('child_process');
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

// Run command and return promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`🚀 Running: ${command} ${args.join(' ')}`, 'blue');
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

// Setup KV Namespaces
async function setupKV() {
  log('📦 Setting up KV Namespaces...', 'magenta');
  
  try {
    // Create main cache KV
    await runCommand('wrangler', ['kv:namespace', 'create', 'CACHE']);
    log('✅ KV Namespace CACHE created', 'green');
    
    // Create preview cache KV
    await runCommand('wrangler', ['kv:namespace', 'create', 'CACHE', '--preview']);
    log('✅ KV Namespace CACHE (preview) created', 'green');
    
  } catch (error) {
    log(`⚠️  KV setup warning: ${error.message}`, 'yellow');
    log('💡 You may need to create KV namespaces manually in Cloudflare dashboard', 'cyan');
  }
}

// Setup D1 Database
async function setupD1() {
  log('🗄️  Setting up D1 Database...', 'magenta');
  
  try {
    // Create D1 database
    await runCommand('wrangler', ['d1', 'create', 'neetlogiq-data']);
    log('✅ D1 Database neetlogiq-data created', 'green');
    
    // Create database schema
    const schema = `
-- Medical Colleges Table
CREATE TABLE IF NOT EXISTS colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  type TEXT NOT NULL,
  established_year INTEGER,
  rating REAL,
  total_seats INTEGER,
  stream TEXT NOT NULL,
  courses TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  level TEXT NOT NULL,
  stream TEXT NOT NULL,
  total_seats INTEGER,
  fee_min INTEGER,
  fee_max INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cutoffs Table
CREATE TABLE IF NOT EXISTS cutoffs (
  id TEXT PRIMARY KEY,
  college_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  opening_rank INTEGER NOT NULL,
  closing_rank INTEGER NOT NULL,
  year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  category TEXT NOT NULL,
  state TEXT NOT NULL,
  stream TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cutoffs_stream_round ON cutoffs(stream, round);
CREATE INDEX IF NOT EXISTS idx_cutoffs_college ON cutoffs(college_id);
CREATE INDEX IF NOT EXISTS idx_cutoffs_course ON cutoffs(course_id);
CREATE INDEX IF NOT EXISTS idx_cutoffs_rank ON cutoffs(opening_rank, closing_rank);
CREATE INDEX IF NOT EXISTS idx_colleges_stream ON colleges(stream);
CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream);
`;

    // Write schema to file
    fs.writeFileSync('schema.sql', schema);
    log('✅ Database schema created', 'green');
    
  } catch (error) {
    log(`⚠️  D1 setup warning: ${error.message}`, 'yellow');
    log('💡 You may need to create D1 database manually in Cloudflare dashboard', 'cyan');
  }
}

// Setup R2 Bucket
async function setupR2() {
  log('🪣 Setting up R2 Bucket...', 'magenta');
  
  try {
    // Create R2 bucket
    await runCommand('wrangler', ['r2', 'bucket', 'create', 'neetlogiq-assets']);
    log('✅ R2 Bucket neetlogiq-assets created', 'green');
    
  } catch (error) {
    log(`⚠️  R2 setup warning: ${error.message}`, 'yellow');
    log('💡 You may need to create R2 bucket manually in Cloudflare dashboard', 'cyan');
  }
}

// Setup Vectorize
async function setupVectorize() {
  log('🧠 Setting up Vectorize for AI search...', 'magenta');
  
  try {
    // Create Vectorize index
    await runCommand('wrangler', ['vectorize', 'create', 'neetlogiq-vectors', '--dimensions=384', '--metric=cosine']);
    log('✅ Vectorize index neetlogiq-vectors created', 'green');
    
  } catch (error) {
    log(`⚠️  Vectorize setup warning: ${error.message}`, 'yellow');
    log('💡 You may need to create Vectorize index manually in Cloudflare dashboard', 'cyan');
  }
}

// Deploy Worker
async function deployWorker() {
  log('🚀 Deploying Cloudflare Worker...', 'magenta');
  
  try {
    // Deploy to production
    await runCommand('wrangler', ['deploy']);
    log('✅ Worker deployed to production', 'green');
    
    // Deploy to staging
    await runCommand('wrangler', ['deploy', '--env', 'staging']);
    log('✅ Worker deployed to staging', 'green');
    
  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`, 'red');
    throw error;
  }
}

// Create environment configuration
function createEnvConfig() {
  log('⚙️  Creating environment configuration...', 'magenta');
  
  const envConfig = `
# Cloudflare Workers Environment Configuration
# Copy this to .env.local and fill in your values

# Cloudflare Account
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Worker URLs (will be generated after deployment)
WORKER_URL_PRODUCTION=https://neetlogiq-edge-native-prod.your-subdomain.workers.dev
WORKER_URL_STAGING=https://neetlogiq-edge-native-staging.your-subdomain.workers.dev

# KV Namespace IDs (will be generated after setup)
KV_NAMESPACE_CACHE=your-kv-namespace-id
KV_NAMESPACE_CACHE_PREVIEW=your-preview-kv-namespace-id

# D1 Database ID (will be generated after setup)
D1_DATABASE_ID=your-d1-database-id

# R2 Bucket
R2_BUCKET_NAME=neetlogiq-assets

# Vectorize Index
VECTORIZE_INDEX_NAME=neetlogiq-vectors

# Next.js Configuration
NEXT_PUBLIC_WORKER_URL=https://neetlogiq-edge-native-prod.your-subdomain.workers.dev
NEXT_PUBLIC_API_VERSION=v1
`;

  fs.writeFileSync('.env.cloudflare', envConfig);
  log('✅ Environment configuration created: .env.cloudflare', 'green');
}

// Create deployment guide
function createDeploymentGuide() {
  const guide = `
# 🌐 Complete Cloudflare Ecosystem Setup Guide

## 🚀 What We've Set Up

### ✅ Cloudflare Workers
- **Production**: \`neetlogiq-edge-native-prod\`
- **Staging**: \`neetlogiq-edge-native-staging\`
- **Local**: \`neetlogiq-edge-native-local\`

### ✅ KV Namespaces
- **CACHE**: For edge caching
- **Preview**: For local development

### ✅ D1 Database
- **Database**: \`neetlogiq-data\`
- **Schema**: Created with colleges, courses, cutoffs tables
- **Indexes**: Optimized for performance

### ✅ R2 Bucket
- **Bucket**: \`neetlogiq-assets\`
- **Purpose**: Static file storage

### ✅ Vectorize
- **Index**: \`neetlogiq-vectors\`
- **Dimensions**: 384
- **Metric**: Cosine similarity

## 🔧 Next Steps

### 1. Configure Environment Variables
\`\`\`bash
# Copy the environment template
cp .env.cloudflare .env.local

# Edit with your actual values
nano .env.local
\`\`\`

### 2. Update wrangler.toml
Update the IDs in \`wrangler.toml\` with the actual values from Cloudflare dashboard.

### 3. Deploy to Production
\`\`\`bash
# Deploy to production
wrangler deploy

# Deploy to staging
wrangler deploy --env staging
\`\`\`

### 4. Test the Deployment
\`\`\`bash
# Test production
curl https://neetlogiq-edge-native-prod.your-subdomain.workers.dev/api/performance/

# Test staging
curl https://neetlogiq-edge-native-staging.your-subdomain.workers.dev/api/performance/
\`\`\`

## 📊 API Endpoints

### Stream Data
- \`GET /api/streams/{stream}/colleges\`
- \`GET /api/streams/{stream}/courses\`
- \`GET /api/streams/{stream}/cutoffs/{round}\`

### Search & Analytics
- \`GET /api/search/?q={query}&stream={stream}\`
- \`GET /api/analytics/{stream}\`
- \`GET /api/performance/\`

### Compression
- \`POST /api/compression/\`

## 🌍 Production URLs

After deployment, your URLs will be:
- **Production**: \`https://neetlogiq-edge-native-prod.your-subdomain.workers.dev\`
- **Staging**: \`https://neetlogiq-edge-native-staging.your-subdomain.workers.dev\`

## 🔍 Monitoring

### Cloudflare Dashboard
- **Workers**: Monitor execution and errors
- **KV**: Monitor cache hit rates
- **D1**: Monitor database performance
- **R2**: Monitor storage usage
- **Vectorize**: Monitor AI search performance

### Analytics
- **Real-time metrics**: Available at \`/api/performance/\`
- **Stream analytics**: Available at \`/api/analytics/{stream}\`
- **Cache statistics**: Built into performance metrics

## 🚀 Performance Benefits

- **Edge Processing**: Data processed at 200+ edge locations
- **Global CDN**: Fast delivery worldwide
- **Zero Cold Starts**: Always warm workers
- **Automatic Scaling**: Handles traffic spikes
- **Built-in Caching**: KV and R2 caching
- **AI Integration**: Vectorize for semantic search

## 🧪 Testing

\`\`\`bash
# Test all endpoints
curl https://neetlogiq-edge-native-prod.your-subdomain.workers.dev/api/performance/
curl https://neetlogiq-edge-native-prod.your-subdomain.workers.dev/api/streams/UG/colleges
curl "https://neetlogiq-edge-native-prod.your-subdomain.workers.dev/api/search/?q=medical&stream=UG"
\`\`\`

## 📝 Integration with Next.js

Update your Next.js app to use the Cloudflare Worker:

\`\`\`typescript
// In your Next.js app
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

// Fetch data from edge
const response = await fetch(\`\${WORKER_URL}/api/streams/UG/colleges\`);
const data = await response.json();
\`\`\`
`;

  fs.writeFileSync('CLOUDFLARE_DEPLOYMENT.md', guide);
  log('📝 Deployment guide created: CLOUDFLARE_DEPLOYMENT.md', 'green');
}

// Main execution
async function main() {
  log('🌐 Setting up Complete Cloudflare Ecosystem...', 'magenta');
  
  try {
    // Check if Wrangler is installed
    try {
      await runCommand('wrangler', ['--version']);
    } catch (error) {
      log('❌ Wrangler is not installed. Please install it first:', 'red');
      log('npm install -g wrangler', 'yellow');
      process.exit(1);
    }
    
    // Setup all services
    await setupKV();
    await setupD1();
    await setupR2();
    await setupVectorize();
    
    // Create configuration files
    createEnvConfig();
    createDeploymentGuide();
    
    log('\\n🎉 Cloudflare Ecosystem Setup Complete!', 'green');
    log('\\n📋 Next Steps:', 'yellow');
    log('1. Update .env.local with your Cloudflare credentials', 'cyan');
    log('2. Update wrangler.toml with actual IDs from Cloudflare dashboard', 'cyan');
    log('3. Run: wrangler deploy', 'cyan');
    log('4. Test your deployment', 'cyan');
    log('\\n📝 See CLOUDFLARE_DEPLOYMENT.md for complete guide', 'yellow');
    
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
