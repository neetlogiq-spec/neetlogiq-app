'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Filter, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface CollegeFiltersProps {
  states: FilterOption[];
  types: FilterOption[];
  selectedState: string;
  selectedType: string;
  onStateChange: (state: string) => void;
  onTypeChange: (type: string) => void;
  onClearFilters: () => void;
}

const CollegeFilters: React.FC<CollegeFiltersProps> = ({
  states,
  types,
  selectedState,
  selectedType,
  onStateChange,
  onTypeChange,
  onClearFilters
}) => {
  const hasActiveFilters = selectedState !== 'all' || selectedType !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Filter Colleges
          </h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <X className="h-4 w-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* State Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            State
          </label>
          <select
            value={selectedState}
            onChange={(e) => onStateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All States</option>
            {states.map((state) => (
              <option key={state.value} value={state.value}>
                {state.label} {state.count && `(${state.count})`}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            College Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label} {type.count && `(${type.count})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {selectedState !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                State: {states.find(s => s.value === selectedState)?.label}
                <button
                  onClick={() => onStateChange('all')}
                  className="ml-2 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedType !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                Type: {types.find(t => t.value === selectedType)?.label}
                <button
                  onClick={() => onTypeChange('all')}
                  className="ml-2 hover:text-green-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CollegeFilters;
