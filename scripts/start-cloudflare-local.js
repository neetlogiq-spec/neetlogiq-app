#!/usr/bin/env node

/**
 * Start Cloudflare Workers locally to simulate edge environment
 * This script sets up a local Cloudflare Workers environment
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const WORKER_PORT = 8787;
const NEXTJS_PORT = 3500;
const WORKER_URL = `http://localhost:${WORKER_PORT}`;
const NEXTJS_URL = `http://localhost:${NEXTJS_PORT}`;

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

// Check if Wrangler is installed
function checkWrangler() {
  return new Promise((resolve) => {
    const wrangler = spawn('wrangler', ['--version'], { stdio: 'pipe' });
    
    wrangler.on('close', (code) => {
      if (code === 0) {
        log('✅ Wrangler is installed', 'green');
        resolve(true);
      } else {
        log('❌ Wrangler is not installed. Please install it first:', 'red');
        log('npm install -g wrangler', 'yellow');
        resolve(false);
      }
    });
    
    wrangler.on('error', () => {
      log('❌ Wrangler is not installed. Please install it first:', 'red');
      log('npm install -g wrangler', 'yellow');
      resolve(false);
    });
  });
}

// Start Cloudflare Worker locally
function startWorker() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting Cloudflare Worker locally...', 'blue');
    
    const worker = spawn('wrangler', ['dev', '--port', WORKER_PORT.toString()], {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    let isReady = false;
    
    worker.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('Ready on') && !isReady) {
        isReady = true;
        log(`✅ Cloudflare Worker started on ${WORKER_URL}`, 'green');
        resolve(worker);
      }
    });
    
    worker.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('error') || error.includes('Error')) {
        log(`❌ Worker error: ${error}`, 'red');
      } else {
        console.log(error);
      }
    });
    
    worker.on('close', (code) => {
      if (code !== 0 && !isReady) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
    
    worker.on('error', (error) => {
      reject(error);
    });
  });
}

// Test the worker
async function testWorker() {
  log('🧪 Testing Cloudflare Worker...', 'blue');
  
  try {
    // Test basic connectivity
    const response = await fetch(`${WORKER_URL}/api/performance/`);
    if (response.ok) {
      const data = await response.json();
      log('✅ Worker is responding correctly', 'green');
      log(`📊 Performance metrics: ${JSON.stringify(data, null, 2)}`, 'cyan');
    } else {
      log(`❌ Worker test failed: ${response.status}`, 'red');
    }
  } catch (error) {
    log(`❌ Worker test failed: ${error.message}`, 'red');
  }
}

// Create integration guide
function createIntegrationGuide() {
  const guide = `
# 🌐 Cloudflare Edge-Native Integration Guide

## 🚀 Local Development URLs

- **Cloudflare Worker**: ${WORKER_URL}
- **Next.js App**: ${NEXTJS_URL}
- **Production Test**: ${NEXTJS_URL}/production-test

## 📡 API Endpoints

### Stream Data
- \`GET ${WORKER_URL}/api/streams/{stream}/colleges\`
- \`GET ${WORKER_URL}/api/streams/{stream}/courses\`
- \`GET ${WORKER_URL}/api/streams/{stream}/cutoffs/{round}\`

### Search
- \`GET ${WORKER_URL}/api/search/?q={query}&stream={stream}\`

### Analytics
- \`GET ${WORKER_URL}/api/analytics/{stream}\`

### Performance
- \`GET ${WORKER_URL}/api/performance/\`

### Compression
- \`POST ${WORKER_URL}/api/compression/\`

## 🔧 Integration with Next.js

Update your Next.js app to use the Cloudflare Worker:

\`\`\`typescript
// In your Next.js app
const EDGE_API_URL = '${WORKER_URL}';

// Fetch data from edge
const response = await fetch(\`\${EDGE_API_URL}/api/streams/UG/colleges\`);
const data = await response.json();
\`\`\`

## 🌍 Production Deployment

1. **Deploy to Cloudflare Workers**:
   \`\`\`bash
   wrangler deploy
   \`\`\`

2. **Update environment variables**:
   - Set up KV namespaces
   - Configure D1 databases
   - Set up R2 buckets
   - Configure Vectorize indexes

3. **Update Next.js configuration**:
   - Point to production Cloudflare Worker URL
   - Configure CORS settings
   - Set up monitoring

## 📊 Performance Benefits

- **Edge Processing**: Data processed at edge locations
- **Global CDN**: Fast delivery worldwide
- **Zero Cold Starts**: Always warm workers
- **Automatic Scaling**: Handles traffic spikes
- **Built-in Caching**: KV and R2 caching
- **AI Integration**: Vectorize for semantic search

## 🧪 Testing

Run the production test suite:
\`\`\`bash
curl ${NEXTJS_URL}/production-test
\`\`\`

Test individual endpoints:
\`\`\`bash
# Test performance
curl ${WORKER_URL}/api/performance/

# Test stream data
curl ${WORKER_URL}/api/streams/UG/colleges

# Test search
curl "${WORKER_URL}/api/search/?q=medical&stream=UG"
\`\`\`
`;

  fs.writeFileSync('CLOUDFLARE_INTEGRATION.md', guide);
  log('📝 Integration guide created: CLOUDFLARE_INTEGRATION.md', 'green');
}

// Main execution
async function main() {
  log('🌐 Starting Cloudflare Edge-Native Simulation...', 'magenta');
  
  try {
    // Check if Wrangler is installed
    const wranglerInstalled = await checkWrangler();
    if (!wranglerInstalled) {
      process.exit(1);
    }
    
    // Start the worker
    const worker = await startWorker();
    
    // Wait a moment for the worker to fully start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test the worker
    await testWorker();
    
    // Create integration guide
    createIntegrationGuide();
    
    log('\\n🎉 Cloudflare Edge-Native simulation is running!', 'green');
    log(`\\n📡 Worker URL: ${WORKER_URL}`, 'cyan');
    log(`🌐 Next.js URL: ${NEXTJS_URL}`, 'cyan');
    log(`\\n🧪 Test the integration:`, 'yellow');
    log(`curl ${WORKER_URL}/api/performance/`, 'yellow');
    log(`\\n📝 See CLOUDFLARE_INTEGRATION.md for full integration guide`, 'yellow');
    
    // Keep the process running
    process.on('SIGINT', () => {
      log('\\n🛑 Shutting down Cloudflare Worker...', 'yellow');
      worker.kill();
      process.exit(0);
    });
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };





















