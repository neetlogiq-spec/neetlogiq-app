import { getApiUrl } from '@/lib/api';
import { 
  College, 
  Course, 
  Cutoff, 
  SearchParams, 
  ApiResponse, 
  SearchResult, 
  FilterOptions 
} from '@/types';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://neetlogiq-backend.neetlogiq.workers.dev';
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Colleges API
  async getColleges(params: SearchParams = {}): Promise<ApiResponse<College[]>> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.append('query', params.query);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/colleges${queryString ? `?${queryString}` : ''}`;
    
    return this.request<College[]>(endpoint);
  }

  async getCollegeById(id: string): Promise<ApiResponse<College>> {
    return this.request<College>(`/api/colleges/${id}`);
  }

  async getCollegeFilters(): Promise<ApiResponse<FilterOptions>> {
    return this.request<FilterOptions>('/api/colleges/filters');
  }

  // Courses API
  async getCourses(params: SearchParams = {}): Promise<ApiResponse<Course[]>> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.append('query', params.query);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/courses${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Course[]>(endpoint);
  }

  async getCourseById(id: string): Promise<ApiResponse<Course>> {
    return this.request<Course>(`/api/courses/${id}`);
  }

  // Cutoffs API
  async getCutoffs(params: SearchParams = {}): Promise<ApiResponse<Cutoff[]>> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.append('query', params.query);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/cutoffs${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Cutoff[]>(endpoint);
  }

  // Unified Search API
  async unifiedSearch(params: SearchParams = {}): Promise<ApiResponse<SearchResult>> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.append('query', params.query);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/search${queryString ? `?${queryString}` : ''}`;
    
    return this.request<SearchResult>(endpoint);
  }

  // AI Recommendations API
  async getAIRecommendations(query: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Health Check API
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/api/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
