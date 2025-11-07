#!/usr/bin/env tsx

import ExcelProcessor, { CollegeData, ReferenceData } from './excel-processor';
import CollegeValidator, { ValidationResult, ValidationStats } from './college-validator';
import path from 'path';
import fs from 'fs/promises';

export interface PipelineConfig {
  inputDir: string;
  outputDir: string;
  enableValidation: boolean;
  exportFormats: ('json' | 'csv' | 'parquet')[];
  confidenceThreshold: number;
  removeDuplicates: boolean;
  generateReports: boolean;
}

export interface PipelineResult {
  success: boolean;
  summary: {
    totalColleges: number;
    validColleges: number;
    duplicatesRemoved: number;
    processingTime: number;
  };
  colleges: CollegeData[];
  references: ReferenceData;
  validationStats?: ValidationStats;
  files: {
    dataFiles: string[];
    reportFiles: string[];
  };
  errors?: string[];
}

export class DataTransformationPipeline {
  private processor: ExcelProcessor;
  private validator: CollegeValidator;
  private config: PipelineConfig;
  private logFile: string;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      inputDir: path.join(process.cwd(), 'data/Foundation'),
      outputDir: path.join(process.cwd(), 'data/processed'),
      enableValidation: true,
      exportFormats: ['json', 'csv'],
      confidenceThreshold: 0.3,
      removeDuplicates: true,
      generateReports: true,
      ...config
    };

    this.processor = new ExcelProcessor();
    this.validator = new CollegeValidator();
    this.logFile = path.join(this.config.outputDir, 'pipeline.log');
  }

  async run(): Promise<PipelineResult> {
    const startTime = Date.now();
    await this.log('🚀 Starting Data Transformation Pipeline...', 'INFO');

    try {
      // Initialize components
      await this.initialize();

      // Process Excel files
      const processingResult = await this.processor.processAllExcelFiles();
      await this.log(`📊 Processed ${processingResult.colleges.length} colleges`, 'INFO');

      // Validate data if enabled
      let validationResult: any = null;
      let validColleges = processingResult.colleges;

      if (this.config.enableValidation) {
        validationResult = await this.validateData(processingResult.colleges);
        validColleges = validationResult.results
          .filter((r: ValidationResult) => r.isValid && r.normalizedData && r.confidence >= this.config.confidenceThreshold)
          .map((r: ValidationResult) => r.normalizedData!);
        
        await this.log(`✅ Validated ${validColleges.length}/${processingResult.colleges.length} colleges`, 'INFO');
      }

      // Remove duplicates if enabled
      let finalColleges = validColleges;
      let duplicatesRemoved = 0;

      if (this.config.removeDuplicates && validationResult?.duplicates) {
        const { colleges, removed } = this.removeDuplicates(validColleges, validationResult.duplicates);
        finalColleges = colleges;
        duplicatesRemoved = removed;
        await this.log(`🔍 Removed ${duplicatesRemoved} duplicates`, 'INFO');
      }

      // Export data
      const exportedFiles = await this.exportData(finalColleges, processingResult.references);

      // Generate reports
      const reportFiles = this.config.generateReports 
        ? await this.generateReports(processingResult, validationResult, finalColleges)
        : [];

      const totalTime = Date.now() - startTime;
      await this.log(`✅ Pipeline completed successfully in ${totalTime}ms`, 'INFO');

      return {
        success: true,
        summary: {
          totalColleges: processingResult.colleges.length,
          validColleges: finalColleges.length,
          duplicatesRemoved,
          processingTime: totalTime
        },
        colleges: finalColleges,
        references: processingResult.references,
        validationStats: validationResult?.stats,
        files: {
          dataFiles: exportedFiles,
          reportFiles
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.log(`❌ Pipeline failed: ${errorMessage}`, 'ERROR');
      
      return {
        success: false,
        summary: {
          totalColleges: 0,
          validColleges: 0,
          duplicatesRemoved: 0,
          processingTime: Date.now() - startTime
        },
        colleges: [],
        references: { states: [], quotas: [], categories: [] },
        files: { dataFiles: [], reportFiles: [] },
        errors: [errorMessage]
      };
    }
  }

  private async initialize(): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    // Initialize processor
    await this.processor.initialize();
    
    await this.log('🔧 Pipeline components initialized', 'INFO');
  }

  private async validateData(colleges: CollegeData[]): Promise<{
    results: ValidationResult[];
    stats: ValidationStats;
    duplicates: any[];
  }> {
    await this.log('🔍 Starting data validation...', 'INFO');
    
    const validation = await this.validator.validateBatch(colleges);
    
    await this.log(`✅ Validation completed: ${validation.stats.valid}/${validation.stats.totalProcessed} valid`, 'INFO');
    
    return validation;
  }

  private removeDuplicates(colleges: CollegeData[], duplicates: any[]): {
    colleges: CollegeData[];
    removed: number;
  } {
    const duplicateIds = new Set<string>();
    
    // Identify colleges to remove (keep the one with higher confidence)
    duplicates.forEach(dup => {
      const college1Confidence = dup.college1.metadata.confidence;
      const college2Confidence = dup.college2.metadata.confidence;
      
      if (college1Confidence < college2Confidence) {
        duplicateIds.add(dup.college1.id);
      } else {
        duplicateIds.add(dup.college2.id);
      }
    });

    const filteredColleges = colleges.filter(college => !duplicateIds.has(college.id));
    
    return {
      colleges: filteredColleges,
      removed: duplicateIds.size
    };
  }

  private async exportData(colleges: CollegeData[], references: ReferenceData): Promise<string[]> {
    const exportedFiles: string[] = [];
    
    await this.log('💾 Exporting processed data...', 'INFO');

    for (const format of this.config.exportFormats) {
      switch (format) {
        case 'json':
          const jsonFiles = await this.exportJSON(colleges, references);
          exportedFiles.push(...jsonFiles);
          break;
          
        case 'csv':
          const csvFiles = await this.exportCSV(colleges, references);
          exportedFiles.push(...csvFiles);
          break;
          
        case 'parquet':
          const parquetFiles = await this.exportParquet(colleges, references);
          exportedFiles.push(...parquetFiles);
          break;
      }
    }

    return exportedFiles;
  }

  private async exportJSON(colleges: CollegeData[], references: ReferenceData): Promise<string[]> {
    const files: string[] = [];

    // Export complete dataset
    await this.processor.exportToJSON({
      colleges,
      references,
      metadata: {
        exportTime: new Date().toISOString(),
        totalColleges: colleges.length,
        pipeline: 'data-transformation-v1'
      }
    }, 'complete-dataset');
    files.push('complete-dataset.json');

    // Export colleges by type
    const collegesByType = colleges.reduce((acc, college) => {
      if (!acc[college.type]) acc[college.type] = [];
      acc[college.type].push(college);
      return acc;
    }, {} as Record<string, CollegeData[]>);

    for (const [type, typeColleges] of Object.entries(collegesByType)) {
      await this.processor.exportToJSON(typeColleges, `colleges-${type.toLowerCase()}`);
      files.push(`colleges-${type.toLowerCase()}.json`);
    }

    // Export references separately
    await this.processor.exportToJSON(references, 'reference-data');
    files.push('reference-data.json');

    return files;
  }

  private async exportCSV(colleges: CollegeData[], references: ReferenceData): Promise<string[]> {
    const files: string[] = [];

    // Export main colleges CSV
    await this.processor.exportToCSV(colleges, 'colleges-complete');
    files.push('colleges-complete.csv');

    // Export by state
    const collegesByState = colleges.reduce((acc, college) => {
      const state = college.state || 'UNKNOWN';
      if (!acc[state]) acc[state] = [];
      acc[state].push(college);
      return acc;
    }, {} as Record<string, CollegeData[]>);

    // Only export top 10 states to avoid too many files
    const topStates = Object.entries(collegesByState)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 10);

    for (const [state, stateColleges] of topStates) {
      const filename = `colleges-${state.toLowerCase().replace(/\s+/g, '-')}`;
      await this.processor.exportToCSV(stateColleges, filename);
      files.push(`${filename}.csv`);
    }

    return files;
  }

  private async exportParquet(colleges: CollegeData[], references: ReferenceData): Promise<string[]> {
    // Note: This would require adding Parquet support to the processor
    // For now, we'll create a JSON file that can be converted to Parquet
    await this.processor.exportToJSON({
      colleges: colleges.map(c => ({
        id: c.id,
        name: c.name,
        cleanName: c.cleanName,
        type: c.type,
        state: c.state,
        city: c.city,
        pincode: c.pincode,
        confidence: c.metadata.confidence
      }))
    }, 'colleges-parquet-ready');
    
    return ['colleges-parquet-ready.json'];
  }

  private async generateReports(
    processingResult: any,
    validationResult: any,
    finalColleges: CollegeData[]
  ): Promise<string[]> {
    const reportFiles: string[] = [];
    
    await this.log('📋 Generating reports...', 'INFO');

    // Processing summary report
    const summaryReport = this.generateSummaryReport(processingResult, validationResult, finalColleges);
    await this.writeReport('processing-summary.txt', summaryReport);
    reportFiles.push('processing-summary.txt');

    // Data quality report
    if (validationResult) {
      const qualityReport = this.validator.generateValidationReport(
        validationResult.results,
        validationResult.stats,
        validationResult.duplicates
      );
      await this.writeReport('data-quality-report.txt', qualityReport);
      reportFiles.push('data-quality-report.txt');

      // Detailed validation results
      await this.processor.exportToJSON({
        validationStats: validationResult.stats,
        duplicates: validationResult.duplicates.slice(0, 100), // Top 100 duplicates
        invalidRecords: validationResult.results
          .filter((r: ValidationResult) => !r.isValid)
          .slice(0, 50) // Top 50 invalid records
      }, 'validation-details');
      reportFiles.push('validation-details.json');
    }

    // State-wise distribution report
    const stateReport = this.generateStateReport(finalColleges);
    await this.writeReport('state-distribution.txt', stateReport);
    reportFiles.push('state-distribution.txt');

    return reportFiles;
  }

  private generateSummaryReport(processingResult: any, validationResult: any, finalColleges: CollegeData[]): string {
    const report = [];
    
    report.push('=== EXCEL DATA PIPELINE SUMMARY REPORT ===\n');
    
    report.push(`🕒 Generated: ${new Date().toISOString()}\n`);
    
    report.push('📊 PROCESSING SUMMARY:');
    report.push(`Raw Excel Records: ${processingResult.summary.totalColleges}`);
    report.push(`Processing Time: ${processingResult.summary.totalTime}ms`);
    report.push('');
    
    report.push('📈 TYPE BREAKDOWN:');
    Object.entries(processingResult.summary.typeBreakdown).forEach(([type, count]) => {
      report.push(`${type}: ${count}`);
    });
    report.push('');
    
    report.push('🌍 TOP STATES:');
    const topStates = Object.entries(processingResult.summary.stateBreakdown)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10);
    topStates.forEach(([state, count]) => {
      report.push(`${state}: ${count}`);
    });
    report.push('');
    
    if (validationResult) {
      report.push('✅ VALIDATION RESULTS:');
      report.push(`Valid Records: ${validationResult.stats.valid}`);
      report.push(`Invalid Records: ${validationResult.stats.invalid}`);
      report.push(`Warnings: ${validationResult.stats.warnings}`);
      report.push(`Duplicates Found: ${validationResult.stats.duplicatesFound}`);
      report.push('');
    }
    
    report.push('🎯 FINAL DATASET:');
    report.push(`Total Colleges: ${finalColleges.length}`);
    report.push(`Success Rate: ${((finalColleges.length / processingResult.summary.totalColleges) * 100).toFixed(1)}%`);
    
    const confidenceDistribution = finalColleges.reduce((acc, college) => {
      const conf = college.metadata.confidence;
      if (conf > 0.8) acc.high++;
      else if (conf >= 0.5) acc.medium++;
      else acc.low++;
      return acc;
    }, { high: 0, medium: 0, low: 0 });
    
    report.push(`High Confidence: ${confidenceDistribution.high}`);
    report.push(`Medium Confidence: ${confidenceDistribution.medium}`);
    report.push(`Low Confidence: ${confidenceDistribution.low}`);
    
    return report.join('\n');
  }

  private generateStateReport(colleges: CollegeData[]): string {
    const report = [];
    
    report.push('=== STATE-WISE COLLEGE DISTRIBUTION ===\n');
    
    const stateStats = colleges.reduce((acc, college) => {
      const state = college.state || 'UNKNOWN';
      if (!acc[state]) {
        acc[state] = { total: 0, medical: 0, dental: 0, dnb: 0 };
      }
      acc[state].total++;
      acc[state][college.type.toLowerCase() as 'medical' | 'dental' | 'dnb']++;
      return acc;
    }, {} as Record<string, any>);

    const sortedStates = Object.entries(stateStats)
      .sort(([,a], [,b]) => b.total - a.total);

    sortedStates.forEach(([state, stats]) => {
      report.push(`${state}: ${stats.total} total`);
      report.push(`  Medical: ${stats.medical}, Dental: ${stats.dental}, DNB: ${stats.dnb}`);
      report.push('');
    });

    return report.join('\n');
  }

  private async writeReport(filename: string, content: string): Promise<void> {
    const filePath = path.join(this.config.outputDir, filename);
    await fs.writeFile(filePath, content);
    await this.log(`📄 Generated report: ${filename}`, 'INFO');
  }

  private async log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;
    
    console.log(message);
    
    try {
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

export default DataTransformationPipeline;