// useEdgeData - React hook for EdgeDataService integration
// This hook provides a clean interface for components to access edge data

import { useState, useEffect, useCallback } from 'react';
import { edgeDataService } from '@/services/EdgeDataService';
import { CutoffRecord, MasterData } from '@/types/data';

interface CutoffFilters {
  college_id?: string;
  course_id?: string;
  category_id?: string;
  state_id?: string;
  year?: number;
  round?: number;
  min_rank?: number;
  max_rank?: number;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load cutoffs and master data in parallel
      const [cutoffsData, masterDataResult] = await Promise.all([
        edgeDataService.getCutoffs(filters),
        edgeDataService.getMasterData(),
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
      throw err;
    }
  }, []);

  const refetch = useCallback(async () => {
    await loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
  const [cutoffs, setCutoffs] = useState<CutoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCutoffs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await edgeDataService.getCutoffs(filters);
      setCutoffs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cutoffs');
      console.error('Error loading cutoffs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCutoffs();
  }, [loadCutoffs]);

  return {
    cutoffs,
    loading,
    error,
    refetch: loadCutoffs,
  };
}

export function useMasterData() {
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMasterData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await edgeDataService.getMasterData();
      setMasterData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master data');
      console.error('Error loading master data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  return {
    masterData,
    loading,
    error,
    refetch: loadMasterData,
  };
}
