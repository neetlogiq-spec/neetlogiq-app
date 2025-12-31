'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  GripVertical,
  Settings,
  Download,
  Search
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import FilterBar from './FilterBar';

interface Column {
  key: string;
  label: string | React.ReactNode;
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
  rowClassName?: (row: any) => string;
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
  enableFilterBar = true,
  rowClassName
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
        if (col.width) {
          initialWidths[col.key] = col.width;
        }
      });
      setColumnWidths(initialWidths);
    }
  }, [columns]);

  // Update filtered data when data changes
  useEffect(() => {
    setFilteredData(data);
  }, [data]);

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
      visibleColumns.map(col => typeof col.label === 'string' ? col.label : col.key).join(','),
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

  return (
    <div className={`excel-style-table ${isDarkMode ? 'dark' : ''} flex flex-col`} style={{ height }}>
      {/* Filter Bar */}
      {enableFilterBar && (
        <FilterBar
          columns={columns}
          data={data}
          isDarkMode={isDarkMode}
          onFiltersChange={handleFilterBarChange}
          onExport={enableExport ? handleExport : undefined}
          getFilterOptions={getFilterOptions}
        />
      )}

      {/* Table Container */}
      <div 
        ref={tableRef}
        className={`flex-1 overflow-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
      >
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          {/* Header */}
          <thead className={`sticky top-0 z-10 backdrop-blur-md ${isDarkMode ? 'bg-gray-800/95' : 'bg-gray-50/95'}`}>
            <tr>
              {visibleColumns.map((column, index) => (
                <th
                  key={column.key}
                  className={`relative border-r border-b ${
                    isDarkMode ? 'border-gray-700' : 'border-gray-200'
                  } ${frozenColumns.includes(column.key) ? 'sticky left-0 z-20' : ''}`}
                  style={{ 
                    // Use pixel width if defined, otherwise let table layout decide
                    ...(columnWidths[column.key] || column.width ? { width: columnWidths[column.key] || column.width } : {}),
                    minWidth: column.minWidth || 50,
                    maxWidth: column.maxWidth || 300
                  }}
                >
                  <div className={`flex items-center justify-between px-2 py-1.5 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  } text-sm`}>
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {/* Drag Handle */}
                      {enableColumnReorder && (
                        <GripVertical className="w-3 h-3 text-gray-400 cursor-move" />
                      )}
                      
                      {/* Column Label */}
                      <span className="font-bold truncate text-sm">{column.label}</span>
                      
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
                              <ArrowUp className="w-2.5 h-2.5" />
                            ) : sortState.direction === 'desc' ? (
                              <ArrowDown className="w-2.5 h-2.5" />
                            ) : (
                              <ArrowUpDown className="w-2.5 h-2.5" />
                            )
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Resize Handle */}
                    {enableColumnResize && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500"
                        onMouseDown={(e) => handleMouseDown(column.key, e)}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body - Golden Mean Design: Card-like rows with margins */}
          <tbody className="space-y-1">
            {finalData.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(rowIndex * 0.015, 0.5), duration: 0.3 }}
                className={`transition-all cursor-pointer rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-800/50 hover:bg-blue-900/30 hover:shadow-lg hover:shadow-blue-500/10' 
                    : 'bg-white hover:bg-blue-50/70 hover:shadow-md hover:shadow-blue-200/50'
                } ${
                  isDarkMode ? 'border border-gray-700/50' : 'border border-gray-200/80 shadow-sm'
                } ${selectedRows.has(String(rowIndex)) ? isDarkMode ? 'bg-blue-500/20 border-blue-500/30' : 'bg-blue-100 border-blue-300' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                style={{ marginBottom: '3px' }}
                onClick={() => onRowClick?.(row)}
              >
                {visibleColumns.map((column, colIndex) => (
                  <td
                    key={column.key}
                    className={`px-2 py-2.5 text-sm ${
                    colIndex === 0 ? 'rounded-l-lg' : ''
                  } ${
                    colIndex === visibleColumns.length - 1 ? 'rounded-r-lg' : ''
                  } ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  } ${frozenColumns.includes(column.key) ? 'sticky left-0 z-10' : ''}`}
                  style={{ 
                    width: columnWidths[column.key] || column.width || 'auto',
                    minWidth: column.minWidth || 50,
                    maxWidth: column.maxWidth || 300
                  }}
                >
                  {column.render ? column.render(row[column.key], row) : String(row[column.key] || '')}
                </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* Footer with record count */}
        {finalData.length > 0 && (
          <div className={`flex items-center justify-between p-4 border-t ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing {finalData.length} records
            </span>
          </div>
        )}

        {/* Empty State */}
        {finalData.length === 0 && (
          <div className={`flex items-center justify-center h-32 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className="text-center">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No data matches your filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelStyleTable;
