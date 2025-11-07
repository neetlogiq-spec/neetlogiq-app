// EdgeDataService - Replacement for JsonCache with WebAssembly integration
// This service provides high-performance data processing using WebAssembly modules

import { CutoffRecord, MasterData, CutoffFilters } from '@/types/data';

interface EdgeDataServiceConfig {
  wasmPath: string;
  dataPath: string;
  cacheSize: number;
  compressionLevel: number;
}

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

// Module type declarations for WebAssembly
declare global {
  interface Module {
    onRuntimeInitialized: () => void;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    _processCutoffData: (compressedData: number, compressedSize: number, outputBuffer: number) => number;
    _searchCutoffsByCollege: (collegeHash: number, maxResults: number) => number;
    _searchCutoffsByCourse: (courseHash: number, maxResults: number) => number;
    _searchCutoffsByCategory: (categoryHash: number, maxResults: number) => number;
    _init: () => number;
    _cleanup: () => void;
    HEAPU8: Uint8Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
  }
}

class EdgeDataService {
  private cache: Map<string, CacheItem> = new Map();
  private wasmModule: any = null;
  private config: EdgeDataServiceConfig;
  private initialized: boolean = false;

  constructor(config: EdgeDataServiceConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load WebAssembly modules
      await this.loadWasmModules();
      
      // Initialize cache
      this.cache = new Map();
      
      this.initialized = true;
      console.log('EdgeDataService initialized');
    } catch (error) {
      console.error('Failed to initialize EdgeDataService:', error);
      throw error;
    }
  }

  private async loadWasmModules(): Promise<void> {
    // Fallback to JavaScript implementation for now
    console.log('Using JavaScript fallback for data processing');
    this.wasmModule = {
      init: async () => 0,
      processCutoffData: async () => 0,
      searchCutoffsByCollege: async () => [],
      searchCutoffsByCourse: async () => [],
      searchCutoffsByCategory: async () => [],
      cleanup: () => {}
    };
  }

  async getCutoffs(filters: CutoffFilters = {}): Promise<CutoffRecord[]> {
    if (!this.initialized) {
      await this.init();
    }

    const cacheKey = this.generateCacheKey('cutoffs', filters);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Load and process data
      const data = await this.loadCutoffData(filters);
      
      // Cache the result
      this.setCache(cacheKey, data, 3600000); // 1 hour TTL
      
      return data;
    } catch (error) {
      console.error('Error loading cutoffs:', error);
      throw error;
    }
  }

  async getMasterData(): Promise<MasterData> {
    if (!this.initialized) {
      await this.init();
    }

    const cacheKey = 'master_data';
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Load master data
      const data = await this.loadMasterData();
      
      // Cache the result
      this.setCache(cacheKey, data, 86400000); // 24 hour TTL
      
      return data;
    } catch (error) {
      console.error('Error loading master data:', error);
      throw error;
    }
  }

  private async loadCutoffData(filters: CutoffFilters): Promise<CutoffRecord[]> {
    try {
      // Try WebAssembly processing first
      if (this.wasmModule && this.wasmModule.processCutoffData) {
        return await this.processWithWasm(filters);
      }
      
      // Fallback to JavaScript processing
      return await this.processWithJavaScript(filters);
    } catch (error) {
      console.error('Error processing cutoff data:', error);
      throw error;
    }
  }

  private async processWithWasm(filters: CutoffFilters): Promise<CutoffRecord[]> {
    // Load compressed Parquet data
    const response = await fetch(`${this.config.dataPath}/cutoffs/cutoffs.parquet`);
    const compressedData = await response.arrayBuffer();
    
    // Process with WebAssembly
    const result = await this.wasmModule.processCutoffData(
      compressedData,
      compressedData.byteLength
    );
    
    // Apply filters
    return this.applyFilters(result, filters);
  }

  private async processWithJavaScript(filters: CutoffFilters): Promise<CutoffRecord[]> {
    // Fallback to JavaScript processing
    const response = await fetch(`${this.config.dataPath}/cutoffs/cutoffs.json`);
    const data = await response.json();
    
    // Apply filters
    return this.applyFilters(data, filters);
  }

  private async loadMasterData(): Promise<MasterData> {
    try {
      // Load master data from Parquet files
      const [states, categories, quotas, courses, colleges] = await Promise.all([
        this.loadParquetData('states.parquet'),
        this.loadParquetData('categories.parquet'),
        this.loadParquetData('quotas.parquet'),
        this.loadParquetData('courses.parquet'),
        this.loadParquetData('colleges.parquet'),
      ]);
      
      return {
        states,
        categories,
        quotas,
        courses,
        colleges,
      };
    } catch (error) {
      console.error('Error loading master data:', error);
      throw error;
    }
  }

  private async loadParquetData(filename: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.config.dataPath}/${filename}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      return [];
    }
  }

  private applyFilters(data: CutoffRecord[], filters: CutoffFilters): CutoffRecord[] {
    return data.filter(record => {
      if (filters.college_id && record.college_id !== filters.college_id) return false;
      if (filters.course_id && record.course_id !== filters.course_id) return false;
      if (filters.category_id && record.category_id !== filters.category_id) return false;
      if (filters.state_id && record.state_id !== filters.state_id) return false;
      if (filters.year && record.year !== filters.year) return false;
      if (filters.round && record.round !== filters.round) return false;
      if (filters.min_rank && record.closing_rank < filters.min_rank) return false;
      if (filters.max_rank && record.closing_rank > filters.max_rank) return false;
      
      return true;
    });
  }

  private generateCacheKey(prefix: string, filters: any): string {
    const filterStr = JSON.stringify(filters);
    return `${prefix}_${btoa(filterStr)}`;
  }

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    // Clean up old cache entries
    if (this.cache.size > this.config.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  // Search functionality
  async searchCutoffs(query: string, limit: number = 10): Promise<CutoffRecord[]> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Try WebAssembly search first
      if (this.wasmModule && this.wasmModule.searchCutoffs) {
        return await this.wasmModule.searchCutoffs(query, limit);
      }
      
      // Fallback to JavaScript search
      return await this.searchWithJavaScript(query, limit);
    } catch (error) {
      console.error('Error searching cutoffs:', error);
      throw error;
    }
  }

  private async searchWithJavaScript(query: string, limit: number): Promise<CutoffRecord[]> {
    const allCutoffs = await this.getCutoffs();
    
    // Simple text search
    const results = allCutoffs.filter(record => 
      record.college_name.toLowerCase().includes(query.toLowerCase()) ||
      record.course_name.toLowerCase().includes(query.toLowerCase()) ||
      record.state_name.toLowerCase().includes(query.toLowerCase())
    );
    
    return results.slice(0, limit);
  }

  // Cleanup
  cleanup(): void {
    this.cache.clear();
    if (this.wasmModule && this.wasmModule.cleanup) {
      this.wasmModule.cleanup();
    }
  }
}

// Export singleton instance
export const edgeDataService = new EdgeDataService({
  wasmPath: '/New/WASM',
  dataPath: '/data',
  cacheSize: 1000,
  compressionLevel: 9,
});

export default edgeDataService;
