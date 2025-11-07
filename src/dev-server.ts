/**
 * Local Development Server
 * Runs Cloudflare Workers locally with emulated services
 */

import { createServer } from 'http';
import { parse } from 'url';
import { createLocalEnv } from './lib/local-cloudflare';
import { 
  handleColleges, 
  handleCourses, 
  handleSearch, 
  handleComparison, 
  handleCutoffs, 
  handleAdmin, 
  handleAnalytics 
} from './handlers';

const PORT = 3501;
const localEnv = createLocalEnv();

// Simple request/response adapter for local development
class LocalRequest {
  private req: any;
  
  constructor(req: any) {
    this.req = req;
  }
  
  get method() {
    return this.req.method;
  }
  
  get url() {
    return `http://localhost:${PORT}${this.req.url}`;
  }
  
  get headers() {
    const headers = new Map();
    Object.entries(this.req.headers).forEach(([key, value]) => {
      headers.set(key, value as string);
    });
    
    return {
      get: (key: string) => this.req.headers[key.toLowerCase()],
      set: () => {},
      has: (key: string) => key.toLowerCase() in this.req.headers,
      entries: () => Object.entries(this.req.headers)
    };
  }
  
  async json() {
    return new Promise((resolve, reject) => {
      let data = '';
      this.req.on('data', (chunk: any) => data += chunk);
      this.req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
      this.req.on('error', reject);
    });
  }
  
  async text() {
    return new Promise((resolve, reject) => {
      let data = '';
      this.req.on('data', (chunk: any) => data += chunk);
      this.req.on('end', () => resolve(data));
      this.req.on('error', reject);
    });
  }
}

// Create HTTP server
const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url || '', true);
  const path = parsedUrl.pathname || '';
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    const request = new LocalRequest(req) as unknown as Request;
    const url = new URL(request.url);
    let response: Response;
    
    console.log(`🔄 ${req.method} ${path}`);
    
    // Route handling
    if (path === '/api/health') {
      response = new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: 'local-development',
        message: 'Local Cloudflare Workers server running'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (path.startsWith('/api/colleges')) {
      response = await handleColleges(request, localEnv, url);
    } else if (path.startsWith('/api/courses')) {
      response = await handleCourses(request, localEnv, url);
    } else if (path.startsWith('/api/search')) {
      response = await handleSearch(request, localEnv, url);
    } else if (path.startsWith('/api/compare')) {
      response = await handleComparison(request, localEnv, url);
    } else if (path.startsWith('/api/cutoffs')) {
      response = await handleCutoffs(request, localEnv, url);
    } else if (path.startsWith('/api/admin')) {
      response = await handleAdmin(request, localEnv, url);
    } else if (path.startsWith('/api/analytics')) {
      response = await handleAnalytics(request, localEnv, url);
    } else {
      response = new Response(JSON.stringify({
        success: false,
        error: 'Not Found',
        message: `Endpoint ${path} not found`,
        available_endpoints: [
          '/api/health',
          '/api/colleges',
          '/api/courses', 
          '/api/search',
          '/api/compare',
          '/api/cutoffs',
          '/api/admin/*',
          '/api/analytics/*'
        ]
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Convert Response to Node.js response
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers.entries()),
      'Access-Control-Allow-Origin': '*'
    });
    
    const body = await response.text();
    res.end(body);
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 Local Cloudflare Workers Development Server');
  console.log('============================================');
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log('📊 Services emulated: R2, D1, Vectorize, Analytics');
  console.log('🔍 Available endpoints:');
  console.log('  - GET  /api/health');
  console.log('  - GET  /api/colleges');
  console.log('  - GET  /api/colleges/filters');
  console.log('  - GET  /api/colleges/:id');
  console.log('  - GET  /api/courses');
  console.log('  - GET  /api/courses/:id');
  console.log('  - GET  /api/search?q=query');
  console.log('  - GET  /api/compare?ids=1,2&type=colleges');
  console.log('  - GET  /api/cutoffs');
  console.log('  - POST /api/admin/colleges (🔒 Auth Required)');
  console.log('  - POST /api/admin/courses (🔒 Auth Required)');
  console.log('  - GET  /api/admin/users (🔒 Admin Required)');
  console.log('  - GET  /api/admin/stats (🔒 Admin Required)');
  console.log('  - GET  /api/analytics/metrics');
  console.log('');
  console.log('💾 Local data stored in: .local-cloudflare/');
  console.log('🔄 Ready to receive requests!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
});

export default server;