'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
import Footer from '@/components/layout/Footer';
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
  // AI-enhanced fields
  predictionScore?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  recommendationRank?: number;
  embedding?: number[];
}

interface MasterData {
  states: Array<{ id: string; name: string }>;
  colleges: Array<{ id: string; name: string; state_id: string; college_type: string; stream_id: string; stream_name: string; counselling_bodies: string[] }>;
  courses: Array<{ id: string; name: string; level: string }>;
  quotas: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

const EnhancedCutoffsPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  // State management
  const [availableRounds, setAvailableRounds] = useState<number[]>([1, 2, 3, 4]);
  const [visibleRounds, setVisibleRounds] = useState<number[]>([1, 2]);
  const [error, setError] = useState<string | null>(null);
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  const [isTableHeaderSticky, setIsTableHeaderSticky] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
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
    initialData: cutoffData,
    enableWebAssembly: true,
    enableVirtualization: true,
    enableAI: true,
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

  // Scroll detection for hero fade and second section slide
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = window.innerHeight;
      
      const shouldSlideSecondSection = scrollY > heroHeight * 0.3;
      const shouldEnableStickySearch = scrollY > heroHeight * 0.6;
      const shouldEnableInfiniteScroll = scrollY > heroHeight * 1.0;
      
      setIsSearchBarVisible(shouldSlideSecondSection);
      setIsTableHeaderSticky(shouldEnableInfiniteScroll);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <div className="relative">
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
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-indigo-50/30 z-10"></div>
          </LightVortex>
      )}

      {/* Section 1: Hero Section - Full Viewport */}
      <div className={`relative z-10 h-screen transition-opacity duration-700 ease-out ${
        isSearchBarVisible ? 'opacity-0' : 'opacity-100'
      }`}>
        <CutoffsHeroSection 
          isDarkMode={isDarkMode}
          isVisible={true}
        />
      </div>

      {/* Section 2: Content Section - Slides up over hero */}
      <div 
        className={`relative z-20 transition-transform duration-700 ease-out ${
          isSearchBarVisible ? 'translate-y-0' : 'translate-y-0'
        }`} 
        style={{
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          marginTop: isSearchBarVisible ? '0' : '-100vh'
        }}
      >
        {/* Enhanced Header with AI Insights */}
        <div className={`sticky z-50 transition-all duration-300 ${
          isTableHeaderSticky ? 'top-16' : 'top-0'
        }`}>
          <div className={`px-4 sm:px-6 py-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700`}>
            <div className="flex items-center justify-between gap-4">
              <motion.div className="flex-1 max-w-2xl">
                <UnifiedSearchBar
                  placeholder="Search cutoffs with AI-powered intelligence..."
                  contentType="cutoffs"
                  collegesData={[]}
                  onSearchResults={handleAISearch}
                  debounceMs={300}
                  showSuggestions={true}
                  showAIInsight={true}
                />
              </motion.div>

              <div className="flex items-center space-x-2">
                {/* AI Insights */}
                <div className="flex items-center space-x-4 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {statistics.filteredRecords} Records
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {insights.trends.up} Trending
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {insights.predictions.highConfidence} High Confidence
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

        {/* Enhanced Excel Table Section */}
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
          {isLoading || isTableLoading ? (
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

      {/* Footer */}
      <Footer />

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

export default EnhancedCutoffsPage;
