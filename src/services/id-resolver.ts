/**
 * ID Resolution Service
 *
 * Smart ID resolution with multiple fallback strategies:
 * 1. Direct ID lookup (UUID or TEXT)
 * 2. Composite key matching
 * 3. Fuzzy name matching
 * 4. Link table resolution
 *
 * Features:
 * - Automatic caching
 * - Multiple resolution strategies
 * - Type-safe results
 * - Performance monitoring
 */

import { supabase } from '@/lib/supabase';

// Cache for resolved IDs (in-memory, 15 minute TTL)
interface CacheEntry {
  id: string;
  timestamp: number;
  type: string;
}

const resolutionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Clean cache every 5 minutes (only in browser)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of resolutionCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        resolutionCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface ResolutionResult {
  id: string | null;
  name: string | null;
  type: 'college' | 'course' | 'cutoff' | 'state';
  method: 'direct' | 'composite' | 'fuzzy' | 'link_table' | 'not_found';
  confidence: number; // 0-1
  metadata?: Record<string, any>;
}

export interface ResolutionOptions {
  type: 'college' | 'course' | 'cutoff' | 'state';
  useCache?: boolean;
  fuzzyThreshold?: number; // 0-1, similarity threshold
  includeInactive?: boolean;
}

/**
 * Main ID resolution function
 */
export async function resolveId(
  identifier: string,
  options: ResolutionOptions
): Promise<ResolutionResult> {
  const { type, useCache = true, fuzzyThreshold = 0.7, includeInactive = false } = options;

  // Check cache first
  if (useCache) {
    const cached = getCachedResolution(identifier, type);
    if (cached) {
      return {
        ...cached,
        method: 'direct',
        confidence: 1.0,
      };
    }
  }

  // Strategy 1: Direct ID lookup
  const directResult = await resolveDirectId(identifier, type, includeInactive);
  if (directResult) {
    cacheResolution(identifier, type, directResult.id, directResult.name);
    return directResult;
  }

  // Strategy 2: Composite key matching
  const compositeResult = await resolveCompositeKey(identifier, type);
  if (compositeResult && compositeResult.confidence >= fuzzyThreshold) {
    cacheResolution(identifier, type, compositeResult.id!, compositeResult.name!);
    return compositeResult;
  }

  // Strategy 3: Fuzzy name matching
  const fuzzyResult = await resolveFuzzyMatch(identifier, type, fuzzyThreshold);
  if (fuzzyResult && fuzzyResult.confidence >= fuzzyThreshold) {
    cacheResolution(identifier, type, fuzzyResult.id!, fuzzyResult.name!);
    return fuzzyResult;
  }

  // Strategy 4: Link table resolution
  const linkResult = await resolveLinkTable(identifier, type);
  if (linkResult && linkResult.confidence >= fuzzyThreshold) {
    cacheResolution(identifier, type, linkResult.id!, linkResult.name!);
    return linkResult;
  }

  // Not found
  return {
    id: null,
    name: null,
    type,
    method: 'not_found',
    confidence: 0,
  };
}

/**
 * Strategy 1: Direct ID lookup
 */
async function resolveDirectId(
  id: string,
  type: ResolutionOptions['type'],
  includeInactive: boolean
): Promise<ResolutionResult | null> {
  try {
    let query = supabase.from(getTableName(type)).select('id, name').eq('id', id);

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      type,
      method: 'direct',
      confidence: 1.0,
    };
  } catch (error) {
    console.error('Direct ID lookup error:', error);
    return null;
  }
}

/**
 * Strategy 2: Composite key matching
 */
async function resolveCompositeKey(
  identifier: string,
  type: ResolutionOptions['type']
): Promise<ResolutionResult | null> {
  if (type !== 'college') return null; // Only colleges have composite keys in link tables

  try {
    const { data, error } = await supabase
      .from('state_college_link')
      .select('college_id, college_name, composite_college_key')
      .eq('composite_college_key', identifier.toLowerCase().trim())
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.college_id,
      name: data.college_name,
      type: 'college',
      method: 'composite',
      confidence: 0.95,
      metadata: {
        composite_key: data.composite_college_key,
      },
    };
  } catch (error) {
    console.error('Composite key lookup error:', error);
    return null;
  }
}

/**
 * Strategy 3: Fuzzy name matching using PostgreSQL similarity
 */
async function resolveFuzzyMatch(
  name: string,
  type: ResolutionOptions['type'],
  threshold: number
): Promise<ResolutionResult | null> {
  try {
    const tableName = getTableName(type);

    // Use PostgreSQL trigram similarity
    const { data, error } = await supabase.rpc('fuzzy_search_' + type, {
      search_term: name,
      similarity_threshold: threshold,
    });

    if (error) {
      // Fallback to ILIKE if RPC function doesn't exist
      const { data: fallbackData } = await supabase
        .from(tableName)
        .select('id, name')
        .ilike('name', `%${name}%`)
        .limit(1)
        .maybeSingle();

      if (!fallbackData) return null;

      return {
        id: fallbackData.id,
        name: fallbackData.name,
        type,
        method: 'fuzzy',
        confidence: 0.8, // Lower confidence for ILIKE
      };
    }

    if (!data || data.length === 0) return null;

    const best = data[0];
    return {
      id: best.id,
      name: best.name,
      type,
      method: 'fuzzy',
      confidence: best.similarity || 0.8,
      metadata: {
        matches: data.length,
      },
    };
  } catch (error) {
    console.error('Fuzzy match error:', error);
    return null;
  }
}

