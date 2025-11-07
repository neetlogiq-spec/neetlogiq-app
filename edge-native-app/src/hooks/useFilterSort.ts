import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortField = string;

export interface FilterConfig {
  status?: 'matched' | 'unmatched' | 'all';
  minConfidence?: number;
  maxConfidence?: number;
  matchMethods?: string[];
  searchQuery?: string;
}

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function useFilterSort<T extends Record<string, any>>(
  data: T[],
  defaultSort: SortConfig = { field: 'id', direction: 'asc' }
) {
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    status: 'all',
    minConfidence: 0,
    maxConfidence: 100
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSort);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    if (filterConfig.status && filterConfig.status !== 'all') {
      result = result.filter(item => item.status === filterConfig.status);
    }

    if (filterConfig.minConfidence !== undefined) {
      result = result.filter(item => {
        const confidence = item.match_confidence || 0;
        return confidence * 100 >= filterConfig.minConfidence!;
      });
    }

    if (filterConfig.maxConfidence !== undefined) {
      result = result.filter(item => {
        const confidence = item.match_confidence || 0;
        return confidence * 100 <= filterConfig.maxConfidence!;
      });
    }

    if (filterConfig.matchMethods && filterConfig.matchMethods.length > 0) {
      result = result.filter(item =>
        filterConfig.matchMethods!.includes(item.match_method)
      );
    }

    if (filterConfig.searchQuery) {
      const query = filterConfig.searchQuery.toLowerCase();
      result = result.filter(item => {
        return Object.values(item).some(value =>
          String(value).toLowerCase().includes(query)
        );
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      let comparison = 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue === null || aValue === undefined) {
        comparison = 1;
      } else if (bValue === null || bValue === undefined) {
        comparison = -1;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [data, filterConfig, sortConfig]);

  const updateFilter = (updates: Partial<FilterConfig>) => {
    setFilterConfig(prev => ({ ...prev, ...updates }));
  };

  const updateSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction:
        prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const resetFilters = () => {
    setFilterConfig({
      status: 'all',
      minConfidence: 0,
      maxConfidence: 100
    });
  };

  const resetSort = () => {
    setSortConfig(defaultSort);
  };

  return {
    filteredData: filteredAndSortedData,
    filterConfig,
    sortConfig,
    updateFilter,
    updateSort,
    resetFilters,
    resetSort,
    activeFilterCount: Object.values(filterConfig).filter(v => v !== undefined && v !== 'all').length
  };
}
