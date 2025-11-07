'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, BookOpen, GraduationCap, BarChart3, Clock } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import dynamic from 'next/dynamic';

const SearchBar = dynamic(() => import('@/components/search/SearchBar'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 rounded-lg"></div>,
  ssr: false
});

const AISearch = dynamic(() => import('@/components/ai/AISearch'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 rounded-lg"></div>,
  ssr: false
});

const Filters = dynamic(() => import('@/components/search/Filters'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>,
  ssr: false
});

const AdvancedSearch = dynamic(() => import('@/components/search/AdvancedSearch'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>,
  ssr: false
});
import { SearchResult, SearchFilters, FilterOptions } from '@/types';
import { apiService } from '@/services/api';

const SearchPage: React.FC = () => {
  const searchParams = useSearchParams();
  const [searchResult, setSearchResult] = useState<SearchResult>({
    colleges: [],
    courses: [],
    cutoffs: [],
    total_results: 0,
    search_time: 0,
    suggestions: []
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    streams: [],
    branches: [],
    management_types: [],
    states: [],
    cities: [],
    degree_types: []
  });
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'colleges' | 'courses' | 'cutoffs'>('all');
  const [useAISearch, setUseAISearch] = useState(true);
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);

  // Initialize search query from URL
  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
    if (query) {
      performSearch(query);
    }
  }, [searchParams]);

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await apiService.getCollegeFilters();
        if (response.success) {
          setFilterOptions(response.data);
        }
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };

    loadFilterOptions();
  }, []);

  const performSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (useAISearch) {
        // Use AI-powered search
        const { autoRAGService } = await import('@/services/autorag');
        const result = await autoRAGService.search({
          query,
          filters
        });
        response = { success: true, data: result };
      } else {
        // Use regular API search
        response = await apiService.unifiedSearch({
          query,
          filters
        });
      }
      
      if (response.success) {
        setSearchResult(response.data);
      } else {
        setError(response.error || 'Search failed');
      }
    } catch (err) {
      setError('Search failed');
      console.error('Error performing search:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
  };

  const handleAdvancedSearch = (searchFilters: any) => {
    setFilters(searchFilters);
    setSearchQuery(searchFilters.query || '');
    if (searchFilters.query) {
      performSearch(searchFilters.query);
    }
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (searchQuery) {
      performSearch(searchQuery);
    }
  };

  const getFilteredResults = () => {
    switch (activeTab) {
      case 'colleges':
        return searchResult.colleges;
      case 'courses':
        return searchResult.courses;
      case 'cutoffs':
        return searchResult.cutoffs;
      default:
        return {
          colleges: searchResult.colleges,
          courses: searchResult.courses,
          cutoffs: searchResult.cutoffs
        };
    }
  };

  const getResultCount = () => {
    switch (activeTab) {
      case 'colleges':
        return searchResult.colleges.length;
      case 'courses':
        return searchResult.courses.length;
      case 'cutoffs':
        return searchResult.cutoffs.length;
      default:
        return searchResult.total_results;
    }
  };

  const CollegeCard: React.FC<{ college: any }> = ({ college }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {college.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {college.city}, {college.state}
          </p>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
              {college.stream}
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
              {college.management_type}
            </span>
          </div>
        </div>
      </div>
      <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
        View Details
      </button>
    </div>
  );

  const CourseCard: React.FC<{ course: any }> = ({ course }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {course.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {course.college_name}
          </p>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
              {course.stream}
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
              {course.branch}
            </span>
          </div>
        </div>
      </div>
      <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
        View Details
      </button>
    </div>
  );

  const CutoffCard: React.FC<{ cutoff: any }> = ({ cutoff }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {cutoff.college_name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {cutoff.course_name}
          </p>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
              {cutoff.category}
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
              {cutoff.year}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {cutoff.opening_rank}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Opening</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {cutoff.closing_rank}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Closing</div>
        </div>
      </div>
      <button className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
        View Details
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Search Results
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Find colleges, courses, and cutoffs that match your criteria.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            {/* Search Mode Toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Search Mode
              </h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setUseAISearch(true);
                    setUseAdvancedSearch(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    useAISearch && !useAdvancedSearch
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  🤖 AI Search
                </button>
                <button
                  onClick={() => {
                    setUseAISearch(false);
                    setUseAdvancedSearch(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useAISearch && !useAdvancedSearch
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  🔍 Regular Search
                </button>
                <button
                  onClick={() => {
                    setUseAISearch(false);
                    setUseAdvancedSearch(true);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    useAdvancedSearch
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  ⚙️ Advanced Search
                </button>
              </div>
            </div>

            {useAISearch ? (
              <AISearch
                onSearchResult={(result) => {
                  setSearchResult(result);
                  setSearchQuery(result.suggestions?.[0] || '');
                }}
              />
            ) : useAdvancedSearch ? (
              <AdvancedSearch
                onSearch={handleAdvancedSearch}
              />
            ) : (
              <>
                <SearchBar
                  placeholder="Search colleges, courses, cutoffs..."
                  onSearch={handleSearch}
                  suggestions={searchResult.suggestions || []}
                />
                <Filters
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  filterOptions={filterOptions}
                />
              </>
            )}
          </div>

          {/* Results Summary */}
          {searchQuery && (
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {loading ? 'Searching...' : `${getResultCount()} results found for "${searchQuery}"`}
                </h2>
                {searchResult.search_time > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {searchResult.search_time}ms
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Results Tabs */}
          {searchQuery && (
            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'all'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    All Results ({searchResult.total_results})
                  </button>
                  <button
                    onClick={() => setActiveTab('colleges')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'colleges'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Colleges ({searchResult.colleges.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'courses'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Courses ({searchResult.courses.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('cutoffs')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'cutoffs'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    Cutoffs ({searchResult.cutoffs.length})
                  </button>
                </nav>
              </div>
            </div>
          )}

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <>
              {/* All Results */}
              {activeTab === 'all' && (
                <div className="space-y-8">
                  {/* Colleges Section */}
                  {searchResult.colleges.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <GraduationCap className="h-5 w-5 mr-2" />
                        Colleges ({searchResult.colleges.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResult.colleges.slice(0, 3).map((college) => (
                          <CollegeCard key={college.id} college={college} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Courses Section */}
                  {searchResult.courses.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <BookOpen className="h-5 w-5 mr-2" />
                        Courses ({searchResult.courses.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResult.courses.slice(0, 3).map((course) => (
                          <CourseCard key={course.id} course={course} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cutoffs Section */}
                  {searchResult.cutoffs.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <BarChart3 className="h-5 w-5 mr-2" />
                        Cutoffs ({searchResult.cutoffs.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResult.cutoffs.slice(0, 3).map((cutoff) => (
                          <CutoffCard key={cutoff.id} cutoff={cutoff} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Individual Tab Results */}
              {activeTab !== 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeTab === 'colleges' && searchResult.colleges.map((college) => (
                    <CollegeCard key={college.id} college={college} />
                  ))}
                  {activeTab === 'courses' && searchResult.courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                  {activeTab === 'cutoffs' && searchResult.cutoffs.map((cutoff) => (
                    <CutoffCard key={cutoff.id} cutoff={cutoff} />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {getResultCount() === 0 && !loading && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No results found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Try adjusting your search criteria or filters.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Start your search
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enter a search term to find colleges, courses, and cutoffs.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SearchPage;
