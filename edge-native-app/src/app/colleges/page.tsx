'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Building2, GraduationCap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import ResponsiveCollegeCard from '@/components/colleges/ResponsiveCollegeCard';
import CollegeListView from '@/components/colleges/CollegeListView';
import ViewToggle, { ViewType } from '@/components/ui/ViewToggle';
import CollegeDetailsModal from '@/components/modals/CollegeDetailsModal';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import IntelligentFilters from '@/components/filters/IntelligentFilters';
import LoadMoreButton from '@/components/ui/LoadMoreButton';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';
import { College } from '@/types';

interface CollegeWithCourseCount extends College {
  course_count?: number;
}

interface Course {
  id?: string;
  name?: string;
  course_name?: string;
  stream?: string;
  program?: string;
  total_seats?: number;
}

const CollegesPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('card');
  const { isDarkMode } = useTheme();
  const { isAuthenticated } = useAuth();

  // Data state
  const [colleges, setColleges] = useState<CollegeWithCourseCount[]>([]);
  const [filters, setFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');

  // Modal state
  const [selectedCollege, setSelectedCollege] = useState<CollegeWithCourseCount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCollegeCourses, setSelectedCollegeCourses] = useState<Course[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    totalPages: 1,
    totalItems: 0,
    hasNext: true
  });
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx

