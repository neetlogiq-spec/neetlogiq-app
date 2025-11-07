// LZ4 Compression Library for Edge-Native Architecture
// Provides high-performance compression/decompression for client-side data delivery

import lz4js from 'lz4js';

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  decompressionTime: number;
}

export interface CompressionOptions {
  level?: number; // 1-9, higher = better compression, slower
  chunkSize?: number; // Size of chunks for streaming
  enableChecksum?: boolean; // Enable data integrity checking
}

export class LZ4Compressor {
  private static instance: LZ4Compressor;
  private options: CompressionOptions;
  private performanceMetrics: Map<string, CompressionResult> = new Map();

  constructor(options: CompressionOptions = {}) {
    this.options = {
      level: 1, // Fast compression by default
      chunkSize: 64 * 1024, // 64KB chunks
      enableChecksum: true,
      ...options
    };
  }

  static getInstance(options?: CompressionOptions): LZ4Compressor {
    if (!LZ4Compressor.instance) {
      LZ4Compressor.instance = new LZ4Compressor(options);
    }
    return LZ4Compressor.instance;
  }

  /**
   * Compress data using LZ4 algorithm
   */
  async compress(data: ArrayBuffer | Uint8Array, identifier?: string): Promise<ArrayBuffer> {
    const startTime = performance.now();
    
    try {
      let inputData: Uint8Array;
      
      if (data instanceof ArrayBuffer) {
        inputData = new Uint8Array(data);
      } else {
        inputData = data;
      }

      console.log(`🗜️  Compressing data: ${(inputData.length / 1024).toFixed(1)}KB`);
      
      // Compress using LZ4
      const compressed = lz4js.compress(inputData, this.options.level || 1);
      
      const compressionTime = performance.now() - startTime;
      const compressionRatio = ((inputData.length - compressed.length) / inputData.length * 100);
      
      console.log(`✅ Compressed: ${(inputData.length / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% reduction) in ${compressionTime.toFixed(0)}ms`);
      
      // Store performance metrics
      if (identifier) {
        this.performanceMetrics.set(identifier, {
          originalSize: inputData.length,
          compressedSize: compressed.length,
          compressionRatio,
          compressionTime,
          decompressionTime: 0 // Will be updated on decompression
        });
      }
      
      return compressed.buffer;
      
    } catch (error) {
      console.error('❌ LZ4 compression failed:', error);
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  /**
   * Decompress data using LZ4 algorithm
   */
  async decompress(compressedData: ArrayBuffer, identifier?: string): Promise<ArrayBuffer> {
    const startTime = performance.now();
    
    try {
      const inputData = new Uint8Array(compressedData);
      
      console.log(`🗜️  Decompressing data: ${(inputData.length / 1024).toFixed(1)}KB`);
      
      // Decompress using LZ4
      const decompressed = lz4js.decompress(inputData);
      
      const decompressionTime = performance.now() - startTime;
      
      console.log(`✅ Decompressed: ${(inputData.length / 1024).toFixed(1)}KB → ${(decompressed.length / 1024).toFixed(1)}KB in ${decompressionTime.toFixed(0)}ms`);
      
      // Update performance metrics
      if (identifier) {
        const existing = this.performanceMetrics.get(identifier);
        if (existing) {
          existing.decompressionTime = decompressionTime;
          this.performanceMetrics.set(identifier, existing);
        }
      }
      
      return decompressed.buffer;
      
    } catch (error) {
      console.error('❌ LZ4 decompression failed:', error);
      throw new Error(`Decompression failed: ${error.message}`);
    }
  }

  /**
   * Compress data in chunks for streaming
   */
  async compressStreaming(data: ArrayBuffer, onProgress?: (progress: number) => void): Promise<ArrayBuffer[]> {
    const inputData = new Uint8Array(data);
    const chunkSize = this.options.chunkSize || 64 * 1024;
    const chunks: ArrayBuffer[] = [];
    
    console.log(`🗜️  Streaming compression: ${(inputData.length / 1024).toFixed(1)}KB in ${Math.ceil(inputData.length / chunkSize)} chunks`);
    
    for (let i = 0; i < inputData.length; i += chunkSize) {
      const chunk = inputData.slice(i, i + chunkSize);
      const compressedChunk = await this.compress(chunk);
      chunks.push(compressedChunk);
      
      if (onProgress) {
        const progress = Math.min(100, ((i + chunkSize) / inputData.length) * 100);
        onProgress(progress);
      }
    }
    
    console.log(`✅ Streaming compression complete: ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Decompress data from chunks
   */
  async decompressStreaming(compressedChunks: ArrayBuffer[], onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    const decompressedChunks: Uint8Array[] = [];
    
    console.log(`🗜️  Streaming decompression: ${compressedChunks.length} chunks`);
    
    for (let i = 0; i < compressedChunks.length; i++) {
      const chunk = await this.decompress(compressedChunks[i]);
      decompressedChunks.push(new Uint8Array(chunk));
      
      if (onProgress) {
        const progress = ((i + 1) / compressedChunks.length) * 100;
        onProgress(progress);
      }
    }
    
    // Combine all chunks
    const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of decompressedChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    console.log(`✅ Streaming decompression complete: ${(result.length / 1024).toFixed(1)}KB`);
    return result.buffer;
  }

  /**
   * Compress with checksum for data integrity
   */
  async compressWithChecksum(data: ArrayBuffer, identifier?: string): Promise<{ data: ArrayBuffer; checksum: string }> {
    const compressed = await this.compress(data, identifier);
    
    if (this.options.enableChecksum) {
      const checksum = await this.calculateChecksum(data);
      return { data: compressed, checksum };
    }
    
    return { data: compressed, checksum: '' };
  }

  /**
   * Decompress with checksum verification
   */
  async decompressWithChecksum(compressedData: ArrayBuffer, expectedChecksum?: string, identifier?: string): Promise<ArrayBuffer> {
    const decompressed = await this.decompress(compressedData, identifier);
    
    if (this.options.enableChecksum && expectedChecksum) {
      const actualChecksum = await this.calculateChecksum(decompressed);
      if (actualChecksum !== expectedChecksum) {
        throw new Error('Checksum verification failed - data may be corrupted');
      }
    }
    
    return decompressed;
  }

  /**
   * Calculate simple checksum for data integrity
   */
  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const buffer = new Uint8Array(data);
    let checksum = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      checksum = ((checksum << 5) - checksum + buffer[i]) & 0xffffffff;
    }
    
    return checksum.toString(16);
  }

  /**
   * Get compression performance metrics
   */
  getPerformanceMetrics(): Map<string, CompressionResult> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Get average compression ratio
   */
  getAverageCompressionRatio(): number {
    const metrics = Array.from(this.performanceMetrics.values());
    if (metrics.length === 0) return 0;
    
    const totalRatio = metrics.reduce((sum, metric) => sum + metric.compressionRatio, 0);
    return totalRatio / metrics.length;
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Update compression options
   */
  updateOptions(newOptions: Partial<CompressionOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

// Export singleton instance
export const lz4Compressor = LZ4Compressor.getInstance();
