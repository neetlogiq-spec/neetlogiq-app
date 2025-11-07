'use client';

import React, { useState, useMemo } from 'react';
import { useStreamDataService } from '@/services/StreamDataService';
import { useTheme } from '@/contexts/ThemeContext';
import StreamAwareComponent from './StreamAwareComponent';
import CollegeCard from '../colleges/CollegeCard';
import ProgressionContext from './ProgressionContext';
import StreamSpecificFilter from './StreamSpecificFilter';
import CourseLevelBadge from './CourseLevelBadge';

interface StreamSpecificCollegesGridProps {
  className?: string;
  showAllData?: boolean;
}

const StreamSpecificCollegesGrid: React.FC<StreamSpecificCollegesGridProps> = ({
  className = '',
  showAllData = false
}) => {
  const { isDarkMode } = useTheme();
  const { 
    colleges, 
    allColleges, 
    currentStream, 
    streamConfig, 
    loading, 
    error,
    getCourseLevel,
    getCourseStream,
    getProgressionContext
  } = useStreamDataService();
  
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [streamFilters, setStreamFilters] = useState({
    courseLevel: 'all',
    courseType: 'all',
    collegeType: 'all'
  });

  // Use filtered colleges or all colleges based on showAllData prop
  const displayColleges = showAllData ? allColleges : colleges;

  // Filter colleges by search query and stream filters
  const filteredColleges = useMemo(() => {
    let result = displayColleges;
    
    // Apply search query
    if (searchQuery) {
      result = result.filter(college => 
        college.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        college.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        college.state?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply stream filters
    if (streamFilters.courseLevel !== 'all') {
      result = result.filter(college => {
        const collegeCourses = college.courses || [];
        return collegeCourses.some((course: any) => {
          const level = getCourseLevel(course.name || '');
          return level === streamFilters.courseLevel;
        });
      });
    }

    if (streamFilters.courseType !== 'all') {
      result = result.filter(college => {
        const collegeCourses = college.courses || [];
        return collegeCourses.some((course: any) => {
          const courseName = course.name || '';
          return courseName.startsWith(streamFilters.courseType);
        });
      });
    }

    if (streamFilters.collegeType !== 'all') {
      result = result.filter(college => {
        const collegeType = college.type || college.college_type;
        return collegeType === streamFilters.collegeType;
      });
    }
    
    return result;
  }, [displayColleges, searchQuery, streamFilters, getCourseLevel]);

  // Get stream-specific title
  const getStreamTitle = (stream: string) => {
    switch (stream) {
      case 'UG':
        return 'All Colleges & Courses';
      case 'PG_MEDICAL':
        return 'Medical & DNB Colleges & Courses (Including Diplomas) - Excludes Dental';
      case 'PG_DENTAL':
        return 'Dental Colleges & Courses (Including PG Diplomas) - Excludes Medical';
      default:
        return 'Colleges & Courses';
    }
  };

  // Get stream-specific description
  const getStreamDescription = (stream: string) => {
    switch (stream) {
      case 'UG':
        return 'All medical and dental colleges offering undergraduate courses';
      case 'PG_MEDICAL':
        return 'Medical and DNB colleges offering undergraduate and postgraduate medical courses including diplomas (dental courses excluded)';
      case 'PG_DENTAL':
        return 'Dental colleges offering undergraduate and postgraduate dental courses including PG diplomas (medical courses excluded)';
      default:
        return 'Colleges and courses data';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading {streamConfig?.name || 'colleges'} data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
            Error loading colleges: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <StreamAwareComponent requireStream={true}>
      {({ currentStream, streamConfig, isStreamSelected }) => (
        <div className={`space-y-6 ${className}`}>
          {/* Stream-specific header */}
          <div className="text-center">
            <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {getStreamTitle(currentStream || '')}
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {getStreamDescription(currentStream || '')}
            </p>
            {streamConfig && (
              <div className={`mt-2 px-3 py-1 rounded-full text-xs inline-block ${
                isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
              }`}>
                {streamConfig.description}
              </div>
            )}
          </div>

          {/* Progression Context */}
          <ProgressionContext
            context={getProgressionContext()}
            currentStream={currentStream || ''}
          />

          {/* Search and view controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search colleges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
            
            <div className="flex gap-2">
              <StreamSpecificFilter
                currentStream={currentStream}
                streamConfig={streamConfig}
                onFilterChange={setStreamFilters}
              />
              <button
                onClick={() => setViewType('grid')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewType === 'grid'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewType === 'list'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                List
              </button>
            </div>
          </div>

          {/* Stream-specific statistics */}
          {filteredColleges.length > 0 && (
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {filteredColleges.length}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Colleges
                  </p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {new Set(filteredColleges.map(c => c.state)).size}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    States
                  </p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    {filteredColleges.reduce((sum, c) => sum + (c.course_count || 0), 0)}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Courses
                  </p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                    {new Set(filteredColleges.map(c => c.management_type)).size}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Management Types
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Colleges grid/list */}
          {filteredColleges.length > 0 ? (
            <div className={
              viewType === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }>
              {filteredColleges.map((college) => (
                <CollegeCard
                  key={college.id}
                  college={college}
                  isDarkMode={isDarkMode}
                  viewType={viewType}
                />
              ))}
            </div>
          ) : (
            <div className={`text-center py-12 ${className}`}>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  No colleges found
                </p>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {searchQuery ? 'Try adjusting your search terms' : 'No colleges available for this stream'}
                </p>
              </div>
            </div>
          )}

          {/* Stream-specific insights */}
          {filteredColleges.length > 0 && (
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {streamConfig?.name} Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className={`font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    College Types
                  </h4>
                  <div className="space-y-1">
                    {streamConfig?.collegeTypes.map(type => {
                      const count = filteredColleges.filter(c => c.type === type).length;
                      return (
                        <div key={type} className="flex justify-between text-sm">
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{type}</span>
                          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-900'}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className={`font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Management Types
                  </h4>
                  <div className="space-y-1">
                    {Array.from(new Set(filteredColleges.map(c => c.management_type))).map(type => {
                      const count = filteredColleges.filter(c => c.management_type === type).length;
                      return (
                        <div key={type} className="flex justify-between text-sm">
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{type}</span>
                          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-900'}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </StreamAwareComponent>
  );
};

export default StreamSpecificCollegesGrid;
