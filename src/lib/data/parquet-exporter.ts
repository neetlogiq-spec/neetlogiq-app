#!/usr/bin/env tsx

import * as parquet from 'parquetjs';
import path from 'path';
import fs from 'fs/promises';
import { CollegeData, ReferenceData } from './excel-processor';

export interface ParquetExportConfig {
  outputDir: string;
  compressionType: 'GZIP' | 'SNAPPY' | 'LZO' | 'UNCOMPRESSED';
  batchSize: number;
  splitByType: boolean;
  splitByState: boolean;
  maxStatesPerFile: number;
}

export class ParquetExporter {
  private config: ParquetExportConfig;
  private logFile: string;

  constructor(config: Partial<ParquetExportConfig> = {}) {
    this.config = {
      outputDir: path.join(process.cwd(), 'data/parquet'),
      compressionType: 'GZIP',
      batchSize: 10000,
      splitByType: true,
      splitByState: false,
      maxStatesPerFile: 10,
      ...config
    };
    
    this.logFile = path.join(this.config.outputDir, 'parquet-export.log');
  }

  async exportCollegesToParquet(colleges: CollegeData[]): Promise<string[]> {
    await this.log('🚀 Starting Parquet export process...', 'INFO');
    
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });

    const exportedFiles: string[] = [];

    if (this.config.splitByType) {
      // Export by college type
      const typeFiles = await this.exportByType(colleges);
      exportedFiles.push(...typeFiles);
    } else {
      // Export as single file
      const mainFile = await this.exportSingleFile(colleges, 'colleges-complete');
      exportedFiles.push(mainFile);
    }

    if (this.config.splitByState) {
      // Export by state
      const stateFiles = await this.exportByState(colleges);
      exportedFiles.push(...stateFiles);
    }

    await this.log(`✅ Parquet export completed. Generated ${exportedFiles.length} files`, 'INFO');
    return exportedFiles;
  }

  async exportReferencesToParquet(references: ReferenceData): Promise<string[]> {
    const exportedFiles: string[] = [];

    // Export states
    if (references.states.length > 0) {
      const statesData = references.states.map((state, index) => ({
        id: index + 1,
        name: state,
        isActive: true
      }));
      const statesFile = await this.exportSingleFile(statesData, 'reference-states');
      exportedFiles.push(statesFile);
    }

    // Export quotas
    if (references.quotas.length > 0) {
      const quotasData = references.quotas.map((quota, index) => ({
        id: index + 1,
        name: quota,
        type: this.determineQuotaType(quota),
        isActive: true
      }));
      const quotasFile = await this.exportSingleFile(quotasData, 'reference-quotas');
      exportedFiles.push(quotasFile);
    }

    // Export categories
    if (references.categories.length > 0) {
      const categoriesData = references.categories.map((category, index) => ({
        id: index + 1,
        name: category,
        type: this.determineCategoryType(category),
        isActive: true
      }));
      const categoriesFile = await this.exportSingleFile(categoriesData, 'reference-categories');
      exportedFiles.push(categoriesFile);
    }

    return exportedFiles;
  }

  private async exportByType(colleges: CollegeData[]): Promise<string[]> {
    const files: string[] = [];
    const collegesByType = colleges.reduce((acc, college) => {
      if (!acc[college.type]) acc[college.type] = [];
      acc[college.type].push(college);
      return acc;
    }, {} as Record<string, CollegeData[]>);

    for (const [type, typeColleges] of Object.entries(collegesByType)) {
      const filename = `colleges-${type.toLowerCase()}`;
      const file = await this.exportSingleFile(typeColleges, filename);
      files.push(file);
      await this.log(`📄 Exported ${typeColleges.length} ${type} colleges to Parquet`, 'INFO');
    }

    return files;
  }

  private async exportByState(colleges: CollegeData[]): Promise<string[]> {
    const files: string[] = [];
    const collegesByState = colleges.reduce((acc, college) => {
      const state = college.state || 'UNKNOWN';
      if (!acc[state]) acc[state] = [];
      acc[state].push(college);
      return acc;
    }, {} as Record<string, CollegeData[]>);

    // Sort states by number of colleges and take top N
    const topStates = Object.entries(collegesByState)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, this.config.maxStatesPerFile);

    for (const [state, stateColleges] of topStates) {
      const filename = `colleges-state-${state.toLowerCase().replace(/\s+/g, '-')}`;
      const file = await this.exportSingleFile(stateColleges, filename);
      files.push(file);
      await this.log(`📍 Exported ${stateColleges.length} colleges from ${state} to Parquet`, 'INFO');
    }

    return files;
  }

  private async exportSingleFile(data: any[], filename: string): Promise<string> {
    const filePath = path.join(this.config.outputDir, `${filename}.parquet`);

    // Determine schema based on data type
    let schema: any;
    if (data.length > 0 && this.isCollegeData(data[0])) {
      schema = this.getCollegeSchema();
    } else {
      schema = this.getReferenceSchema();
    }

    // Create writer
    const writer = await parquet.ParquetWriter.openFile(schema, filePath, {
      compression: this.config.compressionType
    });

    // Write data in batches
    const batchSize = this.config.batchSize;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const record of batch) {
        const parquetRecord = this.transformToParquetRecord(record);
        await writer.appendRow(parquetRecord);
      }
      
      await this.log(`📦 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)} for ${filename}`, 'INFO');
    }

    // Close writer
    await writer.close();

    // Get file stats
    const stats = await fs.stat(filePath);
    await this.log(`💾 Created ${filename}.parquet (${this.formatFileSize(stats.size)})`, 'INFO');

    return `${filename}.parquet`;
  }

  private getCollegeSchema(): any {
    return new parquet.ParquetSchema({
      id: { type: 'UTF8' },
      name: { type: 'UTF8' },
      cleanName: { type: 'UTF8' },
      type: { type: 'UTF8' },
      state: { type: 'UTF8', optional: true },
      city: { type: 'UTF8', optional: true },
      address: { type: 'UTF8', optional: true },
      pincode: { type: 'UTF8', optional: true },
      isActive: { type: 'BOOLEAN' },
      sourceFile: { type: 'UTF8' },
      confidence: { type: 'FLOAT' },
      createdAt: { type: 'TIMESTAMP_MILLIS' }
    });
  }

  private getReferenceSchema(): any {
    return new parquet.ParquetSchema({
      id: { type: 'INT32' },
      name: { type: 'UTF8' },
      type: { type: 'UTF8', optional: true },
      isActive: { type: 'BOOLEAN' }
    });
  }

  private transformToParquetRecord(data: any): any {
    if (this.isCollegeData(data)) {
      return {
        id: data.id,
        name: data.name,
        cleanName: data.cleanName,
        type: data.type,
        state: data.state || null,
        city: data.city || null,
        address: data.address || null,
        pincode: data.pincode || null,
        isActive: data.isActive,
        sourceFile: data.sourceFile,
        confidence: data.metadata.confidence,
        createdAt: new Date()
      };
    } else {
      return {
        id: data.id,
        name: data.name,
        type: data.type || null,
        isActive: data.isActive
      };
    }
  }

  private isCollegeData(data: any): data is CollegeData {
    return 'cleanName' in data && 'metadata' in data;
  }

  private determineQuotaType(quota: string): string {
    const upperQuota = quota.toUpperCase();
    if (upperQuota.includes('ALL INDIA')) return 'ALL_INDIA';
    if (upperQuota.includes('DNB')) return 'DNB';
    if (upperQuota.includes('UNIVERSITY')) return 'UNIVERSITY';
    return 'STATE';
  }

  private determineCategoryType(category: string): string {
    const upperCategory = category.toUpperCase();
    if (upperCategory.includes('PWD')) return 'PWD';
    if (upperCategory.includes('OBC') || upperCategory.includes('SC') || 
        upperCategory.includes('ST') || upperCategory.includes('EWS')) return 'RESERVED';
    return 'GENERAL';
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Utility method to create optimized Parquet files for Cloudflare R2
  async createCloudflareOptimizedParquet(
    colleges: CollegeData[],
    references: ReferenceData
  ): Promise<{
    files: string[];
    manifest: any;
  }> {
    await this.log('☁️ Creating Cloudflare R2 optimized Parquet files...', 'INFO');

    const files: string[] = [];
    const manifest = {
      version: '1.0',
      created: new Date().toISOString(),
      totalColleges: colleges.length,
      files: [] as any[]
    };

    // Create main colleges file (compressed)
    const mainColleges = colleges.map(c => ({
      id: c.id,
      name: c.cleanName, // Use clean name for better querying
      type: c.type,
      state: c.state,
      city: c.city,
      pincode: c.pincode,
      confidence: Math.round(c.metadata.confidence * 100) / 100 // Round to 2 decimal places
    }));

    const mainFile = await this.exportSingleFile(mainColleges, 'colleges-main');
    files.push(mainFile);
    
    const mainStats = await fs.stat(path.join(this.config.outputDir, mainFile));
    manifest.files.push({
      name: mainFile,
      type: 'colleges',
      records: mainColleges.length,
      size: mainStats.size,
      compression: this.config.compressionType
    });

    // Create type-specific files
    const typeFiles = await this.exportByType(colleges);
    files.push(...typeFiles);

    for (const typeFile of typeFiles) {
      const typeStats = await fs.stat(path.join(this.config.outputDir, typeFile));
      const type = typeFile.replace('colleges-', '').replace('.parquet', '');
      const typeColleges = colleges.filter(c => c.type.toLowerCase() === type);
      
      manifest.files.push({
        name: typeFile,
        type: 'colleges_by_type',
        filter: type,
        records: typeColleges.length,
        size: typeStats.size,
        compression: this.config.compressionType
      });
    }

    // Create reference files
    const refFiles = await this.exportReferencesToParquet(references);
    files.push(...refFiles);

    for (const refFile of refFiles) {
      const refStats = await fs.stat(path.join(this.config.outputDir, refFile));
      manifest.files.push({
        name: refFile,
        type: 'reference',
        size: refStats.size,
        compression: this.config.compressionType
      });
    }

    // Write manifest
    const manifestPath = path.join(this.config.outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    files.push('manifest.json');

    await this.log(`✅ Created ${files.length} Cloudflare optimized files`, 'INFO');

    return { files, manifest };
  }

  // Utility to read Parquet files (for testing/verification)
  async readParquetFile(filename: string): Promise<any[]> {
    const filePath = path.join(this.config.outputDir, filename);
    
    try {
      const reader = await parquet.ParquetReader.openFile(filePath);
      const cursor = reader.getCursor();
      
      const records: any[] = [];
      let record = null;
      
      while (record = await cursor.next()) {
        records.push(record);
      }
      
      await reader.close();
      return records;
      
    } catch (error) {
      await this.log(`❌ Error reading Parquet file ${filename}: ${error}`, 'ERROR');
      throw error;
    }
  }

  // Generate Parquet export summary
  async generateExportSummary(exportedFiles: string[]): Promise<string> {
    const report = [];
    
    report.push('=== PARQUET EXPORT SUMMARY ===\n');
    report.push(`Generated: ${new Date().toISOString()}\n`);
    
    let totalSize = 0;
    let totalRecords = 0;

    for (const file of exportedFiles) {
      if (file === 'manifest.json') continue;
      
      try {
        const filePath = path.join(this.config.outputDir, file);
        const stats = await fs.stat(filePath);
        const records = await this.readParquetFile(file);
        
        report.push(`📄 ${file}:`);
        report.push(`   Records: ${records.length}`);
        report.push(`   Size: ${this.formatFileSize(stats.size)}`);
        report.push(`   Compression: ${this.config.compressionType}`);
        report.push('');
        
        totalSize += stats.size;
        totalRecords += records.length;
        
      } catch (error) {
        report.push(`❌ Error reading ${file}: ${error}`);
        report.push('');
      }
    }

    report.push('📊 TOTALS:');
    report.push(`Files: ${exportedFiles.filter(f => f.endsWith('.parquet')).length}`);
    report.push(`Records: ${totalRecords}`);
    report.push(`Total Size: ${this.formatFileSize(totalSize)}`);

    return report.join('\n');
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

export default ParquetExporter;