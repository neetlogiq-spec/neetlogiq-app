/**
 * React hook for static cutoffs with client-side filtering
 * No Cloudflare Workers needed!
 */

import { useState, useEffect, useCallback } from 'react';
import { staticCutoffsService, CutoffRecord, FilterOptions } from '../services/StaticCutoffsService';

export interface UseStaticCutoffsOptions {
  stream: string;
  autoLoad?: boolean;
  initialFilters?: FilterOptions;
}

export interface UseStaticCutoffsReturn {
  data: CutoffRecord[];
  loading: boolean;
  error: Error | null;
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  search: (term: string) => void;
  sort: (sortBy: string, order: 'asc' | 'desc') => void;
  loadMore: () => Promise<void>;
  clearFilters: () => void;
  statistics: {
    totalRecords: number;
    uniqueColleges: number;
    uniqueCourses: number;
    avgClosingRank: number;
    minClosingRank: number;
    maxClosingRank: number;
  };
}

export function useStaticCutoffs(options: UseStaticCutoffsOptions): UseStaticCutoffsReturn {
  const { stream, autoLoad = true, initialFilters = {} } = options;
  
  const [data, setData] = useState<CutoffRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('closing_rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loadedRounds, setLoadedRounds] = useState<number[]>([1, 2]);

  // Load initial data
  useEffect(() => {
    if (autoLoad) {
      loadInitialData();
    }
  }, [stream]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load priority rounds (1 & 2) - fast initial load (50-100 KB)
      const priorityData = await staticCutoffsService.loadPriorityRounds(stream);
      setData(priorityData);
      setLoadedRounds([1, 2]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load cutoffs data'));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    setLoading(true);

    try {
      // Load the next available round
      const nextRound = Math.max(...loadedRounds) + 1;
      const roundData = await staticCutoffsService.loadAdditionalRound(stream, nextRound);
      
      if (roundData.length > 0) {
        setData(prev => [...prev, ...roundData]);
        setLoadedRounds(prev => [...prev, nextRound]);
      }
    } catch (err) {
      setError(err instanceof Error ? error : new Error('Failed to load more data'));
    } finally {
      setLoading(false);
    }
  }, [stream, loadedRounds]);

  // Apply filters to data
  const applyFilters = useCallback(() => {
    let filtered = [...data];

    // Apply search
    if (searchTerm) {
      filtered = staticCutoffsService.searchCutoffs(filtered, searchTerm);
    }

    // Apply filters
    if (Object.keys(filters).length > 0) {
      filtered = staticCutoffsService.filterCutoffs(filtered, filters);
    }

    // Apply sorting
    filtered = staticCutoffsService.sortCutoffs(filtered, sortBy, sortOrder);

    return filtered;
  }, [data, searchTerm, filters, sortBy, sortOrder]);

  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const sort = useCallback((newSortBy: string, newOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newOrder);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
    setSortBy('closing_rank');
    setSortOrder('asc');
  }, []);

  // Get filtered and sorted data
  const filteredData = applyFilters();

  // Calculate statistics
  const statistics = staticCutoffsService.getStatistics(filteredData);

  return {
    data: filteredData,
    loading,
    error,
    filters,
    setFilters,
    search,
    sort,
    loadMore,
    clearFilters,
    statistics,
  };
}

