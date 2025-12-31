/**
 * Local Storage Cache Utility
 * Provides caching for filter options and cutoff data with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// TTL values in milliseconds
export const CACHE_TTL = {
  FILTER_OPTIONS: 24 * 60 * 60 * 1000, // 24 hours
  PAGE_DATA: 5 * 60 * 1000, // 5 minutes
  PARTITION_KEYS: 60 * 60 * 1000, // 1 hour
};

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached data if valid
 */
export function getFromCache<T>(key: string): T | null {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Save data to cache with TTL
 */
export function setToCache<T>(key: string, data: T, ttl: number): void {
  if (!isLocalStorageAvailable()) return;
  
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Cache write error:', error);
    // If quota exceeded, clear old entries
    if ((error as Error).name === 'QuotaExceededError') {
      clearExpiredCache();
      try {
        const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
        localStorage.setItem(key, JSON.stringify(entry));
      } catch {
        // Still failed, give up
      }
    }
  }
}

/**
 * Remove specific cache entry
 */
export function removeFromCache(key: string): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.removeItem(key);
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  if (!isLocalStorageAvailable()) return;
  
  const now = Date.now();
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('cutoffs_')) continue;
    
    try {
      const cached = localStorage.getItem(key);
      if (!cached) continue;
      
      const entry: CacheEntry<unknown> = JSON.parse(cached);
      if (now - entry.timestamp > entry.ttl) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key!);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Clear all cutoffs-related cache
 */
export function clearAllCache(): void {
  if (!isLocalStorageAvailable()) return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('cutoffs_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// Cache key generators
export const CacheKeys = {
  filterOptions: (partitionKey: string) => `cutoffs_filters_${partitionKey}`,
  pageData: (partitionKey: string, page: number, filters: string) => 
    `cutoffs_page_${partitionKey}_${page}_${filters}`,
  partitionKeys: () => 'cutoffs_partition_keys',
};
