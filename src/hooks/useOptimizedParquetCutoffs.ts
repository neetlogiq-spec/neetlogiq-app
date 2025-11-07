/**
 * React hook for Optimized Parquet + DuckDB-WASM
 */

import { useState, useEffect, useCallback } from 'react';
import { optimizedParquetService } from '../services/OptimizedParquetCutoffsService';

export function useOptimizedParquetCutoffs(stream: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 1. Initialize DuckDB lazily
  const initialize = useCallback(async () => {
    setInitializing(true);
    try {
      await optimizedParquetService.initialize();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initialize DuckDB'));
    } finally {
      setInitializing(false);
    }
  }, []);

  // 2. Load priority rounds first (fast)
  const loadPriorityRounds = useCallback(async () => {
    setLoading(true);
    try {
      const result = await optimizedParquetService.loadPriorityThenExpand(stream);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [stream]);

  // 3. Filter with DuckDB
  const filter = useCallback(async (filters: any) => {
    if (!optimizedParquetService) {
      await initialize();
    }
    
    setLoading(true);
    try {
      const result = await optimizedParquetService.fastFilter(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to filter data'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-initialize and load on mount
  useEffect(() => {
    initialize().then(() => {
      loadPriorityRounds();
    });
  }, [initialize, loadPriorityRounds]);

  return { data, loading: loading || initializing, error, filter };
}
