import { ApiResponse, College, Course, Cutoff, PaginationInfo } from '@/types';

// API Configuration for NeetLogIQ
const API_CONFIG = {
  // Always prefer same-origin requests. If explicitly set, NEXT_PUBLIC_API_URL can override.
  // Using '' ensures fetch goes to the current origin (e.g., http://localhost:3500).
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || '',
  ENDPOINTS: {
    // Route core data through unified endpoints that use Supabase
    COLLEGES: '/api/colleges',
    COURSES: '/api/courses',

    // The remaining endpoints can still be served by Next.js or Workers.
    // If you later migrate them, adjust here consistently.
    CUTOFFS: '/api/cutoffs',
    SEARCH: '/api/colleges/search',
    COMPARE: '/api/colleges/search',
    FILTERS: '/api/colleges',
    ANALYTICS: '/api/fresh/stats',
    HEALTH: '/api/health',
    ADMIN: {
      COLLEGES: '/api/admin/colleges',
      COURSES: '/api/admin/courses'
    }
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get base URL
export const getBaseUrl = (): string => {
  return API_CONFIG.BASE_URL;
};

// Enhanced API client with proper error handling and TypeScript support
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string; environment: string }>> {
    return this.request(API_CONFIG.ENDPOINTS.HEALTH);
  }

  // College endpoints
  async getColleges(params: {
    page?: number;
    limit?: number;
    state?: string;
    managementType?: string;
    stream?: string;
    search?: string;
  } = {}): Promise<ApiResponse<College[]>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'managementType') {
          searchParams.append('management_type', value.toString());
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const query = searchParams.toString();
    const endpoint = `${API_CONFIG.ENDPOINTS.COLLEGES}${query ? `?${query}` : ''}`;
    return this.request<College[]>(endpoint);
  }

  async getCollegeById(id: string): Promise<ApiResponse<College>> {
    return this.request<College>(`${API_CONFIG.ENDPOINTS.COLLEGES}/${id}`);
  }

  async getCollegeFilters(): Promise<ApiResponse<any>> {
    return this.request<any>(API_CONFIG.ENDPOINTS.FILTERS);
  }

  // Course endpoints
  async getCourses(params: {
    page?: number;
    limit?: number;
    stream?: string;
    branch?: string;
    search?: string;
  } = {}): Promise<ApiResponse<Course[]>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });
    
    const query = searchParams.toString();
    const endpoint = `${API_CONFIG.ENDPOINTS.COURSES}${query ? `?${query}` : ''}`;
    return this.request<Course[]>(endpoint);
  }

  async getCourseById(id: string): Promise<ApiResponse<Course>> {
    return this.request<Course>(`${API_CONFIG.ENDPOINTS.COURSES}/${id}`);
  }

  // Cutoff endpoints
  async getCutoffs(params: {
    collegeId?: string;
    courseId?: string;
    year?: string;
    category?: string;
    limit?: number;
  } = {}): Promise<ApiResponse<Cutoff[]>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'collegeId') {
          searchParams.append('college_id', value.toString());
        } else if (key === 'courseId') {
          searchParams.append('course_id', value.toString());
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const query = searchParams.toString();
    const endpoint = `${API_CONFIG.ENDPOINTS.CUTOFFS}${query ? `?${query}` : ''}`;
    return this.request<Cutoff[]>(endpoint);
  }

  // Search endpoint
  async search(params: {
    q: string;
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    searchParams.append('q', params.q);
    
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `${API_CONFIG.ENDPOINTS.SEARCH}?${searchParams.toString()}`;
    return this.request<any>(endpoint);
  }

  // Compare endpoint
  async compare(params: {
    ids: string[];
    type: 'colleges' | 'courses';
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    searchParams.append('ids', params.ids.join(','));
    searchParams.append('type', params.type);
    
    const endpoint = `${API_CONFIG.ENDPOINTS.COMPARE}?${searchParams.toString()}`;
    return this.request<any>(endpoint);
  }

  // Analytics endpoint
  async getAnalytics(): Promise<ApiResponse<any>> {
    return this.request<any>(API_CONFIG.ENDPOINTS.ANALYTICS);
  }

  // Admin endpoints (require authentication)
  async createCollege(data: Partial<College>, authToken?: string): Promise<ApiResponse<any>> {
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return this.request<any>(API_CONFIG.ENDPOINTS.ADMIN.COLLEGES, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

  async createCourse(data: Partial<Course>, authToken?: string): Promise<ApiResponse<any>> {
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return this.request<any>(API_CONFIG.ENDPOINTS.ADMIN.COURSES, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }
  
  // Admin user management
  async getUsers(authToken: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  }
  
  // Admin statistics
  async getAdminStats(authToken: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  }
  
  // Set auth token for all requests
  setAuthToken(token: string | null) {
    if (token) {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders['Authorization'];
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export { apiClient, ApiClient };
export default API_CONFIG;
