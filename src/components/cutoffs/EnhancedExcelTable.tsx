'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  GraduationCap, 
  MapPin, 
  Award, 
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  Download,
  RefreshCw,
  Settings,
  Zap
} from 'lucide-react';

interface CutoffRecord {
  id: string;
  college: string;
  course: string;
  stream: string;
  state: string;
  counsellingBody: string;
  collegeType: string;
  year: number;
  quota: string;
  category: string;
  rounds: { [round: number]: { openingRank: number; closingRank: number; totalSeats: number } };
  totalSeats: number;
  // AI-enhanced fields
  predictionScore?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  recommendationRank?: number;
  embedding?: number[];
}

interface EnhancedExcelTableProps {
  data: CutoffRecord[];
  isDarkMode: boolean;
  onRowClick?: (cutoff: CutoffRecord) => void;
  onDataChange?: (data: CutoffRecord[]) => void;
}

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'array';
  sortable: boolean;
  filterable: boolean;
  width?: number;
  fixed?: boolean;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  column: string;
  operator: 'equals' | 'contains' | 'range' | 'in';
  value: any;
}

const EnhancedExcelTable: React.FC<EnhancedExcelTableProps> = ({
  data,
  isDarkMode,
  onRowClick,
  onDataChange
}) => {
  // State management
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [virtualization, setVirtualization] = useState(true);
  
  // Performance optimization
  const [visibleRows, setVisibleRows] = useState(50);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Define columns with enhanced features
  const columns: Column[] = useMemo(() => [
    { key: 'college', label: 'College', type: 'text', sortable: true, filterable: true, width: 200, fixed: true },
    { key: 'course', label: 'Course', type: 'text', sortable: true, filterable: true, width: 150 },
    { key: 'stream', label: 'Stream', type: 'text', sortable: true, filterable: true, width: 100 },
    { key: 'state', label: 'State', type: 'text', sortable: true, filterable: true, width: 120 },
    { key: 'category', label: 'Category', type: 'text', sortable: true, filterable: true, width: 100 },
    { key: 'quota', label: 'Quota', type: 'text', sortable: true, filterable: true, width: 100 },
    { key: 'year', label: 'Year', type: 'number', sortable: true, filterable: true, width: 80 },
    { key: 'totalSeats', label: 'Total Seats', type: 'number', sortable: true, filterable: true, width: 100 },
    // Round columns (dynamic)
    ...Object.keys(data[0]?.rounds || {}).flatMap(round => [
      { key: `r${round}_opening`, label: `R${round} Opening`, type: 'number', sortable: true, filterable: true, width: 120 },
      { key: `r${round}_closing`, label: `R${round} Closing`, type: 'number', sortable: true, filterable: true, width: 120 },
      { key: `r${round}_range`, label: `R${round} Range`, type: 'number', sortable: true, filterable: true, width: 100 }
    ]),
    // AI-enhanced columns
    { key: 'predictionScore', label: 'AI Score', type: 'number', sortable: true, filterable: true, width: 100 },
    { key: 'trendDirection', label: 'Trend', type: 'text', sortable: true, filterable: true, width: 80 },
    { key: 'recommendationRank', label: 'AI Rank', type: 'number', sortable: true, filterable: true, width: 100 }
  ], [data]);

  // Transform data for display
  const transformedData = useMemo(() => {
    return data.map(cutoff => {
      const baseData = {
        id: cutoff.id,
        college: cutoff.college,
        course: cutoff.course,
        stream: cutoff.stream,
        state: cutoff.state,
        counsellingBody: cutoff.counsellingBody,
        collegeType: cutoff.collegeType,
        year: cutoff.year,
        quota: cutoff.quota,
        category: cutoff.category,
        totalSeats: cutoff.totalSeats,
        predictionScore: cutoff.predictionScore,
        trendDirection: cutoff.trendDirection,
        recommendationRank: cutoff.recommendationRank
      };

      // Add round data
      const roundData: any = {};
      Object.keys(cutoff.rounds).forEach(round => {
        const roundInfo = cutoff.rounds[parseInt(round)];
        if (roundInfo) {
          roundData[`r${round}_opening`] = roundInfo.openingRank;
          roundData[`r${round}_closing`] = roundInfo.closingRank;
          roundData[`r${round}_range`] = roundInfo.closingRank - roundInfo.openingRank;
        }
      });

      return { ...baseData, ...roundData };
    });
  }, [data]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortConfig) return transformedData;

    return [...transformedData].sort((a, b) => {
      const aValue = a[sortConfig.column];
      const bValue = b[sortConfig.column];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  }, [transformedData, sortConfig]);

  // Apply filters
  const filteredData = useMemo(() => {
    let result = sortedData;

    // Apply search query
    if (searchQuery) {
      result = result.filter(row => 
        Object.values(row).some(value => 
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Apply column filters
    filters.forEach(filter => {
      result = result.filter(row => {
        const value = row[filter.column];
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'range':
            return value >= filter.value.min && value <= filter.value.max;
          case 'in':
            return filter.value.includes(value);
          default:
            return true;
        }
      });
    });

    return result;
  }, [sortedData, searchQuery, filters]);

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    setSortConfig(prev => {
      if (prev?.column === column) {
        return prev.direction === 'asc' 
          ? { column, direction: 'desc' as const }
          : null;
      }
      return { column, direction: 'asc' as const };
    });
  }, []);

  // Handle filtering
  const handleFilter = useCallback((column: string, operator: FilterConfig['operator'], value: any) => {
    setFilters(prev => {
      const existing = prev.filter(f => f.column !== column);
      if (value !== null && value !== undefined && value !== '') {
        return [...existing, { column, operator, value }];
      }
      return existing;
    });
  }, []);

  // Handle row selection
  const handleRowSelect = useCallback((rowId: string, selected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(rowId);
      } else {
        newSet.delete(rowId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedRows(new Set(filteredData.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  }, [filteredData]);

  // Export functionality
  const handleExport = useCallback(async (format: 'csv' | 'excel' | 'json') => {
    setIsLoading(true);
    try {
      // Use WebAssembly for high-performance export
      const exportData = filteredData.map(row => ({
        ...row,
        selected: selectedRows.has(row.id)
      }));

      // Simulate WebAssembly export
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`Exporting ${exportData.length} rows as ${format}`);
      // Actual export logic would go here
    } finally {
      setIsLoading(false);
    }
  }, [filteredData, selectedRows]);

  // AI-powered insights
  const aiInsights = useMemo(() => {
    const totalRows = filteredData.length;
    const avgSeats = filteredData.reduce((sum, row) => sum + (row.totalSeats || 0), 0) / totalRows;
    const trendingUp = filteredData.filter(row => row.trendDirection === 'up').length;
    const trendingDown = filteredData.filter(row => row.trendDirection === 'down').length;
    
    return {
      totalRows,
      avgSeats: Math.round(avgSeats),
      trendingUp,
      trendingDown,
      stable: totalRows - trendingUp - trendingDown
    };
  }, [filteredData]);

  return (
    <div className={`enhanced-excel-table ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header with AI Insights */}
      <div className={`sticky top-0 z-50 p-4 border-b ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Enhanced Cutoffs Table
            </h2>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                <Zap className="w-4 h-4 inline mr-1" />
                AI-Powered
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'}`}>
                {aiInsights.totalRows} Records
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                showFilters
                  ? isDarkMode
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                  : isDarkMode
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            
            <button
              onClick={() => handleExport('csv')}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isDarkMode
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* AI Insights Bar */}
        <div className={`grid grid-cols-4 gap-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <div className="text-center">
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {aiInsights.totalRows}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Records
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {aiInsights.avgSeats}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Avg Seats
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold text-green-500`}>
              {aiInsights.trendingUp}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Trending Up
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold text-red-500`}>
              {aiInsights.trendingDown}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Trending Down
            </div>
          </div>
        </div>
      </div>

      {/* Search and Quick Filters */}
      <div className={`p-4 border-b ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search across all columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSelectAll(true)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                isDarkMode
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              Select All
            </button>
            <button
              onClick={() => handleSelectAll(false)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                isDarkMode
                  ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`sticky top-0 z-40 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <tr>
              <th className="w-12 p-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              {columns.map(column => (
                <th
                  key={column.key}
                  className={`p-3 text-left font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                      >
                        {sortConfig?.column === column.key ? (
                          sortConfig.direction === 'asc' ? (
                            <SortAsc className="w-4 h-4" />
                          ) : (
                            <SortDesc className="w-4 h-4" />
                          )
                        ) : (
                          <div className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.slice(0, visibleRows).map((row, index) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.01 }}
                className={`border-b hover:bg-opacity-50 cursor-pointer transition-all ${
                  selectedRows.has(row.id)
                    ? isDarkMode
                      ? 'bg-blue-500/20 border-blue-500/30'
                      : 'bg-blue-100 border-blue-200'
                    : isDarkMode
                    ? 'border-gray-700 hover:bg-white/5'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => onRowClick?.(row)}
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleRowSelect(row.id, e.target.checked);
                    }}
                    className="rounded border-gray-300"
                  />
                </td>
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={`p-3 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {column.key === 'trendDirection' ? (
                      <div className="flex items-center space-x-1">
                        {row.trendDirection === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                        {row.trendDirection === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                        {row.trendDirection === 'stable' && <Minus className="w-4 h-4 text-gray-500" />}
                        <span className="capitalize">{row.trendDirection}</span>
                      </div>
                    ) : column.key === 'predictionScore' ? (
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (row.predictionScore || 0) > 0.8 ? 'bg-green-500' :
                          (row.predictionScore || 0) > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span>{((row.predictionScore || 0) * 100).toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span>{row[column.key] || '-'}</span>
                    )}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with pagination and stats */}
      <div className={`p-4 border-t ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {Math.min(visibleRows, filteredData.length)} of {filteredData.length} records
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setVisibleRows(prev => Math.min(prev + 50, filteredData.length))}
              disabled={visibleRows >= filteredData.length}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                visibleRows >= filteredData.length
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              Load More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedExcelTable;
