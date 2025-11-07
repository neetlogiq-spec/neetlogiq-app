// Compressed Parquet Processor for Client-Side Data Loading
// Handles compressed Parquet files with progressive loading and priority-based strategies

import { CutoffRecord, CollegeRecord, CourseRecord } from '@/types/data';

interface PartitionInfo {
  filename: string;
  priority: 'high' | 'medium' | 'low';
  loadStrategy: 'immediate' | 'on-demand' | 'background';
  records: number;
  size: number;
  rounds?: number[];
  year: number;
  counsellingBody?: string;
  compressedSize?: number;
  compressionRatio?: number;
}

interface LoadingProgress {
  partition: string;
  status: 'pending' | 'downloading' | 'decompressing' | 'loading' | 'completed' | 'error';
  progress: number;
  downloaded: number;
  total: number;
  error?: string;
}

interface CompressionStats {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  decompressionTime: number;
}

export class CompressedParquetProcessor {
  private partitions: Map<string, PartitionInfo> = new Map();
  private loadedPartitions: Map<string, any> = new Map();
  private loadingProgress: Map<string, LoadingProgress> = new Map();
  private compressionStats: Map<string, CompressionStats> = new Map();
  private manifest: any = null;
  private isInitialized: boolean = false;
  private wasmModule: any = null;

  constructor() {
    this.initializeCompressionSupport();
  }

  private initializeCompressionSupport(): void {
    // Initialize compression algorithms support
    console.log('🔧 Initializing compression support...');
    
    // Check browser support for different compression algorithms
    const compressionSupport = {
      gzip: this.supportsGzip(),
      deflate: this.supportsDeflate(),
      brotli: this.supportsBrotli(),
      lz4: false, // Will be loaded via WebAssembly
      zstd: false  // Will be loaded via WebAssembly
    };
    
    console.log('📊 Compression Support:', compressionSupport);
  }

  private supportsGzip(): boolean {
    return typeof CompressionStream !== 'undefined';
  }

  private supportsDeflate(): boolean {
    return typeof CompressionStream !== 'undefined';
  }

  private supportsBrotli(): boolean {
    return typeof CompressionStream !== 'undefined';
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Compressed Parquet Processor...');
    
    try {
      // Load partition manifest
      await this.loadManifest();
      
      // Load WebAssembly module for advanced compression
      await this.loadWebAssemblyModule();
      
      // Load high priority partitions immediately
      await this.loadHighPriorityPartitions();
      
      this.isInitialized = true;
      console.log('✅ Compressed Parquet Processor initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Compressed Parquet Processor:', error);
      throw error;
    }
  }

  private async loadManifest(): Promise<void> {
    console.log('📋 Loading partition manifest...');
    
    try {
      const response = await fetch('/data/parquet/partition_manifest.json');
      this.manifest = await response.json();
      
      // Populate partitions map
      this.manifest.partitions.forEach((partition: PartitionInfo) => {
        this.partitions.set(partition.filename, partition);
      });
      
      console.log(`✅ Loaded manifest with ${this.partitions.size} partitions`);
      
    } catch (error) {
      console.error('❌ Failed to load manifest:', error);
      throw error;
    }
  }

  private async loadWebAssemblyModule(): Promise<void> {
    try {
      // Load WebAssembly module for LZ4/ZSTD decompression
      const wasmModule = await import('/WASM/data_processor.js');
      this.wasmModule = await wasmModule.default();
      console.log('✅ WebAssembly compression module loaded');
    } catch (error) {
      console.warn('⚠️ WebAssembly module not available, using native compression');
      this.wasmModule = null;
    }
  }

  private async loadHighPriorityPartitions(): Promise<void> {
    console.log('📥 Loading high priority partitions...');
    
    const highPriorityPartitions = Array.from(this.partitions.values())
      .filter(p => p.priority === 'high' && p.loadStrategy === 'immediate');
    
    for (const partition of highPriorityPartitions) {
      try {
        await this.loadPartition(partition.filename);
      } catch (error) {
        console.error(`❌ Failed to load high priority partition ${partition.filename}:`, error);
      }
    }
  }

