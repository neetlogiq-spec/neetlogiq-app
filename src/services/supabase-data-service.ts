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
  stateIds?: string[];
  managementTypes?: ('Government' | 'Private' | 'Trust' | 'Deemed')[];
  streams?: string[];
  courses?: string[];
  courseIds?: string[];
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
 * Course search filters
 */
export interface CourseSearchFilters {
  query?: string;
  streams?: string[];
  branches?: string[];
  courseType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Cutoff search filters - uses master IDs for exact matching
 */
export interface CutoffSearchFilters {
  // Partition key filter (e.g., AIQ-PG-2024)
  partitionKey?: string;
  // Text search across college/course names
  search?: string;
  // Legacy source/level filters
  source?: string;
  level?: string;
  // Legacy text-based filters (for backward compatibility)
  collegeId?: string;
  courseId?: string;
  year?: number;
  years?: number[];
  category?: string;
  quota?: string;
  state?: string;
  management?: string;
  course?: string;
  round?: number;
  // Master ID-based filters (preferred for exact matching)
  masterCollegeId?: string;
  masterCourseId?: string;
  masterStateId?: string;
  masterQuotaId?: string;
  masterCategoryId?: string;
  // Rank range filters
  minRank?: number;
  maxRank?: number;
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Trend search filters - for comparing colleges/years
 */
export interface TrendFilters {
  // Partition key filter (e.g., AIQ-PG-2024)
  partitionKey?: string;
  // Master ID-based filters
  masterCollegeId?: string;
  masterCourseId?: string;
  masterStateId?: string;
  masterQuotaId?: string;
  masterCategoryId?: string;
  // Legacy text-based filters
  state?: string;
  category?: string;
  quota?: string;
  course?: string;
  // Year and round filters
  year?: number;
  years?: number[];
  round?: number;
  rounds?: number[];
  // Pagination
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
  async searchColleges(filters: CollegeSearchFilters): Promise<SearchResult<any>> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Use supabaseAdmin to bypass RLS policies
    const client = supabaseAdmin || supabase;

    // Prepare stream patterns
    let streamPatterns: string[] | null = null;
    const streamFilter = (filters as any).stream || filters.streams;
    if (streamFilter) {
      const streams = Array.isArray(streamFilter) 
        ? streamFilter 
        : streamFilter.split(',').map((s: string) => s.trim());
      streamPatterns = streams.map((s: string) => s.toUpperCase());
    }

    // Call the optimized RPC function
    const { data: records, error: rpcError } = await client.rpc('search_colleges_aggregated', {
      p_query: filters.query || null,
      p_streams: streamPatterns,
      p_states: filters.states && filters.states.length > 0 ? filters.states : null,
      p_management_types: filters.managementTypes && filters.managementTypes.length > 0 ? filters.managementTypes : null,
      p_limit: limit,
      p_offset: offset
    });

    if (rpcError) {
      console.error('Error calling search_colleges_aggregated:', rpcError);
      return {
        data: [],
        count: 0,
        page,
        pageSize: limit,
        totalPages: 0
      };
    }

    const totalCount = records && records.length > 0 ? parseInt(records[0].total_matching_count) : 0;

    // Map results to the expected format
    const processedColleges = (records || []).map(record => ({
      id: record.id,
      name: record.name,
      state: record.state,
      address: record.address,
      management_type: record.management,
      university_affiliation: record.university,
      course_count: record.courses,
      medical_courses: record.medical_courses,
      dental_courses: record.dental_courses,
      total_seats: record.total_seats,
      avg_cutoff: 0,
      acceptance_rate: 0,
      established: 0
    }));

    return {
      data: processedColleges,
      count: totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Get college by ID
   */
  async getCollege(id: string): Promise<College | null> {
    const { data, error } = await supabase
      .from('colleges')
      .select('id, name, state, address, college_type, normalized_name, normalized_state, normalized_address, composite_college_key, source_table')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching college:', error);
      return null;
    }

    return data as College;
  }

  /**
   * Get college with related data (courses, cutoffs, stats)
   */
<<<<<<< Updated upstream
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
=======
  async getCollegeDetails(collegeId: string, userId?: string, options?: {
    includeGraph?: boolean;
    graphDepth?: number;
  }) {
    // ULTRA-OPTIMIZED: Single seat_data query provides ALL needed information
    // No ID resolution needed, no colleges table query needed
    const { data: seatRecords, error } = await supabase
      .from('seat_data')
      .select('master_college_id, master_course_id, college_name, course_name, state, address, seats, university_affiliation, management, course_type')
      .eq('master_college_id', collegeId.toUpperCase());

    if (error || !seatRecords || seatRecords.length === 0) {
      return null;
    }

    // Extract college info from first record (all records have same college info)
    const firstRecord = seatRecords[0];
    const college = {
      id: firstRecord.master_college_id,
      name: firstRecord.college_name,
      state: firstRecord.state,
      address: firstRecord.address,
      management_type: firstRecord.management,
      university_affiliation: firstRecord.university_affiliation,
      college_type: firstRecord.course_type || 'MEDICAL',
    };

    // Build courses from seat_data (group by course_id to avoid duplicates)
    const courseMap = new Map<string, any>();
    seatRecords.forEach(record => {
      const courseId = record.master_course_id;
      if (courseId && !courseMap.has(courseId)) {
        courseMap.set(courseId, {
          id: courseId,
          name: record.course_name || 'Unknown Course',
          course_name: record.course_name || 'Unknown Course',
          program: record.management || 'N/A',
          total_seats: record.seats || 0,
          university_affiliation: record.university_affiliation || college.university_affiliation
        });
      }
    });

    const courses = Array.from(courseMap.values());

    // Check favorites only if user is logged in (lazy load)
>>>>>>> Stashed changes
    let isFavorited = false;
    if (userId) {
      const { data: favorite } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
<<<<<<< Updated upstream
        .eq('college_id', collegeId)
        .single();

=======
        .eq('college_id', collegeId.toUpperCase())
        .maybeSingle();
>>>>>>> Stashed changes
      isFavorited = !!favorite;
    }

    return {
<<<<<<< Updated upstream
      college,
      courses: courses || [],
      cutoffs: cutoffs || [],
      stats: stats || null,
      isFavorited
=======
      college: {
        ...college,
        course_count: courses.length
      },
      courses,
      cutoffs: [],
      stats: null,
      isFavorited,
      resolution: {
        method: 'direct',
        confidence: 1,
      },
>>>>>>> Stashed changes
    };
  }

