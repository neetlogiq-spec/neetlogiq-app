/**
 * Supabase Data Service
 * Central service for all database operations using Supabase
 * Replaces DuckDB/Parquet with dynamic PostgreSQL queries
 */

import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

// Type aliases for better readability
type College = Database['public']['Tables']['colleges']['Row'];
type Course = Database['public']['Tables']['courses']['Row'];
type Cutoff = Database['public']['Tables']['cutoffs']['Row'];
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type Subscription = Database['public']['Tables']['subscriptions']['Row'];

/**
 * College search filters
 */
export interface CollegeSearchFilters {
  query?: string;
  states?: string[];
  managementTypes?: ('Government' | 'Private' | 'Trust' | 'Deemed')[];
  courses?: string[];
  niacRating?: ('A++' | 'A+' | 'A' | 'B++' | 'B+' | 'B')[];
  nfrfRankMin?: number;
  nfrfRankMax?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
}

/**
 * Cutoff search filters
 */
export interface CutoffSearchFilters {
  collegeId?: string;
  courseId?: string;
  year?: number;
  years?: number[];
  category?: string;
  quota?: string;
  state?: string;
  source?: string;
  level?: string;
  round?: number;
  limit?: number;
  offset?: number;
}

/**
 * Search result with pagination
 */
export interface SearchResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class SupabaseDataService {
  /**
   * Search colleges with advanced filters
   */
  async searchColleges(filters: CollegeSearchFilters): Promise<SearchResult<College>> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    let query = supabase
      .from('colleges')
      .select('*', { count: 'exact' });

    // Text search on name, city, state
    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,city.ilike.%${filters.query}%,state.ilike.%${filters.query}%`);
    }

    // Filter by states
    if (filters.states && filters.states.length > 0) {
      query = query.in('state', filters.states);
    }

    // Filter by management types
    if (filters.managementTypes && filters.managementTypes.length > 0) {
      query = query.in('management_type', filters.managementTypes);
    }

    // Filter by NIAC rating
    if (filters.niacRating && filters.niacRating.length > 0) {
      query = query.in('niac_rating', filters.niacRating);
    }

    // Filter by NIRF rank range
    if (filters.nfrfRankMin !== undefined) {
      query = query.gte('nirf_rank', filters.nfrfRankMin);
    }
    if (filters.nfrfRankMax !== undefined) {
      query = query.lte('nirf_rank', filters.nfrfRankMax);
    }

    // Geo-spatial search (if coordinates provided)
    if (filters.latitude && filters.longitude && filters.radiusKm) {
      // Use PostGIS ST_DWithin for radius search
      query = query.filter(
        'coordinates',
        'dwithin',
        `POINT(${filters.longitude} ${filters.latitude}),${filters.radiusKm * 1000}` // meters
      );
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching colleges:', error);
      throw new Error(`Failed to search colleges: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Get college by ID
   */
  async getCollege(id: string): Promise<College | null> {
    const { data, error } = await supabase
      .from('colleges')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching college:', error);
      return null;
    }

