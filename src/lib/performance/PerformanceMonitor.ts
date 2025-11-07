// Performance Monitor for Edge-Native Architecture
// Tracks compression, caching, and processing performance

export interface PerformanceMetrics {
  compression: {
    totalCompressions: number;
    totalDecompressions: number;
    averageCompressionRatio: number;
    averageCompressionTime: number;
    averageDecompressionTime: number;
    totalBytesCompressed: number;
    totalBytesDecompressed: number;
  };
  caching: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    averageAccessTime: number;
    totalCacheSize: number;
    evictionCount: number;
  };
  dataProcessing: {
    totalRecordsProcessed: number;
    totalSearchesPerformed: number;
    averageProcessingTime: number;
    averageSearchTime: number;
    totalQueriesExecuted: number;
  };
  memory: {
    usedMemory: number;
    totalMemory: number;
    memoryPressure: number;
    gcCount: number;
    allocationCount: number;
  };
  network: {
    totalRequests: number;
    totalBytesDownloaded: number;
    averageDownloadTime: number;
    cacheHitRate: number;
    compressionSavings: number;
  };
}

export interface PerformanceEvent {
  type: 'compression' | 'decompression' | 'cache_hit' | 'cache_miss' | 'search' | 'processing' | 'memory' | 'network';
  duration: number;
  size?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics;
  private events: PerformanceEvent[] = [];
  private maxEvents: number = 1000;

