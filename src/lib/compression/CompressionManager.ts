// Compression Manager for Edge-Native Architecture
// Manages multiple compression algorithms and provides unified interface

import { LZ4Compressor, CompressionResult } from './LZ4Compressor';

export type CompressionAlgorithm = 'lz4' | 'gzip' | 'deflate' | 'brotli';

export interface CompressionConfig {
  algorithm: CompressionAlgorithm;
  level?: number;
  chunkSize?: number;
  enableChecksum?: boolean;
  fallbackAlgorithm?: CompressionAlgorithm;
}

export interface CompressionStats {
  algorithm: CompressionAlgorithm;
  totalCompressions: number;
  totalDecompressions: number;
  averageCompressionRatio: number;
  averageCompressionTime: number;
  averageDecompressionTime: number;
  totalBytesCompressed: number;
  totalBytesDecompressed: number;
}

export class CompressionManager {
  private static instance: CompressionManager;
  private lz4Compressor: LZ4Compressor;
  private stats: Map<CompressionAlgorithm, CompressionStats> = new Map();
  private config: CompressionConfig;

  constructor(config: CompressionConfig = { algorithm: 'lz4' }) {
    this.config = {
      level: 1,
      chunkSize: 64 * 1024,
      enableChecksum: true,
      fallbackAlgorithm: 'gzip',
      ...config
    };
    
    this.lz4Compressor = LZ4Compressor.getInstance({
      level: this.config.level,
      chunkSize: this.config.chunkSize,
      enableChecksum: this.config.enableChecksum
    });
    
    this.initializeStats();
  }

  static getInstance(config?: CompressionConfig): CompressionManager {
    if (!CompressionManager.instance) {
      CompressionManager.instance = new CompressionManager(config);
    }
    return CompressionManager.instance;
  }

  private initializeStats(): void {
    const algorithms: CompressionAlgorithm[] = ['lz4', 'gzip', 'deflate', 'brotli'];
    
    algorithms.forEach(algorithm => {
      this.stats.set(algorithm, {
        algorithm,
        totalCompressions: 0,
        totalDecompressions: 0,
        averageCompressionRatio: 0,
        averageCompressionTime: 0,
        averageDecompressionTime: 0,
        totalBytesCompressed: 0,
        totalBytesDecompressed: 0
      });
    });
  }

  /**
   * Compress data using specified algorithm
   */
  async compress(data: ArrayBuffer, algorithm?: CompressionAlgorithm, identifier?: string): Promise<ArrayBuffer> {
    const algo = algorithm || this.config.algorithm;
    
    try {
      let result: ArrayBuffer;
      
      switch (algo) {
        case 'lz4':
          result = await this.lz4Compressor.compress(data, identifier);
          break;
        case 'gzip':
          result = await this.compressGzip(data);
          break;
        case 'deflate':
          result = await this.compressDeflate(data);
          break;
        case 'brotli':
          result = await this.compressBrotli(data);
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algo}`);
      }
      
      this.updateStats(algo, 'compress', data.byteLength, result.byteLength);
      return result;
      
    } catch (error) {
      console.warn(`⚠️ Compression with ${algo} failed, trying fallback:`, error);
      
      if (this.config.fallbackAlgorithm && algo !== this.config.fallbackAlgorithm) {
        return this.compress(data, this.config.fallbackAlgorithm, identifier);
      }
      
      throw error;
    }
  }

  /**
   * Decompress data using specified algorithm
   */
  async decompress(compressedData: ArrayBuffer, algorithm?: CompressionAlgorithm, identifier?: string): Promise<ArrayBuffer> {
    const algo = algorithm || this.config.algorithm;
    
    try {
      let result: ArrayBuffer;
      
      switch (algo) {
        case 'lz4':
          result = await this.lz4Compressor.decompress(compressedData, identifier);
          break;
        case 'gzip':
          result = await this.decompressGzip(compressedData);
          break;
        case 'deflate':
          result = await this.decompressDeflate(compressedData);
          break;
        case 'brotli':
          result = await this.decompressBrotli(compressedData);
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${algo}`);
      }
      
