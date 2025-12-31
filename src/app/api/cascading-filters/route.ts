import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// In-memory cache for cascading filter options
const cascadingCache = new Map<string, {
  data: {
    courses: string[];
    states: string[];
    quotas: string[];
    categories: string[];
    managements: string[];
  };
  timestamp: number;
}>();

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Generate cache key from filter parameters
 */
function getCacheKey(partitionKey: string, state?: string, course?: string, management?: string): string {
  return `${partitionKey}:${state || 'all'}:${course || 'all'}:${management || 'all'}`;
}

/**
 * GET /api/cascading-filters
 * Returns filtered options based on current selections
 * Uses aggregated_cutoffs as source of truth (now includes management column)
 * 
 * Query params:
 * - partition_key: required (e.g., AIQ-PG-2024)
 * - state: filter by state
 * - course: filter by course
 * - management: filter by management type
 * - refresh: force refresh cache
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const partitionKey = searchParams.get('partition_key') || 'AIQ-PG-2024';
    const selectedState = searchParams.get('state');
    const selectedCourse = searchParams.get('course');
    const selectedManagement = searchParams.get('management');
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    const cacheKey = getCacheKey(partitionKey, selectedState || undefined, selectedCourse || undefined, selectedManagement || undefined);
    const now = Date.now();
    
    // Check cache
    const cached = cascadingCache.get(cacheKey);
    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      console.log(`[cascading-filters] CACHE HIT: ${cacheKey} (${Math.round((now - cached.timestamp) / 1000)}s old)`);
      return NextResponse.json({
        success: true,
        data: cached.data,
        filters: { partitionKey, state: selectedState, course: selectedCourse, management: selectedManagement },
        cached: true,
        cacheAge: Math.round((now - cached.timestamp) / 1000)
      });
    }
    
    console.log(`[cascading-filters] CACHE MISS: ${cacheKey} - fetching from DB...`);
    
    const result: {
      courses: string[];
      states: string[];
      quotas: string[];
      categories: string[];
      managements: string[];
    } = {
      courses: [],
      states: [],
      quotas: [],
      categories: [],
      managements: []
    };
    
    // Build filter conditions
    let stateId: string | null = null;
    let courseId: string | null = null;
    
    // Get state ID if state filter is provided
    if (selectedState && selectedState !== 'all') {
      const { data: stateData } = await supabase
        .from('states')
        .select('id')
        .ilike('name', selectedState)
        .maybeSingle();
      stateId = stateData?.id || null;
    }
    
    // Get course ID if course filter is provided
    if (selectedCourse && selectedCourse !== 'all') {
      const { data: courseData } = await supabase
        .from('courses')
        .select('id')
        .ilike('name', selectedCourse)
        .maybeSingle();
      courseId = courseData?.id || null;
    }
    
    // Fetch with pagination to get all distinct values
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    const courseIds = new Set<string>();
    const stateIds = new Set<string>();
    const quotaIds = new Set<string>();
    const categoryIds = new Set<string>();
    const managements = new Set<string>();
    
    while (hasMore) {
      let query = supabase
        .from('aggregated_cutoffs')
        .select('master_course_id, master_state_id, master_quota_id, master_category_id, management')
        .eq('partition_key', partitionKey);
      
      // Apply filters
      if (stateId) {
        query = query.eq('master_state_id', stateId);
      }
      if (courseId) {
        query = query.eq('master_course_id', courseId);
      }
      if (selectedManagement && selectedManagement !== 'all') {
        query = query.eq('management', selectedManagement);
      }
      
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      
      if (error) {
        console.error('Cascading filters query error:', error);
        break;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        data.forEach(row => {
          if (row.master_course_id) courseIds.add(row.master_course_id);
          if (row.master_state_id) stateIds.add(row.master_state_id);
          if (row.master_quota_id) quotaIds.add(row.master_quota_id);
          if (row.master_category_id) categoryIds.add(row.master_category_id);
          // Add management (filter out '-' placeholder)
          if (row.management && row.management !== '-') {
            managements.add(row.management);
          }
        });
        offset += pageSize;
        hasMore = data.length === pageSize;
      }
    }
    
    // Lookup names from master tables
    const [coursesData, statesData, quotasData, categoriesData] = await Promise.all([
      courseIds.size > 0 
        ? supabase.from('courses').select('name').in('id', [...courseIds]).order('name')
        : Promise.resolve({ data: [] }),
      stateIds.size > 0 
        ? supabase.from('states').select('name').in('id', [...stateIds]).order('name')
        : Promise.resolve({ data: [] }),
      quotaIds.size > 0 
        ? supabase.from('quotas').select('name').in('id', [...quotaIds]).order('name')
        : Promise.resolve({ data: [] }),
      categoryIds.size > 0 
        ? supabase.from('categories').select('name').in('id', [...categoryIds]).order('name')
        : Promise.resolve({ data: [] })
    ]);
    
    result.courses = (coursesData.data || []).map(c => c.name).filter(Boolean);
    result.states = (statesData.data || []).map(s => s.name).filter(Boolean);
    result.quotas = (quotasData.data || []).map(q => q.name).filter(Boolean);
    result.categories = (categoriesData.data || []).map(c => c.name).filter(Boolean);
    result.managements = [...managements].sort(); // Direct values from aggregated_cutoffs
    
    // Store in cache
    cascadingCache.set(cacheKey, {
      data: result,
      timestamp: now
    });
    
    console.log(`[cascading-filters] CACHED: ${cacheKey}`, {
      courses: result.courses.length,
      states: result.states.length,
      quotas: result.quotas.length,
      categories: result.categories.length,
      managements: result.managements.length
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      filters: { partitionKey, state: selectedState, course: selectedCourse, management: selectedManagement },
      cached: false
    });
    
  } catch (error) {
    console.error('Cascading filters error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get cascading filter options'
    }, { status: 500 });
  }
}

// POST to clear cache
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { partitionKey, clearAll } = body;
    
    if (clearAll) {
      cascadingCache.clear();
      console.log('[cascading-filters] All caches cleared');
    } else if (partitionKey) {
      for (const key of cascadingCache.keys()) {
        if (key.startsWith(partitionKey)) {
          cascadingCache.delete(key);
        }
      }
      console.log(`[cascading-filters] Cache cleared for partition: ${partitionKey}`);
    }
    
    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to clear cache' }, { status: 500 });
  }
}