  constructor() {
    this.metrics = {
      compression: {
        totalCompressions: 0,
        totalDecompressions: 0,
        averageCompressionRatio: 0,
        averageCompressionTime: 0,
        averageDecompressionTime: 0,
        totalBytesCompressed: 0,
        totalBytesDecompressed: 0,
      },
      caching: {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        averageAccessTime: 0,
        totalCacheSize: 0,
        evictionCount: 0,
      },
      dataProcessing: {
        totalRecordsProcessed: 0,
        totalSearchesPerformed: 0,
        averageProcessingTime: 0,
        averageSearchTime: 0,
        totalQueriesExecuted: 0,
      },
      memory: {
        usedMemory: 0,
        totalMemory: 0,
        memoryPressure: 0,
        gcCount: 0,
        allocationCount: 0,
      },
      network: {
        totalRequests: 0,
        totalBytesDownloaded: 0,
        averageDownloadTime: 0,
        cacheHitRate: 0,
        compressionSavings: 0,
      },
    };
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordEvent(event: Omit<PerformanceEvent, 'timestamp'>): void {
    const fullEvent: PerformanceEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.updateMetrics(fullEvent);
  }

  private updateMetrics(event: PerformanceEvent): void {
    switch (event.type) {
      case 'compression':
        this.metrics.compression.totalCompressions++;
        this.metrics.compression.totalBytesCompressed += event.size || 0;
        this.updateAverage('compression', 'averageCompressionTime', event.duration);
        break;

      case 'decompression':
        this.metrics.compression.totalDecompressions++;
        this.metrics.compression.totalBytesDecompressed += event.size || 0;
        this.updateAverage('compression', 'averageDecompressionTime', event.duration);
        break;

      case 'cache_hit':
        this.metrics.caching.totalHits++;
        this.updateCacheHitRate();
        this.updateAverage('caching', 'averageAccessTime', event.duration);
        break;

      case 'cache_miss':
        this.metrics.caching.totalMisses++;
        this.updateCacheHitRate();
        this.updateAverage('caching', 'averageAccessTime', event.duration);
        break;

      case 'search':
        this.metrics.dataProcessing.totalSearchesPerformed++;
        this.updateAverage('dataProcessing', 'averageSearchTime', event.duration);
        break;

      case 'processing':
        this.metrics.dataProcessing.totalRecordsProcessed += event.size || 0;
        this.updateAverage('dataProcessing', 'averageProcessingTime', event.duration);
        break;

      case 'memory':
        this.metrics.memory.usedMemory = event.metadata?.usedMemory || 0;
        this.metrics.memory.totalMemory = event.metadata?.totalMemory || 0;
        this.metrics.memory.memoryPressure = event.metadata?.memoryPressure || 0;
        this.metrics.memory.gcCount = event.metadata?.gcCount || 0;
        this.metrics.memory.allocationCount = event.metadata?.allocationCount || 0;
        break;

      case 'network':
        this.metrics.network.totalRequests++;
        this.metrics.network.totalBytesDownloaded += event.size || 0;
        this.updateAverage('network', 'averageDownloadTime', event.duration);
        break;
    }
  }

  private updateAverage(category: keyof PerformanceMetrics, field: string, value: number): void {
    const categoryMetrics = this.metrics[category] as any;
    const currentAverage = categoryMetrics[field] || 0;
    const totalCount = this.getTotalCount(category, field);
    
    if (totalCount > 0) {
      categoryMetrics[field] = ((currentAverage * (totalCount - 1)) + value) / totalCount;
    } else {
      categoryMetrics[field] = value;
    }
  }

  private getTotalCount(category: keyof PerformanceMetrics, field: string): number {
    switch (category) {
      case 'compression':
        return field.includes('Compression') ? this.metrics.compression.totalCompressions : this.metrics.compression.totalDecompressions;
      case 'caching':
        return this.metrics.caching.totalHits + this.metrics.caching.totalMisses;
      case 'dataProcessing':
        return field.includes('Search') ? this.metrics.dataProcessing.totalSearchesPerformed : this.metrics.dataProcessing.totalRecordsProcessed;
      case 'network':
        return this.metrics.network.totalRequests;
      default:
        return 1;
    }
  }

  private updateCacheHitRate(): void {
    const total = this.metrics.caching.totalHits + this.metrics.caching.totalMisses;
    if (total > 0) {
      this.metrics.caching.hitRate = (this.metrics.caching.totalHits / total) * 100;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getEvents(type?: string): PerformanceEvent[] {
    if (type) {
      return this.events.filter(event => event.type === type);
    }
    return [...this.events];
  }

  getRecentEvents(limit: number = 100): PerformanceEvent[] {
    return this.events.slice(-limit);
  }

  getPerformanceSummary(): string {
    const metrics = this.metrics;
    
    return `
📊 Performance Summary
=====================

🗜️  Compression:
  - Compressions: ${metrics.compression.totalCompressions}
  - Decompressions: ${metrics.compression.totalDecompressions}
  - Avg Compression Time: ${metrics.compression.averageCompressionTime.toFixed(2)}ms
  - Avg Decompression Time: ${metrics.compression.averageDecompressionTime.toFixed(2)}ms
  - Compression Ratio: ${metrics.compression.averageCompressionRatio.toFixed(1)}%

💾 Caching:
  - Hit Rate: ${metrics.caching.hitRate.toFixed(1)}%
  - Total Hits: ${metrics.caching.totalHits}
  - Total Misses: ${metrics.caching.totalMisses}
  - Avg Access Time: ${metrics.caching.averageAccessTime.toFixed(2)}ms

🔍 Data Processing:
  - Records Processed: ${metrics.dataProcessing.totalRecordsProcessed.toLocaleString()}
  - Searches Performed: ${metrics.dataProcessing.totalSearchesPerformed}
  - Avg Search Time: ${metrics.dataProcessing.averageSearchTime.toFixed(2)}ms
  - Avg Processing Time: ${metrics.dataProcessing.averageProcessingTime.toFixed(2)}ms

🧠 Memory:
  - Used Memory: ${(metrics.memory.usedMemory / 1024 / 1024).toFixed(1)}MB
  - Memory Pressure: ${(metrics.memory.memoryPressure * 100).toFixed(1)}%
  - GC Count: ${metrics.memory.gcCount}

🌐 Network:
  - Total Requests: ${metrics.network.totalRequests}
  - Bytes Downloaded: ${(metrics.network.totalBytesDownloaded / 1024 / 1024).toFixed(1)}MB
  - Avg Download Time: ${metrics.network.averageDownloadTime.toFixed(2)}ms
    `.trim();
  }

  clearMetrics(): void {
    this.metrics = {
      compression: {
        totalCompressions: 0,
        totalDecompressions: 0,
        averageCompressionRatio: 0,
        averageCompressionTime: 0,
        averageDecompressionTime: 0,
        totalBytesCompressed: 0,
        totalBytesDecompressed: 0,
      },
      caching: {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        averageAccessTime: 0,
        totalCacheSize: 0,
        evictionCount: 0,
      },
      dataProcessing: {
        totalRecordsProcessed: 0,
        totalSearchesPerformed: 0,
        averageProcessingTime: 0,
        averageSearchTime: 0,
        totalQueriesExecuted: 0,
      },
      memory: {
        usedMemory: 0,
        totalMemory: 0,
        memoryPressure: 0,
        gcCount: 0,
        allocationCount: 0,
      },
      network: {
        totalRequests: 0,
        totalBytesDownloaded: 0,
        averageDownloadTime: 0,
        cacheHitRate: 0,
        compressionSavings: 0,
      },
    };
    this.events = [];
  }

  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      events: this.events,
      timestamp: Date.now(),
    }, null, 2);
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
