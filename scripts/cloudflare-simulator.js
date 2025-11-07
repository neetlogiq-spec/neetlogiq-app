#!/usr/bin/env node

/**
 * Cloudflare Workers Simulator
 * Simulates Cloudflare's edge environment locally
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = 8787;
const HOST = 'localhost';

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
const performanceMetrics = {
  requestCount: 0,
  responseTimes: [],
  cacheHits: 0
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

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

// Handle stream data requests
function handleStreamData(req, res, pathParts) {
  const stream = pathParts[2];
  const dataType = pathParts[3];
  const round = pathParts[4];

  if (!STREAM_CONFIGS[stream]) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Invalid stream' }));
    return;
  }

  // Check cache first
  const cacheKey = `${stream}_${dataType}_${round || 'static'}`;
  const cached = edgeCache.get(cacheKey);
  
  if (cached) {
    performanceMetrics.cacheHits++;
    console.log(`✅ Cache hit for ${cacheKey}`);
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      data: cached,
      metadata: {
        source: 'cache',
        stream,
        dataType,
        round: round ? parseInt(round) : null,
        timestamp: new Date().toISOString()
      }
    }));
    return;
  }

  // Generate data
  let data;
  const config = STREAM_CONFIGS[stream];
  
  switch (dataType) {
    case 'colleges':
      data = generateCollegesData(stream, config);
      break;
    case 'courses':
      data = generateCoursesData(stream, config);
      break;
    case 'cutoffs':
      data = generateCutoffsData(stream, config, round ? parseInt(round) : 1);
      break;
    default:
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ error: 'Invalid data type' }));
      return;
  }

  // Cache the result
  edgeCache.set(cacheKey, data);
  
  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({
    data,
    metadata: {
      source: 'edge',
      stream,
      dataType,
      round: round ? parseInt(round) : null,
      timestamp: new Date().toISOString()
    }
  }));
}

// Handle search requests
function handleSearch(req, res, url) {
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

  // Generate search results
  const config = STREAM_CONFIGS[stream];
  const data = generateCutoffsData(stream, config, 1);
  
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
  
  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({
    results: results.slice(0, 100),
    query,
    stream,
    filters,
    total: results.length,
    timestamp: new Date().toISOString()
  }));
}

// Handle analytics requests
function handleAnalytics(req, res, pathParts) {
  const stream = pathParts[2];
  
  const analytics = {
    stream,
    totalRequests: performanceMetrics.requestCount,
    averageResponseTime: performanceMetrics.responseTimes.length > 0 
      ? performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length 
      : 0,
    cacheHitRate: performanceMetrics.requestCount > 0 
      ? (performanceMetrics.cacheHits / performanceMetrics.requestCount * 100).toFixed(2)
      : 0,
    dataTypes: ['colleges', 'courses', 'cutoffs'],
    rounds: STREAM_CONFIGS[stream]?.rounds || [],
    timestamp: new Date().toISOString()
  };

  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(analytics));
}

// Handle performance requests
function handlePerformance(req, res) {
  const metrics = {
    requestCount: performanceMetrics.requestCount,
    averageResponseTime: performanceMetrics.responseTimes.length > 0 
      ? performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length 
      : 0,
    cacheSize: edgeCache.size,
    cacheHitRate: performanceMetrics.requestCount > 0 
      ? (performanceMetrics.cacheHits / performanceMetrics.requestCount * 100).toFixed(2)
      : 0,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };

  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(metrics));
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  performanceMetrics.requestCount++;
  
  const parsedUrl = url.parse(req.url, true);
  const pathParts = parsedUrl.pathname.split('/').filter(part => part);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  try {
    // Route handling
    if (pathParts[0] === 'api' && pathParts[1] === 'streams') {
      handleStreamData(req, res, pathParts);
    } else if (pathParts[0] === 'api' && pathParts[1] === 'search') {
      handleSearch(req, res, parsedUrl);
    } else if (pathParts[0] === 'api' && pathParts[1] === 'analytics') {
      handleAnalytics(req, res, pathParts);
    } else if (pathParts[0] === 'api' && pathParts[1] === 'performance') {
      handlePerformance(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    
    // Record response time
    const responseTime = Date.now() - startTime;
    performanceMetrics.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (performanceMetrics.responseTimes.length > 100) {
      performanceMetrics.responseTimes.shift();
    }
    
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🌐 Cloudflare Workers Simulator running on http://${HOST}:${PORT}`);
  console.log(`📡 API Endpoints:`);
  console.log(`   - Stream Data: http://${HOST}:${PORT}/api/streams/{stream}/{dataType}/{round?}`);
  console.log(`   - Search: http://${HOST}:${PORT}/api/search/?q={query}&stream={stream}`);
  console.log(`   - Analytics: http://${HOST}:${PORT}/api/analytics/{stream}`);
  console.log(`   - Performance: http://${HOST}:${PORT}/api/performance/`);
  console.log(`\n🧪 Test the simulator:`);
  console.log(`   curl http://${HOST}:${PORT}/api/performance/`);
  console.log(`   curl http://${HOST}:${PORT}/api/streams/UG/colleges`);
  console.log(`   curl "http://${HOST}:${PORT}/api/search/?q=medical&stream=UG"`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Cloudflare Workers Simulator...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
