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
        limit: pagination.limit.toString(),
        ...newFilters
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
        city: college.city || 'Unknown',
        state: college.state,
        type: college.type || 'MEDICAL',
        college_type: college.type || 'MEDICAL', // Add college_type for the card component
        stream: college.type || 'MEDICAL', // Use actual type instead of hardcoded 'Medical'
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

  // Handle opening college details modal
  const handleOpenModal = useCallback(async (college: College) => {
    setSelectedCollege(college);
    setIsModalLoading(true);
    setIsModalOpen(true);

    try {
      // Fetch college details with courses
      const response = await fetch(`/api/fresh/colleges/${college.id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.data) {
        setSelectedCollege(data.data);
        setSelectedCollegeCourses(data.data.coursesOffered || []);
      } else {
        setSelectedCollegeCourses([]);
      }
    } catch (error) {
      console.error('Failed to fetch college details:', error);
      setSelectedCollegeCourses([]);
    } finally {
      setIsModalLoading(false);
    }
  }, []);

  // Handle closing college details modal
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
      // Clear colleges array to show loading state
      setColleges([]);
      setCurrentSearchQuery("");
      // Use setTimeout to ensure state is updated before calling loadColleges
      setTimeout(() => {
        loadColleges({}, 1);
      }, 0);
    }
  }, [loadColleges]);

  // Initial load
  const hasLoaded = useRef(false);
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadColleges();
    }
  }, []);

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
              Medical Colleges
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className={`text-xl md:text-2xl mb-12 max-w-3xl mx-auto ${
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
              className="max-w-3xl mx-auto mb-8"
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

            {/* Intelligent Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ delay: 0.35, duration: 0.2 }}
              className="mb-8"
            >
              <IntelligentFilters
                key={JSON.stringify(filters)}
                filters={filters}
                appliedFilters={appliedFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                type="colleges"
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
                currentView={viewType}
                onViewChange={setViewType}
                isDarkMode={isDarkMode}
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
                        <ResponsiveCollegeCard
                          key={`college-${college.id}-${index}`}
                          college={college}
                          index={index}
                          courses={Array(college.course_count || 0).fill({})}
                          onOpenModal={handleOpenModal}
                        />
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
  );
};

export default CollegesPage;