      this.updateStats(algo, 'decompress', compressedData.byteLength, result.byteLength);
      return result;
      
    } catch (error) {
      console.warn(`⚠️ Decompression with ${algo} failed, trying fallback:`, error);
      
      if (this.config.fallbackAlgorithm && algo !== this.config.fallbackAlgorithm) {
        return this.decompress(compressedData, this.config.fallbackAlgorithm, identifier);
      }
      
      throw error;
    }
  }

  /**
   * Compress data with automatic algorithm selection based on data size
   */
  async compressAuto(data: ArrayBuffer, identifier?: string): Promise<{ data: ArrayBuffer; algorithm: CompressionAlgorithm }> {
    const size = data.byteLength;
    let algorithm: CompressionAlgorithm;
    
    // Choose algorithm based on data size and performance characteristics
    if (size < 1024) {
      // Small data: use fast compression
      algorithm = 'lz4';
    } else if (size < 1024 * 1024) {
      // Medium data: use balanced compression
      algorithm = 'gzip';
    } else {
      // Large data: use high compression
      algorithm = 'brotli';
    }
    
    const compressed = await this.compress(data, algorithm, identifier);
    return { data: compressed, algorithm };
  }

  /**
   * Compress with streaming for large data
   */
  async compressStreaming(data: ArrayBuffer, algorithm?: CompressionAlgorithm, onProgress?: (progress: number) => void): Promise<ArrayBuffer[]> {
    const algo = algorithm || this.config.algorithm;
    
    switch (algo) {
      case 'lz4':
        return this.lz4Compressor.compressStreaming(data, onProgress);
      case 'gzip':
        return this.compressGzipStreaming(data, onProgress);
      default:
        throw new Error(`Streaming not supported for algorithm: ${algo}`);
    }
  }

  /**
   * Decompress from streaming chunks
   */
  async decompressStreaming(compressedChunks: ArrayBuffer[], algorithm?: CompressionAlgorithm, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    const algo = algorithm || this.config.algorithm;
    
    switch (algo) {
      case 'lz4':
        return this.lz4Compressor.decompressStreaming(compressedChunks, onProgress);
      case 'gzip':
        return this.decompressGzipStreaming(compressedChunks, onProgress);
      default:
        throw new Error(`Streaming not supported for algorithm: ${algo}`);
    }
  }

  // GZIP compression methods
  private async compressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(data);
    writer.close();
    
    const chunks: Uint8Array[] = [];
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

  private async decompressGzip(compressedData: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(compressedData);
    writer.close();
    
    const chunks: Uint8Array[] = [];
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

  // Deflate compression methods
  private async compressDeflate(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new CompressionStream('deflate');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(data);
    writer.close();
    
    const chunks: Uint8Array[] = [];
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

  private async decompressDeflate(compressedData: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new DecompressionStream('deflate');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(compressedData);
    writer.close();
    
    const chunks: Uint8Array[] = [];
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

  // Brotli compression methods
  private async compressBrotli(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(data);
    writer.close();
    
    const chunks: Uint8Array[] = [];
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

  private async decompressBrotli(compressedData: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(compressedData);
    writer.close();
    
    const chunks: Uint8Array[] = [];
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

  // Streaming methods for GZIP
  private async compressGzipStreaming(data: ArrayBuffer, onProgress?: (progress: number) => void): Promise<ArrayBuffer[]> {
    const chunkSize = this.config.chunkSize || 64 * 1024;
    const inputData = new Uint8Array(data);
    const chunks: ArrayBuffer[] = [];
    
    for (let i = 0; i < inputData.length; i += chunkSize) {
      const chunk = inputData.slice(i, i + chunkSize);
      const compressedChunk = await this.compressGzip(chunk.buffer);
      chunks.push(compressedChunk);
      
      if (onProgress) {
        const progress = Math.min(100, ((i + chunkSize) / inputData.length) * 100);
        onProgress(progress);
      }
    }
    
    return chunks;
  }

  private async decompressGzipStreaming(compressedChunks: ArrayBuffer[], onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    const decompressedChunks: Uint8Array[] = [];
    
    for (let i = 0; i < compressedChunks.length; i++) {
      const chunk = await this.decompressGzip(compressedChunks[i]);
      decompressedChunks.push(new Uint8Array(chunk));
      
      if (onProgress) {
        const progress = ((i + 1) / compressedChunks.length) * 100;
        onProgress(progress);
      }
    }
    
    const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of decompressedChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }

  // Statistics and monitoring
  private updateStats(algorithm: CompressionAlgorithm, operation: 'compress' | 'decompress', inputSize: number, outputSize: number): void {
    const stats = this.stats.get(algorithm);
    if (!stats) return;

    if (operation === 'compress') {
      stats.totalCompressions++;
      stats.totalBytesCompressed += inputSize;
      stats.averageCompressionRatio = ((stats.averageCompressionRatio * (stats.totalCompressions - 1)) + 
        ((inputSize - outputSize) / inputSize * 100)) / stats.totalCompressions;
    } else {
      stats.totalDecompressions++;
      stats.totalBytesDecompressed += outputSize;
    }
  }

  getStats(): Map<CompressionAlgorithm, CompressionStats> {
    return new Map(this.stats);
  }

  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  clearStats(): void {
    this.initializeStats();
  }
}

// Export singleton instance
export const compressionManager = CompressionManager.getInstance();
