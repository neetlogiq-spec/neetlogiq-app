'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { GraduationCap, MapPin, Users, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

export interface VirtualizedCutoffRow {
  id: string;
  college_name: string;
  course_name: string;
  state: string;
  category: string;
  quota: string;
  management?: string;
  year: number;
  round: number;
  opening_rank: number;
  closing_rank: number;
  total_seats: number;
}

interface VirtualizedCutoffTableProps {
  data: VirtualizedCutoffRow[];
  isDarkMode: boolean;
  isLoading?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  onRowClick?: (row: VirtualizedCutoffRow) => void;
  userRank?: number | null;
}

const ROW_HEIGHT = 56; // Fixed row height for virtualization
const OVERSCAN = 10; // Extra rows to render above/below viewport
const LOAD_MORE_THRESHOLD = 10; // Load more when within 10 rows of end

export function VirtualizedCutoffTable({
  data,
  isDarkMode,
  isLoading = false,
  hasNextPage = false,
  onLoadMore,
  onRowClick,
  userRank
}: VirtualizedCutoffTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: data.length + (isLoading ? 5 : 0), // Add skeleton rows when loading
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll: trigger load more when approaching end
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    const isNearEnd = lastItem.index >= data.length - LOAD_MORE_THRESHOLD;
    
    if (isNearEnd && hasNextPage && !isLoading && onLoadMore && !loadMoreRef.current) {
      loadMoreRef.current = true;
      onLoadMore();
    }
    
    if (!isLoading) {
      loadMoreRef.current = false;
    }
  }, [virtualItems, data.length, hasNextPage, isLoading, onLoadMore]);

  // Get rank color based on user rank
  const getRankColor = useCallback((rank: number) => {
    if (!userRank) return '';
    if (rank > userRank * 1.2) return isDarkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700';
    if (rank >= userRank * 0.8) return isDarkMode ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700';
    return isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700';
  }, [userRank, isDarkMode]);

  const columns = useMemo(() => [
    { key: 'college_name', label: 'College', width: '25%' },
    { key: 'course_name', label: 'Course', width: '15%' },
    { key: 'state', label: 'State', width: '12%' },
    { key: 'category', label: 'Category', width: '10%' },
    { key: 'quota', label: 'Quota', width: '10%' },
    { key: 'opening_rank', label: 'Opening', width: '10%' },
    { key: 'closing_rank', label: 'Closing', width: '10%' },
    { key: 'total_seats', label: 'Seats', width: '8%' },
  ], []);

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center px-4 py-3 border-b ${
        isDarkMode ? 'bg-white/10 border-white/10' : 'bg-gray-50 border-gray-200'
      }`}>
        {columns.map(col => (
          <div 
            key={col.key}
            style={{ width: col.width }}
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDarkMode ? 'text-white/60' : 'text-gray-500'
            }`}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 350px)', minHeight: '400px' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map(virtualRow => {
            const isSkeletonRow = virtualRow.index >= data.length;
            const row = isSkeletonRow ? null : data[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isSkeletonRow ? (
                  // Skeleton row
                  <div className={`flex items-center px-4 h-full border-b ${
                    isDarkMode ? 'border-white/5' : 'border-gray-100'
                  }`}>
                    {columns.map(col => (
                      <div key={col.key} style={{ width: col.width }} className="pr-2">
                        <div className={`h-4 rounded animate-pulse ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`} style={{ width: `${60 + Math.random() * 30}%` }} />
                      </div>
                    ))}
                  </div>
                ) : row ? (
                  // Data row
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex items-center px-4 h-full border-b cursor-pointer transition-colors ${
                      isDarkMode 
                        ? 'border-white/5 hover:bg-white/5' 
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {/* College */}
                    <div style={{ width: columns[0].width }} className="pr-2">
                      <div className={`text-sm font-medium truncate ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {row.college_name}
                      </div>
                      {row.management && (
                        <div className={`text-xs truncate ${
                          isDarkMode ? 'text-white/50' : 'text-gray-500'
                        }`}>
                          {row.management}
                        </div>
                      )}
                    </div>

                    {/* Course */}
                    <div style={{ width: columns[1].width }} className="pr-2">
                      <div className={`text-sm truncate ${
                        isDarkMode ? 'text-white/80' : 'text-gray-700'
                      }`}>
                        {row.course_name}
                      </div>
                    </div>

                    {/* State */}
                    <div style={{ width: columns[2].width }} className="pr-2">
                      <div className={`text-sm truncate flex items-center gap-1 ${
                        isDarkMode ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {row.state}
                      </div>
                    </div>

                    {/* Category */}
                    <div style={{ width: columns[3].width }} className="pr-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {row.category}
                      </span>
                    </div>

                    {/* Quota */}
                    <div style={{ width: columns[4].width }} className="pr-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {row.quota}
                      </span>
                    </div>

                    {/* Opening Rank */}
                    <div style={{ width: columns[5].width }} className="pr-2">
                      <div className={`text-sm font-medium flex items-center gap-1 ${
                        isDarkMode ? 'text-green-400' : 'text-green-600'
                      }`}>
                        <TrendingUp className="w-3 h-3" />
                        {row.opening_rank?.toLocaleString() || '-'}
                      </div>
                    </div>

                    {/* Closing Rank */}
                    <div style={{ width: columns[6].width }} className="pr-2">
                      <div className={`text-sm font-medium flex items-center gap-1 ${getRankColor(row.closing_rank)} px-2 py-0.5 rounded`}>
                        <TrendingDown className="w-3 h-3" />
                        {row.closing_rank?.toLocaleString() || '-'}
                      </div>
                    </div>

                    {/* Seats */}
                    <div style={{ width: columns[7].width }}>
                      <div className={`text-sm flex items-center gap-1 ${
                        isDarkMode ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        <Users className="w-3 h-3" />
                        {row.total_seats}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with stats */}
      <div className={`flex items-center justify-between px-4 py-2 border-t ${
        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
          Showing {data.length.toLocaleString()} rows
          {isLoading && (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading more...
            </span>
          )}
        </div>
        {hasNextPage && !isLoading && (
          <div className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
            Scroll for more
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedCutoffTable;
