// Enhanced Data Processor with WebAssembly integration
// This service provides high-performance data processing for the Excel-style interface

import { CutoffRecord } from '@/types/data';

interface DataProcessorConfig {
  enableWebAssembly: boolean;
  enableVirtualization: boolean;
  enableAI: boolean;
  cacheSize: number;
}

interface ProcessingResult {
  data: CutoffRecord[];
  statistics: {
    totalRecords: number;
    filteredRecords: number;
    processingTime: number;
    memoryUsage: number;
  };
  insights: {
    trends: {
      up: number;
      down: number;
      stable: number;
    };
    predictions: {
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
    };
    recommendations: CutoffRecord[];
  };
}

interface FilterOptions {
  searchQuery?: string;
  columns?: string[];
  operators?: { [key: string]: 'equals' | 'contains' | 'range' | 'in' };
  values?: { [key: string]: any };
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

class EnhancedDataProcessor {
  private config: DataProcessorConfig;
  private wasmModule: any = null;
  private cache: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  constructor(config: DataProcessorConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.config.enableWebAssembly) {
        await this.loadWebAssemblyModule();
      }
      
      this.isInitialized = true;
      console.log('✅ Enhanced Data Processor initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Data Processor:', error);
      // Fallback to JavaScript implementation
      this.config.enableWebAssembly = false;
      this.isInitialized = true;
    }
  }

  private async loadWebAssemblyModule(): Promise<void> {
    try {
      // Temporarily disable WebAssembly due to import issues
      console.warn('WebAssembly temporarily disabled, using fallback');
      this.wasmModule = null;
      return;
      
      await wasmModule.default();
      const processor = await wasmModule.default();
      
      this.wasmModule = {
        processData: processor.processData.bind(processor),
        filterData: processor.filterData.bind(processor),
        sortData: processor.sortData.bind(processor),
        calculateStatistics: processor.calculateStatistics.bind(processor),
        generateInsights: processor.generateInsights.bind(processor),
        exportData: processor.exportData.bind(processor),
        compressData: processor.compressData.bind(processor),
        decompressData: processor.decompressData.bind(processor)
      };
      
      console.log('✅ WebAssembly module loaded successfully');
    } catch (error) {
      console.warn('⚠️ WebAssembly module not available, using JavaScript fallback');
      this.config.enableWebAssembly = false;
    }
  }

  async processData(
    data: CutoffRecord[],
    options: FilterOptions = {}
  ): Promise<ProcessingResult> {
    await this.initialize();

    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(data, options);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    let processedData: CutoffRecord[];
    let statistics: any;
    let insights: any;

    if (this.config.enableWebAssembly && this.wasmModule) {
      // Use WebAssembly for high-performance processing
      try {
        const wasmResult = await this.processWithWebAssembly(data, options);
        processedData = wasmResult.data;
        statistics = wasmResult.statistics;
        insights = wasmResult.insights;
      } catch (error) {
        console.warn('WebAssembly processing failed, falling back to JavaScript:', error);
        const jsResult = await this.processWithJavaScript(data, options);
        processedData = jsResult.data;
        statistics = jsResult.statistics;
        insights = jsResult.insights;
      }
    } else {
      // Use JavaScript implementation
      const jsResult = await this.processWithJavaScript(data, options);
      processedData = jsResult.data;
      statistics = jsResult.statistics;
      insights = jsResult.insights;
    }

    const processingTime = performance.now() - startTime;

    const result: ProcessingResult = {
      data: processedData,
      statistics: {
        totalRecords: data.length,
        filteredRecords: processedData.length,
        processingTime,
        memoryUsage: this.getMemoryUsage()
      },
      insights
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  private async processWithWebAssembly(
    data: CutoffRecord[],
    options: FilterOptions
  ): Promise<any> {
    if (!this.wasmModule) {
      throw new Error('WebAssembly module not available');
    }

    // Convert data to format expected by WebAssembly
    const dataJson = JSON.stringify(data);
    const optionsJson = JSON.stringify(options);

    // Process data using WebAssembly
    const resultJson = await this.wasmModule.processData(dataJson, optionsJson);
    const result = JSON.parse(resultJson);

    return result;
  }

  private async processWithJavaScript(
    data: CutoffRecord[],
    options: FilterOptions
  ): Promise<any> {
    let processedData = [...data];

    // Apply search query
    if (options.searchQuery) {
      processedData = this.applySearch(processedData, options.searchQuery);
    }

    // Apply column filters
    if (options.columns && options.operators && options.values) {
      processedData = this.applyFilters(processedData, options);
    }

    // Apply sorting
    if (options.sortBy) {
      processedData = this.applySorting(processedData, options.sortBy, options.sortDirection || 'asc');
    }

    // Apply pagination
    if (options.limit || options.offset) {
      const offset = options.offset || 0;
      const limit = options.limit || processedData.length;
      processedData = processedData.slice(offset, offset + limit);
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(data, processedData);

    // Generate insights
    const insights = this.generateInsights(processedData);

    return {
      data: processedData,
      statistics,
      insights
    };
  }

  private applySearch(data: CutoffRecord[], query: string): CutoffRecord[] {
    const searchTerm = query.toLowerCase();
    
    return data.filter(record => 
      Object.values(record).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      )
    );
  }

  private applyFilters(data: CutoffRecord[], options: FilterOptions): CutoffRecord[] {
    if (!options.columns || !options.operators || !options.values) {
      return data;
    }

    return data.filter(record => {
      return options.columns!.every(column => {
        const operator = options.operators![column];
        const value = options.values![column];
        const recordValue = record[column as keyof CutoffRecord];

        switch (operator) {
          case 'equals':
            return recordValue === value;
          case 'contains':
            return String(recordValue).toLowerCase().includes(String(value).toLowerCase());
          case 'range':
            return recordValue >= value.min && recordValue <= value.max;
          case 'in':
            return Array.isArray(value) && value.includes(recordValue);
          default:
            return true;
        }
      });
    });
  }

  private applySorting(data: CutoffRecord[], sortBy: string, direction: 'asc' | 'desc'): CutoffRecord[] {
    return [...data].sort((a, b) => {
      const aValue = a[sortBy as keyof CutoffRecord];
      const bValue = b[sortBy as keyof CutoffRecord];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  }

  private calculateStatistics(originalData: CutoffRecord[], filteredData: CutoffRecord[]): any {
    const totalRecords = originalData.length;
    const filteredRecords = filteredData.length;
    
    // Calculate average seats
    const avgSeats = filteredData.reduce((sum, record) => sum + (record.totalSeats || 0), 0) / filteredRecords;
    
    // Calculate trend distribution
    const trends = {
      up: filteredData.filter(record => record.trendDirection === 'up').length,
      down: filteredData.filter(record => record.trendDirection === 'down').length,
      stable: filteredData.filter(record => record.trendDirection === 'stable').length
    };

    // Calculate prediction confidence distribution
    const predictions = {
      highConfidence: filteredData.filter(record => (record.predictionScore || 0) > 0.8).length,
      mediumConfidence: filteredData.filter(record => (record.predictionScore || 0) > 0.6 && (record.predictionScore || 0) <= 0.8).length,
      lowConfidence: filteredData.filter(record => (record.predictionScore || 0) <= 0.6).length
    };

    return {
      totalRecords,
      filteredRecords,
      avgSeats: Math.round(avgSeats),
      trends,
      predictions
    };
  }

  private generateInsights(data: CutoffRecord[]): any {
    // Find top recommendations
    const recommendations = data
      .filter(record => record.recommendationRank && record.recommendationRank <= 100)
      .sort((a, b) => (a.recommendationRank || 0) - (b.recommendationRank || 0))
      .slice(0, 10);

    // Find trending colleges
    const trendingColleges = data
      .filter(record => record.trendDirection === 'up')
      .sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0))
      .slice(0, 5);

    // Find stable options
    const stableOptions = data
      .filter(record => record.trendDirection === 'stable')
      .sort((a, b) => (b.predictionScore || 0) - (a.predictionScore || 0))
      .slice(0, 5);

    return {
      recommendations,
      trendingColleges,
      stableOptions
    };
  }

  async exportData(
    data: CutoffRecord[],
    format: 'csv' | 'excel' | 'json' | 'parquet'
  ): Promise<Blob> {
    await this.initialize();

    if (this.config.enableWebAssembly && this.wasmModule) {
      try {
        const dataJson = JSON.stringify(data);
        const result = await this.wasmModule.exportData(dataJson, format);
        return new Blob([result], { type: this.getMimeType(format) });
      } catch (error) {
        console.warn('WebAssembly export failed, using JavaScript fallback:', error);
      }
    }

    // JavaScript fallback
    return this.exportWithJavaScript(data, format);
  }

  private async exportWithJavaScript(
    data: CutoffRecord[],
    format: 'csv' | 'excel' | 'json' | 'parquet'
  ): Promise<Blob> {
    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      
      case 'csv':
        const csv = this.convertToCSV(data);
        return new Blob([csv], { type: 'text/csv' });
      
      case 'excel':
        // For Excel export, we'd need a library like xlsx
        // For now, return CSV
        const excelCsv = this.convertToCSV(data);
        return new Blob([excelCsv], { type: 'application/vnd.ms-excel' });
      
      case 'parquet':
        // For Parquet export, we'd need a library like parquetjs
        // For now, return JSON
        return new Blob([JSON.stringify(data)], { type: 'application/octet-stream' });
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private convertToCSV(data: CutoffRecord[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(record => 
      headers.map(header => {
        const value = record[header as keyof CutoffRecord];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'csv': return 'text/csv';
      case 'excel': return 'application/vnd.ms-excel';
      case 'json': return 'application/json';
      case 'parquet': return 'application/octet-stream';
      default: return 'application/octet-stream';
    }
  }

  private generateCacheKey(data: CutoffRecord[], options: FilterOptions): string {
    const dataHash = data.length.toString();
    const optionsHash = JSON.stringify(options);
    return `${dataHash}_${btoa(optionsHash)}`;
  }

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if cache is still valid (5 minutes TTL)
    if (Date.now() - item.timestamp > 5 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.cache.size > this.config.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize;
    }
    return 0;
  }

  // Cleanup
  cleanup(): void {
    this.cache.clear();
    this.isInitialized = false;
    console.log('Enhanced Data Processor cleaned up');
  }
}

// Export singleton instance
export const enhancedDataProcessor = new EnhancedDataProcessor({
  enableWebAssembly: true,
  enableVirtualization: true,
  enableAI: true,
  cacheSize: 1000
});

export default enhancedDataProcessor;
