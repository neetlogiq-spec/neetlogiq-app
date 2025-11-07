#!/bin/bash

# 🔄 COMPLETE RE-IMPORT PROCESS
echo "🔄 Starting complete re-import process..."

# Step 1: Backup
echo "📋 Step 1: Creating backup..."
./backup-data.sh

# Step 2: Cleanup  
echo "🗑️ Step 2: Cleaning existing data..."
./cleanup-data.sh

# Step 3: Re-import seat data
echo "🔄 Step 3: Re-importing seat data..."
echo "   📊 Processing medical seat data..."
npx tsx scripts/import-medical-seat-data.ts

echo "   🦷 Processing dental seat data..."  
npx tsx scripts/import-dental-seat-data.ts

echo "   🎓 Processing DNB seat data..."
npx tsx scripts/import-dnb-seat-data.ts

# Step 4: Re-import counselling data
echo "🔄 Step 4: Re-importing counselling data..."
echo "   📋 Processing AIQ 2024 counselling data..."
npx tsx scripts/import-aiq-2024-enhanced.ts

# Step 5: Generate summary
echo "📊 Step 5: Generating import summary..."
npx tsx scripts/generate-final-summary.ts

echo ""
echo "🎉 RE-IMPORT COMPLETED!"
echo "📊 Check the summary report for results"
echo "🌐 View data at: http://localhost:3500/parquet-database-editor"
