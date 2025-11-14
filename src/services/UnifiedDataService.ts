/**
 * UnifiedDataService
 *
 * Consolidates all data fetching operations into a single, consistent interface.
 * Replaces: CachedCutoffsService, OptimalCutoffsService, OptimizedParquetCutoffsService,
 *           StaticCutoffsService, and other data services.
 *
 * Features:
 * - Stream-aware data filtering
 * - Progressive loading for cutoffs
 * - Smart query routing (static → client-side → API)
 * - Multi-layer caching (memory + localStorage)
 * - Automatic cache management
 */

import { ProgressiveLoader } from '@/lib/progressive-loader';
import { SmartRouter, FilterParams, QueryResult } from '@/lib/smart-router';
import { StreamDataService, StreamType } from './StreamDataService';
import { apiClient } from '@/lib/api';

export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  stream: string;
  management_type: string;
  established_year?: number;
  website?: string;
  address?: string;
  [key: string]: any;
}

export interface Course {
  id: string;
  name: string;
  course_name?: string;
  stream?: string;
  level?: string;
  duration?: number;
  [key: string]: any;
}

export interface Cutoff {
  id: string;
  college_id?: string;
  college_name?: string;
  college?: string;
  course_id?: string;
  course_name?: string;
  course?: string;
  year: number;
  round?: number;
  category: string;
  quota?: string;
  opening_rank: number;
  closing_rank: number;
  [key: string]: any;
}

export interface UnifiedDataServiceConfig {
  stream: StreamType;
  enableCache?: boolean;
  enableLocalStorage?: boolean;
  cacheTTL?: number;
  autoLoadRecent?: boolean;
}

export class UnifiedDataService {
  private config: UnifiedDataServiceConfig;
  private progressiveLoader: ProgressiveLoader;
  private smartRouter: SmartRouter;
  private streamService: StreamDataService;

  // In-memory caches
  private collegesCache: College[] | null = null;
  private coursesCache: Course[] | null = null;
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(config: UnifiedDataServiceConfig) {
    this.config = {
      enableCache: true,
      enableLocalStorage: true,
      cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoLoadRecent: true,
      ...config
    };

    this.progressiveLoader = new ProgressiveLoader(config.stream, {
      localStorage: config.enableLocalStorage,
      onProgress: (progress) => {
        console.log('Loading progress:', progress);
      }
    });

    this.smartRouter = new SmartRouter(config.stream);
    this.streamService = new StreamDataService(config.stream);

    // Auto-load recent year if enabled
    if (this.config.autoLoadRecent) {
      this.preloadRecentData();
    }
  }

  // ============================================================================
  // COLLEGES
  // ============================================================================

  /**
   * Get colleges with optional filters
   * Strategy: Load from static JSON, apply stream filters, then apply custom filters
   */
  async getColleges(filters?: Partial<College>): Promise<College[]> {
    try {
      // Check cache
      if (this.collegesCache && this.isCacheValid('colleges')) {
        return this.applyFilters(this.collegesCache, filters);
      }

      // Load from progressive loader
      const colleges = await this.progressiveLoader.loadColleges();

      // Apply stream filtering
      const streamFiltered = this.streamService.filterColleges(colleges);

      // Update cache
      this.collegesCache = streamFiltered;
      this.updateCacheTimestamp('colleges');

      // Apply custom filters
      return this.applyFilters(streamFiltered, filters);
    } catch (error) {
      console.error('Error loading colleges:', error);

      // Fallback to API
      return this.getCollegesFromAPI(filters);
    }
  }

  /**
   * Get college by ID with full details
   */
  async getCollegeById(id: string): Promise<College | null> {
    try {
      // First try from cached data
      if (this.collegesCache) {
        const college = this.collegesCache.find(c => c.id === id);
        if (college) return college;
      }

      // Fallback to API for detailed data
      const response = await apiClient.getCollegeById(id);
      return response.data as College;
    } catch (error) {
      console.error('Error loading college by ID:', error);
      return null;
    }
  }

