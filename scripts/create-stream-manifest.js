#!/usr/bin/env node
/**
 * Create Stream-Based Partition Manifest
 * Generates the manifest structure for stream-based loading without database access
 */

const fs = require('fs');
const path = require('path');

class StreamManifestCreator {
  constructor() {
    this.outputDir = 'data/parquet/cutoffs';
    this.compressedDir = 'data/compressed/cutoffs';
    
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

  generateStreamManifest() {
    console.log('📋 Generating Stream-Based Partition Manifest...');
    
    const partitions = [];
    
    // Generate partition definitions for each stream and year
    Object.entries(this.streamConfigs).forEach(([streamId, config]) => {
      this.years.forEach(year => {
        // Priority partitions (Rounds 1-2)
        partitions.push({
          filename: `cutoffs_${streamId.toLowerCase()}_${year}_rounds_1_2.parquet`,
          stream: streamId,
          year,
          rounds: config.priorityRounds,
          priority: 'high',
          loadStrategy: 'immediate',
          description: `${config.name} ${year} Rounds 1-2 (Priority)`,
          estimatedSize: this.estimateFileSize(streamId, year, config.priorityRounds),
          courseTypes: config.cutoffFilter,
          excludeStreams: config.excludeStreams || []
        });
        
        // On-demand partitions (Rounds 3-6)
        partitions.push({
          filename: `cutoffs_${streamId.toLowerCase()}_${year}_rounds_3_6.parquet`,
          stream: streamId,
          year,
          rounds: config.onDemandRounds,
          priority: 'medium',
          loadStrategy: 'on-demand',
          description: `${config.name} ${year} Rounds 3-6 (On-Demand)`,
          estimatedSize: this.estimateFileSize(streamId, year, config.onDemandRounds),
          courseTypes: config.cutoffFilter,
          excludeStreams: config.excludeStreams || []
        });
      });
    });
    
    const manifest = {
      version: '2.0.0',
      created_at: new Date().toISOString(),
      strategy: 'stream-based-loading',
      description: 'Stream-based cutoff loading with priority rounds (1-2) and on-demand rounds (3-6)',
      total_partitions: partitions.length,
      total_estimated_size: partitions.reduce((sum, p) => sum + p.estimatedSize, 0),
      compression: {
        algorithm: 'gzip',
        estimated_compression_ratio: 0.94
      },
      loading_strategy: {
        immediate: partitions.filter(p => p.loadStrategy === 'immediate').length,
        on_demand: partitions.filter(p => p.loadStrategy === 'on-demand').length,
        background: partitions.filter(p => p.loadStrategy === 'background').length
      },
      streams: this.generateStreamInfo(partitions),
      partitions: partitions
    };
    
    return manifest;
  }

  generateStreamInfo(partitions) {
    const streams = {};
    
    Object.keys(this.streamConfigs).forEach(streamId => {
      const streamPartitions = partitions.filter(p => p.stream === streamId);
      const config = this.streamConfigs[streamId];
      
      streams[streamId] = {
        name: config.name,
        description: config.description,
        total_partitions: streamPartitions.length,
        total_estimated_size: streamPartitions.reduce((sum, p) => sum + p.estimatedSize, 0),
        immediate_load: streamPartitions.filter(p => p.loadStrategy === 'immediate'),
        on_demand_load: streamPartitions.filter(p => p.loadStrategy === 'on-demand'),
        course_types: config.cutoffFilter,
        priority_rounds: config.priorityRounds,
        on_demand_rounds: config.onDemandRounds,
        exclude_streams: config.excludeStreams || []
      };
    });
    
    return streams;
  }

  estimateFileSize(streamId, year, rounds) {
    // Estimate file sizes based on stream and year
    const baseSizes = {
      UG: { 2023: 15000000, 2024: 18000000 }, // 15-18MB
      PG_MEDICAL: { 2023: 20000000, 2024: 25000000 }, // 20-25MB
      PG_DENTAL: { 2023: 3000000, 2024: 4000000 } // 3-4MB
    };
    
    const baseSize = baseSizes[streamId]?.[year] || 10000000; // 10MB default
    
    // Adjust based on number of rounds
    const roundMultiplier = rounds.length / 6; // Assuming 6 total rounds
    
    return Math.round(baseSize * roundMultiplier);
  }

  async saveManifest(manifest) {
    const manifestPath = path.join(this.outputDir, 'stream_partition_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Stream manifest saved: ${manifestPath}`);
    return manifestPath;
  }

  generateClientSideLoader() {
    console.log('🔧 Generating Client-Side Stream Loader...');
    
    const loaderCode = `
// Stream-Based Cutoff Loader
// Auto-generated from stream_partition_manifest.json

export class StreamBasedCutoffLoader {
  constructor() {
    this.manifest = null;
    this.loadedPartitions = new Map();
    this.currentStream = null;
  }

  async initialize() {
    // Load manifest
    const response = await fetch('/data/parquet/cutoffs/stream_partition_manifest.json');
    this.manifest = await response.json();
    console.log('✅ Stream manifest loaded');
  }

  async loadStreamData(streamId) {
    if (!this.manifest) {
      await this.initialize();
    }

    this.currentStream = streamId;
    const streamInfo = this.manifest.streams[streamId];
    
    if (!streamInfo) {
      throw new Error(\`Stream not found: \${streamId}\`);
    }

    console.log(\`📚 Loading \${streamInfo.name} data...\`);

    // Load immediate partitions (Rounds 1-2)
    for (const partition of streamInfo.immediate_load) {
      await this.loadPartition(partition.filename);
    }

    console.log(\`✅ \${streamInfo.name} immediate data loaded\`);
  }

  async loadOnDemandData(streamId) {
    if (!this.manifest) {
      await this.initialize();
    }

    const streamInfo = this.manifest.streams[streamId];
    
    if (!streamInfo) {
      throw new Error(\`Stream not found: \${streamId}\`);
    }

    console.log(\`📚 Loading \${streamInfo.name} on-demand data...\`);

    // Load on-demand partitions (Rounds 3-6)
    for (const partition of streamInfo.on_demand_load) {
      await this.loadPartition(partition.filename);
    }

    console.log(\`✅ \${streamInfo.name} on-demand data loaded\`);
  }

  async loadPartition(filename) {
    if (this.loadedPartitions.has(filename)) {
      return this.loadedPartitions.get(filename);
    }

    console.log(\`📥 Loading partition: \${filename}\`);
    
    try {
      // Load compressed file
      const response = await fetch(\`/data/compressed/cutoffs/\${filename}.gz\`);
      const compressedData = await response.arrayBuffer();
      
      // Decompress (using native browser API)
      const decompressedData = await this.decompressGzip(compressedData);
      
      // Parse JSON data (in real implementation, parse Parquet)
      const data = JSON.parse(new TextDecoder().decode(decompressedData));
      
      this.loadedPartitions.set(filename, data);
      return data;
      
    } catch (error) {
      console.error(\`❌ Failed to load partition \${filename}:\`, error);
      throw error;
    }
  }

  async decompressGzip(compressedData) {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(compressedData);
    writer.close();
    
    const chunks = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }

  getLoadedPartitions() {
    return Array.from(this.loadedPartitions.keys());
  }

  getStreamInfo(streamId) {
    return this.manifest?.streams[streamId];
  }
}

// Export singleton
export const streamBasedCutoffLoader = new StreamBasedCutoffLoader();
`;

    const loaderPath = path.join(this.outputDir, 'StreamBasedCutoffLoader.js');
    fs.writeFileSync(loaderPath, loaderCode);
    console.log(`✅ Client-side loader saved: ${loaderPath}`);
    return loaderPath;
  }

  async run() {
    console.log('🚀 Creating Stream-Based Partition Manifest...');
    console.log('==============================================');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // Generate manifest
    const manifest = this.generateStreamManifest();
    
    // Save manifest
    await this.saveManifest(manifest);
    
    // Generate client-side loader
    await this.generateClientSideLoader();
    
    console.log('\n📊 STREAM-BASED PARTITION SUMMARY');
    console.log('==================================');
    console.log(`Total Partitions: ${manifest.total_partitions}`);
    console.log(`Total Estimated Size: ${(manifest.total_estimated_size / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Compressed Size: ${(manifest.total_estimated_size * 0.06 / 1024 / 1024).toFixed(1)}MB (94% compression)`);
    
    console.log('\n📚 STREAM BREAKDOWN:');
    console.log('===================');
    Object.entries(manifest.streams).forEach(([streamId, stream]) => {
      console.log(`\n${stream.name} (${streamId}):`);
      console.log(`  Partitions: ${stream.total_partitions}`);
      console.log(`  Estimated Size: ${(stream.total_estimated_size / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Compressed Size: ${(stream.total_estimated_size * 0.06 / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Immediate Load: ${stream.immediate_load.length} files`);
      console.log(`  On-Demand Load: ${stream.on_demand_load.length} files`);
      console.log(`  Course Types: ${stream.course_types.join(', ')}`);
      console.log(`  Priority Rounds: ${stream.priority_rounds.join(', ')}`);
      console.log(`  On-Demand Rounds: ${stream.on_demand_rounds.join(', ')}`);
    });
    
    console.log('\n🎯 STREAM-BASED LOADING STRATEGY:');
    console.log('=================================');
    console.log('1. User selects stream (UG/PG_MEDICAL/PG_DENTAL)');
    console.log('2. Load stream-specific Rounds 1-2 immediately (~2-5MB compressed)');
    console.log('3. Load stream-specific Rounds 3-6 on demand (~1-3MB compressed)');
    console.log('4. Use GZIP compression for universal browser support');
    console.log('5. Stream-specific filtering and exclusions applied');
    console.log('6. Progressive loading with priority-based strategy');
    
    console.log('\n✅ Stream-based manifest and loader created successfully!');
  }
}

// Run the manifest creator
if (require.main === module) {
  const creator = new StreamManifestCreator();
  creator.run().catch(console.error);
}

module.exports = StreamManifestCreator;
