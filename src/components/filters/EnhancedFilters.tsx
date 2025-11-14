'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface RangeFilterValue {
  min: number;
  max: number;
}

interface EnhancedFiltersProps {
  appliedFilters?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;
  onClearFilters?: () => void;
  type?: string;
}

const EnhancedFilters: React.FC<EnhancedFiltersProps> = ({
  appliedFilters = {},
  onFilterChange,
  onClearFilters,
  type = 'colleges'
}) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  // Mock filter options with counts
  const stateOptions: FilterOption[] = [
    { value: 'Delhi', label: 'Delhi', count: 45 },
    { value: 'Maharashtra', label: 'Maharashtra', count: 120 },
    { value: 'Karnataka', label: 'Karnataka', count: 85 },
    { value: 'Tamil Nadu', label: 'Tamil Nadu', count: 95 },
    { value: 'Uttar Pradesh', label: 'Uttar Pradesh', count: 110 },
    { value: 'West Bengal', label: 'West Bengal', count: 65 },
    { value: 'Gujarat', label: 'Gujarat', count: 55 },
    { value: 'Rajasthan', label: 'Rajasthan', count: 48 },
  ];

  const managementOptions: FilterOption[] = [
    { value: 'GOVERNMENT', label: 'Government', count: 620 },
    { value: 'PRIVATE', label: 'Private', count: 850 },
    { value: 'DEEMED', label: 'Deemed', count: 180 },
    { value: 'TRUST', label: 'Trust/Society', count: 145 },
  ];

  const typeOptions: FilterOption[] = [
    { value: 'MEDICAL', label: 'Medical', count: 1200 },
    { value: 'DENTAL', label: 'Dental', count: 320 },
    { value: 'AYUSH', label: 'AYUSH', count: 285 },
    { value: 'DNB', label: 'DNB/Diploma', count: 312 },
  ];

  const handleMultiSelectChange = (filterKey: string, value: string) => {
    const currentValues = appliedFilters[filterKey] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v: string) => v !== value)
      : [...currentValues, value];

    const newFilters = {
      ...appliedFilters,
      [filterKey]: newValues.length > 0 ? newValues : undefined
    };

    // Remove undefined values
    Object.keys(newFilters).forEach(key => {
      if (newFilters[key] === undefined) {
        delete newFilters[key];
      }
    });

    onFilterChange?.(newFilters);
  };

  const handleRangeChange = (filterKey: string, type: 'min' | 'max', value: number) => {
    const current = appliedFilters[filterKey] || {};
    const newRange = {
      ...current,
      [type]: value
    };

    onFilterChange?.({
      ...appliedFilters,
      [filterKey]: newRange
    });
  };

  const handleSortChange = (sortValue: string) => {
    onFilterChange?.({
      ...appliedFilters,
      sortBy: sortValue
    });
  };

  const handleClearFilters = () => {
    onClearFilters?.();
  };

  const hasActiveFilters = Object.keys(appliedFilters).filter(k => k !== 'sortBy').length > 0;
  const activeFilterCount = Object.values(appliedFilters).filter(v => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
    return v !== undefined && v !== null;
  }).length;

  return (
    <div className="w-full">
      {/* Filter Toggle Header */}
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
          <span className="font-medium">Advanced Filters</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`} />
          {activeFilterCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={appliedFilters.sortBy || 'relevance'}
              onChange={(e) => handleSortChange(e.target.value)}
              className={`pl-3 pr-8 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm ${
                isDarkMode
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-white text-gray-900 border-gray-200'
              }`}
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="rank_asc">NIRF Rank (Best First)</option>
              <option value="fees_asc">Fees (Low to High)</option>
              <option value="fees_desc">Fees (High to Low)</option>
              <option value="established_desc">Newest First</option>
              <option value="seats_desc">Most Seats</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <X className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Options */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className={`p-6 rounded-xl border ${
          isDarkMode
            ? 'bg-white/5 border-white/10'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Multi-Select State Filter */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                State (Multi-Select)
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {stateOptions.map((option) => {
                  const isChecked = (appliedFilters.states || []).includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked
                          ? isDarkMode
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'bg-blue-50 border border-blue-200'
                          : isDarkMode
                          ? 'hover:bg-white/5'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleMultiSelectChange('states', option.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`ml-3 text-sm flex-1 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                      <span className={`text-xs ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        ({option.count})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Multi-Select Management Type Filter */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Management Type (Multi-Select)
              </h3>
              <div className="space-y-2">
                {managementOptions.map((option) => {
                  const isChecked = (appliedFilters.management || []).includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked
                          ? isDarkMode
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'bg-blue-50 border border-blue-200'
                          : isDarkMode
                          ? 'hover:bg-white/5'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleMultiSelectChange('management', option.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`ml-3 text-sm flex-1 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                      <span className={`text-xs ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        ({option.count})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Multi-Select College Type Filter */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                College Type (Multi-Select)
              </h3>
              <div className="space-y-2">
                {typeOptions.map((option) => {
                  const isChecked = (appliedFilters.type || []).includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked
                          ? isDarkMode
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'bg-blue-50 border border-blue-200'
                          : isDarkMode
                          ? 'hover:bg-white/5'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleMultiSelectChange('type', option.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`ml-3 text-sm flex-1 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                      <span className={`text-xs ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        ({option.count})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Range Filters */}
            <div className="space-y-6">
              {/* Fees Range */}
              <div>
                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  <SlidersHorizontal className="w-4 h-4" />
                  Annual Fees Range
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Min (₹)
                      </label>
                      <input
                        type="number"
                        value={appliedFilters.feesRange?.min || 0}
                        onChange={(e) => handleRangeChange('feesRange', 'min', Number(e.target.value))}
                        placeholder="0"
                        className={`w-full px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none mt-1 ${
                          isDarkMode
                            ? 'bg-white/10 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Max (₹)
                      </label>
                      <input
                        type="number"
                        value={appliedFilters.feesRange?.max || 10000000}
                        onChange={(e) => handleRangeChange('feesRange', 'max', Number(e.target.value))}
                        placeholder="10,00,000"
                        className={`w-full px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none mt-1 ${
                          isDarkMode
                            ? 'bg-white/10 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                  {(appliedFilters.feesRange?.min || appliedFilters.feesRange?.max) && (
                    <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Showing colleges with fees: ₹{(appliedFilters.feesRange?.min || 0).toLocaleString('en-IN')} - ₹{(appliedFilters.feesRange?.max || 10000000).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>

              {/* NIRF Rank Range */}
              <div>
                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  <SlidersHorizontal className="w-4 h-4" />
                  NIRF Rank Range
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Min Rank
                      </label>
                      <input
                        type="number"
                        value={appliedFilters.rankRange?.min || 1}
                        onChange={(e) => handleRangeChange('rankRange', 'min', Number(e.target.value))}
                        placeholder="1"
                        min="1"
                        className={`w-full px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none mt-1 ${
                          isDarkMode
                            ? 'bg-white/10 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Max Rank
                      </label>
                      <input
                        type="number"
                        value={appliedFilters.rankRange?.max || 500}
                        onChange={(e) => handleRangeChange('rankRange', 'max', Number(e.target.value))}
                        placeholder="500"
                        className={`w-full px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none mt-1 ${
                          isDarkMode
                            ? 'bg-white/10 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                  {(appliedFilters.rankRange?.min || appliedFilters.rankRange?.max) && (
                    <p className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Showing colleges ranked: {appliedFilters.rankRange?.min || 1} - {appliedFilters.rankRange?.max || 500}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className={`text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Active Filters:
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(appliedFilters).map(([key, value]) => {
                  if (key === 'sortBy' || !value) return null;

                  if (Array.isArray(value) && value.length > 0) {
                    return value.map((v) => (
                      <span
                        key={`${key}-${v}`}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                          isDarkMode
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {v}
                        <button
                          onClick={() => handleMultiSelectChange(key, v)}
                          className="hover:text-blue-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ));
                  }

                  if (typeof value === 'object' && value !== null) {
                    const rangeText = `${key}: ${value.min || 0} - ${value.max || '∞'}`;
                    return (
                      <span
                        key={key}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                          isDarkMode
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}
                      >
                        {rangeText}
                        <button
                          onClick={() => {
                            const newFilters = { ...appliedFilters };
                            delete newFilters[key];
                            onFilterChange?.(newFilters);
                          }}
                          className="hover:text-purple-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default EnhancedFilters;
