#!/usr/bin/env tsx

import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs/promises';
import Joi from 'joi';

export interface ProcessingResult {
  success: boolean;
  data?: any[];
  errors?: string[];
  warnings?: string[];
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicates: number;
    processingTime: number;
  };
}

export interface CollegeData {
  id: string;
  name: string;
  cleanName: string;
  type: 'MEDICAL' | 'DENTAL' | 'DNB';
  state?: string;
  city?: string;
  address?: string;
  pincode?: string;
  isActive: boolean;
  sourceFile: string;
  metadata: {
    originalName: string;
    extractedInfo?: any;
    confidence: number;
  };
}

export interface ReferenceData {
  states: string[];
  quotas: string[];
  categories: string[];
}

export class ExcelProcessor {
  private dataDir: string;
  private outputDir: string;
  private logFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data/Foundation');
    this.outputDir = path.join(process.cwd(), 'data/processed');
    this.logFile = path.join(this.outputDir, 'processing.log');
  }

  async initialize(): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Clear previous log
    await this.log('🚀 Excel Processing Pipeline Initialized', 'INFO');
  }

  async processAllExcelFiles(): Promise<{
    colleges: CollegeData[];
    references: ReferenceData;
    summary: any;
  }> {
    const startTime = Date.now();
    await this.log('📊 Starting comprehensive Excel data processing...', 'INFO');

    try {
      // Process reference data first
      const references = await this.processReferenceData();
      
      // Process college data
      const colleges = await this.processCollegeData(references);

      // Generate summary
      const summary = this.generateProcessingSummary(colleges, references, startTime);
      
      await this.log(`✅ Processing completed in ${summary.totalTime}ms`, 'INFO');
      
      return { colleges, references, summary };

    } catch (error) {
      await this.log(`❌ Processing failed: ${error}`, 'ERROR');
      throw error;
    }
  }

  private async processReferenceData(): Promise<ReferenceData> {
    await this.log('📋 Processing reference data...', 'INFO');

    const [states, quotas, categories] = await Promise.all([
      this.processStatesFile(),
      this.processQuotasFile(),
      this.processCategoriesFile()
    ]);

    return { states, quotas, categories };
  }

  private async processStatesFile(): Promise<string[]> {
    const filePath = path.join(this.dataDir, 'STATES OF INDIA.xlsx');
    const result = await this.readExcelFile(filePath);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to process states file');
    }

    return result.data
      .map((row: any) => row['STATES OF INDIA'])
      .filter(state => state && typeof state === 'string')
      .map(state => state.trim().toUpperCase());
  }

  private async processQuotasFile(): Promise<string[]> {
    const filePath = path.join(this.dataDir, 'QUOTA.xlsx');
    const result = await this.readExcelFile(filePath);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to process quotas file');
    }

    return result.data
      .map((row: any) => row['QUOTA'])
      .filter(quota => quota && typeof quota === 'string')
      .map(quota => quota.trim().toUpperCase());
  }

  private async processCategoriesFile(): Promise<string[]> {
    const filePath = path.join(this.dataDir, 'CATEGORY.xlsx');
    const result = await this.readExcelFile(filePath);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to process categories file');
    }

    return result.data
      .map((row: any) => row['CATEGORY'])
      .filter(category => category && typeof category === 'string')
      .map(category => category.trim().toUpperCase());
  }

  private async processCollegeData(references: ReferenceData): Promise<CollegeData[]> {
    await this.log('🏥 Processing college data...', 'INFO');

    const collegeFiles = [
      { file: 'medical.xlsx', type: 'MEDICAL' as const, column: 'medical colleges' },
      { file: 'dental.xlsx', type: 'DENTAL' as const, column: 'dental colleges' },
      { file: 'dnb.xlsx', type: 'DNB' as const, column: 'dnb colleges' }
    ];

    const allColleges: CollegeData[] = [];

    for (const { file, type, column } of collegeFiles) {
      await this.log(`📄 Processing ${file}...`, 'INFO');
      
      const filePath = path.join(this.dataDir, file);
      const result = await this.readExcelFile(filePath);

      if (!result.success || !result.data) {
        await this.log(`⚠️ Failed to process ${file}`, 'WARN');
        continue;
      }

      const processedColleges = await this.processCollegeFile(
        result.data,
        column,
        type,
        file,
        references
      );

      allColleges.push(...processedColleges);
      await this.log(`✅ Processed ${processedColleges.length} colleges from ${file}`, 'INFO');
    }

    // Remove duplicates and validate
    const uniqueColleges = this.removeDuplicates(allColleges);
    await this.log(`🔍 Removed ${allColleges.length - uniqueColleges.length} duplicates`, 'INFO');

    return uniqueColleges;
  }

  private async processCollegeFile(
    data: any[],
    columnName: string,
    type: 'MEDICAL' | 'DENTAL' | 'DNB',
    sourceFile: string,
    references: ReferenceData
  ): Promise<CollegeData[]> {
    const colleges: CollegeData[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawName = row[columnName];

      if (!rawName || typeof rawName !== 'string') {
        continue;
      }

      try {
        const college = await this.parseCollegeData(rawName.trim(), type, sourceFile, references);
        colleges.push(college);
      } catch (error) {
        await this.log(`❌ Error processing row ${i + 1} in ${sourceFile}: ${error}`, 'ERROR');
      }
    }

    return colleges;
  }

  private async parseCollegeData(
    rawName: string,
    type: 'MEDICAL' | 'DENTAL' | 'DNB',
    sourceFile: string,
    references: ReferenceData
  ): Promise<CollegeData> {
    // Extract location information
    const locationInfo = this.extractLocationInfo(rawName, references.states);
    
    // Generate unique ID
    const id = this.generateCollegeId(rawName, type);
    
    // Clean college name
    const cleanName = this.cleanCollegeName(rawName, locationInfo);

    return {
      id,
      name: rawName,
      cleanName,
      type,
      state: locationInfo.state,
      city: locationInfo.city,
      address: locationInfo.address,
      pincode: locationInfo.pincode,
      isActive: true,
      sourceFile,
      metadata: {
        originalName: rawName,
        extractedInfo: locationInfo,
        confidence: locationInfo.confidence
      }
    };
  }

  private extractLocationInfo(name: string, states: string[]): {
    state?: string;
    city?: string;
    address?: string;
    pincode?: string;
    confidence: number;
  } {
    const upperName = name.toUpperCase();
    let confidence = 0;

    // Extract pincode
    const pincodeMatch = name.match(/\b(\d{6})\b/);
    const pincode = pincodeMatch ? pincodeMatch[1] : undefined;
    if (pincode) confidence += 0.2;

    // Extract state
    let state: string | undefined;
    for (const stateName of states) {
      if (upperName.includes(stateName)) {
        state = stateName;
        confidence += 0.4;
        break;
      }
    }

    // Extract city (heuristic approach)
    const cityPatterns = [
      /,\s*([A-Z][A-Z\s]+?),?\s*(?:\d{6}|\w+\s*-\s*\d{6})/,
      /,\s*([A-Z][A-Z\s]+?),?\s*(?:HARYANA|PUNJAB|DELHI|GUJARAT|MAHARASHTRA)/i
    ];

    let city: string | undefined;
    for (const pattern of cityPatterns) {
      const match = name.match(pattern);
      if (match && match[1]) {
        city = match[1].trim();
        confidence += 0.2;
        break;
      }
    }

    // Extract address (everything after college name)
    let address: string | undefined;
    const collegeNameEnd = name.search(/,\s*[A-Z]/);
    if (collegeNameEnd > 0) {
      address = name.substring(collegeNameEnd + 1).trim();
      confidence += 0.2;
    }

    return { state, city, address, pincode, confidence };
  }

  private cleanCollegeName(name: string, locationInfo: any): string {
    let cleaned = name;

    // Remove location information from the end
    if (locationInfo.address) {
      const addressIndex = name.lastIndexOf(locationInfo.address);
      if (addressIndex > 0) {
        cleaned = name.substring(0, addressIndex).trim();
      }
    }

    // Remove common suffixes and clean up
    cleaned = cleaned
      .replace(/,?\s*$/, '') // trailing commas/spaces
      .replace(/\s+/g, ' ')  // multiple spaces
      .trim();

    return cleaned;
  }

  private generateCollegeId(name: string, type: string): string {
    // Create a deterministic ID based on name and type
    const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hash = this.simpleHash(cleanName + type);
    return `${type.toLowerCase()}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private removeDuplicates(colleges: CollegeData[]): CollegeData[] {
    const seen = new Set<string>();
    const unique: CollegeData[] = [];

    for (const college of colleges) {
      const key = `${college.cleanName}_${college.type}_${college.state || 'UNKNOWN'}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(college);
      }
    }

    return unique;
  }

  private async readExcelFile(filePath: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      return {
        success: true,
        data,
        stats: {
          totalRows: data.length,
          validRows: data.length,
          invalidRows: 0,
          duplicates: 0,
          processingTime: Date.now() - startTime
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        stats: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          duplicates: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private generateProcessingSummary(colleges: CollegeData[], references: ReferenceData, startTime: number) {
    const totalTime = Date.now() - startTime;
    
    const typeBreakdown = colleges.reduce((acc, college) => {
      acc[college.type] = (acc[college.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stateBreakdown = colleges.reduce((acc, college) => {
      const state = college.state || 'UNKNOWN';
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTime,
      totalColleges: colleges.length,
      typeBreakdown,
      stateBreakdown,
      referenceData: {
        states: references.states.length,
        quotas: references.quotas.length,
        categories: references.categories.length
      },
      dataQuality: {
        withState: colleges.filter(c => c.state).length,
        withCity: colleges.filter(c => c.city).length,
        withPincode: colleges.filter(c => c.pincode).length,
        highConfidence: colleges.filter(c => c.metadata.confidence > 0.5).length
      }
    };
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

  async exportToJSON(data: any, filename: string): Promise<void> {
    const filePath = path.join(this.outputDir, `${filename}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    await this.log(`💾 Exported data to ${filename}.json`, 'INFO');
  }

  async exportToCSV(colleges: CollegeData[], filename: string): Promise<void> {
    const headers = [
      'id', 'name', 'cleanName', 'type', 'state', 'city', 
      'address', 'pincode', 'isActive', 'sourceFile', 'confidence'
    ];

    const csvData = [
      headers.join(','),
      ...colleges.map(college => [
        college.id,
        `"${college.name.replace(/"/g, '""')}"`,
        `"${college.cleanName.replace(/"/g, '""')}"`,
        college.type,
        college.state || '',
        college.city || '',
        `"${(college.address || '').replace(/"/g, '""')}"`,
        college.pincode || '',
        college.isActive,
        college.sourceFile,
        college.metadata.confidence
      ].join(','))
    ].join('\n');

    const filePath = path.join(this.outputDir, `${filename}.csv`);
    await fs.writeFile(filePath, csvData);
    await this.log(`💾 Exported data to ${filename}.csv`, 'INFO');
  }
}

export default ExcelProcessor;