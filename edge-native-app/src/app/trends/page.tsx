'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Users, TrendingUp, Award, Zap, Sparkles, ArrowRight, Target } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
<<<<<<< Updated upstream:edge-native-app/src/app/trends/page.tsx
import Footer from '@/components/ui/Footer';
import { useAvailableYears, useYearOptions } from '@/hooks/useAvailableYears';
import './trends.css';
=======
>>>>>>> Stashed changes:src/components/trends/TrendsClient.tsx

const TrendsPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isDarkMode } = useTheme();
  const { isAuthenticated } = useAuth();
  
<<<<<<< Updated upstream:edge-native-app/src/app/trends/page.tsx
  // Use dynamic year detection
  const { availableYears, yearData, latestYear, loading: yearsLoading } = useAvailableYears();
  const [selectedYear, setSelectedYear] = useState('');
=======
  // Hero/Content transition state
  const [showContent, setShowContent] = useState(false);
  
  // Handle "Start Exploring" button click
  const handleStartExploring = () => {
    setShowContent(true);
  };
  
  // Partition Key based filtering (replaces Year + Stream)
  const [partitionKeys, setPartitionKeys] = useState<string[]>([]);
  const [selectedPartitionKey, setSelectedPartitionKey] = useState<string>('');
  const [partitionKeysLoading, setPartitionKeysLoading] = useState(true);
