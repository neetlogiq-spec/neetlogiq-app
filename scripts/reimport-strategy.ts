#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

interface ReimportStrategy {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  steps: string[];
  recommended: boolean;
}

class ReimportStrategyManager {
  
  getReimportStrategies(): ReimportStrategy[] {
    return [
      {
        name: "🔄 CLEAN SLATE RE-IMPORT (RECOMMENDED)",
        description: "Backup existing data, clear Parquet files, and do fresh import with corrected data",
        recommended: true,
        pros: [
          "✅ Clean start with corrected data",
          "✅ No data conflicts or inconsistencies", 
          "✅ Enhanced matcher will create optimal relationships",
          "✅ Easy to verify results",
          "✅ Backup available for rollback"
        ],
        cons: [
          "⚠️ Temporary data unavailability during import",
          "⚠️ Need to backup existing data first"
        ],
        steps: [
          "1. 📋 Create backup of current Parquet files",
          "2. 🗑️ Clear existing Parquet files", 
          "3. 🔄 Re-import seat data (medical, dental, DNB)",
          "4. 🔄 Re-import counselling data (AIQ 2024)",
          "5. 📊 Verify improved match rates",
          "6. 🧪 Test sample relationships"
        ]
      },
      {
        name: "➕ INCREMENTAL UPDATE",
        description: "Keep existing data, import corrections, and merge intelligently",
        recommended: false,
        pros: [
          "✅ No downtime",
          "✅ Preserves existing relationships where possible"
        ],
        cons: [
          "❌ Complex data merging logic required",
          "❌ Risk of data inconsistencies",
          "❌ Harder to verify correctness",
          "❌ May not achieve optimal match rates"
        ],
        steps: [
          "1. 📊 Import corrected data to temporary tables",
          "2. 🔍 Identify conflicts and duplicates",
          "3. 🔄 Merge data intelligently",
          "4. 🧹 Clean up inconsistencies"
        ]
      },
      {
        name: "🧪 PARALLEL IMPORT & COMPARE",
        description: "Import to separate location, compare results, then switch",
        recommended: false,
        pros: [
          "✅ Zero downtime",
          "✅ Full comparison possible",
          "✅ Easy rollback"
        ],
        cons: [
          "❌ Requires double storage space",
          "❌ More complex setup",
          "❌ Longer process"
        ],
        steps: [
          "1. 📁 Create parallel data directory",
          "2. 🔄 Import all data to parallel location",
          "3. 📊 Compare old vs new results",
          "4. 🔄 Switch to new data when satisfied"
        ]
      }
    ];
  }
  
  displayStrategies(): void {
    console.log('🔄 RE-IMPORT STRATEGY OPTIONS');
    console.log('=============================');
    
    const strategies = this.getReimportStrategies();
    
    strategies.forEach((strategy, index) => {
      console.log(`\\n${strategy.name}`);
      if (strategy.recommended) {
        console.log('⭐ RECOMMENDED APPROACH');
      }
      console.log(`📖 ${strategy.description}`);
      
      console.log('\\n✅ Pros:');
      strategy.pros.forEach(pro => console.log(`   ${pro}`));
      
      console.log('\\n⚠️ Cons:');
      strategy.cons.forEach(con => console.log(`   ${con}`));
      
      console.log('\\n📋 Steps:');
      strategy.steps.forEach(step => console.log(`   ${step}`));
      
      console.log('\\n' + '='.repeat(50));
    });
  }
  
  generateBackupScript(): string {
    return `#!/bin/bash

# 📋 BACKUP CURRENT PARQUET FILES
echo "🔄 Creating backup of current Parquet files..."

BACKUP_DIR="data/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup Parquet files
cp data/parquet/*.parquet "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ Some Parquet files may not exist"

# Backup reports
cp -r data/reports "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ Reports directory may not exist"

echo "✅ Backup created at: $BACKUP_DIR"
echo "📁 Files backed up:"
ls -la "$BACKUP_DIR/"

echo ""
echo "🔄 Ready for re-import!"
echo "To restore if needed: cp $BACKUP_DIR/*.parquet data/parquet/"
`;
  }
  
  generateCleanupScript(): string {
    return `#!/bin/bash

# 🗑️ CLEAN EXISTING PARQUET FILES
echo "🗑️ Cleaning existing Parquet files..."

# Remove existing Parquet files
rm -f data/parquet/colleges.parquet
rm -f data/parquet/programs.parquet  
rm -f data/parquet/cutoffs.parquet
rm -f data/parquet/seat_data.parquet

# Remove old reports
rm -rf data/reports/unmatched-*

echo "✅ Cleanup completed"
echo "📁 Ready for fresh import"
`;
  }
  
  generateReimportScript(): string {
    return `#!/bin/bash

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
`;
  }
  
  async createScripts(): Promise<void> {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    
    // Create backup script
    const backupScript = this.generateBackupScript();
    fs.writeFileSync(path.join(scriptsDir, 'backup-data.sh'), backupScript);
    fs.chmodSync(path.join(scriptsDir, 'backup-data.sh'), 0o755);
    
    // Create cleanup script
    const cleanupScript = this.generateCleanupScript();
    fs.writeFileSync(path.join(scriptsDir, 'cleanup-data.sh'), cleanupScript);
    fs.chmodSync(path.join(scriptsDir, 'cleanup-data.sh'), 0o755);
    
    // Create complete reimport script
    const reimportScript = this.generateReimportScript();
    fs.writeFileSync(path.join(scriptsDir, 'complete-reimport.sh'), reimportScript);
    fs.chmodSync(path.join(scriptsDir, 'complete-reimport.sh'), 0o755);
    
    console.log('✅ Re-import scripts created:');
    console.log('   📋 scripts/backup-data.sh');
    console.log('   🗑️ scripts/cleanup-data.sh'); 
    console.log('   🔄 scripts/complete-reimport.sh');
  }
}

async function main() {
  const manager = new ReimportStrategyManager();
  
  manager.displayStrategies();
  
  console.log('\\n🛠️ CREATING RE-IMPORT SCRIPTS...');
  await manager.createScripts();
  
  console.log('\\n🎯 RECOMMENDED NEXT STEPS:');
  console.log('1. 📋 Review the strategy options above');
  console.log('2. 🔄 Run: ./scripts/complete-reimport.sh');
  console.log('3. 📊 Monitor progress and verify results');
  console.log('4. 🌐 Check improved data at: http://localhost:3500/parquet-database-editor');
}

if (require.main === module) {
  main();
}

export { ReimportStrategyManager };
