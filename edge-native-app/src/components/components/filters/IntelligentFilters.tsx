'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, X, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

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
}

const IntelligentFilters: React.FC<IntelligentFiltersProps> = ({
  filters = { available: [] },
  appliedFilters = {},
  onFilterChange,
  onClearFilters,
  type = 'colleges'
}) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const availableFilters = filters.available || [];

  const handleFilterChange = (filterKey: string, value: any) => {
    const newFilters = { ...appliedFilters, [filterKey]: value };
    onFilterChange?.(newFilters);
  };

  const handleClearFilters = () => {
    onClearFilters?.();
  };

  const hasActiveFilters = Object.keys(appliedFilters).length > 0;

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
    },
    {
      key: 'college_type',
      label: 'College Type',
      type: 'select',
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'MEDICAL', label: 'Medical', count: 180 },
        { value: 'DENTAL', label: 'Dental', count: 45 },
        { value: 'DNB', label: 'DNB', count: 15 }
      ]
    }
  ];

  const displayFilters = availableFilters.length > 0 ? availableFilters : mockFilters;

  return (
    <div className="w-full">
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between mb-4">
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
            <span className="text-sm">Clear All</span>
          </button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      {hasActiveFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-wrap gap-2"
        >
          {Object.entries(appliedFilters).map(([key, value]) => {
            if (value === 'all' || !value) return null;
            
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

