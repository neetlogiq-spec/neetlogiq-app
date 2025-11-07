// useVectorSearch - React hook for VectorSearchService integration
// This hook provides AI-powered semantic search capabilities

import { useState, useCallback } from 'react';
import { vectorSearchService } from '@/services/VectorSearchService';
import { CutoffRecord } from '@/types/data';

interface SearchResult {
  record: CutoffRecord;
  similarity: number;
  score: number;
}

interface UseVectorSearchReturn {
  searchColleges: (query: string, limit?: number) => Promise<SearchResult[]>;
  searchCutoffs: (query: string, filters: CutoffFilters, limit?: number) => Promise<SearchResult[]>;
  processNaturalLanguageQuery: (query: string) => Promise<{
    intent: string;
    entities: string[];
    filters: CutoffFilters;
  }>;
  loading: boolean;
  error: string | null;
}

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

export function useVectorSearch(): UseVectorSearchReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchColleges = useCallback(async (query: string, limit: number = 10): Promise<SearchResult[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await vectorSearchService.searchColleges(query, limit);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search colleges';
      setError(errorMessage);
      console.error('Error searching colleges:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchCutoffs = useCallback(async (
    query: string, 
    filters: CutoffFilters, 
    limit: number = 10
  ): Promise<SearchResult[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await vectorSearchService.searchCutoffs(query, filters, limit);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search cutoffs';
      setError(errorMessage);
      console.error('Error searching cutoffs:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const processNaturalLanguageQuery = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);

      const result = await vectorSearchService.processNaturalLanguageQuery(query);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process query';
      setError(errorMessage);
      console.error('Error processing natural language query:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchColleges,
    searchCutoffs,
    processNaturalLanguageQuery,
    loading,
    error,
  };
}

// Hook for AI-powered search with automatic query processing
export function useAISearch() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async (
    query: string, 
    filters: CutoffFilters = {}, 
    limit: number = 10
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Process natural language query
      const processedQuery = await vectorSearchService.processNaturalLanguageQuery(query);
      
      // Perform search with processed query
      const results = await vectorSearchService.searchCutoffs(
        processedQuery.entities.join(' '), 
        { ...filters, ...processedQuery.filters }, 
        limit
      );
      
      setSearchResults(results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to perform AI search';
      setError(errorMessage);
      console.error('Error performing AI search:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    searchResults,
    loading,
    error,
    performSearch,
    clearResults,
  };
}

// Hook for trend analysis
export function useAITrendAnalysis() {
  const [trends, setTrends] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeTrends = useCallback(async (data: CutoffRecord[]) => {
    try {
      setLoading(true);
      setError(null);

      // Simple trend analysis (in production, this would use ML models)
      const trendMap = new Map();
      
      // Group by college and course
      const grouped = data.reduce((acc, record) => {
        const key = `${record.college_id}_${record.course_id}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(record);
        return acc;
      }, {} as Record<string, CutoffRecord[]>);

      // Calculate trends for each group
      for (const [key, records] of Object.entries(grouped)) {
        if (records.length > 1) {
          const sorted = records.sort((a, b) => a.year - b.year);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          
          const trend = {
            direction: last.closing_rank < first.closing_rank ? 'down' : 'up',
            change: Math.abs(last.closing_rank - first.closing_rank),
            confidence: Math.min(records.length / 5, 1), // Simple confidence calculation
          };
          
          trendMap.set(key, trend);
        }
      }
      
      setTrends(trendMap);
      return trendMap;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze trends';
      setError(errorMessage);
      console.error('Error analyzing trends:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    trends,
    loading,
    error,
    analyzeTrends,
  };
}
