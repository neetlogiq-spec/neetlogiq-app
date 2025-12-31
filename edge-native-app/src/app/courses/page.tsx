'use client';

import React, { useState, useEffect, useCallback } from 'react';
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Search } from 'lucide-react';
=======
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Search, Sparkles, ArrowRight, BookOpen } from 'lucide-react';
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import CourseCollegesModal from '@/components/modals/CourseCollegesModal';
import InfiniteScrollTrigger from '@/components/ui/InfiniteScrollTrigger';
import IntelligentFilters from '@/components/filters/IntelligentFilters';
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
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
  const [selectedStream, setSelectedStream] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
=======
  const [appliedFilters, setAppliedFilters] = useState<Record<string, any>>({});
  const [selectedStream, setSelectedStream] = useState<string | string[]>('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  
  // Use stream-aware data service
  const { courses: streamCourses, colleges: streamColleges, currentStream, streamConfig } = useStreamDataService();
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
  
  // Data state
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchActive, setSearchActive] = useState(false); // Track when search results are displayed
  
  // Modal state
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isCollegesModalOpen, setIsCollegesModalOpen] = useState(false);
  const [isLoadingColleges, setIsLoadingColleges] = useState(false);
  const [collegesCache, setCollegesCache] = useState<Record<string, College[]>>({});
  const [prefetchingIds, setPrefetchingIds] = useState<Set<string>>(new Set());
  
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
        limit: '24'
      });

      // Add filters correctly
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
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
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
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
=======
    const currentFilters: any = {};
    
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
    if (selectedStream !== 'all') {
      currentFilters.streams = Array.isArray(selectedStream) ? selectedStream : [selectedStream];
    }
    
    if (selectedBranch !== 'all') {
      currentFilters.branches = [selectedBranch];
    }
    
    loadCourses(currentFilters, nextPage, true);
  }, [isLoading, isLoadingMore, pagination.hasNext, pagination.page, selectedStream, selectedBranch, loadCourses]);
  // Handle stream change
  const handleStreamChange = (streams: string[] | undefined) => {
    const streamValue = streams && streams.length > 0 ? streams : 'all';
    setSelectedStream(streamValue);
    
    const filters: any = { 
      streams: streams,
      branches: selectedBranch === 'all' ? null : [selectedBranch] 
    };
    loadCourses(filters, 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
=======
  // Handle generalized filter change
  const handleFilterChange = (newFilters: Record<string, any>) => {
    // Remove 'all' values from filters to prevent "ghost" active filter indicators
    const cleanedFilters: Record<string, any> = {};
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        cleanedFilters[key] = value;
      }
    });
    
    setAppliedFilters(cleanedFilters);
    const branch = newFilters.branch || 'all';
    const courseType = newFilters.courseType || 'all';
    setSelectedBranch(branch);
    
    const filters: any = { 
      branches: branch === 'all' ? null : [branch],
      courseType: courseType === 'all' ? null : courseType,
      streams: Array.isArray(selectedStream) ? selectedStream : (selectedStream === 'all' ? null : [selectedStream])
    };
    loadCourses(filters, 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    setAppliedFilters({});
    setSelectedStream('all');
    setSelectedBranch('all');
    loadCourses({}, 1);
  };
  // Pre-fetch colleges on hover for instant loading
  const prefetchColleges = async (courseId: string) => {
    if (collegesCache[courseId] || prefetchingIds.has(courseId)) return;
    
    setPrefetchingIds(prev => new Set(prev).add(courseId));
    try {
      const response = await fetch(`/api/courses/${courseId}/colleges`);
      if (response.ok) {
        const data = await response.json();
        setCollegesCache(prev => ({
          ...prev,
          [courseId]: data.data || []
        }));
      }
    } catch (error) {
      console.error('Error prefetching colleges:', error);
    } finally {
      setPrefetchingIds(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
    }
  };

>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
  // Handle opening colleges modal
  const handleViewColleges = async (course: Course) => {
    const courseId = course.id || '';
    setSelectedCourse(course);
    setIsCollegesModalOpen(true);
    
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
    // Fetch colleges for this course
    try {
      const response = await fetch(`/api/fresh/courses/${course.id}/colleges`);
=======
    // Check cache first
    if (collegesCache[courseId]) {
      setColleges(collegesCache[courseId]);
      setIsLoadingColleges(false);
      return;
    }

    setIsLoadingColleges(true);
    setColleges([]); // Clear previous data
    
    // Fetch colleges for this course (updated to use Supabase endpoint)
    try {
      const response = await fetch(`/api/courses/${courseId}/colleges`);
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
      if (response.ok) {
        const data = await response.json();
        const results = data.data || [];
        setColleges(results);
        // Cache it
        setCollegesCache(prev => ({
          ...prev,
          [courseId]: results
        }));
      } else {
        console.error('Failed to fetch colleges for course:', courseId);
        setColleges([]);
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
      setColleges([]);
    } finally {
      setIsLoadingColleges(false);
    }
  };
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx

  // Handle search results
  const handleSearchResults = async (searchResult: any) => {
    if (searchResult && searchResult.results && searchResult.results.length > 0) {
      const searchCourses = searchResult.results.map((result: any) => ({
        course_name: result.course_name,
        stream: result.stream,
=======
  // Handle search results - stabilized with useCallback
  const handleSearchResults = useCallback(async (results: any[]) => {
    if (results && results.length > 0) {
      setSearchActive(true); // Mark search as active to prevent useEffect reset
      const searchCourses = results.map((result: any) => ({
        id: result.id || (result.course_name ? result.course_name.toLowerCase().replace(/\s+/g, '-') : Math.random().toString()),
        course_name: result.course_name || result.name,
        stream: result.stream || 'MEDICAL',
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
        branch: result.branch || '',
        level: result.level || (result.stream === 'UG' ? 'Undergraduate' : 'Postgraduate'),
        duration: result.duration || result.course_duration || '3 years',
        total_seats: result.total_seats || 0,
        total_colleges: result.total_colleges || 0,
        college_names: result.college_names || '',
        colleges: result.colleges || []
      }));
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx

      const validSearchCourses = searchCourses.filter((course: any) => course.total_seats > 0);
=======
      
      // Filter out courses with no seats if needed, or just show all
      const validSearchCourses = searchCourses.filter((course: any) => (course.total_seats || 0) >= 0);
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
      setCourses(validSearchCourses);
      setFilteredCourses(validSearchCourses);
      setPagination({
        page: 1,
        limit: validSearchCourses.length,
        totalPages: 1,
        totalItems: validSearchCourses.length,
        hasNext: false
      });
    } else {
      // If no results or cleared, reset search and reload initial courses
      setSearchActive(false);
      loadCourses({}, 1);
    }
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
  };

  // Initial load
  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const getStreamIcon = (stream: string) => {
    switch (stream) {
=======
  }, [loadCourses]);
  
  // Initial load - only run once on mount, don't reset when search is active
  useEffect(() => {
    if (!searchActive) {
      loadCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for initial load only
  // Get emoji icon based on branch/course type (more granular than stream)
  const getBranchEmoji = (courseName: string): string => {
    const name = (courseName || '').toUpperCase();
    
    // UG courses
    if (name === 'MBBS' || name === 'BDS') {
      return '🎓'; // Graduation cap for UG
    }
    
    // Super Specialty - DM, MCH
    if (name.includes('DM ') || name.startsWith('DM') || name.includes('MCH') || name.includes('M.CH')) {
      return '⭐'; // Star for Super Specialty
    }
    
    // DNB courses
    if (name.includes('DNB')) {
      if (name.includes('DIPLOMA') || name.includes('DNB-')) {
        return '📋'; // Clipboard for DNB-Diploma
      }
      return '🏥'; // Hospital for DNB
    }
    
    // Dental PG - MDS
    if (name.includes('MDS')) {
      return '🦷'; // Tooth for Dental PG
    }
    
    // Medical PG - MD, MS
    if (name.includes('MD') || name.includes('MS') || name.includes('MPH')) {
      return '🩺'; // Stethoscope for Medical PG
    }
    
    // Diploma courses
    if (name.includes('DIPLOMA') || name.includes('PG DIPLOMA')) {
      return '📜'; // Scroll for Diploma
    }
    
    // Default
    return '📚'; // Books for unknown
  };

  // Legacy function for backward compatibility (maps to stream-based icon)
  const getStreamEmoji = (stream: string): string => {
    switch (stream?.toUpperCase()) {
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
      case 'MEDICAL':
        return '🩺'; // Stethoscope
      case 'DENTAL':
        return '🦷'; // Tooth
      case 'DNB':
        return '🏥'; // Hospital
      case 'medical':
        return '🩺';
      default:
        return '📚'; // Books for unknown
    }
  };
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx

=======
  
  // Get icon color class based on stream (for background)
  const getStreamIconColor = (stream: string) => {
    switch (stream?.toUpperCase()) {
      case 'MEDICAL':
        return 'text-blue-500';
      case 'DENTAL':
        return 'text-emerald-500';
      case 'DNB':
        return 'text-purple-500';
      case 'medical':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };
  
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
  const getStreamColor = (stream: string) => {
    switch (stream?.toUpperCase()) {
      case 'MEDICAL':
        return 'from-blue-500 to-blue-600';
      case 'DENTAL':
        return 'from-emerald-500 to-emerald-600';
      case 'DNB':
        return 'from-purple-500 to-purple-600';
      case 'medical':
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx

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

=======
  const filterConfig = {
    available: [
      {
        key: 'branch',
        label: 'Branch',
        type: 'select' as const,
        options: [
          { value: 'all', label: 'All Branches' },
          { value: 'UG', label: 'UG' },
          { value: 'Dental PG', label: 'Dental PG' },
          { value: 'Medical PG (MD/MS/MD&MS)', label: 'Medical PG (MD/MS/MD&MS)' },
          { value: 'Diploma', label: 'Diploma' },
          { value: 'DNB', label: 'DNB' },
          { value: 'DNB- Diploma', label: 'DNB- Diploma' },
          { value: 'SS (Super Specialty)', label: 'SS (Super Specialty)' },
        ]
      },
      {
        key: 'courseType',
        label: 'Course Type',
        type: 'select' as const,
        options: [
          { value: 'all', label: 'All Course Types' },
          { value: 'MBBS', label: 'MBBS' },
          { value: 'BDS', label: 'BDS' },
          { value: 'MD', label: 'MD' },
          { value: 'MS', label: 'MS' },
          { value: 'MDS', label: 'MDS' },
          { value: 'DM', label: 'DM' },
          { value: 'MCH', label: 'MCH' },
          { value: 'DNB', label: 'DNB' },
          { value: 'DIPLOMA', label: 'Diploma' },
          { value: 'MPH', label: 'MPH' },
        ]
      }
    ]
  };
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
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
              className="max-w-3xl mx-auto mb-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 15 }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              <UnifiedSearchBar
                type="courses"
                placeholder="Search medical courses with AI-powered intelligence..."
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
                onSearchResults={handleSearchResults}
                debounceMs={300}
                showAIInsight={true}
              />
            </motion.div>

            {/* Stream and Branch Filters */}
=======
                onResults={handleSearchResults}
              />
            </motion.div>
            {/* Intelligent Filters */}
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 15 }}
              transition={{ duration: 0.2, delay: 0.25 }}
              className="mb-6"
            >
<<<<<<< Updated upstream:edge-native-app/src/app/courses/page.tsx
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
=======
              <IntelligentFilters
                filters={filterConfig}
                appliedFilters={appliedFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                type="courses"
                streamFilter={selectedStream}
                onStreamChange={handleStreamChange}
              />
>>>>>>> Stashed changes:src/components/courses/CoursesClient.tsx
            </motion.div>

            {/* Search Status */}
            {filteredCourses.length !== courses.length && (
              <motion.div
                className="text-center mb-4"
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
                  const branchEmoji = getBranchEmoji(course.course_name || course.name || '');
                  
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
                        <div className="flex items-center justify-center mx-auto mb-3">
                          <span className="text-5xl" role="img" aria-label={course.course_name || 'course'}>{branchEmoji}</span>
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
                          onMouseEnter={() => course.id && prefetchColleges(course.id)}
                          className={`w-full px-4 py-3 rounded-xl text-center font-medium transition-all duration-300 flex items-center justify-center ${
                            isDarkMode 
                              ? 'bg-white/20 text-white border border-white/30 shadow-sm hover:bg-white/30' 
                              : 'bg-gray-900 text-white border border-gray-800 shadow-sm hover:bg-gray-800'
                          }`}
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
            isLoading={isLoadingColleges}
          />

      {/* Footer */}
      <Footer />
      </div>
  );
};

export default CoursesPage;