#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as parquet from 'parquetjs';

interface IDAnalysis {
  table: string;
  totalRecords: number;
  idRange: { min: number; max: number };
  idGeneration: 'sequential' | 'hash-based' | 'name-based' | 'unknown';
  nameToIdMapping: Map<string, number>;
  duplicateNames: string[];
  analysis: string;
}

class IDGenerationAnalyzer {
  
  async analyzeCollegeIDs(): Promise<IDAnalysis> {
    const collegesPath = path.join(process.cwd(), 'data', 'parquet', 'colleges.parquet');
    
    if (!fs.existsSync(collegesPath)) {
      throw new Error('colleges.parquet not found');
    }

    console.log('📊 Analyzing College ID Generation...');
    
    const reader = await parquet.ParquetReader.openFile(collegesPath);
    const cursor = reader.getCursor();
    const colleges = [];
    let record = null;
    while (record = await cursor.next()) {
      colleges.push(record);
    }
    await reader.close();
    
    const nameToIdMapping = new Map<string, number>();
    const duplicateNames: string[] = [];
    const ids: number[] = [];
    
    colleges.forEach((college: any) => {
      const id = college.id;
      const name = college.name;
      
      ids.push(id);
      
      if (nameToIdMapping.has(name)) {
        if (!duplicateNames.includes(name)) {
          duplicateNames.push(name);
        }
      } else {
        nameToIdMapping.set(name, id);
      }
    });
    
    ids.sort((a, b) => a - b);
    const minId = Math.min(...ids);
    const maxId = Math.max(...ids);
    
    // Determine ID generation method
    let idGeneration: 'sequential' | 'hash-based' | 'name-based' | 'unknown' = 'unknown';
    let analysis = '';
    
    // Check if IDs are sequential
    const isSequential = ids.every((id, index) => index === 0 || id === ids[index - 1] + 1);
    
    if (isSequential && minId === 1) {
      idGeneration = 'sequential';
      analysis = 'IDs are auto-incremented starting from 1. Re-import will generate new IDs.';
    } else if (minId === 1) {
      idGeneration = 'sequential';
      analysis = 'IDs appear to be auto-incremented but with gaps. Re-import may generate new IDs.';
    } else {
      // Check if IDs might be hash-based or name-based
      const sampleCollege = colleges[0];
      const nameHash = this.simpleHash(String(sampleCollege.name || ''));
      
      if (Math.abs(Number(sampleCollege.id) - nameHash) < 1000) {
        idGeneration = 'name-based';
        analysis = 'IDs appear to be based on college names. Re-import should preserve relationships.';
      } else {
        idGeneration = 'unknown';
        analysis = 'ID generation method unclear. Re-import behavior unpredictable.';
      }
    }
    
    return {
      table: 'colleges',
      totalRecords: colleges.length,
      idRange: { min: minId, max: maxId },
      idGeneration,
      nameToIdMapping,
      duplicateNames,
      analysis
    };
  }
  
  async analyzeProgramIDs(): Promise<IDAnalysis> {
    const programsPath = path.join(process.cwd(), 'data', 'parquet', 'programs.parquet');
    
    if (!fs.existsSync(programsPath)) {
      throw new Error('programs.parquet not found');
    }

    console.log('📊 Analyzing Program ID Generation...');
    
    const reader = await parquet.ParquetReader.openFile(programsPath);
    const cursor = reader.getCursor();
    const programs = [];
    let record = null;
    while (record = await cursor.next()) {
      programs.push(record);
    }
    await reader.close();
    
    const nameToIdMapping = new Map<string, number>();
    const duplicateNames: string[] = [];
    const ids: number[] = [];
    
    programs.forEach((program: any) => {
      const id = program.id;
      const name = program.name;
      
      ids.push(id);
      
      if (nameToIdMapping.has(name)) {
        if (!duplicateNames.includes(name)) {
          duplicateNames.push(name);
        }
      } else {
        nameToIdMapping.set(name, id);
      }
    });
    
    ids.sort((a, b) => a - b);
    const minId = Math.min(...ids);
    const maxId = Math.max(...ids);
    
    let idGeneration: 'sequential' | 'hash-based' | 'name-based' | 'unknown' = 'unknown';
    let analysis = '';
    
    const isSequential = ids.every((id, index) => index === 0 || id === ids[index - 1] + 1);
    
    if (isSequential && minId === 1) {
      idGeneration = 'sequential';
      analysis = 'IDs are auto-incremented starting from 1. Re-import will generate new IDs.';
    } else {
      idGeneration = 'unknown';
      analysis = 'ID generation method needs investigation.';
    }
    
    return {
      table: 'programs',
      totalRecords: programs.length,
      idRange: { min: minId, max: maxId },
      idGeneration,
      nameToIdMapping,
      duplicateNames,
      analysis
    };
  }
  