  /**
   * Fallback: Get colleges from API
   */
  private async getCollegesFromAPI(filters?: any): Promise<College[]> {
    try {
      const params = this.streamService.getApiParams({
        ...filters,
        limit: 1000
      });

      const response = await apiClient.getColleges(params);
      return (response.data || []) as College[];
    } catch (error) {
      console.error('Error loading colleges from API:', error);
      return [];
    }
  }

  // ============================================================================
  // COURSES
  // ============================================================================

  /**
   * Get courses with optional filters
   * Strategy: Load from static JSON, apply stream filters, then apply custom filters
   */
  async getCourses(filters?: Partial<Course>): Promise<Course[]> {
    try {
      // Check cache
      if (this.coursesCache && this.isCacheValid('courses')) {
        return this.applyFilters(this.coursesCache, filters);
      }

      // Load from progressive loader
      const courses = await this.progressiveLoader.loadCourses();

      // Apply stream filtering
      const streamFiltered = this.streamService.filterCourses(courses);

      // Update cache
      this.coursesCache = streamFiltered;
      this.updateCacheTimestamp('courses');

      // Apply custom filters
      return this.applyFilters(streamFiltered, filters);
    } catch (error) {
      console.error('Error loading courses:', error);

      // Fallback to API
      return this.getCoursesFromAPI(filters);
    }
  }

  /**
   * Get course by ID
   */
  async getCourseById(id: string): Promise<Course | null> {
    try {
      if (this.coursesCache) {
        const course = this.coursesCache.find(c => c.id === id);
        if (course) return course;
      }

      const response = await apiClient.getCourseById(id);
      return response.data as Course;
    } catch (error) {
      console.error('Error loading course by ID:', error);
      return null;
    }
  }

  /**
   * Fallback: Get courses from API
   */
  private async getCoursesFromAPI(filters?: any): Promise<Course[]> {
    try {
      const params = this.streamService.getApiParams({
        ...filters,
        limit: 1000
      });

      const response = await apiClient.getCourses(params);
      return (response.data || []) as Course[];
    } catch (error) {
      console.error('Error loading courses from API:', error);
      return [];
    }
  }

  // ============================================================================
  // CUTOFFS (Smart Routing)
  // ============================================================================

  /**
   * Get cutoffs with smart routing
   * Strategy: Try pre-filtered static → client-side filter → API
   */
  async getCutoffs(filters: FilterParams): Promise<QueryResult<Cutoff>> {
    try {
      return await this.smartRouter.queryCutoffs(filters);
    } catch (error) {
      console.error('Error loading cutoffs:', error);

      // Fallback to API
      return {
        data: await this.getCutoffsFromAPI(filters),
        source: 'api',
        executionTime: 0,
        cached: false
      };
    }
  }

  /**
   * Get all cutoffs for a specific year
   */
  async getCutoffsByYear(year: number): Promise<Cutoff[]> {
    try {
      const cutoffs = await this.progressiveLoader.loadCutoffs(year);
      return this.streamService.filterCutoffs(cutoffs);
    } catch (error) {
      console.error('Error loading cutoffs by year:', error);
      return [];
    }
  }

  /**
   * Load all years progressively (background operation)
   */
  async loadAllYears(): Promise<Cutoff[]> {
    try {
      const allCutoffs = await this.progressiveLoader.loadAllCutoffs();
      return this.streamService.filterCutoffs(allCutoffs);
    } catch (error) {
      console.error('Error loading all years:', error);
      return [];
    }
  }

  /**
   * Fallback: Get cutoffs from API
   */
  private async getCutoffsFromAPI(filters: any): Promise<Cutoff[]> {
    try {
      const params = this.streamService.getApiParams({
        ...filters,
        limit: 10000
      });

      const response = await apiClient.getCutoffs(params);
      return (response.data || []) as Cutoff[];
    } catch (error) {
      console.error('Error loading cutoffs from API:', error);
      return [];
    }
  }

