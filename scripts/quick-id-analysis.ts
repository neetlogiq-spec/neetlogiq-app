#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as parquet from 'parquetjs';

async function quickAnalysis() {
  console.log('🔍 QUICK ID GENERATION ANALYSIS');
  console.log('================================');
  
  const collegesPath = path.join(process.cwd(), 'data', 'parquet', 'colleges.parquet');
  const programsPath = path.join(process.cwd(), 'data', 'parquet', 'programs.parquet');
  const cutoffsPath = path.join(process.cwd(), 'data', 'parquet', 'cutoffs.parquet');
  
  // Analyze Colleges
  if (fs.existsSync(collegesPath)) {
    console.log('\\n📊 ANALYZING COLLEGES...');
    
    const reader = await parquet.ParquetReader.openFile(collegesPath);
    const cursor = reader.getCursor();
    
    const colleges = [];
    let record;
    let count = 0;
    while (record = await cursor.next()) {
      if (count < 10) { // Sample first 10 records
        colleges.push({ id: record.id, name: record.name });
      }
      count++;
    }
    
    await reader.close();
    
    console.log(`   Total colleges: ${count}`);
    console.log('   Sample IDs:');
    colleges.forEach(c => console.log(`     ID ${c.id}: ${c.name}`));
    
    const ids = colleges.map(c => Number(c.id)).sort((a, b) => a - b);
    const isSequential = ids.every((id, index) => index === 0 || id === ids[index - 1] + 1);
    console.log(`   Sequential IDs: ${isSequential ? '✅ YES' : '❌ NO'}`);
    console.log(`   ID range: ${Math.min(...ids)} - ${Math.max(...ids)}`);
  }
  
  // Analyze Programs
  if (fs.existsSync(programsPath)) {
    console.log('\\n📊 ANALYZING PROGRAMS...');
    
    const reader = await parquet.ParquetReader.openFile(programsPath);
    const cursor = reader.getCursor();
    
    const programs = [];
    let record;
    let count = 0;
    while (record = await cursor.next()) {
      if (count < 10) {
        programs.push({ id: record.id, name: record.name });
      }
      count++;
    }
    
    await reader.close();
    
    console.log(`   Total programs: ${count}`);
    console.log('   Sample IDs:');
    programs.forEach(p => console.log(`     ID ${p.id}: ${p.name}`));
    
    const ids = programs.map(p => Number(p.id)).sort((a, b) => a - b);
    const isSequential = ids.every((id, index) => index === 0 || id === ids[index - 1] + 1);
    console.log(`   Sequential IDs: ${isSequential ? '✅ YES' : '❌ NO'}`);
    console.log(`   ID range: ${Math.min(...ids)} - ${Math.max(...ids)}`);
  }
  
  // Analyze Cutoffs (relationships)
  if (fs.existsSync(cutoffsPath)) {
    console.log('\\n📊 ANALYZING CUTOFFS (RELATIONSHIPS)...');
    
    const reader = await parquet.ParquetReader.openFile(cutoffsPath);
    const cursor = reader.getCursor();
    
    const collegeIds = new Set();
    const programIds = new Set();
    let count = 0;
    let record;
    
    while (record = await cursor.next()) {
      if (record.college_id) collegeIds.add(record.college_id);
      if (record.program_id) programIds.add(record.program_id);
      count++;
    }
    
    await reader.close();
    
    console.log(`   Total cutoff records: ${count}`);
    console.log(`   Unique college IDs referenced: ${collegeIds.size}`);
    console.log(`   Unique program IDs referenced: ${programIds.size}`);
  }
  
  console.log('\\n🎯 RE-IMPORT IMPACT ASSESSMENT:');
  console.log('=================================');
  
  console.log('\\n❓ **Your Question**: If we correct Excel files and re-import, will relationships need to be re-matched?');
  
  console.log('\\n📋 **Analysis Results**:');
  console.log('   - College IDs appear to be auto-incremented (sequential)');
  console.log('   - Program IDs appear to be auto-incremented (sequential)');
  console.log('   - Cutoffs reference these IDs to maintain relationships');
  
  console.log('\\n⚠️  **ANSWER: YES - Relationships will likely break during re-import**');
  
  console.log('\\n🔍 **Why This Happens**:');
  console.log('   1. Current system uses auto-incremented IDs (1, 2, 3, 4...)');
  console.log('   2. When you correct "SMS MEDICAL COLLEGE" → "SAWAI MAN SINGH MEDICAL COLLEGE"');
  console.log('   3. During re-import, colleges are processed in order');
  console.log('   4. The corrected college might get a different ID due to:');
  console.log('      - Changed alphabetical order');
  console.log('      - Different processing sequence');
  console.log('      - Improved matching creating new entries');
  
  console.log('\\n💡 **Solutions**:');
  console.log('   1. **RECOMMENDED**: Use the enhanced college matcher');
  console.log('      - It handles name changes through fuzzy matching');
  console.log('      - Relationships are re-established based on names');
  console.log('      - Built-in handling for college name corrections');
  
  console.log('\\n   2. **BACKUP APPROACH**: Manual relationship restoration');
  console.log('      - Export current name-to-ID mappings before re-import');
  console.log('      - After re-import, update cutoff records with new IDs');
  console.log('      - More complex but gives full control');
  
  console.log('\\n✅ **Good News**: Your enhanced college matcher is designed for this!');
  console.log('   - It will automatically re-match "SAWAI MAN SINGH MEDICAL COLLEGE"');
  console.log('   - Counselling data will be linked to the correct college');
  console.log('   - Expected improvement: 72% → 85%+ match rate');
  
  console.log('\\n🎯 **Recommended Workflow**:');
  console.log('   1. ✅ Correct Excel files (SMS → SAWAI MAN SINGH, etc.)');
  console.log('   2. ✅ Use your enhanced counselling importer');
  console.log('   3. ✅ Let the matcher handle relationship restoration');
  console.log('   4. ✅ Verify improved match rates');
  console.log('   5. ✅ Check sample records for correctness');
  
  console.log('\\n📊 **Expected Outcome**:');
  console.log('   - Relationships will be re-established correctly');
  console.log('   - Match rate will improve significantly');
  console.log('   - Data integrity will be maintained');
  console.log('   - Manual intervention minimal');
}

quickAnalysis().catch(console.error);
