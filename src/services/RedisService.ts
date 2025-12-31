import Redis from 'ioredis';

/**
 * Redis Service
 * Provides a singleton interface for Redis operations with graceful degradation.
 */
class RedisService {
  private redis: Redis | null = null;
  private isConnected = false;
  private enabled = process.env.REDIS_ENABLED === 'true';

  constructor() {
    if (this.enabled) {
      this.init();
    }
  }

  private init() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const isTLS = redisUrl.startsWith('rediss://');
      
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.isConnected = false;
            return null; // Stop retrying
          }
          return Math.min(times * 100, 2000);
        },
        connectTimeout: 10000,
        tls: isTLS ? {} : undefined, // Essential for Upstash rediss:// URLs
      });

      this.redis.on('connect', () => {
        console.log('[RedisService] Connecting to Redis...');
      });

      this.redis.on('ready', () => {
        console.log('[RedisService] Redis is ready');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        console.error('[RedisService] Redis Error:', err.message);
        this.isConnected = false;
      });

      this.redis.on('end', () => {
        console.log('[RedisService] Redis connection closed');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('[RedisService] Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Helper to ensure Redis is ready before operation
   */
  private async ensureReady(): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;
    if (this.isConnected) return true;

    // Wait for ready event if currently connecting
    if (this.redis.status === 'connecting' || this.redis.status === 'reconnecting') {
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Redis ready timeout')), 5000);
          this.redis?.once('ready', () => {
            clearTimeout(timeout);
            resolve(true);
          });
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    return this.isConnected;
  }

  /**
   * Get a value from Redis
   */
  async get<T>(key: string): Promise<T | null> {
    if (!(await this.ensureReady())) return null;

    try {
      const value = await this.redis!.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[RedisService] GET Error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis with optional TTL (in seconds)
   */
  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!(await this.ensureReady())) return;

    try {
      const stringifiedValue = JSON.stringify(value);
      await this.redis!.set(key, stringifiedValue, 'EX', ttlSeconds);
    } catch (error) {
      console.error(`[RedisService] SET Error for key ${key}:`, error);
    }
  }


  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`[RedisService] DEL Error for key ${key}:`, error);
    }
  }

  /**
   * Clear all keys (use with caution)
   */
  async flush(): Promise<void> {
    if (!this.isConnected || !this.redis) return;
    try {
      await this.redis.flushall();
    } catch (error) {
      console.error('[RedisService] FLUSH Error:', error);
    }
  }
}

// Global singleton instance
let redisService: RedisService;

export function getRedisService(): RedisService {
  if (!redisService) {
    redisService = new RedisService();
  }
  return redisService;
}
