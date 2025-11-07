'use client';

import React, { useState } from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { StreamType } from '@/services/StreamDataService';

interface StreamSpecificFilterProps {
  currentStream: StreamType | null;
  streamConfig: any;
  onFilterChange: (filters: any) => void;
  className?: string;
}

const StreamSpecificFilter: React.FC<StreamSpecificFilterProps> = ({
  currentStream,
  streamConfig,
  onFilterChange,
  className = ''
}) => {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    courseLevel: 'all', // UG, PG, all
    courseType: 'all',  // Specific course types
    collegeType: 'all'  // MEDICAL, DENTAL, DNB, all
  });

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const resetFilters = () => {
    const resetFilters = {
      courseLevel: 'all',
      courseType: 'all',
      collegeType: 'all'
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const getCourseLevelOptions = () => {
    if (!streamConfig) return [];
    
    const options = [{ value: 'all', label: 'All Levels' }];
    
    if (streamConfig.showCourses.includes('MBBS') || streamConfig.showCourses.includes('BDS')) {
      options.push({ value: 'UG', label: 'Undergraduate' });
    }
    
    if (streamConfig.showCourses.some((course: string) => 
      ['MD', 'MS', 'DM', 'MCH', 'DNB', 'MDS'].includes(course)
    )) {
      options.push({ value: 'PG', label: 'Postgraduate' });
    }
    
    return options;
  };

  const getCourseTypeOptions = () => {
    if (!streamConfig) return [];
    
    const options = [{ value: 'all', label: 'All Courses' }];
    
    streamConfig.showCourses.forEach((course: string) => {
      options.push({ value: course, label: course });
    });
    
    return options;
  };

  const getCollegeTypeOptions = () => {
    if (!streamConfig) return [];
    
    const options = [{ value: 'all', label: 'All Types' }];
    
    if (streamConfig.collegeTypes.includes('MEDICAL')) {
      options.push({ value: 'MEDICAL', label: 'Medical' });
    }
    if (streamConfig.collegeTypes.includes('DENTAL')) {
      options.push({ value: 'DENTAL', label: 'Dental' });
    }
    if (streamConfig.collegeTypes.includes('DNB')) {
      options.push({ value: 'DNB', label: 'DNB' });
    }
    
    return options;
  };

  const activeFiltersCount = Object.values(filters).filter(value => value !== 'all').length;

  return (
    <div className={`relative ${className}`}>
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          isDarkMode
            ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        } ${activeFiltersCount > 0 ? 'ring-2 ring-blue-500' : ''}`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filter</span>
        {activeFiltersCount > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className={`absolute top-full left-0 mt-2 w-80 p-4 rounded-lg border shadow-lg z-50 ${
          isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Filter by {streamConfig?.name || 'Stream'}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-1 rounded ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Course Level Filter */}
            <div>
              <label className={`block text-xs font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Course Level
              </label>
              <select
                value={filters.courseLevel}
                onChange={(e) => handleFilterChange('courseLevel', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {getCourseLevelOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Type Filter */}
            <div>
              <label className={`block text-xs font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Course Type
              </label>
              <select
                value={filters.courseType}
                onChange={(e) => handleFilterChange('courseType', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {getCourseTypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* College Type Filter */}
            <div>
              <label className={`block text-xs font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                College Type
              </label>
              <select
                value={filters.collegeType}
                onChange={(e) => handleFilterChange('collegeType', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {getCollegeTypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={resetFilters}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamSpecificFilter;