    return data;
  }

  /**
   * Get college with related data (courses, cutoffs, stats)
   */
  async getCollegeDetails(collegeId: string, userId?: string) {
    // Get college basic info
    const college = await this.getCollege(collegeId);
    if (!college) return null;

    // Get courses offered
    const { data: courses } = await supabase
      .from('courses')
      .select('*')
      .eq('college_id', collegeId);

    // Get recent cutoffs (last 3 years)
    const currentYear = new Date().getFullYear();
    const { data: cutoffs } = await supabase
      .from('cutoffs')
      .select('*')
      .eq('college_id', collegeId)
      .gte('year', currentYear - 3)
      .order('year', { ascending: false });

    // Get college stats (aggregated data)
    const { data: stats } = await supabase
      .from('college_stats')
      .select('*')
      .eq('college_id', collegeId)
      .single();

    // Check if user has favorited (if user logged in)
    let isFavorited = false;
    if (userId) {
      const { data: favorite } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('college_id', collegeId)
        .single();

      isFavorited = !!favorite;
    }

    return {
      college,
      courses: courses || [],
      cutoffs: cutoffs || [],
      stats: stats || null,
      isFavorited
    };
  }

  /**
   * Search cutoffs with filters
   */
  async searchCutoffs(filters: CutoffSearchFilters): Promise<SearchResult<Cutoff>> {
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    let query = supabase
      .from('cutoffs')
      .select('*', { count: 'exact' });

    // Filter by college
    if (filters.collegeId) {
      query = query.eq('college_id', filters.collegeId);
    }

    // Filter by course
    if (filters.courseId) {
      query = query.eq('course_id', filters.courseId);
    }

    // Filter by year (single or multiple)
    if (filters.year) {
      query = query.eq('year', filters.year);
    } else if (filters.years && filters.years.length > 0) {
      query = query.in('year', filters.years);
    }

    // Filter by category
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    // Filter by quota
    if (filters.quota) {
      query = query.eq('quota', filters.quota);
    }

    // Filter by state
    if (filters.state) {
      query = query.eq('state', filters.state);
    }

    // Filter by round
    if (filters.round) {
      query = query.eq('round', filters.round);
    }

    // Order by year (latest first), then rank
    query = query.order('year', { ascending: false })
                 .order('closing_rank', { ascending: true });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching cutoffs:', error);
      throw new Error(`Failed to search cutoffs: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Get all available years for cutoffs
   */
  async getAvailableYears(): Promise<number[]> {
    const { data, error } = await supabase
      .from('cutoffs')
      .select('year')
      .order('year', { ascending: false });

    if (error) {
      console.error('Error fetching available years:', error);
      return [];
    }

    // Get unique years
    const years = [...new Set(data.map(row => row.year))].filter(Boolean) as number[];
    return years;
  }

  /**
   * Get all available states
   */
  async getAvailableStates(): Promise<string[]> {
    const { data, error } = await supabase
      .from('colleges')
      .select('state')
      .order('state');

    if (error) {
      console.error('Error fetching states:', error);
      return [];
    }

    const states = [...new Set(data.map(row => row.state))].filter(Boolean) as string[];
    return states;
  }

  /**
   * Get all available categories
   */
  async getAvailableCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('cutoffs')
      .select('category')
      .order('category');

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    const categories = [...new Set(data.map(row => row.category))].filter(Boolean) as string[];
    return categories;
  }

  /**
   * Get all available quotas
   */
  async getAvailableQuotas(): Promise<string[]> {
    const { data, error } = await supabase
      .from('cutoffs')
      .select('quota')
      .order('quota');

    if (error) {
      console.error('Error fetching quotas:', error);
      return [];
    }

    const quotas = [...new Set(data.map(row => row.quota))].filter(Boolean) as string[];
    return quotas;
  }

  /**
   * Get master data (all colleges, courses, etc.)
   */
  async getMasterData() {
    const [colleges, states, categories, quotas] = await Promise.all([
      this.getAllColleges(),
      this.getAvailableStates(),
      this.getAvailableCategories(),
      this.getAvailableQuotas()
    ]);

    return {
      colleges,
      states,
      categories,
      quotas
    };
  }

  /**
   * Get all colleges (lightweight, just id and name)
   */
  async getAllColleges(): Promise<Pick<College, 'id' | 'name' | 'city' | 'state'>[]> {
    const { data, error } = await supabase
      .from('colleges')
      .select('id, name, city, state')
      .order('name');

    if (error) {
      console.error('Error fetching all colleges:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get all courses
   */
  async getAllCourses(): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching all courses:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get trending colleges (most favorited recently)
   */
  async getTrendingColleges(limit: number = 10): Promise<College[]> {
    // Get most favorited colleges in the last 30 days
    const { data: favoriteStats, error: statsError } = await supabase
      .from('favorites')
      .select('college_id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (statsError || !favoriteStats) {
      return [];
    }

    // Count occurrences
    const collegeCounts = favoriteStats.reduce((acc, fav) => {
      acc[fav.college_id] = (acc[fav.college_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get top college IDs
    const topCollegeIds = Object.entries(collegeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id);

    if (topCollegeIds.length === 0) {
      return [];
    }

    // Fetch college details
    const { data: colleges, error } = await supabase
      .from('colleges')
      .select('*')
      .in('id', topCollegeIds);

    if (error) {
      console.error('Error fetching trending colleges:', error);
      return [];
    }

    return colleges || [];
  }

  /**
   * Get personalized recommendations for a user
   * (Basic version - will be enhanced with ML recommendation engine)
   */
  async getRecommendations(userId: string, limit: number = 10) {
    // Check cache first
    const { data: cached } = await supabase
      .from('recommendation_cache')
      .select('*, colleges(*)')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('match_score', { ascending: false })
      .limit(limit);

    if (cached && cached.length > 0) {
      return cached;
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return [];
    }

    // Basic recommendation logic (will be replaced with advanced ML algorithm)
    const { data: recommendations } = await supabase
      .from('colleges')
      .select('*')
      .limit(limit);

    return recommendations || [];
  }
}

// Singleton instance
let supabaseDataServiceInstance: SupabaseDataService | null = null;

/**
 * Get the singleton Supabase Data Service instance
 */
export function getSupabaseDataService(): SupabaseDataService {
  if (!supabaseDataServiceInstance) {
    supabaseDataServiceInstance = new SupabaseDataService();
  }
  return supabaseDataServiceInstance;
}

// Export singleton instance for direct imports
export const supabaseDataService = new SupabaseDataService();