>>>>>>> Stashed changes:src/components/trends/TrendsClient.tsx
  
  // For Years comparison mode (partition_key A vs partition_key B for same college)
  const [selectedPartitionKeyA, setSelectedPartitionKeyA] = useState<string>('');
  const [selectedPartitionKeyB, setSelectedPartitionKeyB] = useState<string>('');
  
  // Available rounds for the selected partition_key
  const [availableRounds, setAvailableRounds] = useState<number[]>([1, 2, 3]);
  
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [comparisonType, setComparisonType] = useState<'colleges' | 'years'>('colleges');
  const [selectedRounds, setSelectedRounds] = useState<number[]>([1, 2]);
  const [selectedQuota, setSelectedQuota] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCollegeA, setSelectedCollegeA] = useState<string>('');
  const [selectedCollegeB, setSelectedCollegeB] = useState<string>('');
  const [searchTermA, setSearchTermA] = useState<string>('');
  const [searchTermB, setSearchTermB] = useState<string>('');
  const [showSuggestionsA, setShowSuggestionsA] = useState<boolean>(false);
  const [showSuggestionsB, setShowSuggestionsB] = useState<boolean>(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  // API Integration State
  const [colleges, setColleges] = useState<{id: string, name: string, state: string}[]>([]);
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [quotas, setQuotas] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [trendDataA, setTrendDataA] = useState<any[]>([]);
  const [trendDataB, setTrendDataB] = useState<any[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [collegeSuggestionsA, setCollegeSuggestionsA] = useState<{id: string, name: string, state: string}[]>([]);
  const [collegeSuggestionsB, setCollegeSuggestionsB] = useState<{id: string, name: string, state: string}[]>([]);
  const [isSearchingCollegesA, setIsSearchingCollegesA] = useState(false);
  const [isSearchingCollegesB, setIsSearchingCollegesB] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  // Fetch filter options from cascading-filters API
  const fetchFilterOptions = async (partitionKey: string) => {
    setIsLoadingFilters(true);
    try {
      const response = await fetch(`/api/cascading-filters?partition_key=${partitionKey}`);
      const data = await response.json();
      if (data.success && data.data) {
        setCourses((data.data.courses || []).map((name: string, idx: number) => ({ id: String(idx), name })));
        setQuotas(data.data.quotas || []);
        setCategories(data.data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Fetch colleges from search API
  const fetchColleges = async (searchTerm: string, state?: string) => {
    if (searchTerm.length < 2) return [];
    try {
      const params = new URLSearchParams({ q: searchTerm, limit: '10' });
      if (state && state !== 'all') params.append('state', state);
      const response = await fetch(`/api/colleges/search?${params}`);
      const data = await response.json();
      return (data.data || []).map((college: any) => ({
        id: college.id || '',
        name: college.name || '',
        state: college.state || ''
      }));
    } catch (error) {
      console.error('Error searching colleges:', error);
      return [];
    }
  };

  // Handle college search with debounce
  const handleCollegeSearchA = async (term: string) => {
    setSearchTermA(term);
    if (term.length < 2) {
      setCollegeSuggestionsA([]);
      setShowSuggestionsA(false);
      return;
    }
    setIsSearchingCollegesA(true);
    setShowSuggestionsA(true);
    const results = await fetchColleges(term);
    setCollegeSuggestionsA(results);
    setIsSearchingCollegesA(false);
  };

  const handleCollegeSearchB = async (term: string) => {
    setSearchTermB(term);
    if (term.length < 2) {
      setCollegeSuggestionsB([]);
      setShowSuggestionsB(false);
      return;
    }
    setIsSearchingCollegesB(true);
    setShowSuggestionsB(true);
    const results = await fetchColleges(term);
    setCollegeSuggestionsB(results);
    setIsSearchingCollegesB(false);
  };

  // Fetch trend data for comparison
  const fetchTrendData = async (params: {
    masterCollegeId?: string;
    category?: string;
    quota?: string;
    partitionKey?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.masterCollegeId) queryParams.append('master_college_id', params.masterCollegeId);
    if (params.category && params.category !== 'all') queryParams.append('category', params.category);
    if (params.quota && params.quota !== 'all') queryParams.append('quota', params.quota);
    if (params.partitionKey) queryParams.append('partition_key', params.partitionKey);
    queryParams.append('limit', '500');

    try {
      const response = await fetch(`/api/trends?${queryParams}`);
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('Error fetching trend data:', error);
      return [];
    }
  };

  // Load trend data when selections change
  const loadTrendData = async () => {
    if (comparisonType === 'colleges') {
      // Compare College A vs College B within same partition_key
      if (!selectedCollegeA && !selectedCollegeB) return;
      if (!selectedPartitionKey) return;
      
      setIsLoadingTrends(true);
      setTrendError(null);
      try {
        const [dataA, dataB] = await Promise.all([
          selectedCollegeA ? fetchTrendData({
            masterCollegeId: selectedCollegeA,
            partitionKey: selectedPartitionKey,
            category: selectedCategory,
            quota: selectedQuota
          }) : Promise.resolve([]),
          selectedCollegeB ? fetchTrendData({
            masterCollegeId: selectedCollegeB,
            partitionKey: selectedPartitionKey,
            category: selectedCategory,
            quota: selectedQuota
          }) : Promise.resolve([])
        ]);
        setTrendDataA(dataA);
        setTrendDataB(dataB);
      } catch (error) {
        setTrendError('Failed to load trend data');
        console.error(error);
      } finally {
        setIsLoadingTrends(false);
      }
    } else {
      // Years comparison - same college, different partition_keys
      if (!selectedCollegeA) return;
      if (!selectedPartitionKeyA || !selectedPartitionKeyB) return;
      
      setIsLoadingTrends(true);
      setTrendError(null);
      try {
        const [dataA, dataB] = await Promise.all([
          fetchTrendData({
            masterCollegeId: selectedCollegeA,
            partitionKey: selectedPartitionKeyA,
            category: selectedCategory,
            quota: selectedQuota
          }),
          fetchTrendData({
            masterCollegeId: selectedCollegeA,
            partitionKey: selectedPartitionKeyB,
            category: selectedCategory,
            quota: selectedQuota
          })
        ]);
        setTrendDataA(dataA);
        setTrendDataB(dataB);
      } catch (error) {
        setTrendError('Failed to load trend data');
        console.error(error);
      } finally {
        setIsLoadingTrends(false);
      }
    }
  };

  // Fetch partition keys on mount
  useEffect(() => {
    const fetchPartitionKeys = async () => {
      setPartitionKeysLoading(true);
      try {
        const response = await fetch('/api/partition-keys');
        const data = await response.json();
        if (data.success && data.partitions) {
          const keys = (data.partitions as any[]).map(p => p.id);
          setPartitionKeys(keys);
          // Set default partition key to first one (usually latest)
          if (keys.length > 0 && !selectedPartitionKey) {
            setSelectedPartitionKey(keys[0]);
            setSelectedPartitionKeyA(keys[0]);
            if (keys.length > 1) {
              setSelectedPartitionKeyB(keys[1]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching partition keys:', error);
      } finally {
        setPartitionKeysLoading(false);
      }
    };
    fetchPartitionKeys();
  }, []);

  // Fetch filter options when partition_key changes
  useEffect(() => {
    if (selectedPartitionKey) {
      fetchFilterOptions(selectedPartitionKey);
    }
  }, [selectedPartitionKey]);

  // Set default rounds when available
  useEffect(() => {
    if (availableRounds.length > 0) {
      // Ensure selected rounds are available
      const validRounds = selectedRounds.filter(round => availableRounds.includes(round));
      if (validRounds.length === 0 && availableRounds.length > 0) {
        setSelectedRounds([availableRounds[0]]);
      } else if (validRounds.length !== selectedRounds.length) {
        setSelectedRounds(validRounds);
      }
    }
  }, [availableRounds, selectedRounds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Helper function to get closing rank display from trend data
  const getClosingRank = (trendData: any[], category: string, round: number): string => {
    if (!trendData || trendData.length === 0) return 'N/A';
    
    // Find matching record for this category and round
    const matchingRecord = trendData.find(record => 
      record.category?.toLowerCase() === category.toLowerCase() && 
      record.round === round
    );
    
    if (!matchingRecord) return 'N/A';
    
    const closingRank = matchingRecord.closing_rank;
    return closingRank ? String(closingRank) : 'N/A';
  };

  // Get college name from trend data
  const getCollegeName = (trendData: any[]): string => {
    if (!trendData || trendData.length === 0) return 'Select College';
    return trendData[0]?.college_name || 'Unknown College';
  };

  // Get partition key display name (e.g., "AIQ-PG-2024" -> "PG 2024 (AIQ)")
  const formatPartitionKey = (pk: string): string => {
    const parts = pk.split('-');
    if (parts.length >= 3) {
      return `${parts[1]} ${parts[2]} (${parts[0]})`;
    }
    return pk;
  };

  // Get unique rounds from trend data
  const getAvailableRoundsFromData = (data: any[]): number[] => {
    const rounds = new Set<number>();
    data.forEach(record => {
      if (record.round) rounds.add(record.round);
    });
    return Array.from(rounds).sort((a, b) => a - b);
  };

  const addRound = () => {
    if (selectedRounds.length < 5 && availableRounds.length > selectedRounds.length) {
      const nextRound = availableRounds.find(round => !selectedRounds.includes(round));
      if (nextRound) {
        setSelectedRounds([...selectedRounds, nextRound]);
      }
    }
  };

  const removeRound = (round: number) => {
    if (selectedRounds.length > 1) {
      setSelectedRounds(selectedRounds.filter(r => r !== round));
    }
  };

  const resetFilters = () => {
    setSelectedCollege('');
    setSelectedCourse('');
    if (partitionKeys.length > 0) {
      setSelectedPartitionKey(partitionKeys[0]);
      setSelectedPartitionKeyA(partitionKeys[0]);
      if (partitionKeys.length > 1) {
        setSelectedPartitionKeyB(partitionKeys[1]);
      }
    }
    setSelectedRounds(availableRounds.length > 0 ? [availableRounds[0]] : [1]);
    setSelectedQuota('all');
    setSelectedCategory('all');
    setSelectedCollegeA('');
    setSelectedCollegeB('');
    setSearchTermA('');
    setSearchTermB('');
    setShowSuggestionsA(false);
    setShowSuggestionsB(false);
    setTrendDataA([]);
    setTrendDataB([]);
  };

  // Function to handle college selection from search
  const handleCollegeSelect = (college: any, type: 'A' | 'B') => {
    if (type === 'A') {
      setSelectedCollegeA(college.id);
      setSearchTermA(college.name);
      setShowSuggestionsA(false);
    } else {
      setSelectedCollegeB(college.id);
      setSearchTermB(college.name);
      setShowSuggestionsB(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden transition-all duration-500">
      {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={600}
          baseHue={260}
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
          baseHue={260}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-indigo-50/20 to-pink-50/30 z-10"></div>
        </LightVortex>
      )}

      {/* Content */}
      <div className="relative z-20">
        {/* Hero Section */}
        <main className="flex items-center justify-center px-4 sm:px-8 py-8 md:py-12">
          <div className="text-center max-w-4xl">
            {/* Primary Hook */}
            <motion.div
              className={`text-3xl md:text-4xl mb-2 font-medium transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Decode the Hidden Patterns in Cutoffs
            </motion.div>

            {/* Main Title */}
            <motion.h1
              className={`text-6xl md:text-8xl font-bold mb-2 transition-colors duration-300 ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.8 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Trend Analysis
            </motion.h1>

            {/* Secondary Hook */}
            <motion.p
              className={`text-xl md:text-2xl mb-2 max-w-2xl mx-auto transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              The Data That Changes Everything
            </motion.p>

          </div>
        </main>
      </div>

<<<<<<< Updated upstream:edge-native-app/src/app/trends/page.tsx
      {/* Trend Visualization Section */}
      <div className="relative z-20 py-4 px-4">
=======
      {/* Section 2: Content Section */}
      <AnimatePresence mode="wait">
        {showContent && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-20 overflow-y-auto pt-16"
          >
            {/* Premium Gate for Trend Analysis */}
            <PremiumGate featureKey={FEATURE_KEYS.TREND_ANALYSIS}>
              {/* Trend Visualization Section */}
              <div className="py-4 px-4">
>>>>>>> Stashed changes:src/components/trends/TrendsClient.tsx
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.2, delay: 0.3 }}
          >
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
              isDarkMode 
                ? 'bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'
            }`}>
              Interactive Trend Analysis
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${
              isDarkMode 
                ? 'bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent'
            }`}>
              Explore cutoff patterns across colleges, courses, and years with our AI-powered visualization
            </p>
          </motion.div>

          {/* Unified Smart Filter Section */}
          <motion.div
            className={`relative z-30 backdrop-blur-md rounded-2xl p-6 mb-8 border-2 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/80 border-gray-200/60'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.2, delay: 0.35 }}
          >
            {/* Header with Comparison Type and Reset */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Trend Analysis
                </h3>
                <div className={`backdrop-blur-sm rounded-lg p-1 border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-100/50 border-gray-200'
                }`}>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setComparisonType('colleges')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                        comparisonType === 'colleges'
                          ? isDarkMode 
                            ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                            : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                          : isDarkMode 
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      Colleges
                    </button>
                    <button
                      onClick={() => setComparisonType('years')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                        comparisonType === 'years'
                          ? isDarkMode 
                            ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                            : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                          : isDarkMode 
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      Years
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={resetFilters}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30' 
                    : 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
                }`}
              >
                Reset All
              </button>
              <button
                onClick={loadTrendData}
                disabled={isLoadingTrends}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 border border-blue-500/40' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-700'
                } ${isLoadingTrends ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoadingTrends ? 'Loading...' : 'Compare Trends'}
              </button>
            </div>

            {/* Brilliant Smart Filter Layout */}
            <div className="space-y-6">
              {/* Global Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Partition Key Filter (replaces Year + Stream) */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Dataset
                  </label>
                  <select 
                    value={selectedPartitionKey}
                    onChange={(e) => setSelectedPartitionKey(e.target.value)}
                    disabled={partitionKeysLoading}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                        : 'bg-white/95 text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    {partitionKeysLoading ? (
                      <option>Loading datasets...</option>
                    ) : partitionKeys.length > 0 ? (
                      partitionKeys.map((pk, index) => (
                        <option key={index} value={pk}>{formatPartitionKey(pk)}</option>
                      ))
                    ) : (
                      <option disabled>No datasets available</option>
                    )}
                  </select>
                </div>

                {/* Quota Filter */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Quota
                  </label>
                  <select 
                    value={selectedQuota}
                    onChange={(e) => setSelectedQuota(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                        : 'bg-white/95 text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    <option value="all">All Quotas</option>
                    {quotas.length > 0 ? (
                      quotas.map((quota, index) => (
                        <option key={index} value={quota}>{quota}</option>
                      ))
                    ) : null}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Category
                  </label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                        : 'bg-white/95 text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    <option value="all">All Categories</option>
                    {categories.filter(cat => cat !== 'all').map((category, index) => (
                      <option key={index} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* College Selection for Years Comparison */}
              {comparisonType === 'years' && (
                <div className={`backdrop-blur-sm rounded-xl p-4 border mb-6 ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50/50 border-gray-200'
                }`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    College Selection
                  </h4>
                  
                  <div className="space-y-4">
                      {/* Search-based College Selection */}
                      <div className="relative">
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                          Search College
                        </label>
                        <input
                          type="text"
                          value={searchTermA}
                          onChange={(e) => handleCollegeSearchA(e.target.value)}
                          onFocus={() => searchTermA.length >= 2 && setShowSuggestionsA(true)}
                          onBlur={() => setTimeout(() => setShowSuggestionsA(false), 200)}
                          placeholder="Type college name to search..."
                          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                            isDarkMode 
                              ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                              : 'bg-white/95 text-gray-900 shadow-sm border border-gray-200'
                          }`}
                        />
                        
                        {/* Search Suggestions */}
                        {showSuggestionsA && (
                          <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-y-auto ${
                            isDarkMode 
                              ? 'bg-slate-900/95 backdrop-blur-md border-white/20' 
                              : 'bg-white border-gray-200'
                          }`}>
                            {isSearchingCollegesA ? (
                              <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-500'}`}>
                                Searching...
                              </div>
                            ) : collegeSuggestionsA.length > 0 ? (
                              collegeSuggestionsA.map(college => (
                                <button
                                  key={college.id}
                                  onClick={() => handleCollegeSelect(college, 'A')}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors duration-200 ${
                                    isDarkMode ? 'hover:bg-white/10 text-white/90' : 'text-gray-700'
                                  }`}
                                >
                                  <div className="font-medium">{college.name}</div>
                                  <div className="text-xs opacity-70">{college.state}</div>
                                </button>
                              ))
                            ) : (
                              <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-500'}`}>
                                No colleges found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  </div>
                </div>
              )}

              {/* College Selection with Individual State Filters */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* College A Section */}
                <div className={`backdrop-blur-sm rounded-xl p-4 border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50/50 border-gray-200'
                }`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {comparisonType === 'colleges' ? 'College A' : 'Year A'}
                  </h4>
                  
                  {comparisonType === 'colleges' ? (
                    <div className="space-y-4">
                        {/* Search-based College A Selection */}
                        <div className="relative">
                          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            Search College A
                          </label>
                          <input
                            type="text"
                            value={searchTermA}
                            onChange={(e) => handleCollegeSearchA(e.target.value)}
                            onFocus={() => searchTermA.length >= 2 && setShowSuggestionsA(true)}
                            onBlur={() => setTimeout(() => setShowSuggestionsA(false), 200)}
                            placeholder="Type college name to search..."
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                              isDarkMode 
                                ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                                : 'bg-white/95 text-gray-900 shadow-sm border border-gray-200'
                            }`}
                          />
                          
                          {/* Search Suggestions */}
                          {showSuggestionsA && (
                            <div className={`absolute z-50 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-y-auto ${
                              isDarkMode 
                                ? 'bg-slate-900/95 backdrop-blur-md border-white/20' 
                                : 'bg-white border-gray-200'
                            }`}>
                              {isSearchingCollegesA ? (
                                <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-500'}`}>
                                  Searching...
                                </div>
                              ) : collegeSuggestionsA.length > 0 ? (
                                collegeSuggestionsA.map(college => (
                                  <button
                                    key={college.id}
                                    onClick={() => handleCollegeSelect(college, 'A')}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors duration-200 ${
                                      isDarkMode ? 'hover:bg-white/10 text-white/90' : 'text-gray-700'
                                    }`}
                                  >
                                    <div className="font-medium">{college.name}</div>
                                    <div className="text-xs opacity-70">{college.state}</div>
                                  </button>
                                ))
                              ) : (
                                <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-500'}`}>
                                  No colleges found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                    </div>
                  ) : (
                    /* Years mode: Partition Key A selection */
                    <select
                    value={selectedPartitionKey}
                    onChange={(e) => setSelectedPartitionKey(e.target.value)}
                    disabled={partitionKeysLoading}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md'
                        : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    {partitionKeys.map(pk => (
                      <option key={pk} value={pk}>{formatPartitionKey(pk)}</option>
                    ))}
                  </select>
                  )}
                </div>

                {/* College B Section */}
                <div className={`backdrop-blur-sm rounded-xl p-4 border ${
                  isDarkMode
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50/50 border-gray-200'
                }`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {comparisonType === 'colleges' ? 'College B' : 'Year B'}
                  </h4>

                  {comparisonType === 'colleges' ? (
                    <div className="space-y-4">
                        {/* Search-based College B Selection */}
                        <div className="relative">
                          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            Search College B
                          </label>
                          <input
                            type="text"
                            value={searchTermB}
                            onChange={(e) => handleCollegeSearchB(e.target.value)}
                            onFocus={() => searchTermB.length >= 2 && setShowSuggestionsB(true)}
                            onBlur={() => setTimeout(() => setShowSuggestionsB(false), 200)}
                            placeholder="Type college name to search..."
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                              isDarkMode
                                ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md'
                                : 'bg-white/95 text-gray-900 shadow-sm border border-gray-200'
                            }`}
                          />

                          {/* Search Suggestions */}
                          {showSuggestionsB && (
                            <div className={`absolute z-50 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-y-auto ${
                              isDarkMode
                                ? 'bg-slate-900/95 backdrop-blur-md border-white/20'
                                : 'bg-white border-gray-200'
                            }`}>
                              {isSearchingCollegesB ? (
                                <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-500'}`}>
                                  Searching...
                                </div>
                              ) : collegeSuggestionsB.length > 0 ? (
                                collegeSuggestionsB.map(college => (
                                  <button
                                    key={college.id}
                                    onClick={() => handleCollegeSelect(college, 'B')}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors duration-200 ${
                                      isDarkMode ? 'hover:bg-white/10 text-white/90' : 'text-gray-700'
                                    }`}
                                  >
                                    <div className="font-medium">{college.name}</div>
                                    <div className="text-xs opacity-70">{college.state}</div>
                                  </button>
                                ))
                              ) : (
                                <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-500'}`}>
                                  No colleges found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                    </div>
                  ) : (
                    /* Years Comparison - Partition Key B Selection */
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                        Dataset B
                      </label>
                        <select
                          value={selectedPartitionKeyB}
                          onChange={(e) => setSelectedPartitionKeyB(e.target.value)}
                          disabled={partitionKeysLoading}
                          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                            isDarkMode
                              ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md'
                              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                          }`}
                        >
                          {partitionKeys.map(pk => (
                            <option key={pk} value={pk}>{formatPartitionKey(pk)}</option>
                          ))}
                        </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Filter Row */}
            <div className="mt-4">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Category (Quick Select)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    selectedCategory === 'all'
                      ? isDarkMode 
                        ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                        : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                      : isDarkMode 
                        ? 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white border border-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.filter(cat => cat !== 'all').map((category, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      selectedCategory === category
                        ? isDarkMode 
                          ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                          : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                        : isDarkMode 
                          ? 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white border border-white/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side-by-Side Comparison Tables */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.2, delay: 0.5 }}
          >
            {/* Table A */}
            <div className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/80 border-gray-200/60'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {comparisonType === 'colleges' 
                    ? (trendDataA.length > 0 ? getCollegeName(trendDataA) : 'College A')
                    : formatPartitionKey(selectedPartitionKeyA)
                  }
                </h3>
                <div className="flex gap-2">
                  {selectedRounds.map(round => (
                    <span key={round} className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      Round {round}
                    </span>
                  ))}
                  {selectedRounds.length < 5 && availableRounds.length > selectedRounds.length && (
                    <button
                      onClick={addRound}
                      className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center hover:bg-white/10 transition-all duration-300 ${
                        isDarkMode ? 'border-white/40 text-white/60' : 'border-gray-400 text-gray-600'
                      }`}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b-2 ${isDarkMode ? 'border-white/20' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Category
                      </th>
                      {selectedRounds.map(round => (
                        <th key={round} className={`text-center py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          R{round}
                          {round > 2 && (
                            <button
                              onClick={() => removeRound(round)}
                              className="ml-1 text-red-500 hover:text-red-700 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.filter(cat => cat !== 'all').map((category, idx) => (
                      <tr key={idx} className={`border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
                        <td className={`py-3 px-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category}
                        </td>
                        {selectedRounds.map(round => (
                          <td key={round} className={`text-center py-3 px-2 ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                            {isLoadingTrends ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              getClosingRank(trendDataA, category, round)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table B */}
            <div className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/80 border-gray-200/60'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {comparisonType === 'colleges' 
                    ? (trendDataB.length > 0 ? getCollegeName(trendDataB) : 'College B')
                    : formatPartitionKey(selectedPartitionKeyB)
                  }
                </h3>
                <div className="flex gap-2">
                  {selectedRounds.map(round => (
                    <span key={round} className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      Round {round}
                    </span>
                  ))}
                  {selectedRounds.length < 5 && availableRounds.length > selectedRounds.length && (
                    <button
                      onClick={addRound}
                      className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center hover:bg-white/10 transition-all duration-300 ${
                        isDarkMode ? 'border-white/40 text-white/60' : 'border-gray-400 text-gray-600'
                      }`}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b-2 ${isDarkMode ? 'border-white/20' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Category
                      </th>
                      {selectedRounds.map(round => (
                        <th key={round} className={`text-center py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          R{round}
                          {round > 2 && (
                            <button
                              onClick={() => removeRound(round)}
                              className="ml-1 text-red-500 hover:text-red-700 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.filter(cat => cat !== 'all').map((category, idx) => (
                      <tr key={idx} className={`border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
                        <td className={`py-3 px-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category}
                        </td>
                        {selectedRounds.map(round => (
                          <td key={round} className={`text-center py-3 px-2 ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                            {isLoadingTrends ? (
                              <span className="animate-pulse">...</span>
                            ) : (
                              getClosingRank(trendDataB, category, round)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default TrendsPage;
