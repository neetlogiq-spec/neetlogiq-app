/**
 * Data Import Pipeline for NeetLogIQ
 * Handles Excel files, pivot data, and counselling data transformation
 * Implements rank processing: single rank → opening/closing rank
 */

import * as XLSX from 'xlsx';
import { HierarchicalMatcher } from './hierarchical-matcher';

interface FoundationData {
  states: Array<{name: string; code: string; region?: string}>;
  categories: Array<{name: string; code: string; description?: string}>;
  quotas: Array<{name: string; code: string; description?: string}>;
  courses: Array<{name: string; code: string; level: string; domain: string; duration_years?: number}>;
  universities: Array<{name: string; code?: string; state: string; type?: string; is_dnb?: boolean}>;
}

interface CollegeCourseData {
  state: string;
  college_institute: string;
  address?: string;
  university_affiliation?: string;
  management?: string;
  course: string;
  seats: number;
}

interface RawCounsellingData {
  ALL_INDIA_RANK?: number;
  QUOTA: string;
  'COLLEGE/INSTITUTE': string;
  STATE: string;
  COURSE: string;
  CATEGORY: string;
  ROUND: string;
  YEAR: number;
}

interface ProcessedCounsellingData {
  state: string;
  college_name: string;
  course: string;
  year: number;
  round: string;
  quota: string;
  category: string;
  opening_rank: number;
  closing_rank: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  recordsProcessed: number;
  recordsImported: number;
  errors: string[];
  stats?: {
    matchingAccuracy: number;
    processingTimeMs: number;
  };
}

export class DataImporter {
  private hierarchicalMatcher: HierarchicalMatcher | null = null;

  constructor(matcher?: HierarchicalMatcher) {
    this.hierarchicalMatcher = matcher || null;
  }

  /**
   * Import foundation data from Excel files
   */
  async importFoundationData(filePath: string): Promise<ImportResult> {
    console.log('📂 Importing foundation data from:', filePath);
    const startTime = Date.now();

    try {
      const workbook = XLSX.readFile(filePath);
      const foundationData: FoundationData = {
        states: [],
        categories: [],
        quotas: [],
        courses: [],
        universities: []
      };

      // Process each worksheet
      for (const sheetName of workbook.SheetNames) {
        console.log(`📋 Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        switch (sheetName.toLowerCase()) {
          case 'states':
            foundationData.states = this.processStatesData(jsonData);
            break;
          case 'categories':
            foundationData.categories = this.processCategoriesData(jsonData);
            break;
          case 'quotas':
            foundationData.quotas = this.processQuotasData(jsonData);
            break;
          case 'courses':
            foundationData.courses = this.processCoursesData(jsonData);
            break;
          case 'universities':
            foundationData.universities = this.processUniversitiesData(jsonData);
            break;
        }
      }

      const processingTime = Date.now() - startTime;
      const totalRecords = Object.values(foundationData).reduce((sum, arr) => sum + arr.length, 0);

      console.log('✅ Foundation data import complete');
      return {
        success: true,
        message: 'Foundation data imported successfully',
        recordsProcessed: totalRecords,
        recordsImported: totalRecords,
        errors: [],
        stats: {
          matchingAccuracy: 1.0,
          processingTimeMs: processingTime
        }
      };

    } catch (error) {
      console.error('❌ Foundation data import failed:', error);
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        recordsProcessed: 0,
        recordsImported: 0,
        errors: [String(error)]
      };
    }
  }

  /**
   * Import college and course data from Excel files
   */
  async importCollegeCourseData(filePath: string): Promise<ImportResult> {
    console.log('🏥 Importing college/course data from:', filePath);
    const startTime = Date.now();

    try {
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // First sheet
      const rawData: CollegeCourseData[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📊 Processing ${rawData.length} college/course records...`);

      // Validate and process data
      const validatedData = this.validateCollegeCourseData(rawData);
      const errors: string[] = [];

      // Group by college for efficient processing
      const collegeGroups = this.groupByCollege(validatedData.valid);
      
      console.log(`🏗️ Found ${collegeGroups.size} unique colleges`);

      const processingTime = Date.now() - startTime;

      return {
        success: validatedData.errors.length === 0,
        message: `Processed ${validatedData.valid.length} college/course records`,
        recordsProcessed: rawData.length,
        recordsImported: validatedData.valid.length,
        errors: validatedData.errors,
        stats: {
          matchingAccuracy: validatedData.valid.length / rawData.length,
          processingTimeMs: processingTime
        }
      };

    } catch (error) {
      console.error('❌ College/course data import failed:', error);
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        recordsProcessed: 0,
        recordsImported: 0,
        errors: [String(error)]
      };
    }
  }

