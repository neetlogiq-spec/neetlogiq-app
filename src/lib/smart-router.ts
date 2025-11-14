/**
 * Smart Query Router
 *
 * Automatically determines the fastest way to handle a query:
 * 1. Pre-filtered static page (instant, 0ms)
 * 2. Client-side filtering (fast, 5-10ms)
 * 3. Worker API (complex, 100-200ms)
 *
 * Decision tree:
 * - Popular filter combination? → Load pre-filtered static page
 * - Simple filter on loaded data? → Client-side filter
 * - Complex operation (trends, predictions)? → Worker API
 * - Data not loaded yet? → Load progressively
 */

import { ProgressiveLoader, StreamType } from './progressive-loader';
import { getTrends, getPredict ions, compareColleges } from './api-client';

export interface FilterParams {
  stream?: StreamType;
  category?: string;
  quota?: string;
  maxRank?: number;
  minRank?: number;
  state?: string;
  search?: string;
  year?: number;
}

export interface QueryResult<T> {
  data: T[];
  source: 'static' | 'client-side' | 'worker';
  executionTime: number;
  cached: boolean;
}

export class SmartRouter {
  private loader: ProgressiveLoader;
  private stream: StreamType;
  private dataCache: {
    colleges?: any[];
    courses?: any[];
    cutoffs?: Map<number, any[]>; // year -> cutoffs
  };

  constructor(stream: StreamType) {
    this.stream = stream;
    this.loader = new ProgressiveLoader(stream);
    this.dataCache = {
      cutoffs: new Map(),
    };
  }

  /**
   * Query cutoffs with automatic routing
   */
  async queryCutoffs(filters: FilterParams): Promise<QueryResult<any>> {
    const startTime = performance.now();

    // Step 1: Check if this is a popular filter → Pre-filtered static page
    const staticResult = await this.tryStaticPage(filters);
    if (staticResult) {
      const executionTime = performance.now() - startTime;
      console.log(`⚡ Static page: ${executionTime.toFixed(1)}ms`);

      return {
        data: staticResult,
        source: 'static',
        executionTime,
        cached: false,
      };
    }

    // Step 2: Check if we can filter client-side
    const clientSideResult = await this.tryClientSideFilter(filters);
    if (clientSideResult) {
      const executionTime = performance.now() - startTime;
      console.log(`💻 Client-side: ${executionTime.toFixed(1)}ms`);

      return {
        data: clientSideResult,
        source: 'client-side',
        executionTime,
        cached: this.dataCache.cutoffs!.has(filters.year || 2024),
      };
    }

    // Step 3: Complex query → Worker API
    const workerResult = await this.useWorkerAPI(filters);
    const executionTime = performance.now() - startTime;
    console.log(`🌐 Worker API: ${executionTime.toFixed(1)}ms`);

    return {
      data: workerResult,
      source: 'worker',
      executionTime,
      cached: false,
    };
  }

  /**
   * Query colleges with automatic routing
   */
  async queryColleges(filters: {
    stream?: StreamType;
    state?: string;
    search?: string;
  }): Promise<QueryResult<any>> {
    const startTime = performance.now();

    // Colleges are always loaded client-side (small dataset)
    if (!this.dataCache.colleges) {
      this.dataCache.colleges = await this.loader.loadColleges();
    }

    let results = this.dataCache.colleges;

    // Apply filters
    if (filters.state) {
      results = results.filter(c => c.state === filters.state);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.city?.toLowerCase().includes(searchLower)
      );
    }

    const executionTime = performance.now() - startTime;
    console.log(`💻 Client-side colleges: ${executionTime.toFixed(1)}ms`);

