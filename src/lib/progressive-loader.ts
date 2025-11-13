/**
 * Progressive Data Loader
 *
 * Loads static JSON data in optimized chunks:
 * 1. Stream-specific (UG users only get UG data)
 * 2. Year-prioritized (2024 first, then older years on-demand)
 * 3. Cached (localStorage + memory cache)
 * 4. Offline-capable (service worker)
 *
 * Usage:
 *   const loader = new ProgressiveLoader('UG');
 *   const colleges = await loader.loadColleges();
 *   const cutoffs2024 = await loader.loadCutoffs(2024);
 *   const olderCutoffs = await loader.loadAllCutoffs(); // Progressive
 */

export type StreamType = 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';

interface LoaderOptions {
  cache?: boolean;
  localStorage?: boolean;
  onProgress?: (progress: LoadProgress) => void;
}

interface LoadProgress {
  type: 'colleges' | 'courses' | 'cutoffs';
  loaded: number;
  total: number;
  year?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

// Cache duration (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const DATA_VERSION = '1.0.0';

export class ProgressiveLoader {
  private stream: StreamType;
  private options: LoaderOptions;
  private memoryCache: Map<string, any>;
  private baseURL: string;

  constructor(stream: StreamType, options: LoaderOptions = {}) {
    this.stream = stream;
    this.options = {
      cache: true,
      localStorage: typeof window !== 'undefined',
      ...options,
    };
    this.memoryCache = new Map();
    this.baseURL = '/data'; // Adjust if using CDN
  }

  /**
   * Load colleges for user's stream
   */
  async loadColleges(): Promise<any[]> {
    const cacheKey = `colleges-${this.stream}`;

    // Check memory cache
    if (this.memoryCache.has(cacheKey)) {
      console.log(`📦 Memory cache HIT: ${cacheKey}`);
      return this.memoryCache.get(cacheKey);
    }

    // Check localStorage
    if (this.options.localStorage) {
      const cached = this.getFromLocalStorage(cacheKey);
      if (cached) {
        console.log(`💾 localStorage cache HIT: ${cacheKey}`);
        this.memoryCache.set(cacheKey, cached);
        return cached;
      }
    }

    // Fetch from network
    console.log(`🌐 Fetching: ${cacheKey}.json`);
    const data = await this.fetchJSON(`${this.baseURL}/${cacheKey}.json`);

    // Expand optimized structure
    const expanded = this.expandColleges(data);

    // Cache
    this.memoryCache.set(cacheKey, expanded);
    if (this.options.localStorage) {
      this.saveToLocalStorage(cacheKey, expanded);
    }

    return expanded;
  }

  /**
   * Load courses for user's stream
   */
  async loadCourses(): Promise<any[]> {
    const cacheKey = `courses-${this.stream}`;

    // Check caches
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    if (this.options.localStorage) {
      const cached = this.getFromLocalStorage(cacheKey);
      if (cached) {
        this.memoryCache.set(cacheKey, cached);
        return cached;
      }
    }

    // Fetch
    console.log(`🌐 Fetching: ${cacheKey}.json`);
    const data = await this.fetchJSON(`${this.baseURL}/${cacheKey}.json`);

    const expanded = this.expandCourses(data);

    // Cache
    this.memoryCache.set(cacheKey, expanded);
    if (this.options.localStorage) {
      this.saveToLocalStorage(cacheKey, expanded);
    }

    return expanded;
  }

  /**
   * Load cutoffs for specific year
   */
  async loadCutoffs(year: number): Promise<any[]> {
    const cacheKey = `cutoffs-${this.stream}-${year}`;

    // Check caches
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    if (this.options.localStorage) {
      const cached = this.getFromLocalStorage(cacheKey);
      if (cached) {
        this.memoryCache.set(cacheKey, cached);
        return cached;
      }
    }

    // Fetch
    console.log(`🌐 Fetching: ${cacheKey}.json`);
    const data = await this.fetchJSON(`${this.baseURL}/${cacheKey}.json`);

    const expanded = this.expandCutoffs(data);

    // Cache
    this.memoryCache.set(cacheKey, expanded);
    if (this.options.localStorage) {
      this.saveToLocalStorage(cacheKey, expanded);
    }

    return expanded;
  }

