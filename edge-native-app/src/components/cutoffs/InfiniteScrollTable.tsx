'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronUp, Grid, Table, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface Cutoff {
  id: string;
  college: string;
  course: string;
  category: string;
  year: string;
  openingRank: number;
  closingRank: number;
  totalSeats: number;
  trend: 'up' | 'down' | 'stable';
  change: string;
  description: string;
  stream: string;
  state: string;
  management: string;
  counsellingType: 'AIQ' | 'KEA';
  round: number;
}

interface InfiniteScrollTableProps {
  data: Cutoff[];
  isDarkMode: boolean;
  multiYear: boolean;
  onMultiYearToggle: (enabled: boolean) => void;
  viewType?: 'card' | 'table';
  onViewChange?: (view: 'card' | 'table') => void;
  visibleRounds?: number[];
  onVisibleRoundsChange?: (rounds: number[]) => void;
  isSearchBarVisible?: boolean;
  isTableHeaderSticky?: boolean;
  onRowClick?: (cutoff: Cutoff) => void;
}

interface GroupedData {
  [key: string]: {
    [year: string]: {
      [round: number]: Cutoff[];
    };
  };
}

const InfiniteScrollTable: React.FC<InfiniteScrollTableProps> = ({
  data,
  isDarkMode,
  multiYear,
  onMultiYearToggle,
  viewType = 'table',
  onViewChange,
  visibleRounds = [1, 2],
  onVisibleRoundsChange,
  isSearchBarVisible = false,
  isTableHeaderSticky = false,
  onRowClick
}) => {
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [visibleItems, setVisibleItems] = useState<number>(isSearchBarVisible ? 20 : 50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  // Update visible items when search bar visibility changes
  useEffect(() => {
    if (isSearchBarVisible) {
      setVisibleItems(20); // Start with fewer items for infinite scroll
    } else {
      setVisibleItems(50); // Show more items when header is visible
    }
  }, [isSearchBarVisible]);

  // Group data by state, institute, course, quota, category
  useEffect(() => {
    const grouped: GroupedData = {};
    
    data.forEach(cutoff => {
      const key = `${cutoff.state}|${cutoff.college}|${cutoff.course}|${cutoff.category}`;
      
      if (!grouped[key]) {
        grouped[key] = {};
      }
      
      if (!grouped[key][cutoff.year]) {
        grouped[key][cutoff.year] = {};
      }
      
      if (!grouped[key][cutoff.year][cutoff.round]) {
        grouped[key][cutoff.year][cutoff.round] = [];
      }
      
      grouped[key][cutoff.year][cutoff.round].push(cutoff);
    });
    
    setGroupedData(grouped);
  }, [data]);

  // Get available years
  const availableYears = Array.from(new Set(data.map(item => item.year))).sort((a, b) => b.localeCompare(a));
  const currentYear = availableYears[0] || '2024';
  const previousYear = availableYears[1] || '2023';
  
  // Get years to display
  const displayYears = multiYear ? [currentYear, previousYear] : [currentYear];

  // Get available rounds
  const availableRounds = Array.from(new Set(data.map(item => item.round))).sort((a, b) => a - b);
  const maxRounds = Math.max(...availableRounds);

  // Add more rounds
  const addRound = () => {
    const nextRound = Math.max(...visibleRounds) + 1;
    if (nextRound <= maxRounds && onVisibleRoundsChange) {
      onVisibleRoundsChange([...visibleRounds, nextRound]);
    }
  };

  // Remove round
  const removeRound = (round: number) => {
    if (round > 2 && onVisibleRoundsChange) { // Don't allow removing Round 1 and 2
      onVisibleRoundsChange(visibleRounds.filter(r => r !== round));
    }
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          const loadAmount = isSearchBarVisible ? 10 : 50; // Load fewer items when in infinite scroll mode
          setTimeout(() => {
            setVisibleItems(prev => Math.min(prev + loadAmount, Object.keys(groupedData).length));
            setIsLoadingMore(false);
          }, isSearchBarVisible ? 200 : 500); // Faster loading when in infinite scroll mode
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [groupedData, isSearchBarVisible]);

  // Get cutoff for specific year and round
  const getCutoffForYearRound = (key: string, year: string, round: number): Cutoff | null => {
    const group = groupedData[key];
    if (!group || !group[year] || !group[year][round]) return null;
    return group[year][round][0]; // Take first cutoff if multiple
  };

  // Format rank display with exact numbers and commas
  const formatRank = (rank: number) => {
    return rank.toLocaleString();
  };

  // Get trend color
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return isDarkMode ? 'text-red-400' : 'text-red-600';
      case 'down': return isDarkMode ? 'text-green-400' : 'text-green-600';
      default: return isDarkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  // Sorting functionality
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-3 h-3" /> : 
      <ArrowDown className="w-3 h-3" />;
  };

  // Filter and sort table keys based on search and sort configuration
  const getFilteredAndSortedTableKeys = () => {
    let keys = Object.keys(groupedData);
    
    // Filter by search term
    if (searchTerm) {
      keys = keys.filter(key => {
        const [state, institute, course, category] = key.split('|');
        const searchLower = searchTerm.toLowerCase();
        return (
          state.toLowerCase().includes(searchLower) ||
          institute.toLowerCase().includes(searchLower) ||
          course.toLowerCase().includes(searchLower) ||
          category.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Sort if sort configuration exists
    if (!sortConfig) return keys;

    return keys.sort((a, b) => {
      const [stateA, instituteA, courseA, categoryA] = a.split('|');
      const [stateB, instituteB, courseB, categoryB] = b.split('|');
      
      let aValue: string | number = '';
      let bValue: string | number = '';
      
      switch (sortConfig.key) {
        case 'state':
          aValue = stateA;
          bValue = stateB;
          break;
        case 'institute':
          aValue = instituteA;
          bValue = instituteB;
          break;
        case 'course':
          aValue = courseA;
          bValue = courseB;
          break;
        case 'category':
          aValue = categoryA;
          bValue = categoryB;
          break;
        case 'closingRank':
          const cutoffA = Object.values(groupedData[a])[0]?.[1]?.[0];
          const cutoffB = Object.values(groupedData[b])[0]?.[1]?.[0];
          aValue = cutoffA?.closingRank || 0;
          bValue = cutoffB?.closingRank || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const tableKeys = getFilteredAndSortedTableKeys().slice(0, visibleItems);


  return (
    <div className="w-full">
      
      {/* Table Search */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search within table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-4 py-2 pl-10 rounded-lg border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            }`}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-500">
            Showing {tableKeys.length} of {getFilteredAndSortedTableKeys().length} results
          </div>
        )}
      </div>

      {/* Table View - All Screen Sizes with Infinite Scroll */}
      <div className="overflow-x-auto overflow-y-auto h-full relative w-full">
        {/* Horizontal scroll indicators */}
        <div className="absolute top-2 left-2 z-40">
          <div className={`px-2 py-1 rounded-full text-xs ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            ← Swipe to see more columns
          </div>
        </div>
        
        {/* Left scroll shadow */}
        <div className="absolute top-0 left-0 w-4 h-full bg-gradient-to-r from-white to-transparent dark:from-gray-900 z-20 pointer-events-none"></div>
        
        {/* Right scroll shadow */}
        <div className="absolute top-0 right-0 w-4 h-full bg-gradient-to-l from-white to-transparent dark:from-gray-900 z-20 pointer-events-none"></div>
        
        <table className="w-full border-collapse text-xs shadow-lg rounded-lg overflow-hidden" style={{minWidth: '800px'}}>
          <thead className={`${isTableHeaderSticky ? 'sticky top-0' : ''} z-30 ${isDarkMode ? 'bg-gray-900' : 'bg-white'} shadow-sm`}>
            {/* Year Headers */}
            <tr>
              <th className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`} style={{width: '80px', minWidth: '80px'}}></th>
              <th className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`} style={{width: '200px', minWidth: '200px'}}></th>
              <th className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`} style={{width: '150px', minWidth: '150px'}}></th>
              <th className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`} style={{width: '60px', minWidth: '60px'}}></th>
              <th className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`} style={{width: '80px', minWidth: '80px'}}></th>
              {displayYears.map(year => (
                <th 
                  key={year} 
                  colSpan={visibleRounds.length}
                  className={`p-1 text-center border-b border-gray-200 dark:border-gray-700 ${
                    isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
                  }`}
                  style={{width: `${80 * visibleRounds.length}px`, minWidth: `${80 * visibleRounds.length}px`}}
                >
                  <span className="text-xs font-semibold">YEAR: {year}</span>
                </th>
              ))}
            </tr>
            
            {/* Column Headers */}
            <tr>
              <th 
                className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
                }`} 
                style={{width: '80px', minWidth: '80px'}}
                onClick={() => handleSort('state')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold">STATE</span>
                  {getSortIcon('state')}
                </div>
              </th>
              <th 
                className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
                }`} 
                style={{width: '200px', minWidth: '200px'}}
                onClick={() => handleSort('institute')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold">INSTITUTE</span>
                  {getSortIcon('institute')}
                </div>
              </th>
              <th 
                className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
                }`} 
                style={{width: '150px', minWidth: '150px'}}
                onClick={() => handleSort('course')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold">COURSE</span>
                  {getSortIcon('course')}
                </div>
              </th>
              <th className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 ${
                isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
              }`} style={{width: '60px', minWidth: '60px'}}>
                <span className="text-xs font-semibold">QUOTA</span>
              </th>
              <th 
                className={`p-1 text-left border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
                }`} 
                style={{width: '80px', minWidth: '80px'}}
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold">CATEGORY</span>
                  {getSortIcon('category')}
                </div>
              </th>
              {displayYears.map(year => 
                visibleRounds.map(round => (
                  <th 
                    key={`${year}-${round}`}
                    className={`p-1 text-center border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                      isDarkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'
                    }`}
                    style={{width: '80px', minWidth: '80px'}}
                    onClick={() => handleSort('closingRank')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-xs font-semibold">R{round}</span>
                      {getSortIcon('closingRank')}
                      {round > 2 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRound(round);
                          }}
                          className={`p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          <ChevronUp className="w-2 h-2" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 hidden sm:block">
                      Closing
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          
          <tbody className="relative">
            {tableKeys.map((key, index) => {
              const [state, institute, course, category] = key.split('|');
              const firstCutoff = Object.values(groupedData[key])[0]?.[1]?.[0];
              
              return (
                <motion.tr
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                    index % 2 === 0 
                      ? (isDarkMode ? 'bg-gray-900' : 'bg-white')
                      : (isDarkMode ? 'bg-gray-800' : 'bg-gray-50')
                  }`}
                  onClick={() => onRowClick && firstCutoff && onRowClick(firstCutoff)}
                >
                  <td className={`p-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{width: '80px', minWidth: '80px'}}>
                    <span className="text-xs">{state}</span>
                  </td>
                  <td className={`p-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{width: '200px', minWidth: '200px'}}>
                    <div className="truncate max-w-full" title={institute}>
                      <span className="text-xs block">{institute}</span>
                    </div>
                  </td>
                  <td className={`p-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{width: '150px', minWidth: '150px'}}>
                    <div className="truncate max-w-full" title={course}>
                      <span className="text-xs block">{course}</span>
                    </div>
                  </td>
                  <td className={`p-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{width: '60px', minWidth: '60px'}}>
                    <span className="text-xs">{firstCutoff?.counsellingType || 'AIQ'}</span>
                  </td>
                  <td className={`p-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} style={{width: '80px', minWidth: '80px'}}>
                    <span className="text-xs">{category}</span>
                  </td>
                  
                  {displayYears.map(year => 
                    visibleRounds.map(round => {
                      const cutoff = getCutoffForYearRound(key, year, round);
                      
                      return (
                            <td 
                              key={`${year}-${round}`}
                              className={`p-1 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              style={{width: '80px', minWidth: '80px'}}
                            >
                          {cutoff ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-medium flex items-center justify-center">
                                {formatRank(cutoff.closingRank)}
                                {cutoff.trend === 'up' && <ArrowUp className="w-2 h-2 ml-1 text-red-500" />}
                                {cutoff.trend === 'down' && <ArrowDown className="w-2 h-2 ml-1 text-green-500" />}
                              </div>
                              <div className={`text-xs ${getTrendColor(cutoff.trend)} text-center`}>
                                {cutoff.change}
                              </div>
                              <div className="text-xs text-gray-500 hidden sm:block text-center">
                                {cutoff.totalSeats} seats
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Loading indicator */}
        <div ref={loadingRef} className="flex justify-center py-8">
          {isLoadingMore && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Loading more data...
              </span>
            </div>
          )}
        </div>

        {/* End of data indicator */}
        {visibleItems >= Object.keys(groupedData).length && !isLoadingMore && (
          <div className="text-center py-8">
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No more data to load.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfiniteScrollTable;