  async loadPartition(filename: string): Promise<void> {
    const partition = this.partitions.get(filename);
    if (!partition) {
      throw new Error(`Partition not found: ${filename}`);
    }

    // Check if already loaded
    if (this.loadedPartitions.has(filename)) {
      console.log(`📁 Partition already loaded: ${filename}`);
      return;
    }

    console.log(`📥 Loading partition: ${filename} (${partition.records} records)`);
    
    // Initialize loading progress
    this.loadingProgress.set(filename, {
      partition: filename,
      status: 'downloading',
      progress: 0,
      downloaded: 0,
      total: partition.size
    });

    try {
      const startTime = performance.now();
      
      // Load compressed file
      const compressedData = await this.downloadCompressedFile(filename);
      
      // Update progress
      this.updateProgress(filename, 'decompressing', 50);
      
      // Decompress data
      const decompressedData = await this.decompressData(compressedData, filename);
      
      // Update progress
      this.updateProgress(filename, 'loading', 75);
      
      // Process Parquet data
      const processedData = await this.processParquetData(decompressedData, filename);
      
      // Store loaded data
      this.loadedPartitions.set(filename, processedData);
      
      const loadTime = performance.now() - startTime;
      
      // Update progress
      this.updateProgress(filename, 'completed', 100);
      
      console.log(`✅ Loaded ${filename} in ${loadTime.toFixed(0)}ms`);
      
    } catch (error) {
      console.error(`❌ Failed to load partition ${filename}:`, error);
      this.updateProgress(filename, 'error', 0, error.message);
      throw error;
    }
  }