  /**
   * Import and process counselling data with hierarchical matching
   * Implements rank transformation: single rank → opening/closing rank
   */
  async importCounsellingData(filePath: string, batchSize: number = 1000): Promise<ImportResult> {
    console.log('🎯 Importing counselling data from:', filePath);
    const startTime = Date.now();

    if (!this.hierarchicalMatcher) {
      return {
        success: false,
        message: 'Hierarchical matcher not initialized',
        recordsProcessed: 0,
        recordsImported: 0,
        errors: ['Matcher not available']
      };
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: RawCounsellingData[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📊 Processing ${rawData.length} counselling records...`);

      // Step 1: Transform rank data structure
      const transformedData = await this.transformCounsellingData(rawData);
      console.log(`🔄 Transformed to ${transformedData.length} processed records`);

      // Step 2: Apply hierarchical matching in batches
      const matchedData = await this.hierarchicalMatcher.processBatch(
        transformedData.map(record => ({
          raw_college_name: record.college_name,
          state: record.state,
          course: record.course,
          year: record.year,
          round: record.round,
          quota: record.quota,
          category: record.category,
          rank: record.opening_rank
        })),
        batchSize,
        (processed, total) => {
          console.log(`⚡ Progress: ${processed}/${total} (${((processed/total)*100).toFixed(1)}%)`);
        }
      );

      const successfulMatches = matchedData.filter(result => result.match !== null);
      const matchingAccuracy = successfulMatches.length / matchedData.length;

      const processingTime = Date.now() - startTime;

      console.log('✅ Counselling data import complete');
      console.log(`📈 Matching accuracy: ${(matchingAccuracy * 100).toFixed(2)}%`);

      return {
        success: true,
        message: `Processed ${rawData.length} counselling records with ${(matchingAccuracy * 100).toFixed(2)}% matching accuracy`,
        recordsProcessed: rawData.length,
        recordsImported: successfulMatches.length,
        errors: [],
        stats: {
          matchingAccuracy,
          processingTimeMs: processingTime
        }
      };

    } catch (error) {
      console.error('❌ Counselling data import failed:', error);
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        recordsProcessed: 0,
        recordsImported: 0,
        errors: [String(error)]
      };
    }
  }

  /**
   * Transform counselling data from flat structure to hierarchical with rank processing
   * Converts: [category1, rank1, category2, rank2] → [{category1: {opening: rank1, closing: rank1}}]
   */
  private async transformCounsellingData(rawData: RawCounsellingData[]): Promise<ProcessedCounsellingData[]> {
    console.log('🔄 Transforming counselling data structure...');
    
    // Group by: state → college → year → round → course → quota
    const groupedData = new Map<string, {
      state: string;
      college_name: string;
      course: string;
      year: number;
      round: string;
      quota: string;
      categories: Map<string, number[]>; // category → [ranks...]
    }>();

    // First pass: group all data
    for (const record of rawData) {
      const key = `${record.STATE}|${record['COLLEGE/INSTITUTE']}|${record.YEAR}|${record.ROUND}|${record.COURSE}|${record.QUOTA}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, {
          state: record.STATE,
          college_name: record['COLLEGE/INSTITUTE'],
          course: record.COURSE,
          year: record.YEAR,
          round: record.ROUND,
          quota: record.QUOTA,
          categories: new Map()
        });
      }

      const group = groupedData.get(key)!;
      
      // Handle rank data (could be multiple ranks per category)
      if (record.ALL_INDIA_RANK && record.CATEGORY) {
        if (!group.categories.has(record.CATEGORY)) {
          group.categories.set(record.CATEGORY, []);
        }
        group.categories.get(record.CATEGORY)!.push(record.ALL_INDIA_RANK);
      }
    }

    // Second pass: process ranks and create final records
    const processedData: ProcessedCounsellingData[] = [];

    for (const group of groupedData.values()) {
      for (const [category, ranks] of group.categories.entries()) {
        if (ranks.length === 0) continue;

        // Sort ranks to determine opening (lowest) and closing (highest)
        const sortedRanks = ranks.sort((a, b) => a - b);
        const openingRank = sortedRanks[0];
        const closingRank = sortedRanks[sortedRanks.length - 1];

        processedData.push({
          state: group.state,
          college_name: group.college_name,
          course: group.course,
          year: group.year,
          round: group.round,
          quota: group.quota,
          category: category,
          opening_rank: openingRank,
          closing_rank: closingRank
        });

        // Debug logging for rank transformation
        if (ranks.length === 1) {
          console.log(`🔢 Single rank: ${category} = ${openingRank} (both opening/closing)`);
        } else {
          console.log(`🔢 Multiple ranks: ${category} = ${openingRank}-${closingRank} (${ranks.length} ranks)`);
        }
      }
    }

