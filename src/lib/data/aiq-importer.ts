import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import StagingDatabase, { StagingCounsellingRecord, ProcessedCutoff } from './staging-database';

export interface AIQImportResult {
  totalRecords: number;
  recordsByRound: Record<number, number>;
  recordsByQuota: Record<string, number>;
  recordsByCategory: Record<string, number>;
  processedCutoffs: number;
  unmatchedColleges: string[];
  unmatchedCourses: string[];
  sourceFiles: string[];
}

export class AIQImporter {
  private aiqDataPath: string;
  private stagingDb: StagingDatabase;

  constructor(aiqDataPath: string) {
    this.aiqDataPath = aiqDataPath;
    this.stagingDb = new StagingDatabase();
  }

  /**
   * Import all AIQ PG 2024 files
   */
  async importAIQData(): Promise<AIQImportResult> {
    console.log('🚀 Starting AIQ PG 2024 data import...');
    
    try {
      // Initialize staging database
      await this.stagingDb.initializeStagingDatabase();

      // Get all AIQ files
      const aiqFiles = this.getAIQFiles();
      console.log(`📁 Found ${aiqFiles.length} AIQ files:`, aiqFiles.map(f => path.basename(f)));

      // Import all files
      const allRecords: StagingCounsellingRecord[] = [];
      const sourceFiles: string[] = [];

      for (const filePath of aiqFiles) {
        console.log(`📊 Processing ${path.basename(filePath)}...`);
        const records = await this.importAIQFile(filePath);
        allRecords.push(...records);
        sourceFiles.push(path.basename(filePath));
        console.log(`✅ Imported ${records.length} records from ${path.basename(filePath)}`);
      }

      // Save all records to staging database
      await this.stagingDb.saveStagingRecords(allRecords);

      // Process cutoffs (calculate opening/closing ranks)
      console.log('📈 Processing cutoffs and calculating ranks...');
      const processedCutoffs = await this.processCutoffs(allRecords);

      // Save processed cutoffs
      await this.stagingDb.saveProcessedCutoffs(processedCutoffs);

      // Generate summary
      const summary = await this.generateImportSummary(allRecords, processedCutoffs, sourceFiles);

      console.log('✅ AIQ PG 2024 data import completed successfully!');
      return summary;

    } catch (error: any) {
      console.error('❌ AIQ data import failed:', error);
      throw error;
    }
  }

  /**
   * Get all AIQ files from the directory
   */
  private getAIQFiles(): string[] {
    if (!fs.existsSync(this.aiqDataPath)) {
      throw new Error(`AIQ data directory not found: ${this.aiqDataPath}`);
    }

    const files = fs.readdirSync(this.aiqDataPath)
      .filter(file => file.endsWith('.xlsx') && file.includes('AIQ_PG_2024'))
      .map(file => path.join(this.aiqDataPath, file))
      .sort(); // Sort to process R1, R2, R3, R4, R5 in order

    return files;
  }

  /**
   * Import a single AIQ file
   */
  private async importAIQFile(filePath: string): Promise<StagingCounsellingRecord[]> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const records: StagingCounsellingRecord[] = [];
      const fileName = path.basename(filePath);

      // Extract round number from filename (e.g., AIQ_PG_2024_R1.xlsx -> 1)
      const roundMatch = fileName.match(/R(\d+)\.xlsx$/);
      const round = roundMatch ? parseInt(roundMatch[1]) : 1;

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        
        // Skip empty rows
        if (!row['ALL_INDIA_RANK'] || !row['COLLEGE/INSTITUTE'] || !row['COURSE']) {
          continue;
        }

        const record: StagingCounsellingRecord = {
          id: `aiq_${round}_${i + 1}`,
          allIndiaRank: parseInt(row['ALL_INDIA_RANK']) || 0,
          quota: String(row['QUOTA'] || '').trim(),
          collegeInstitute: String(row['COLLEGE/INSTITUTE'] || '').trim(),
          course: String(row['COURSE'] || '').trim(),
          category: String(row['CATEGORY'] || '').trim(),
          round: round,
          year: 2024,
          sourceFile: fileName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Validate record
        if (record.allIndiaRank > 0 && record.collegeInstitute && record.course) {
          records.push(record);
        }
      }

