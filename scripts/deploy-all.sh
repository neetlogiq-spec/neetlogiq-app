#!/bin/bash

# Deploy All - Workers + Frontend

set -e

echo "🚀 NeetLogIQ - Complete Deployment"
echo "===================================="
echo ""

# Deploy Workers
echo "📦 Deploying Workers..."
echo ""

cd workers/colleges
echo "Deploying colleges API..."
npm install
wrangler deploy
cd ../..

echo ""
echo "✅ Workers deployed!"
echo ""

# Build and deploy frontend
echo "🎨 Building Frontend..."
npm run build

echo ""
echo "📤 Deploying to Cloudflare Pages..."
wrangler pages deploy out --project-name=neetlogiq

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your site is live at:"
echo "   https://neetlogiq.pages.dev"
echo ""
