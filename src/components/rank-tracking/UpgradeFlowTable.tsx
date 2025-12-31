'use client';

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { 
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  GraduationCap,
  Building2,
  Search
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UpgradeRecord {
  all_india_rank: number;
  r1_college: string;
  r1_course: string;
  r1_state: string;
  r1_category: string;
  r1_quota: string;
  r2_college: string;
  r2_course: string;
  r2_state: string;
  r2_category: string;
  r2_quota: string;
  upgrade_type: string;
}

interface UpgradeFlowTableProps {
  data: UpgradeRecord[];
  isDarkMode: boolean;
  isLoading?: boolean;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (index: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const columnHelper = createColumnHelper<UpgradeRecord>();

// Category badge styling (matching cutoffs table)
const getCategoryBadgeClass = (category: string, isDarkMode: boolean) => {
  if (category === 'General' || category === 'OPEN') {
    return isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-800';
  } else if (category === 'OBC') {
    return isDarkMode ? 'bg-yellow-500/30 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
  } else if (category === 'SC') {
    return isDarkMode ? 'bg-red-500/30 text-red-200' : 'bg-red-100 text-red-800';
  } else if (category === 'ST') {
    return isDarkMode ? 'bg-green-500/30 text-green-200' : 'bg-green-100 text-green-800';
  } else if (category === 'EWS') {
    return isDarkMode ? 'bg-orange-500/30 text-orange-200' : 'bg-orange-100 text-orange-800';
  }
  return isDarkMode ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-100 text-purple-800';
};

// Quota badge styling (matching cutoffs table)
const getQuotaBadgeClass = (quota: string, isDarkMode: boolean) => {
  if (quota === 'AIQ' || quota === 'ALL INDIA') {
    return isDarkMode ? 'bg-blue-500/30 text-blue-200' : 'bg-blue-100 text-blue-800';
  }
  return isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-800';
};

export default function UpgradeFlowTable({ 
  data, 
  isDarkMode,
  isLoading, 
  totalCount, 
  pageIndex = 0, 
  pageSize: externalPageSize = 50, 
  onPageChange, 
  onPageSizeChange 
}: UpgradeFlowTableProps) {
  const isServerSide = totalCount !== undefined;
  const [columnVisibility, setColumnVisibility] = useState({});

  const columns = useMemo(() => [
    // Rank Column - Bold blue text, will be sticky
    columnHelper.accessor('all_india_rank', {
      header: 'Rank',
      cell: info => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm whitespace-nowrap">
          {info.getValue()?.toLocaleString()}
        </span>
      ),
      size: 60,
    }),
    
    // Round 1 Columns
    columnHelper.group({
      id: 'round1',
      header: () => (
        <span className="text-slate-600 dark:text-slate-300 uppercase text-xs font-bold tracking-wide whitespace-nowrap">
          Round 1 Allocation
        </span>
      ),
      columns: [
        columnHelper.accessor('r1_college', {
          header: 'College',
          cell: info => (
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-semibold text-xs truncate" title={info.getValue()}>
                {info.getValue() || '-'}
              </span>
            </div>
          ),
          size: 420,
          minSize: 300,
        }),
        columnHelper.accessor('r1_course', {
          header: 'Course',
          cell: info => (
            <span className="font-medium text-xs truncate block" title={info.getValue()}>
              {info.getValue() || '-'}
            </span>
          ),
          size: 300,
          minSize: 200,
        }),
        columnHelper.accessor('r1_state', {
          header: 'State',
          cell: info => (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">{info.getValue() || '-'}</span>
            </div>
          ),
          size: 50,
          maxSize: 60,
        }),
        columnHelper.accessor('r1_category', {
          header: 'Cat',
          cell: info => {
            const val = info.getValue();
            return (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${getCategoryBadgeClass(val, isDarkMode)}`}>
                {val || '-'}
              </span>
            );
          },
          size: 28,
          maxSize: 35,
        }),
        columnHelper.accessor('r1_quota', {
          header: 'Quota',
          cell: info => {
            const val = info.getValue();
            return (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${getQuotaBadgeClass(val, isDarkMode)}`} title={val}>
                {val || '-'}
              </span>
            );
          },
          size: 32,
          maxSize: 40,
        }),
      ],
    }),

    // Round 2 Columns
    columnHelper.group({
      id: 'round2',
      header: () => (
        <span className="text-emerald-600 dark:text-emerald-400 uppercase text-xs font-bold tracking-wide whitespace-nowrap">
          Round 2 Allocation
        </span>
      ),
      columns: [
        columnHelper.accessor('r2_college', {
          header: 'College',
          cell: info => {
            const val = info.getValue();
            const r1Val = info.row.original.r1_college;
            const isDifferent = val && r1Val && val !== r1Val;
            return (
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className={`w-3.5 h-3.5 shrink-0 ${isDifferent ? 'text-emerald-500' : 'text-blue-500'}`} />
                <span 
                  className={`font-semibold text-xs truncate ${isDifferent ? 'text-emerald-600 dark:text-emerald-400' : ''}`} 
                  title={val}
                >
                  {val || '-'}
                </span>
              </div>
            );
          },
          size: 420,
          minSize: 300,
        }),
        columnHelper.accessor('r2_course', {
          header: 'Course',
          cell: info => {
            const val = info.getValue();
            const r1Val = info.row.original.r1_course;
            const isDifferent = val && r1Val && val !== r1Val;
            return (
              <span 
                className={`font-medium text-xs truncate block ${isDifferent ? 'text-emerald-600 dark:text-emerald-400' : ''}`} 
                title={val}
              >
                {val || '-'}
              </span>
            );
          },
          size: 300,
          minSize: 200,
        }),
        columnHelper.accessor('r2_state', {
          header: 'State',
          cell: info => (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">{info.getValue() || '-'}</span>
            </div>
          ),
          size: 50,
          maxSize: 60,
        }),
        columnHelper.accessor('r2_category', {
          header: 'Cat',
          cell: info => {
            const val = info.getValue();
            return (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${getCategoryBadgeClass(val, isDarkMode)}`}>
                {val || '-'}
              </span>
            );
          },
          size: 28,
          maxSize: 35,
        }),
        columnHelper.accessor('r2_quota', {
          header: 'Quota',
          cell: info => {
            const val = info.getValue();
            return (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${getQuotaBadgeClass(val, isDarkMode)}`} title={val}>
                {val || '-'}
              </span>
            );
          },
          size: 32,
          maxSize: 40,
        }),
      ],
    }),
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
      pagination: isServerSide ? {
        pageIndex,
        pageSize: externalPageSize,
      } : undefined,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: isServerSide,
    pageCount: isServerSide ? Math.ceil((totalCount || 0) / externalPageSize) : undefined,
    onPaginationChange: (updater) => {
      if (isServerSide) {
        const nextState = typeof updater === 'function' 
          ? updater({ pageIndex, pageSize: externalPageSize }) 
          : updater;
        
        if (nextState.pageIndex !== pageIndex && onPageChange) {
          onPageChange(nextState.pageIndex);
        }
        if (nextState.pageSize !== externalPageSize && onPageSizeChange) {
          onPageSizeChange(nextState.pageSize);
        }
      }
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  return (
    <Card className={`w-full overflow-hidden border shadow-2xl rounded-xl ${
      isDarkMode 
        ? 'bg-slate-950/98 border-white/10 backdrop-blur-3xl' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Table with sticky rank column */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed" style={{ minWidth: '1600px' }}>
          {/* Colgroup for explicit column widths: Rank, R1(College,Course,State,Cat,Quota), R2(College,Course,State,Cat,Quota) */}
          <colgroup>
            <col style={{ width: '55px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '55px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '55px' }} />
            <col style={{ width: '70px' }} />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-gray-200 dark:border-gray-700">
                {headerGroup.headers.map((header, idx) => {
                  const isR1 = header.id.startsWith('r1_') || header.id === 'round1';
                  const isR2 = header.id.startsWith('r2_') || header.id === 'round2';
                  const isRank = header.id === 'all_india_rank';
                  
                  return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={`px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${
                          isRank ? (isDarkMode ? 'sticky left-0 z-30 bg-slate-950 border-r border-white/10 shadow-[2px_0_10px_rgba(0,0,0,0.4)]' : 'sticky left-0 z-30 bg-white border-r border-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)]') :
                          isR1 ? (isDarkMode ? 'bg-slate-900/90 border-r border-white/10 last:border-r-2 last:border-blue-500/30' : 'bg-slate-50 border-r border-gray-100') :
                          isR2 ? (isDarkMode ? 'bg-emerald-950/40' : 'bg-emerald-50/50') :
                          (isDarkMode ? 'bg-slate-900' : 'bg-white')
                        } ${header.id === 'r1_quota' ? (isDarkMode ? 'border-r-2 border-slate-700' : 'border-r-2 border-gray-200') : ''}`}
                      >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`${
                            header.column.getCanSort()
                              ? 'cursor-pointer select-none flex items-center gap-1 group hover:text-blue-600 transition-colors'
                              : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="text-slate-600 dark:text-slate-300">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getCanSort() && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {{
                                asc: <ChevronUp className="h-3 w-3 text-blue-500" />,
                                desc: <ChevronDown className="h-3 w-3 text-blue-500" />,
                              }[header.column.getIsSorted() as string] ?? (
                                <ArrowUpDown className="h-3 w-3 text-gray-300" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className={`animate-pulse border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <td key={j} className="px-2 py-2">
                      <div className={`h-4 rounded w-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row, rowIndex) => (
                <tr 
                  key={row.id} 
                  className="border-b border-gray-100 dark:border-gray-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                >
                  {row.getVisibleCells().map((cell, cellIdx) => {
                    const isR1 = cell.column.id.startsWith('r1_');
                    const isR2 = cell.column.id.startsWith('r2_');
                    const isRank = cell.column.id === 'all_india_rank';
                    
                    return (
                      <td 
                        key={cell.id}
                        className={`px-2 py-3 text-sm transition-colors ${isDarkMode ? 'text-white' : 'text-gray-700'} ${
                          isRank ? (isDarkMode ? 'sticky left-0 z-10 bg-slate-950 border-r border-white/10 shadow-[2px_0_10px_rgba(0,0,0,0.4)] font-bold' : 'sticky left-0 z-10 bg-white border-r border-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)] font-bold') :
                          isR1 ? (isDarkMode ? 'bg-slate-900/20' : 'bg-slate-50/20') :
                          isR2 ? (isDarkMode ? 'bg-emerald-900/10' : 'bg-emerald-50/10') :
                          ''
                        } ${cell.column.id === 'r1_quota' ? (isDarkMode ? 'border-r-2 border-slate-800' : 'border-r-2 border-gray-100') : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Search className={`h-8 w-8 mb-2 ${isDarkMode ? 'text-white/20' : 'text-gray-300'}`} />
                    <p className={`font-medium ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>No records found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className={`px-4 py-3 border-t ${
        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50/50 border-gray-100'
      }`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Record count info */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Showing</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {isServerSide 
                ? pageIndex * externalPageSize + 1 
                : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </span>
            <span className="text-gray-500">-</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {isServerSide
                ? Math.min((pageIndex + 1) * externalPageSize, totalCount || 0)
                : Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length
                  )}
            </span>
            <span className="text-gray-500">of</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {(isServerSide ? totalCount : table.getFilteredRowModel().rows.length)?.toLocaleString()}
            </span>
            <span className="text-gray-500">records</span>
          </div>
          
          {/* Center: Rows per page */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Rows per page:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[25, 50, 100, 250, 500].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          
          {/* Right: Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 px-2">
              <span className="text-sm text-gray-500">Page</span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {table.getState().pagination.pageIndex + 1}
              </span>
              <span className="text-sm text-gray-500">of</span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {table.getPageCount()}
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
