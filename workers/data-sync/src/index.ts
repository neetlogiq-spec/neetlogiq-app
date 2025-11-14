/**
 * Data Sync Worker
 *
 * Automatically triggered when files are uploaded to R2.
 * Clears relevant KV cache entries so users get fresh data.
 *
 * Flow:
 * 1. You upload cutoffs.parquet to R2
 * 2. R2 sends event to Queue
 * 3. This Worker processes the event
 * 4. Worker clears all "cutoffs:*" cache keys
 * 5. Next API request fetches fresh data
 *
 * Result: Zero manual intervention!
 */

interface Env {
  CACHE: KVNamespace;
  DATA_SYNC_QUEUE: Queue;
}

interface R2ObjectEvent {
  account: string;
  action: string;
  bucket: string;
  object: {
    key: string;
    size: number;
    eTag: string;
    version?: string;
  };
  eventTime: string;
}

export default {
  /**
   * Queue consumer - triggered by R2 events
   */
  async queue(batch: MessageBatch<R2ObjectEvent>, env: Env): Promise<void> {
    console.log(`📦 Processing ${batch.messages.length} R2 events...`);

    for (const message of batch.messages) {
      try {
        const event = message.body;
        const objectKey = event.object.key;
        const action = event.action;

        console.log(`🔔 Event: ${action} on ${objectKey}`);

        // Only process object creation/update events
        if (action === 'PutObject' || action === 'CopyObject') {
          await handleDataUpdate(objectKey, env.CACHE);
        }

        // Acknowledge message
        message.ack();
      } catch (error) {
        console.error('❌ Error processing message:', error);
        // Retry the message (don't ack)
        message.retry();
      }
    }

    console.log('✅ Batch processing complete');
  },

  /**
   * HTTP endpoint for manual cache clearing
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health') {
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: Date.now() }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Manual cache clear endpoint
      if (path === '/clear-cache' && request.method === 'POST') {
        const body = await request.json<{ pattern?: string }>();
        const pattern = body.pattern || '';

        const result = await clearCacheByPattern(env.CACHE, pattern);

        return new Response(
          JSON.stringify({
            success: true,
            cleared: result.count,
            pattern: pattern || 'all',
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};

/**
 * Handle data update - clear relevant cache entries
 */
async function handleDataUpdate(objectKey: string, kv: KVNamespace): Promise<void> {
  console.log(`🗑️  Clearing cache for: ${objectKey}`);

  // Determine cache pattern based on file
  const cachePatterns = getCachePatternsForFile(objectKey);

  let totalCleared = 0;

  for (const pattern of cachePatterns) {
    const result = await clearCacheByPattern(kv, pattern);
    totalCleared += result.count;
    console.log(`   ✓ Cleared ${result.count} keys matching "${pattern}"`);
  }

  console.log(`✅ Total cleared: ${totalCleared} cache entries`);

  // Also clear the version cache to trigger frontend notifications
  await kv.put('data-version', Date.now().toString());
  console.log('📱 Updated data version for frontend notifications');
}

/**
 * Get cache patterns based on uploaded file
 */
function getCachePatternsForFile(objectKey: string): string[] {
  const patterns: string[] = [];

  // data/colleges.parquet → clear all "colleges:*" cache
  if (objectKey.includes('colleges')) {
    patterns.push('colleges:');
    patterns.push('search:'); // Search results include colleges
  }

  // data/cutoffs.parquet → clear all "cutoffs:*" cache
  if (objectKey.includes('cutoffs')) {
    patterns.push('cutoffs:');
  }

  // data/courses.parquet → clear all "courses:*" cache
  if (objectKey.includes('courses')) {
    patterns.push('courses:');
    patterns.push('search:'); // Search results include courses
  }

  // If specific patterns found, return them
  if (patterns.length > 0) {
    return patterns;
  }

  // Default: clear everything if we can't determine the file type
  console.warn(`⚠️  Unknown file type: ${objectKey}, clearing all caches`);
  return ['colleges:', 'cutoffs:', 'courses:', 'search:', 'college:', 'course:'];
}

/**
 * Clear all cache keys matching a pattern
 */
async function clearCacheByPattern(
  kv: KVNamespace,
  pattern: string
): Promise<{ count: number }> {
  let count = 0;
  let cursor: string | undefined = undefined;

  // List all keys with the prefix
  do {
    const list = await kv.list({
      prefix: pattern,
      cursor,
    });

    // Delete all keys in this batch
    const deletePromises = list.keys.map(async (key) => {
      await kv.delete(key.name);
      count++;
    });

    await Promise.all(deletePromises);

    cursor = list.cursor;
  } while (cursor);

  return { count };
}

/**
 * Get statistics about cache usage
 */
async function getCacheStats(kv: KVNamespace): Promise<Record<string, number>> {
  const prefixes = ['colleges:', 'cutoffs:', 'courses:', 'search:', 'college:', 'course:'];
  const stats: Record<string, number> = {};

  for (const prefix of prefixes) {
    const list = await kv.list({ prefix, limit: 1000 });
    stats[prefix] = list.keys.length;
  }

  return stats;
}