=======
  
  // Cache for college details to make modals instant
  const [collegeDetailsCache, setCollegeDetailsCache] = useState<Record<string, any>>({});
  const [prefetchingCollegeIds, setPrefetchingCollegeIds] = useState<Set<string>>(new Set());
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
  // Mock data for demonstration
  const mockColleges: College[] = [
    {
      id: '1',
      name: 'All India Institute of Medical Sciences, Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      type: 'MEDICAL',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      established_year: 1956,
      website: 'https://www.aiims.edu',
      address: 'Ansari Nagar, New Delhi - 110029',
      is_government: true,
      is_private: false,
      is_trust: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'JIPMER Puducherry',
      city: 'Puducherry',
      state: 'Puducherry',
      type: 'MEDICAL',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      established_year: 1823,
      website: 'https://www.jipmer.edu.in',
      address: 'Dhanvantri Nagar, Puducherry - 605006',
      is_government: true,
      is_private: false,
      is_trust: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '3',
      name: 'King George Medical University, Lucknow',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      type: 'MEDICAL',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      established_year: 1905,
      website: 'https://www.kgmu.org',
      address: 'Shah Mina Road, Lucknow - 226003',
      is_government: true,
      is_private: false,
      is_trust: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Maulana Azad Medical College, Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      type: 'MEDICAL',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      established_year: 1958,
      website: 'https://www.mamc.ac.in',
      address: 'Bahadur Shah Zafar Marg, New Delhi - 110002',
      is_government: true,
      is_private: false,
      is_trust: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '5',
      name: 'Grant Medical College, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      type: 'MEDICAL',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      established_year: 1845,
      website: 'https://www.gmc.edu.in',
      address: 'J.J. Hospital Campus, Mumbai - 400008',
      is_government: true,
      is_private: false,
      is_trust: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '6',
      name: 'St. John\'s Medical College, Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      type: 'MEDICAL',
      stream: 'Medical',
      management_type: 'PRIVATE',
      established_year: 1963,
      website: 'https://www.stjohns.in',
      address: 'Sarjapur Road, Bangalore - 560034',
      is_government: false,
      is_private: true,
      is_trust: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const mockCourses: Course[] = [
    { id: '1', course_name: 'MBBS', program: 'UG', total_seats: 100 },
    { id: '2', course_name: 'MD - General Medicine', program: 'PG', total_seats: 15 },
    { id: '3', course_name: 'MS - General Surgery', program: 'PG', total_seats: 12 },
    { id: '4', course_name: 'DNB - Cardiology', program: 'DNB', total_seats: 5 }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Load colleges
  const loadColleges = useCallback(async (newFilters = {}, newPage = 1, isAppend = false) => {
    if (currentSearchQuery && currentSearchQuery.trim() !== '') {
      return;
    }

    try {
      if (isAppend) {
        setIsLoadingMore(true);
        } else {
        setIsLoading(true);
        }
        
      // Build query parameters
      const params = new URLSearchParams({
        page: newPage.toString(),
        limit: pagination.limit.toString()
      });

      // Add filters with modern ID-based support
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          if (key === 'state' && (value as string).startsWith('STATE')) {
            params.append('stateIds', value as string);
          } else if (key === 'course' && (value as string).startsWith('CRS')) {
            params.append('courseIds', value as string);
          } else if (key === 'stream' && Array.isArray(value)) {
            // Stream is an array - if all 3 streams are selected, treat as "all" (no filter)
            // Only add filter if less than all streams are selected
            if (value.length > 0 && value.length < 3) {
              params.append('stream', value.join(','));
            }
            // If value.length === 3 or value.length === 0, don't add stream filter (show all)
          } else {
            params.append(key, value as string);
          }
        }
      });

      // Call fresh API
      const response = await fetch(`/api/fresh/colleges?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Map API data to College type
      const mappedColleges: CollegeWithCourseCount[] = data.data.map((college: any) => ({
        id: college.id,
        name: college.name,
        city: college.city || (college.address ? college.address.split(',')[0] : 'Unknown'),
        state: college.state,
        type: college.college_type || college.type || 'MEDICAL',
        college_type: college.college_type || college.type || 'MEDICAL',
        stream: college.college_type || college.type || 'MEDICAL',
        management_type: college.management_type || 'Government',
        established_year: college.established_year,
        website: college.website,
        phone: '',
        email: '',
        address: college.address,
        description: '',
        image_url: '',
        rating: undefined,
        total_seats: undefined,
        cutoff_rank: undefined,
        fees: undefined,
        placement_percentage: undefined,
        nirf_ranking: undefined,
        is_government: college.management_type === 'Government',
        is_private: college.management_type === 'Private',
        is_trust: college.management_type === 'Trust',
        affiliation: college.affiliation,
        recognition: college.recognition,
        university_affiliation: college.university_affiliation,
        university: college.university || college.university_affiliation,
        created_at: college.created_at,
        updated_at: college.updated_at,
        course_count: college.course_count
      }));
      
      if (isAppend && newPage > 1) {
        setColleges(prevColleges => [...prevColleges, ...mappedColleges]);
        setPagination(prev => ({
          ...prev,
          page: newPage,
          hasNext: data.pagination.has_next
        }));
      } else {
        setColleges(mappedColleges);
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          totalPages: data.pagination.total_pages,
          totalItems: data.pagination.total,
          hasNext: data.pagination.has_next
        });
      }
    } catch (error) {
      console.error('Failed to load colleges:', error);
      if (!isAppend) {
        setColleges([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [currentSearchQuery, isLoading, isLoadingMore, pagination.limit]);

  // Load more colleges
  const loadMoreColleges = useCallback(() => {
    if (isLoading || isLoadingMore || !pagination.hasNext || isModalOpen) {
      return;
    }

    const nextPage = pagination.page + 1;
    loadColleges(appliedFilters, nextPage, true);
  }, [isLoading, isLoadingMore, pagination.hasNext, pagination.page, appliedFilters, loadColleges, isModalOpen]);
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
=======
  // Pre-fetch college details on hover
  const prefetchCollegeDetails = async (collegeId: string) => {
    if (collegeDetailsCache[collegeId] || prefetchingCollegeIds.has(collegeId)) return;
    
    setPrefetchingCollegeIds(prev => new Set(prev).add(collegeId));
    try {
      const response = await fetch(`/api/colleges/${collegeId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCollegeDetailsCache(prev => ({
            ...prev,
            [collegeId]: data
          }));
        }
      }
    } catch (error) {
      console.error('Error prefetching college details:', error);
    } finally {
      setPrefetchingCollegeIds(prev => {
        const next = new Set(prev);
        next.delete(collegeId);
        return next;
      });
    }
  };
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx

  // Handle opening college details modal
  const handleOpenModal = useCallback(async (college: College) => {
    setSelectedCollege(college);
    setIsModalOpen(true);
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx

=======
    
    // Check cache first
    if (collegeDetailsCache[college.id]) {
      const cached = collegeDetailsCache[college.id];
      setSelectedCollege({
        ...college,
        ...cached.college
      });
      setSelectedCollegeCourses(cached.courses || []);
      setIsModalLoading(false);
      return;
    }

    setSelectedCollegeCourses([]); // Clear previous data
    setIsModalLoading(true);
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
    try {
      // Fetch college details with courses
      const response = await fetch(`/api/fresh/colleges/${college.id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.college) {
        // Cache it
        setCollegeDetailsCache(prev => ({
          ...prev,
          [college.id]: data
        }));

        // API returns: { success, college, courses, cutoffs, stats, ... }
        setSelectedCollege({
          ...college,
          ...data.college,
          course_count: data.courses?.length || 0
        });
        setSelectedCollegeCourses(data.courses || []);
      } else {
        setSelectedCollegeCourses([]);
      }
    } catch (error) {
      console.error('Failed to fetch college details:', error);
      setSelectedCollegeCourses([]);
    } finally {
      setIsModalLoading(false);
    }
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
  }, []);

  // Handle closing college details modal
=======
  }, [collegeDetailsCache]);
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCollege(null);
    setSelectedCollegeCourses([]);
    setIsModalLoading(false);
  }, []);

  // Handle filter changes
  const handleFilterChange = async (newFilters: Record<string, any>) => {
    setAppliedFilters(newFilters);
    loadColleges(newFilters, 1);
  };

  // Handle filter clearing
  const handleClearFilters = async () => {
    setAppliedFilters({});
    loadColleges({}, 1);
  };

  // Handle search results from UnifiedSearchBar - stabilized with useCallback
  const handleSearchResultsArray = useCallback(async (results: any[]) => {
    if (results && results.length > 0) {
      setColleges(results);
      setCurrentSearchQuery("Search Results");
      setPagination({
        page: 1,
        limit: results.length,
        totalPages: 1,
        totalItems: results.length,
        hasNext: false
      });
    } else {
      // Reset to initial state
      setPagination({
        page: 1,
        limit: 24,
        totalPages: 1,
        totalItems: 0,
        hasNext: true
      });
      setColleges([]);
      setCurrentSearchQuery("");
      setIsLoading(true);
      loadColleges({}, 1);
    }
  }, [loadColleges]);
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
=======
  // Load master data for filters
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const response = await fetch('/api/master-data?type=all');
        const result = await response.json();
        if (result.success && result.data) {
          const formattedFilters = {
            available: [
              {
                key: 'state',
                label: 'State',
                type: 'select' as const,
                options: [
                  { value: 'all', label: 'All States' },
                  ...result.data.states.map((s: any) => ({ value: s.id, label: s.name }))
                ]
              },
              {
                key: 'course',
                label: 'Course',
                type: 'select' as const,
                options: [
                  { value: 'all', label: 'All Courses' },
                  ...result.data.courses.map((c: any) => ({ value: c.id, label: c.name }))
                ]
              },
              {
                key: 'management',
                label: 'Management Type',
                type: 'select' as const,
                options: [
                  { value: 'all', label: 'All Types' },
                  { value: 'Government', label: 'Government' },
                  { value: 'Private', label: 'Private' },
                  { value: 'Trust', label: 'Trust' },
                  { value: 'Deemed', label: 'Deemed' }
                ]
              }
            ]
          };
          setFilters(formattedFilters);
        }
      } catch (error) {
        console.error('Failed to fetch master data:', error);
      }
    };
    fetchMasterData();
  }, []);
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx

  // Initial load
  const hasLoaded = useRef(false);
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadColleges();
    }
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
  }, []);

=======
  }, [loadColleges]);
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
  // Handle URL parameters for opening specific college modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const collegeId = urlParams.get('college');
    
    if (collegeId && colleges.length > 0) {
      // Find the college in the current list
      const college = colleges.find(c => c.id === collegeId);
      if (college) {
        handleOpenModal(college);
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [colleges, handleOpenModal]);

  return (
    <div className="min-h-screen relative overflow-hidden transition-all duration-500">
        {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={600}
          baseHue={200}
          rangeHue={80}
          baseSpeed={0.15}
          rangeSpeed={1.8}
          baseRadius={1}
          rangeRadius={2.5}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/30 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={400}
          baseHue={200}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-indigo-50/20 to-purple-50/30 z-10"></div>
        </LightVortex>
      )}

      {/* Content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-16 md:py-24">
          <div className="text-center max-w-6xl w-full">
            {/* Page Title */}
            <motion.h1
              className={`text-5xl md:text-7xl font-bold mb-6 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.8 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
              Medical Colleges
=======
              Colleges
            </motion.h1>
            
            {/* Secondary Hook */}
            <motion.p
              className={`text-xl md:text-2xl mb-8 max-w-2xl mx-auto transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Explore 2,117+ colleges offering your dream courses
            </motion.p>
            
            {/* Call to Action */}
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <motion.button
                onClick={handleStartExploring}
                className={`group px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 mx-auto ${
                  isDarkMode 
                    ? 'bg-white/20 text-white border border-white/30 shadow-lg hover:bg-white/30' 
                    : 'bg-gray-900 text-white border border-gray-800 shadow-lg hover:bg-gray-800'
                }`}
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                }}
                whileTap={{ 
                  scale: 0.95,
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)'
                }}
              >
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
                Start Exploring
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          className="fixed inset-0 z-20 overflow-y-auto pt-16"
          id="main-scroll-container"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="min-h-screen relative overflow-hidden transition-all duration-500">
            {/* Content */}
            <div className="relative z-20 min-h-screen flex flex-col">
              {/* Main Content */}
              <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 md:py-12">
                <div className="text-center max-w-6xl w-full">
                  {/* Page Title */}
                  <motion.h1
                    className={`text-4xl md:text-6xl font-bold mb-4 ${
                      isDarkMode ? 'text-white' : 'text-black'
                    }`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.8 }}
                    transition={{ duration: 0.25, delay: 0.1 }}
                  >
              Explore Colleges
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className={`text-lg md:text-xl mb-8 max-w-3xl mx-auto ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-purple-300 to-blue-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-purple-600 to-blue-700 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.2, delay: 0.15 }}
            >
              Discover top medical colleges across India with detailed information, courses, and seat availability
            </motion.p>

            {/* Advanced Search Bar */}
            <motion.div
              className="max-w-3xl mx-auto mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              <UnifiedSearchBar
                data={colleges}
                onResults={handleSearchResultsArray}
                placeholder="Search medical colleges with unified AI intelligence..."
              />
            </motion.div>
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx

            {/* Intelligent Filters */}
=======
            {/* Intelligent Filters & View Toggle */}
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ delay: 0.35, duration: 0.2 }}
              className="mb-6"
            >
              <IntelligentFilters
                key={JSON.stringify(filters)}
                filters={filters}
                appliedFilters={appliedFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                type="colleges"
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
              />
            </motion.div>

            {/* View Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ delay: 0.38, duration: 0.2 }}
              className="flex justify-center mb-8"
            >
              <ViewToggle
=======
                streamFilter={(appliedFilters as any).stream}
                onStreamChange={(streams: string[] | undefined) => handleFilterChange({ ...appliedFilters, stream: streams })}
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
                currentView={viewType}
                onViewChange={setViewType}
              />
            </motion.div>

            {/* Colleges Display */}
            <motion.div
              className="w-full mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.2, delay: 0.4 }}
            >
              {isLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  <span className={`ml-3 text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Loading colleges...
                  </span>
                </div>
              ) : colleges.length > 0 ? (
                <div className="w-full">
                  {viewType === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {colleges.map((college, index) => (
                        <div key={`college-container-${college.id}-${index}`} onMouseEnter={() => prefetchCollegeDetails(college.id)}>
                          <ResponsiveCollegeCard
                            college={college}
                            index={index}
                            courses={Array(college.course_count || 0).fill({})}
                            onOpenModal={handleOpenModal}
                          />
                        </div>
                      ))}
                      
                      {/* Skeleton cards for loading more */}
                      {isLoadingMore && (
                        <>
                          {Array.from({ length: 6 }).map((_, skeletonIndex) => (
                            <div key={`skeleton-${skeletonIndex}`} className={`backdrop-blur-md p-6 rounded-2xl border-2 animate-pulse ${
                              isDarkMode 
                                ? 'bg-white/10 border-white/20' 
                                : 'bg-white/80 border-gray-200/60'
                            }`}>
                              <div className={`w-12 h-12 rounded-xl mb-4 ${
                                isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                              }`}></div>
                              <div className={`h-4 rounded mb-2 ${
                                isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                              }`}></div>
                              <div className={`h-3 rounded mb-1 ${
                                isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                              }`}></div>
                              <div className={`h-3 rounded ${
                                isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                              }`}></div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ) : (
                    <CollegeListView
                      colleges={colleges}
                      onOpenModal={handleOpenModal}
                      isDarkMode={isDarkMode}
                      isLoading={isLoadingMore}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    <Building2 className={`w-8 h-8 ${isDarkMode ? 'text-white/50' : 'text-gray-400'}`} />
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>No Colleges Found</h3>
                  <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                    Try adjusting your filters or search criteria
                  </p>
                </div>
              )}
            </motion.div>

              {/* Infinite Scroll Trigger */}
              {colleges.length > 0 && (
                <LoadMoreButton
                  onLoadMore={loadMoreColleges}
                  hasMore={pagination.hasNext}
                  isLoading={isLoadingMore}
                />
              )}

            {/* End of content indicator */}
            {colleges.length > 0 && !pagination.hasNext && (
              <div className="col-span-full text-center py-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-sm font-medium">You've reached the end! All colleges loaded.</span>
                </div>
                </div>
              )}
          </div>
        </main>
<<<<<<< Updated upstream:edge-native-app/src/app/colleges/page.tsx
        </div>

        {/* College Details Modal */}
          <CollegeDetailsModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
        college={selectedCollege}
        courses={selectedCollegeCourses}
        isLoading={isModalLoading}
          />

      {/* Footer */}
      <Footer />
      </div>
=======
          </div>
        </div>
      </motion.div>
    )}
    </AnimatePresence>
    
    {/* College Details Modal - Moved to root level for proper fixed positioning */}
    <CollegeDetailsModal
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      college={selectedCollege}
      courses={selectedCollegeCourses}
      isLoading={isModalLoading}
    />
    </div>
>>>>>>> Stashed changes:src/components/colleges/CollegesClient.tsx
  );
};

export default CollegesPage;