    console.log(`✅ Transformation complete: ${rawData.length} → ${processedData.length} records`);
    return processedData;
  }

  // Helper methods for processing foundation data
  private processStatesData(data: any[]): FoundationData['states'] {
    return data.map(row => ({
      name: String(row.name || row.State || '').trim(),
      code: String(row.code || row.Code || '').trim().toUpperCase(),
      region: row.region || row.Region || undefined
    })).filter(state => state.name && state.code);
  }

  private processCategoriesData(data: any[]): FoundationData['categories'] {
    return data.map(row => ({
      name: String(row.name || row.Category || '').trim(),
      code: String(row.code || row.Code || '').trim().toUpperCase(),
      description: row.description || row.Description || undefined
    })).filter(cat => cat.name && cat.code);
  }

  private processQuotasData(data: any[]): FoundationData['quotas'] {
    return data.map(row => ({
      name: String(row.name || row.Quota || '').trim(),
      code: String(row.code || row.Code || '').trim().toUpperCase(),
      description: row.description || row.Description || undefined
    })).filter(quota => quota.name && quota.code);
  }

  private processCoursesData(data: any[]): FoundationData['courses'] {
    return data.map(row => ({
      name: String(row.name || row.Course || '').trim(),
      code: String(row.code || row.Code || '').trim().toUpperCase(),
      level: String(row.level || row.Level || '').trim().toUpperCase(),
      domain: String(row.domain || row.Domain || '').trim().toUpperCase(),
      duration_years: row.duration_years || row.Duration || undefined
    })).filter(course => course.name && course.code && course.level && course.domain);
  }

  private processUniversitiesData(data: any[]): FoundationData['universities'] {
    return data.map(row => ({
      name: String(row.name || row.University || '').trim(),
      code: row.code || row.Code || undefined,
      state: String(row.state || row.State || '').trim(),
      type: row.type || row.Type || undefined,
      is_dnb: row.name?.includes('NBEMS') || row.is_dnb || false
    })).filter(uni => uni.name && uni.state);
  }

  private validateCollegeCourseData(data: CollegeCourseData[]): {valid: CollegeCourseData[]; errors: string[]} {
    const valid: CollegeCourseData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      
      if (!record.state || !record.college_institute || !record.course) {
        errors.push(`Row ${i + 1}: Missing required fields (state, college, course)`);
        continue;
      }

      if (isNaN(Number(record.seats)) || Number(record.seats) < 0) {
        errors.push(`Row ${i + 1}: Invalid seats value`);
        continue;
      }

      valid.push({
        ...record,
        seats: Number(record.seats)
      });
    }

    return { valid, errors };
  }

  private groupByCollege(data: CollegeCourseData[]): Map<string, CollegeCourseData[]> {
    const groups = new Map<string, CollegeCourseData[]>();
    
    for (const record of data) {
      const key = `${record.state}|${record.college_institute}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }
    
    return groups;
  }

  /**
   * Get import statistics and validation report
   */
  public generateImportReport(results: ImportResult[]): string {
    const totalProcessed = results.reduce((sum, r) => sum + r.recordsProcessed, 0);
    const totalImported = results.reduce((sum, r) => sum + r.recordsImported, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const avgAccuracy = results.reduce((sum, r) => sum + (r.stats?.matchingAccuracy || 0), 0) / results.length;

    return `
📊 IMPORT SUMMARY REPORT
========================
Total Records Processed: ${totalProcessed}
Total Records Imported: ${totalImported}
Success Rate: ${((totalImported / totalProcessed) * 100).toFixed(2)}%
Average Matching Accuracy: ${(avgAccuracy * 100).toFixed(2)}%
Total Errors: ${totalErrors}

📈 PERFORMANCE METRICS
======================
${results.map(r => `${r.message}: ${r.stats?.processingTimeMs || 0}ms`).join('\n')}

${totalErrors > 0 ? `\n❌ ERRORS ENCOUNTERED\n====================\n${results.flatMap(r => r.errors).join('\n')}` : '✅ No errors encountered'}
    `.trim();
  }
}