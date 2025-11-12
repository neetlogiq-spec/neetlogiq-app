#!/bin/bash

# Cloudflare Setup Script
# One-time setup for optimal architecture with full automation

set -e

echo "🚀 NeetLogIQ - Cloudflare Setup"
echo "================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"
echo ""

# Login to Cloudflare
echo "📝 Logging in to Cloudflare..."
wrangler login

echo ""
echo "📦 Creating R2 Bucket..."
wrangler r2 bucket create neetlogiq-data || echo "✓ Bucket already exists"

echo ""
echo "🗄️  Creating KV Namespaces..."
echo ""
echo "Production KV:"
wrangler kv:namespace create "CACHE"

echo ""
echo "Preview KV:"
wrangler kv:namespace create "CACHE" --preview

echo ""
echo "📬 Creating Queues for data sync..."
wrangler queues create data-sync-queue || echo "✓ Queue already exists"
wrangler queues create data-sync-dlq || echo "✓ Dead letter queue already exists"

echo ""
echo "🔔 Configuring R2 Event Notifications..."
echo "This will trigger automatic cache clearing on data uploads"
echo ""

# Configure R2 to send events to Queue on object creation
wrangler r2 bucket notification create neetlogiq-data \
  --event-type object-create \
  --queue data-sync-queue \
  || echo "✓ Notification already configured"

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 IMPORTANT: Copy the KV namespace IDs above"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Update these files with your KV IDs:"
echo "  • workers/colleges/wrangler.toml"
echo "  • workers/cutoffs/wrangler.toml"
echo "  • workers/comparison/wrangler.toml"
echo "  • workers/data-sync/wrangler.toml"
echo ""
echo "Example:"
echo "  [[kv_namespaces]]"
echo "  binding = \"CACHE\""
echo "  id = \"YOUR_KV_ID_HERE\""
echo "  preview_id = \"YOUR_PREVIEW_KV_ID_HERE\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Update wrangler.toml files with KV IDs"
echo "2. Deploy data-sync Worker:"
echo "   cd workers/data-sync && wrangler deploy"
echo ""
echo "3. Deploy other Workers:"
echo "   cd workers/colleges && wrangler deploy"
echo ""
echo "4. Upload your Parquet data:"
echo "   node scripts/upload-to-r2.js"
echo ""
echo "5. Watch the magic happen! 🎉"
echo "   The cache will clear automatically!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
