/**
 * Real User Monitoring (RUM)
 *
 * Client-side performance monitoring to track real user experience
 *
 * Features:
 * - Page load performance
 * - Data fetch tracking
 * - Search performance
 * - Component render times
 * - User interaction metrics
 * - Automatic performance insights
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PageLoadMetrics {
  url: string;
  // Navigation Timing API metrics
  dnsLookup: number;
  tcpConnection: number;
  request: number;
  response: number;
  domProcessing: number;
  domContentLoaded: number;
  onLoad: number;
  total: number;

  // Paint Timing API metrics
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;

  // Resource Timing
  resourceCount: number;
  totalResourceSize: number;
}

export interface DataFetchMetrics {
  operation: string;
  duration: number;
  cached: boolean;
  dataSize?: number;
  error?: boolean;
}

export interface SearchMetrics {
  query: string;
  queryLength: number;
  resultCount: number;
  duration: number;
  cached: boolean;
}

export interface PerformanceSummary {
  metric: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export class RealUserMonitoring {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private pageLoadMetrics: PageLoadMetrics[] = [];
  private dataFetchMetrics: DataFetchMetrics[] = [];
  private searchMetrics: SearchMetrics[] = [];
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    // Observe navigation performance
    if ('PerformanceObserver' in window) {
      try {
        // Navigation timing
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.recordNavigationTiming(entry as PerformanceNavigationTiming);
            }
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });

        // Paint timing
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPaintTiming(entry);
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('Performance observers not fully supported:', error);
      }
    }
  }

  // ============================================================================
  // PAGE LOAD TRACKING
  // ============================================================================

  /**
   * Track page load performance
   */
  trackPageLoad(pageName?: string): void {
    if (!this.enabled || typeof window === 'undefined') return;

    if ('performance' in window && 'getEntriesByType' in performance) {
      const navEntries = performance.getEntriesByType('navigation');

      if (navEntries.length > 0) {
        const navTiming = navEntries[0] as PerformanceNavigationTiming;
        this.recordNavigationTiming(navTiming, pageName);
      }
    }
  }

  /**
   * Record navigation timing metrics
   */
  private recordNavigationTiming(
    navTiming: PerformanceNavigationTiming,
    pageName?: string
  ): void {
    const metrics: PageLoadMetrics = {
      url: pageName || window.location.pathname,
      dnsLookup: navTiming.domainLookupEnd - navTiming.domainLookupStart,
      tcpConnection: navTiming.connectEnd - navTiming.connectStart,
      request: navTiming.responseStart - navTiming.requestStart,
      response: navTiming.responseEnd - navTiming.responseStart,
      domProcessing: navTiming.domComplete - navTiming.domInteractive,
      domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
      onLoad: navTiming.loadEventEnd - navTiming.loadEventStart,
      total: navTiming.loadEventEnd - navTiming.fetchStart,
      resourceCount: 0,
      totalResourceSize: 0
    };

    // Get resource timing
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    metrics.resourceCount = resources.length;
    metrics.totalResourceSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

    this.pageLoadMetrics.push(metrics);

    // Record individual metrics
    this.recordMetric('page_load_total', metrics.total, { url: metrics.url });
    this.recordMetric('page_load_dns', metrics.dnsLookup);
    this.recordMetric('page_load_tcp', metrics.tcpConnection);
    this.recordMetric('page_load_request', metrics.request);
    this.recordMetric('page_load_response', metrics.response);
    this.recordMetric('page_load_dom', metrics.domProcessing);
    this.recordMetric('page_load_dcl', metrics.domContentLoaded);

    // Send to analytics if available
    this.sendToAnalytics('page_load', metrics);
  }

  /**
   * Record paint timing
   */
  private recordPaintTiming(entry: PerformanceEntry): void {
    if (entry.name === 'first-paint') {
      this.recordMetric('first_paint', entry.startTime);
    } else if (entry.name === 'first-contentful-paint') {
      this.recordMetric('first_contentful_paint', entry.startTime);
    }
  }

  // ============================================================================
  // DATA FETCH TRACKING
  // ============================================================================

  /**
   * Track data fetch performance
   */
  trackDataFetch(
    operation: string,
    duration: number,
    cached: boolean,
    options?: { dataSize?: number; error?: boolean }
  ): void {
    if (!this.enabled) return;

    const metric: DataFetchMetrics = {
      operation,
      duration,
      cached,
      dataSize: options?.dataSize,
      error: options?.error
    };

    this.dataFetchMetrics.push(metric);

    // Record metric
    const metricName = cached ? 'data_fetch_cached' : 'data_fetch_network';
    this.recordMetric(metricName, duration, { operation });

    // Send to analytics
    this.sendToAnalytics('data_fetch', metric);
  }

  // ============================================================================
  // SEARCH TRACKING
  // ============================================================================

  /**
   * Track search performance
   */
  trackSearch(
    query: string,
    resultCount: number,
    duration: number,
    cached: boolean = false
  ): void {
    if (!this.enabled) return;

    const metric: SearchMetrics = {
      query: query.substring(0, 50), // Truncate for privacy
      queryLength: query.length,
      resultCount,
      duration,
      cached
    };

    this.searchMetrics.push(metric);

    // Record metrics
    this.recordMetric('search_duration', duration, { queryLength: query.length });
    this.recordMetric('search_results', resultCount, { queryLength: query.length });

    // Send to analytics
    this.sendToAnalytics('search', metric);
  }

  // ============================================================================
  // CUSTOM METRICS
  // ============================================================================

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Keep only last 1000 metrics per type
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * Mark performance timing
   */
  mark(name: string): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(name);
    }
  }

  /**
   * Measure performance between marks
   */
  measure(name: string, startMark: string, endMark: string): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        this.recordMetric(name, measure.duration);
        return measure.duration;
      } catch (error) {
        console.warn('Performance measure failed:', error);
      }
    }
    return 0;
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  /**
   * Get performance summary for a metric
   */
  getMetricSummary(metricName: string): PerformanceSummary | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) return null;

    const values = metrics.map(m => m.value).sort((a, b) => a - b);

    return {
      metric: metricName,
      count: values.length,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    };
  }

  /**
   * Get complete performance report
   */
  getPerformanceReport(): {
    pageLoads: PageLoadMetrics[];
    dataFetches: DataFetchMetrics[];
    searches: SearchMetrics[];
    summaries: PerformanceSummary[];
  } {
    const summaries: PerformanceSummary[] = [];

    for (const metricName of this.metrics.keys()) {
      const summary = this.getMetricSummary(metricName);
      if (summary) {
        summaries.push(summary);
      }
    }

    return {
      pageLoads: this.pageLoadMetrics.slice(-10), // Last 10 page loads
      dataFetches: this.dataFetchMetrics.slice(-50), // Last 50 fetches
      searches: this.searchMetrics.slice(-50), // Last 50 searches
      summaries
    };
  }

  /**
   * Get performance insights
   */
  getInsights(): string[] {
    const insights: string[] = [];

    // Page load insights
    const pageLoadSummary = this.getMetricSummary('page_load_total');
    if (pageLoadSummary) {
      if (pageLoadSummary.avg > 3000) {
        insights.push(`⚠️ Average page load time is ${Math.round(pageLoadSummary.avg)}ms (>3s). Consider optimization.`);
      } else if (pageLoadSummary.avg < 1000) {
        insights.push(`✅ Excellent page load performance: ${Math.round(pageLoadSummary.avg)}ms`);
      }
    }

    // Data fetch insights
    const cachedFetches = this.dataFetchMetrics.filter(m => m.cached).length;
    const totalFetches = this.dataFetchMetrics.length;
    if (totalFetches > 0) {
      const cacheRate = (cachedFetches / totalFetches) * 100;
      if (cacheRate > 80) {
        insights.push(`✅ High cache hit rate: ${Math.round(cacheRate)}%`);
      } else if (cacheRate < 30) {
        insights.push(`⚠️ Low cache hit rate: ${Math.round(cacheRate)}%. Consider improving caching.`);
      }
    }

    // Search performance insights
    const searchSummary = this.getMetricSummary('search_duration');
    if (searchSummary) {
      if (searchSummary.avg > 500) {
        insights.push(`⚠️ Slow search performance: ${Math.round(searchSummary.avg)}ms average`);
      } else if (searchSummary.avg < 100) {
        insights.push(`✅ Fast search performance: ${Math.round(searchSummary.avg)}ms average`);
      }
    }

    // First Contentful Paint
    const fcpSummary = this.getMetricSummary('first_contentful_paint');
    if (fcpSummary && fcpSummary.avg > 2500) {
      insights.push(`⚠️ Slow First Contentful Paint: ${Math.round(fcpSummary.avg)}ms. Optimize initial render.`);
    }

    return insights;
  }

  // ============================================================================
  // ANALYTICS INTEGRATION
  // ============================================================================

  /**
   * Send metric to analytics (Google Analytics, custom endpoint, etc.)
   */
  private sendToAnalytics(event: string, data: any): void {
    if (typeof window === 'undefined') return;

    // Google Analytics 4
    if ('gtag' in window && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', event, data);
    }

    // Custom analytics endpoint (optional)
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data, timestamp: Date.now() })
      }).catch(err => console.warn('Analytics error:', err));
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.pageLoadMetrics = [];
    this.dataFetchMetrics = [];
    this.searchMetrics = [];
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Export data for analysis
   */
  exportData(): string {
    return JSON.stringify({
      pageLoads: this.pageLoadMetrics,
      dataFetches: this.dataFetchMetrics,
      searches: this.searchMetrics,
      metrics: Array.from(this.metrics.entries()).map(([name, values]) => ({
        name,
        values
      }))
    }, null, 2);
  }
}

// Global singleton instance
let rumInstance: RealUserMonitoring | null = null;

export const getRUM = (): RealUserMonitoring => {
  if (!rumInstance) {
    rumInstance = new RealUserMonitoring();
  }
  return rumInstance;
};

// Export default instance
export const rum = getRUM();

export default rum;
