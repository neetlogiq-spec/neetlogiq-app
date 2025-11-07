#!/usr/bin/env node
/**
 * Create Stream-Based Partitioned Cutoff Parquet Files
 * Implements stream-specific loading strategy (UG, PG_MEDICAL, PG_DENTAL)
 * with priority-based round loading (Rounds 1-2 initially, others on-demand)
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { promisify } = require('util');

class StreamBasedCutoffCreator {
  constructor() {
    this.dbPath = 'data/sqlite/counselling_data_partitioned.db';
    this.outputDir = 'data/parquet/cutoffs';
    this.compressedDir = 'data/compressed/cutoffs';
    this.db = null;
    
    // Stream configurations based on existing StreamDataService
    this.streamConfigs = {
      UG: {
        id: 'UG',
        name: 'Undergraduate',
        description: 'MBBS, BDS and other undergraduate medical courses',
        collegeTypes: ['MEDICAL', 'DENTAL'],
        courseTypes: ['MBBS', 'BDS'],
        cutoffTypes: ['UG'],
        showColleges: ['MBBS', 'BDS'],
        showCourses: ['MBBS', 'BDS'],
        cutoffFilter: ['MBBS', 'BDS'],
        priorityRounds: [1, 2], // Load immediately
        onDemandRounds: [3, 4, 5, 6] // Load on demand
      },
      PG_MEDICAL: {
        id: 'PG_MEDICAL',
        name: 'Postgraduate Medical',
        description: 'MD, MS, DM, MCh, DNB, DIPLOMA and other postgraduate medical courses (excludes dental)',
        collegeTypes: ['MEDICAL', 'DNB'],
        courseTypes: ['MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA'],
        cutoffTypes: ['PG'],
        excludeStreams: ['DENTAL'],
        showColleges: ['MBBS', 'MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'],
        showCourses: ['MBBS', 'MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'],
        cutoffFilter: ['MD', 'MS', 'DM', 'MCH', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'],
        priorityRounds: [1, 2], // Load immediately
        onDemandRounds: [3, 4, 5, 6] // Load on demand
      },
      PG_DENTAL: {
        id: 'PG_DENTAL',
        name: 'Postgraduate Dental',
        description: 'MDS, PG DIPLOMA and other postgraduate dental courses (excludes medical)',
        collegeTypes: ['DENTAL'],
        courseTypes: ['MDS'],
        cutoffTypes: ['PG'],
        excludeStreams: ['MEDICAL', 'DNB'],
        showColleges: ['BDS', 'MDS', 'PG DIPLOMA'],
        showCourses: ['BDS', 'MDS', 'PG DIPLOMA'],
        cutoffFilter: ['MDS', 'PG DIPLOMA'],
        priorityRounds: [1, 2], // Load immediately
        onDemandRounds: [3, 4, 5, 6] // Load on demand
      }
    };
    
    this.years = [2023, 2024];
  }

  async init() {
    console.log('🚀 Initializing Stream-Based Cutoff Creator...');
    
    // Ensure output directories exist
    this.ensureDirectories();
    
    // Connect to database
    this.db = new Database(this.dbPath);
    console.log('✅ Connected to SQLite database');
  }

  ensureDirectories() {
    const dirs = [this.outputDir, this.compressedDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  async getStreamCutoffData(stream, year, rounds = null) {
    const config = this.streamConfigs[stream];
    if (!config) {
      throw new Error(`Invalid stream: ${stream}`);
    }

    console.log(`📊 Fetching ${stream} cutoff data for year ${year}, rounds: ${rounds || 'all'}`);
    
    // Build course filter based on stream configuration
    const courseFilter = config.cutoffFilter.map(course => `'${course}'`).join(',');
    
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
      WHERE year = ? 
        AND is_matched = 1
        AND course_normalized IN (${courseFilter})
    `;
    
    const params = [year];
    
    if (rounds && rounds.length > 0) {
      query += ` AND round_normalized IN (${rounds.map(() => '?').join(',')})`;
      params.push(...rounds);
    }
    
    // Add stream-specific exclusions
    if (config.excludeStreams && config.excludeStreams.length > 0) {
      const excludeFilter = config.excludeStreams.map(stream => `'${stream}'`).join(',');
      query += ` AND course_normalized NOT LIKE '%${config.excludeStreams.join('%')}%'`;
    }
    
    query += ' ORDER BY round_normalized, all_india_rank';
    
    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async createStreamPartitions() {
    console.log('\n🎯 Creating Stream-Based Partitions...');
    console.log('=====================================');
    
    const allPartitions = [];
    
    for (const [streamId, config] of Object.entries(this.streamConfigs)) {
      console.log(`\n📚 Processing ${config.name} (${streamId})...`);
      
      for (const year of this.years) {
        // Create priority partitions (Rounds 1-2)
        console.log(`  📥 Creating ${streamId} ${year} priority partitions (Rounds 1-2)...`);
        const priorityData = await this.getStreamCutoffData(streamId, year, config.priorityRounds);
        
        if (priorityData.length > 0) {
          const priorityFile = await this.createParquetFile(
            priorityData, 
            `cutoffs_${streamId.toLowerCase()}_${year}_rounds_1_2.parquet`
          );
          
          allPartitions.push({
            ...priorityFile,
            stream: streamId,
            year,
            rounds: config.priorityRounds,
            priority: 'high',
            loadStrategy: 'immediate',
            description: `${config.name} ${year} Rounds 1-2 (Priority)`
          });
          
          // Compress priority file
          await this.compressFile(priorityFile.path, `${priorityFile.filename}.gz`);
        }
        
        // Create on-demand partitions (Rounds 3-6)
        console.log(`  📥 Creating ${streamId} ${year} on-demand partitions (Rounds 3-6)...`);
        const onDemandData = await this.getStreamCutoffData(streamId, year, config.onDemandRounds);
        
        if (onDemandData.length > 0) {
          const onDemandFile = await this.createParquetFile(
            onDemandData, 
            `cutoffs_${streamId.toLowerCase()}_${year}_rounds_3_6.parquet`
          );
          
          allPartitions.push({
            ...onDemandFile,
            stream: streamId,
            year,
            rounds: config.onDemandRounds,
            priority: 'medium',
            loadStrategy: 'on-demand',
            description: `${config.name} ${year} Rounds 3-6 (On-Demand)`
          });
          
          // Compress on-demand file
          await this.compressFile(onDemandFile.path, `${onDemandFile.filename}.gz`);
        }
      }
    }
    
    return allPartitions;
  }

  async createParquetFile(data, filename) {
    console.log(`    📦 Creating Parquet file: ${filename}`);
    
    // For now, create JSON file (in real implementation, use Parquet library)
    const outputPath = path.join(this.outputDir, filename);
    const jsonData = JSON.stringify(data, null, 2);
    
    fs.writeFileSync(outputPath, jsonData);
    
    const stats = fs.statSync(outputPath);
    console.log(`    ✅ Created ${filename}: ${(stats.size / 1024).toFixed(1)}KB (${data.length} records)`);
    
    return {
      filename,
      path: outputPath,
      size: stats.size,
      records: data.length,
      compression: 'SNAPPY'
    };
  }

  async compressFile(inputPath, outputFilename) {
    const outputPath = path.join(this.compressedDir, outputFilename);
    console.log(`    🗜️  Compressing ${path.basename(inputPath)}...`);
    
    const data = fs.readFileSync(inputPath);
    const compressed = require('zlib').gzipSync(data);
    
    fs.writeFileSync(outputPath, compressed);
    
    const originalSize = data.length;
    const compressedSize = compressed.length;
    const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`    ✅ Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`);
    
    return {
      originalSize,
      compressedSize,
      ratio: parseFloat(ratio),
      algorithm: 'gzip'
    };
  }

  generateStreamManifest(partitions) {
    console.log('\n📋 Generating Stream-Based Partition Manifest...');
    
    const manifest = {
      version: '2.0.0',
      created_at: new Date().toISOString(),
      strategy: 'stream-based-loading',
      total_partitions: partitions.length,
      total_records: partitions.reduce((sum, p) => sum + p.records, 0),
      total_size: partitions.reduce((sum, p) => sum + p.size, 0),
      compression: {
        algorithm: 'gzip',
        total_compressed_size: 0
      },
      streams: {},
      loading_strategy: {
        immediate: partitions.filter(p => p.loadStrategy === 'immediate').length,
        on_demand: partitions.filter(p => p.loadStrategy === 'on-demand').length,
        background: partitions.filter(p => p.loadStrategy === 'background').length
      }
    };
    
    // Group partitions by stream
    Object.keys(this.streamConfigs).forEach(streamId => {
      const streamPartitions = partitions.filter(p => p.stream === streamId);
      const config = this.streamConfigs[streamId];
      
      manifest.streams[streamId] = {
        name: config.name,
        description: config.description,
        total_partitions: streamPartitions.length,
        total_records: streamPartitions.reduce((sum, p) => sum + p.records, 0),
        total_size: streamPartitions.reduce((sum, p) => sum + p.size, 0),
        immediate_load: streamPartitions.filter(p => p.loadStrategy === 'immediate'),
        on_demand_load: streamPartitions.filter(p => p.loadStrategy === 'on-demand'),
        course_types: config.cutoffFilter,
        priority_rounds: config.priorityRounds,
        on_demand_rounds: config.onDemandRounds
      };
    });
    
    // Add partition details
    manifest.partitions = partitions.map(p => ({
      filename: p.filename,
      stream: p.stream,
      year: p.year,
      rounds: p.rounds,
      priority: p.priority,
      load_strategy: p.loadStrategy,
      records: p.records,
      size: p.size,
      description: p.description
    }));
    
    const manifestPath = path.join(this.outputDir, 'stream_partition_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ Stream manifest created: ${manifestPath}`);
    return manifest;
  }

  async run() {
    try {
      await this.init();
      
      console.log('🎯 Creating Stream-Based Cutoff Files...');
      console.log('========================================');
      
      // Create stream-based partitions
      const partitions = await this.createStreamPartitions();
      
      // Generate manifest
      const manifest = this.generateStreamManifest(partitions);
      
      console.log('\n📊 STREAM-BASED PARTITION SUMMARY');
      console.log('==================================');
      console.log(`Total Partitions: ${manifest.total_partitions}`);
      console.log(`Total Records: ${manifest.total_records.toLocaleString()}`);
      console.log(`Total Size: ${(manifest.total_size / 1024 / 1024).toFixed(1)}MB`);
      
      console.log('\n📚 STREAM BREAKDOWN:');
      console.log('===================');
      Object.entries(manifest.streams).forEach(([streamId, stream]) => {
        console.log(`\n${stream.name} (${streamId}):`);
        console.log(`  Partitions: ${stream.total_partitions}`);
        console.log(`  Records: ${stream.total_records.toLocaleString()}`);
        console.log(`  Size: ${(stream.total_size / 1024 / 1024).toFixed(1)}MB`);
        console.log(`  Immediate Load: ${stream.immediate_load.length} files`);
        console.log(`  On-Demand Load: ${stream.on_demand_load.length} files`);
        console.log(`  Course Types: ${stream.course_types.join(', ')}`);
        console.log(`  Priority Rounds: ${stream.priority_rounds.join(', ')}`);
        console.log(`  On-Demand Rounds: ${stream.on_demand_rounds.join(', ')}`);
      });
      
      console.log('\n🎯 STREAM-BASED LOADING STRATEGY:');
      console.log('=================================');
      console.log('1. User selects stream (UG/PG_MEDICAL/PG_DENTAL)');
      console.log('2. Load stream-specific Rounds 1-2 immediately');
      console.log('3. Load stream-specific Rounds 3-6 on demand');
      console.log('4. Use compressed files for faster download');
      console.log('5. Stream-specific filtering and exclusions applied');
      
    } catch (error) {
      console.error('❌ Error creating stream-based partitions:', error);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

// Run the stream-based partition creator
if (require.main === module) {
  const creator = new StreamBasedCutoffCreator();
  creator.run().catch(console.error);
}

module.exports = StreamBasedCutoffCreator;
