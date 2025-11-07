/**
 * NeetLogIQ Cloudflare Workers Backend
 * Server-side rendering with R2, D1, Vectorize, and AutoRAG
 */

export interface Env {
  R2: any; // R2Bucket type not available in frontend
  D1: any; // D1Database type not available in frontend
  VECTORIZE: any; // VectorizeIndex type not available in frontend
  AI: any; // Ai type not available in frontend
  ANALYTICS: any; // AnalyticsEngine type not available in frontend
  ENVIRONMENT: string;
  CACHE_TTL: string;
  SEARCH_LIMIT: string;
  COMPARISON_LIMIT: string;
}

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  management_type: string;
  established_year?: number;
  website?: string;
  description?: string;
  courses?: Course[];
  recent_cutoffs?: Cutoff[];
}

interface Course {
  id: string;
  name: string;
  stream: string;
  branch: string;
  duration_years?: number;
  description?: string;
  colleges?: College[];
}

interface Cutoff {
  id: string;
  college_id: string;
  course_id: string;
  year: number;
  round: number;
  category: string;
  opening_rank: number;
  closing_rank: number;
}

interface SearchResult {
  type: 'college' | 'course' | 'cutoff';
  id: string;
  name: string;
  score: number;
  metadata: Record<string, any>;
}

import { 
  handleColleges, 
  handleCourses, 
  handleSearch, 
  handleComparison, 
  handleCutoffs, 
  handleAdmin, 
  handleAnalytics 
} from './handlers';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // Route handling
      if (path === '/api/health') {
        response = new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      } else if (path.startsWith('/api/colleges')) {
        response = await handleColleges(request, env, url);
      } else if (path.startsWith('/api/courses')) {
        response = await handleCourses(request, env, url);
      } else if (path.startsWith('/api/search')) {
        response = await handleSearch(request, env, url);
      } else if (path.startsWith('/api/compare')) {
        response = await handleComparison(request, env, url);
      } else if (path.startsWith('/api/cutoffs')) {
        response = await handleCutoffs(request, env, url);
      } else if (path.startsWith('/api/admin')) {
        console.log('🔧 Admin route detected:', path, method);
        response = await handleAdmin(request, env, url);
        console.log('🔧 Admin response status:', response.status);
      } else if (path.startsWith('/api/management')) {
        console.log('🔧 Management route detected:', path, method);
        response = await handleAdmin(request, env, url);
        console.log('🔧 Management response status:', response.status);
      } else if (path.startsWith('/api/analytics')) {
        response = await handleAnalytics(request, env, url);
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders
      });
    }
  },
};