  // ============================================================================
  // PRELOADING & CACHE MANAGEMENT
  // ============================================================================

  /**
   * Preload recent year data (2024) in background
   */
  private async preloadRecentData(): Promise<void> {
    try {
      // Preload 2024 cutoffs
      await this.progressiveLoader.loadCutoffs(2024);

      // Preload colleges and courses
      await Promise.all([
        this.progressiveLoader.loadColleges(),
        this.progressiveLoader.loadCourses()
      ]);

      console.log('Recent data preloaded successfully');
    } catch (error) {
      console.error('Error preloading data:', error);
    }
  }

  /**
   * Preload specific year
   */
  async preloadYear(year: number): Promise<void> {
    await this.smartRouter.preload(year);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.collegesCache = null;
    this.coursesCache = null;
    this.cacheTimestamps.clear();
    this.progressiveLoader.clearCache();
    this.smartRouter.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return {
      colleges: {
        cached: this.collegesCache !== null,
        count: this.collegesCache?.length || 0,
        age: this.getCacheAge('colleges')
      },
      courses: {
        cached: this.coursesCache !== null,
        count: this.coursesCache?.length || 0,
        age: this.getCacheAge('courses')
      },
      cutoffs: this.smartRouter.getCacheStats(),
      loader: this.progressiveLoader.getCacheStats()
    };
  }

  // ============================================================================
  // SEARCH & ADVANCED QUERIES
  // ============================================================================

  /**
   * Search across all data types
   */
  async search(query: string, type: 'colleges' | 'courses' | 'cutoffs' = 'colleges'): Promise<any[]> {
    try {
      const response = await apiClient.search({
        q: query,
        limit: 50,
        filters: { type }
      });

      return response.data || [];
    } catch (error) {
      console.error('Error searching:', error);

      // Fallback to local search
      if (type === 'colleges' && this.collegesCache) {
        return this.collegesCache.filter(c =>
          c.name.toLowerCase().includes(query.toLowerCase())
        );
      }
      if (type === 'courses' && this.coursesCache) {
        return this.coursesCache.filter(c =>
          (c.name || c.course_name || '').toLowerCase().includes(query.toLowerCase())
        );
      }

      return [];
    }
  }

  /**
   * Compare multiple colleges
   */
  async compareColleges(ids: string[]): Promise<College[]> {
    try {
      const colleges = await this.getColleges();
      return colleges.filter(c => ids.includes(c.id));
    } catch (error) {
      console.error('Error comparing colleges:', error);
      return [];
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Apply filters to data array
   */
  private applyFilters<T extends Record<string, any>>(data: T[], filters?: Partial<T>): T[] {
    if (!filters) return data;

    return data.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === 'all') continue;

        if (Array.isArray(value)) {
          if (!value.includes(item[key])) return false;
        } else if (typeof value === 'string') {
          if (item[key]?.toString().toLowerCase() !== value.toLowerCase()) return false;
        } else {
          if (item[key] !== value) return false;
        }
      }
      return true;
    });
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(key: string): boolean {
    if (!this.config.enableCache) return false;

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;

    const age = Date.now() - timestamp;
    return age < this.config.cacheTTL!;
  }

  /**
   * Update cache timestamp
   */
  private updateCacheTimestamp(key: string): void {
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Get cache age in milliseconds
   */
  private getCacheAge(key: string): number {
    const timestamp = this.cacheTimestamps.get(key);
    return timestamp ? Date.now() - timestamp : -1;
  }

  /**
   * Get current stream
   */
  getStream(): StreamType {
    return this.config.stream;
  }

  /**
   * Update stream (requires new instance)
   */
  static withStream(stream: StreamType, config?: Partial<UnifiedDataServiceConfig>): UnifiedDataService {
    return new UnifiedDataService({
      stream,
      ...config
    });
  }
}

// Export singleton factory
export const createDataService = (stream: StreamType, config?: Partial<UnifiedDataServiceConfig>) => {
  return new UnifiedDataService({ stream, ...config });
};

export default UnifiedDataService;
