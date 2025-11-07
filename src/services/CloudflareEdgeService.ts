/**
 * Cloudflare Edge Service for Edge-Native + AI Architecture
 * Integrates with Cloudflare Workers for edge processing
 */

export interface EdgeConfig {
  workerUrl: string;
  apiKey?: string;
  environment: 'local' | 'staging' | 'production';
}

export interface EdgeResponse<T = any> {
  data: T;
  metadata: {
    source: 'edge' | 'cache' | 'fallback';
    stream: string;
    dataType: string;
    round?: number;
    timestamp: string;
    responseTime: number;
  };
}

export interface SearchFilters {
  collegeName?: string;
  courseName?: string;
  minRank?: number;
  maxRank?: number;
  state?: string;
  category?: string;
  round?: number;
}

export class CloudflareEdgeService {
  private config: EdgeConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(config: EdgeConfig) {
    this.config = config;
  }

  /**
   * Get stream data from Cloudflare edge
   */
  async getStreamData(
    stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL',
    dataType: 'colleges' | 'courses' | 'cutoffs',
    round?: number
  ): Promise<EdgeResponse> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      const cacheKey = `${stream}_${dataType}_${round || 'static'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes TTL
        console.log(`✅ Cache hit for ${cacheKey}`);
        return {
          data: cached.data,
          metadata: {
            source: 'cache',
            stream,
            dataType,
            round,
            timestamp: new Date(cached.timestamp).toISOString(),
            responseTime: performance.now() - startTime
          }
        };
      }

      // Fetch from edge
      const url = `${this.config.workerUrl}/api/streams/${stream}/${dataType}${round ? `/${round}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Edge request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now()
      });

      const responseTime = performance.now() - startTime;
      this.recordMetric('response_time', responseTime);

      return {
        data: result.data,
        metadata: {
          source: result.metadata.source,
          stream: result.metadata.stream,
          dataType: result.metadata.dataType,
          round: result.metadata.round,
          timestamp: result.metadata.timestamp,
          responseTime
        }
      };

    } catch (error) {
      console.error('Edge service error:', error);
      
      // Fallback to local data
      return this.getFallbackData(stream, dataType, round, startTime);
    }
  }

  /**
   * Search cutoffs with advanced filtering
   */
  async searchCutoffs(
    stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL',
    filters: SearchFilters,
    limit: number = 100
  ): Promise<EdgeResponse> {
    const startTime = performance.now();
    
    try {
      const searchParams = new URLSearchParams({
        stream,
        ...(filters.collegeName && { college: filters.collegeName }),
        ...(filters.courseName && { course: filters.courseName }),
        ...(filters.minRank && { min_rank: filters.minRank.toString() }),
        ...(filters.maxRank && { max_rank: filters.maxRank.toString() }),
        ...(filters.state && { state: filters.state }),
        ...(filters.category && { category: filters.category }),
        ...(filters.round && { round: filters.round.toString() })
      });

      const url = `${this.config.workerUrl}/api/search/?${searchParams}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Search request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const responseTime = performance.now() - startTime;
      this.recordMetric('search_time', responseTime);

      return {
        data: result.results.slice(0, limit),
        metadata: {
          source: 'edge',
          stream: result.stream,
          dataType: 'cutoffs',
          round: filters.round,
          timestamp: result.timestamp,
          responseTime
        }
      };

    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a stream
   */
  async getStreamAnalytics(stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL'): Promise<any> {
    try {
      const url = `${this.config.workerUrl}/api/analytics/${stream}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Analytics error:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    try {
      const url = `${this.config.workerUrl}/api/performance/`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Performance request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Performance metrics error:', error);
      throw error;
    }
  }

  /**
   * Compress data using edge compression
   */
  async compressData(data: any, algorithm: 'gzip' | 'lz4' | 'zstd' = 'gzip'): Promise<any> {
    try {
      const url = `${this.config.workerUrl}/api/compression/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({ data, algorithm })
      });

      if (!response.ok) {
        throw new Error(`Compression request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Compression error:', error);
      throw error;
    }
  }

  /**
   * Test edge connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const metrics = await this.getPerformanceMetrics();
      console.log('✅ Edge connectivity test passed:', metrics);
      return true;
    } catch (error) {
      console.error('❌ Edge connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const totalRequests = Array.from(this.performanceMetrics.values())
      .reduce((sum, metrics) => sum + metrics.length, 0);
    
    const cacheHits = this.cache.size;
    const hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      hitRate: parseFloat(hitRate.toFixed(2))
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('✅ Edge cache cleared');
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): { [key: string]: number } {
    const metrics: { [key: string]: number } = {};
    
    this.performanceMetrics.forEach((values, key) => {
      metrics[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
    });

    return metrics;
  }

  private recordMetric(key: string, value: number): void {
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    
    const metrics = this.performanceMetrics.get(key)!;
    metrics.push(value);
    
    // Keep only last 100 values
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  private getFallbackData(
    stream: string,
    dataType: string,
    round?: number,
    startTime: number = performance.now()
  ): EdgeResponse {
    // Generate fallback data
    const fallbackData = this.generateFallbackData(stream, dataType, round);
    
    return {
      data: fallbackData,
      metadata: {
        source: 'fallback',
        stream,
        dataType,
        round,
        timestamp: new Date().toISOString(),
        responseTime: performance.now() - startTime
      }
    };
  }

  private generateFallbackData(stream: string, dataType: string, round?: number): any[] {
    // Simple fallback data generation
    const count = Math.floor(Math.random() * 20) + 10;
    
    return Array.from({ length: count }, (_, i) => ({
      id: `fallback_${stream}_${dataType}_${i + 1}`,
      stream,
      dataType,
      round,
      generated_at: new Date().toISOString(),
      fallback: true
    }));
  }
}

// Export singleton instance
export const cloudflareEdgeService = new CloudflareEdgeService({
  workerUrl: process.env.NODE_ENV === 'production' 
    ? 'https://neetlogiq-edge-native.your-subdomain.workers.dev'
    : 'http://localhost:8787',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'local'
});
