'use client';

import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { FilterOptions, SearchFilters } from '@/types';

interface FiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  filterOptions: FilterOptions;
  className?: string;
}

const Filters: React.FC<FiltersProps> = ({
  filters,
  onFiltersChange,
  filterOptions,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const getActiveFiltersCount = () => {
    return Object.keys(filters).length;
  };

  const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{title}</h3>
      {children}
    </div>
  );

  const FilterChip = ({ label, value, onRemove }: { label: string; value: any; onRemove: () => void }) => (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-2 mb-2">
      {label}: {value}
      <button
        onClick={onRemove}
        className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Filter Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filters
            </h2>
            {getActiveFiltersCount() > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                {getActiveFiltersCount()}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {getActiveFiltersCount() > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Active Filters */}
        {getActiveFiltersCount() > 0 && (
          <div className="mt-3 flex flex-wrap">
            {filters.stream && (
              <FilterChip
                label="Stream"
                value={filters.stream}
                onRemove={() => clearFilter('stream')}
              />
            )}
            {filters.branch && (
              <FilterChip
                label="Branch"
                value={filters.branch}
                onRemove={() => clearFilter('branch')}
              />
            )}
            {filters.management_type && (
              <FilterChip
                label="Management"
                value={filters.management_type}
                onRemove={() => clearFilter('management_type')}
              />
            )}
            {filters.state && (
              <FilterChip
                label="State"
                value={filters.state}
                onRemove={() => clearFilter('state')}
              />
            )}
            {filters.city && (
              <FilterChip
                label="City"
                value={filters.city}
                onRemove={() => clearFilter('city')}
              />
            )}
          </div>
        )}
      </div>

      {/* Filter Content */}
      <div className={`p-4 ${isOpen ? 'block' : 'hidden md:block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Stream Filter */}
          <FilterSection title="Stream">
            <div className="space-y-2">
              {filterOptions.streams.map((stream) => (
                <label key={stream.value} className="flex items-center">
                  <input
                    type="radio"
                    name="stream"
                    value={stream.value}
                    checked={filters.stream === stream.value}
                    onChange={(e) => handleFilterChange('stream', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {stream.label} ({stream.count})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Branch Filter */}
          <FilterSection title="Branch">
            <div className="space-y-2">
              {filterOptions.branches.map((branch) => (
                <label key={branch.value} className="flex items-center">
                  <input
                    type="radio"
                    name="branch"
                    value={branch.value}
                    checked={filters.branch === branch.value}
                    onChange={(e) => handleFilterChange('branch', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {branch.label} ({branch.count})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Management Type Filter */}
          <FilterSection title="Management Type">
            <div className="space-y-2">
              {filterOptions.management_types.map((type) => (
                <label key={type.value} className="flex items-center">
                  <input
                    type="radio"
                    name="management_type"
                    value={type.value}
                    checked={filters.management_type === type.value}
                    onChange={(e) => handleFilterChange('management_type', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {type.label} ({type.count})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* State Filter */}
          <FilterSection title="State">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filterOptions.states.map((state) => (
                <label key={state.value} className="flex items-center">
                  <input
                    type="radio"
                    name="state"
                    value={state.value}
                    checked={filters.state === state.value}
                    onChange={(e) => handleFilterChange('state', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {state.label} ({state.count})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* City Filter */}
          <FilterSection title="City">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filterOptions.cities.map((city) => (
                <label key={city.value} className="flex items-center">
                  <input
                    type="radio"
                    name="city"
                    value={city.value}
                    checked={filters.city === city.value}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {city.label} ({city.count})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Degree Type Filter */}
          <FilterSection title="Degree Type">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {filterOptions.degree_types.map((degree) => (
                <label key={degree.value} className="flex items-center">
                  <input
                    type="radio"
                    name="degree_type"
                    value={degree.value}
                    checked={filters.degree_type === degree.value}
                    onChange={(e) => handleFilterChange('degree_type', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {degree.label} ({degree.count})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>
        </div>
      </div>
    </div>
  );
};

export default Filters;