/**
 * Strategy 4: Link table resolution
 */
async function resolveLinkTable(
  name: string,
  type: ResolutionOptions['type']
): Promise<ResolutionResult | null> {
  if (type === 'college') {
    try {
      const { data, error } = await supabase
        .from('state_college_link')
        .select('college_id, college_name, state')
        .ilike('college_name', `%${name}%`)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.college_id,
        name: data.college_name,
        type: 'college',
        method: 'link_table',
        confidence: 0.85,
        metadata: {
          state: data.state,
        },
      };
    } catch (error) {
      console.error('Link table resolution error:', error);
      return null;
    }
  } else if (type === 'course') {
    try {
      const { data, error } = await supabase
        .from('state_course_college_link')
        .select('course_id, stream')
        .ilike('stream', `%${name}%`)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.course_id,
        name: data.stream,
        type: 'course',
        method: 'link_table',
        confidence: 0.85,
      };
    } catch (error) {
      console.error('Link table resolution error:', error);
      return null;
    }
  }

  return null;
}

/**
 * Batch ID resolution
 */
export async function resolveBatchIds(
  identifiers: string[],
  options: ResolutionOptions
): Promise<Map<string, ResolutionResult>> {
  const results = new Map<string, ResolutionResult>();

  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < identifiers.length; i += batchSize) {
    const batch = identifiers.slice(i, i + batchSize);
    const promises = batch.map(id => resolveId(id, options));
    const batchResults = await Promise.all(promises);

    batch.forEach((id, index) => {
      results.set(id, batchResults[index]);
    });
  }

  return results;
}

/**
 * Validate ID-name consistency
 */
export async function validateIdNameConsistency(
  id: string,
  name: string,
  type: ResolutionOptions['type']
): Promise<{
  isValid: boolean;
  actualName?: string;
  confidence: number;
}> {
  const result = await resolveDirectId(id, type, true);

  if (!result) {
    return { isValid: false, confidence: 0 };
  }

  const nameSimilarity = calculateSimilarity(name.toLowerCase(), result.name!.toLowerCase());

  return {
    isValid: nameSimilarity > 0.9,
    actualName: result.name!,
    confidence: nameSimilarity,
  };
}

/**
 * Get related IDs (using link tables)
 */
export async function getRelatedIds(
  id: string,
  type: ResolutionOptions['type'],
  relationType: 'courses' | 'colleges' | 'cutoffs' | 'states'
): Promise<string[]> {
  try {
    if (type === 'college' && relationType === 'courses') {
      // Get courses offered by this college
      const { data } = await supabase
        .from('courses')
        .select('id')
        .eq('college_id', id);

      return data?.map(c => c.id) || [];
    } else if (type === 'college' && relationType === 'states') {
      // Get states where this college operates
      const { data } = await supabase
        .from('state_college_link')
        .select('state_id')
        .eq('college_id', id);

      return data?.map(s => s.state_id) || [];
    } else if (type === 'course' && relationType === 'colleges') {
      // Get colleges offering this course
      const { data } = await supabase
        .from('state_course_college_link')
        .select('college_id')
        .eq('course_id', id);

      return [...new Set(data?.map(c => c.college_id) || [])];
    }

    return [];
  } catch (error) {
    console.error('Get related IDs error:', error);
    return [];
  }
}

// ==================== HELPER FUNCTIONS ====================

function getTableName(type: ResolutionOptions['type']): string {
  const tableMap = {
    college: 'colleges',
    course: 'courses',
    cutoff: 'cutoffs',
    state: 'states',
  };
  return tableMap[type];
}

function getCachedResolution(identifier: string, type: string): CacheEntry | null {
  const key = `${type}:${identifier}`;
  const entry = resolutionCache.get(key);

  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    resolutionCache.delete(key);
    return null;
  }

  return entry;
}

function cacheResolution(identifier: string, type: string, id: string, name: string): void {
  const key = `${type}:${identifier}`;
  resolutionCache.set(key, {
    id,
    type,
    timestamp: Date.now(),
  });
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Clear resolution cache
 */
export function clearResolutionCache(): void {
  resolutionCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  size: number;
  oldestEntry: number;
  newestEntry: number;
} {
  let oldest = Date.now();
  let newest = 0;

  for (const entry of resolutionCache.values()) {
    if (entry.timestamp < oldest) oldest = entry.timestamp;
    if (entry.timestamp > newest) newest = entry.timestamp;
  }

  return {
    size: resolutionCache.size,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}
