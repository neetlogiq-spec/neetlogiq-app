#!/usr/bin/env node

/**
 * AutoRAG Setup Script for NeetLogIQ
 * Sets up Cloudflare AutoRAG integration
 */

const fs = require('fs');
const path = require('path');

console.log('🤖 Setting up NeetLogIQ AutoRAG...\n');

// Check environment variables
const envPath = path.join(process.cwd(), '.env.local');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  console.log('⚠️ .env.local not found. Creating template...');
  envContent = `# NeetLogIQ Environment Configuration

# AutoRAG Configuration
NEXT_PUBLIC_AUTORAG_URL=https://api.cloudflare.com/client/v4/accounts
NEXT_PUBLIC_AUTORAG_API_KEY=your_cloudflare_api_key
NEXT_PUBLIC_AUTORAG_INDEX=neetlogiq-vectors
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id

# Database Configuration
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=neetlogiq-data
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3500
`;
}

// Check if AutoRAG configuration is complete
const hasAutoRAGConfig = envContent.includes('NEXT_PUBLIC_AUTORAG_API_KEY') && 
                        envContent.includes('NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID');

if (!hasAutoRAGConfig) {
  console.log('📝 Adding AutoRAG configuration to environment file...');
  
  if (!envContent.includes('NEXT_PUBLIC_AUTORAG_URL')) {
    envContent += '\n# AutoRAG Configuration\n';
    envContent += 'NEXT_PUBLIC_AUTORAG_URL=https://api.cloudflare.com/client/v4/accounts\n';
    envContent += 'NEXT_PUBLIC_AUTORAG_API_KEY=your_cloudflare_api_key\n';
    envContent += 'NEXT_PUBLIC_AUTORAG_INDEX=neetlogiq-vectors\n';
    envContent += 'NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id\n';
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ AutoRAG configuration added to .env.local');
}

// Create AutoRAG test script
const testScript = `#!/usr/bin/env node

/**
 * AutoRAG Test Script
 * Tests the AutoRAG integration
 */

const { autoRAGService } = require('../src/services/autorag');

async function testAutoRAG() {
  console.log('🧪 Testing AutoRAG integration...\n');
  
  try {
    // Test search
    console.log('1. Testing search functionality...');
    const searchResult = await autoRAGService.search({
      query: 'AIIMS Delhi MBBS',
      filters: { stream: 'Medical' }
    });
    
    console.log('✅ Search test passed');
    console.log(\`   - Found \${searchResult.total_results} results\`);
    console.log(\`   - Search time: \${searchResult.search_time}ms\`);
    
    // Test suggestions
    console.log('\\n2. Testing suggestions...');
    const suggestions = await autoRAGService.getSuggestions('medical colleges');
    console.log('✅ Suggestions test passed');
    console.log(\`   - Generated \${suggestions.length} suggestions\`);
    
    // Test recommendations
    console.log('\\n3. Testing recommendations...');
    const recommendations = await autoRAGService.getRecommendations({
      stream: 'Medical',
      state: 'Delhi'
    });
    console.log('✅ Recommendations test passed');
    console.log(\`   - Generated \${recommendations.total_results} recommendations\`);
    
    console.log('\\n🎉 All AutoRAG tests passed!');
    
  } catch (error) {
    console.error('❌ AutoRAG test failed:', error.message);
    console.log('\\n💡 Make sure to:');
    console.log('1. Set up your Cloudflare API key in .env.local');
    console.log('2. Configure your Cloudflare account ID');
    console.log('3. Set up Vectorize index');
  }
}

testAutoRAG();
`;

const testScriptPath = path.join(process.cwd(), 'scripts', 'test-autorag.js');
fs.writeFileSync(testScriptPath, testScript);
fs.chmodSync(testScriptPath, '755');

console.log('✅ AutoRAG test script created: scripts/test-autorag.js');

// Create Vectorize setup guide
const vectorizeGuide = `# Cloudflare Vectorize Setup Guide

## 1. Create Vectorize Index

\`\`\`bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create Vectorize index
wrangler vectorize create neetlogiq-vectors --dimensions=768 --metric=cosine
\`\`\`

## 2. Upload Data to Vectorize

\`\`\`bash
# Create embeddings for your data
node scripts/create-embeddings.js

# Upload to Vectorize
wrangler vectorize insert neetlogiq-vectors --file=embeddings.json
\`\`\`

## 3. Test Integration

\`\`\`bash
# Run AutoRAG tests
node scripts/test-autorag.js
\`\`\`

## 4. Environment Variables

Make sure these are set in your .env.local:

\`\`\`
NEXT_PUBLIC_AUTORAG_URL=https://api.cloudflare.com/client/v4/accounts
NEXT_PUBLIC_AUTORAG_API_KEY=your_cloudflare_api_key
NEXT_PUBLIC_AUTORAG_INDEX=neetlogiq-vectors
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id
\`\`\`

## 5. Production Deployment

For production, make sure to:
- Set up proper API keys
- Configure Vectorize index
- Set up R2 storage for data
- Configure proper CORS settings
`;

const guidePath = path.join(process.cwd(), 'docs', 'AUTORAG-SETUP.md');
const docsDir = path.join(process.cwd(), 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
fs.writeFileSync(guidePath, vectorizeGuide);

console.log('✅ AutoRAG setup guide created: docs/AUTORAG-SETUP.md');

console.log('\n🎉 AutoRAG setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Get your Cloudflare API key from: https://dash.cloudflare.com/profile/api-tokens');
console.log('2. Get your Cloudflare Account ID from: https://dash.cloudflare.com/');
console.log('3. Update .env.local with your credentials');
console.log('4. Create Vectorize index: wrangler vectorize create neetlogiq-vectors --dimensions=768 --metric=cosine');
console.log('5. Test integration: node scripts/test-autorag.js');
console.log('\n🚀 Ready for AI-powered search!');