  /**
   * Load all cutoffs progressively (recent years first)
   */
  async loadAllCutoffs(): Promise<any[]> {
    const metadata = await this.loadMetadata();
    const years = metadata.years || [2024, 2023, 2022, 2021, 2020];

    console.log(`📅 Loading cutoffs for ${years.length} years (progressive)`);

    const allCutoffs: any[] = [];
    let loadedYears = 0;

    for (const year of years) {
      try {
        const yearCutoffs = await this.loadCutoffs(year);
        allCutoffs.push(...yearCutoffs);
        loadedYears++;

        // Report progress
        if (this.options.onProgress) {
          this.options.onProgress({
            type: 'cutoffs',
            loaded: loadedYears,
            total: years.length,
            year,
          });
        }

        console.log(`   ✓ Loaded ${year}: ${yearCutoffs.length} cutoffs`);
      } catch (error) {
        console.warn(`   ⚠ Failed to load ${year}:`, error);
      }
    }

    console.log(`✅ Total loaded: ${allCutoffs.length} cutoffs across ${loadedYears} years`);

    return allCutoffs;
  }

  /**
   * Load pre-filtered static page
   */
  async loadPopularFilter(params: {
    category: string;
    quota: string;
    maxRank: number;
  }): Promise<any[] | null> {
    const filename = `cutoffs-${this.stream}-${params.category}-${params.quota.replace(' ', '_')}-${params.maxRank}.json`;

    try {
      console.log(`⚡ Loading pre-filtered: ${filename}`);
      const data = await this.fetchJSON(`${this.baseURL}/${filename}`);
      const expanded = this.expandCutoffs(data);
      console.log(`   ✓ Instant results: ${expanded.length} cutoffs`);
      return expanded;
    } catch (error) {
      // Pre-filtered page doesn't exist, client-side filtering needed
      return null;
    }
  }

  /**
   * Load metadata
   */
  async loadMetadata(): Promise<any> {
    const cacheKey = 'metadata';

    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    const data = await this.fetchJSON(`${this.baseURL}/metadata.json`);
    this.memoryCache.set(cacheKey, data);

    return data;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.memoryCache.clear();

    if (this.options.localStorage && typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('neetlogiq:')) {
          localStorage.removeItem(key);
        }
      });
    }

    console.log('🗑️ Cache cleared');
  }

  /**
   * Private: Fetch JSON with error handling
   */
  private async fetchJSON(url: string): Promise<any> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Private: Expand optimized college structure
   */
  private expandColleges(data: any[]): any[] {
    return data.map(c => ({
      id: c.i,
      name: c.n,
      city: c.c,
      state: c.s,
      stream: c.st,
      management_type: c.mt,
      established_year: c.y,
      website: c.w,
    }));
  }

  /**
   * Private: Expand optimized course structure
   */
  private expandCourses(data: any[]): any[] {
    return data.map(c => ({
      id: c.i,
      name: c.n,
      stream: c.st,
      branch: c.b,
      duration_years: c.d,
    }));
  }

  /**
   * Private: Expand optimized cutoff structure
   */
  private expandCutoffs(data: any[]): any[] {
    return data.map(c => ({
      id: c.i,
      college_id: c.ci,
      college_name: c.cn,
      course: c.co,
      year: c.y,
      round: c.r,
      category: c.cat,
      quota: c.q,
      opening_rank: c.or,
      closing_rank: c.cr,
      stream: c.st,
      level: c.l,
    }));
  }

  /**
   * Private: Get from localStorage with expiry
   */
  private getFromLocalStorage<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = localStorage.getItem(`neetlogiq:${key}`);
      if (!item) return null;

      const cached: CacheEntry<T> = JSON.parse(item);

      // Check expiry
      if (Date.now() - cached.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`neetlogiq:${key}`);
        return null;
      }

      // Check version
      if (cached.version !== DATA_VERSION) {
        localStorage.removeItem(`neetlogiq:${key}`);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.warn('localStorage error:', error);
      return null;
    }
  }

  /**
   * Private: Save to localStorage
   */
  private saveToLocalStorage<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;

    try {
      const cached: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: DATA_VERSION,
      };

      localStorage.setItem(`neetlogiq:${key}`, JSON.stringify(cached));
    } catch (error) {
      // localStorage might be full or disabled
      console.warn('localStorage save failed:', error);
    }
  }
}

/**
 * React Hook for progressive loading
 */
export function useProgressiveLoader(stream: StreamType) {
  if (typeof window === 'undefined') {
    // SSR fallback
    return null;
  }

  const [loader] = React.useState(() => new ProgressiveLoader(stream));

  React.useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, [loader]);

  return loader;
}

// For non-React usage
export default ProgressiveLoader;
