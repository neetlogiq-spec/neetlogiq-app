'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Building2, 
  Calendar, 
  GraduationCap, 
  Grid, 
  Plus, 
  Table,
  RefreshCw,
  Download,
  Filter,
  X,
  Search,
  ChevronUp
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Vortex } from '@/components/ui/vortex';
import { LightVortex } from '@/components/ui/light-vortex';
import CutoffsHeroSection from '@/components/cutoffs/CutoffsHeroSection';
import SmartFilterDashboard from '@/components/cutoffs/SmartFilterDashboard';
import CutoffExcelTable from '@/components/cutoffs/CutoffExcelTable';
import CutoffDetailsModal from '@/components/cutoffs/CutoffDetailsModal';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import { useStreamDataService } from '@/services/StreamDataService';
import { useVectorSearch } from '@/hooks/useVectorSearch';
import RankSearchWidget from '@/components/rank-tracking/RankSearchWidget';
import RankJourneyModal from '@/components/rank-tracking/RankJourneyModal';
import { RankJourney } from '@/services/rank-tracking-service';
import { getFromCache, setToCache, CACHE_TTL, CacheKeys } from '@/lib/cache-utils';
interface Cutoff {
  id: string;
  college: string;
  course: string;
  stream: string;
  category: string;
  quota: string;
  year: number | string;
  round?: number;
  openingRank?: number;
  closingRank?: number;
  totalSeats: number;
  state: string;
  counsellingBody: string;
  collegeType: string;
  rounds?: { [year: string]: { [round: number]: { openingRank: number; closingRank: number } } };
}
interface MasterData {
  states: Array<{ id: string; name: string }>;
  colleges: Array<{ id: string; name: string; state_id: string; college_type: string; stream_id: string; stream_name: string; counselling_bodies: string[] }>;
  courses: Array<{ id: string; name: string; level: string }>;
  quotas: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}