  /**
   * Search cutoffs with filters - queries counselling_records with aggregation
   * Groups by master IDs to compute opening_rank (MIN) and closing_rank (MAX)
   */
  async searchCutoffs(filters: CutoffSearchFilters): Promise<SearchResult<any>> {
    // Allow large limits for partition-based loading (up to 100k records)
    const limit = Math.min(filters.limit || 1000, 100000);
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    try {
      // Try RPC function first (if available)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_cutoff_aggregates', {
        p_year: filters.year || null,
        p_state_id: filters.masterStateId || null,
        p_category_id: filters.masterCategoryId || null,
        p_quota_id: filters.masterQuotaId || null,
        p_course_id: filters.masterCourseId || null,
        p_college_id: filters.masterCollegeId || null,
        p_round: filters.round || null,
        p_min_rank: filters.minRank || null,
        p_max_rank: filters.maxRank || null,
        p_limit: limit,
        p_offset: offset
      });

      if (!rpcError && rpcData) {
        return {
          data: rpcData,
          count: rpcData.length,
          page,
          pageSize: limit,
          totalPages: Math.ceil(rpcData.length / limit)
        };
      }

      // Fallback: Direct query with manual filtering
      console.log('RPC not available, using direct query');
      
      let query = supabase
        .from('counselling_records')
        .select('*', { count: 'exact' });

      // Apply master ID filters
      if (filters.masterCollegeId) {
        query = query.eq('master_college_id', filters.masterCollegeId);
      }
      if (filters.masterCourseId) {
        query = query.eq('master_course_id', filters.masterCourseId);
      }
      if (filters.masterStateId) {
        query = query.eq('master_state_id', filters.masterStateId);
      }
      if (filters.masterQuotaId) {
        query = query.eq('master_quota_id', filters.masterQuotaId);
      }
      if (filters.masterCategoryId) {
        query = query.eq('master_category_id', filters.masterCategoryId);
      }
      
      // Apply partition key filter (most efficient)
      if (filters.partitionKey) {
        query = query.eq('partition_key', filters.partitionKey);
      }
      
      // Apply source/level filters (fallback)
      if (filters.source && !filters.partitionKey) {
        query = query.eq('source_normalized', filters.source);
      }
      if (filters.level && !filters.partitionKey) {
        query = query.eq('level_normalized', filters.level);
      }
      
      // Apply year and round filters
      if (filters.year) {
        query = query.eq('year', filters.year);
      } else if (filters.years && filters.years.length > 0) {
        query = query.in('year', filters.years);
      }
      if (filters.round) {
        query = query.eq('round_normalized', filters.round);
      }

      // Apply text-based filters as fallback
      if (filters.state && !filters.masterStateId) {
        query = query.ilike('state', `%${filters.state}%`);
      }
      if (filters.category && !filters.masterCategoryId) {
        query = query.ilike('category', `%${filters.category}%`);
      }
      if (filters.quota && !filters.masterQuotaId) {
        query = query.ilike('quota', `%${filters.quota}%`);
      }

      // Order by rank
      query = query.order('all_india_rank', { ascending: true });

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      // Enhanced logging for debugging chunk loading
      console.log('Cutoffs query result:', { 
        requestedLimit: limit,
        requestedOffset: offset,
        dataLength: data?.length, 
        totalCount: count, 
        error: error?.message,
        partitionKey: filters.partitionKey
      });

      if (error) {
        console.error('Error searching cutoffs:', error);
        throw new Error(`Failed to search cutoffs: ${error.message}`);
      }

      // Client-side aggregation (less efficient but works without RPC)
      const aggregated = this.aggregateCutoffs(data || []);

      return {
        data: aggregated,
        count: count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((count || 0) / limit)
      };

    } catch (error) {
      console.error('Error in searchCutoffs:', error);
      throw error;
    }
  }

