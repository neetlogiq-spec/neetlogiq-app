'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  GraduationCap, 
  MapPin, 
  Award, 
  Users,
  SortAsc,
  SortDesc,
  Search
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
    ])
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
        totalSeats: cutoff.totalSeats
      };

      // Add round data (with null check)
      const roundData: any = {};
      if (cutoff.rounds && typeof cutoff.rounds === 'object') {
        Object.keys(cutoff.rounds).forEach(round => {
          const roundInfo = cutoff.rounds[parseInt(round)];
          if (roundInfo) {
            roundData[`r${round}_opening`] = roundInfo.openingRank;
            roundData[`r${round}_closing`] = roundInfo.closingRank;
            roundData[`r${round}_range`] = roundInfo.closingRank - roundInfo.openingRank;
          }
        });
      }

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



  return (
    <div className={`enhanced-excel-table ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header */}


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
                      <span>{row[column.key] || '-'}</span>
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
