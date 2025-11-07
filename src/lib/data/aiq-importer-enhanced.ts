import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import StagingManager, { StagingCounsellingRecord, ProgressCallback } from './staging-manager';

export interface AIQImportResult {
  totalRecords: number;
  recordsByRound: Record<number, number>;
  recordsByQuota: Record<string, number>;
  recordsByCategory: Record<string, number>;
  processedCutoffs: number;
  matchedColleges: number;
  matchedCourses: number;
  unmatchedColleges: number;
  unmatchedCourses: number;
  dataQuality: {
    validRecords: number;
    invalidRecords: number;
    validationErrors: string[];
    rankValidationErrors: number;
    completenessErrors: number;
    businessLogicErrors: number;
  };
  performance: {
    importTime: number;
    processingTime: number;
    matchingTime: number;
    totalTime: number;
    memoryUsage: number;
  };
  sourceFiles: string[];
}

export class AIQImporterEnhanced {
  private aiqDataPath: string;
  private stagingManager: StagingManager;
  private progressCallback: ProgressCallback | null = null;

  constructor(aiqDataPath: string) {
    this.aiqDataPath = aiqDataPath;
    this.stagingManager = new StagingManager({
      exactMatchThreshold: 1.0,
      fuzzyMatchThreshold: 0.7,
      manualReviewThreshold: 0.5,
      maxDistance: 10,
      enableParallelProcessing: true,
      batchSize: 1000
    });
  }

  /**
   * Set progress callback for monitoring
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
    this.stagingManager.setProgressCallback(callback);
  }

  /**
   * Import all AIQ PG 2024 files with enhanced staging workflow
   */
  async importAIQData(): Promise<AIQImportResult> {
    console.log('🚀 Starting enhanced AIQ PG 2024 data import...');
    
    try {
      // Step 1: Load and parse all AIQ files
      console.log('📁 Loading AIQ files...');
      const allRecords = await this.loadAllAIQFiles();
      
      // Step 2: Run complete staging workflow
      console.log('🔄 Running complete staging workflow...');
      const stagingStatus = await this.stagingManager.runCompleteWorkflow(allRecords);
      
      // Step 3: Generate comprehensive summary
      const summary = await this.generateEnhancedSummary(allRecords, stagingStatus);
      
      console.log('✅ Enhanced AIQ PG 2024 data import completed successfully!');
      return summary;

    } catch (error: any) {
      console.error('❌ Enhanced AIQ data import failed:', error);
      throw error;
    } finally {
      // Clean up
      await this.stagingManager.close();
    }
  }

  /**
   * Load all AIQ files with parallel processing
   */
  private async loadAllAIQFiles(): Promise<StagingCounsellingRecord[]> {
    const aiqFiles = this.getAIQFiles();
    console.log(`📁 Found ${aiqFiles.length} AIQ files:`, aiqFiles.map(f => path.basename(f)));

    const allRecords: StagingCounsellingRecord[] = [];
    
    // Process files in parallel for better performance
    const filePromises = aiqFiles.map(async (filePath, index) => {
      console.log(`📊 Processing ${path.basename(filePath)}...`);
      const records = await this.importAIQFile(filePath);
      console.log(`✅ Imported ${records.length} records from ${path.basename(filePath)}`);
      return records;
    });

    const fileResults = await Promise.all(filePromises);
    
    // Combine all records
    for (const records of fileResults) {
      allRecords.push(...records);
    }

    return allRecords;
  }

  /**
   * Get all AIQ files from the directory
   */
  private getAIQFiles(): string[] {
    if (!fs.existsSync(this.aiqDataPath)) {
      throw new Error(`AIQ data directory not found: ${this.aiqDataPath}`);
    }

    const files = fs.readdirSync(this.aiqDataPath)
      .filter(file => file.endsWith('.xlsx') && file.includes('AIQ_PG_') && !file.startsWith('~$'))
      .map(file => path.join(this.aiqDataPath, file))
      .sort(); // Sort to process R1, R2, R3, R4, R5 in order

    return files;
  }

  /**
   * Import a single AIQ file with enhanced validation
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
          id: `aiq_${round}_${fileName}_${i + 1}_${Date.now()}`,
          allIndiaRank: parseInt(row['ALL_INDIA_RANK']) || 0,
          quota: String(row['QUOTA'] || '').trim(),
          collegeInstitute: String(row['COLLEGE/INSTITUTE'] || '').trim(),
          course: String(row['COURSE'] || '').trim(),
          category: String(row['CATEGORY'] || '').trim(),
          round: round,
          year: parseInt(row['YEAR']) || 2024, // Use actual year from data
          sourceFile: fileName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Enhanced validation
        if (this.validateRecord(record)) {
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
   * Enhanced record validation
   */
  private validateRecord(record: StagingCounsellingRecord): boolean {
    // Basic validation
    if (record.allIndiaRank <= 0) return false;
    if (!record.collegeInstitute || record.collegeInstitute.length < 3) return false;
    if (!record.course || record.course.length < 3) return false;
    if (!record.quota || record.quota.length < 2) return false;
    if (!record.category || record.category.length < 2) return false;
    
    // Business logic validation
    if (record.allIndiaRank > 1000000) return false; // Unrealistic rank
    
    return true;
  }

  /**
   * Generate enhanced summary with comprehensive metrics
   */
  private async generateEnhancedSummary(
    records: StagingCounsellingRecord[], 
    stagingStatus: any
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

    // Get unique source files
    const sourceFiles = [...new Set(records.map(r => r.sourceFile))];

    return {
      totalRecords: records.length,
      recordsByRound,
      recordsByQuota,
      recordsByCategory,
      processedCutoffs: stagingStatus.totalCutoffs,
      matchedColleges: stagingStatus.matchedColleges,
      matchedCourses: stagingStatus.matchedCourses,
      unmatchedColleges: stagingStatus.unmatchedColleges,
      unmatchedCourses: stagingStatus.unmatchedCourses,
      dataQuality: stagingStatus.dataQuality,
      performance: stagingStatus.performance,
      sourceFiles
    };
  }

  /**
   * Test AIQ data access with enhanced validation
   */
  async testAIQDataAccess(): Promise<boolean> {
    console.log('🧪 Testing enhanced AIQ data access...');
    
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

      // Test reading first file with enhanced validation
      const testFile = files[0];
      console.log(`📁 Testing file: ${path.basename(testFile)}`);
      
      const workbook = XLSX.readFile(testFile);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      console.log(`✅ Successfully read ${data.length} rows from ${path.basename(testFile)}`);
      
      // Enhanced column validation
      if (data.length > 0) {
        const firstRow = data[0] as any;
        const requiredColumns = ['ALL_INDIA_RANK', 'QUOTA', 'COLLEGE/INSTITUTE', 'COURSE', 'CATEGORY'];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          console.error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
          return false;
        }
        
        console.log('✅ All required columns present');
        
        // Test data validation
        const testRecords = await this.importAIQFile(testFile);
        const validRecords = testRecords.filter(r => this.validateRecord(r));
        
        console.log(`✅ Data validation: ${validRecords.length}/${testRecords.length} valid records`);
      }

      return true;
    } catch (error: any) {
      console.error('❌ Enhanced AIQ data access test failed:', error);
      return false;
    }
  }
}

export default AIQImporterEnhanced;
