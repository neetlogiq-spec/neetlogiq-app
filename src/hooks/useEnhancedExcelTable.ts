import { useState, useEffect, useCallback, useMemo } from 'react';
import { CutoffRecord } from '@/types/data';
import { enhancedDataProcessor } from '@/services/EnhancedDataProcessor';

interface UseEnhancedExcelTableOptions {
  initialData: CutoffRecord[];
  enableWebAssembly?: boolean;
  enableVirtualization?: boolean;
  enableAI?: boolean;
  pageSize?: number;
}

interface UseEnhancedExcelTableReturn {
  // Data
  data: CutoffRecord[];
  filteredData: CutoffRecord[];
  selectedRows: Set<string>;
  
  // Loading states
  isLoading: boolean;
  isProcessing: boolean;
  
  // Statistics
  statistics: {
    totalRecords: number;
    filteredRecords: number;
    processingTime: number;
    memoryUsage: number;
  };
  
  // Insights
  insights: {
    trends: {
      up: number;
      down: number;
      stable: number;
    };
    predictions: {
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
    };
    recommendations: CutoffRecord[];
  };
  
  // Actions
  setSearchQuery: (query: string) => void;
  setFilters: (filters: any[]) => void;
  setSorting: (column: string, direction: 'asc' | 'desc') => void;
  setSelectedRows: (rows: Set<string>) => void;
  selectAll: () => void;
  clearSelection: () => void;
  exportData: (format: 'csv' | 'excel' | 'json' | 'parquet') => Promise<void>;
  refreshData: () => Promise<void>;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

export const useEnhancedExcelTable = ({
  initialData,
  enableWebAssembly = true,
  enableVirtualization = true,
  enableAI = true,
  pageSize = 50
}: UseEnhancedExcelTableOptions): UseEnhancedExcelTableReturn => {
  
  // State management
  const [data, setData] = useState<CutoffRecord[]>(initialData);
  const [filteredData, setFilteredData] = useState<CutoffRecord[]>(initialData);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<any[]>([]);
  const [sorting, setSorting] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Statistics and insights
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    filteredRecords: 0,
    processingTime: 0,
    memoryUsage: 0
  });
  
  const [insights, setInsights] = useState({
    trends: { up: 0, down: 0, stable: 0 },
    predictions: { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 },
    recommendations: [] as CutoffRecord[]
  });

  // Process data when filters change
  useEffect(() => {
    const processData = async () => {
      if (data.length === 0) return;
      
      setIsProcessing(true);
      setError(null);
      
      try {
        const options = {
          searchQuery: searchQuery || undefined,
          sortBy: sorting?.column,
          sortDirection: sorting?.direction,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize
        };
        
        const result = await enhancedDataProcessor.processData(data, options);
        
        setFilteredData(result.data);
        setStatistics(result.statistics);
        setInsights(result.insights);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process data');
        console.error('Data processing error:', err);
      } finally {
        setIsProcessing(false);
      }
    };
    
    processData();
  }, [data, searchQuery, filters, sorting, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(statistics.filteredRecords / pageSize);
  }, [statistics.filteredRecords, pageSize]);

  // Handle search
  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  // Handle filters
  const handleSetFilters = useCallback((newFilters: any[]) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Handle sorting
  const handleSetSorting = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSorting({ column, direction });
    setCurrentPage(1); // Reset to first page when sorting
  }, []);

  // Handle row selection
  const handleSetSelectedRows = useCallback((rows: Set<string>) => {
    setSelectedRows(rows);
  }, []);

  // Select all rows
  const selectAll = useCallback(() => {
    const allRowIds = new Set(filteredData.map(row => row.id));
    setSelectedRows(allRowIds);
  }, [filteredData]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  // Export data
  const exportData = useCallback(async (format: 'csv' | 'excel' | 'json' | 'parquet') => {
    setIsLoading(true);
    setError(null);
    
    try {
      const selectedData = selectedRows.size > 0 
        ? filteredData.filter(row => selectedRows.has(row.id))
        : filteredData;
      
      const blob = await enhancedDataProcessor.exportData(selectedData, format);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cutoffs_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filteredData, selectedRows]);

  // Refresh data
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Re-process current data
      const options = {
        searchQuery: searchQuery || undefined,
        sortBy: sorting?.column,
        sortDirection: sorting?.direction,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      };
      
      const result = await enhancedDataProcessor.processData(data, options);
      
      setFilteredData(result.data);
      setStatistics(result.statistics);
      setInsights(result.insights);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
      console.error('Refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [data, searchQuery, sorting, currentPage, pageSize]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle page change
  const handleSetCurrentPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  return {
    // Data
    data,
    filteredData,
    selectedRows,
    
    // Loading states
    isLoading,
    isProcessing,
    
    // Statistics
    statistics,
    
    // Insights
    insights,
    
    // Actions
    setSearchQuery: handleSetSearchQuery,
    setFilters: handleSetFilters,
    setSorting: handleSetSorting,
    setSelectedRows: handleSetSelectedRows,
    selectAll,
    clearSelection,
    exportData,
    refreshData,
    
    // Pagination
    currentPage,
    totalPages,
    setCurrentPage: handleSetCurrentPage,
    
    // Error handling
    error,
    clearError
  };
};

export default useEnhancedExcelTable;