  async analyzeCutoffRelationships(): Promise<void> {
    const cutoffsPath = path.join(process.cwd(), 'data', 'parquet', 'cutoffs.parquet');
    
    if (!fs.existsSync(cutoffsPath)) {
      console.log('⚠️ cutoffs.parquet not found');
      return;
    }

    console.log('📊 Analyzing Cutoff Relationships...');
    
    const reader = await parquet.ParquetReader.openFile(cutoffsPath);
    const cursor = reader.getCursor();
    const cutoffs = [];
    let record = null;
    while (record = await cursor.next()) {
      cutoffs.push(record);
    }
    await reader.close();
    
    const collegeIds = new Set<number>();
    const programIds = new Set<number>();
    
    cutoffs.forEach((cutoff: any) => {
      if (cutoff.college_id) collegeIds.add(cutoff.college_id);
      if (cutoff.program_id) programIds.add(cutoff.program_id);
    });
    
    console.log(`📊 Cutoffs reference ${collegeIds.size} unique college IDs`);
    console.log(`📊 Cutoffs reference ${programIds.size} unique program IDs`);
    console.log(`📊 Total cutoff records: ${cutoffs.length}`);
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  async generateReimportImpactReport(): Promise<void> {
    console.log('🔍 RE-IMPORT IMPACT ANALYSIS');
    console.log('============================');
    
    try {
      const collegeAnalysis = await this.analyzeCollegeIDs();
      const programAnalysis = await this.analyzeProgramIDs();
      await this.analyzeCutoffRelationships();
      
      console.log('\\n📊 COLLEGE ID ANALYSIS:');
      console.log(`   Total Records: ${collegeAnalysis.totalRecords}`);
      console.log(`   ID Range: ${collegeAnalysis.idRange.min} - ${collegeAnalysis.idRange.max}`);
      console.log(`   Generation Method: ${collegeAnalysis.idGeneration}`);
      console.log(`   Duplicate Names: ${collegeAnalysis.duplicateNames.length}`);
      console.log(`   Analysis: ${collegeAnalysis.analysis}`);
      
      console.log('\\n📊 PROGRAM ID ANALYSIS:');
      console.log(`   Total Records: ${programAnalysis.totalRecords}`);
      console.log(`   ID Range: ${programAnalysis.idRange.min} - ${programAnalysis.idRange.max}`);
      console.log(`   Generation Method: ${programAnalysis.idGeneration}`);
      console.log(`   Duplicate Names: ${programAnalysis.duplicateNames.length}`);
      console.log(`   Analysis: ${programAnalysis.analysis}`);
      
      // Generate recommendations
      console.log('\\n🎯 RE-IMPORT RECOMMENDATIONS:');
      
      if (collegeAnalysis.idGeneration === 'sequential' || programAnalysis.idGeneration === 'sequential') {
        console.log('\\n⚠️  CRITICAL: Auto-incremented IDs detected!');
        console.log('   🔄 Re-importing will break existing relationships');
        console.log('   💡 Solutions:');
        console.log('      1. Create ID mapping table before re-import');
        console.log('      2. Use name-based matching to restore relationships');
        console.log('      3. Backup existing data before re-import');
        console.log('      4. Run relationship restoration script after import');
      } else {
        console.log('\\n✅ ID generation appears stable');
        console.log('   🔄 Re-import should preserve relationships');
        console.log('   💡 Still recommended to backup data before re-import');
      }
      
      // Generate specific recommendations
      const reportPath = path.join(process.cwd(), 'data', 'reimport-impact-analysis.md');
      const report = this.generateDetailedReport(collegeAnalysis, programAnalysis);
      fs.writeFileSync(reportPath, report);
      
      console.log(`\\n📋 Detailed report saved: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
    }
  }
  
  private generateDetailedReport(collegeAnalysis: IDAnalysis, programAnalysis: IDAnalysis): string {
    return `# 🔄 Re-Import Impact Analysis Report

## 📊 Executive Summary

**Question**: If we correct the Excel files and re-import, will relationships need to be re-matched?

**Answer**: ${collegeAnalysis.idGeneration === 'sequential' ? '⚠️ YES - Relationships will break' : '✅ LIKELY NO - Relationships should be preserved'}

## 🏥 College ID Analysis

- **Total Colleges**: ${collegeAnalysis.totalRecords}
- **ID Range**: ${collegeAnalysis.idRange.min} to ${collegeAnalysis.idRange.max}
- **Generation Method**: ${collegeAnalysis.idGeneration}
- **Duplicate Names**: ${collegeAnalysis.duplicateNames.length}
- **Impact**: ${collegeAnalysis.analysis}

### Duplicate College Names
${collegeAnalysis.duplicateNames.length > 0 ? 
  collegeAnalysis.duplicateNames.map(name => `- ${name}`).join('\\n') : 
  'No duplicate college names found.'}

## 🎓 Program ID Analysis

- **Total Programs**: ${programAnalysis.totalRecords}
- **ID Range**: ${programAnalysis.idRange.min} to ${programAnalysis.idRange.max}
- **Generation Method**: ${programAnalysis.idGeneration}
- **Duplicate Names**: ${programAnalysis.duplicateNames.length}
- **Impact**: ${programAnalysis.analysis}

### Duplicate Program Names
${programAnalysis.duplicateNames.length > 0 ? 
  programAnalysis.duplicateNames.map(name => `- ${name}`).join('\\n') : 
  'No duplicate program names found.'}

## 🔄 Re-Import Scenarios

### Scenario 1: Sequential IDs (Current System)
${collegeAnalysis.idGeneration === 'sequential' ? `
**Status**: ⚠️ DETECTED
**Impact**: HIGH - Relationships will break
**Reason**: Auto-incremented IDs will be reassigned during re-import

**What Happens**:
1. College "SAWAI MAN SINGH MEDICAL COLLEGE" currently has ID 150
2. After re-import, it might get ID 147 (due to corrected data order)
3. All cutoff records pointing to college_id=150 now point to wrong college
4. Data integrity compromised

**Solution Required**: YES
` : `
**Status**: ✅ NOT DETECTED
**Impact**: LOW - Relationships likely preserved
`}

### Scenario 2: Name-Based IDs
${collegeAnalysis.idGeneration === 'name-based' ? `
**Status**: ✅ DETECTED
**Impact**: LOW - Relationships preserved
**Reason**: IDs are derived from names, corrections won't change IDs

**What Happens**:
1. College "SMS MEDICAL COLLEGE" has ID based on name hash
2. After correction to "SAWAI MAN SINGH MEDICAL COLLEGE", gets new ID
3. But this is expected behavior - the college name actually changed
4. Matching process will create correct relationships
` : `
**Status**: ❓ NOT DETECTED
**Impact**: UNKNOWN
`}

## 💡 Recommendations

### Before Re-Import
1. **Backup Current Data**
   \`\`\`bash
   cp data/colleges.parquet data/colleges.parquet.backup
   cp data/programs.parquet data/programs.parquet.backup
   cp data/cutoffs.parquet data/cutoffs.parquet.backup
   \`\`\`

2. **Create ID Mapping**
   - Export current name-to-ID mappings
   - Use for relationship restoration if needed

### During Re-Import
${collegeAnalysis.idGeneration === 'sequential' ? `
3. **Use Enhanced Import Process**
   - Import with relationship preservation
   - Create temporary mapping tables
   - Restore relationships based on names
` : `
3. **Standard Import Process**
   - Normal re-import should work
   - Monitor for any relationship issues
`}

### After Re-Import
4. **Validation**
   - Check relationship counts match
   - Verify sample records are correctly linked
   - Run data integrity checks

## 🎯 Specific Actions for Your Use Case

### Correcting "SMS MEDICAL COLLEGE" → "SAWAI MAN SINGH MEDICAL COLLEGE"

${collegeAnalysis.idGeneration === 'sequential' ? `
**Risk**: HIGH
1. College will get new ID during re-import
2. All counselling cutoffs will point to wrong college
3. Matching process must re-establish relationships

**Mitigation**:
1. Before import: Note that "SMS MEDICAL COLLEGE" has ID X
2. After import: Find "SAWAI MAN SINGH MEDICAL COLLEGE" has new ID Y
3. Update all cutoff records: college_id=X → college_id=Y
` : `
**Risk**: LOW
1. Name change will trigger new matching
2. Enhanced college matcher should handle this correctly
3. Relationships should be preserved through name matching
`}

## 📈 Expected Outcomes

### Current Match Rate: 72.1%
### After Corrections: 85-90%
### After Re-Import: ${collegeAnalysis.idGeneration === 'sequential' ? '⚠️ Depends on relationship restoration' : '✅ Should maintain or improve'}

---

*Generated on ${new Date().toLocaleString()}*
`;
  }
}

async function main() {
  const analyzer = new IDGenerationAnalyzer();
  await analyzer.generateReimportImpactReport();
}

if (require.main === module) {
  main();
}

export { IDGenerationAnalyzer };