      return records;
    } catch (error: any) {
      console.error(`❌ Failed to import ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process counselling records to calculate opening and closing ranks
   */
  private async processCutoffs(records: StagingCounsellingRecord[]): Promise<ProcessedCutoff[]> {
    console.log('📊 Calculating opening and closing ranks...');

    // Group records by: year, round, quota, category, college, course, source, level
    const groupedRecords = new Map<string, StagingCounsellingRecord[]>();

    for (const record of records) {
      // Prefer master IDs, fallback to normalized values, then other sources
      const source = (record as any).master_source_id || (record as any).source_normalized || (record as any).source || (record as any).sourceFile?.split('_')[0] || 'UNKNOWN';
      const level = (record as any).master_level_id || (record as any).level_normalized || (record as any).level || 'UNKNOWN';
      const key = `${record.year}_${record.round}_${record.quota}_${record.category}_${record.collegeInstitute}_${record.course}_${source}_${level}`;
      
      if (!groupedRecords.has(key)) {
        groupedRecords.set(key, []);
      }
      groupedRecords.get(key)!.push(record);
    }

    const processedCutoffs: ProcessedCutoff[] = [];

    for (const [key, groupRecords] of groupedRecords) {
      if (groupRecords.length === 0) continue;

      // Sort by rank to find opening (best) and closing (worst) ranks
      const sortedRecords = groupRecords.sort((a, b) => a.allIndiaRank - b.allIndiaRank);
      
      const openingRank = sortedRecords[0].allIndiaRank; // Best rank (lowest number)
      const closingRank = sortedRecords[sortedRecords.length - 1].allIndiaRank; // Worst rank (highest number)

      const cutoff: ProcessedCutoff = {
        id: `cutoff_${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
        collegeId: '', // Will be filled during college matching
        courseId: '', // Will be filled during course matching
        year: groupRecords[0].year,
        round: groupRecords[0].round,
        quota: groupRecords[0].quota,
        category: groupRecords[0].category,
        openingRank: openingRank,
        closingRank: closingRank,
        totalRecords: groupRecords.length,
        sourceFile: groupRecords[0].sourceFile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      processedCutoffs.push(cutoff);
    }

    console.log(`✅ Processed ${processedCutoffs.length} cutoffs from ${records.length} records`);
    return processedCutoffs;
  }

  /**
   * Generate import summary
   */
  private async generateImportSummary(
    records: StagingCounsellingRecord[], 
    cutoffs: ProcessedCutoff[], 
    sourceFiles: string[]
  ): Promise<AIQImportResult> {
    // Analyze records by round
    const recordsByRound = records.reduce((acc, record) => {
      acc[record.round] = (acc[record.round] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Analyze records by quota
    const recordsByQuota = records.reduce((acc, record) => {
      acc[record.quota] = (acc[record.quota] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Analyze records by category
    const recordsByCategory = records.reduce((acc, record) => {
      acc[record.category] = (acc[record.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get unique colleges and courses for matching analysis
    const uniqueColleges = [...new Set(records.map(r => r.collegeInstitute))];
    const uniqueCourses = [...new Set(records.map(r => r.course))];

    return {
      totalRecords: records.length,
      recordsByRound,
      recordsByQuota,
      recordsByCategory,
      processedCutoffs: cutoffs.length,
      unmatchedColleges: uniqueColleges,
      unmatchedCourses: uniqueCourses,
      sourceFiles
    };
  }

  /**
   * Test AIQ data access
   */
  async testAIQDataAccess(): Promise<boolean> {
    console.log('🧪 Testing AIQ data access...');
    
    try {
      if (!fs.existsSync(this.aiqDataPath)) {
        console.error(`❌ AIQ data directory not found: ${this.aiqDataPath}`);
        return false;
      }

      const files = this.getAIQFiles();
      if (files.length === 0) {
        console.error('❌ No AIQ files found in directory');
        return false;
      }

      // Test reading first file
      const testFile = files[0];
      console.log(`📁 Testing file: ${path.basename(testFile)}`);
      
      const workbook = XLSX.readFile(testFile);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      console.log(`✅ Successfully read ${data.length} rows from ${path.basename(testFile)}`);
      
      // Check required columns
      if (data.length > 0) {
        const firstRow = data[0] as any;
        const requiredColumns = ['ALL_INDIA_RANK', 'QUOTA', 'COLLEGE/INSTITUTE', 'COURSE', 'CATEGORY'];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          console.error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
          return false;
        }
        
        console.log('✅ All required columns present');
      }

      return true;
    } catch (error: any) {
      console.error('❌ AIQ data access test failed:', error);
      return false;
    }
  }
}

export default AIQImporter;