  private async downloadCompressedFile(filename: string): Promise<ArrayBuffer> {
    const compressedFilename = `${filename}.gz`;
    const response = await fetch(`/data/compressed/cutoffs/${compressedFilename}`);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${compressedFilename}: ${response.status}`);
    }
    
    return response.arrayBuffer();
  }

  private async decompressData(compressedData: ArrayBuffer, filename: string): Promise<ArrayBuffer> {
    const startTime = performance.now();
    
    try {
      let decompressedData: ArrayBuffer;
      
      if (this.wasmModule) {
        // Use WebAssembly for LZ4/ZSTD decompression
        decompressedData = this.wasmModule.decompress_data(compressedData, 'gzip');
      } else {
        // Use native browser compression
        decompressedData = await this.decompressWithNativeAPI(compressedData);
      }
      
      const decompressionTime = performance.now() - startTime;
      
      // Store compression stats
      this.compressionStats.set(filename, {
        algorithm: 'gzip',
        originalSize: decompressedData.byteLength,
        compressedSize: compressedData.byteLength,
        ratio: ((compressedData.byteLength / decompressedData.byteLength) * 100),
        decompressionTime
      });
      
      console.log(`🗜️  Decompressed ${filename}: ${(compressedData.byteLength / 1024).toFixed(1)}KB → ${(decompressedData.byteLength / 1024).toFixed(1)}KB in ${decompressionTime.toFixed(0)}ms`);
      
      return decompressedData;
      
    } catch (error) {
      console.error(`❌ Decompression failed for ${filename}:`, error);
      throw error;
    }
  }

  private async decompressWithNativeAPI(compressedData: ArrayBuffer): Promise<ArrayBuffer> {
    // Use native browser DecompressionStream API
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    // Write compressed data
    writer.write(compressedData);
    writer.close();
    
    // Read decompressed data
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }

  private async processParquetData(data: ArrayBuffer, filename: string): Promise<any> {
    // Process Parquet data (simplified implementation)
    // In real implementation, use a Parquet library like parquetjs or DuckDB-WASM
    
    console.log(`📊 Processing Parquet data for ${filename}...`);
    
    // For now, return mock data structure
    return {
      records: [],
      metadata: {
        filename,
        rowCount: 0,
        columnCount: 0,
        compression: 'SNAPPY'
      }
    };
  }

  private updateProgress(filename: string, status: LoadingProgress['status'], progress: number, error?: string): void {
    const currentProgress = this.loadingProgress.get(filename);
    if (currentProgress) {
      currentProgress.status = status;
      currentProgress.progress = progress;
      if (error) {
        currentProgress.error = error;
      }
      this.loadingProgress.set(filename, currentProgress);
    }
  }

  async searchCutoffs(filters: any, limit: number = 100): Promise<CutoffRecord[]> {
    console.log('🔍 Searching cutoffs with filters:', filters);
    
    const results: CutoffRecord[] = [];
    
    // Search through loaded partitions
    for (const [filename, data] of this.loadedPartitions) {
      if (data.records && data.records.length > 0) {
        // Apply filters to data
        const filteredRecords = this.applyFilters(data.records, filters);
        results.push(...filteredRecords);
        
        if (results.length >= limit) {
          break;
        }
      }
    }
    
    console.log(`✅ Found ${results.length} cutoff records`);
    return results.slice(0, limit);
  }

  private applyFilters(records: any[], filters: any): any[] {
    // Apply filters to records (simplified implementation)
    return records.filter(record => {
      if (filters.year && record.year !== filters.year) return false;
      if (filters.round && record.round !== filters.round) return false;
      if (filters.state && record.state !== filters.state) return false;
      if (filters.course && !record.course_name.includes(filters.course)) return false;
      if (filters.college && !record.college_name.includes(filters.college)) return false;
      return true;
    });
  }

  async loadOnDemandPartitions(): Promise<void> {
    console.log('📥 Loading on-demand partitions...');
    
    const onDemandPartitions = Array.from(this.partitions.values())
      .filter(p => p.loadStrategy === 'on-demand');
    
    for (const partition of onDemandPartitions) {
      try {
        await this.loadPartition(partition.filename);
      } catch (error) {
        console.warn(`⚠️ Failed to load on-demand partition ${partition.filename}:`, error);
      }
    }
  }

  async loadBackgroundPartitions(): Promise<void> {
    console.log('📥 Loading background partitions...');
    
    const backgroundPartitions = Array.from(this.partitions.values())
      .filter(p => p.loadStrategy === 'background');
    
    for (const partition of backgroundPartitions) {
      try {
        // Load in background without blocking
        this.loadPartition(partition.filename).catch(error => {
          console.warn(`⚠️ Background load failed for ${partition.filename}:`, error);
        });
      } catch (error) {
        console.warn(`⚠️ Failed to start background load for ${partition.filename}:`, error);
      }
    }
  }

  getLoadingProgress(): Map<string, LoadingProgress> {
    return new Map(this.loadingProgress);
  }

  getCompressionStats(): Map<string, CompressionStats> {
    return new Map(this.compressionStats);
  }

  getLoadedPartitions(): string[] {
    return Array.from(this.loadedPartitions.keys());
  }

  getPartitionInfo(filename: string): PartitionInfo | undefined {
    return this.partitions.get(filename);
  }

  getManifest(): any {
    return this.manifest;
  }

  // Memory management
  async clearCache(): Promise<void> {
    console.log('🧹 Clearing cache...');
    
    this.loadedPartitions.clear();
    this.loadingProgress.clear();
    this.compressionStats.clear();
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  // Performance monitoring
  getPerformanceMetrics(): any {
    const totalCompressionTime = Array.from(this.compressionStats.values())
      .reduce((sum, stats) => sum + stats.decompressionTime, 0);
    
    const totalCompressionRatio = Array.from(this.compressionStats.values())
      .reduce((sum, stats) => sum + stats.ratio, 0) / this.compressionStats.size;
    
    return {
      loadedPartitions: this.loadedPartitions.size,
      totalPartitions: this.partitions.size,
      totalCompressionTime,
      averageCompressionRatio: totalCompressionRatio,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const data of this.loadedPartitions.values()) {
      if (data.records) {
        totalSize += data.records.length * 1000; // Rough estimate
      }
    }
    return totalSize;
  }
}

// Export singleton instance
export const compressedParquetProcessor = new CompressedParquetProcessor();
