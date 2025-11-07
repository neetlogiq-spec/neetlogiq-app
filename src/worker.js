/**
 * Cloudflare Worker for Edge-Native + AI Architecture
 * Simulates Cloudflare's edge environment locally
 */

// Cloudflare Workers don't support complex imports, using inline implementations

// Inline implementations for Cloudflare Workers
class CompressionManager {
  async compress(data, algorithm = 'gzip') {
    // Simple compression simulation
    return new Uint8Array(data.length * 0.7); // 30% compression
  }
}

class VectorSearchProcessor {
  async search(query, vectors) {
    // Simple vector search simulation
    return vectors.filter(v => v.includes(query));
  }
}

class PerformanceMonitor {
  recordMetric(key, value) {
    // Simple metrics recording
    console.log(`Metric: ${key} = ${value}`);
  }
}

// Initialize services
const compressionManager = new CompressionManager();
const vectorProcessor = new VectorSearchProcessor();
const performanceMonitor = new PerformanceMonitor();

// Stream configurations
const STREAM_CONFIGS = {
  UG: {
    description: 'Undergraduate Medical & Dental (MBBS, BDS)',
    courses: ['MBBS', 'BDS'],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priority_rounds: [1, 2]
  },
  PG_MEDICAL: {
    description: 'Postgraduate Medical (MD, MS, DNB, DIPLOMA)',
    courses: ['MD', 'MS', 'DNB', 'DIPLOMA', 'DNB- DIPLOMA'],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priority_rounds: [1, 2],
    exclude_streams: ['DENTAL']
  },
  PG_DENTAL: {
    description: 'Postgraduate Dental (MDS, PG DIPLOMA)',
    courses: ['MDS', 'PG DIPLOMA'],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priority_rounds: [1, 2],
    exclude_streams: ['MEDICAL']
  }
};

// Cache for edge data
const edgeCache = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const startTime = Date.now();
    
    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      };

      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      // Route handling
      let response;
      
      if (url.pathname.startsWith('/api/cutoffs')) {
        response = await handleCutoffs(request, env, url);
      } else if (url.pathname.startsWith('/api/streams/')) {
        response = await handleStreamData(request, env, url);
      } else if (url.pathname.startsWith('/api/search/')) {
        response = await handleSearch(request, env, url);
      } else if (url.pathname.startsWith('/api/analytics/')) {
        response = await handleAnalytics(request, env, url);
      } else if (url.pathname.startsWith('/api/performance/')) {
        response = await handlePerformance(request, env, url);
      } else if (url.pathname.startsWith('/api/compression/')) {
        response = await handleCompression(request, env, url);
      } else {
        response = await handleStatic(request, env, url);
      }

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

      // Record performance metrics
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric('request_duration', duration);
      performanceMonitor.recordMetric('request_count', 1);

      return response;

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
  }
};

