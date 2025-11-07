/**
 * Client-side JSON data caching utility
 * 
 * This utility provides functions to cache, retrieve, and manage JSON data
 * from the generated JSON files, improving performance by reducing
 * redundant network requests.
 */

interface CacheItem {
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 1 hour)
  forceRefresh?: boolean; // Force refresh even if cached
}

class JsonCache {
  private cache: Map<string, CacheItem> = new Map();
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Get data from cache or fetch from URL if not available or expired
   * @param url The URL to fetch data from
   * @param options Cache options
   * @returns Promise resolving to the data
   */
  async get<T = any>(url: string, options: CacheOptions = {}): Promise<T> {
    const { ttl = this.defaultTTL, forceRefresh = false } = options;
    const cacheKey = this.getCacheKey(url);
    
    // Check if we have valid cached data
    if (!forceRefresh) {
      const cachedItem = this.cache.get(cacheKey);
      if (cachedItem && cachedItem.expiresAt > Date.now()) {
        console.log(`[JsonCache] Cache hit for ${url}`);
        return cachedItem.data;
      }
    }

    // Fetch data from URL
    console.log(`[JsonCache] Fetching ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the data
      this.set(cacheKey, data, ttl);
      
      return data;
    } catch (error) {
      console.error(`[JsonCache] Error fetching ${url}:`, error);
      
      // If we have expired cached data, return it as fallback
      const cachedItem = this.cache.get(cacheKey);
      if (cachedItem) {
        console.warn(`[JsonCache] Using expired cache for ${url} due to fetch error`);
        return cachedItem.data;
      }
      
      throw error;
    }
  }

  /**
   * Store data in cache
   * @param key The cache key
   * @param data The data to cache
   * @param ttl Time to live in milliseconds
   */
  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt
    });
  }

  /**
   * Check if data is cached and not expired
   * @param url The URL to check
   * @returns True if data is cached and not expired
   */
  has(url: string): boolean {
    const cacheKey = this.getCacheKey(url);
    const cachedItem = this.cache.get(cacheKey);
    return cachedItem ? cachedItem.expiresAt > Date.now() : false;
  }

  /**
   * Remove data from cache
   * @param url The URL to remove from cache
   */
  remove(url: string): void {
    const cacheKey = this.getCacheKey(url);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired items from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  getStats(): {
    size: number;
    expiredCount: number;
    keys: string[];
  } {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const item of this.cache.values()) {
      if (item.expiresAt <= now) {
        expiredCount++;
      }
    }
    
    return {
      size: this.cache.size,
      expiredCount,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Get cache key from URL
   * @param url The URL
   * @returns The cache key
   */
  private getCacheKey(url: string): string {
    // For simplicity, use the URL as the cache key
    // In production, you might want to normalize the URL
    return url;
  }
}

// Create a singleton instance
const jsonCache = new JsonCache();

// Set up periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(() => {
    jsonCache.cleanup();
  }, 10 * 60 * 1000); // Clean up every 10 minutes
}

// Export the cache instance and utility functions
export default jsonCache;

// Export convenience functions
export const getCachedJson = <T = any>(url: string, options?: CacheOptions): Promise<T> => {
  return jsonCache.get<T>(url, options);
};

export const setCachedJson = (url: string, data: any, ttl?: number): void => {
  jsonCache.set(url, data, ttl);
};

export const hasCachedJson = (url: string): boolean => {
  return jsonCache.has(url);
};

export const removeCachedJson = (url: string): void => {
  jsonCache.remove(url);
};

export const clearJsonCache = (): void => {
  jsonCache.clear();
};

export const getJsonCacheStats = () => {
  return jsonCache.getStats();
};

// Export specific data fetching functions for common JSON files
export const getMasterData = async (options?: CacheOptions) => {
  return getCachedJson('/data/json/master-data.json', options);
};

export const getCounsellingBodyStatistics = async (options?: CacheOptions) => {
  return getCachedJson('/data/json/counselling-body-statistics.json', options);
};

export const getCollegeSearchIndex = async (options?: CacheOptions) => {
  return getCachedJson('/data/json/search/colleges.json', options);
};

export const getCourseSearchIndex = async (options?: CacheOptions) => {
  return getCachedJson('/data/json/search/courses.json', options);
};

export const getCounsellingAnalysisIndex = async (options?: CacheOptions) => {
  return getCachedJson('/data/json/counselling-analysis/index.json', options);
};

export const getCollegeCounsellingAnalysis = async (collegeId: string, options?: CacheOptions) => {
  return getCachedJson(`/data/json/counselling-analysis/${collegeId}.json`, options);
};

export const getRoundCutoffData = async (
  counsellingBody: string,
  year: string,
  level: string,
  round: number,
  options?: CacheOptions
) => {
  const filename = `${counsellingBody}-${year}-${level}-R${round}.json`;
  return getCachedJson(`/data/json/cutoffs/${filename}`, options);
};
