'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import ViewToggle, { ViewType } from '@/components/ui/ViewToggle';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
  type: 'select' | 'multiselect' | 'range';
}

interface IntelligentFiltersProps {
  filters?: {
    available?: FilterGroup[];
  };
  appliedFilters?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;
  onClearFilters?: () => void;
  type?: string;
  streamFilter?: string | string[];
  onStreamChange?: (streams: string[] | undefined) => void;
  currentView?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

const IntelligentFilters: React.FC<IntelligentFiltersProps> = ({
  filters = { available: [] },
  appliedFilters = {},
  onFilterChange,
  onClearFilters,
  type = 'colleges',
  streamFilter,
  onStreamChange,
  currentView = 'card',
  onViewChange
}) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStreamDropdownOpen, setIsStreamDropdownOpen] = useState(false);
  const streamDropdownRef = useRef<HTMLDivElement>(null);

  // Convert streamFilter to array for multi-select
  // 'all' means no specific stream is selected, so treat it as empty
  const selectedStreams = Array.isArray(streamFilter) 
    ? streamFilter.filter(s => s !== 'all')
    : (streamFilter && streamFilter !== 'all') ? [streamFilter] : [];

  const availableFilters = filters.available || [];

  const handleFilterChange = (filterKey: string, value: any) => {
    const newFilters = { ...appliedFilters, [filterKey]: value };
    onFilterChange?.(newFilters);
  };

  const handleClearFilters = () => {
    onClearFilters?.();
  };

  const hasActiveFilters = Object.keys(appliedFilters).length > 0;

  // Stream options based on type
  const streamOptions = type === 'courses' 
    ? [
        { label: 'Medical', value: 'Medical' },
        { label: 'Dental', value: 'Dental' },
        { label: 'DNB', value: 'DNB' },
      ]
    : [
        { label: 'Medical', value: 'MED' },
        { label: 'Dental', value: 'DEN' },
        { label: 'DNB', value: 'DNB' },
      ];

  // Handle stream toggle
  const toggleStream = (value: string) => {
    if (!onStreamChange) return;
    
    let newStreams: string[];
    if (selectedStreams.includes(value)) {
      newStreams = selectedStreams.filter(s => s !== value);
    } else {
      newStreams = [...selectedStreams, value];
    }
    
    onStreamChange(newStreams.length > 0 ? newStreams : undefined);
  };

  // Get display text for stream button
  const getStreamButtonText = () => {
    if (selectedStreams.length === 0) return 'All Streams';
    if (selectedStreams.length === streamOptions.length) return 'All Streams';
    if (selectedStreams.length === 1) {
      return streamOptions.find(s => s.value === selectedStreams[0])?.label || 'Stream';
    }
    return `${selectedStreams.length} Streams`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (streamDropdownRef.current && !streamDropdownRef.current.contains(event.target as Node)) {
        setIsStreamDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mock filter data for demonstration
  const mockFilters: FilterGroup[] = [
    {
      key: 'state',
      label: 'State',
      type: 'select',
      options: [
        { value: 'all', label: 'All States' },
        { value: 'Delhi', label: 'Delhi', count: 15 },
        { value: 'Maharashtra', label: 'Maharashtra', count: 45 },
        { value: 'Karnataka', label: 'Karnataka', count: 32 },
        { value: 'Tamil Nadu', label: 'Tamil Nadu', count: 28 },
        { value: 'Uttar Pradesh', label: 'Uttar Pradesh', count: 38 }
      ]
    },
    {
      key: 'management_type',
      label: 'Management Type',
      type: 'select',
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'GOVERNMENT', label: 'Government', count: 120 },
        { value: 'PRIVATE', label: 'Private', count: 85 },
        { value: 'DEEMED', label: 'Deemed', count: 25 }
      ]
    }
  ];

  const displayFilters = availableFilters.length > 0 ? availableFilters : mockFilters;

  return (
    <div className="w-full">
      {/* Filter Toggle Button, View Toggle, and Stream Dropdown */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
        {/* Left side: Filters button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
              isExpanded || hasActiveFilters
                ? isDarkMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : isDarkMode
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`} />
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {Object.keys(appliedFilters).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <X className="w-4 h-4" />
              <span className="text-sm">Clear</span>
            </button>
          )}
        </div>

        {/* Middle: View Toggle */}
        {onViewChange && (
          <div className="flex-1 flex justify-center">
            <ViewToggle
              currentView={currentView}
              onViewChange={onViewChange}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {/* Right side: Stream Dropdown */}
        {onStreamChange && (
          <div className="relative" ref={streamDropdownRef}>
            <button
              onClick={() => setIsStreamDropdownOpen(!isStreamDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                selectedStreams.length > 0 && selectedStreams.length < streamOptions.length
                  ? isDarkMode
                    ? 'bg-primary-600 text-white'
                    : 'bg-primary-500 text-white'
                  : isDarkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="font-medium">{getStreamButtonText()}</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
                isStreamDropdownOpen ? 'rotate-180' : ''
              }`} />
              {selectedStreams.length > 0 && selectedStreams.length < streamOptions.length && (
                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {selectedStreams.length}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isStreamDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50 ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="p-2">
                    {streamOptions.map((stream) => (
                      <button
                        key={stream.value}
                        onClick={() => toggleStream(stream.value)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                          isDarkMode
                            ? 'hover:bg-white/10'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                          {stream.label}
                        </span>
                        {selectedStreams.includes(stream.value) && (
                          <Check className="w-4 h-4 text-primary-500" />
                        )}
                      </button>
                    ))}
                    
                    {/* Divider */}
                    <div className={`my-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />
                    
                    {/* Select All / Clear */}
                    <button
                      onClick={() => onStreamChange(streamOptions.map(o => o.value))}
                      className={`w-full px-3 py-2 rounded-md text-sm text-left transition-colors ${
                        selectedStreams.length === 0 || selectedStreams.length === streamOptions.length
                          ? isDarkMode ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                          : isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      All Streams
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Filter Options */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className={`p-4 rounded-xl border ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayFilters.map((filterGroup) => (
              <div key={filterGroup.key}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {filterGroup.label}
                </label>
                <select
                  value={appliedFilters[filterGroup.key] || 'all'}
                  onChange={(e) => handleFilterChange(filterGroup.key, e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-white/10 text-white border-white/20' 
                      : 'bg-white text-gray-900 border-gray-200'
                  }`}
                >
                  {filterGroup.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {option.count && ` (${option.count})`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Active Filters Display */}
      {(hasActiveFilters || selectedStreams.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-wrap gap-2"
        >
          {/* Show selected streams as chips */}
          {selectedStreams.map((streamValue) => {
            const stream = streamOptions.find(s => s.value === streamValue);
            return (
              <span
                key={streamValue}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  isDarkMode
                    ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                    : 'bg-primary-100 text-primary-800 border border-primary-300'
                }`}
              >
                <span>{stream?.label}</span>
                <button
                  onClick={() => toggleStream(streamValue)}
                  className="hover:bg-white/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          
          {/* Show other active filters */}
          {Object.entries(appliedFilters).map(([key, value]) => {
            if (value === 'all' || !value || key === 'stream') return null;
            
            const filterGroup = displayFilters.find(f => f.key === key);
            const option = filterGroup?.options.find(o => o.value === value);
            
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  isDarkMode
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                <span>{filterGroup?.label}: {option?.label || value}</span>
                <button
                  onClick={() => handleFilterChange(key, 'all')}
                  className="hover:bg-white/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default IntelligentFilters;
