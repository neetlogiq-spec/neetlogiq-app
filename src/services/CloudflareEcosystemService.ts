/**
 * Complete Cloudflare Ecosystem Service
 * Integrates with Cloudflare Workers, KV, D1, R2, and Vectorize
 */

export interface CloudflareConfig {
  workerUrl: string;
  apiKey?: string;
  environment: 'local' | 'staging' | 'production';
}

export interface CloudflareResponse<T = any> {
  data: T;
  metadata: {
    source: 'edge' | 'kv' | 'd1' | 'r2' | 'vectorize' | 'fallback';
    stream: string;
    dataType: string;
    round?: number;
    timestamp: string;
    responseTime: number;
    cacheHit: boolean;
  };
}

export interface CloudflareAnalytics {
  workerMetrics: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  kvMetrics: {
    operations: number;
    hitRate: number;
    missRate: number;
  };
  d1Metrics: {
    queries: number;
    averageQueryTime: number;
    connections: number;
  };
  r2Metrics: {
    requests: number;
    bandwidth: number;
    storage: number;
  };
  vectorizeMetrics: {
    searches: number;
    averageSearchTime: number;
    indexSize: number;
  };
}

export class CloudflareEcosystemService {
  private config: CloudflareConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  /**
   * Get data from Cloudflare edge with full ecosystem integration
   */
  async getData(
    stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL',
    dataType: 'colleges' | 'courses' | 'cutoffs',
    round?: number
  ): Promise<CloudflareResponse> {
    const startTime = performance.now();
    
    try {
      // Check local cache first
      const cacheKey = `${stream}_${dataType}_${round || 'static'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes TTL
        return {
          data: cached.data,
          metadata: {
            source: 'edge',
            stream,
            dataType,
            round,
            timestamp: new Date(cached.timestamp).toISOString(),
            responseTime: performance.now() - startTime,
            cacheHit: true
          }
        };
      }

      // Fetch from Cloudflare Worker
      const url = `${this.config.workerUrl}/api/streams/${stream}/${dataType}${round ? `/${round}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey || 'local'}`,
          'X-Environment': this.config.environment
        }
      });

      if (!response.ok) {
        throw new Error(`Cloudflare Worker request failed: ${response.status} ${response.statusText}`);
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
          responseTime,
          cacheHit: false
        }
      };

    } catch (error) {
      console.error('Cloudflare ecosystem error:', error);
      return this.getFallbackData(stream, dataType, round, startTime);
    }
  }

  /**
   * Search with AI-powered vector search
   */
  async searchWithAI(
    query: string,
    stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL',
    filters: any = {}
  ): Promise<CloudflareResponse> {
    const startTime = performance.now();
    
    try {
      const searchParams = new URLSearchParams({
        q: query,
        stream,
        ...filters
      });

      const url = `${this.config.workerUrl}/api/search/?${searchParams}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey || 'local'}`,
          'X-Environment': this.config.environment
        }
      });

      if (!response.ok) {
        throw new Error(`AI search request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const responseTime = performance.now() - startTime;
      this.recordMetric('ai_search_time', responseTime);

      return {
        data: result.results,
        metadata: {
          source: 'vectorize',
          stream: result.stream,
          dataType: 'search',
          timestamp: result.timestamp,
          responseTime,
          cacheHit: false
        }
      };

    } catch (error) {
      console.error('AI search error:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics from Cloudflare ecosystem
   */
  async getEcosystemAnalytics(): Promise<CloudflareAnalytics> {
    try {
      const url = `${this.config.workerUrl}/api/analytics/ecosystem`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey || 'local'}`,
          'X-Environment': this.config.environment
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
   * Store data in Cloudflare KV
   */
  async storeInKV(key: string, data: any, ttl: number = 3600): Promise<void> {
    try {
      const url = `${this.config.workerUrl}/api/kv/store`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey || 'local'}`,
          'X-Environment': this.config.environment
        },
        body: JSON.stringify({ key, data, ttl })
      });

      if (!response.ok) {
        throw new Error(`KV store request failed: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('KV store error:', error);
      throw error;
    }
  }

  /**
   * Query D1 database
   */
  async queryD1(query: string, params: any[] = []): Promise<any> {
    try {
      const url = `${this.config.workerUrl}/api/d1/query`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey || 'local'}`,
          'X-Environment': this.config.environment
        },
        body: JSON.stringify({ query, params })
      });

      if (!response.ok) {
        throw new Error(`D1 query request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error('D1 query error:', error);
      throw error;
    }
  }

  /**
   * Store file in R2
   */
  async storeInR2(key: string, file: File | Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', key);

      const url = `${this.config.workerUrl}/api/r2/upload`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey || 'local'}`,
          'X-Environment': this.config.environment
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`R2 upload request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.url;

    } catch (error) {
      console.error('R2 upload error:', error);
      throw error;
    }
  }

  /**
   * Test Cloudflare ecosystem connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const analytics = await this.getEcosystemAnalytics();
      console.log('✅ Cloudflare ecosystem connectivity test passed:', analytics);
      return true;
    } catch (error) {
      console.error('❌ Cloudflare ecosystem connectivity test failed:', error);
      return false;
    }
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

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('✅ Cloudflare ecosystem cache cleared');
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
  ): CloudflareResponse {
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
        responseTime: performance.now() - startTime,
        cacheHit: false
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
      fallback: true,
      cloudflare_ecosystem: true
    }));
  }
}

// Export singleton instance
export const cloudflareEcosystemService = new CloudflareEcosystemService({
  workerUrl: process.env.NODE_ENV === 'production' 
    ? process.env.NEXT_PUBLIC_WORKER_URL || 'https://neetlogiq-edge-native-prod.your-subdomain.workers.dev'
    : 'http://localhost:8787',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'local'
});
