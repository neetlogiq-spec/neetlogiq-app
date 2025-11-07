'use client';

import React, { useState } from 'react';
import { Search, Filter, MapPin, GraduationCap, DollarSign, Star, X } from 'lucide-react';

interface SearchFilters {
  query: string;
  state: string;
  city: string;
  courseType: string;
  managementType: string;
  minFees: string;
  maxFees: string;
  minRating: string;
  establishmentYear: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  className?: string;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onSearch, className = '' }) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    state: '',
    city: '',
    courseType: '',
    managementType: '',
    minFees: '',
    maxFees: '',
    minRating: '',
    establishmentYear: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal'
  ];

  const courseTypes = [
    'MBBS', 'BDS', 'MD', 'MS', 'DM', 'MCh', 'BSc Nursing', 'MSc Nursing',
    'BPT', 'MPT', 'BPharm', 'MPharm', 'BSc Allied Health', 'MSc Allied Health'
  ];

  const managementTypes = [
    'Government', 'Private', 'Deemed University', 'Central University',
    'State University', 'Autonomous'
  ];

  const handleInputChange = (field: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    onSearch(filters);
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      state: '',
      city: '',
      courseType: '',
      managementType: '',
      minFees: '',
      maxFees: '',
      minRating: '',
      establishmentYear: ''
    });
  };

  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Search Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
          <Search className="h-5 w-5 mr-2 text-blue-600" />
          Advanced Search
        </h2>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showAdvanced ? 'Hide' : 'Show'} Filters
          {activeFiltersCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Basic Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search colleges, courses, or any medical education topic..."
            value={filters.query}
            onChange={(e) => handleInputChange('query', e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="space-y-6 mb-6">
          {/* Location Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-green-600" />
              Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  State
                </label>
                <select
                  value={filters.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select State</option>
                  {states.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Enter city name"
                  value={filters.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Course & Management Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <GraduationCap className="h-4 w-4 mr-2 text-purple-600" />
              Course & Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Course Type
                </label>
                <select
                  value={filters.courseType}
                  onChange={(e) => handleInputChange('courseType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Course Type</option>
                  {courseTypes.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Management Type
                </label>
                <select
                  value={filters.managementType}
                  onChange={(e) => handleInputChange('managementType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Management Type</option>
                  {managementTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Financial Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <DollarSign className="h-4 w-4 mr-2 text-green-600" />
              Financial Range
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Min Fees (₹)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minFees}
                  onChange={(e) => handleInputChange('minFees', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Max Fees (₹)
                </label>
                <input
                  type="number"
                  placeholder="1000000"
                  value={filters.maxFees}
                  onChange={(e) => handleInputChange('maxFees', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Quality Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <Star className="h-4 w-4 mr-2 text-yellow-600" />
              Quality & Establishment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Min Rating
                </label>
                <select
                  value={filters.minRating}
                  onChange={(e) => handleInputChange('minRating', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Any Rating</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4.0">4.0+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                  <option value="3.0">3.0+ Stars</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Establishment Year
                </label>
                <input
                  type="number"
                  placeholder="e.g., 1950"
                  value={filters.establishmentYear}
                  onChange={(e) => handleInputChange('establishmentYear', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={clearFilters}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="h-4 w-4 mr-2" />
          Clear All
        </button>
        <button
          onClick={handleSearch}
          className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Search className="h-4 w-4 mr-2" />
          Search
        </button>
      </div>
    </div>
  );
};

export default AdvancedSearch;

