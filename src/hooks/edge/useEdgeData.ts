// useEdgeData - React hook for EdgeDataService integration
// This hook provides a clean interface for components to access edge data

import { useState, useEffect, useCallback } from 'react';
import { edgeDataService } from '@/services/edge/EdgeDataService';
import { CutoffRecord, MasterData, CutoffFilters } from '@/types/edge/data';

interface UseEdgeDataReturn {
  cutoffs: CutoffRecord[];
  masterData: MasterData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  searchCutoffs: (query: string, limit?: number) => Promise<CutoffRecord[]>;
}

export function useEdgeData(filters: CutoffFilters = {}): UseEdgeDataReturn {
  const [cutoffs, setCutoffs] = useState<CutoffRecord[]>([]);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load cutoffs and master data in parallel
      const [cutoffsData, masterDataResult] = await Promise.all([
        edgeDataService.getCutoffs(filters),
        edgeDataService.getMasterData()
      ]);
      
      setCutoffs(cutoffsData);
      setMasterData(masterDataResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Error loading edge data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const searchCutoffs = useCallback(async (query: string, limit: number = 10): Promise<CutoffRecord[]> => {
    try {
      return await edgeDataService.searchCutoffs(query, limit);
    } catch (err) {
      console.error('Error searching cutoffs:', err);
      return [];
    }
  }, []);

  const refetch = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Initialize service on mount
  useEffect(() => {
    edgeDataService.init().catch(err => {
      console.error('Failed to initialize EdgeDataService:', err);
    });
  }, []);

  return {
    cutoffs,
    masterData,
    loading,
    error,
    refetch,
    searchCutoffs,
  };
}

// Hook for specific data types
export function useCutoffsData(filters: CutoffFilters = {}) {
  const { cutoffs, loading, error, refetch } = useEdgeData(filters);
  
  return {
    cutoffs,
    loading,
    error,
    refetch,
  };
}

export function useMasterData() {
  const { masterData, loading, error, refetch } = useEdgeData({});
  
  return {
    masterData,
    loading,
    error,
    refetch,
  };
}
