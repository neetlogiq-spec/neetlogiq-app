'use client';

import React, { useState, useMemo } from 'react';
import { useStreamDataService } from '@/services/StreamDataService';
import { useTheme } from '@/contexts/ThemeContext';
import StreamAwareComponent from './StreamAwareComponent';
import EnhancedExcelTable from '../cutoffs/EnhancedExcelTable';
import ProgressionContext from './ProgressionContext';
import StreamSpecificFilter from './StreamSpecificFilter';

interface StreamSpecificCutoffsTableProps {
  className?: string;
}

const StreamSpecificCutoffsTable: React.FC<StreamSpecificCutoffsTableProps> = ({
  className = ''
}) => {
  const { isDarkMode } = useTheme();
  const { 
    cutoffs, 
    currentStream, 
    streamConfig, 
    loading, 
    error,
    getCourseLevel,
    getCourseStream,
    getProgressionContext
  } = useStreamDataService();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [sorting, setSorting] = useState({});
  const [streamFilters, setStreamFilters] = useState({
    courseLevel: 'all',
    courseType: 'all',
    collegeType: 'all'
  });

  // Get stream-specific columns
  const getStreamColumns = (stream: string) => {
    const baseColumns = [
      { key: 'college_name', label: 'College', sortable: true, width: 200 },
      { key: 'course_name', label: 'Course', sortable: true, width: 150 },
      { key: 'category', label: 'Category', sortable: true, width: 120 },
      { key: 'round_1', label: 'Round 1', sortable: true, width: 100 },
      { key: 'round_2', label: 'Round 2', sortable: true, width: 100 },
      { key: 'round_3', label: 'Round 3', sortable: true, width: 100 },
      { key: 'round_4', label: 'Round 4', sortable: true, width: 100 }
    ];

    switch (stream) {
      case 'UG':
        return [
          ...baseColumns,
          { key: 'state_quota', label: 'State/Quota', sortable: true, width: 120 },
          { key: 'management_type', label: 'Management', sortable: true, width: 120 }
        ];
      
      case 'PG_MEDICAL':
        return [
          ...baseColumns,
          { key: 'specialization', label: 'Specialization', sortable: true, width: 150 },
          { key: 'college_type', label: 'College Type', sortable: true, width: 120 },
          { key: 'research_opportunity', label: 'Research', sortable: true, width: 100 }
        ];
      
      case 'PG_DENTAL':
        return [
          ...baseColumns,
          { key: 'specialization', label: 'Specialization', sortable: true, width: 150 },
          { key: 'college_type', label: 'College Type', sortable: true, width: 120 }
        ];
      
      default:
        return baseColumns;
    }
  };

  const columns = useMemo(() => {
    return getStreamColumns(currentStream || '');
  }, [currentStream]);

  // Apply stream-specific filters
  const filteredCutoffs = useMemo(() => {
    let result = cutoffs || [];

    // Apply stream filters
    if (streamFilters.courseLevel !== 'all') {
      result = result.filter(cutoff => {
        const level = getCourseLevel(cutoff.course_name || '');
        return level === streamFilters.courseLevel;
      });
    }

    if (streamFilters.courseType !== 'all') {
      result = result.filter(cutoff => {
        const courseName = cutoff.course_name || '';
        return courseName.startsWith(streamFilters.courseType);
      });
    }

    if (streamFilters.collegeType !== 'all') {
      result = result.filter(cutoff => {
        const collegeType = cutoff.college_type || cutoff.type;
        return collegeType === streamFilters.collegeType;
      });
    }

    return result;
  }, [cutoffs, streamFilters, getCourseLevel]);

  // Get stream-specific title
  const getStreamTitle = (stream: string) => {
    switch (stream) {
      case 'UG':
        return 'UG Cutoffs (MBBS, BDS)';
      case 'PG_MEDICAL':
        return 'PG Medical Cutoffs (MD, MS, DM, MCh, DNB, DIPLOMA) - Excludes Dental';
      case 'PG_DENTAL':
        return 'PG Dental Cutoffs (MDS, PG DIPLOMA) - Excludes Medical';
      default:
        return 'Cutoffs';
    }
  };

  // Get stream-specific description
  const getStreamDescription = (stream: string) => {
    switch (stream) {
      case 'UG':
        return 'Undergraduate medical and dental course cutoffs from all colleges';
      case 'PG_MEDICAL':
        return 'Postgraduate medical course cutoffs including diplomas from medical and DNB colleges (dental courses excluded)';
      case 'PG_DENTAL':
        return 'Postgraduate dental course cutoffs including PG diplomas from dental colleges (medical courses excluded)';
      default:
        return 'Course cutoffs data';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Loading {streamConfig?.name || 'cutoffs'} data...
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
            Error loading cutoffs: {error}
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

          {/* Stream-specific filter */}
          <div className="flex justify-end">
            <StreamSpecificFilter
              currentStream={currentStream}
              streamConfig={streamConfig}
              onFilterChange={setStreamFilters}
            />
          </div>

          {/* Stream-specific statistics */}
          {filteredCutoffs.length > 0 && (
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {filteredCutoffs.length}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Cutoffs
                  </p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {new Set(filteredCutoffs.map(c => c.college_name)).size}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Colleges
                  </p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    {new Set(filteredCutoffs.map(c => c.course_name)).size}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Courses
                  </p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                    {new Set(filteredCutoffs.map(c => c.category)).size}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Categories
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Excel Table */}
          <EnhancedExcelTable
            data={filteredCutoffs}
            columns={columns}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            sorting={sorting}
            onSortingChange={setSorting}
            enableWebAssembly={true}
            enableVirtualization={true}
            enableAI={true}
            pageSize={50}
            className="min-h-[400px]"
          />

          {/* Stream-specific insights */}
          {filteredCutoffs.length > 0 && (
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
                      const count = filteredCutoffs.filter(c => c.college_type === type).length;
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
                    Course Types
                  </h4>
                  <div className="space-y-1">
                    {streamConfig?.cutoffFilter.map(type => {
                      const count = filteredCutoffs.filter(c => c.course_name?.startsWith(type)).length;
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

export default StreamSpecificCutoffsTable;
