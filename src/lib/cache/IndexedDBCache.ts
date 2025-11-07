// IndexedDB Cache Manager for Edge-Native Architecture
// Smart caching with TTL, LRU eviction, and compression support

export interface CacheConfig {
  dbName: string;
  version: number;
  maxSize: number; // in bytes
  defaultTTL: number; // in milliseconds
  compressionEnabled: boolean;
  compressionAlgorithm: 'lz4' | 'gzip' | 'deflate';
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
  averageAccessTime: number;
}

export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private config: CacheConfig;
  private stats: CacheStats;
  private compressionManager: any; // Will be injected

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      dbName: 'neetlogiq-cache',
      version: 1,
      maxSize: 100 * 1024 * 1024, // 100MB default
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours default
      compressionEnabled: true,
      compressionAlgorithm: 'lz4',
      ...config
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      compressionRatio: 0,
      averageAccessTime: 0
    };
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB cache initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    if (!this.db) {
      throw new Error('Cache not initialized');
    }

    const startTime = performance.now();
    const entryTTL = ttl || this.config.defaultTTL;
    const timestamp = Date.now();

    try {
      // Serialize data
      const serializedData = JSON.stringify(data);
      let processedData = serializedData;
      let compressed = false;

      // Compress if enabled and data is large enough
      if (this.config.compressionEnabled && serializedData.length > 1024) {
        if (this.compressionManager) {
          const compressedData = await this.compressionManager.compress(
            new TextEncoder().encode(serializedData),
            this.config.compressionAlgorithm
          );
          processedData = new TextDecoder().decode(compressedData);
          compressed = true;
        }
      }

      const entry: CacheEntry<T> = {
        key,
        data: processedData as any,
        timestamp,
        ttl: entryTTL,
        size: processedData.length,
        compressed,
        accessCount: 0,
        lastAccessed: timestamp
      };

      // Check if we need to evict entries
      await this.checkAndEvict(entry.size);

      // Store entry
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await this.promisifyRequest(store.put(entry));

      // Update stats
      this.updateStats('set', performance.now() - startTime, entry.size);

      console.log(`✅ Cached entry: ${key} (${(entry.size / 1024).toFixed(1)}KB, ${compressed ? 'compressed' : 'uncompressed'})`);

    } catch (error) {
      console.error(`❌ Failed to cache entry ${key}:`, error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) {
      throw new Error('Cache not initialized');
    }

    const startTime = performance.now();

    try {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const entry = await this.promisifyRequest<CacheEntry<T>>(store.get(key));

      if (!entry) {
        this.updateStats('miss', performance.now() - startTime, 0);
        return null;
      }

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(key);
        this.updateStats('miss', performance.now() - startTime, 0);
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      await this.promisifyRequest(store.put(entry));

      // Deserialize data
      let data: T;
      if (entry.compressed && this.compressionManager) {
        const compressedData = new TextEncoder().encode(entry.data as any);
        const decompressedData = await this.compressionManager.decompress(
          compressedData,
          this.config.compressionAlgorithm
        );
        data = JSON.parse(new TextDecoder().decode(decompressedData));
      } else {
        data = JSON.parse(entry.data as any);
      }

      this.updateStats('hit', performance.now() - startTime, entry.size);
      return data;

    } catch (error) {
      console.error(`❌ Failed to get entry ${key}:`, error);
      this.updateStats('miss', performance.now() - startTime, 0);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Cache not initialized');
    }

    try {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await this.promisifyRequest(store.delete(key));
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete entry ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Cache not initialized');
    }

    try {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await this.promisifyRequest(store.clear());
      
      this.stats.totalEntries = 0;
      this.stats.totalSize = 0;
      
      console.log('✅ Cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  async keys(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Cache not initialized');
    }

    try {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const entries = await this.promisifyRequest<CacheEntry[]>(store.getAll());
      
      return entries.map(entry => entry.key);
    } catch (error) {
      console.error('❌ Failed to get keys:', error);
      return [];
    }
  }

  async size(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const entries = await this.promisifyRequest<CacheEntry[]>(store.getAll());
      
      return entries.reduce((total, entry) => total + entry.size, 0);
    } catch (error) {
      console.error('❌ Failed to get cache size:', error);
      return 0;
    }
  }

  async checkAndEvict(newEntrySize: number): Promise<void> {
    const currentSize = await this.size();
    const projectedSize = currentSize + newEntrySize;

    if (projectedSize <= this.config.maxSize) {
      return;
    }

    console.log(`🗑️  Cache size limit exceeded, evicting entries...`);

    // Get all entries sorted by last accessed time (LRU)
    const transaction = this.db!.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('lastAccessed');
    const entries = await this.promisifyRequest<CacheEntry[]>(index.getAll());

    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

    let sizeToFree = projectedSize - this.config.maxSize;
    let evictedCount = 0;

    for (const entry of entries) {
      if (sizeToFree <= 0) break;

      await this.promisifyRequest(store.delete(entry.key));
      sizeToFree -= entry.size;
      evictedCount++;
    }

    this.stats.evictionCount += evictedCount;
    console.log(`✅ Evicted ${evictedCount} entries, freed ${(sizeToFree / 1024).toFixed(1)}KB`);
  }

  async cleanup(): Promise<void> {
    if (!this.db) {
      return;
    }

    console.log('🧹 Cleaning up expired entries...');

    try {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const entries = await this.promisifyRequest<CacheEntry[]>(store.getAll());

      const now = Date.now();
      let cleanedCount = 0;

      for (const entry of entries) {
        if (now - entry.timestamp > entry.ttl) {
          await this.promisifyRequest(store.delete(entry.key));
          cleanedCount++;
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} expired entries`);

    } catch (error) {
      console.error('❌ Failed to cleanup cache:', error);
    }
  }

  setCompressionManager(manager: any): void {
    this.compressionManager = manager;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private updateStats(operation: 'hit' | 'miss' | 'set', accessTime: number, size: number): void {
    const totalOperations = this.stats.totalEntries + 1;
    
    if (operation === 'hit') {
      this.stats.hitRate = ((this.stats.hitRate * (totalOperations - 1)) + 1) / totalOperations;
    } else if (operation === 'miss') {
      this.stats.missRate = ((this.stats.missRate * (totalOperations - 1)) + 1) / totalOperations;
    } else if (operation === 'set') {
      this.stats.totalEntries = totalOperations;
      this.stats.totalSize += size;
    }

    this.stats.averageAccessTime = ((this.stats.averageAccessTime * (totalOperations - 1)) + accessTime) / totalOperations;
  }

  private promisifyRequest<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('✅ IndexedDB cache closed');
    }
  }
}

// Export singleton instance
export const indexedDBCache = new IndexedDBCache();
