'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Filter, X, ChevronDown, Check } from 'lucide-react';

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
  filters: {
    available: FilterGroup[];
  };
  appliedFilters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
  onClearFilters: () => void;
  type: 'colleges' | 'courses';
}

const IntelligentFilters: React.FC<IntelligentFiltersProps> = ({
  filters,
  appliedFilters,
  onFilterChange,
  onClearFilters,
  type
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<Record<string, any>>(appliedFilters);

  // Update local filters when applied filters change
  useEffect(() => {
    setLocalFilters(appliedFilters);
  }, [appliedFilters]);

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    setLocalFilters({});
    onClearFilters();
  };

  const getActiveFilterCount = () => {
    return Object.values(appliedFilters).filter(value => 
      value !== null && value !== undefined && value !== '' && 
      (Array.isArray(value) ? value.length > 0 : true)
    ).length;
  };

  const activeFilterCount = getActiveFilterCount();

  // Default filter groups if none provided
  const defaultFilters: FilterGroup[] = [
    {
      key: 'state',
      label: 'State',
      type: 'select',
      options: [
        { value: 'all', label: 'All States', count: 0 },
        { value: 'delhi', label: 'Delhi', count: 15 },
        { value: 'maharashtra', label: 'Maharashtra', count: 45 },
        { value: 'karnataka', label: 'Karnataka', count: 25 },
        { value: 'tamil-nadu', label: 'Tamil Nadu', count: 30 },
        { value: 'west-bengal', label: 'West Bengal', count: 20 },
        { value: 'gujarat', label: 'Gujarat', count: 18 },
        { value: 'rajasthan', label: 'Rajasthan', count: 22 },
      ]
    },
    {
      key: 'management_type',
      label: 'Management Type',
      type: 'select',
      options: [
        { value: 'all', label: 'All Types', count: 0 },
        { value: 'government', label: 'Government', count: 120 },
        { value: 'private', label: 'Private', count: 80 },
        { value: 'deemed', label: 'Deemed University', count: 25 },
        { value: 'central', label: 'Central University', count: 15 },
      ]
    },
    {
      key: 'college_type',
      label: 'College Type',
      type: 'multiselect',
      options: [
        { value: 'medical', label: 'Medical', count: 200 },
        { value: 'dental', label: 'Dental', count: 150 },
        { value: 'dnb', label: 'DNB', count: 100 },
        { value: 'ayush', label: 'AYUSH', count: 50 },
      ]
    }
  ];

  // Ensure filterGroups is always an array
  const filterGroups = Array.isArray(filters?.available) ? filters.available : defaultFilters;

  return (
    <div className="w-full">
      {/* Filter Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Filter className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Intelligent Filters
          </h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {activeFilterCount} active
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:text-red-600 hover:bg-red-100"
            >
              Clear All
            </button>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-600"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`} />
          </button>
        </div>
      </div>

      {/* Filter Content */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="p-6 rounded-xl border-2 bg-white/50 border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filterGroups.map((group) => (
              <div key={group.key} className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  {group.label}
                </label>
                
                {group.type === 'select' && (
                  <select
                    value={localFilters[group.key] || 'all'}
                    onChange={(e) => handleFilterChange(group.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border transition-colors bg-white border-gray-300 text-gray-900 focus:border-blue-500"
                  >
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} {option.count ? `(${option.count})` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {group.type === 'multiselect' && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {group.options.map((option) => {
                      const isSelected = localFilters[group.key]?.includes(option.value) || false;
                      return (
                        <label
                          key={option.value}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-blue-100 text-blue-800'
                                ? 'hover:bg-gray-700 text-gray-300'
                                : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const currentValues = localFilters[group.key] || [];
                              const newValues = e.target.checked
                                ? [...currentValues, option.value]
                                : currentValues.filter((v: string) => v !== option.value);
                              handleFilterChange(group.key, newValues);
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm">{option.label}</span>
                          {option.count && (
                            <span className="text-xs text-gray-500">
                              ({option.count})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                {group.type === 'range' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={localFilters[`${group.key}_min`] || ''}
                        onChange={(e) => handleFilterChange(`${group.key}_min`, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm bg-white border-gray-300 text-gray-900"
                      />
                      <span className="text-sm text-gray-600">to</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={localFilters[`${group.key}_max`] || ''}
                        onChange={(e) => handleFilterChange(`${group.key}_max`, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm bg-white border-gray-300 text-gray-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default IntelligentFilters;
