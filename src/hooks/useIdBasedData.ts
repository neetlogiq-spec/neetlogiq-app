/**
 * React Hook for ID-Based Data Resolution
 *
 * This hook provides an easy way to fetch enriched data with master data names
 * while querying by IDs.
 *
 * Usage:
 * ```tsx
 * const { data, loading, error } = useIdBasedData({
 *   stream: 'UG',
 *   year: 2024,
 *   round: 1
 * });
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { getIdBasedDataService, EnrichedCutoffData } from '@/services/IdBasedDataService';
import { useStream } from '@/contexts/StreamContext';

interface UseIdBasedDataParams {
  stream: string;
  year: number;
  round: number;
  filters?: {
    college_id?: string;
    course_id?: string;
    category_id?: string;
    quota_id?: string;
    state_id?: string;
    rank?: { min?: number; max?: number };
  };
  enabled?: boolean; // Allow conditional fetching
}

interface UseIdBasedDataReturn {
  data: EnrichedCutoffData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useIdBasedData(params: UseIdBasedDataParams): UseIdBasedDataReturn {
  const [data, setData] = useState<EnrichedCutoffData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { selectedStream, isDeveloper } = useStream(); // Get selected stream and developer status

  const fetchData = useCallback(async () => {
    if (params.enabled === false) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getIdBasedDataService();
      // Pass selected stream and developer status for automatic filtering
      const result = await service.getEnrichedCutoffs({
        ...params,
        selectedStream,
        isDeveloper
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      console.error('Error fetching ID-based data:', err);
    } finally {
      setLoading(false);
    }
  }, [params.stream, params.year, params.round, JSON.stringify(params.filters), params.enabled, selectedStream, isDeveloper]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}

/**
 * Hook for fetching college details with linked data
 */
export function useCollegeDetails(college_id: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!college_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const service = getIdBasedDataService();
        const result = await service.getCollegeDetails(college_id);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch college details'));
        console.error('Error fetching college details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [college_id]);

  return { data, loading, error };
}

/**
 * Hook for comparing colleges
 */
export function useCompareColleges(college_ids: string[]) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (college_ids.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const service = getIdBasedDataService();
        const result = await service.compareColleges(college_ids);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to compare colleges'));
        console.error('Error comparing colleges:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [college_ids.join(',')]);

  return { data, loading, error };
}

/**
 * Hook for fetching college trends
 */
export function useCollegeTrends(college_id: string | null, years: number[]) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!college_id || years.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const service = getIdBasedDataService();
        const result = await service.getCollegeTrends(college_id, years);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch trends'));
        console.error('Error fetching trends:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [college_id, years.join(',')]);

  return { data, loading, error };
}

/**
 * Hook for searching colleges by name
 * Automatically filters by selected stream (unless developer account)
 */
export function useSearchColleges(query: string, stream?: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { selectedStream, streamConfig, isDeveloper } = useStream();

  const search = useCallback(async () => {
    if (!query || query.length < 2) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getIdBasedDataService();
      const results = await service.searchColleges(query, stream);

      // Filter by selected stream if configured (skip for developers)
      if (selectedStream && streamConfig && !isDeveloper) {
        const filtered = results.filter(college =>
          streamConfig.allowedStreams.includes(college.stream.toUpperCase())
        );
        setData(filtered);
      } else {
        // Developers see all results without filtering
        setData(results);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
      console.error('Error searching colleges:', err);
    } finally {
      setLoading(false);
    }
  }, [query, stream, selectedStream, streamConfig, isDeveloper]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [search]);

  return { data, loading, error };
}
