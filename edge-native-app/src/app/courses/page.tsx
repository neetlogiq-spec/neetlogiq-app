'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Search } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import CourseCollegesModal from '@/components/modals/CourseCollegesModal';
import InfiniteScrollTrigger from '@/components/ui/InfiniteScrollTrigger';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';

interface Course {
  id?: string;
  course_name?: string;
  name?: string;
  stream?: string;
  branch?: string;
  level?: string;
  duration?: string;
  total_seats?: number;
  total_colleges?: number;
  college_names?: string;
  colleges?: any[];
}

interface College {
  id: string;
  name: string;
  state: string;
  district?: string;
  management_type?: string;
  college_type?: string;
}

const CoursesPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isDarkMode } = useTheme();
  const { isAuthenticated } = useAuth();

  // Filter state
  const [selectedStream, setSelectedStream] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  // Data state
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Modal state
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isCollegesModalOpen, setIsCollegesModalOpen] = useState(false);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    totalPages: 1,
    totalItems: 0,
    hasNext: true
  });

  // Mock data for demonstration
  const mockCourses: Course[] = [
    {
      id: '1',
      course_name: 'MBBS',
      stream: 'MEDICAL',
      branch: 'UG',
      level: 'Undergraduate',
      duration: '5.5 years',
      total_seats: 50000,
      total_colleges: 500,
      colleges: [
        { id: '1', name: 'AIIMS Delhi', state: 'Delhi', management_type: 'GOVERNMENT', total_seats: 100 },
        { id: '2', name: 'JIPMER Puducherry', state: 'Puducherry', management_type: 'GOVERNMENT', total_seats: 80 },
        { id: '3', name: 'KGMU Lucknow', state: 'Uttar Pradesh', management_type: 'GOVERNMENT', total_seats: 120 }
      ]
    },
    {
      id: '2',
      course_name: 'BDS',
      stream: 'DENTAL',
      branch: 'UG',
      level: 'Undergraduate',
      duration: '5 years',
      total_seats: 25000,
      total_colleges: 300,
      colleges: [
        { id: '4', name: 'Maulana Azad Medical College', state: 'Delhi', management_type: 'GOVERNMENT', total_seats: 50 },
        { id: '5', name: 'Grant Medical College', state: 'Maharashtra', management_type: 'GOVERNMENT', total_seats: 40 }
      ]
    },
    {
      id: '3',
      course_name: 'MD - General Medicine',
      stream: 'MEDICAL',
      branch: 'PG',
      level: 'Postgraduate',
      duration: '3 years',
      total_seats: 5000,
      total_colleges: 200,
      colleges: [
        { id: '1', name: 'AIIMS Delhi', state: 'Delhi', management_type: 'GOVERNMENT', total_seats: 15 },
        { id: '2', name: 'JIPMER Puducherry', state: 'Puducherry', management_type: 'GOVERNMENT', total_seats: 12 }
      ]
    },
    {
      id: '4',
      course_name: 'MS - General Surgery',
      stream: 'MEDICAL',
      branch: 'PG',
      level: 'Postgraduate',
      duration: '3 years',
      total_seats: 3000,
      total_colleges: 150,
      colleges: [
        { id: '1', name: 'AIIMS Delhi', state: 'Delhi', management_type: 'GOVERNMENT', total_seats: 10 },
        { id: '3', name: 'KGMU Lucknow', state: 'Uttar Pradesh', management_type: 'GOVERNMENT', total_seats: 8 }
      ]
    },
    {
      id: '5',
      course_name: 'MDS - Orthodontics',
      stream: 'DENTAL',
      branch: 'PG',
      level: 'Postgraduate',
      duration: '3 years',
      total_seats: 800,
      total_colleges: 50,
      colleges: [
        { id: '4', name: 'Maulana Azad Medical College', state: 'Delhi', management_type: 'GOVERNMENT', total_seats: 5 },
        { id: '5', name: 'Grant Medical College', state: 'Maharashtra', management_type: 'GOVERNMENT', total_seats: 4 }
      ]
    },
    {
      id: '6',
      course_name: 'DNB - Cardiology',
      stream: 'DNB',
      branch: 'DNB',
      level: 'Super Specialty',
      duration: '3 years',
      total_seats: 200,
      total_colleges: 25,
      colleges: [
        { id: '1', name: 'AIIMS Delhi', state: 'Delhi', management_type: 'GOVERNMENT', total_seats: 3 },
        { id: '2', name: 'JIPMER Puducherry', state: 'Puducherry', management_type: 'GOVERNMENT', total_seats: 2 }
      ]
    }
  ];

  const mockColleges: College[] = [
    { id: '1', name: 'AIIMS Delhi', state: 'Delhi', management_type: 'GOVERNMENT', college_type: 'MEDICAL' },
    { id: '2', name: 'JIPMER Puducherry', state: 'Puducherry', management_type: 'GOVERNMENT', college_type: 'MEDICAL' },
    { id: '3', name: 'KGMU Lucknow', state: 'Uttar Pradesh', management_type: 'GOVERNMENT', college_type: 'MEDICAL' }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Load courses
  const loadCourses = useCallback(async (newFilters = {}, newPage = 1, isAppend = false) => {
    try {
      if (isAppend) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: newPage.toString(),
        limit: '24',
        ...newFilters
      });

      // Call unified API
      const response = await fetch(`/api/fresh/courses?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (isAppend && newPage > 1) {
        setCourses(prevCourses => [...prevCourses, ...data.data]);
        setFilteredCourses(prevCourses => [...prevCourses, ...data.data]);
        setPagination(prev => ({
          ...prev,
          page: newPage,
          hasNext: data.pagination.hasNext
        }));
      } else {
        setCourses(data.data);
        setFilteredCourses(data.data);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.totalPages,
          totalItems: data.pagination.totalItems,
          hasNext: data.pagination.hasNext
        });
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
      if (!isAppend) {
        setCourses([]);
        setFilteredCourses([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [selectedStream, selectedBranch]);

  // Load more courses
  const loadMoreCourses = useCallback(() => {
    if (isLoading || isLoadingMore || !pagination.hasNext) {
      return;
    }

    const nextPage = pagination.page + 1;
    loadCourses({}, nextPage, true);
  }, [isLoading, isLoadingMore, pagination.hasNext, pagination.page, loadCourses]);

  // Handle stream change
  const handleStreamChange = (stream: string) => {
    setSelectedStream(stream);
    const filters: any = { stream: stream === 'all' ? null : stream };
    if (selectedBranch !== 'all') {
      filters.branch = selectedBranch;
    }
    loadCourses(filters, 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle branch change
  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    const filters: any = { branch: branch === 'all' ? null : branch };
    if (selectedStream !== 'all') {
      filters.stream = selectedStream;
    }
    loadCourses(filters, 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle opening colleges modal
  const handleViewColleges = async (course: Course) => {
    setSelectedCourse(course);
    setIsCollegesModalOpen(true);
    
    // Fetch colleges for this course
    try {
      const response = await fetch(`/api/fresh/courses/${course.id}/colleges`);
      if (response.ok) {
        const data = await response.json();
        setColleges(data.data || []);
      } else {
        console.error('Failed to fetch colleges for course:', course.id);
        setColleges([]);
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
      setColleges([]);
    }
  };

  // Handle search results
  const handleSearchResults = async (searchResult: any) => {
    if (searchResult && searchResult.results && searchResult.results.length > 0) {
      const searchCourses = searchResult.results.map((result: any) => ({
        course_name: result.course_name,
        stream: result.stream,
        branch: result.branch || '',
        level: result.level,
        duration: result.duration || 'N/A',
        total_seats: result.total_seats || 0,
        total_colleges: result.total_colleges || 0,
        college_names: result.college_names || '',
        colleges: result.colleges || []
      }));

      const validSearchCourses = searchCourses.filter((course: any) => course.total_seats > 0);
      setCourses(validSearchCourses);
      setFilteredCourses(validSearchCourses);
      setPagination({
        page: 1,
        limit: validSearchCourses.length,
        totalPages: 1,
        totalItems: validSearchCourses.length,
        hasNext: false
      });
    } else if (searchResult && searchResult.searchType === 'none') {
      loadCourses({}, 1);
    }
  };

  // Initial load
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const getStreamIcon = (stream: string) => {
    switch (stream) {
      case 'MEDICAL':
        return BookOpen;
      case 'DENTAL':
        return BookOpen;
      case 'DNB':
        return BookOpen;
      default:
        return BookOpen;
    }
  };

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case 'MEDICAL':
        return 'from-blue-500 to-blue-600';
      case 'DENTAL':
        return 'from-green-500 to-green-600';
      case 'DNB':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const streams = [
    { value: 'all', label: 'All Streams' },
    { value: 'MEDICAL', label: 'Medical' },
    { value: 'DENTAL', label: 'Dental' },
    { value: 'DNB', label: 'DNB' }
  ];

  const branches = [
    { value: 'all', label: 'All Branches' },
    { value: 'UG', label: 'UG (Undergraduate)' },
    { value: 'DIPLOMA', label: 'Diploma' },
    { value: 'PG', label: 'PG (MD/MS/MD&MS)' },
    { value: 'SS', label: 'SS (Super Specialty)' }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden transition-all duration-500">
        {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={700}
          baseHue={120}
          rangeHue={100}
          baseSpeed={0.18}
          rangeSpeed={1.9}
          baseRadius={1}
          rangeRadius={2.8}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/25 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={400}
          baseHue={200}
          baseSpeed={0.1}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 via-blue-50/20 to-purple-50/30 z-10"></div>
        </LightVortex>
      )}

      {/* Content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          <div className="text-center max-w-6xl w-full">
            {/* Page Title */}
            <motion.h1
              className={`text-5xl md:text-7xl font-bold mb-6 transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.95 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              Medical Courses
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className={`text-xl md:text-2xl mb-12 max-w-3xl mx-auto transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-green-300 to-emerald-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 15 }}
              transition={{ duration: 0.2, delay: 0.15 }}
            >
              Explore comprehensive medical courses and see which colleges offer them with detailed seat information
            </motion.p>

            {/* Advanced Search Bar */}
            <motion.div
              className="max-w-3xl mx-auto mb-16"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 15 }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              <UnifiedSearchBar
                placeholder="Search medical courses with AI-powered intelligence..."
                onSearchResults={handleSearchResults}
                debounceMs={300}
                showAIInsight={true}
              />
            </motion.div>

            {/* Stream and Branch Filters */}
            <motion.div
              className="flex flex-col gap-8 mb-16"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 15 }}
              transition={{ duration: 0.2, delay: 0.25 }}
            >
              {/* Stream Filters */}
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Filter by Stream</h3>
                <div className="flex flex-wrap gap-4 justify-center">
                  {streams.map((stream) => (
                    <button
                      key={stream.value}
                      onClick={() => handleStreamChange(stream.value)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all ${
                        selectedStream === stream.value
                          ? stream.value === 'MEDICAL' 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : stream.value === 'DENTAL'
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                            : stream.value === 'DNB'
                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                            : 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg'
                          : stream.value === 'MEDICAL'
                          ? isDarkMode 
                            ? 'bg-blue-500/20 backdrop-blur-sm text-blue-200 border border-blue-400/30 hover:bg-blue-500/30 hover:text-blue-100'
                            : 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200 hover:text-blue-900'
                          : stream.value === 'DENTAL'
                          ? isDarkMode 
                            ? 'bg-green-500/20 backdrop-blur-sm text-green-200 border border-green-400/30 hover:bg-green-500/30 hover:text-green-100'
                            : 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 hover:text-green-900'
                          : stream.value === 'DNB'
                          ? isDarkMode 
                            ? 'bg-purple-500/20 backdrop-blur-sm text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 hover:text-purple-100'
                            : 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 hover:text-purple-900'
                          : isDarkMode 
                            ? 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 hover:text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                    >
                      {stream.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch Filters */}
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Filter by Branch</h3>
                <div className="flex flex-wrap gap-4 justify-center">
                  {branches.map((branch) => (
                    <button
                      key={branch.value}
                      onClick={() => handleBranchChange(branch.value)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all ${
                        selectedBranch === branch.value
                          ? branch.value === 'UG' 
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                            : branch.value === 'DIPLOMA'
                            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                            : branch.value === 'PG'
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                            : branch.value === 'SS'
                            ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg'
                            : 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg'
                          : branch.value === 'UG'
                          ? isDarkMode 
                            ? 'bg-orange-500/20 backdrop-blur-sm text-orange-200 border border-orange-400/30 hover:bg-orange-500/30 hover:text-orange-100'
                            : 'bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200 hover:text-orange-900'
                          : branch.value === 'DIPLOMA'
                          ? isDarkMode 
                            ? 'bg-teal-500/20 backdrop-blur-sm text-teal-200 border border-teal-400/30 hover:bg-teal-500/30 hover:text-teal-100'
                            : 'bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200 hover:text-teal-900'
                          : branch.value === 'PG'
                          ? isDarkMode 
                            ? 'bg-indigo-500/20 backdrop-blur-sm text-indigo-200 border border-indigo-400/30 hover:bg-indigo-500/30 hover:text-indigo-100'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-300 hover:bg-indigo-200 hover:text-indigo-900'
                          : branch.value === 'SS'
                          ? isDarkMode 
                            ? 'bg-pink-500/20 backdrop-blur-sm text-pink-200 border border-pink-400/30 hover:bg-pink-500/30 hover:text-pink-100'
                            : 'bg-pink-100 text-pink-800 border border-pink-300 hover:bg-pink-200 hover:text-pink-900'
                          : isDarkMode 
                            ? 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 hover:text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                    >
                      {branch.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Search Status */}
            {filteredCourses.length !== courses.length && (
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-full text-sm">
                  <Search className="w-4 h-4" />
                  Search Results: {filteredCourses.length} of {courses.length} courses
                </div>
              </motion.div>
            )}
            
            {/* Courses Grid - 2x12 Layout */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16 max-w-7xl mx-auto w-full"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 15 }}
              transition={{ duration: 0.2, delay: 0.3 }}
            >
              {isLoading ? (
                <>
                  {/* Loading indicator */}
                  <div className="col-span-full text-center mb-8">
                    <div className={`text-lg ${
                      isDarkMode ? 'text-white/80' : 'text-gray-700'
                    }`}>
                      Loading courses...
                    </div>
                      </div>
                  
                  {/* Loading skeleton - 24 cards for 2x12 grid */}
                  {Array.from({ length: 24 }).map((_, index) => (
                    <div key={index} className={`backdrop-blur-md p-6 rounded-2xl border-2 animate-pulse shadow-lg ${
                      isDarkMode 
                        ? 'bg-white/10 border-white/20 shadow-white/10' 
                        : 'bg-blue-50/40 border-blue-200/60 shadow-blue-200/30'
                    }`}>
                      <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-4 rounded mb-2 ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-3 rounded mb-1 ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-3 rounded ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                    </div>
                  ))}
                </>
              ) : filteredCourses.length > 0 ? (
                filteredCourses.map((course, index) => {
                  const IconComponent = getStreamIcon(course.stream || '');
                  
                  return (
                    <motion.div
                      key={`${course.course_name || 'unknown'}-${course.stream || 'unknown'}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 10 }}
                      transition={{ delay: 0.35 + index * 0.03, duration: 0.2 }}
                      className={`backdrop-blur-md p-6 rounded-2xl border-2 transition-all h-fit shadow-lg ${
                        isDarkMode 
                          ? 'bg-white/10 border-white/20 hover:bg-white/20 shadow-white/10' 
                          : 'bg-blue-50/40 border-blue-200/60 hover:bg-blue-50/50 shadow-blue-200/30'
                      }`}
                    >
                      <div className="text-center mb-4">
                        <div className={`w-16 h-16 bg-gradient-to-r ${getStreamColor(course.stream || '')} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                          <IconComponent className="w-8 h-8 text-white" />
                        </div>
                        <h3 className={`text-xl font-semibold mb-2 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>{course.course_name || course.name || 'Unknown Course'}</h3>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className={`flex items-center justify-between text-sm ${
                          isDarkMode ? 'text-white/80' : 'text-gray-600'
                        }`}>
                          <span>Stream: <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            (course.stream || '').toUpperCase() === 'MEDICAL' ? 'bg-blue-500 text-white border border-blue-600' :
                            (course.stream || '').toUpperCase() === 'DENTAL' ? 'bg-green-500 text-white border border-green-600' :
                            (course.stream || '').toUpperCase() === 'DNB' ? 'bg-purple-500 text-white border border-purple-600' :
                            'bg-gray-500 text-white border border-gray-600'
                          }`}>
                            {course.stream || 'Unknown'}
                          </span></span>
                          <span>Colleges: {course.total_colleges || 0}</span>
                        </div>
                        <div className={`flex items-center justify-between text-sm ${
                          isDarkMode ? 'text-white/80' : 'text-gray-600'
                        }`}>
                          <span>Total Seats: {course.total_seats?.toLocaleString() || '0'}</span>
                          <span>Duration: {course.duration || 'N/A'} years</span>
                        </div>
                      </div>

                      {/* Expandable Colleges Section */}
                      <div className="mb-4">
                        <button
                          onClick={() => handleViewColleges(course)}
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-lg text-center font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center"
                        >
                          <GraduationCap className="w-4 h-4 mr-2" />
                          <span>View Colleges ({course.total_colleges})</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-12">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-lg ${
                    isDarkMode ? 'bg-white/10 shadow-white/10' : 'bg-blue-50/40 shadow-blue-200/30'
                  }`}>
                    <BookOpen className={`w-12 h-12 ${
                      isDarkMode ? 'text-white/50' : 'text-gray-400'
                    }`} />
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {filteredCourses.length === 0 && courses.length > 0 ? 'No courses match your search' : 'No courses found'}
                  </h3>
                  <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                    {filteredCourses.length === 0 && courses.length > 0 ? 'Try different search terms or clear your search' : 'Try adjusting your search or filters'}
                  </p>
                </div>
              )}

              {/* Skeleton cards for loading more */}
              {isLoadingMore && (
                <>
                  {Array.from({ length: 6 }).map((_, skeletonIndex) => (
                    <div key={`skeleton-${skeletonIndex}`} className={`backdrop-blur-md p-6 rounded-2xl border-2 animate-pulse shadow-lg ${
                      isDarkMode 
                        ? 'bg-white/10 border-white/20 shadow-white/10' 
                        : 'bg-blue-50/40 border-blue-200/60 shadow-blue-200/30'
                    }`}>
                      <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-4 rounded mb-2 ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-3 rounded mb-1 ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                      <div className={`h-3 rounded ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-200/50'
                      }`}></div>
                  </div>
                  ))}
                </>
              )}
            </motion.div>

              {/* Infinite Scroll Trigger */}
            {filteredCourses.length > 0 && pagination.hasNext && (
                <InfiniteScrollTrigger
                  onLoadMore={loadMoreCourses}
                  hasMore={pagination.hasNext}
                  isLoading={isLoadingMore}
                threshold={0.8}
                rootMargin="200px"
              />
            )}

            {/* End of content indicator */}
            {filteredCourses.length > 0 && !pagination.hasNext && (
              <div className="col-span-full text-center py-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-medium">You've reached the end! All courses loaded.</span>
                </div>
                </div>
              )}
          </div>
        </main>
        </div>

        {/* Course Colleges Modal */}
          <CourseCollegesModal
        isOpen={isCollegesModalOpen}
        onClose={() => setIsCollegesModalOpen(false)}
            course={selectedCourse}
        colleges={colleges}
          />

      {/* Footer */}
      <Footer />
      </div>
  );
};

export default CoursesPage;