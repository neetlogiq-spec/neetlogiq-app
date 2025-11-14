/**
 * API Client for Cloudflare Workers
 *
 * This client handles all communication with edge API endpoints.
 * Workers are deployed separately and serve data from R2/KV cache.
 */

// Worker API URLs (configure in environment variables)
const WORKER_URLS = {
  colleges: process.env.NEXT_PUBLIC_COLLEGES_API || 'https://colleges.neetlogiq.workers.dev',
  cutoffs: process.env.NEXT_PUBLIC_CUTOFFS_API || 'https://cutoffs.neetlogiq.workers.dev',
  comparison: process.env.NEXT_PUBLIC_COMPARISON_API || 'https://comparison.neetlogiq.workers.dev',
  courses: process.env.NEXT_PUBLIC_COURSES_API || 'https://courses.neetlogiq.workers.dev',
};

// Type definitions
export interface CollegeFilters {
  stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  state?: string;
  quota?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CutoffFilters {
  stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  quota?: string;
  category?: string;
  year?: number;
  maxRank?: number;
  minRank?: number;
  limit?: number;
  offset?: number;
}

export interface CourseFilters {
  stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  degree?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ComparisonRequest {
  collegeIds: string[];
}

export interface APIResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    cached?: boolean;
  };
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Base API Client
 */
class BaseAPIClient {
  private baseURL: string;

  constructor(service: keyof typeof WORKER_URLS) {
    this.baseURL = WORKER_URLS[service];
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint, this.baseURL);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Enable browser caching
        cache: 'default',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new APIError(
          error.error || error.message || 'API request failed',
          response.status,
          error
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      // Network or other errors
      throw new APIError(
        error instanceof Error ? error.message : 'Network error',
        0,
        error
      );
    }
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body: any): Promise<T> {
    const url = new URL(endpoint, this.baseURL);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new APIError(
          error.error || error.message || 'API request failed',
          response.status,
          error
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : 'Network error',
        0,
        error
      );
    }
  }
}

// API Client instances
export const collegesAPI = new BaseAPIClient('colleges');
export const cutoffsAPI = new BaseAPIClient('cutoffs');
export const coursesAPI = new BaseAPIClient('courses');
export const comparisonAPI = new BaseAPIClient('comparison');

/**
 * Helper functions for common API calls
 */

/**
 * Get colleges with filters
 */
export async function getColleges(filters: CollegeFilters = {}) {
  return collegesAPI.get('/colleges', filters);
}

/**
 * Get college by ID
 */
export async function getCollegeById(id: string) {
  return collegesAPI.get(`/colleges/${id}`);
}

/**
 * Get cutoffs with filters
 */
export async function getCutoffs(filters: CutoffFilters = {}) {
  return cutoffsAPI.get('/cutoffs', filters);
}

/**
 * Get courses with filters
 */
export async function getCourses(filters: CourseFilters = {}) {
  return coursesAPI.get('/courses', filters);
}

/**
 * Get course by ID
 */
export async function getCourseById(id: string) {
  return coursesAPI.get(`/courses/${id}`);
}

/**
 * Get courses for a specific college
 */
export async function getCoursesByCollege(collegeId: string) {
  return coursesAPI.get(`/courses/by-college/${collegeId}`);
}

/**
 * Compare multiple colleges
 */
export async function compareColleges(collegeIds: string[]) {
  return comparisonAPI.post('/compare', { collegeIds });
}

/**
 * Search across all data
 */
export async function search(query: string, filters?: {
  stream?: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  type?: 'colleges' | 'courses' | 'all';
}) {
  return collegesAPI.get('/search', {
    q: query,
    ...filters,
  });
}

/**
 * Health check for API availability
 */
export async function healthCheck() {
  try {
    await Promise.all([
      fetch(WORKER_URLS.colleges + '/health'),
      fetch(WORKER_URLS.cutoffs + '/health'),
      fetch(WORKER_URLS.courses + '/health'),
      fetch(WORKER_URLS.comparison + '/health'),
    ]);
    return true;
  } catch {
    return false;
  }
}
