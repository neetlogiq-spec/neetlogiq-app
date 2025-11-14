/**
 * Colleges API Worker
 *
 * Handles college-related queries with DuckDB WASM + R2 + KV caching
 * Deployed to: colleges.neetlogiq.workers.dev
 */

interface Env {
  R2_BUCKET: R2Bucket;
  CACHE: KVNamespace;
}

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle OPTIONS for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // Route handling
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: Date.now() });
      }

      if (path === '/colleges') {
        return await handleGetColleges(request, env, ctx);
      }

      if (path.match(/^\/colleges\/[\w-]+$/)) {
        const id = path.split('/')[2];
        return await handleGetCollegeById(id, env, ctx);
      }

      if (path === '/search') {
        return await handleSearch(request, env, ctx);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : 'Internal Server Error',
          details: error instanceof Error ? error.stack : undefined,
        },
        500
      );
    }
  },
};

/**
 * Handle GET /colleges with filters
 */
async function handleGetColleges(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  // Parse filters from query params
  const filters = {
    stream: url.searchParams.get('stream') || 'UG',
    state: url.searchParams.get('state'),
    quota: url.searchParams.get('quota'),
    search: url.searchParams.get('search'),
    limit: parseInt(url.searchParams.get('limit') || '50'),
    offset: parseInt(url.searchParams.get('offset') || '0'),
  };

  // Generate cache key
  const cacheKey = `colleges:${JSON.stringify(filters)}`;

  // Try cache first
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return jsonResponse(JSON.parse(cached), 200, { 'X-Cache': 'HIT' });
  }

  // Cache miss - query from R2
  const result = await queryColleges(env, filters);

  // Cache for 1 hour
  ctx.waitUntil(
    env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
  );

  return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
}

/**
 * Handle GET /colleges/:id
 */
async function handleGetCollegeById(
  id: string,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const cacheKey = `college:${id}`;

  // Try cache first
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return jsonResponse(JSON.parse(cached), 200, { 'X-Cache': 'HIT' });
  }

  // Query from R2
  const result = await queryCollegeById(env, id);

  if (!result) {
    return jsonResponse({ error: 'College not found' }, 404);
  }

  // Cache for 24 hours (college data rarely changes)
  ctx.waitUntil(
    env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 })
  );

  return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
}

/**
 * Handle GET /search
 */
async function handleSearch(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Query must be at least 2 characters' }, 400);
  }

  const stream = url.searchParams.get('stream') || 'UG';
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const cacheKey = `search:${query}:${stream}:${limit}`;

  // Try cache first
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return jsonResponse(JSON.parse(cached), 200, { 'X-Cache': 'HIT' });
  }

  // Search in R2 data
  const result = await searchColleges(env, query, stream, limit);

  // Cache for 30 minutes
  ctx.waitUntil(
    env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 1800 })
  );

  return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
}

/**
 * Query colleges from R2 using DuckDB
 *
 * TODO: Implement actual DuckDB WASM querying
 * For now, this is a placeholder that returns mock data
 */
async function queryColleges(env: Env, filters: any) {
  // Load Parquet from R2
  const parquetFile = await env.R2_BUCKET.get('colleges.parquet');

  if (!parquetFile) {
    throw new Error('Colleges data not found in R2');
  }

  // TODO: Parse Parquet and query with DuckDB WASM
  // For now, return placeholder
  return {
    data: [],
    meta: {
      total: 0,
      limit: filters.limit,
      offset: filters.offset,
      cached: false,
    },
  };
}

/**
 * Query single college by ID
 */
async function queryCollegeById(env: Env, id: string) {
  // TODO: Implement actual query
  return null;
}

/**
 * Search colleges
 */
async function searchColleges(env: Env, query: string, stream: string, limit: number) {
  // TODO: Implement fuzzy search
  return {
    data: [],
    meta: {
      query,
      stream,
      limit,
      cached: false,
    },
  };
}

/**
 * Helper: JSON response with CORS
 */
function jsonResponse(data: any, status = 200, additionalHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      ...additionalHeaders,
    },
  });
}
