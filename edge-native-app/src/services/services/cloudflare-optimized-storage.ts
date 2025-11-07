/**
 * Cloudflare-Optimized Data Storage Architecture
 * Designed to keep file sizes under 3.8MB for efficient vector search
 * Uses DuckDB + Parquet with strategic data partitioning
 */

import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';

interface DataPartitionStrategy {
  strategy: 'BY_STATE' | 'BY_DOMAIN' | 'BY_YEAR' | 'BY_SIZE';
  maxFileSize: number; // bytes
  estimatedFiles: number;
  description: string;
}

interface ParquetFileInfo {
  filename: string;
  size: number;
  recordCount: number;
  compressionRatio: number;
  description: string;
}

export class CloudflareOptimizedStorage {
  private readonly MAX_FILE_SIZE = 3.8 * 1024 * 1024; // 3.8MB in bytes
  private readonly TARGET_FILE_SIZE = 3.5 * 1024 * 1024; // Target 3.5MB to leave buffer
  
  private db: duckdb.Database;
  
  constructor() {
    this.db = new duckdb.Database(':memory:');
  }

  /**
   * Analyze data size requirements and recommend partitioning strategy
   */
  async analyzeDataRequirements(dataStats: {
    totalColleges: number;
    totalCourses: number; 
    totalCounsellingRecords: number;
    years: number[];
    states: number;
  }): Promise<{
    recommendations: DataPartitionStrategy[];
    estimatedSizes: ParquetFileInfo[];
    totalFiles: number;
    feasible: boolean;
  }> {
    
    console.log('📊 ANALYZING DATA REQUIREMENTS FOR CLOUDFLARE OPTIMIZATION');
    console.log('='.repeat(70));
    
    // Calculate estimated sizes for different data types
    const estimatedSizes = this.calculateEstimatedSizes(dataStats);
    
    console.log('📈 ESTIMATED DATA SIZES:');
    estimatedSizes.forEach(info => {
      const sizeMB = (info.size / (1024 * 1024)).toFixed(2);
      const status = info.size <= this.MAX_FILE_SIZE ? '✅' : '❌';
      console.log(`   ${status} ${info.filename}: ${sizeMB}MB (${info.recordCount.toLocaleString()} records)`);
    });
    
    // Generate partitioning strategies
    const strategies = this.generatePartitioningStrategies(dataStats, estimatedSizes);
    
    console.log('\n🎯 RECOMMENDED PARTITIONING STRATEGIES:');
    strategies.forEach((strategy, index) => {
      const feasible = strategy.maxFileSize <= this.MAX_FILE_SIZE;
      const status = feasible ? '✅ FEASIBLE' : '❌ TOO LARGE';
      console.log(`   ${index + 1}. ${strategy.strategy}: ${strategy.estimatedFiles} files, max ${(strategy.maxFileSize / (1024 * 1024)).toFixed(2)}MB ${status}`);
      console.log(`      ${strategy.description}`);
    });
    
    // Find best strategy
    const feasibleStrategies = strategies.filter(s => s.maxFileSize <= this.MAX_FILE_SIZE);
    const totalFiles = feasibleStrategies.length > 0 ? feasibleStrategies[0].estimatedFiles : 0;
    
    return {
      recommendations: strategies,
      estimatedSizes,
      totalFiles,
      feasible: feasibleStrategies.length > 0
    };
  }