  /**
   * Client-side aggregation of cutoff records
   * Groups by composite key and computes min/max ranks
   */
  private aggregateCutoffs(records: any[]): any[] {
    const grouped = new Map<string, any>();

    for (const record of records) {
      const key = `${record.master_college_id}-${record.master_course_id}-${record.master_state_id}-${record.master_quota_id}-${record.master_category_id}-${record.round_normalized}-${record.year}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          master_college_id: record.master_college_id,
          master_course_id: record.master_course_id,
          master_state_id: record.master_state_id,
          master_quota_id: record.master_quota_id,
          master_category_id: record.master_category_id,
          college_name: record.college_name,
          course_name: record.course_name,
          state: record.state,
          category: record.category,
          quota: record.quota,
          year: record.year,
          round: record.round_normalized,
          level_id: record.level_id,
          opening_rank: record.all_india_rank,
          closing_rank: record.all_india_rank,
          total_seats: 1
        });
      } else {
        const existing = grouped.get(key);
        existing.opening_rank = Math.min(existing.opening_rank, record.all_india_rank);
        existing.closing_rank = Math.max(existing.closing_rank, record.all_india_rank);
        existing.total_seats += 1;
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.opening_rank - b.opening_rank);
  }

  /**
   * Search cutoffs from pre-aggregated materialized view
   * This provides consistent row counts and eliminates client-side aggregation
   * 100 rows requested = 100 rows returned
   */
  async searchAggregatedCutoffs(filters: CutoffSearchFilters): Promise<SearchResult<any>> {
    const limit = Math.min(filters.limit || 100, 1000);
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    try {
      // Query the materialized view directly
      let query = supabase
        .from('aggregated_cutoffs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.partitionKey) {
        query = query.eq('partition_key', filters.partitionKey);
      }
      if (filters.state) {
        query = query.ilike('state', `%${filters.state}%`);
      }
      if (filters.category) {
        query = query.ilike('category', `%${filters.category}%`);
      }
      if (filters.quota) {
        query = query.ilike('quota', `%${filters.quota}%`);
      }
      if (filters.course) {
        query = query.ilike('course_name', `%${filters.course}%`);
      }
      if (filters.management) {
        query = query.ilike('management', `%${filters.management}%`);
      }
      if (filters.year) {
        query = query.eq('year', filters.year);
      }
      if (filters.round) {
        query = query.eq('round', filters.round);
      }
      if (filters.minRank) {
        query = query.gte('closing_rank', filters.minRank);
      }
      if (filters.maxRank) {
        query = query.lte('closing_rank', filters.maxRank);
      }
      // Text search across college_name, course_name, and state
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`college_name.ilike.${searchTerm},course_name.ilike.${searchTerm},state.ilike.${searchTerm}`);
      }

      // Order by opening rank (ascending - lower ranks first)
      query = query.order('opening_rank', { ascending: true });

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      console.log('Aggregated cutoffs query:', {
        requestedLimit: limit,
        requestedOffset: offset,
        returnedRows: data?.length,
        totalCount: count,
        error: error?.message,
        partitionKey: filters.partitionKey
      });

      if (error) {
        console.error('Error querying aggregated_cutoffs:', error);
        // Fall back to counselling_records with client-side aggregation
        console.log('Falling back to client-side aggregation...');
        return this.searchCutoffs(filters);
      }

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((count || 0) / limit)
      };

    } catch (error) {
      console.error('Error in searchAggregatedCutoffs:', error);
      // Fall back to client-side aggregation
      return this.searchCutoffs(filters);
    }
  }

  /**
   * Get trend data for comparing colleges/years
   * Queries aggregated_cutoffs materialized view (same pattern as searchAggregatedCutoffs)
   * Returns data grouped for trend analysis
   */
  async getTrendData(filters: TrendFilters): Promise<SearchResult<any>> {
    const limit = Math.min(filters.limit || 100, 1000);
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    try {
      // Query the materialized view directly
      let query = supabase
        .from('aggregated_cutoffs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.partitionKey) {
        query = query.eq('partition_key', filters.partitionKey);
      }
      
      // Master ID filters (preferred for exact matching)
      if (filters.masterCollegeId) {
        query = query.eq('master_college_id', filters.masterCollegeId);
      }
      if (filters.masterCourseId) {
        query = query.eq('master_course_id', filters.masterCourseId);
      }
      if (filters.masterStateId) {
        query = query.eq('master_state_id', filters.masterStateId);
      }
      if (filters.masterQuotaId) {
        query = query.eq('master_quota_id', filters.masterQuotaId);
      }
      if (filters.masterCategoryId) {
        query = query.eq('master_category_id', filters.masterCategoryId);
      }
      
      // Text-based filters (fallback)
      if (filters.state && !filters.masterStateId) {
        query = query.ilike('state', `%${filters.state}%`);
      }
      if (filters.category && !filters.masterCategoryId) {
        query = query.ilike('category', `%${filters.category}%`);
      }
      if (filters.quota && !filters.masterQuotaId) {
        query = query.ilike('quota', `%${filters.quota}%`);
      }
      if (filters.course && !filters.masterCourseId) {
        query = query.ilike('course_name', `%${filters.course}%`);
      }
      
      // Year and round filters
      if (filters.year) {
        query = query.eq('year', filters.year);
      } else if (filters.years && filters.years.length > 0) {
        query = query.in('year', filters.years);
      }
      if (filters.round) {
        query = query.eq('round', filters.round);
      } else if (filters.rounds && filters.rounds.length > 0) {
        query = query.in('round', filters.rounds);
      }

      // Order by year (descending), then round
      query = query.order('year', { ascending: false }).order('round', { ascending: true });

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      console.log('Trend data query:', {
        requestedLimit: limit,
        requestedOffset: offset,
        returnedRows: data?.length,
        totalCount: count,
        error: error?.message,
        filters: {
          partitionKey: filters.partitionKey,
          masterCollegeId: filters.masterCollegeId,
          years: filters.years
        }
      });

      if (error) {
        console.error('Error querying aggregated_cutoffs for trends:', error);
        throw new Error(`Failed to fetch trend data: ${error.message}`);
      }

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((count || 0) / limit)
      };

    } catch (error) {
      console.error('Error in getTrendData:', error);
      throw error;
    }
  }

  /**
   * Get distinct filter options from partition_distinct_values table (optimized)
   * Falls back to pagination if table doesn't exist
   * Uses master IDs and looks up names from master tables for consistency
   */
  async getFilterOptions(partitionKey: string): Promise<{
    states: string[];
    courses: string[];
    quotas: string[];
    categories: string[];
    managementTypes: string[];
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;
      
      // Try optimized path: partition_distinct_values table (instant lookup)
      const { data: distinctData, error: distinctError } = await adminClient
        .from('partition_distinct_values')
        .select('state_ids, course_ids, quota_ids, category_ids, managements')
        .eq('partition_key', partitionKey)
        .single();
      
      let stateIds: string[] = [];
      let courseIds: string[] = [];
      let quotaIds: string[] = [];
      let categoryIds: string[] = [];
      let managementTypes: string[] = [];
      
      if (distinctData && !distinctError) {
        // Fast path: use precomputed arrays
        console.log('getFilterOptions: Using partition_distinct_values (optimized)');
        stateIds = distinctData.state_ids || [];
        courseIds = distinctData.course_ids || [];
        quotaIds = distinctData.quota_ids || [];
        categoryIds = distinctData.category_ids || [];
        managementTypes = (distinctData.managements || []).filter((m: string) => m && m !== '-').sort();
      } else {
        // Fallback: paginate through aggregated_cutoffs
        console.log('getFilterOptions: Falling back to pagination (table not ready)');
        
        const fetchAllDistinct = async (column: string): Promise<string[]> => {
          const pageSize = 1000;
          let offset = 0;
          const allIds = new Set<string>();
          let hasMore = true;
          
          while (hasMore) {
            const { data, error } = await adminClient
              .from('aggregated_cutoffs')
              .select(column)
              .eq('partition_key', partitionKey)
              .not(column, 'is', null)
              .range(offset, offset + pageSize - 1);
            
            if (error) break;
            if (!data || data.length === 0) {
              hasMore = false;
            } else {
              data.forEach(row => {
                const value = (row as any)[column];
                if (value) allIds.add(value);
              });
              offset += pageSize;
              hasMore = data.length === pageSize;
            }
          }
          return [...allIds];
        };
        
        [stateIds, courseIds, quotaIds, categoryIds] = await Promise.all([
          fetchAllDistinct('master_state_id'),
          fetchAllDistinct('master_course_id'),
          fetchAllDistinct('master_quota_id'),
          fetchAllDistinct('master_category_id')
        ]);
        
        const mgmtValues = await fetchAllDistinct('management');
        managementTypes = mgmtValues.filter(m => m && m !== '-').sort();
      }
      
      console.log('Distinct IDs:', {
        stateIds: stateIds.length,
        courseIds: courseIds.length,
        quotaIds: quotaIds.length,
        categoryIds: categoryIds.length,
        managements: managementTypes.length
      });

      // Lookup names from master tables
      const [statesResult, coursesResult, quotasResult, categoriesResult] = await Promise.all([
        stateIds.length > 0 
          ? adminClient.from('states').select('name').in('id', stateIds).order('name')
          : Promise.resolve({ data: [] }),
        courseIds.length > 0
          ? adminClient.from('courses').select('name').in('id', courseIds).order('name')
          : Promise.resolve({ data: [] }),
        quotaIds.length > 0
          ? adminClient.from('quotas').select('name').in('id', quotaIds).order('name')
          : Promise.resolve({ data: [] }),
        categoryIds.length > 0
          ? adminClient.from('categories').select('name').in('id', categoryIds).order('name')
          : Promise.resolve({ data: [] })
      ]);

      const states = (statesResult.data || []).map(r => r.name).filter(Boolean);
      const courses = (coursesResult.data || []).map(r => r.name).filter(Boolean);
      const quotas = (quotasResult.data || []).map(r => r.name).filter(Boolean);
      const categories = (categoriesResult.data || []).map(r => r.name).filter(Boolean);

      console.log(`Filter options (${partitionKey}) FINAL:`, {
        states: states.length,
        courses: courses.length,
        quotas: quotas.length,
        categories: categories.length,
        managements: managementTypes.length
      });

      return { states, courses, quotas, categories, managementTypes };
    } catch (error) {
      console.error('Error getting filter options:', error);
      return { states: [], courses: [], quotas: [], categories: [], managementTypes: [] };
    }
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
   * Get all available states with IDs
   */
  async getAvailableStates(): Promise<{id: string, name: string}[]> {
    const { data, error } = await supabase
      .from('states')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching states:', error);
      return [];
    }

    return data || [];
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
   * Get master data (all colleges, states, courses, categories, quotas)
   */
  async getMasterData() {
    const [colleges, states, courses, categories, quotas] = await Promise.all([
      this.getAllColleges(),
      this.getAvailableStates(),
      this.getAllCourses(),
      this.getAvailableCategories(),
      this.getAvailableQuotas()
    ]);

    return {
      colleges,
      states,
      courses,
      categories,
      quotas
    };
  }

  /**
   * Get all colleges (lightweight, just id and name)
   */
  async getAllColleges(): Promise<Pick<College, 'id' | 'name' | 'state'> & { address?: string }[]> {
    const { data, error } = await supabase
      .from('colleges')
      .select('id, name, state, address')
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
<<<<<<< Updated upstream
=======
   * Search courses with aggregation from seat_data
   */
  async searchCourses(filters: CourseSearchFilters): Promise<SearchResult<any>> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Use supabaseAdmin to bypass RLS policies and get all courses
    const client = supabaseAdmin || supabase;

    // Map high-level stream labels to SQL course_type patterns
    let streamPatterns: string[] | null = null;
    if (filters.streams && filters.streams.length > 0) {
      streamPatterns = filters.streams.map(s => {
        if (s === 'Medical') return 'medical';
        if (s === 'Dental') return 'dental';
        if (s === 'DNB') return 'dnb';
        return s.toLowerCase();
      });
    }

    // Map high-level branch/stream selections to course name ILIKE patterns
    const branchPatterns: string[] = [];
    if (filters.branches) {
      filters.branches.forEach(branch => {
        switch (branch) {
          case 'UG':
            // Exact match for MBBS and BDS only (not courses containing MBBS in name like "POST MBBS DIPLOMA...")
            branchPatterns.push('MBBS', 'BDS');
            break;
          case 'Dental PG':
            branchPatterns.push('%MDS%', '%PG DIPLOMA%');
            break;
          case 'Medical PG (MD/MS/MD&MS)':
            branchPatterns.push('%MD%', '%MS%', '%MD/MS%', '%MPH%');
            break;
          case 'Diploma':
            branchPatterns.push('%DIPLOMA%', '%POST MBBS DIPLOMA COURSES IN OBG%');
            break;
          case 'DNB':
            branchPatterns.push('%DNB%', '%DNB POST DIPLOMA%');
            break;
          case 'DNB- Diploma':
            branchPatterns.push('%DNB- DIPLOMA%');
            break;
          case 'SS (Super Specialty)':
            branchPatterns.push('%DM%', '%MCH%');
            break;
        }
      });
    }

    const finalBranchPatterns = branchPatterns.length > 0 ? branchPatterns : null;

    // Add courseType to branch patterns if specified (for specific course type filtering)
    // If courseType is set, add it to the patterns; if branchPatterns is empty, use just courseType
    let combinedPatterns: string[] | null = finalBranchPatterns;
    if (filters.courseType) {
      const courseTypePattern = `%${filters.courseType}%`;
      if (combinedPatterns) {
        // Filter branch patterns to those containing the course type for synced filtering
        combinedPatterns = combinedPatterns.filter(p => 
          p.toUpperCase().includes(filters.courseType!.toUpperCase()) || 
          p === 'MBBS' || p === 'BDS'  // Keep exact matches for UG
        );
        // If no overlap, just add the courseType pattern
        if (combinedPatterns.length === 0) {
          combinedPatterns = [courseTypePattern];
        }
      } else {
        combinedPatterns = [courseTypePattern];
      }
    }

    // Call the optimized RPC function
    const { data: records, error: rpcError } = await client.rpc('search_courses_aggregated', {
      p_query: filters.query || null,
      p_streams: streamPatterns,
      p_branches: combinedPatterns,
      p_limit: limit,
      p_offset: offset
    });

    if (rpcError) {
      console.error('Error calling search_courses_aggregated:', rpcError);
      return {
        data: [],
        count: 0,
        page,
        pageSize: limit,
        totalPages: 0
      };
    }

    const totalCount = records && records.length > 0 ? parseInt(records[0].total_matching_count) : 0;

    // Map results and add simple duration mapping
    const processedCourses = (records || []).map(record => {
      const name = record.course_name.toUpperCase();
      let duration = '3'; // Default PG
      if (name.includes('MBBS')) duration = '5.5';
      else if (name.includes('BDS')) duration = '5';
      else if (name.includes('DIPLOMA')) duration = '2';

      // Normalize stream to valid values: MEDICAL, DENTAL, or DNB
      // Some records may have course_type like 'DIPLOMA' which is not a valid stream
      let normalizedStream = (record.stream || '').toUpperCase();
      const validStreams = ['MEDICAL', 'DENTAL', 'DNB'];
      
      if (!validStreams.includes(normalizedStream)) {
        // Infer stream from course name
        if (name.includes('BDS') || name.includes('MDS') || name.includes('DENTAL')) {
          normalizedStream = 'DENTAL';
        } else if (name.includes('DNB')) {
          normalizedStream = 'DNB';
        } else {
          // Default to MEDICAL for all other courses (including DIPLOMA courses, MD, MS, DM, MCH, MBBS, etc.)
          normalizedStream = 'MEDICAL';
        }
      }

      return {
        id: record.course_id,
        name: record.course_name,
        course_name: record.course_name,
        stream: normalizedStream,
        total_seats: parseInt(record.total_seats),
        total_colleges: parseInt(record.total_colleges),
        duration
      };
    });

    // Sort courses by branch preference order:
    // UG (1) → Medical PG (2) → DNB (3) → Dental PG (4) → Diploma (5) → DNB-Diploma (6) → SS (7)
    const getBranchPriority = (courseName: string): number => {
      const name = (courseName || '').toUpperCase();
      
      // 1. UG - MBBS, BDS (exact matches)
      if (name === 'MBBS' || name === 'BDS') return 1;
      
      // 2. Medical PG - MD, MS (but not MDS which is Dental PG)
      if ((name.includes('MD') || name.includes('MS') || name.includes('MPH')) && 
          !name.includes('MDS') && !name.includes('DNB') && !name.includes('DM') && !name.includes('MCH')) {
        return 2;
      }
      
      // 3. DNB (but not DNB-Diploma)
      if (name.includes('DNB') && !name.includes('DIPLOMA') && !name.includes('DNB-')) {
        return 3;
      }
      
      // 4. Dental PG - MDS
      if (name.includes('MDS')) return 4;
      
      // 5. Diploma (but not DNB-Diploma)
      if ((name.includes('DIPLOMA') || name.includes('PG DIPLOMA')) && !name.includes('DNB')) {
        return 5;
      }
      
      // 6. DNB-Diploma
      if (name.includes('DNB') && (name.includes('DIPLOMA') || name.includes('DNB-'))) {
        return 6;
      }
      
      // 7. SS - Super Specialty (DM, MCH)
      if (name.includes('DM ') || name.startsWith('DM') || name.includes('MCH') || name.includes('M.CH')) {
        return 7;
      }
      
      // Default - put at end
      return 99;
    };

    // Sort by priority, then alphabetically within same priority
    processedCourses.sort((a, b) => {
      const priorityA = getBranchPriority(a.course_name);
      const priorityB = getBranchPriority(b.course_name);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.course_name || '').localeCompare(b.course_name || '');
    });

    return {
      data: processedCourses,
      count: totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Get course by ID with related data
   * Enhanced with ID resolution and relationship graph
   */
  async getCourseDetails(courseId: string, options?: {
    includeGraph?: boolean;
    graphDepth?: number;
  }) {
    // Step 1: Smart ID resolution - handles both UUIDs and names
    const resolution = await resolveId(courseId, {
      type: 'course',
      fuzzyThreshold: 0.7,
      useCache: true,
    });

    // If not found, return null
    if (!resolution.id) {
      return null;
    }

    const resolvedId = resolution.id;

    // Get course basic info
    let courseData;
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', resolvedId)
      .maybeSingle();

    if (error || !course) {
      // Fallback: Try to get info from seat_data if not in courses table
      const { data: seatRecords } = await supabase
        .from('seat_data')
        .select('master_course_id, course_name, seats, course_type, master_college_id')
        .or(`master_course_id.eq.${resolvedId},course_name.eq.${resolvedId}`);
      
      if (seatRecords && seatRecords.length > 0) {
        const first = seatRecords[0];
        const totalSeats = seatRecords.reduce((sum, r) => sum + (r.seats || 0), 0);
        const uniqueColleges = new Set(seatRecords.map(r => r.master_college_id).filter(Boolean)).size;
        
        courseData = {
          id: resolvedId,
          name: first.course_name,
          course_name: first.course_name,
          stream: first.course_type || 'MEDICAL',
          total_seats: totalSeats,
          total_colleges: uniqueColleges,
          // Add dummy values for missing fields
          duration_years: first.course_name?.includes('MBBS') ? 5.5 : 3,
        };
      } else {
        return null;
      }
    } else {
      courseData = course;
    }

    // Get college info if college_id exists
    let college = null;
    if (courseData.college_id) {
      college = await this.getCollege(courseData.college_id);
    }

    // Get cutoffs for this course
    const currentYear = new Date().getFullYear();
    const { data: cutoffs } = await supabase
      .from('cutoffs')
      .select('*')
      .or(`course_id.eq.${resolvedId},course_name.eq.${courseData.name}`)
      .gte('year', currentYear - 3)
      .order('year', { ascending: false });

    // Step 2: Get relationship graph if requested
    let relationshipGraph = null;
    if (options?.includeGraph !== false) {
      try {
        relationshipGraph = await getRelationshipGraph(
          resolvedId,
          'course',
          {
            maxDepth: options?.graphDepth || 1,
            includeMetadata: false,
          }
        );
      } catch (error) {
        console.error('Error fetching course relationship graph:', error);
      }
    }

    return {
      course,
      college,
      cutoffs: cutoffs || [],
      resolution: {
        method: resolution.method,
        confidence: resolution.confidence,
        originalQuery: courseId !== resolvedId ? courseId : undefined,
      },
      relationshipGraph: relationshipGraph ? {
        totalNodes: relationshipGraph.nodes.length,
        totalEdges: relationshipGraph.edges.length,
        relatedColleges: relationshipGraph.nodes.filter(n => n.type === 'college').length,
        relatedStates: relationshipGraph.nodes.filter(n => n.type === 'state').length,
      } : undefined,
    };
  }

  /**
>>>>>>> Stashed changes
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

  /**
   * Get colleges offering a specific course from seat_data
   */
  async getCourseColleges(courseIdOrName: string): Promise<{ data: any[], course?: any }> {
    // Use supabaseAdmin to ensure we see all data (bypass RLS)
    const client = supabaseAdmin || supabase;
    const searchVal = courseIdOrName.trim();

    // Query seat_data with case-insensitive matching for both ID and name
    const { data: seatRecords, error } = await client
      .from('seat_data')
      .select('master_course_id, course_name, course_type, master_college_id, college_name, state, address, seats, management, university_affiliation')
      .or(`master_course_id.ilike.${searchVal},course_name.ilike.${searchVal}`);

    if (error) {
      console.error('Error fetching course colleges from seat_data:', error);
      return { data: [] };
    }

    if (!seatRecords || seatRecords.length === 0) {
      // Try one more time with a partial match if exact match failed
      const { data: partialRecords, error: partialError } = await client
        .from('seat_data')
        .select('master_course_id, course_name, course_type, master_college_id, college_name, state, address, seats, management, university_affiliation')
        .or(`master_course_id.ilike.%${searchVal}%,course_name.ilike.%${searchVal}%`)
        .limit(100);

      if (partialError || !partialRecords || partialRecords.length === 0) {
        return { data: [] };
      }
      
      return this.processSeatRecords(partialRecords);
    }

    return this.processSeatRecords(seatRecords);
  }

  /**
   * Internal helper to process seat records into course/colleges structure
   */
  private processSeatRecords(seatRecords: any[]): { data: any[], course?: any } {
    const first = seatRecords[0];
    const course = {
      id: first.master_course_id,
      name: first.course_name,
      course_name: first.course_name,
      stream: first.course_type || 'MEDICAL',
    };

    const collegeMap = new Map<string, any>();
    seatRecords.forEach(record => {
      const collegeId = record.master_college_id;
      if (!collegeId) return;

      if (!collegeMap.has(collegeId)) {
        collegeMap.set(collegeId, {
          id: collegeId,
          name: record.college_name,
          state: record.state,
          address: record.address,
          management_type: record.management,
          college_type: record.course_type || 'MEDICAL',
          university_affiliation: record.university_affiliation,
          total_seats: record.seats || 0
        });
      } else {
        const existing = collegeMap.get(collegeId);
        existing.total_seats += (record.seats || 0);
      }
    });

    return { 
      data: Array.from(collegeMap.values()),
      course 
    };
  }

  // =====================================================
  // COMPARE COLLEGES METHODS
  // =====================================================

  /**
   * Get distinct filter options for compare page from seat_data
   */
  async getCompareFilterOptions(): Promise<{
    streams: { value: string; label: string }[];
    managements: { value: string; label: string }[];
    states: { value: string; label: string; id?: string }[];
  }> {
    try {
      // Supabase limits to 1000 rows per query, so we need to paginate
      // or use a more efficient approach
      
      const courseTypes = new Set<string>();
      const managements = new Set<string>();
      const statesMap = new Map<string, { label: string; id?: string }>();
      
      // Paginate through all records to get distinct values
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('seat_data')
          .select('course_type, management, state, master_state_id')
          .not('master_college_id', 'is', null)
          .range(offset, offset + batchSize - 1);
        
        if (error) {
          console.error('Error fetching filter options batch:', error);
          break;
        }
        
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }
        
        // Process this batch
        data.forEach((record: any) => {
          if (record.course_type) courseTypes.add(record.course_type);
          if (record.management) managements.add(record.management);
          if (record.state) {
            statesMap.set(record.state, {
              label: record.state,
              id: record.master_state_id || undefined
            });
          }
        });
        
        offset += batchSize;
        
        // If we got less than batch size, we've reached the end
        if (data.length < batchSize) {
          hasMore = false;
        }
        
        // Safety limit - don't fetch more than 100k records
        if (offset >= 100000) {
          console.log('Reached safety limit of 100k records');
          hasMore = false;
        }
      }
      
      console.log(`Fetched ${offset} total records. Found: ${courseTypes.size} course_types, ${managements.size} managements, ${statesMap.size} states`);
      console.log('Course types found:', Array.from(courseTypes));
      
      // Map course_type to stream (medical/dental/dnb/ayush)
      const streamSet = new Set<string>();
      courseTypes.forEach(type => {
        const upperType = type.toUpperCase();
        // Check DNB first (most specific)
        if (upperType.includes('DNB')) {
          streamSet.add('dnb');
        } else if (upperType.includes('DENTAL') || upperType.includes('BDS') || upperType.includes('MDS')) {
          streamSet.add('dental');
        } else if (upperType.includes('AYUSH') || upperType.includes('BAMS') || upperType.includes('BHMS') || upperType.includes('BNYS') || upperType.includes('BUMS')) {
          streamSet.add('ayush');
        } else {
          streamSet.add('medical');
        }
      });
      
      // Format streams with proper labels
      const streamLabels: Record<string, string> = {
        'medical': 'Medical',
        'dental': 'Dental',
        'dnb': 'DNB',
        'ayush': 'AYUSH'
      };
      const streams = Array.from(streamSet).map(s => ({
        value: s,
        label: streamLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)
      }));
      
      // Format managements
      const managementLabels: Record<string, string> = {
        '-': 'DNB',
        'GOVT': 'Government',
        'PVT': 'Private',
        'PRIVATE': 'Private',
        'DEEMED': 'Deemed',
        'TRUST': 'Trust',
        'CENTRAL': 'Central',
        'STATE': 'State',
        'GOVERNMENT': 'Government',
        'GOVERNMENT-SOCIETY': 'Government Society'
      };
      
      const formattedManagements = Array.from(managements).map(m => ({
        value: m.toLowerCase(),
        label: managementLabels[m.toUpperCase()] || m
      }));
      
      // Format states
      const formattedStates = Array.from(statesMap.entries())
        .map(([state, info]) => ({
          value: state.toLowerCase().replace(/\s+/g, '-'),
          label: info.label,
          id: info.id
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      
      console.log(`Filter options: ${streams.length} streams, ${formattedManagements.length} managements, ${formattedStates.length} states`);
      
      return {
        streams,
        managements: formattedManagements,
        states: formattedStates
      };
      
    } catch (error) {
      console.error('Error in getCompareFilterOptions:', error);
      return { streams: [], managements: [], states: [] };
    }
  }

  /**
   * Search colleges for comparison feature
   * Queries seat_data for unique colleges with aggregated course/seat counts
   */
  async searchCollegesForCompare(filters: {
    search?: string;
    stream?: string;
    management?: string;
    state?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const limit = filters.limit || 20;
      
      // Build query to get distinct colleges with aggregated data
      let query = supabase
        .from('seat_data')
        .select('master_college_id, college_name, normalized_address, state, management, course_name, seats, course_type, university_affiliation')
        .not('master_college_id', 'is', null);
      
      // Apply search filter
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`college_name.ilike.${searchTerm},state.ilike.${searchTerm}`);
      }
      
      // Apply management filter
      if (filters.management && filters.management !== 'all') {
        const managementMap: Record<string, string> = {
          'government': 'GOVT',
          'private': 'PVT',
          'deemed': 'DEEMED'
        };
        const managementValue = managementMap[filters.management.toLowerCase()] || filters.management;
        query = query.eq('management', managementValue);
      }
      
      // Apply state filter
      if (filters.state && filters.state !== 'all') {
        query = query.ilike('state', `%${filters.state}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error searching colleges for compare:', error);
        return [];
      }
      
      // Aggregate data by college
      const collegeMap = new Map<string, any>();
      
      (data || []).forEach((record: any) => {
        const collegeId = record.master_college_id;
        if (!collegeId) return;
        
        if (!collegeMap.has(collegeId)) {
          collegeMap.set(collegeId, {
            id: collegeId,
            name: record.college_name,
            city: record.normalized_address || '', // Use normalized_address for city/address
            state: record.state || '',
            type: record.course_type || 'Medical',
            management: record.management || 'Government',
            affiliatedUniversity: record.university_affiliation || 'N/A',
            courses: 0,
            medicalCourses: 0,
            dentalCourses: 0,
            dnbCourses: 0,
            totalSeats: 0,
            avgCutoff: 0,
            established: 0,
            acceptanceRate: 0,
            stream: this.getStreamFromCourseType(record.course_type),
            availableCourses: []
          });
        }
        
        const college = collegeMap.get(collegeId);
        college.courses += 1;
        college.totalSeats += (record.seats || 0);
        
        // Update affiliated university if we find a better value
        if ((!college.affiliatedUniversity || college.affiliatedUniversity === 'N/A') && record.university_affiliation) {
          college.affiliatedUniversity = record.university_affiliation;
        }
        
        // Classify course type using proper patterns
        const courseCategory = this.classifyCourse(record.course_name || '');
        if (courseCategory === 'dnb') {
          college.dnbCourses += 1;
        } else if (courseCategory === 'dental') {
          college.dentalCourses += 1;
        } else {
          college.medicalCourses += 1;
        }
        
        // Add to available courses
        college.availableCourses.push({
          name: record.course_name,
          seats: record.seats || 0
        });
      });
      
      // Convert to array and limit
      const colleges = Array.from(collegeMap.values()).slice(0, limit);
      
      console.log(`Found ${colleges.length} colleges for compare with filters:`, filters);
      return colleges;
      
    } catch (error) {
      console.error('Error in searchCollegesForCompare:', error);
      return [];
    }
  }

  /**
   * Get detailed seat data for multiple colleges (for comparison view)
   */
  async getCollegesWithSeatData(collegeIds: string[]): Promise<any[]> {
    try {
      if (!collegeIds.length) return [];
      
      // Query seat_data for all selected colleges
      const { data, error } = await supabase
        .from('seat_data')
        .select('master_college_id, college_name, normalized_address, course_name, seats, state, management, course_type, university_affiliation')
        .in('master_college_id', collegeIds);
      
      if (error) {
        console.error('Error fetching seat data for compare:', error);
        return [];
      }
      
      // Aggregate by college
      const collegeMap = new Map<string, any>();
      
      (data || []).forEach((record: any) => {
        const collegeId = record.master_college_id;
        if (!collegeId) return;
        
        if (!collegeMap.has(collegeId)) {
          collegeMap.set(collegeId, {
            id: collegeId,
            name: record.college_name,
            city: record.normalized_address || '', // Use normalized_address
            state: record.state || '',
            type: record.course_type || 'Medical',
            management: record.management || 'Government',
            affiliatedUniversity: record.university_affiliation || '',
            courses: 0,
            medicalCourses: 0,
            dentalCourses: 0,
            dnbCourses: 0,
            totalSeats: 0,
            avgCutoff: 0,
            established: 0,
            acceptanceRate: 0,
            stream: this.getStreamFromCourseType(record.course_type),
            availableCourses: []
          });
        }
        
        const college = collegeMap.get(collegeId);
        college.courses += 1;
        college.totalSeats += (record.seats || 0);
        
        // Update affiliated university if we find a better value
        if ((!college.affiliatedUniversity || college.affiliatedUniversity === 'N/A') && record.university_affiliation) {
          college.affiliatedUniversity = record.university_affiliation;
        }
        
        // Classify course type using proper patterns
        const courseCategory = this.classifyCourse(record.course_name || '');
        if (courseCategory === 'dnb') {
          college.dnbCourses += 1;
        } else if (courseCategory === 'dental') {
          college.dentalCourses += 1;
        } else {
          college.medicalCourses += 1;
        }
        
        // Add to available courses (avoid duplicates)
        const existingCourse = college.availableCourses.find((c: any) => c.name === record.course_name);
        if (!existingCourse) {
          college.availableCourses.push({
            name: record.course_name,
            seats: record.seats || 0
          });
        } else {
          existingCourse.seats += (record.seats || 0);
        }
      });
      
      // Return colleges in the order requested
      return collegeIds.map(id => collegeMap.get(id)).filter(Boolean);
      
    } catch (error) {
      console.error('Error in getCollegesWithSeatData:', error);
      return [];
    }
  }

  /**
   * Helper to determine stream from course type
   */
  private getStreamFromCourseType(courseType: string | null): 'medical' | 'dental' | 'ayush' {
    if (!courseType) return 'medical';
    const type = courseType.toUpperCase();
    if (type.includes('DENTAL') || type.includes('BDS') || type.includes('MDS')) return 'dental';
    if (type.includes('AYUSH') || type.includes('BAMS') || type.includes('BHMS')) return 'ayush';
    return 'medical';
  }

  /**
   * Classify a course as DNB, dental, or medical based on patterns
   * Order: DNB first (most specific), then dental, then medical (default)
   */
  private classifyCourse(courseName: string): 'dnb' | 'dental' | 'medical' {
    if (!courseName) return 'medical';
    
    const name = courseName.toUpperCase();
    
    // Check DNB patterns first (most specific)
    const dnbPatterns = ['DNB-', 'DNB '];
    for (const pattern of dnbPatterns) {
      if (name.includes(pattern) || name.startsWith('DNB')) {
        return 'dnb';
      }
    }
    
    // Check dental patterns second
    // PG DIPLOMA should be checked for dental-specific content
    const dentalPatterns = [
      'BDS', 'MDS',
      'DENTAL', 'DENTISTRY',
      'PROSTHODONTIC', 'ORTHODONTIC', 'PERIODONTAL', 'PERIODONTOLOGY',
      'ENDODONTIC', 'ORAL SURGERY', 'ORAL MEDICINE', 'ORAL PATHOLOGY',
      'DENTOFACIAL', 'MAXILLOFACIAL'
    ];
    
    // Special handling for PG DIPLOMA - check if it contains dental keywords
    if (name.includes('PG DIPLOMA')) {
      for (const pattern of dentalPatterns) {
        if (name.includes(pattern)) {
          return 'dental';
        }
      }
      // PG DIPLOMA without dental keywords is medical
      return 'medical';
    }
    
    // Check for dental patterns in course name
    for (const pattern of dentalPatterns) {
      if (name.includes(pattern)) {
        return 'dental';
      }
    }
    
    // Default to medical (includes MBBS, MD, MS, MPH, DIPLOMA, DM, MCH, etc.)
    return 'medical';
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
