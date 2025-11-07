/**
 * React hook for cached cutoffs with minimal Worker usage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedCutoffsService } from '../services/CachedCutoffsService';

interface UseCachedCutoffsOptions {
  stream: string;
  year: number;
  autoPrefetch?: boolean;
  progressiveLoad?: boolean;
}

export function useCachedCutoffs({
  stream,
  year,
  autoPrefetch = true,
  progressiveLoad = false,
}: UseCachedCutoffsOptions) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    layer: '' as string,
  });

  const recentQueries = useRef<any[]>([]);

  const loadData = useCallback(async (options?: {
    round?: number;
    filters?: any;
    forceRefresh?: boolean;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const request = {
        stream,
        year,
        round: options?.round,
        filters: options?.filters,
      };

      // Add to recent queries for prefetch prediction
      recentQueries.current.push(request);
      if (recentQueries.current.length > 10) {
        recentQueries.current.shift();
      }

      const result = await cachedCutoffsService.query(request);

      // Update cache stats
      setCacheStats(prev => ({
        hits: result.cached ? prev.hits + 1 : prev.hits,
        misses: result.cached ? prev.misses : prev.misses + 1,
        layer: result.cacheLayer || '',
      }));

      setData(result.data);
      
      // Auto prefetch if enabled
      if (autoPrefetch && result.cached) {
        cachedCutoffsService.prefetch({
          stream,
          recentQueries: recentQueries.current,
        });
      }

      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [stream, year, autoPrefetch]);

  const loadProgressive = useCallback(async function* (
    options?: { round?: number; filters?: any }
  ) {
    const request = {
      stream,
      year,
      round: options?.round,
      filters: options?.filters,
    };

    yield* cachedCutoffsService.progressiveLoad(request);
  }, [stream, year]);

  const batchLoad = useCallback(async (
    requests: Array<{ round?: number; filters?: any }>
  ) => {
    try {
      setLoading(true);
      setError(null);

      const workerRequests = requests.map(req => ({
        stream,
        year,
        ...req,
      }));

      const results = await cachedCutoffsService.batchQuery(workerRequests);
      
      const allData: any[] = [];
      for (const data of results.values()) {
        allData.push(...data);
      }

      setData(allData);
      setLoading(false);
      
      return results;
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      throw err;
    }
  }, [stream, year]);

  // Auto-prefetch on mount
  useEffect(() => {
    if (autoPrefetch) {
      cachedCutoffsService.prefetch({
        stream,
        recentQueries: [],
      });
    }
  }, [stream, autoPrefetch]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    cacheStats,
    loadData,
    batchLoad,
    loadProgressive,
    refresh: () => loadData({ forceRefresh: true }),
  };
}