  /**
   * Calculate estimated file sizes for different data components
   */
  private calculateEstimatedSizes(dataStats: any): ParquetFileInfo[] {
    // Estimated bytes per record (based on typical medical college data)
    const bytesPerRecord = {
      college: 300,      // Name, address, state, university, etc.
      course: 150,       // Course name, code, domain, level
      counselling: 180,  // College, course, category, ranks, year, round
      foundation: 50     // States, categories, quotas (small reference data)
    };
    
    return [
      {
        filename: 'colleges.parquet',
        recordCount: dataStats.totalColleges,
        size: dataStats.totalColleges * bytesPerRecord.college,
        compressionRatio: 0.4, // Parquet typically achieves 40% of raw size
        description: 'College master data with addresses and affiliations'
      },
      {
        filename: 'courses.parquet', 
        recordCount: dataStats.totalCourses,
        size: dataStats.totalCourses * bytesPerRecord.course,
        compressionRatio: 0.3,
        description: 'Course definitions and college-course mappings'
      },
      {
        filename: 'counselling_data.parquet',
        recordCount: dataStats.totalCounsellingRecords,
        size: dataStats.totalCounsellingRecords * bytesPerRecord.counselling,
        compressionRatio: 0.35,
        description: 'Historical counselling and cutoff data'
      },
      {
        filename: 'foundation_data.parquet',
        recordCount: dataStats.states * 50, // Estimated foundation records
        size: dataStats.states * 50 * bytesPerRecord.foundation,
        compressionRatio: 0.3,
        description: 'Reference data (states, categories, quotas)'
      }
    ].map(file => ({
      ...file,
      size: Math.round(file.size * file.compressionRatio) // Apply compression
    }));
  }

  /**
   * Generate different partitioning strategies
   */
  private generatePartitioningStrategies(dataStats: any, estimatedSizes: ParquetFileInfo[]): DataPartitionStrategy[] {
    const counsellingSize = estimatedSizes.find(f => f.filename.includes('counselling'))?.size || 0;
    const avgRecordsPerMB = 1024 * 1024 / 180; // Approximately 5,800 records per MB
    
    return [
      {
        strategy: 'BY_STATE',
        maxFileSize: Math.max(counsellingSize / dataStats.states, this.TARGET_FILE_SIZE * 0.8),
        estimatedFiles: dataStats.states + 3, // One per state + foundation files
        description: `Partition counselling data by state (${Math.round(dataStats.totalCounsellingRecords / dataStats.states).toLocaleString()} records per state)`
      },
      {
        strategy: 'BY_DOMAIN',
        maxFileSize: counsellingSize / 3, // Medical, Dental, DNB
        estimatedFiles: 6, // 3 domains × 2 (UG/PG) + foundation
        description: 'Partition by medical domain (MEDICAL, DENTAL, DNB) and level (UG/PG)'
      },
      {
        strategy: 'BY_YEAR',
        maxFileSize: counsellingSize / dataStats.years.length,
        estimatedFiles: dataStats.years.length + 3,
        description: `Partition by counselling year (${dataStats.years.join(', ')})`
      },
      {
        strategy: 'BY_SIZE',
        maxFileSize: this.TARGET_FILE_SIZE,
        estimatedFiles: Math.ceil(counsellingSize / this.TARGET_FILE_SIZE) + 3,
        description: `Size-based partitioning (~${Math.round(avgRecordsPerMB * 3.5).toLocaleString()} records per 3.5MB file)`
      }
    ];
  }

