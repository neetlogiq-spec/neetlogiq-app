'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  MoreHorizontal,
  GripVertical,
  Eye,
  EyeOff,
  Settings,
  Download,
  Search,
  RefreshCw
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import FilterBar from './FilterBar';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  frozen?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  options?: { value: string; label: string; count?: number }[];
  render?: (value: any, row: any) => React.ReactNode;
}

interface ExcelStyleTableProps {
  data: any[];
  columns: Column[];
  isDarkMode: boolean;
  onRowClick?: (row: any) => void;
  onDataChange?: (data: any[]) => void;
  height?: string;
  enableColumnResize?: boolean;
  enableColumnReorder?: boolean;
  enableFreezeColumns?: boolean;
  enableExport?: boolean;
  enableFilterBar?: boolean;
}

interface FilterState {
  [columnKey: string]: {
    type: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'range' | 'in' | 'notIn';
    value: any;
    values?: any[];
    min?: number;
    max?: number;
  };
}

interface SortState {
  column: string | null;
  direction: 'asc' | 'desc' | null;
}

const ExcelStyleTable: React.FC<ExcelStyleTableProps> = ({
  data,
  columns,
  isDarkMode,
  onRowClick,
  onDataChange,
  height = '600px',
  enableColumnResize = true,
  enableColumnReorder = true,
  enableFreezeColumns = true,
  enableExport = true,
  enableFilterBar = true
}) => {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [frozenColumns, setFrozenColumns] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filteredData, setFilteredData] = useState<any[]>(data);
  
  const tableRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  // Initialize column order and widths
  useEffect(() => {
    if (columns.length > 0) {
      const initialOrder = columns.map(col => col.key);
      setColumnOrder(initialOrder);
      
      const initialWidths: { [key: string]: number } = {};
      columns.forEach(col => {
        initialWidths[col.key] = col.width || 150;
      });
      setColumnWidths(initialWidths);
    }
  }, [columns]);

  // Get visible columns in correct order
  const visibleColumns = useMemo(() => {
    return columnOrder
      .filter(key => !hiddenColumns.includes(key))
      .map(key => columns.find(col => col.key === key))
      .filter(Boolean) as Column[];
  }, [columnOrder, hiddenColumns, columns]);

  // Get unique values for filter options
  const getFilterOptions = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column) return [];

    const uniqueValues = [...new Set(filteredData.map(row => row[columnKey]))]
      .filter(value => value !== null && value !== undefined && value !== '')
      .sort();

    return uniqueValues.map(value => ({
      value: String(value),
      label: String(value),
      count: filteredData.filter(row => row[columnKey] === value).length
    }));
  };

  // Apply search and sorting to filtered data
  const finalData = useMemo(() => {
    let result = [...filteredData];

    // Apply search term
    if (searchTerm) {
      result = result.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortState.column && sortState.direction) {
      result.sort((a, b) => {
        const aVal = a[sortState.column!];
        const bVal = b[sortState.column!];
        
        if (aVal === bVal) return 0;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortState.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [filteredData, sortState, searchTerm]);

  // Handle column resize
  const handleMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(columnKey);
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey] || 150;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX));
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle column reorder
  const handleColumnDrag = (draggedColumn: string, targetColumn: string) => {
    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const targetIndex = newOrder.indexOf(targetColumn);
    
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);
    
    setColumnOrder(newOrder);
  };

  // Handle sorting
  const handleSort = (columnKey: string) => {
    setSortState(prev => ({
      column: columnKey,
      direction: prev.column === columnKey 
        ? prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc'
        : 'asc'
    }));
  };

  // Handle filter bar changes
  const handleFilterBarChange = (newFilteredData: any[]) => {
    setFilteredData(newFilteredData);
  };

  // Export data
  const handleExport = () => {
    const csvContent = [
      visibleColumns.map(col => col.label).join(','),
      ...finalData.map(row =>
        visibleColumns.map(col => `"${row[col.key] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cutoffs-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const FilterDropdown = ({ column }: { column: Column }) => {
    const filter = filters[column.key] || { type: 'contains', value: '' };
    const options = getFilterOptions(column.key);

    return (
      <AnimatePresence>
        {activeFilter === column.key && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`absolute top-full left-0 z-50 mt-1 p-4 rounded-lg shadow-lg border min-w-64 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Filter {column.label}
                </h4>
                <button
                  onClick={() => setActiveFilter(null)}
                  className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Type */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Filter Type
                </label>
                <select
                  value={filter.type}
                  onChange={(e) => handleFilterChange(column.key, { type: e.target.value as any })}
                  className={`w-full px-3 py-2 rounded border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                  <option value="startsWith">Starts with</option>
                  <option value="endsWith">Ends with</option>
                  <option value="range">Range</option>
                  <option value="in">In list</option>
                  <option value="notIn">Not in list</option>
                </select>
              </div>

              {/* Filter Value */}
              {filter.type === 'range' ? (
                <div className="space-y-2">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Min
                    </label>
                    <input
                      type="number"
                      value={filter.min || ''}
                      onChange={(e) => handleFilterChange(column.key, { min: Number(e.target.value) })}
                      className={`w-full px-3 py-2 rounded border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Max
                    </label>
                    <input
                      type="number"
                      value={filter.max || ''}
                      onChange={(e) => handleFilterChange(column.key, { max: Number(e.target.value) })}
                      className={`w-full px-3 py-2 rounded border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
              ) : filter.type === 'in' || filter.type === 'notIn' ? (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Select Values
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {options.map(option => (
                      <label key={option.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filter.values?.includes(option.value) || false}
                          onChange={(e) => {
                            const currentValues = filter.values || [];
                            const newValues = e.target.checked
                              ? [...currentValues, option.value]
                              : currentValues.filter(v => v !== option.value);
                            handleFilterChange(column.key, { values: newValues });
                          }}
                          className="rounded"
                        />
                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {option.label} ({option.count})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Value
                  </label>
                  <input
                    type="text"
                    value={filter.value || ''}
                    onChange={(e) => handleFilterChange(column.key, { value: e.target.value })}
                    placeholder={`Filter ${column.label}...`}
                    className={`w-full px-3 py-2 rounded border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              )}

              {/* Filter Actions */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => handleFilterChange(column.key, { type: 'contains', value: '', values: [] })}
                  className={`px-3 py-1 text-sm rounded ${
                    isDarkMode 
                      ? 'text-gray-400 hover:text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Clear
                </button>
                <button
                  onClick={() => setActiveFilter(null)}
                  className={`px-4 py-1 text-sm rounded ${
                    isDarkMode 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className={`excel-style-table ${isDarkMode ? 'dark' : ''}`} style={{ height }}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <input
              type="text"
              placeholder="Search all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-lg border text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>

          {/* Active Filters Count */}
          {Object.keys(filters).length > 0 && (
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
            }`}>
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">
                {Object.keys(filters).length} filter{Object.keys(filters).length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={clearAllFilters}
                className={`p-1 rounded ${
                  isDarkMode ? 'hover:bg-blue-500/30' : 'hover:bg-blue-200'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Column Settings */}
          <button
            className={`p-2 rounded-lg ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title="Column Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Export */}
          {enableExport && (
            <button
              onClick={handleExport}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                isDarkMode 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div 
        ref={tableRef}
        className={`flex-1 overflow-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
        style={{ height: `calc(${height} - 80px)` }}
      >
        <table className="w-full border-collapse">
          {/* Header */}
          <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <tr>
              {visibleColumns.map((column, index) => (
                <th
                  key={column.key}
                  className={`relative border-r border-b ${
                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  } ${frozenColumns.includes(column.key) ? 'sticky left-0 z-20' : ''}`}
                  style={{ 
                    width: columnWidths[column.key] || column.width || 150,
                    minWidth: column.minWidth || 50,
                    maxWidth: column.maxWidth || 300
                  }}
                >
                  <div className={`flex items-center justify-between p-3 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {/* Drag Handle */}
                      {enableColumnReorder && (
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      )}
                      
                      {/* Column Label */}
                      <span className="font-medium truncate">{column.label}</span>
                      
                      {/* Sort Indicator */}
                      {column.sortable !== false && (
                        <button
                          onClick={() => handleSort(column.key)}
                          className={`p-1 rounded ${
                            sortState.column === column.key
                              ? isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                              : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          }`}
                        >
                          {sortState.column === column.key ? (
                            sortState.direction === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : sortState.direction === 'desc' ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Filter Button */}
                    {column.filterable !== false && (
                      <button
                        onClick={() => setActiveFilter(activeFilter === column.key ? null : column.key)}
                        className={`p-1 rounded ${
                          filters[column.key]?.value || filters[column.key]?.values?.length
                            ? isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                      </button>
                    )}

                    {/* Resize Handle */}
                    {enableColumnResize && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500"
                        onMouseDown={(e) => handleMouseDown(column.key, e)}
                      />
                    )}
                  </div>

                  {/* Filter Dropdown */}
                  <FilterDropdown column={column} />
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {filteredAndSortedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`border-b ${
                  isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                } ${selectedRows.has(String(rowIndex)) ? isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {visibleColumns.map((column, colIndex) => (
                  <td
                    key={column.key}
                    className={`p-3 border-r ${
                      isDarkMode ? 'border-gray-700 text-gray-200' : 'border-gray-200 text-gray-700'
                    } ${frozenColumns.includes(column.key) ? 'sticky left-0 z-10' : ''}`}
                    style={{ 
                      width: columnWidths[column.key] || column.width || 150,
                      minWidth: column.minWidth || 50,
                      maxWidth: column.maxWidth || 300
                    }}
                  >
                    {column.render ? column.render(row[column.key], row) : String(row[column.key] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty State */}
        {filteredAndSortedData.length === 0 && (
          <div className={`flex items-center justify-center h-32 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className="text-center">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data matches your filters</p>
              <button
                onClick={clearAllFilters}
                className={`mt-2 px-4 py-2 rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelStyleTable;
