// Performance Monitoring Service
// Tracks and monitors application performance metrics

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface PerformanceReport {
  timestamp: Date;
  metrics: PerformanceMetric[];
  summary: {
    averageLoadTime: number;
    totalRequests: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private isEnabled = true;

  constructor() {
    this.initializeMonitoring();
  }

  // Initialize performance monitoring
  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor page load times
    this.monitorPageLoad();
    
    // Monitor API response times
    this.monitorAPIRequests();
    
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor user interactions
    this.monitorUserInteractions();
  }

  // Monitor page load times
  private monitorPageLoad() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navigation) {
        this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.loadEventStart);
        this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
        this.recordMetric('first_paint', this.getFirstPaintTime());
        this.recordMetric('first_contentful_paint', this.getFirstContentfulPaintTime());
      }
    });
  }

  // Get First Paint time
  private getFirstPaintTime(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : 0;
  }

  // Get First Contentful Paint time
  private getFirstContentfulPaintTime(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
  }

  // Monitor API requests
  private monitorAPIRequests() {
    if (typeof window === 'undefined') return;

    // Override fetch to monitor API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        
        this.recordMetric('api_response_time', endTime - startTime, {
          url: args[0],
          status: response.status,
          method: args[1]?.method || 'GET'
        });
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        
        this.recordMetric('api_error_time', endTime - startTime, {
          url: args[0],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        throw error;
      }
    };
  }

  // Monitor memory usage
  private monitorMemoryUsage() {
    if (typeof window === 'undefined' || !('memory' in performance)) return;

    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        this.recordMetric('memory_used', memory.usedJSHeapSize);
        this.recordMetric('memory_total', memory.totalJSHeapSize);
        this.recordMetric('memory_limit', memory.jsHeapSizeLimit);
      }
    }, 30000); // Check every 30 seconds
  }

  // Monitor user interactions
  private monitorUserInteractions() {
    if (typeof window === 'undefined') return;

    // Monitor click events
    document.addEventListener('click', (event) => {
      this.recordMetric('user_interaction', 1, {
        type: 'click',
        target: (event.target as HTMLElement)?.tagName || 'unknown'
      });
    });

    // Monitor scroll events
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.recordMetric('user_scroll', 1, {
          type: 'scroll',
          scrollY: window.scrollY
        });
      }, 100);
    });

    // Monitor search events
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.type === 'search' || target.placeholder?.toLowerCase().includes('search')) {
        this.recordMetric('search_input', 1, {
          type: 'search_input',
          value_length: target.value.length
        });
      }
    });
  }

  // Record a performance metric
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      metadata
    };

    this.metrics.push(metric);

    // Keep only last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Save to localStorage for persistence
    this.saveMetricsToStorage();
  }

  // Get metrics by name
  getMetrics(name: string, limit?: number): PerformanceMetric[] {
    const filtered = this.metrics.filter(metric => metric.name === name);
    return limit ? filtered.slice(-limit) : filtered;
  }

  // Get all metrics
  getAllMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Get performance report
  getPerformanceReport(): PerformanceReport {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(metric => metric.timestamp >= last24Hours);
    
    const loadTimes = this.getMetrics('page_load_time', 100);
    const apiTimes = this.getMetrics('api_response_time', 100);
    const errors = this.getMetrics('api_error_time', 100);
    
    const averageLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((sum, metric) => sum + metric.value, 0) / loadTimes.length 
      : 0;
    
    const totalRequests = apiTimes.length + errors.length;
    const errorRate = totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0;
    
    return {
      timestamp: now,
      metrics: recentMetrics,
      summary: {
        averageLoadTime,
        totalRequests,
        errorRate,
        cacheHitRate: 0 // Will be implemented with caching
      }
    };
  }

  // Save metrics to localStorage
  private saveMetricsToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const metricsToSave = this.metrics.slice(-100); // Save last 100 metrics
      localStorage.setItem('neetlogiq_performance_metrics', JSON.stringify(metricsToSave));
    } catch (error) {
      console.error('Error saving performance metrics:', error);
    }
  }

  // Load metrics from localStorage
  private loadMetricsFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('neetlogiq_performance_metrics');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.metrics = parsed.map((metric: any) => ({
          ...metric,
          timestamp: new Date(metric.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('neetlogiq_performance_metrics');
    }
  }

  // Enable/disable monitoring
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Check if monitoring is enabled
  isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  // Get performance insights
  getPerformanceInsights(): string[] {
    const insights: string[] = [];
    const report = this.getPerformanceReport();

    if (report.summary.averageLoadTime > 3000) {
      insights.push('Page load time is slow (>3s). Consider optimizing images and reducing bundle size.');
    }

    if (report.summary.errorRate > 5) {
      insights.push('High error rate detected. Check API endpoints and error handling.');
    }

    if (report.summary.totalRequests > 100) {
      insights.push('High API usage detected. Consider implementing caching strategies.');
    }

    return insights;
  }

  // Export metrics for analysis
  exportMetrics(): string {
    return JSON.stringify(this.getPerformanceReport(), null, 2);
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
