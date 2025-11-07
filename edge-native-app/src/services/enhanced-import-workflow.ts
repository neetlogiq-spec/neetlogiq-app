import { MasterDataManager } from './master-data-architecture';

/**
 * Enhanced Import Workflow with Real-time Progress and Comprehensive Error Handling
 * Features:
 * - Batch processing with progress callbacks
 * - Duplicate detection with flagging
 * - Low confidence match flagging
 * - Comprehensive error reporting at the end
 * - Automatic review queue management
 */

export class EnhancedImportWorkflow {
  private masterDataManager: MasterDataManager;
  
  constructor(masterDataManager: MasterDataManager) {
    this.masterDataManager = masterDataManager;
  }

  /**
   * Enhanced College/Course Data Import with comprehensive validation
   */
  async importCollegeCourseData(
    rawData: Array<{
      state: string;
      college_institute: string;
      address?: string;
      university_affiliation?: string;
      management?: string;
      course: string;
      seats: number;
    }>,
    options: {
      fileName?: string;
      batchSize?: number;
      continueOnError?: boolean;
      progressCallback?: (progress: number, status: string, stats: ImportStats) => void;
    } = {}
  ): Promise<EnhancedImportResult> {
    
    const {
      fileName = 'college_course_import.xlsx',
      batchSize = 100,
      continueOnError = true,
      progressCallback
    } = options;

    // Initialize batch and stats
    const batchId = this.generateBatchId();
    const stats: ImportStats = {
      totalRecords: rawData.length,
      processedRecords: 0,
      successfulMatches: 0,
      validationErrors: 0,
      pendingReviews: 0,
      duplicateFlags: 0,
      lowConfidenceMatches: 0,
      newMasterEntries: 0
    };

    const result: EnhancedImportResult = {
      batchId,
      success: false,
      stats,
      validationErrors: [],
      pendingReviews: [],
      duplicateDetections: [],
      lowConfidenceMatches: [],
      processingTime: 0
    };

    const startTime = Date.now();
    
    console.log(`🚀 Starting enhanced college/course import [${batchId}]`);
    console.log(`📊 Total records: ${rawData.length}, Batch size: ${batchSize}`);
    
    try {
      // Process in batches for better performance and progress tracking
      for (let batchStart = 0; batchStart < rawData.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, rawData.length);
        const batch = rawData.slice(batchStart, batchEnd);
        
        const batchProgress = Math.floor((batchStart / rawData.length) * 100);
        const batchStatus = `Processing batch ${Math.floor(batchStart/batchSize) + 1}/${Math.ceil(rawData.length/batchSize)}`;
        
        if (progressCallback) {
          progressCallback(batchProgress, batchStatus, stats);
        }
        
        console.log(`📦 ${batchStatus}: rows ${batchStart + 1}-${batchEnd}`);
        
        // Process each record in the batch
        for (let i = 0; i < batch.length; i++) {
          const row = batch[i];
          const rowNumber = batchStart + i + 1;
          
          try {
            await this.processCollegeCourseRow(row, rowNumber, batchId, result, stats);
          } catch (error) {
            console.error(`❌ Error processing row ${rowNumber}:`, error);
            result.validationErrors.push({
              row_number: rowNumber,
              field: 'general',
              raw_value: JSON.stringify(row),
              error_type: 'INVALID_FORMAT',
              suggested_action: `Review data format: ${error}`
            });
            stats.validationErrors++;
          }
          
          stats.processedRecords++;
          
          // Update progress every 10 records within batch
          if (i % 10 === 0 && progressCallback) {
            const overallProgress = Math.floor(((batchStart + i) / rawData.length) * 100);
            progressCallback(overallProgress, `Processing row ${batchStart + i + 1}/${rawData.length}`, stats);
          }
        }
        
        // Small delay between batches to prevent overwhelming
        if (batchEnd < rawData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Final processing and results
      result.processingTime = Date.now() - startTime;
      result.success = this.evaluateImportSuccess(stats, rawData.length);
      
      // Final progress callback
      if (progressCallback) {
        progressCallback(100, 'Import completed', stats);
      }
      
      console.log(`✅ Enhanced import completed in ${result.processingTime}ms`);
      this.logImportSummary(result);
      
      return result;
      
    } catch (error) {
      console.error('💥 Critical error during import:', error);
      result.processingTime = Date.now() - startTime;
      result.success = false;
      return result;
    }
  }

  /**
   * Process individual college/course row with comprehensive validation
   */
  private async processCollegeCourseRow(
    row: any,
    rowNumber: number,
    batchId: string,
    result: EnhancedImportResult,
    stats: ImportStats
  ): Promise<void> {
    
    // Step 1: Validate and match state
    const stateMatch = await this.processStateMatch(row.state, rowNumber, batchId, result, stats);
    if (!stateMatch) return;
    
    // Step 2: Validate and match college (with duplicate detection)
    const collegeMatch = await this.processCollegeMatch(
      row.college_institute,
      stateMatch.master_id,
      rowNumber,
      batchId,
      result,
      stats
    );
    if (!collegeMatch) return;
    
    // Step 3: Validate and match course
    const courseMatch = await this.processCourseMatch(row.course, rowNumber, batchId, result, stats);
    if (!courseMatch) return;
    
    // Step 4: Check overall confidence and create record
    const overallConfidence = Math.min(
      stateMatch.confidence,
      collegeMatch.confidence,
      courseMatch.confidence
    );
    
    if (overallConfidence < 0.8) {
      stats.lowConfidenceMatches++;
      result.lowConfidenceMatches.push({
        rowNumber,
        overallConfidence,
        matches: { state: stateMatch, college: collegeMatch, course: courseMatch },
        rawData: row
      });
      
      // Queue for review if very low confidence
      if (overallConfidence < 0.6) {
        stats.pendingReviews++;
        // Create pending review record
      }
    }
    
    // Create successful import record
    const importRecord = {
      master_college_id: collegeMatch.master_id,
      master_course_id: courseMatch.master_id,
      master_state_id: stateMatch.master_id,
      university_affiliation: this.normalize(row.university_affiliation || ''),
      seats: row.seats,
      management: this.normalize(row.management || ''),
      batch_id: batchId,
      row_number: rowNumber,
      match_confidence: overallConfidence,
      raw_data: row
    };
    
    stats.successfulMatches++;
    console.log(`✅ Row ${rowNumber}: Matched with confidence ${Math.round(overallConfidence * 100)}%`);
  }

  /**
   * Process state matching with validation
   */
  private async processStateMatch(
    stateName: string,
    rowNumber: number,
    batchId: string,
    result: EnhancedImportResult,
    stats: ImportStats
  ): Promise<any> {
    
    const normalizedState = this.normalize(stateName);
    const stateMatch = await this.masterDataManager.matchState(normalizedState);
    
    if (!stateMatch) {
      stats.validationErrors++;
      stats.pendingReviews++;
      
      result.validationErrors.push({
        row_number: rowNumber,
        field: 'state',
        raw_value: stateName,
        error_type: 'NO_MATCH',
        suggested_action: `Queue for review: Add '${normalizedState}' to master_states`
      });
      
      result.pendingReviews.push({
        rowNumber,
        type: 'NEW_ENTRY',
        entityType: 'STATE',
        rawData: { name: stateName },
        suggestedMasterData: { name: normalizedState, normalized_name: normalizedState }
      });
      
      return null;
    }
    
    return stateMatch;
  }

  /**
   * Process college matching with duplicate detection
   */
  private async processCollegeMatch(
    collegeName: string,
    stateId: number,
    rowNumber: number,
    batchId: string,
    result: EnhancedImportResult,
    stats: ImportStats
  ): Promise<any> {
    
    const normalizedCollege = this.normalize(collegeName);
    
    // Check for duplicates first
    const duplicates = await this.detectDuplicateColleges(normalizedCollege, stateId);
    if (duplicates.length > 0) {
      stats.duplicateFlags++;
      stats.pendingReviews++;
      
      result.duplicateDetections.push({
        rowNumber,
        entityType: 'COLLEGE',
        rawData: { name: collegeName, state_id: stateId },
        duplicates
      });
      
      result.validationErrors.push({
        row_number: rowNumber,
        field: 'college_institute',
        raw_value: collegeName,
        error_type: 'DUPLICATE_DETECTED',
        suggested_action: `Review duplicates: ${duplicates.length} similar colleges found`,
        potential_matches: duplicates
      });
      
      return null;
    }
    
    // Try to match
    const collegeMatch = await this.masterDataManager.matchCollege(normalizedCollege, stateId);
    
    if (!collegeMatch) {
      stats.validationErrors++;
      stats.pendingReviews++;
      
      result.validationErrors.push({
        row_number: rowNumber,
        field: 'college_institute',
        raw_value: collegeName,
        error_type: 'NO_MATCH',
        suggested_action: `Queue for review: Add '${normalizedCollege}' to master_colleges`
      });
      
      return null;
    }
    
    return collegeMatch;
  }

  /**
   * Process course matching
   */
  private async processCourseMatch(
    courseName: string,
    rowNumber: number,
    batchId: string,
    result: EnhancedImportResult,
    stats: ImportStats
  ): Promise<any> {
    
    const normalizedCourse = this.normalize(courseName);
    const courseMatch = await this.masterDataManager.matchCourse(normalizedCourse);
    
    if (!courseMatch) {
      stats.validationErrors++;
      stats.pendingReviews++;
      
      result.validationErrors.push({
        row_number: rowNumber,
        field: 'course',
        raw_value: courseName,
        error_type: 'NO_MATCH',
        suggested_action: `Queue for review: Add '${normalizedCourse}' to master_courses`
      });
      
      return null;
    }
    
    return courseMatch;
  }

  /**
   * Enhanced duplicate detection for colleges
   */
  private async detectDuplicateColleges(
    normalizedName: string,
    stateId: number
  ): Promise<Array<{id: number; name: string; confidence: number}>> {
    
    // This would query the master_colleges table in real implementation
    // For now, simulate duplicate detection logic
    const duplicates: Array<{id: number; name: string; confidence: number}> = [];
    
    // Check for very similar names (>90% similarity)
    // In real implementation, this would use proper fuzzy matching against database
    
    return duplicates;
  }

  /**
   * Evaluate if import was successful based on statistics
   */
  private evaluateImportSuccess(stats: ImportStats, totalRecords: number): boolean {
    const successRate = stats.successfulMatches / totalRecords;
    const errorRate = stats.validationErrors / totalRecords;
    
    // Consider successful if >70% success rate and <30% error rate
    return successRate > 0.7 && errorRate < 0.3;
  }

  /**
   * Log comprehensive import summary
   */
  private logImportSummary(result: EnhancedImportResult): void {
    console.log(`\n📋 IMPORT SUMMARY [${result.batchId}]`);
    console.log(`⏱️  Processing time: ${result.processingTime}ms`);
    console.log(`✅ Success: ${result.success ? 'YES' : 'NO'}`);
    console.log(`\n📊 STATISTICS:`);
    console.log(`   Total records: ${result.stats.totalRecords}`);
    console.log(`   Processed: ${result.stats.processedRecords}`);
    console.log(`   Successful matches: ${result.stats.successfulMatches}`);
    console.log(`   Validation errors: ${result.stats.validationErrors}`);
    console.log(`   Pending reviews: ${result.stats.pendingReviews}`);
    console.log(`   Duplicate flags: ${result.stats.duplicateFlags}`);
    console.log(`   Low confidence: ${result.stats.lowConfidenceMatches}`);
    
    if (result.validationErrors.length > 0) {
      console.log(`\n⚠️  TOP VALIDATION ERRORS:`);
      result.validationErrors.slice(0, 5).forEach((error, idx) => {
        console.log(`   ${idx + 1}. Row ${error.row_number}: ${error.error_type} - ${error.suggested_action}`);
      });
    }
    
    if (result.pendingReviews.length > 0) {
      console.log(`\n👀 PENDING REVIEWS: ${result.pendingReviews.length} items queued for manual review`);
    }
    
    if (result.duplicateDetections.length > 0) {
      console.log(`\n👥 DUPLICATE FLAGS: ${result.duplicateDetections.length} potential duplicates detected`);
    }
    
    console.log(`\n🎯 SUCCESS RATE: ${Math.round((result.stats.successfulMatches / result.stats.totalRecords) * 100)}%`);
  }

  /**
   * Utility methods
   */
  private normalize(text: string): string {
    return text.toUpperCase().trim().replace(/\\s+/g, ' ');
  }
  
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Type definitions for enhanced import workflow
 */
interface ImportStats {
  totalRecords: number;
  processedRecords: number;
  successfulMatches: number;
  validationErrors: number;
  pendingReviews: number;
  duplicateFlags: number;
  lowConfidenceMatches: number;
  newMasterEntries: number;
}

interface EnhancedImportResult {
  batchId: string;
  success: boolean;
  stats: ImportStats;
  validationErrors: any[];
  pendingReviews: any[];
  duplicateDetections: any[];
  lowConfidenceMatches: any[];
  processingTime: number;
}

/**
 * Demo usage example
 */
export async function demonstrateEnhancedImportWorkflow() {
  console.log('🚀 Demonstrating Enhanced Import Workflow with Master Data Architecture');
  
  // Initialize components
  const masterDataManager = new MasterDataManager();
  const importWorkflow = new EnhancedImportWorkflow(masterDataManager);
  
  // Sample college/course data with intentional issues for testing
  const sampleData = [
    {
      state: 'Andhra Pradesh',
      college_institute: 'Government Medical College',
      address: 'Anantapur, AP',
      university_affiliation: 'NTR University of Health Sciences',
      management: 'Government',
      course: 'MBBS',
      seats: 150
    },
    {
      state: 'AP', // State abbreviation test
      college_institute: 'Govt Medical College', // Similar name test
      address: 'Kurnool, AP',
      university_affiliation: 'NTRUHS',
      management: 'GOVERNMENT',
      course: 'Bachelor of Medicine',
      seats: 100
    },
    {
      state: 'Tamil Nadu',
      college_institute: 'Madras Medical College',
      address: 'Chennai, TN',
      university_affiliation: 'The Tamil Nadu Dr. M.G.R. Medical University',
      management: 'Government',
      course: 'MBBS',
      seats: 200
    },
    {
      state: 'Unknown State', // New state test
      college_institute: 'New Medical College',
      course: 'Unknown Course', // New course test
      seats: 50
    }
  ];
  
  // Progress callback for real-time updates
  const progressCallback = (progress: number, status: string, stats: ImportStats) => {
    console.log(`📊 Progress: ${progress}% | ${status}`);
    console.log(`   Matches: ${stats.successfulMatches}, Errors: ${stats.validationErrors}, Reviews: ${stats.pendingReviews}`);
  };
  
  // Execute enhanced import
  const result = await importWorkflow.importCollegeCourseData(sampleData, {
    fileName: 'sample_colleges.xlsx',
    batchSize: 2, // Small batch for demo
    continueOnError: true,
    progressCallback
  });
  
  console.log('\\n🎉 DEMONSTRATION COMPLETED');
  console.log(`Import ${result.success ? 'SUCCEEDED' : 'NEEDS ATTENTION'}`);
  console.log(`Batch ID: ${result.batchId}`);
  
  return result;
}