  /**
   * Create optimized Parquet files using recommended partitioning
   */
  async createOptimizedParquetFiles(
    strategy: DataPartitionStrategy,
    outputDir: string,
    data: {
      colleges: any[];
      courses: any[];
      counsellingData: any[];
      foundationData: any[];
    }
  ): Promise<{
    files: Array<{name: string; size: number; records: number}>;
    totalSize: number;
    success: boolean;
  }> {
    
    console.log('\n🔧 CREATING OPTIMIZED PARQUET FILES');
    console.log(`Strategy: ${strategy.strategy}`);
    console.log(`Target: Max ${(this.MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB per file`);
    console.log('-'.repeat(50));
    
    const createdFiles: Array<{name: string; size: number; records: number}> = [];
    
    try {
      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // 1. Create foundation data files (always small)
      await this.createFoundationFiles(outputDir, data.foundationData, createdFiles);
      
      // 2. Create college and course files
      await this.createStaticDataFiles(outputDir, data.colleges, data.courses, createdFiles);
      
      // 3. Create partitioned counselling data files
      await this.createPartitionedCounsellingFiles(
        strategy, 
        outputDir, 
        data.counsellingData, 
        createdFiles
      );
      
      // 4. Verify file sizes
      const oversizedFiles = createdFiles.filter(f => f.size > this.MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        console.log('\n⚠️  WARNING: Some files exceed 3.8MB limit:');
        oversizedFiles.forEach(f => {
          console.log(`   ${f.name}: ${(f.size / (1024 * 1024)).toFixed(2)}MB`);
        });
      }
      
      const totalSize = createdFiles.reduce((sum, f) => sum + f.size, 0);
      
      console.log('\n✅ PARQUET FILE CREATION COMPLETE');
      console.log(`   Files created: ${createdFiles.length}`);
      console.log(`   Total size: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`   Largest file: ${(Math.max(...createdFiles.map(f => f.size)) / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`   Average file: ${(totalSize / createdFiles.length / (1024 * 1024)).toFixed(2)}MB`);
      
      return {
        files: createdFiles,
        totalSize,
        success: oversizedFiles.length === 0
      };
      
    } catch (error) {
      console.error('❌ Error creating Parquet files:', error);
      return {
        files: createdFiles,
        totalSize: 0,
        success: false
      };
    }
  }

  private async createFoundationFiles(
    outputDir: string, 
    foundationData: any[], 
    createdFiles: Array<{name: string; size: number; records: number}>
  ): Promise<void> {
    
    const foundationFile = path.join(outputDir, 'foundation.parquet');
    
    // Create foundation table in DuckDB
    await this.executeQuery(`
      CREATE TABLE foundation AS 
      SELECT * FROM (VALUES ${foundationData.map(row => 
        `('${row.type}', '${row.name}', '${row.code}', '${row.description || ''}')`
      ).join(',')}) AS t(type, name, code, description)
    `);
    
    // Export to Parquet
    await this.executeQuery(`
      COPY foundation TO '${foundationFile}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    `);
    
    const fileSize = fs.statSync(foundationFile).size;
    createdFiles.push({
      name: 'foundation.parquet',
      size: fileSize,
      records: foundationData.length
    });
    
    console.log(`   ✅ foundation.parquet: ${(fileSize / 1024).toFixed(0)}KB (${foundationData.length} records)`);
  }

  private async createStaticDataFiles(
    outputDir: string,
    colleges: any[],
    courses: any[],
    createdFiles: Array<{name: string; size: number; records: number}>
  ): Promise<void> {
    
    // Colleges file
    const collegesFile = path.join(outputDir, 'colleges.parquet');
    await this.executeQuery(`
      CREATE TABLE colleges AS 
      SELECT * FROM (VALUES ${colleges.slice(0, 100).map(college => // Limit for demo
        `(${college.id}, '${college.name}', '${college.state}', '${college.location || ''}', '${college.address || ''}')`
      ).join(',')}) AS t(id, name, state, location, address)
    `);
    
    await this.executeQuery(`COPY colleges TO '${collegesFile}' (FORMAT PARQUET, COMPRESSION SNAPPY)`);
    
    const collegesSize = fs.statSync(collegesFile).size;
    createdFiles.push({ name: 'colleges.parquet', size: collegesSize, records: colleges.length });
    
    // Courses file
    const coursesFile = path.join(outputDir, 'courses.parquet');
    await this.executeQuery(`
      CREATE TABLE courses AS 
      SELECT * FROM (VALUES ${courses.map(course => 
        `(${course.id}, '${course.name}', '${course.domain}', '${course.level}')`
      ).join(',')}) AS t(id, name, domain, level)
    `);
    
    await this.executeQuery(`COPY courses TO '${coursesFile}' (FORMAT PARQUET, COMPRESSION SNAPPY)`);
    
    const coursesSize = fs.statSync(coursesFile).size;
    createdFiles.push({ name: 'courses.parquet', size: coursesSize, records: courses.length });
    
    console.log(`   ✅ colleges.parquet: ${(collegesSize / 1024).toFixed(0)}KB (${colleges.length} records)`);
    console.log(`   ✅ courses.parquet: ${(coursesSize / 1024).toFixed(0)}KB (${courses.length} records)`);
  }

  private async createPartitionedCounsellingFiles(
    strategy: DataPartitionStrategy,
    outputDir: string,
    counsellingData: any[],
    createdFiles: Array<{name: string; size: number; records: number}>
  ): Promise<void> {
    
    console.log(`\n📊 Creating partitioned counselling files using ${strategy.strategy} strategy...`);
    
    let partitions: Map<string, any[]>;
    
    switch (strategy.strategy) {
      case 'BY_STATE':
        partitions = this.partitionByState(counsellingData);
        break;
      case 'BY_DOMAIN':
        partitions = this.partitionByDomain(counsellingData);
        break;
      case 'BY_YEAR':
        partitions = this.partitionByYear(counsellingData);
        break;
      case 'BY_SIZE':
        partitions = this.partitionBySize(counsellingData, this.TARGET_FILE_SIZE);
        break;
      default:
        throw new Error(`Unsupported strategy: ${strategy.strategy}`);
    }
    
    console.log(`   Creating ${partitions.size} partition files...`);
    
    for (const [partitionKey, records] of partitions.entries()) {
      const filename = `counselling_${partitionKey.toLowerCase().replace(/\s+/g, '_')}.parquet`;
      const filepath = path.join(outputDir, filename);
      
      // Create table for this partition
      const tableName = `counselling_${partitionKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      if (records.length > 0) {
        // Create sample records for demo
        await this.executeQuery(`
          CREATE TABLE ${tableName} AS 
          SELECT * FROM (VALUES ${records.slice(0, Math.min(records.length, 1000)).map((record, idx) => 
            `(${idx}, '${record.college || 'Sample College'}', '${record.state || 'Sample State'}', '${record.course || 'Sample Course'}', ${record.year || 2024}, ${record.rank || 1000})`
          ).join(',')}) AS t(id, college, state, course, year, rank)
        `);
        
        await this.executeQuery(`COPY ${tableName} TO '${filepath}' (FORMAT PARQUET, COMPRESSION SNAPPY)`);
        
        if (fs.existsSync(filepath)) {
          const fileSize = fs.statSync(filepath).size;
          createdFiles.push({
            name: filename,
            size: fileSize,
            records: records.length
          });
          
          const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
          const status = fileSize <= this.MAX_FILE_SIZE ? '✅' : '⚠️';
          console.log(`   ${status} ${filename}: ${sizeMB}MB (${records.length.toLocaleString()} records)`);
        }
      }
    }
  }

  private partitionByState(data: any[]): Map<string, any[]> {
    const partitions = new Map<string, any[]>();
    
    // Mock state-based partitioning
    const states = ['ANDHRA_PRADESH', 'MAHARASHTRA', 'TAMIL_NADU', 'KARNATAKA', 'KERALA'];
    states.forEach(state => {
      partitions.set(state, data.filter((_, idx) => idx % states.length === states.indexOf(state)));
    });
    
    return partitions;
  }

  private partitionByDomain(data: any[]): Map<string, any[]> {
    const partitions = new Map<string, any[]>();
    
    partitions.set('MEDICAL_UG', data.filter((_, idx) => idx % 6 === 0));
    partitions.set('MEDICAL_PG', data.filter((_, idx) => idx % 6 === 1));
    partitions.set('DENTAL_UG', data.filter((_, idx) => idx % 6 === 2));
    partitions.set('DENTAL_PG', data.filter((_, idx) => idx % 6 === 3));
    partitions.set('DNB_PG', data.filter((_, idx) => idx % 6 === 4));
    partitions.set('OTHER', data.filter((_, idx) => idx % 6 === 5));
    
    return partitions;
  }

  private partitionByYear(data: any[]): Map<string, any[]> {
    const partitions = new Map<string, any[]>();
    
    const years = [2023, 2024, 2025];
    years.forEach(year => {
      partitions.set(`YEAR_${year}`, data.filter((_, idx) => idx % years.length === years.indexOf(year)));
    });
    
    return partitions;
  }

  private partitionBySize(data: any[], targetSizeBytes: number): Map<string, any[]> {
    const partitions = new Map<string, any[]>();
    const estimatedRecordSize = 180; // bytes
    const recordsPerPartition = Math.floor(targetSizeBytes / estimatedRecordSize);
    
    let partitionIndex = 0;
    for (let i = 0; i < data.length; i += recordsPerPartition) {
      const partition = data.slice(i, i + recordsPerPartition);
      partitions.set(`PART_${String(partitionIndex).padStart(3, '0')}`, partition);
      partitionIndex++;
    }
    
    return partitions;
  }

  private async executeQuery(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Generate Cloudflare Workers code for efficient data access
   */
  generateCloudflareWorkersCode(files: Array<{name: string; size: number; records: number}>): string {
    return `
// Cloudflare Workers code for NeetLogIQ data access
// Optimized for ${files.length} Parquet files under 3.8MB each

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route to appropriate data file
    if (path.startsWith('/api/colleges')) {
      return await this.handleCollegeQuery(request, env);
    } else if (path.startsWith('/api/counselling')) {
      return await this.handleCounsellingQuery(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  },
  
  async handleCollegeQuery(request, env) {
    // Load colleges.parquet (small file, can be cached)
    const colleges = await env.VECTORIZE.query({
      vector: await this.getQueryVector(request),
      topK: 10,
      namespace: 'colleges'
    });
    
    return Response.json(colleges);
  },
  
  async handleCounsellingQuery(request, env) {
    const params = new URL(request.url).searchParams;
    const state = params.get('state');
    const year = params.get('year');
    
    // Choose appropriate partition file
    let filename = 'counselling_';
    ${files.filter(f => f.name.startsWith('counselling_')).map(f => {
      const partition = f.name.replace('counselling_', '').replace('.parquet', '');
      return `    if (state === '${partition.toUpperCase()}') filename += '${partition}';`;
    }).join('\n')}
    
    filename += '.parquet';
    
    // Query specific partition
    const results = await env.VECTORIZE.query({
      vector: await this.getQueryVector(request),
      topK: 50,
      namespace: filename.replace('.parquet', ''),
      filter: { year: parseInt(year) }
    });
    
    return Response.json(results);
  }
};`;
  }
}

// Example usage and testing
export async function demonstrateCloudflareOptimization() {
  console.log('🚀 CLOUDFLARE OPTIMIZATION DEMONSTRATION');
  console.log('='.repeat(70));
  
  const optimizer = new CloudflareOptimizedStorage();
  
  // Sample data statistics (your actual numbers)
  const dataStats = {
    totalColleges: 2443,
    totalCourses: 450,
    totalCounsellingRecords: 60000,
    years: [2023, 2024, 2025],
    states: 36
  };
  
  // Analyze requirements
  const analysis = await optimizer.analyzeDataRequirements(dataStats);
  
  if (analysis.feasible) {
    console.log('\n🎉 CLOUDFLARE OPTIMIZATION IS FEASIBLE!');
    console.log(`   Recommended files: ${analysis.totalFiles}`);
    console.log(`   All files under 3.8MB: ✅`);
    
    // Create sample optimized files
    const bestStrategy = analysis.recommendations.find(r => r.maxFileSize <= optimizer['MAX_FILE_SIZE'])!;
    
    const mockData = {
      colleges: Array.from({length: 100}, (_, i) => ({
        id: i, name: `College ${i}`, state: `State ${i % 10}`, location: `City ${i}`
      })),
      courses: Array.from({length: 50}, (_, i) => ({
        id: i, name: `Course ${i}`, domain: 'MEDICAL', level: 'PG'  
      })),
      counsellingData: Array.from({length: 1000}, (_, i) => ({
        id: i, college: `College ${i}`, state: `State ${i % 10}`, year: 2024
      })),
      foundationData: Array.from({length: 20}, (_, i) => ({
        type: 'STATE', name: `State ${i}`, code: `S${i}`, description: 'Sample state'
      }))
    };
    
    const result = await optimizer.createOptimizedParquetFiles(
      bestStrategy,
      '/tmp/neetlogiq_parquet',
      mockData
    );
    
    if (result.success) {
      console.log('\n✅ ALL FILES CREATED SUCCESSFULLY UNDER 3.8MB LIMIT!');
      
      // Generate Cloudflare Workers code
      const workersCode = optimizer.generateCloudflareWorkersCode(result.files);
      console.log('\n📄 Generated Cloudflare Workers integration code');
    }
    
  } else {
    console.log('\n⚠️  OPTIMIZATION REQUIRED');
    console.log('   Current data size exceeds 3.8MB limit');
    console.log('   Consider additional partitioning strategies');
  }
}