#!/usr/bin/env node
/**
 * Create Partitioned Cutoff Parquet Files from SQLite Database
 * Splits cutoffs by round priority and creates compressed Parquet files
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

class PartitionedCutoffCreator {
  constructor() {
    this.dbPath = 'data/sqlite/counselling_data_partitioned.db';
    this.outputDir = 'data/parquet/cutoffs';
    this.compressionDir = 'data/compressed/cutoffs';
    this.db = null;
    
    // Round priorities for loading
    this.roundPriorities = {
      high: [1, 2],      // Load immediately
      medium: [3, 4],    // Load on demand
      low: [5, 6]        // Load in background
    };
    
    // Partition strategies
    this.partitionStrategies = {
      byRound: true,
      byYear: true,
      byState: false,    // Too many files
      byCounsellingBody: true
    };
  }

  async init() {
    console.log('🚀 Initializing Partitioned Cutoff Creator...');
    
    // Ensure output directories exist
    this.ensureDirectories();
    
    // Connect to database
    this.db = new sqlite3.Database(this.dbPath);
    console.log('✅ Connected to SQLite database');
  }

  ensureDirectories() {
    const dirs = [this.outputDir, this.compressionDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  async getCutoffData(rounds = null, year = 2024) {
    console.log(`📊 Fetching cutoff data for rounds: ${rounds || 'all'}, year: ${year}`);
    
    let query = `
      SELECT 
        id,
        all_india_rank as opening_rank,
        all_india_rank as closing_rank,
        quota,
        college_institute_normalized as college_name,
        state_normalized as state,
        course_normalized as course_name,
        category,
        round_normalized as round,
        year,
        source_normalized as counselling_body,
        level_normalized as level,
        master_college_id as college_id,
        master_course_id as course_id,
        master_state_id as state_id,
        master_quota_id as quota_id,
        master_category_id as category_id,
        created_at,
        updated_at
      FROM counselling_records 
      WHERE year = ? AND is_matched = 1
    `;
    
    const params = [year];
    
    if (rounds && rounds.length > 0) {
      query += ` AND round_normalized IN (${rounds.map(() => '?').join(',')})`;
      params.push(...rounds);
    }
    
    query += ' ORDER BY round_normalized, all_india_rank';
    
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createParquetFile(data, filename, compression = 'SNAPPY') {
    console.log(`📦 Creating Parquet file: ${filename}`);
    
    // For now, create JSON file (in real implementation, use Parquet library)
    const outputPath = path.join(this.outputDir, filename);
    const jsonData = JSON.stringify(data, null, 2);
    
    fs.writeFileSync(outputPath, jsonData);
    
    const stats = fs.statSync(outputPath);
    console.log(`✅ Created ${filename}: ${(stats.size / 1024).toFixed(1)}KB`);
    
    return {
      filename,
      path: outputPath,
      size: stats.size,
      records: data.length,
      compression
    };
  }

  async compressFile(inputPath, outputPath, algorithm = 'gzip') {
    console.log(`🗜️  Compressing ${path.basename(inputPath)} with ${algorithm}...`);
    
    const data = fs.readFileSync(inputPath);
    let compressed;
    
    switch (algorithm) {
      case 'gzip':
        compressed = require('zlib').gzipSync(data);
        break;
      case 'deflate':
        compressed = require('zlib').deflateSync(data);
        break;
      case 'brotli':
        compressed = require('zlib').brotliCompressSync(data);
        break;
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
    
    fs.writeFileSync(outputPath, compressed);
    
    const originalSize = data.length;
    const compressedSize = compressed.length;
    const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`✅ Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`);
    
    return {
      originalSize,
      compressedSize,
      ratio: parseFloat(ratio),
      algorithm
    };
  }

  async createRoundPartitions() {
    console.log('\n🎯 Creating Round-Based Partitions...');
    console.log('=====================================');
    
    const partitions = [];
    
    // High priority rounds (1, 2) - Load immediately
    console.log('📥 Creating HIGH priority partitions (Rounds 1-2)...');
    const highPriorityData = await this.getCutoffData(this.roundPriorities.high);
    
    if (highPriorityData.length > 0) {
      const highPriorityFile = await this.createParquetFile(
        highPriorityData, 
        'cutoffs_rounds_1_2_2024.parquet'
      );
      partitions.push({
        ...highPriorityFile,
        priority: 'high',
        rounds: this.roundPriorities.high,
        loadStrategy: 'immediate'
      });
      
      // Compress high priority file
      const compressedPath = path.join(this.compressionDir, 'cutoffs_rounds_1_2_2024.parquet.gz');
      await this.compressFile(highPriorityFile.path, compressedPath, 'gzip');
    }
    
    // Medium priority rounds (3, 4) - Load on demand
    console.log('📥 Creating MEDIUM priority partitions (Rounds 3-4)...');
    const mediumPriorityData = await this.getCutoffData(this.roundPriorities.medium);
    
    if (mediumPriorityData.length > 0) {
      const mediumPriorityFile = await this.createParquetFile(
        mediumPriorityData, 
        'cutoffs_rounds_3_4_2024.parquet'
      );
      partitions.push({
        ...mediumPriorityFile,
        priority: 'medium',
        rounds: this.roundPriorities.medium,
        loadStrategy: 'on-demand'
      });
      
      // Compress medium priority file
      const compressedPath = path.join(this.compressionDir, 'cutoffs_rounds_3_4_2024.parquet.gz');
      await this.compressFile(mediumPriorityFile.path, compressedPath, 'gzip');
    }
    
    // Low priority rounds (5, 6) - Load in background
    console.log('📥 Creating LOW priority partitions (Rounds 5-6)...');
    const lowPriorityData = await this.getCutoffData(this.roundPriorities.low);
    
    if (lowPriorityData.length > 0) {
      const lowPriorityFile = await this.createParquetFile(
        lowPriorityData, 
        'cutoffs_rounds_5_6_2024.parquet'
      );
      partitions.push({
        ...lowPriorityFile,
        priority: 'low',
        rounds: this.roundPriorities.low,
        loadStrategy: 'background'
      });
      
      // Compress low priority file
      const compressedPath = path.join(this.compressionDir, 'cutoffs_rounds_5_6_2024.parquet.gz');
      await this.compressFile(lowPriorityFile.path, compressedPath, 'gzip');
    }
    
    return partitions;
  }

  async createCounsellingBodyPartitions() {
    console.log('\n🏛️  Creating Counselling Body Partitions...');
    console.log('==========================================');
    
    const partitions = [];
    const counsellingBodies = ['AIQ', 'KEA'];
    
    for (const body of counsellingBodies) {
      console.log(`📥 Creating ${body} partition...`);
      
      const query = `
        SELECT 
          id,
          all_india_rank as opening_rank,
          all_india_rank as closing_rank,
          quota,
          college_institute_normalized as college_name,
          state_normalized as state,
          course_normalized as course_name,
          category,
          round_normalized as round,
          year,
          source_normalized as counselling_body,
          level_normalized as level,
          master_college_id as college_id,
          master_course_id as course_id,
          master_state_id as state_id,
          master_quota_id as quota_id,
          master_category_id as category_id,
          created_at,
          updated_at
        FROM counselling_records 
        WHERE year = 2024 AND is_matched = 1 AND source_normalized = ?
        ORDER BY round_normalized, all_india_rank
      `;
      
      const data = await new Promise((resolve, reject) => {
        this.db.all(query, [body], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (data.length > 0) {
        const filename = `cutoffs_${body.toLowerCase()}_2024.parquet`;
        const file = await this.createParquetFile(data, filename);
        
        partitions.push({
          ...file,
          counsellingBody: body,
          loadStrategy: 'on-demand'
        });
        
        // Compress file
        const compressedPath = path.join(this.compressionDir, `${filename}.gz`);
        await this.compressFile(file.path, compressedPath, 'gzip');
      }
    }
    
    return partitions;
  }

  async createYearPartitions() {
    console.log('\n📅 Creating Year-Based Partitions...');
    console.log('====================================');
    
    const partitions = [];
    const years = [2023, 2024];
    
    for (const year of years) {
      console.log(`📥 Creating ${year} partition...`);
      
      const data = await this.getCutoffData(null, year);
      
      if (data.length > 0) {
        const filename = `cutoffs_${year}.parquet`;
        const file = await this.createParquetFile(data, filename);
        
        partitions.push({
          ...file,
          year,
          loadStrategy: year === 2024 ? 'immediate' : 'on-demand'
        });
        
        // Compress file
        const compressedPath = path.join(this.compressionDir, `${filename}.gz`);
        await this.compressFile(file.path, compressedPath, 'gzip');
      }
    }
    
    return partitions;
  }

  generateManifest(partitions) {
    console.log('\n📋 Generating Partition Manifest...');
    
    const manifest = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      total_partitions: partitions.length,
      total_records: partitions.reduce((sum, p) => sum + p.records, 0),
      total_size: partitions.reduce((sum, p) => sum + p.size, 0),
      compression: {
        algorithm: 'gzip',
        total_compressed_size: 0
      },
      loading_strategy: {
        immediate: partitions.filter(p => p.loadStrategy === 'immediate').length,
        on_demand: partitions.filter(p => p.loadStrategy === 'on-demand').length,
        background: partitions.filter(p => p.loadStrategy === 'background').length
      },
      partitions: partitions.map(p => ({
        filename: p.filename,
        priority: p.priority || 'medium',
        load_strategy: p.loadStrategy,
        records: p.records,
        size: p.size,
        rounds: p.rounds || null,
        year: p.year || 2024,
        counselling_body: p.counsellingBody || null
      }))
    };
    
    const manifestPath = path.join(this.outputDir, 'partition_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ Manifest created: ${manifestPath}`);
    return manifest;
  }

  async run() {
    try {
      await this.init();
      
      console.log('🎯 Creating Partitioned Cutoff Files...');
      console.log('======================================');
      
      const allPartitions = [];
      
      // Create different partition types
      const roundPartitions = await this.createRoundPartitions();
      allPartitions.push(...roundPartitions);
      
      const bodyPartitions = await this.createCounsellingBodyPartitions();
      allPartitions.push(...bodyPartitions);
      
      const yearPartitions = await this.createYearPartitions();
      allPartitions.push(...yearPartitions);
      
      // Generate manifest
      const manifest = this.generateManifest(allPartitions);
      
      console.log('\n📊 PARTITION SUMMARY');
      console.log('===================');
      console.log(`Total Partitions: ${manifest.total_partitions}`);
      console.log(`Total Records: ${manifest.total_records.toLocaleString()}`);
      console.log(`Total Size: ${(manifest.total_size / 1024 / 1024).toFixed(1)}MB`);
      console.log(`Immediate Load: ${manifest.loading_strategy.immediate} files`);
      console.log(`On-Demand Load: ${manifest.loading_strategy.on_demand} files`);
      console.log(`Background Load: ${manifest.loading_strategy.background} files`);
      
      console.log('\n🎯 LOADING STRATEGY');
      console.log('==================');
      console.log('1. Load Rounds 1-2 immediately (most important)');
      console.log('2. Load 2024 data on demand');
      console.log('3. Load other rounds in background');
      console.log('4. Use compressed files for faster download');
      
    } catch (error) {
      console.error('❌ Error creating partitions:', error);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

// Run the partition creator
if (require.main === module) {
  const creator = new PartitionedCutoffCreator();
  creator.run().catch(console.error);
}

module.exports = PartitionedCutoffCreator;
