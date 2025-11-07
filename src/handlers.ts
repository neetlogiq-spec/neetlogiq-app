/**
 * NeetLogIQ API Handlers
 * Complete implementation with Cloudflare Workers + Local Emulation
 */

import { Env } from './worker';
import { createLocalEnv } from './lib/local-cloudflare';
import { College, Course, Cutoff, ApiResponse, PaginationInfo, SearchResult } from './types/index';
import { requireAdmin, requireAuth, optionalAuth, AuthUser, createAuthResponse } from './lib/auth-middleware';

// Environment detection
const isLocal = process.env.NODE_ENV === 'development' || !process.env.CLOUDFLARE_WORKER_ID;

// Get environment (local emulation or real Cloudflare)
function getEnv(env?: Env): any {
  if (isLocal) {
    console.log('🚀 Using local Cloudflare emulation');
    return createLocalEnv();
  }
  return env;
}

// College endpoints
export async function handleColleges(request: Request, env: Env, url: URL): Promise<Response> {
  const actualEnv = getEnv(env);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/api/colleges' && method === 'GET') {
      // Get paginated list of colleges
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const state = url.searchParams.get('state');
      const managementType = url.searchParams.get('management_type');
      const stream = url.searchParams.get('stream');
      const search = url.searchParams.get('search');

      const result = await getCollegesList(actualEnv, {
        page,
        limit,
        state,
        managementType,
        stream,
        search
      });

      const response: ApiResponse<College[]> = {
        success: true,
        data: result.colleges,
        pagination: result.pagination,
        message: `Found ${result.total} colleges`
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // 5 minutes
        }
      });
    }

    if (path === '/api/colleges/filters' && method === 'GET') {
      // Get filter options
      const filters = await getCollegeFilters(actualEnv);
      
      const response: ApiResponse<any> = {
        success: true,
        data: filters,
        message: 'Filter options retrieved'
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // 1 hour
        }
      });
    }

    if (path.startsWith('/api/colleges/') && method === 'GET') {
      // Get specific college
      const collegeId = path.split('/')[3];
      
      const college = await getCollegeById(actualEnv, collegeId);
      
      if (!college) {
        const response: ApiResponse<never> = {
          success: false,
          data: null as never,
          error: 'College not found'
        };
        return new Response(JSON.stringify(response), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const response: ApiResponse<College> = {
        success: true,
        data: college,
        message: 'College retrieved successfully'
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600' // 10 minutes
        }
      });
    }

    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: 'Method not allowed'
    };
    return new Response(JSON.stringify(response), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleColleges:', error);
    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return new Response(JSON.stringify(response), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Course endpoints
export async function handleCourses(request: Request, env: Env, url: URL): Promise<Response> {
  const actualEnv = getEnv(env);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/api/courses' && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const stream = url.searchParams.get('stream');
      const branch = url.searchParams.get('branch');
      const search = url.searchParams.get('search');

      const result = await getCoursesList(actualEnv, {
        page,
        limit,
        stream,
        branch,
        search
      });

      const response: ApiResponse<Course[]> = {
        success: true,
        data: result.courses,
        pagination: result.pagination,
        message: `Found ${result.total} courses`
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (path.startsWith('/api/courses/') && method === 'GET') {
      const courseId = path.split('/')[3];
      
      const course = await getCourseById(actualEnv, courseId);
      
      if (!course) {
        const response: ApiResponse<never> = {
          success: false,
          data: null as never,
          error: 'Course not found'
        };
        return new Response(JSON.stringify(response), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const response: ApiResponse<Course> = {
        success: true,
        data: course,
        message: 'Course retrieved successfully'
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600'
        }
      });
    }

    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: 'Method not allowed'
    };
    return new Response(JSON.stringify(response), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleCourses:', error);
    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return new Response(JSON.stringify(response), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Search endpoint with AutoRAG
export async function handleSearch(request: Request, env: Env, url: URL): Promise<Response> {
  const actualEnv = getEnv(env);
  const method = request.method;

  try {
    if (method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const filters = Object.fromEntries(url.searchParams.entries());
      const limit = parseInt(url.searchParams.get('limit') || actualEnv.SEARCH_LIMIT || '10');

      if (!query.trim()) {
        const response: ApiResponse<any> = {
          success: true,
          data: { results: [], total: 0 },
          message: 'Empty query'
        };
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Use AutoRAG for semantic search
      const searchResults = await performSemanticSearch(actualEnv, query, filters, limit);
      
      // Track search analytics
      await actualEnv.ANALYTICS.writeDataPoint({
        blobs: ['search'],
        doubles: [searchResults.length],
        indexes: [query]
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          results: searchResults,
          total: searchResults.length,
          query,
          filters
        },
        message: `Found ${searchResults.length} results for "${query}"`
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: 'Method not allowed'
    };
    return new Response(JSON.stringify(response), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleSearch:', error);
    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return new Response(JSON.stringify(response), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Comparison endpoint
export async function handleComparison(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;

  if (method === 'GET') {
    const ids = url.searchParams.get('ids');
    const type = url.searchParams.get('type') || 'colleges';

    if (!ids) {
      return new Response('Missing ids parameter', { status: 400 });
    }

    const idList = ids.split(',').slice(0, parseInt(env.COMPARISON_LIMIT));

    try {
      const comparisonData = await getComparisonData(env, idList, type);
      
      return new Response(JSON.stringify(comparisonData), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      return new Response('Error fetching comparison data', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// Cutoff endpoints
export async function handleCutoffs(request: Request, env: Env, url: URL): Promise<Response> {
  const actualEnv = getEnv(env);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/api/cutoffs' && method === 'GET') {
      const collegeId = url.searchParams.get('college_id');
      const courseId = url.searchParams.get('course_id');
      const year = url.searchParams.get('year');
      const category = url.searchParams.get('category');
      const limit = parseInt(url.searchParams.get('limit') || '100');

      const result = await getCutoffsList(actualEnv, {
        collegeId,
        courseId,
        year,
        category,
        limit
      });

      const response: ApiResponse<Cutoff[]> = {
        success: true,
        data: result.cutoffs,
        message: `Found ${result.total} cutoffs`
      };

      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600'
        }
      });
    }

    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: 'Method not allowed'
    };
    return new Response(JSON.stringify(response), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleCutoffs:', error);
    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return new Response(JSON.stringify(response), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Admin endpoints with authentication
export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const actualEnv = getEnv(env);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/api/admin/colleges' && method === 'POST') {
      return await requireAdmin(async (request: Request, env: any, url: URL, user: AuthUser) => {
        const collegeData = await request.json();
        
        // Add audit info
        const collegeWithAudit = {
          ...collegeData,
          created_by: user.uid,
          created_by_email: user.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const result = await createCollege(actualEnv, collegeWithAudit);
        
        const response = createAuthResponse(result, 'College created successfully');
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      })(request, actualEnv, url);
    }

    if (path === '/api/admin/courses' && method === 'POST') {
      return await requireAdmin(async (request: Request, env: any, url: URL, user: AuthUser) => {
        const courseData = await request.json();
        
        // Add audit info
        const courseWithAudit = {
          ...courseData,
          created_by: user.uid,
          created_by_email: user.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const result = await createCourse(actualEnv, courseWithAudit);
        
        const response = createAuthResponse(result, 'Course created successfully');
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      })(request, actualEnv, url);
    }
    
    if (path === '/api/admin/users' && method === 'GET') {
      return await requireAdmin(async (request: Request, env: any, url: URL, user: AuthUser) => {
        // Get user management data
        const users = await getUsersList(actualEnv);
        
        const response = createAuthResponse(users, 'Users retrieved successfully');
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      })(request, actualEnv, url);
    }
    
    if (path === '/api/admin/stats' && method === 'GET') {
      return await requireAdmin(async (request: Request, env: any, url: URL, user: AuthUser) => {
        // Get admin statistics
        const stats = await getAdminStats(actualEnv);
        
        const response = createAuthResponse(stats, 'Admin statistics retrieved');
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      })(request, actualEnv, url);
    }

    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: 'Method not allowed or endpoint not found'
    };
    return new Response(JSON.stringify(response), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleAdmin:', error);
    const response: ApiResponse<never> = {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return new Response(JSON.stringify(response), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Analytics endpoints
export async function handleAnalytics(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/analytics/metrics' && method === 'GET') {
    try {
      // Get analytics data from D1
      const metrics = await getAnalyticsMetrics(env);
      return new Response(JSON.stringify(metrics), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return new Response('Error fetching analytics', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// Helper Functions - Complete Implementation

/**
 * Get paginated list of colleges with filters
 */
async function getCollegesList(env: any, params: {
  page: number;
  limit: number;
  state?: string | null;
  managementType?: string | null;
  stream?: string | null;
  search?: string | null;
}): Promise<{ colleges: College[], total: number, pagination: PaginationInfo }> {
  const { page, limit, state, managementType, stream, search } = params;
  const offset = (page - 1) * limit;

  // Try to get from cache first
  const cacheKey = `colleges_list_${page}_${limit}_${state}_${managementType}_${stream}_${search}`;
  const cached = await env.R2.get(cacheKey);
  
  if (cached) {
    console.log('📦 Cache hit for colleges list');
    return JSON.parse(await cached.text());
  }

  // Build SQL query with filters
  let sql = 'SELECT * FROM colleges WHERE 1=1';
  const bindings: any[] = [];

  if (state) {
    sql += ' AND state = ?';
    bindings.push(state);
  }
  if (managementType) {
    sql += ' AND management_type = ?';
    bindings.push(managementType);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR city LIKE ? OR state LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Get total count
  const countSql = sql.replace('SELECT * FROM', 'SELECT COUNT(*) as count FROM');
  const countResult = await env.D1.prepare(countSql).bind(...bindings).first();
  const total = countResult?.count || 0;

  // Get paginated results
  sql += ' ORDER BY name LIMIT ? OFFSET ?';
  bindings.push(limit, offset);
  
  const colleges = await env.D1.prepare(sql).bind(...bindings).all();

  const pagination: PaginationInfo = {
    current_page: page,
    total_pages: Math.ceil(total / limit),
    total_items: total,
    items_per_page: limit,
    has_next: page < Math.ceil(total / limit),
    has_prev: page > 1
  };

  const result = { colleges, total, pagination };

  // Cache the result
  await env.R2.put(cacheKey, JSON.stringify(result), {
    expirationTtl: parseInt(env.CACHE_TTL)
  });

  return result;
}

/**
 * Get college by ID
 */
async function getCollegeById(env: any, id: string): Promise<College | null> {
  // Try R2 cache first for detailed college data
  const cacheKey = `college_${id}`;
  const cached = await env.R2.get(cacheKey);
  
  if (cached) {
    return JSON.parse(await cached.text());
  }

  // Get from D1 database
  const college = await env.D1.prepare(
    'SELECT * FROM colleges WHERE id = ?'
  ).bind(id).first();

  if (!college) {
    return null;
  }

  // Get related courses
  const courses = await env.D1.prepare(`
    SELECT c.* FROM courses c 
    JOIN college_courses cc ON c.id = cc.course_id 
    WHERE cc.college_id = ?
  `).bind(id).all();

  // Get recent cutoffs
  const cutoffs = await env.D1.prepare(`
    SELECT * FROM cutoffs 
    WHERE college_id = ? 
    ORDER BY year DESC, round DESC 
    LIMIT 10
  `).bind(id).all();

  const collegeWithRelations = {
    ...college,
    courses: courses || [],
    recent_cutoffs: cutoffs || []
  };

  // Cache the detailed college data
  await env.R2.put(cacheKey, JSON.stringify(collegeWithRelations), {
    expirationTtl: 3600 // 1 hour
  });

  return collegeWithRelations;
}

/**
 * Get college filter options
 */
async function getCollegeFilters(env: any): Promise<any> {
  const cacheKey = 'college_filters';
  const cached = await env.R2.get(cacheKey);
  
  if (cached) {
    return JSON.parse(await cached.text());
  }

  const [states, managementTypes, streams] = await Promise.all([
    env.D1.prepare('SELECT DISTINCT state, COUNT(*) as count FROM colleges GROUP BY state ORDER BY state').all(),
    env.D1.prepare('SELECT DISTINCT management_type, COUNT(*) as count FROM colleges GROUP BY management_type').all(),
    env.D1.prepare('SELECT DISTINCT stream, COUNT(*) as count FROM colleges GROUP BY stream').all()
  ]);

  const filters = {
    states: states.map((s: any) => ({ value: s.state, label: s.state, count: s.count })),
    management_types: managementTypes.map((m: any) => ({ value: m.management_type, label: m.management_type, count: m.count })),
    streams: streams.map((s: any) => ({ value: s.stream, label: s.stream, count: s.count }))
  };

  // Cache for 1 hour
  await env.R2.put(cacheKey, JSON.stringify(filters), {
    expirationTtl: 3600
  });

  return filters;
}

/**
 * Get courses list with pagination and filters
 */
async function getCoursesList(env: any, params: {
  page: number;
  limit: number;
  stream?: string | null;
  branch?: string | null;
  search?: string | null;
}): Promise<{ courses: Course[], total: number, pagination: PaginationInfo }> {
  const { page, limit, stream, branch, search } = params;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM courses WHERE 1=1';
  const bindings: any[] = [];

  if (stream) {
    sql += ' AND stream = ?';
    bindings.push(stream);
  }
  if (branch) {
    sql += ' AND branch = ?';
    bindings.push(branch);
  }
  if (search) {
    sql += ' AND name LIKE ?';
    bindings.push(`%${search}%`);
  }

  const countSql = sql.replace('SELECT * FROM', 'SELECT COUNT(*) as count FROM');
  const countResult = await env.D1.prepare(countSql).bind(...bindings).first();
  const total = countResult?.count || 0;

  sql += ' ORDER BY name LIMIT ? OFFSET ?';
  bindings.push(limit, offset);
  
  const courses = await env.D1.prepare(sql).bind(...bindings).all();

  const pagination: PaginationInfo = {
    current_page: page,
    total_pages: Math.ceil(total / limit),
    total_items: total,
    items_per_page: limit,
    has_next: page < Math.ceil(total / limit),
    has_prev: page > 1
  };

  return { courses, total, pagination };
}

/**
 * Get course by ID
 */
async function getCourseById(env: any, id: string): Promise<Course | null> {
  return await env.D1.prepare(
    'SELECT * FROM courses WHERE id = ?'
  ).bind(id).first();
}

/**
 * Perform semantic search using Vectorize
 */
async function performSemanticSearch(env: any, query: string, filters: any, limit: number): Promise<SearchResult[]> {
  try {
    const searchResults = await env.VECTORIZE.query(query, {
      topK: limit,
      filter: filters
    });

    return searchResults.matches.map((match: any) => ({
      type: match.metadata.type,
      id: match.metadata.id,
      name: match.metadata.name,
      score: match.score,
      metadata: match.metadata
    }));
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

/**
 * Get comparison data for multiple items
 */
async function getComparisonData(env: any, ids: string[], type: string): Promise<any> {
  const items = await Promise.all(
    ids.map(id => 
      type === 'colleges' ? getCollegeById(env, id) : getCourseById(env, id)
    )
  );

  return {
    type,
    items: items.filter(item => item !== null),
    compared_at: new Date().toISOString(),
    comparison_id: `${type}_${ids.join('_')}_${Date.now()}`
  };
}

/**
 * Get cutoffs with filters
 */
async function getCutoffsList(env: any, params: {
  collegeId?: string | null;
  courseId?: string | null;
  year?: string | null;
  category?: string | null;
  limit?: number;
}): Promise<{ cutoffs: Cutoff[], total: number }> {
  let sql = 'SELECT * FROM cutoffs WHERE 1=1';
  const bindings: any[] = [];

  if (params.collegeId) {
    sql += ' AND college_id = ?';
    bindings.push(params.collegeId);
  }
  if (params.courseId) {
    sql += ' AND course_id = ?';
    bindings.push(params.courseId);
  }
  if (params.year) {
    sql += ' AND year = ?';
    bindings.push(parseInt(params.year));
  }
  if (params.category) {
    sql += ' AND category = ?';
    bindings.push(params.category);
  }

  const countSql = sql.replace('SELECT * FROM', 'SELECT COUNT(*) as count FROM');
  const countResult = await env.D1.prepare(countSql).bind(...bindings).first();
  const total = countResult?.count || 0;

  sql += ' ORDER BY year DESC, round DESC';
  if (params.limit) {
    sql += ' LIMIT ?';
    bindings.push(params.limit);
  }
  
  const cutoffs = await env.D1.prepare(sql).bind(...bindings).all();

  return { cutoffs, total };
}

/**
 * Create college in admin interface
 */
async function createCollege(env: any, data: College): Promise<any> {
  const result = await env.D1.prepare(`
    INSERT INTO colleges (id, name, city, state, management_type, established_year, website, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.id,
    data.name,
    data.city,
    data.state,
    data.management_type,
    data.established_year,
    data.website,
    data.description
  ).run();

  return { 
    id: data.id, 
    created: result.success,
    changes: result.meta?.changes || 0
  };
}

/**
 * Create course in admin interface
 */
async function createCourse(env: any, data: Course): Promise<any> {
  const result = await env.D1.prepare(`
    INSERT INTO courses (id, name, stream, branch, duration_years, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    data.id,
    data.name,
    data.stream,
    data.branch,
    data.duration_years,
    data.description
  ).run();

  return { 
    id: data.id, 
    created: result.success,
    changes: result.meta?.changes || 0
  };
}

/**
 * Get analytics metrics
 */
async function getAnalyticsMetrics(env: any): Promise<any> {
  const [searchCount, collegeCount, courseCount] = await Promise.all([
    env.D1.prepare(`
      SELECT COUNT(*) as count FROM analytics 
      WHERE event_type = 'search' 
      AND timestamp > datetime('now', '-7 days')
    `).first(),
    env.D1.prepare('SELECT COUNT(*) as count FROM colleges').first(),
    env.D1.prepare('SELECT COUNT(*) as count FROM courses').first()
  ]);

  return {
    total_searches: searchCount?.count || 0,
    total_colleges: collegeCount?.count || 0,
    total_courses: courseCount?.count || 0,
    last_updated: new Date().toISOString()
  };
}

/**
 * Get users list for admin
 */
async function getUsersList(env: any): Promise<any[]> {
  // In a real app, this would fetch from a users table
  // For now, return mock data
  return [
    {
      uid: 'admin_001',
      email: 'admin@neetlogiq.com',
      role: 'admin',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    }
  ];
}

/**
 * Get admin statistics
 */
async function getAdminStats(env: any): Promise<any> {
  const [colleges, courses, cutoffs, analytics] = await Promise.all([
    env.D1.prepare('SELECT COUNT(*) as count FROM colleges').first(),
    env.D1.prepare('SELECT COUNT(*) as count FROM courses').first(),
    env.D1.prepare('SELECT COUNT(*) as count FROM cutoffs').first(),
    env.D1.prepare(`
      SELECT COUNT(*) as count FROM analytics 
      WHERE timestamp > datetime('now', '-30 days')
    `).first()
  ]);

  return {
    overview: {
      total_colleges: colleges?.count || 0,
      total_courses: courses?.count || 0,
      total_cutoffs: cutoffs?.count || 0,
      total_analytics_events: analytics?.count || 0
    },
    recent_activity: {
      colleges_added_this_month: 0,
      courses_added_this_month: 0,
      searches_this_month: analytics?.count || 0
    },
    system_info: {
      environment: env.ENVIRONMENT || 'local-development',
      last_updated: new Date().toISOString(),
      cache_status: 'active'
    }
  };
}
