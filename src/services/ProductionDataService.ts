/**
 * Production Data Service for Edge-Native + AI Architecture
 * Handles real data integration with WebAssembly processing
 */

import { CompressionManager } from '../lib/compression/CompressionManager';
import { IndexedDBCache } from '../lib/cache/IndexedDBCache';
import { PerformanceMonitor } from '../lib/performance/PerformanceMonitor';

export interface ProductionDataConfig {
  stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  dataType: 'colleges' | 'courses' | 'cutoffs';
  round?: number;
  priority?: 'high' | 'normal';
}

export interface ProductionDataResult {
  data: any[];
  metadata: {
    total: number;
    stream: string;
    dataType: string;
    round?: number;
    compressionRatio: number;
    loadTime: number;
    cacheHit: boolean;
  };
}

export class ProductionDataService {
  private compressionManager: CompressionManager;
  private cache: IndexedDBCache;
  private performanceMonitor: PerformanceMonitor;
  private wasmModule: any = null;
  private manifest: any = null;

  constructor() {
    this.compressionManager = new CompressionManager();
    this.cache = new IndexedDBCache();
    this.performanceMonitor = new PerformanceMonitor();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Load production manifest
      await this.loadProductionManifest();
      
      // Initialize WebAssembly module
      await this.loadWebAssemblyModule();
      
      // Initialize cache
      await this.cache.initialize();
      
      console.log('✅ Production Data Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Production Data Service:', error);
    }
  }

  private async loadProductionManifest(): Promise<void> {
    try {
      const response = await fetch('/data/production_manifest.json');
      this.manifest = await response.json();
      console.log('✅ Production manifest loaded');
    } catch (error) {
      console.error('❌ Failed to load production manifest:', error);
      throw error;
    }
  }

  private async loadWebAssemblyModule(): Promise<void> {
    try {
      // Only load WASM in browser environment
      if (typeof window === 'undefined') {
        console.log('⚠️ WASM not available in server environment');
        this.wasmModule = null;
        return;
      }

      // Load WebAssembly module for production processing
      const wasmModule = await import('../../public/WASM/data_processor.js');
      this.wasmModule = await wasmModule.default();
      console.log('✅ WebAssembly module loaded for production');
    } catch (error) {
      console.error('❌ Failed to load WebAssembly module:', error);
      // Fallback to JavaScript processing
      this.wasmModule = null;
    }
  }

  /**
   * Load data for a specific stream and data type
   */
  async loadData(config: ProductionDataConfig): Promise<ProductionDataResult> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(config);
      const cachedData = await this.cache.get(cacheKey);
      
      if (cachedData) {
        console.log(`✅ Cache hit for ${config.stream}_${config.dataType}`);
        return {
          data: cachedData,
          metadata: {
            total: cachedData.length,
            stream: config.stream,
            dataType: config.dataType,
            round: config.round,
            compressionRatio: 0,
            loadTime: performance.now() - startTime,
            cacheHit: true
          }
        };
      }

      // Load from compressed file
      const fileInfo = this.getFileInfo(config);
      if (!fileInfo) {
        throw new Error(`File not found for ${config.stream}_${config.dataType}`);
      }

      // Fetch compressed data
      const response = await fetch(fileInfo.url);
      const compressedData = await response.arrayBuffer();
      
      // Decompress data
      const decompressedData = await this.compressionManager.decompress(
        new Uint8Array(compressedData),
        'gzip'
      );
      
      // Parse JSON data
      const jsonData = JSON.parse(new TextDecoder().decode(decompressedData));
      
      // Process with WebAssembly if available
      let processedData = jsonData.data || jsonData;
      if (this.wasmModule && config.dataType === 'cutoffs') {
        processedData = await this.processWithWebAssembly(processedData, config);
      }
      
      // Cache the result
      await this.cache.set(cacheKey, processedData, 3600000); // 1 hour TTL
      
      const loadTime = performance.now() - startTime;
      
      // Record performance metrics
      this.performanceMonitor.recordMetric('data_load_time', loadTime);
      this.performanceMonitor.recordMetric('data_size', decompressedData.length);
      
      return {
        data: processedData,
        metadata: {
          total: processedData.length,
          stream: config.stream,
          dataType: config.dataType,
          round: config.round,
          compressionRatio: fileInfo.compressionRatio,
          loadTime,
          cacheHit: false
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      throw error;
    }
  }

  /**
   * Search cutoffs with advanced filtering
   */
  async searchCutoffs(
    stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL',
    filters: {
      collegeName?: string;
      courseName?: string;
      minRank?: number;
      maxRank?: number;
      state?: string;
      category?: string;
      round?: number;
    },
    limit: number = 100
  ): Promise<ProductionDataResult> {
    const startTime = performance.now();
    
    try {
      // Load cutoff data
      const cutoffData = await this.loadData({
        stream,
        dataType: 'cutoffs',
        round: filters.round
      });
      
      // Apply filters
      let filteredData = cutoffData.data;
      
      if (filters.collegeName) {
        filteredData = filteredData.filter((item: any) =>
          item.college_name?.toLowerCase().includes(filters.collegeName!.toLowerCase())
        );
      }
      
      if (filters.courseName) {
        filteredData = filteredData.filter((item: any) =>
          item.course_name?.toLowerCase().includes(filters.courseName!.toLowerCase())
        );
      }
      
      if (filters.minRank) {
        filteredData = filteredData.filter((item: any) =>
          item.opening_rank >= filters.minRank!
        );
      }
      
      if (filters.maxRank) {
        filteredData = filteredData.filter((item: any) =>
          item.closing_rank <= filters.maxRank!
        );
      }
      
      if (filters.state) {
        filteredData = filteredData.filter((item: any) =>
          item.state === filters.state
        );
      }
      
      if (filters.category) {
        filteredData = filteredData.filter((item: any) =>
          item.category === filters.category
        );
      }
      
      // Sort by opening rank
      filteredData.sort((a: any, b: any) => a.opening_rank - b.opening_rank);
      
      // Limit results
      filteredData = filteredData.slice(0, limit);
      
      const searchTime = performance.now() - startTime;
      this.performanceMonitor.recordMetric('search_time', searchTime);
      
      return {
        data: filteredData,
        metadata: {
          total: filteredData.length,
          stream,
          dataType: 'cutoffs',
          round: filters.round,
          compressionRatio: cutoffData.metadata.compressionRatio,
          loadTime: searchTime,
          cacheHit: cutoffData.metadata.cacheHit
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to search cutoffs:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a stream
   */
  async getStreamAnalytics(stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL'): Promise<any> {
    try {
      const streamInfo = this.manifest?.streams[stream];
      if (!streamInfo) {
        throw new Error(`Stream ${stream} not found in manifest`);
      }
      
      // Load sample data for analytics
      const cutoffData = await this.loadData({
        stream,
        dataType: 'cutoffs',
        round: 1
      });
      
      // Calculate analytics
      const analytics = {
        stream,
        totalFiles: streamInfo.total_files,
        totalSize: streamInfo.total_size,
        priorityRounds: streamInfo.priority_rounds,
        dataTypes: streamInfo.data_types,
        sampleData: {
          totalCutoffs: cutoffData.data.length,
          averageRank: cutoffData.data.reduce((sum: number, item: any) => 
            sum + (item.opening_rank + item.closing_rank) / 2, 0) / cutoffData.data.length,
          states: [...new Set(cutoffData.data.map((item: any) => item.state))],
          categories: [...new Set(cutoffData.data.map((item: any) => item.category))]
        },
        performance: {
          averageLoadTime: this.performanceMonitor.getAverageMetric('data_load_time'),
          averageSearchTime: this.performanceMonitor.getAverageMetric('search_time'),
          cacheHitRate: this.cache.getHitRate()
        }
      };
      
      return analytics;
      
    } catch (error) {
      console.error('❌ Failed to get stream analytics:', error);
      throw error;
    }
  }

  private getFileInfo(config: ProductionDataConfig): any {
    if (!this.manifest?.streams[config.stream]) {
      return null;
    }
    
    const streamFiles = this.manifest.streams[config.stream].files;
    
    if (config.dataType === 'cutoffs' && config.round) {
      return streamFiles.find((file: any) => 
        file.data_type === 'cutoffs' && file.round === config.round
      );
    } else {
      return streamFiles.find((file: any) => 
        file.data_type === config.dataType && !file.round
      );
    }
  }

  private getCacheKey(config: ProductionDataConfig): string {
    return `${config.stream}_${config.dataType}${config.round ? `_round_${config.round}` : ''}`;
  }

  private async processWithWebAssembly(data: any[], config: ProductionDataConfig): Promise<any[]> {
    if (!this.wasmModule) {
      return data;
    }
    
    try {
      // Use WebAssembly for high-performance processing
      const jsonData = JSON.stringify(data);
      const result = await this.wasmModule.process_cutoff_data(jsonData);
      return JSON.parse(result);
    } catch (error) {
      console.error('❌ WebAssembly processing failed, using fallback:', error);
      return data;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return {
      dataLoadTime: this.performanceMonitor.getAverageMetric('data_load_time'),
      searchTime: this.performanceMonitor.getAverageMetric('search_time'),
      dataSize: this.performanceMonitor.getAverageMetric('data_size'),
      cacheHitRate: this.cache.getHitRate(),
      totalRequests: this.performanceMonitor.getTotalRequests()
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    console.log('✅ Cache cleared');
  }
}

// Export singleton instance
export const productionDataService = new ProductionDataService();