    return {
      data: results,
      source: 'client-side',
      executionTime,
      cached: true,
    };
  }

  /**
   * Private: Try to load pre-filtered static page
   */
  private async tryStaticPage(filters: FilterParams): Promise<any[] | null> {
    // Check if this matches a popular filter combination
    const popularFilters = [
      { category: 'General', quota: 'All India', maxRank: 5000 },
      { category: 'General', quota: 'All India', maxRank: 10000 },
      { category: 'OBC', quota: 'All India', maxRank: 10000 },
      { category: 'General', quota: 'State', maxRank: 5000 },
    ];

    const matchesPopular = popularFilters.some(pf =>
      pf.category === filters.category &&
      pf.quota === filters.quota &&
      pf.maxRank === filters.maxRank &&
      !filters.minRank && // No custom min rank
      !filters.search && // No search
      !filters.state // No state filter
    );

    if (!matchesPopular) {
      return null;
    }

    // Try to load pre-filtered page
    try {
      return await this.loader.loadPopularFilter({
        category: filters.category!,
        quota: filters.quota!,
        maxRank: filters.maxRank!,
      });
    } catch (error) {
      // Pre-filtered page doesn't exist
      return null;
    }
  }

  /**
   * Private: Try client-side filtering
   */
  private async tryClientSideFilter(filters: FilterParams): Promise<any[] | null> {
    const year = filters.year || 2024;

    // Check if this requires complex operations that need Worker
    const needsWorker = this.isComplexQuery(filters);
    if (needsWorker) {
      return null;
    }

    // Load data for this year if not cached
    if (!this.dataCache.cutoffs!.has(year)) {
      try {
        const yearData = await this.loader.loadCutoffs(year);
        this.dataCache.cutoffs!.set(year, yearData);
      } catch (error) {
        console.error(`Failed to load ${year} data:`, error);
        return null;
      }
    }

    const data = this.dataCache.cutoffs!.get(year)!;

    // Apply filters client-side
    let results = data;

    if (filters.category && filters.category !== 'All') {
      results = results.filter(c => c.category === filters.category);
    }

    if (filters.quota && filters.quota !== 'All') {
      results = results.filter(c => c.quota === filters.quota);
    }

    if (filters.maxRank !== undefined) {
      results = results.filter(c => c.closing_rank <= filters.maxRank!);
    }

    if (filters.minRank !== undefined) {
      results = results.filter(c => c.closing_rank >= filters.minRank!);
    }

    if (filters.state) {
      results = results.filter(c =>
        c.college_name.toLowerCase().includes(filters.state!.toLowerCase())
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(c =>
        c.college_name.toLowerCase().includes(searchLower) ||
        c.course.toLowerCase().includes(searchLower)
      );
    }

    // Sort by closing rank
    results.sort((a, b) => a.closing_rank - b.closing_rank);

    return results;
  }

  /**
   * Private: Use Worker API for complex queries
   */
  private async useWorkerAPI(filters: FilterParams): Promise<any[]> {
    // This is a placeholder - implement actual Worker API call
    console.warn('Worker API not implemented yet, falling back to client-side');

    // For now, fallback to client-side (without complex features)
    const result = await this.tryClientSideFilter(filters);
    return result || [];
  }

  /**
   * Private: Determine if query is complex and needs Worker
   */
  private isComplexQuery(filters: FilterParams): boolean {
    // Complex queries that need Worker:
    // - Multi-year aggregations
    // - Trend analysis
    // - Predictions
    // - Advanced analytics

    // For simple filters, client-side is fine
    return false;
  }

  /**
   * Preload data for better performance
   */
  async preload(year: number = 2024) {
    console.log(`🔄 Preloading data for ${year}...`);

    const promises = [];

    if (!this.dataCache.colleges) {
      promises.push(
        this.loader.loadColleges().then(data => {
          this.dataCache.colleges = data;
          console.log(`   ✓ Colleges: ${data.length}`);
        })
      );
    }

    if (!this.dataCache.courses) {
      promises.push(
        this.loader.loadCourses().then(data => {
          this.dataCache.courses = data;
          console.log(`   ✓ Courses: ${data.length}`);
        })
      );
    }

    if (!this.dataCache.cutoffs!.has(year)) {
      promises.push(
        this.loader.loadCutoffs(year).then(data => {
          this.dataCache.cutoffs!.set(year, data);
          console.log(`   ✓ Cutoffs ${year}: ${data.length}`);
        })
      );
    }

    await Promise.all(promises);

    console.log('✅ Preload complete');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      colleges: this.dataCache.colleges?.length || 0,
      courses: this.dataCache.courses?.length || 0,
      cutoffYears: Array.from(this.dataCache.cutoffs!.keys()),
      totalCutoffs: Array.from(this.dataCache.cutoffs!.values())
        .reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.dataCache = {
      cutoffs: new Map(),
    };
    this.loader.clearCache();
    console.log('🗑️ Cache cleared');
  }
}

/**
 * React Hook for SmartRouter
 */
export function useSmartRouter(stream: StreamType) {
  const [router] = React.useState(() => new SmartRouter(stream));

  React.useEffect(() => {
    // Preload on mount
    router.preload();
  }, [router]);

  return router;
}

export default SmartRouter;