export default function CutoffsClient() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  // Hero/Content transition state
  const [showContent, setShowContent] = useState(false);
  
  // Handle "Start Exploring" button click
  const handleStartExploring = () => {
    setShowContent(true);
  };
  
  // State management
  const [availableRounds, setAvailableRounds] = useState<number[]>([1, 2, 3, 4]);
  const [visibleRounds, setVisibleRounds] = useState<number[]>([1, 2]);
  const [error, setError] = useState<string | null>(null);
  // Removed scroll-based state variables since we're using button-triggered transition
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Partition key state (triggers API fetch)
  const [partitionKeys, setPartitionKeys] = useState<Array<{id: string, label: string, source: string, level: string, year: number}>>([]);
  const [selectedPartition, setSelectedPartition] = useState<string>('');
  const [partitionData, setPartitionData] = useState<Cutoff[]>([]); // Full partition data
  
  // Master data for filter dropdowns
  const [masterData, setMasterData] = useState<{
    states: Array<{id: string, name: string}>;
    quotas: Array<{id: string, name: string}>;
    categories: Array<{id: string, name: string}>;
    courses: Array<{id: string, name: string}>;
    collegeTypes: Array<{id: string, name: string}>;
  }>({ states: [], quotas: [], categories: [], courses: [], collegeTypes: [] });

  // Client-side filter states (instant, no API call)
  const [selectedStateId, setSelectedStateId] = useState('all');
  const [selectedCollegeType, setSelectedCollegeType] = useState('all');
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [selectedQuotaId, setSelectedQuotaId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  
  // Legacy filter states (for backward compatibility during transition)
  const [selectedState, setSelectedState] = useState('all');
  const [selectedCounsellingBody, setSelectedCounsellingBody] = useState('all');
  const [selectedManagement, setSelectedManagement] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedQuota, setSelectedQuota] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [viewType, setViewType] = useState<'card' | 'table'>('table');
  const [multiYear, setMultiYear] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Collapsed by default on mobile
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCutoff, setSelectedCutoff] = useState<Cutoff | null>(null);

  // Rank tracking states
  const [isRankJourneyModalOpen, setIsRankJourneyModalOpen] = useState(false);
  const [rankJourneyData, setRankJourneyData] = useState<RankJourney | null>(null);
  const [isLoadingRankJourney, setIsLoadingRankJourney] = useState(false);
  // Rank range states
  const [minPossibleRank, setMinPossibleRank] = useState(1);
  const [maxPossibleRank, setMaxPossibleRank] = useState(1000000);
  const [rankRange, setRankRange] = useState({
    openingRank: [1, 1000000],
    closingRank: [1, 1000000]
  });

  // Cutoffs data from API
  const [cutoffs, setCutoffs] = useState<Cutoff[]>([]);
  const [isLoadingCutoffs, setIsLoadingCutoffs] = useState(false);
  const [cutoffError, setCutoffError] = useState<string | null>(null);
  
  // Pagination state for server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100); // 100 rows per page
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Static filter options (loaded once from server, cached locally)
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    courses: string[];
    quotas: string[];
    categories: string[];
    managementTypes: string[];
  }>({ states: [], courses: [], quotas: [], categories: [], managementTypes: [] });
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);

  // Fetch partition keys on mount
  useEffect(() => {
    const fetchPartitionKeys = async () => {
      try {
        const response = await fetch('/api/partition-keys');
        const result = await response.json();
        if (result.success && result.partitions) {
          setPartitionKeys(result.partitions);
          // Select first partition by default
          if (result.partitions.length > 0 && !selectedPartition) {
            setSelectedPartition(result.partitions[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching partition keys:', err);
      }
    };
    fetchPartitionKeys();
  }, []);

  // Fetch master data for filter dropdowns
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const response = await fetch('/api/master-data');
        const result = await response.json();
        if (result.success && result.data) {
          setMasterData(result.data);
        }
      } catch (err) {
        console.error('Error fetching master data:', err);
      }
    };
    fetchMasterData();
  }, []);

  // Convert server-loaded filter options (string arrays) to FilterOption format for SmartFilterDashboard
  const formattedFilterOptions = useMemo(() => {
    const toOptions = (arr: string[]) => arr.map(val => ({ value: val, label: val }));
    return {
      states: toOptions(filterOptions.states),
      quotas: toOptions(filterOptions.quotas),
      categories: toOptions(filterOptions.categories),
      collegeTypes: toOptions(filterOptions.managementTypes),
      courses: toOptions(filterOptions.courses),
      streams: [] // Stream derived from partition key
    };
  }, [filterOptions]);

  // Display data - server already filters by state/quota/category/management/course
  // Only apply rank range filter client-side (not sent to server)
  const displayData = useMemo(() => {
    let filtered = partitionData;
    
    // Apply rank range filter (client-side only - not sent to server)
    if (rankRange.openingRank[0] > 1 || rankRange.openingRank[1] < maxPossibleRank) {
      filtered = filtered.filter(row => {
        const rank = row.closingRank || 0;
        return rank >= rankRange.openingRank[0] && rank <= rankRange.openingRank[1];
      });
    }
    
    return filtered;
  }, [partitionData, rankRange, maxPossibleRank]);

  // Load filter options for a partition (with caching)
  const loadFilterOptions = async (partitionKey: string) => {
    if (!partitionKey) return;
    
    setIsLoadingFilters(true);
    
    try {
      // Check cache first
      const cacheKey = CacheKeys.filterOptions(partitionKey);
      const cached = getFromCache<typeof filterOptions>(cacheKey);
      
      if (cached) {
        console.log('Filter options loaded from cache');
        setFilterOptions(cached);
        setIsLoadingFilters(false);
        return;
      }
      
      // Fetch from server
      const response = await fetch(`/api/filter-options?partition_key=${partitionKey}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const options = {
          states: result.data.states || [],
          courses: result.data.courses || [],
          quotas: result.data.quotas || [],
          categories: result.data.categories || [],
          managementTypes: result.data.managementTypes || []
        };
        
        // Cache the options
        setToCache(cacheKey, options, CACHE_TTL.FILTER_OPTIONS);
        setFilterOptions(options);
        console.log('Filter options loaded from server and cached');
      }
    } catch (err) {
      console.error('Error loading filter options:', err);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Load cascading filter options based on current filter selections
  const loadCascadingOptions = async (state: string, course: string = 'all', management: string = 'all') => {
    if (state === 'all' && course === 'all' && management === 'all') {
      // Reset to all options from partition filter options
      const result = await fetch('/api/filter-options?partition_key=' + selectedPartition)
        .then(r => r.json());
      if (result?.data) {
        setFilterOptions(prev => ({
          ...prev,
          courses: result.data.courses || prev.courses,
          quotas: result.data.quotas || prev.quotas,
          categories: result.data.categories || prev.categories,
          managementTypes: result.data.managementTypes || prev.managementTypes
        }));
      }
      return;
    }
    
    try {
      console.log('Loading cascading options for filters:', { state, course, management });
      
      // Build URL with all active filters
      const params = new URLSearchParams();
      params.append('partition_key', selectedPartition);
      if (state && state !== 'all') params.append('state', state);
      if (course && course !== 'all') params.append('course', course);
      if (management && management !== 'all') params.append('management', management);
      
      const response = await fetch(`/api/cascading-filters?${params.toString()}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Update all filter options based on current selections
        setFilterOptions(prev => ({
          ...prev,
          // Only update options that aren't currently selected (to preserve the selected option)
          states: state === 'all' && result.data.states?.length > 0 ? result.data.states : prev.states,
          courses: course === 'all' && result.data.courses?.length > 0 ? result.data.courses : prev.courses,
          quotas: result.data.quotas?.length > 0 ? result.data.quotas : prev.quotas,
          categories: result.data.categories?.length > 0 ? result.data.categories : prev.categories,
          managementTypes: management === 'all' && result.data.managements?.length > 0 ? result.data.managements : prev.managementTypes
        }));
        console.log('Cascading filter options updated:', {
          states: result.data.states?.length,
          courses: result.data.courses?.length,
          quotas: result.data.quotas?.length,
          categories: result.data.categories?.length,
          managements: result.data.managements?.length
        });
      } else {
        console.log('No cascading data found, keeping current options');
      }
    } catch (err) {
      console.error('Error loading cascading options:', err);
    }
  };
  
  // Trigger cascading filters when any filter changes
  const triggerCascadingFilters = () => {
    // Skip if no partition selected
    if (!selectedPartition) return;
    
    // Check if all filters are 'all' - use full filter options
    if (selectedState === 'all' && selectedCourse === 'all' && selectedManagement === 'all') {
      // Reset to full options
      loadCascadingOptions('all');
    } else {
      // Load filtered options based on current selections
      loadCascadingOptions(selectedState, selectedCourse, selectedManagement);
    }
  };

  // Load paginated data from API (server-side filtering)
  const loadPageData = async (page: number = 1) => {
    if (!selectedPartition) return;
    
    setIsLoadingCutoffs(true);
    setCutoffError(null);
    
    try {
      // Build query params with all filters
      const params = new URLSearchParams();
      params.append('partition_key', selectedPartition);
      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));
      
      // Add filter values if not 'all'
      if (selectedState !== 'all') params.append('state', selectedState);
      if (selectedQuota !== 'all') params.append('quota', selectedQuota);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedManagement !== 'all') params.append('management', selectedManagement);
      if (selectedCourse !== 'all') params.append('course', selectedCourse);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/cutoffs?${params.toString()}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Transform data to match Cutoff interface
        const transformedData: Cutoff[] = result.data.map((item: any) => ({
          id: `${item.master_college_id}-${item.master_course_id}-${item.master_category_id}-${item.year}-${item.round}`,
          college: item.college_name || 'Unknown College',
          course: item.course_name || 'Unknown Course',
          stream: item.course_type || 'PG',
          category: item.category || 'General',
          quota: item.quota || 'All India',
          year: item.year || 2024,
          round: item.round,
          openingRank: item.opening_rank,
          closingRank: item.closing_rank,
          totalSeats: item.total_seats || 0,
          state: item.state || 'Unknown',
          counsellingBody: item.source_id || 'MCC',
          collegeType: item.management || 'Government',
          rounds: {
            [String(item.year)]: {
              [item.round]: {
                openingRank: item.opening_rank,
                closingRank: item.closing_rank
              }
            }
          }
        }));
        
        setPartitionData(transformedData);
        setCutoffs(transformedData);
        setTotalCount(result.count || 0);
        setTotalPages(Math.ceil((result.count || 0) / pageSize));
        setCurrentPage(page);
        
        console.log(`Loaded page ${page}: ${transformedData.length} records, total: ${result.count}`);
      } else {
        setCutoffError(result.error || 'Failed to load cutoffs');
      }
    } catch (err) {
      console.error('Error loading page data:', err);
      setCutoffError('Failed to load cutoffs');
    } finally {
      setIsLoadingCutoffs(false);
    }
  };

  // Load filter options when partition changes
  useEffect(() => {
    if (selectedPartition) {
      loadFilterOptions(selectedPartition);
    }
  }, [selectedPartition]);

  // Cascading filter: reload filter options when any filter changes (bidirectional linking)
  useEffect(() => {
    if (selectedPartition) {
      // Trigger cascading filters to update available options
      triggerCascadingFilters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, selectedCourse, selectedManagement, selectedPartition]);

  // Load page data when partition, page, or filters change
  useEffect(() => {
    if (showContent && selectedPartition) {
      loadPageData(1); // Reset to page 1 when filters change
    }
  }, [showContent, selectedPartition, selectedState, selectedQuota, selectedCategory, selectedManagement, selectedCourse, searchQuery]);

  // Use stream-aware data service for master data (legacy, kept for backward compatibility)
  const { currentStream } = useStreamDataService();
  
  // Loading and error state
  const isLoading = isLoadingCutoffs;
  const dataError = cutoffError;

  const { searchCutoffs, processNaturalLanguageQuery } = useVectorSearch();
  // Auto-collapse sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Remove scroll detection since we're using button-triggered transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  // Handle AI-powered search
  const handleAISearch = async (query: string) => {
    try {
      const results = await searchCutoffs(query, {
        college_id: selectedState !== 'all' ? selectedState : undefined,
        course_id: selectedCourse !== 'all' ? selectedCourse : undefined,
        category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
        state_id: selectedState !== 'all' ? selectedState : undefined,
        year: selectedYear !== 'all' ? parseInt(selectedYear) : undefined,
        round: visibleRounds.length > 0 ? visibleRounds[0] : undefined,
        min_rank: rankRange.openingRank[0],
        max_rank: rankRange.openingRank[1],
      }, 50);
      
      console.log('AI Search results:', results);
      return results;
    } catch (error) {
      console.error('Error in AI search:', error);
      return [];
    }
  };
  // Handle search results
  const handleSearchResults = (results: any[]) => {
    console.log('Search results:', results);
  };
  // Handle view details
  const handleViewDetails = (cutoff: Cutoff) => {
    setSelectedCutoff(cutoff);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCutoff(null);
  };

  // Handle rank journey search
  const handleRankSearch = async (rank: number, year: number, category: string, quota: string) => {
    setIsLoadingRankJourney(true);
    setRankJourneyData(null);

    try {
      const response = await fetch(
        `/api/rank-tracking/${rank}?year=${year}&category=${encodeURIComponent(category)}&quota=${encodeURIComponent(quota)}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch rank journey');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setRankJourneyData(data.data);
        setIsRankJourneyModalOpen(true);
      } else {
        alert('No journey data found for this rank. Please try a different rank or parameters.');
      }
    } catch (error) {
      console.error('Error fetching rank journey:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch rank journey. Please try again.');
    } finally {
      setIsLoadingRankJourney(false);
    }
  };

  const handleCloseRankJourneyModal = () => {
    setIsRankJourneyModalOpen(false);
  };
  const handleRemoveRound = (round: number) => {
    setVisibleRounds(prev => prev.filter(r => r !== round));
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={650}
          baseHue={300}
          rangeHue={90}
          baseSpeed={0.16}
          rangeSpeed={1.7}
          baseRadius={1}
          rangeRadius={2.6}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/35 z-10"></div>
        </Vortex>
      ) : (
          <LightVortex
            className="fixed inset-0 z-0"
          particleCount={450}
            baseHue={300}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={1.5}
            rangeRadius={3}
            backgroundColor="#ffffff"
            containerClassName="fixed inset-0"
          >
          <div className="absolute inset-0 bg-linear-to-br from-purple-50/30 via-pink-50/20 to-indigo-50/30 z-10"></div>
          </LightVortex>
      )}
      <AnimatePresence>
        {!showContent ? (
          <motion.div
            key="hero"
            className="fixed inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <CutoffsHeroSection 
              isDarkMode={isDarkMode}
              isVisible={true}
              onStartExploring={handleStartExploring}
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="fixed inset-0 z-20 overflow-y-auto pt-16"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-[calc(100vh-5rem)] relative overflow-auto transition-all duration-500 flex flex-col">

        {/* Filter Section - Sticky */}
        <div className={`sticky top-0 z-30 px-2 sm:px-6 py-2 backdrop-blur-md ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          
          {/* Single row layout - all controls in one line */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            
            {/* Search Bar - Always visible, takes available space */}
            <div className="relative flex-1 min-w-[80px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-sm ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            
            {/* Partition Key Selector */}
            <select
              value={selectedPartition}
              onChange={(e) => setSelectedPartition(e.target.value)}
              className={`px-1.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 max-w-[100px] sm:max-w-[150px] ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {partitionKeys.length === 0 ? (
                <option value="">...</option>
              ) : (
                partitionKeys.map(partition => (
                  <option key={partition.id} value={partition.id}>
                    {partition.label}
                  </option>
                ))
              )}
            </select>
            
            {/* My Rank - Ultra compact */}
            <div className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border-2 transition-all shrink-0 ${
              userRank
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : isDarkMode
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-purple-300 bg-purple-50'
            }`}>
              <span className={`text-[9px] font-semibold uppercase whitespace-nowrap ${
                userRank
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-purple-600 dark:text-purple-400'
              }`}>
                Rank:
              </span>
              <input
                type="number"
                placeholder="Enter"
                value={userRank || ''}
                onChange={(e) => setUserRank(e.target.value ? parseInt(e.target.value) : null)}
                className={`w-12 sm:w-16 bg-transparent border-none text-xs font-mono font-bold focus:outline-none ${
                  userRank
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : isDarkMode
                      ? 'text-white placeholder-purple-300'
                      : 'text-purple-900 placeholder-purple-400'
                }`}
              />
              {userRank && (
                <button onClick={() => setUserRank(null)} className="text-gray-400 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {/* Add Round - Icon only on mobile */}
            <button
              onClick={() => {
                const newRound = Math.max(...visibleRounds) + 1;
                setVisibleRounds([...visibleRounds, newRound]);
              }}
              className={`flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                isDarkMode 
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30'
                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Add</span>
            </button>
            
            {/* Filters Button */}
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                isFiltersExpanded
                  ? isDarkMode
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                  : isDarkMode
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {isFiltersExpanded && (
                <ChevronUp className="w-3 h-3 text-red-500 animate-pulse" />
              )}
            </button>
          </div>
          
          <AnimatePresence>
            {isFiltersExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ 
                  duration: 0.4, 
                  ease: [0.4, 0, 0.2, 1],
                  opacity: { duration: 0.3 },
                  y: { duration: 0.3 }
                }}
                style={{ overflow: 'hidden' }}
              >
                <div className="py-4">
                  <SmartFilterDashboard
                    isDarkMode={isDarkMode}
                    filterOptions={formattedFilterOptions}
                    selectedState={selectedState}
                    onStateChange={setSelectedState}
                    selectedCollegeType={selectedManagement}
                    onCollegeTypeChange={setSelectedManagement}
                    selectedStream={currentStream || 'all'}
                    onStreamChange={() => {}} // Stream is now managed by user profile
                    selectedCourse={selectedCourse}
                    onCourseChange={setSelectedCourse}
                    selectedQuota={selectedQuota}
                    onQuotaChange={setSelectedQuota}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    minRank={rankRange.openingRank[0]}
                    maxRank={rankRange.openingRank[1]}
                    onRankRangeChange={(min, max) => setRankRange(prev => ({ 
                      ...prev, 
                      openingRank: [min, max],
                      closingRank: [min, max]
                    }))}
                    onReset={() => {
                      setSelectedState('all');
                      setSelectedManagement('all');
                      setSelectedCourse('all');
                      setSelectedQuota('all');
                      setSelectedCategory('all');
                      setRankRange({
                        openingRank: [minPossibleRank, maxPossibleRank],
                        closingRank: [minPossibleRank, maxPossibleRank]
                      });
                    }}
                    onSavePreset={() => {
                      console.log('Save preset clicked');
                    }}
                    onLoadPreset={() => {
                      console.log('Load preset clicked');
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Data Table Section - Fills remaining space */}
        <div className="flex-1 px-4 sm:px-6 pb-4 flex flex-col">
            {/* Error Display */}
            {(error || dataError) && (
            <motion.div
              className={`w-full p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-red-100 border border-red-200 text-red-800'}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {error || dataError}
            </motion.div>
            )}
            {/* Cutoffs Display */}
              {isLoading && displayData.length === 0 ? (
                /* Skeleton Loading */
                <div className={`backdrop-blur-md rounded-xl border-2 overflow-hidden ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'}`}>
                  {/* Skeleton Header */}
                  <div className={`flex items-center gap-4 p-4 border-b ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    {['w-24', 'w-48', 'w-32', 'w-20', 'w-20', 'w-28', 'w-28'].map((width, i) => (
                      <div key={i} className={`h-4 rounded ${width} ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                  {/* Skeleton Rows */}
                  {[...Array(10)].map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className={`flex items-center gap-4 p-4 border-b animate-pulse ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                      style={{ animationDelay: `${rowIndex * 100}ms` }}
                    >
                      <div className={`h-4 rounded w-24 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                      <div className={`h-4 rounded w-48 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
                      <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                      <div className={`h-4 rounded w-20 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
                      <div className={`h-4 rounded w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                      <div className={`h-8 rounded w-28 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`} />
                      <div className={`h-8 rounded w-28 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                  {/* Skeleton Footer */}
                  <div className={`flex items-center justify-between p-4 ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                    <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                    <div className={`h-8 rounded w-24 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
                  </div>
                </div>
              ) : displayData.length > 0 ? (
            viewType === 'card' ? (
                <div className={`backdrop-blur-md rounded-xl border-2 ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-white/10 sticky top-0 z-10">
                  </div>
                  
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                      {displayData.map((cutoff, index) => (
                  <motion.div
                          key={cutoff.id}
                    initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
                        className={`backdrop-blur-md p-4 rounded-xl border-2 transition-all shadow-lg hover:shadow-xl cursor-pointer ${
                      isDarkMode 
                              ? 'bg-white/10 border-white/20 hover:bg-white/20' 
                              : 'bg-purple-50/40 border-purple-200/60 hover:bg-purple-50/50'
                    }`}
                        onClick={() => handleViewDetails(cutoff)}
                  >
                      <div className="text-center mb-3">
                        <h3 className={`text-sm font-semibold mb-2 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>{cutoff.college}</h3>
                    </div>
                    
                      <div className="space-y-2 mb-3">
                        <div className={`text-center text-xs font-medium ${
                            isDarkMode ? 'text-blue-400' : 'text-blue-600'
                          }`}>
                            {cutoff.stream}
                    </div>
                        <div className={`flex items-center justify-center text-xs ${
                        isDarkMode ? 'text-white/80' : 'text-gray-600'
                          }`}>
                          <GraduationCap className="w-3 h-3 mr-1" />
                          <span className="truncate">{cutoff.course}</span>
                          </div>
                          
                        <div className={`text-center text-xs ${
                            isDarkMode ? 'text-white/80' : 'text-gray-600'
                          }`}>
                              {cutoff.category} • {cutoff.totalSeats} seats
                          </div>
                  </div>
                        <button 
                        className="w-full bg-linear-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-lg text-center font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(cutoff);
                          }}
                        >
                        <BarChart3 className="w-3 h-3 mr-1" />
                            View Details
                        </button>
              </motion.div>
                  ))}
                </div>
              </div>
                ) : (
                  <>
                  <CutoffExcelTable
                    data={displayData}
                    isDarkMode={isDarkMode}
                    multiYear={multiYear}
                    visibleRounds={visibleRounds}
                    onRowClick={handleViewDetails}
                    onRemoveRound={handleRemoveRound}
                    userRank={userRank}
                  />
                  
                  {/* Add bottom padding for fixed pagination bar */}
                  <div className="h-24" />
                  </>
                )
              ) : (
                <div className={`backdrop-blur-md rounded-xl p-8 border-2 text-center ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'}`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    <BarChart3 className={`w-8 h-8 ${isDarkMode ? 'text-white/50' : 'text-gray-400'}`} />
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    No Cutoff Data Found
                  </h3>
                  <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                    Try adjusting your filters or search criteria
                  </p>
                </div>
              )}
        </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Cutoff Details Modal */}
      <CutoffDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cutoff={selectedCutoff}
        allCutoffs={displayData}
        isDarkMode={isDarkMode}
      />

      {/* Rank Journey Modal */}
      <RankJourneyModal
        isOpen={isRankJourneyModalOpen}
        onClose={handleCloseRankJourneyModal}
        journey={rankJourneyData}
      />

      {/* Fixed Pagination Bar at bottom of viewport - Compact on mobile */}
      {showContent && totalCount > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 px-2 sm:px-4 pb-2 sm:pb-4 pt-1 ${
          isDarkMode 
            ? 'bg-linear-to-t from-slate-950 via-slate-950/95 to-transparent' 
            : 'bg-linear-to-t from-white via-white/95 to-transparent'
        }`}>
          <div className={`max-w-7xl mx-auto rounded-xl sm:rounded-2xl overflow-hidden shadow-xl sm:shadow-2xl border ${
            isDarkMode 
              ? 'bg-slate-900/95 border-white/10 backdrop-blur-xl' 
              : 'bg-white/95 border-gray-200 backdrop-blur-xl'
          }`}>
            {/* Progress bar - thinner on mobile */}
            <div className={`h-0.5 sm:h-1 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
              <div 
                className="h-full bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${Math.min((currentPage / Math.max(totalPages, 1)) * 100, 100)}%` }}
              />
            </div>
            
            {/* Single-line compact layout on mobile */}
            <div className="px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
              {/* Left: Compact Page Info */}
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm shrink-0 ${
                  isDarkMode 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                  {currentPage}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs sm:text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span className="hidden sm:inline">Page </span>
                    <span className="text-blue-500">{currentPage}</span>
                    <span className="text-gray-400 mx-0.5">/</span>
                    <span className="text-purple-500">{totalPages}</span>
                  </div>
                  <div className={`text-[10px] sm:text-xs truncate ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                    {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
                  </div>
                </div>
              </div>
              
              {/* Right: Compact Navigation Buttons */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => loadPageData(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoadingCutoffs}
                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-30 ${
                    isDarkMode 
                      ? 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/10' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  <span className="hidden sm:inline">← Prev</span>
                  <span className="sm:hidden">←</span>
                </button>
                
                {currentPage < totalPages && (
                  <button
                    onClick={() => loadPageData(currentPage + 1)}
                    disabled={isLoadingCutoffs}
                    className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold text-white bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg"
                  >
                    {isLoadingCutoffs ? '...' : 'More →'}
                  </button>
                )}
                
                <button
                  onClick={() => loadPageData(currentPage + 1)}
                  disabled={currentPage >= totalPages || isLoadingCutoffs}
                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-30 ${
                    isDarkMode 
                      ? 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/10' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  <span className="hidden sm:inline">Next →</span>
                  <span className="sm:hidden">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