// Handle stream data requests
async function handleStreamData(request, env, url) {
  const pathParts = url.pathname.split('/');
  const stream = pathParts[3];
  const dataType = pathParts[4];
  const round = pathParts[5];

  if (!STREAM_CONFIGS[stream]) {
    return new Response(JSON.stringify({ error: 'Invalid stream' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Generate cache key from request
  const requestBody = await request.clone().json().catch(() => ({}));
  const cacheKey = `${stream}_${dataType}_${round || 'all'}_${JSON.stringify(requestBody)}`;
  
  // Check KV cache first (30 min TTL)
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        console.log('✅ KV cache hit');
        const data = JSON.parse(cached);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600', // CDN cache
            'CF-Cache-Status': 'HIT', // Mark as cached
            'X-Cache-Layer': 'KV'
          }
        });
      }
    } catch (err) {
      console.warn('KV cache read failed:', err);
    }
  }

  // Check in-memory cache
  if (edgeCache.has(cacheKey)) {
    const cached = edgeCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 600000) { // 10 min TTL
      console.log('✅ In-memory cache hit');
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'CF-Cache-Status': 'HIT',
          'X-Cache-Layer': 'Memory'
        }
      });
    }
  }

  // Check cache first
  const cacheKeyOld = `${stream}_${dataType}_${round || 'static'}`;
  const cached = edgeCache.get(cacheKey);
  
  if (cached) {
    console.log(`✅ Cache hit for ${cacheKey}`);
    return new Response(JSON.stringify({
      data: cached,
      metadata: {
        source: 'cache',
        stream,
        dataType,
        round: round ? parseInt(round) : null,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Generate or fetch data
  const data = await generateStreamData(stream, dataType, round);
  
  // Cache the result
  edgeCache.set(cacheKey, data);
  
  return new Response(JSON.stringify({
    data,
    metadata: {
      source: 'edge',
      stream,
      dataType,
      round: round ? parseInt(round) : null,
      timestamp: new Date().toISOString()
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle search requests
async function handleSearch(request, env, url) {
  const searchParams = url.searchParams;
  const query = searchParams.get('q');
  const stream = searchParams.get('stream') || 'UG';
  const filters = {
    collegeName: searchParams.get('college'),
    courseName: searchParams.get('course'),
    minRank: searchParams.get('min_rank') ? parseInt(searchParams.get('min_rank')) : null,
    maxRank: searchParams.get('max_rank') ? parseInt(searchParams.get('max_rank')) : null,
    state: searchParams.get('state'),
    category: searchParams.get('category')
  };

  // Perform search
  const results = await performSearch(query, stream, filters);
  
  return new Response(JSON.stringify({
    results,
    query,
    stream,
    filters,
    total: results.length,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle analytics requests
async function handleAnalytics(request, env, url) {
  const stream = url.pathname.split('/')[3];
  
  const analytics = {
    stream,
    totalRequests: performanceMonitor.getTotalRequests(),
    averageResponseTime: performanceMonitor.getAverageMetric('request_duration'),
    cacheHitRate: calculateCacheHitRate(),
    dataTypes: ['colleges', 'courses', 'cutoffs'],
    rounds: STREAM_CONFIGS[stream]?.rounds || [],
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(analytics), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle performance requests
async function handlePerformance(request, env, url) {
  const metrics = {
    requestCount: performanceMonitor.getTotalRequests(),
    averageResponseTime: performanceMonitor.getAverageMetric('request_duration'),
    cacheSize: edgeCache.size,
    cacheHitRate: calculateCacheHitRate(),
    memoryUsage: process.memoryUsage ? process.memoryUsage() : null,
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(metrics), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle compression requests
async function handleCompression(request, env, url) {
  const { data, algorithm = 'gzip' } = await request.json();
  
  const compressed = await compressionManager.compress(
    new TextEncoder().encode(JSON.stringify(data)),
    algorithm
  );
  
  const compressionRatio = ((data.length - compressed.length) / data.length * 100).toFixed(2);
  
  return new Response(JSON.stringify({
    compressed: Array.from(compressed),
    originalSize: data.length,
    compressedSize: compressed.length,
    compressionRatio: parseFloat(compressionRatio),
    algorithm,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle static file requests
async function handleStatic(request, env, url) {
  // Serve static files from R2 or local filesystem
  const filePath = url.pathname.replace('/api/static/', '');
  
  // For local development, serve from public directory
  const response = await fetch(`http://localhost:3500${url.pathname}`);
  
  if (response.ok) {
    return response;
  }
  
  return new Response('File not found', { status: 404 });
}

// Generate stream data
async function generateStreamData(stream, dataType, round) {
  const config = STREAM_CONFIGS[stream];
  
  switch (dataType) {
    case 'colleges':
      return generateCollegesData(stream, config);
    case 'courses':
      return generateCoursesData(stream, config);
    case 'cutoffs':
      return generateCutoffsData(stream, config, round ? parseInt(round) : 1);
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }
}

// Generate colleges data
function generateCollegesData(stream, config) {
  const count = Math.floor(Math.random() * 50) + 20;
  return Array.from({ length: count }, (_, i) => ({
    id: `college_${stream}_${i + 1}`,
    name: `${stream} Medical College ${i + 1}`,
    state: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat'][i % 5],
    city: `City ${i + 1}`,
    type: ['Government', 'Private', 'Deemed'][i % 3],
    established_year: 1950 + (i % 70),
    rating: (3 + Math.random() * 2).toFixed(1),
    total_seats: Math.floor(Math.random() * 200) + 50,
    stream: stream,
    courses: config.courses
  }));
}

// Generate courses data
function generateCoursesData(stream, config) {
  return config.courses.map((course, i) => ({
    id: `course_${stream}_${course}`,
    name: course,
    duration: course.includes('MBBS') || course.includes('BDS') ? 5 : 3,
    level: course.includes('MBBS') || course.includes('BDS') ? 'UG' : 'PG',
    stream: stream,
    total_seats: Math.floor(Math.random() * 100) + 10,
    fee_range: {
      min: Math.floor(Math.random() * 50000) + 10000,
      max: Math.floor(Math.random() * 500000) + 100000
    }
  }));
}

// Generate cutoffs data
function generateCutoffsData(stream, config, round) {
  const count = Math.floor(Math.random() * 100) + 50;
  return Array.from({ length: count }, (_, i) => ({
    id: `cutoff_${stream}_${round}_${i + 1}`,
    college_id: `college_${stream}_${Math.floor(Math.random() * 20) + 1}`,
    course_id: `course_${stream}_${config.courses[Math.floor(Math.random() * config.courses.length)]}`,
    opening_rank: Math.floor(Math.random() * 10000) + 1,
    closing_rank: Math.floor(Math.random() * 10000) + 1000,
    year: 2024,
    round: round,
    category: ['General', 'OBC', 'SC', 'ST'][i % 4],
    state: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat'][i % 5],
    stream: stream,
    priority: config.priority_rounds.includes(round) ? 'high' : 'normal'
  }));
}

// Perform search
async function performSearch(query, stream, filters) {
  // Simulate search with filters
  const data = await generateStreamData(stream, 'cutoffs', 1);
  
  let results = data;
  
  if (filters.collegeName) {
    results = results.filter(item => 
      item.college_id.toLowerCase().includes(filters.collegeName.toLowerCase())
    );
  }
  
  if (filters.courseName) {
    results = results.filter(item => 
      item.course_id.toLowerCase().includes(filters.courseName.toLowerCase())
    );
  }
  
  if (filters.minRank) {
    results = results.filter(item => item.opening_rank >= filters.minRank);
  }
  
  if (filters.maxRank) {
    results = results.filter(item => item.closing_rank <= filters.maxRank);
  }
  
  if (filters.state) {
    results = results.filter(item => item.state === filters.state);
  }
  
  if (filters.category) {
    results = results.filter(item => item.category === filters.category);
  }
  
  // Sort by opening rank
  results.sort((a, b) => a.opening_rank - b.opening_rank);
  
  return results.slice(0, 100); // Limit to 100 results
}

// Handle cutoffs requests with aggressive caching
async function handleCutoffs(request, env, url) {
  const requestBody = await request.clone().json().catch(() => ({}));
  const cacheKey = `cutoffs:${JSON.stringify(requestBody)}`;
  
  // Check KV cache (30 min TTL)
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        console.log('✅ Cutoffs KV cache hit');
        const data = JSON.parse(cached);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            'CF-Cache-Status': 'HIT',
            'X-Cache-Layer': 'KV'
          }
        });
      }
    } catch (err) {
      console.warn('KV cache read failed:', err);
    }
  }

  // Check in-memory cache (10 min TTL)
  if (edgeCache.has(cacheKey)) {
    const cached = edgeCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 600000) {
      console.log('✅ Cutoffs memory cache hit');
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'CF-Cache-Status': 'HIT',
          'X-Cache-Layer': 'Memory'
        }
      });
    }
  }

  // Query D1 database (only if cache miss)
  let data = [];
  
  if (env.DB) {
    try {
      const { stream, year, round, filters } = requestBody;
      
      let query = `SELECT * FROM cutoffs WHERE stream = ? AND year = ?`;
      const params = [stream, year];
      
      if (round) {
        query += ` AND round = ?`;
        params.push(round);
      }
      
      if (filters?.college_id) {
        query += ` AND college_id = ?`;
        params.push(filters.college_id);
      }
      
      if (filters?.course_id) {
        query += ` AND course_id = ?`;
        params.push(filters.course_id);
      }
      
      if (filters?.rank?.min) {
        query += ` AND closing_rank >= ?`;
        params.push(filters.rank.min);
      }
      
      if (filters?.rank?.max) {
        query += ` AND closing_rank <= ?`;
        params.push(filters.rank.max);
      }
      
      query += ` LIMIT 1000`;
      
      const result = await env.DB.prepare(query).bind(...params).all();
      data = result.results || [];
      
      console.log(`⚡ Cutoffs Worker query: ${data.length} results`);
    } catch (err) {
      console.error('D1 query failed:', err);
      // Return empty data on error
      data = [];
    }
  }

  const response = {
    data,
    cached: false,
    cacheLayer: 'd1',
    timestamp: Date.now(),
  };

  // Store in cache
  if (env.CACHE) {
    try {
      await env.CACHE.put(cacheKey, JSON.stringify(response), {
        expirationTtl: 1800 // 30 minutes
      });
    } catch (err) {
      console.warn('KV cache write failed:', err);
    }
  }

  // Store in memory cache
  edgeCache.set(cacheKey, {
    data: response,
    timestamp: Date.now()
  });

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'CF-Cache-Status': 'MISS',
      'X-Cache-Layer': 'D1'
    }
  });
}

// Calculate cache hit rate
function calculateCacheHitRate() {
  // Simple cache hit rate calculation
  const totalRequests = performanceMonitor.getTotalRequests();
  const cacheHits = edgeCache.size;
  return totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0;
}
