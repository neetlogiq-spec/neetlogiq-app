'use client';

import React, { useState, useEffect } from 'react';
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
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings,
  Download as DownloadIcon
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Vortex } from '@/components/ui/vortex';
import { LightVortex } from '@/components/ui/light-vortex';
import CutoffsHeroSection from '@/components/cutoffs/CutoffsHeroSection';
import SmartFilterDashboard from '@/components/cutoffs/SmartFilterDashboard';
import EnhancedExcelTable from '@/components/cutoffs/EnhancedExcelTable';
import CutoffDetailsModal from '@/components/cutoffs/CutoffDetailsModal';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import { useEdgeData } from '@/hooks/useEdgeData';
import { useVectorSearch } from '@/hooks/useVectorSearch';
import { useEnhancedExcelTable } from '@/hooks/useEnhancedExcelTable';

interface Cutoff {
  id: string;
  college: string;
  course: string;
  stream: string;
  category: string;
  quota: string;
  year: number;
  round: number;
  openingRank: number;
  closingRank: number;
  totalSeats: number;
  state: string;
  counsellingBody: string;
  collegeType: string;
}


interface MasterData {
  states: Array<{ id: string; name: string }>;
  colleges: Array<{ id: string; name: string; state_id: string; college_type: string; stream_id: string; stream_name: string; counselling_bodies: string[] }>;
  courses: Array<{ id: string; name: string; level: string }>;
  quotas: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

export default function CutoffsEnhancedClient() {
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Filter states
  const [selectedState, setSelectedState] = useState('all');
  const [selectedCounsellingBody, setSelectedCounsellingBody] = useState('all');
  const [selectedManagement, setSelectedManagement] = useState('all');
  const [selectedStream, setSelectedStream] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedQuota, setSelectedQuota] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewType, setViewType] = useState<'card' | 'table'>('table');
  const [multiYear, setMultiYear] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCutoff, setSelectedCutoff] = useState<Cutoff | null>(null);

  // Rank range states
  const [minPossibleRank, setMinPossibleRank] = useState(1);
  const [maxPossibleRank, setMaxPossibleRank] = useState(1000000);
  const [rankRange, setRankRange] = useState({
    openingRank: [1, 1000000],
    closingRank: [1, 1000000]
  });

  // Mock data for demonstration
  const mockCutoffs: Cutoff[] = [
    { id: '1', college: 'All India Institute of Medical Sciences, Delhi', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 1, closingRank: 50, totalSeats: 107, state: 'Delhi', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '2', college: 'JIPMER Puducherry', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 51, closingRank: 180, totalSeats: 150, state: 'Puducherry', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '3', college: 'Maulana Azad Medical College, Delhi', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 25, closingRank: 85, totalSeats: 250, state: 'Delhi', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '4', college: 'King George Medical University, Lucknow', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'State', year: 2024, round: 1, openingRank: 150, closingRank: 2500, totalSeats: 250, state: 'Uttar Pradesh', counsellingBody: 'UPPGMEE', collegeType: 'Government' },
    { id: '5', college: 'Grant Medical College, Mumbai', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'State', year: 2024, round: 1, openingRank: 200, closingRank: 3200, totalSeats: 200, state: 'Maharashtra', counsellingBody: 'DMER', collegeType: 'Government' },
    { id: '6', college: 'Seth GS Medical College, Mumbai', course: 'MBBS', stream: 'Medical', category: 'OBC', quota: 'State', year: 2024, round: 1, openingRank: 3500, closingRank: 8500, totalSeats: 180, state: 'Maharashtra', counsellingBody: 'DMER', collegeType: 'Government' },
    { id: '7', college: 'Christian Medical College, Vellore', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'Management', year: 2024, round: 1, openingRank: 100, closingRank: 500, totalSeats: 100, state: 'Tamil Nadu', counsellingBody: 'CMC', collegeType: 'Private' },
    { id: '8', college: 'Armed Forces Medical College, Pune', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 75, closingRank: 350, totalSeats: 150, state: 'Maharashtra', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '9', college: 'Lady Hardinge Medical College, Delhi', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 180, closingRank: 650, totalSeats: 200, state: 'Delhi', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '10', college: 'Kasturba Medical College, Manipal', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'Management', year: 2024, round: 1, openingRank: 800, closingRank: 15000, totalSeats: 250, state: 'Karnataka', counsellingBody: 'KEA', collegeType: 'Private' },
    { id: '11', college: 'BJ Medical College, Ahmedabad', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'State', year: 2024, round: 1, openingRank: 500, closingRank: 4500, totalSeats: 250, state: 'Gujarat', counsellingBody: 'ACPPGMEC', collegeType: 'Government' },
    { id: '12', college: 'Government Medical College, Chandigarh', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'UT', year: 2024, round: 1, openingRank: 400, closingRank: 3000, totalSeats: 150, state: 'Chandigarh', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '13', college: 'St. Johns Medical College, Bangalore', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'Management', year: 2024, round: 1, openingRank: 1200, closingRank: 18000, totalSeats: 60, state: 'Karnataka', counsellingBody: 'KEA', collegeType: 'Private' },
    { id: '14', college: 'AIIMS Jodhpur', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 150, closingRank: 800, totalSeats: 200, state: 'Rajasthan', counsellingBody: 'MCC', collegeType: 'Government' },
    { id: '15', college: 'AIIMS Bhopal', course: 'MBBS', stream: 'Medical', category: 'General', quota: 'All India', year: 2024, round: 1, openingRank: 200, closingRank: 950, totalSeats: 125, state: 'Madhya Pradesh', counsellingBody: 'MCC', collegeType: 'Government' },
  ];

  // Use new EdgeDataService hooks
  const { cutoffs: cutoffData, masterData, loading: isLoading, error: dataError } = useEdgeData({
    college_id: selectedState !== 'all' ? selectedState : undefined,
    course_id: selectedCourse !== 'all' ? selectedCourse : undefined,
    category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
    state_id: selectedState !== 'all' ? selectedState : undefined,
    year: selectedYear !== 'all' ? parseInt(selectedYear) : undefined,
    round: visibleRounds.length > 0 ? visibleRounds[0] : undefined,
    min_rank: rankRange.openingRank[0],
    max_rank: rankRange.openingRank[1],
  });
  
  const { searchCutoffs, processNaturalLanguageQuery } = useVectorSearch();

  // Enhanced Excel Table hook
  const {
    data: enhancedData,
    filteredData,
    selectedRows,
    isLoading: isTableLoading,
    isProcessing,
    statistics,
    insights,
    setSearchQuery,
    setFilters,
    setSorting,
    setSelectedRows,
    selectAll,
    clearSelection,
    exportData,
    refreshData,
    currentPage,
    totalPages,
    setCurrentPage,
    error: tableError,
    clearError
  } = useEnhancedExcelTable({
    initialData: cutoffData.length > 0 ? cutoffData : mockCutoffs,
    enableWebAssembly: true,
    enableVirtualization: true,
    enableAI: false,
    pageSize: 100
  });

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

  // Scroll detection removed - using button-click pattern now

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
            <div className="min-h-screen relative overflow-hidden transition-all duration-500">
              {/* Search Bar */}
              <div className="relative z-50">
                <div className={`px-4 sm:px-6 py-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700`}>
                  <div className="flex items-center justify-between gap-4">
                    <motion.div className="flex-1 max-w-2xl">
                      <UnifiedSearchBar
                        placeholder="Search cutoffs with AI-powered intelligence..."
                        contentType="cutoffs"
                        collegesData={[]}
                        onResults={handleSearchResults}
                        debounceMs={300}
                        showSuggestions={true}
                        showAIInsight={true}
                      />
                    </motion.div>

                    <div className="flex items-center space-x-2">
                      {/* AI Insights */}
                      <div className="flex items-center space-x-4 px-4 py-2 rounded-lg bg-linear-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {statistics?.filteredRecords ?? filteredData?.length ?? 0} Records
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            {insights?.trends?.up ?? 0} Trending
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setViewType('card')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewType === 'card'
                            ? isDarkMode
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isDarkMode
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Grid className="w-4 h-4" />
                        <span className="hidden sm:inline">Card View</span>
                      </button>
                      <button
                        onClick={() => setViewType('table')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewType === 'table'
                            ? isDarkMode
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isDarkMode
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Table className="w-4 h-4" />
                        <span className="hidden sm:inline">Excel View</span>
                      </button>
                      <button
                        onClick={() => setMultiYear(!multiYear)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          multiYear
                            ? isDarkMode
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-green-100 text-green-800 border border-green-200'
                            : isDarkMode
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Multi-Year</span>
                      </button>
                      <button
                        onClick={() => exportData('csv')}
                        disabled={isTableLoading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isDarkMode
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        <DownloadIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                      </button>
                      <button
                        onClick={refreshData}
                        disabled={isTableLoading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isDarkMode
                            ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                            : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        }`}
                      >
                        <RefreshCw className={`w-4 h-4 ${isTableLoading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Filter Dashboard */}
              <div className="px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Smart Filters
                  </h3>
                  <button
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {isFiltersExpanded ? 'Collapse' : 'Expand'}
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
                          selectedState={selectedState}
                          onStateChange={setSelectedState}
                          selectedCounsellingBody={selectedCounsellingBody}
                          onCounsellingBodyChange={setSelectedCounsellingBody}
                          selectedCollegeType={selectedManagement}
                          onCollegeTypeChange={setSelectedManagement}
                          selectedStream={selectedStream}
                          onStreamChange={setSelectedStream}
                          selectedCourse={selectedCourse}
                          onCourseChange={setSelectedCourse}
                          selectedYear={selectedYear}
                          onYearChange={setSelectedYear}
                          selectedQuota={selectedQuota}
                          onQuotaChange={setSelectedQuota}
                          selectedCategory={selectedCategory}
                          onCategoryChange={setSelectedCategory}
                          selectedRounds={visibleRounds}
                          onRoundsChange={setVisibleRounds}
                          minRank={rankRange.openingRank[0]}
                          maxRank={rankRange.openingRank[1]}
                          onRankRangeChange={(min, max) => setRankRange(prev => ({ 
                            ...prev, 
                            openingRank: [min, max],
                            closingRank: [min, max]
                          }))}
                          onReset={() => {
                            setSelectedState('all');
                            setSelectedCounsellingBody('all');
                            setSelectedManagement('all');
                            setSelectedStream('all');
                            setSelectedCourse('all');
                            setSelectedYear('2024');
                            setSelectedQuota('all');
                            setSelectedCategory('all');
                            setVisibleRounds([1, 2]);
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

              {/* Data Table Section */}
              <div className="px-4 sm:px-6 pb-8">
                {/* Error Display */}
                {(error || dataError || tableError) && (
                  <motion.div
                    className={`w-full p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-red-100 border border-red-200 text-red-800'}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {error || dataError || tableError}
                  </motion.div>
                )}

                {/* Enhanced Excel Table */}
                {(isLoading || isTableLoading) && filteredData.length === 0 ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <span className={`ml-3 text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                      {isTableLoading ? 'Processing data with AI...' : 'Loading cutoff data...'}
                    </span>
                  </div>
                ) : filteredData.length > 0 ? (
                  <EnhancedExcelTable
                    data={filteredData}
                    isDarkMode={isDarkMode}
                    onRowClick={handleViewDetails}
                  />
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
        allCutoffs={filteredData}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

