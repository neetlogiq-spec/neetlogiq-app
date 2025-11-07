'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  maxSize?: number; // Maximum number of items in cache (default: 50)
}

interface UseDataCacheReturn<T> {
  getCachedData: (key: string, fetcher: () => Promise<T>, options?: CacheOptions) => Promise<T>;
  invalidateCache: (key?: string) => void;
  clearCache: () => void;
  getCacheSize: () => number;
  isCached: (key: string) => boolean;
}

// Global cache instance
const globalCache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 50;

export const useDataCache = <T = any>(): UseDataCacheReturn<T> => {
  const cacheRef = useRef(globalCache);
  
  // Clean up expired entries
  const cleanupExpiredEntries = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiry) {
        cache.delete(key);
      }
    }
  }, []);
  
  // Remove oldest entries if cache exceeds max size
  const enforceMaxSize = useCallback((maxSize: number) => {
    const cache = cacheRef.current;
    
    if (cache.size <= maxSize) return;
    
    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries
    const toRemove = entries.slice(0, cache.size - maxSize);
    toRemove.forEach(([key]) => cache.delete(key));
  }, []);
  
  // Get cached data or fetch new data
  const getCachedData = useCallback(async (
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> => {
    const { ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX_SIZE } = options;
    const cache = cacheRef.current;
    const now = Date.now();
    
    // Clean up expired entries
    cleanupExpiredEntries();
    
    // Check if data exists and is not expired
    if (cache.has(key)) {
      const entry = cache.get(key)!;
      if (now < entry.expiry) {
        return entry.data;
      } else {
        // Remove expired entry
        cache.delete(key);
      }
    }
    
    // Fetch new data
    try {
      const data = await fetcher();
      
      // Store in cache
      cache.set(key, {
        data,
        timestamp: now,
        expiry: now + ttl
      });
      
      // Enforce max size
      enforceMaxSize(maxSize);
      
      return data;
    } catch (error) {
      // If fetch fails, try to return stale data if available
      if (cache.has(key)) {
        console.warn('Using stale cache data due to fetch error:', error);
        return cache.get(key)!.data;
      }
      
      // Re-throw the error if no stale data is available
      throw error;
    }
  }, [cleanupExpiredEntries, enforceMaxSize]);
  
  // Invalidate specific cache entry or all entries
  const invalidateCache = useCallback((key?: string) => {
    const cache = cacheRef.current;
    
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }, []);
  
  // Clear all cache entries
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  // Get current cache size
  const getCacheSize = useCallback(() => {
    return cacheRef.current.size;
  }, []);
  
  // Check if key is cached
  const isCached = useCallback((key: string) => {
    const cache = cacheRef.current;
    const now = Date.now();
    
    if (!cache.has(key)) return false;
    
    const entry = cache.get(key)!;
    if (now > entry.expiry) {
      cache.delete(key);
      return false;
    }
    
    return true;
  }, []);
  
  return {
    getCachedData,
    invalidateCache,
    clearCache,
    getCacheSize,
    isCached
  };
};

// Hook for caching API responses with automatic invalidation
export const useApiCache = <T = any>(baseUrl: string, defaultOptions: CacheOptions = {}) => {
  const { getCachedData, invalidateCache } = useDataCache<T>();
  
  const fetchWithCache = useCallback(async (
    endpoint: string, 
    options: CacheOptions = {}
  ): Promise<T> => {
    const url = `${baseUrl}${endpoint}`;
    const mergedOptions = { ...defaultOptions, ...options };
    
    return getCachedData(
      url,
      () => fetch(url).then(res => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      }),
      mergedOptions
    );
  }, [baseUrl, defaultOptions, getCachedData]);
  
  const invalidateEndpoint = useCallback((endpoint: string) => {
    const url = `${baseUrl}${endpoint}`;
    invalidateCache(url);
  }, [baseUrl, invalidateCache]);
  
  return {
    fetchWithCache,
    invalidateEndpoint,
    invalidateCache
  };
};

// Hook for caching with localStorage persistence
export const usePersistentCache = <T = any>(keyPrefix: string = 'app_cache_') => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Load cache from localStorage
  const loadCacheFromStorage = useCallback((): Map<string, CacheEntry<T>> => {
    if (!isClient) return new Map();
    
    try {
      const serialized = localStorage.getItem(`${keyPrefix}data`);
      if (!serialized) return new Map();
      
      const data = JSON.parse(serialized);
      const cache = new Map<string, CacheEntry<T>>();
      
      // Check each entry for expiry
      const now = Date.now();
      for (const [key, entry] of Object.entries(data)) {
        const typedEntry = entry as CacheEntry<T>;
        if (now < typedEntry.expiry) {
          cache.set(key, typedEntry);
        }
      }
      
      return cache;
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
      return new Map();
    }
  }, [isClient, keyPrefix]);
  
  // Save cache to localStorage
  const saveCacheToStorage = useCallback((cache: Map<string, CacheEntry<T>>) => {
    if (!isClient) return;
    
    try {
      const data: Record<string, CacheEntry<T>> = {};
      for (const [key, entry] of cache.entries()) {
        data[key] = entry;
      }
      
      localStorage.setItem(`${keyPrefix}data`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }, [isClient, keyPrefix]);
  
  const getCachedData = useCallback(async (
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> => {
    const { ttl = DEFAULT_TTL } = options;
    const cache = loadCacheFromStorage();
    const now = Date.now();
    
    // Check if data exists and is not expired
    if (cache.has(key)) {
      const entry = cache.get(key)!;
      if (now < entry.expiry) {
        return entry.data;
      } else {
        // Remove expired entry
        cache.delete(key);
        saveCacheToStorage(cache);
      }
    }
    
    // Fetch new data
    try {
      const data = await fetcher();
      
      // Store in cache
      cache.set(key, {
        data,
        timestamp: now,
        expiry: now + ttl
      });
      
      saveCacheToStorage(cache);
      
      return data;
    } catch (error) {
      // If fetch fails, try to return stale data if available
      if (cache.has(key)) {
        console.warn('Using stale cache data due to fetch error:', error);
        return cache.get(key)!.data;
      }
      
      // Re-throw the error if no stale data is available
      throw error;
    }
  }, [loadCacheFromStorage, saveCacheToStorage]);
  
  const invalidateCache = useCallback((key?: string) => {
    const cache = loadCacheFromStorage();
    
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
    
    saveCacheToStorage(cache);
  }, [loadCacheFromStorage, saveCacheToStorage]);
  
  return {
    getCachedData,
    invalidateCache
  };
};

export default useDataCache;

