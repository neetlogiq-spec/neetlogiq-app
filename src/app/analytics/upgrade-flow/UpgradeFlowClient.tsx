/**
 * Upgrade Flow Client Component
 *
 * Main client component for college-course upgrade flow analyzer
 * Displays detailed table of student upgrades between rounds
 * Enhanced with Vortex animation, hero section, and cutoffs-style filters
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, AlertCircle, TrendingUp, Users, Sparkles, ArrowRight, Filter,
  Search, ChevronUp, ChevronDown, X, Hash, MapPin, Award, RotateCcw,
  Calendar, Building2, GraduationCap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { usePremium } from '@/contexts/PremiumContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import UpgradeFlowTable from '@/components/rank-tracking/UpgradeFlowTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Partition key type (from API)
interface PartitionKey {
  id: string;
  label: string;
  source: string;
  level: string;
  year: number;
}

// Filter dropdown component with active state styling
interface FilterDropdownProps {
  label: string;
  icon?: React.ReactNode;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (value: string) => void;
  isDarkMode: boolean;
  width?: string;
  disabled?: boolean;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  icon,
  value,
  options,
  onChange,
  isDarkMode,
  width = 'w-36',
  disabled = false
}) => {
  const isActive = value !== 'all' && value !== '';
  
  return (
    <div className={`flex flex-col ${width}`}>
      <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
        isDarkMode ? 'text-white/50' : 'text-gray-400'
      }`}>
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
            isActive
              ? isDarkMode 
                ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-500/50' 
                : 'bg-blue-50 text-blue-700 border-2 border-blue-400'
              : isDarkMode 
                ? 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20 hover:bg-white/10' 
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 shadow-sm'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {options.map(option => (
            <option key={String(option.value)} value={String(option.value)} className="bg-slate-900 text-white">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-0 top-0 h-full flex items-center pr-2 pointer-events-none">
          {isActive ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange('all');
              }}
              className="p-0.5 rounded-full pointer-events-auto hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-red-500" />
            </button>
          ) : (
            <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
          )}
        </div>
      </div>
    </div>
  );
};

// Rank input component
interface RankInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder: string;
  isDarkMode: boolean;
}

const RankInput: React.FC<RankInputProps> = ({ value, onChange, placeholder, isDarkMode }) => (
  <input
    type="number"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : '')}
    className={`w-20 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
      isDarkMode 
        ? 'bg-white/5 text-white/90 border border-white/10 placeholder-white/30' 
        : 'bg-white text-gray-700 border border-gray-200 shadow-sm placeholder-gray-400'
    }`}
  />
);

export default function UpgradeFlowClient() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const { isPremium } = usePremium();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [showContent, setShowContent] = useState(false);
  
  const [detailedData, setDetailedData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Expandable filters panel state
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Search query for table filtering
  const [searchQuery, setSearchQuery] = useState('');
  
  // Rank range filter state
  const [minRank, setMinRank] = useState<number | ''>('');
  const [maxRank, setMaxRank] = useState<number | ''>('');

  // Partition key state (replaces source/level/year)
  const [partitionKeys, setPartitionKeys] = useState<PartitionKey[]>([]);
  const [selectedPartition, setSelectedPartition] = useState<string>('');
  
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedQuota, setSelectedQuota] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedCollege, setSelectedCollege] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [fromRound, setFromRound] = useState<number>(1);
  const [toRound, setToRound] = useState<number>(2);
  
  // Available options (fetched from API based on partition)
  const [availableQuotas, setAvailableQuotas] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [availableColleges, setAvailableColleges] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

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

  // Fetch available filter options when partition changes
  useEffect(() => {
    const fetchOptions = async () => {
      if (!selectedPartition) return;
      
      try {
        setIsFetchingOptions(true);

        const response = await fetch(`/api/filter-options?partition_key=${selectedPartition}`);
        const result = await response.json();

        if (result.success && result.data) {
          // Quotas
          if (result.data.quotas) {
            const quotas = ['all', ...result.data.quotas.sort()];
            setAvailableQuotas(quotas);
            if (selectedQuota !== 'all' && !quotas.includes(selectedQuota)) {
              setSelectedQuota('all');
            }
          }

          // Categories
          if (result.data.categories) {
            const categories = ['all', ...result.data.categories.sort()];
            setAvailableCategories(categories);
            if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
              setSelectedCategory('all');
            }
          }
          
          // Courses
          if (result.data.courses) {
            const courses = ['all', ...result.data.courses.sort()];
            setAvailableCourses(courses);
            if (selectedCourse !== 'all' && !courses.includes(selectedCourse)) {
              setSelectedCourse('all');
            }
          }
          
          // Colleges
          if (result.data.colleges) {
            const colleges = ['all', ...result.data.colleges.sort()];
            setAvailableColleges(colleges);
            if (selectedCollege !== 'all' && !colleges.includes(selectedCollege)) {
              setSelectedCollege('all');
            }
          }
          
          // States
          if (result.data.states) {
            const states = ['all', ...result.data.states.sort()];
            setAvailableStates(states);
            if (selectedState !== 'all' && !states.includes(selectedState)) {
              setSelectedState('all');
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
      } finally {
        setIsFetchingOptions(false);
      }
    };

    if (showContent && selectedPartition) {
      fetchOptions();
    }
  }, [selectedPartition, showContent]);

  // Load cascading filter options based on current filter selections
  const loadCascadingOptions = async () => {
    if (!selectedPartition) return;
    
    // If all filters are 'all', no need for cascading - use full options
    if (selectedState === 'all' && selectedCourse === 'all' && selectedCollege === 'all') {
      return;
    }
    
    try {
      console.log('Loading cascading options for filters:', { selectedState, selectedCourse, selectedCollege });
      
      // Build URL with all active filters
      const params = new URLSearchParams();
      params.append('partition_key', selectedPartition);
      if (selectedState && selectedState !== 'all') params.append('state', selectedState);
      if (selectedCourse && selectedCourse !== 'all') params.append('course', selectedCourse);
      if (selectedCollege && selectedCollege !== 'all') params.append('college', selectedCollege);
      
      const response = await fetch(`/api/cascading-filters?${params.toString()}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Update filter options based on current selections (bidirectional)
        setAvailableStates(prev => {
          if (selectedState === 'all' && result.data.states?.length > 0) {
            return ['all', ...result.data.states.sort()];
          }
          return prev;
        });
        
        setAvailableCourses(prev => {
          if (selectedCourse === 'all' && result.data.courses?.length > 0) {
            return ['all', ...result.data.courses.sort()];
          }
          return prev;
        });
        
        setAvailableColleges(prev => {
          if (selectedCollege === 'all' && result.data.colleges?.length > 0) {
            return ['all', ...result.data.colleges.sort()];
          }
          return prev;
        });
        
        // Always update quotas and categories based on cascading
        if (result.data.quotas?.length > 0) {
          setAvailableQuotas(['all', ...result.data.quotas.sort()]);
          if (selectedQuota !== 'all' && !result.data.quotas.includes(selectedQuota)) {
            setSelectedQuota('all');
          }
        }
        
        if (result.data.categories?.length > 0) {
          setAvailableCategories(['all', ...result.data.categories.sort()]);
          if (selectedCategory !== 'all' && !result.data.categories.includes(selectedCategory)) {
            setSelectedCategory('all');
          }
        }
        
        console.log('Cascading filter options updated');
      }
    } catch (err) {
      console.error('Error loading cascading options:', err);
    }
  };

  // Cascading filter: reload filter options when state/course/college changes
  useEffect(() => {
    if (selectedPartition && showContent) {
      loadCascadingOptions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, selectedCourse, selectedCollege, selectedPartition]);

  const handleStartExploring = () => {
    setShowContent(true);
  };

  // Get parsed partition info from selected partition key
  const getPartitionInfo = () => {
    const partition = partitionKeys.find(p => p.id === selectedPartition);
    if (!partition) {
      // Parse from ID if partition not found in list
      const parts = selectedPartition.split('-');
      if (parts.length >= 3) {
        return {
          source: parts[0],
          level: parts[1],
          year: parseInt(parts[2])
        };
      }
      return { source: 'AIQ', level: 'PG', year: 2024 };
    }
    return {
      source: partition.source,
      level: partition.level,
      year: partition.year
    };
  };

  const handleSearch = async (targetPage?: number, targetPageSize?: number) => {
    if (!selectedPartition) return;
    
    setIsLoading(true);
    setError(null);
    
    // Use target page/pageSize if provided, otherwise current state
    const activePage = targetPage !== undefined ? targetPage : pageIndex;
    const activePageSize = targetPageSize !== undefined ? targetPageSize : pageSize;
    
    const partitionInfo = getPartitionInfo();

    try {
      const params = new URLSearchParams({
        year: partitionInfo.year.toString(),
        sourceId: `SRC_${partitionInfo.source}`,
        levelId: `LVL_${partitionInfo.level}`,
        category: selectedCategory, 
        quota: selectedQuota, 
        fromRound: fromRound.toString(),
        toRound: toRound.toString(),
        limit: activePageSize.toString(),
        offset: (activePage * activePageSize).toString(),
      });

      if (selectedState !== 'all') params.append('state', selectedState);
      if (selectedCollege !== 'all') params.append('college', selectedCollege);
      if (selectedCourse !== 'all') params.append('course', selectedCourse);
      if (minRank !== '') params.append('minRank', minRank.toString());
      if (maxRank !== '') params.append('maxRank', maxRank.toString());
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/rank-tracking/upgrade-flow-detailed?${params}`);
      const data = await response.json();

      if (data.success) {
        setDetailedData(data.data || []);
        setTotalRecords(data.count || 0);
        
        if ((data.data || []).length === 0 && activePage === 0) {
          setError('No upgrade data found. This could mean no students changed their allocation between these rounds.');
        }
      } else {
        setError(data.error || 'Failed to fetch upgrade flow data');
      }
    } catch (err) {
      console.error('Error fetching upgrade flow:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch upgrade flow data');
    } finally {
      setIsLoading(false);
    }
  };


  // Handle page change from table
  const onPageChange = (index: number) => {
    setPageIndex(index);
    handleSearch(index, pageSize);
  };

  // Handle page size change from table
  const onPageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0); // Reset to first page
    handleSearch(0, size);
  };

  const handleUpgrade = () => {
    router.push('/pricing?upgrade=premium');
  };
  
  // Check if any filters are active
  const hasActiveFilters = minRank !== '' || maxRank !== '' || selectedState !== 'all' || selectedCourse !== 'all' || selectedCollege !== 'all' || searchQuery !== '';
  
  const resetFilters = () => {
    setMinRank('');
    setMaxRank('');
    setSelectedState('all');
    setSelectedCourse('all');
    setSelectedCollege('all');
    setSearchQuery('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
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

      <AnimatePresence mode="wait">
        {/* Hero Section */}
        {!showContent ? (
          <motion.div
            key="hero"
            className="fixed inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center max-w-4xl w-full px-8 relative z-20">
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
                Decode Student Migration Patterns
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
                Upgrade Flow
              </motion.h1>

              {/* Secondary Hook */}
              <motion.p
                className={`text-xl md:text-2xl mb-8 max-w-2xl mx-auto transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' 
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
                }`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                See how students upgrade between counselling rounds
              </motion.p>

              {/* Call to Action */}
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
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
          /* Content Section */
          <motion.div
            key="content"
            className="fixed inset-0 z-20 overflow-y-auto pt-16"
            id="main-scroll-container"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-[calc(100vh-5rem)] relative overflow-auto transition-all duration-500 flex flex-col">
              
              {/* Sticky Filter Bar - Cutoffs Style */}
              <div className={`sticky top-0 z-30 px-4 sm:px-6 py-3 backdrop-blur-md ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                
                {/* Compact Filter Row */}
                <div className="flex items-center gap-2 sm:gap-3">
                  
                  {/* Search Bar */}
                  <div className="relative flex-1 min-w-[100px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm ${
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
                    className={`px-2 py-2 rounded-lg border text-xs font-medium shrink-0 max-w-[180px] ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    {partitionKeys.length === 0 ? (
                      <option value="">Loading...</option>
                    ) : (
                      partitionKeys.map(partition => (
                        <option key={partition.id} value={partition.id} className="bg-slate-900">
                          {partition.label}
                        </option>
                      ))
                    )}
                  </select>
                  
                  {/* My Rank - Quick Input */}
                  <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border-2 transition-all shrink-0 ${
                    minRank || maxRank
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : isDarkMode
                        ? 'border-purple-500/50 bg-purple-500/10'
                        : 'border-purple-300 bg-purple-50'
                  }`}>
                    <span className={`text-[9px] font-semibold uppercase whitespace-nowrap ${
                      minRank || maxRank
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-purple-600 dark:text-purple-400'
                    }`}>
                      Rank:
                    </span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minRank}
                      onChange={(e) => setMinRank(e.target.value ? parseInt(e.target.value) : '')}
                      className={`w-14 bg-transparent border-none text-xs font-mono font-bold focus:outline-none ${
                        minRank
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isDarkMode
                            ? 'text-white placeholder-purple-300'
                            : 'text-purple-900 placeholder-purple-400'
                      }`}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxRank}
                      onChange={(e) => setMaxRank(e.target.value ? parseInt(e.target.value) : '')}
                      className={`w-14 bg-transparent border-none text-xs font-mono font-bold focus:outline-none ${
                        maxRank
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isDarkMode
                            ? 'text-white placeholder-purple-300'
                            : 'text-purple-900 placeholder-purple-400'
                      }`}
                    />
                    {(minRank || maxRank) && (
                      <button onClick={() => { setMinRank(''); setMaxRank(''); }} className="text-gray-400 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  {/* Analyze Button */}
                  <Button
                    onClick={handleSearch}
                    disabled={isLoading || !selectedPartition}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Analyze</span>
                      </>
                    )}
                  </Button>
                  
                  {/* Filters Toggle */}
                  <button
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    className={`flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
                      isFiltersExpanded
                        ? isDarkMode
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                        : isDarkMode
                          ? 'bg-white/10 text-white hover:bg-white/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {isFiltersExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  
                  {/* From/To Round Selectors */}
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={fromRound}
                      onChange={(e) => setFromRound(parseInt(e.target.value))}
                      className={`px-2 py-2 rounded-lg border text-xs font-medium w-[72px] ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      {[1, 2, 3, 4, 5].map(r => (
                        <option key={r} value={r} className="bg-slate-900">R{r}</option>
                      ))}
                    </select>
                    <span className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>→</span>
                    <select
                      value={toRound}
                      onChange={(e) => setToRound(parseInt(e.target.value))}
                      className={`px-2 py-2 rounded-lg border text-xs font-medium w-[72px] ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      {[2, 3, 4, 5].filter(r => r > fromRound).length > 0
                        ? [2, 3, 4, 5].filter(r => r > fromRound).map(r => (
                            <option key={r} value={r} className="bg-slate-900">R{r}</option>
                          ))
                        : <option value={fromRound + 1} className="bg-slate-900">R{fromRound + 1}</option>
                      }
                    </select>
                  </div>
                </div>
                
                {/* Expandable Filters Panel */}
                <AnimatePresence>
                  {isFiltersExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="pt-4">
                        <motion.div
                          className={`rounded-xl overflow-hidden ${
                            isDarkMode 
                              ? 'bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-white/5' 
                              : 'bg-gradient-to-r from-gray-50 to-white border border-gray-100 shadow-sm'
                          }`}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="px-4 py-3">
                            <div className="flex flex-wrap items-end gap-4">
                              
                              {/* State Filter */}
                              <FilterDropdown
                                label="State"
                                icon={<MapPin className="w-3 h-3" />}
                                value={selectedState}
                                options={availableStates.map(s => ({ value: s, label: s === 'all' ? 'All States' : s }))}
                                onChange={setSelectedState}
                                isDarkMode={isDarkMode}
                                width="w-40"
                                disabled={isFetchingOptions}
                              />
                              
                              {/* Divider */}
                              <div className={`h-10 w-px ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
                              
                              {/* Course Filter */}
                              <FilterDropdown
                                label="Course"
                                icon={<GraduationCap className="w-3 h-3" />}
                                value={selectedCourse}
                                options={availableCourses.map(c => ({ value: c, label: c === 'all' ? 'All Courses' : c }))}
                                onChange={setSelectedCourse}
                                isDarkMode={isDarkMode}
                                width="w-48"
                                disabled={isFetchingOptions}
                              />
                              
                              {/* College Filter */}
                              <FilterDropdown
                                label="College"
                                icon={<Building2 className="w-3 h-3" />}
                                value={selectedCollege}
                                options={availableColleges.map(c => ({ value: c, label: c === 'all' ? 'All Colleges' : c }))}
                                onChange={setSelectedCollege}
                                isDarkMode={isDarkMode}
                                width="w-48"
                                disabled={isFetchingOptions}
                              />
                              
                              {/* Divider */}
                              <div className={`h-10 w-px ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
                              
                              {/* Category Filter */}
                              <FilterDropdown
                                label="Category"
                                icon={<Award className="w-3 h-3" />}
                                value={selectedCategory}
                                options={availableCategories.map(c => ({ value: c, label: c === 'all' ? 'All Categories' : c }))}
                                onChange={setSelectedCategory}
                                isDarkMode={isDarkMode}
                                width="w-32"
                                disabled={isFetchingOptions}
                              />
                              
                              {/* Quota Filter */}
                              <FilterDropdown
                                label="Quota"
                                value={selectedQuota}
                                options={availableQuotas.map(q => ({ value: q, label: q === 'all' ? 'All Quotas' : q }))}
                                onChange={setSelectedQuota}
                                isDarkMode={isDarkMode}
                                width="w-32"
                                disabled={isFetchingOptions}
                              />
                              
                              {/* Spacer */}
                              <div className="grow" />
                              
                              {/* Reset Button */}
                              <AnimatePresence>
                                {hasActiveFilters && (
                                  <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={resetFilters}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                      isDarkMode
                                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                        : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                    }`}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Clear All
                                  </motion.button>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 px-4 sm:px-6 py-6">
                <AnimatePresence mode="wait">
                  {/* Loading State */}
                  {isLoading && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center py-24"
                    >
                      <div className="text-center">
                        <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className={`text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                          Analyzing student upgrades...
                        </p>
                        <p className={`text-sm mt-2 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          Finding students who changed their allocation
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Error State */}
                  {error && !isLoading && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Upgrades Found</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>

                      <Card className={`mt-6 p-8 text-center ${isDarkMode ? 'bg-white/10' : 'bg-white/80'}`}>
                        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          No Student Upgrades
                        </h3>
                        <p className={`max-w-2xl mx-auto ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                          We couldn't find any students who upgraded between these rounds. Possible reasons:
                        </p>
                        <ul className={`text-sm mt-4 space-y-1 max-w-xl mx-auto ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          <li>• All students maintained their Round 1 allocation</li>
                          <li>• Data for this combination hasn't been imported yet</li>
                          <li>• Try a different round comparison (e.g., Round 1 → Round 3)</li>
                        </ul>
                      </Card>
                    </motion.div>
                  )}

                  {/* Results Table */}
                  {detailedData.length > 0 && !isLoading && !error && (
                    <motion.div
                      key="data"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="w-full"
                    >
                      {/* Summary Header */}
                      <div className="mb-4 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <span className="font-bold text-green-700 dark:text-green-400">
                            {totalRecords.toLocaleString()}
                          </span>
                          <span className="text-green-600 dark:text-green-500">
                            students found in total
                          </span>
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                          Round {fromRound} → Round {toRound}
                        </div>
                        {hasActiveFilters && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Filters Applied
                          </Badge>
                        )}
                        
                        <div className="grow" />
                      </div>

                      {/* Detailed Table */}
                      <UpgradeFlowTable 
                        data={detailedData} 
                        isDarkMode={isDarkMode}
                        isLoading={false} 
                        totalCount={totalRecords}
                        pageIndex={pageIndex}
                        pageSize={pageSize}
                        onPageChange={onPageChange}
                        onPageSizeChange={onPageSizeChange}
                      />
                    </motion.div>
                  )}

                  {/* Empty State */}
                  {detailedData.length === 0 && !isLoading && !error && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-24"
                    >
                      <div className={`mb-4 ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>
                        <svg className="w-24 h-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                        Select a partition and click "Analyze" to view upgrades
                      </h3>
                      <p className={isDarkMode ? 'text-white/40' : 'text-gray-500'}>
                        Choose your data source from the dropdown and click the Analyze button to find students who upgraded
                      </p>
                    </motion.div>
                  )}
                  {/* Add bottom padding for fixed pagination bar */}
                  {detailedData.length > 0 && <div className="h-32" />}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Pagination Bar at bottom of viewport */}
      {showContent && totalRecords > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-1 ${
          isDarkMode 
            ? 'bg-linear-to-t from-slate-950 via-slate-950/95 to-transparent' 
            : 'bg-linear-to-t from-white via-white/95 to-transparent'
        }`}>
          <div className={`max-w-7xl mx-auto rounded-2xl overflow-hidden shadow-2xl border ${
            isDarkMode 
              ? 'bg-slate-900/95 border-white/10 backdrop-blur-xl' 
              : 'bg-white/95 border-gray-200 backdrop-blur-xl'
          }`}>
            {/* Progress bar */}
            <div className={`h-1 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
              <div 
                className="h-full bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${Math.min(((pageIndex + 1) / Math.max(Math.ceil(totalRecords / pageSize), 1)) * 100, 100)}%` }}
              />
            </div>
            
            <div className="px-6 py-3 flex items-center justify-between gap-4">
              {/* Left: Page Info */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm ${
                  isDarkMode 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                  {pageIndex + 1}
                </div>
                <div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Page <span className="text-blue-500">{pageIndex + 1}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-purple-500">{Math.ceil(totalRecords / pageSize)}</span>
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
                    {(pageIndex * pageSize) + 1}-{Math.min((pageIndex + 1) * pageSize, totalRecords)} of {totalRecords.toLocaleString()} students
                  </div>
                </div>
              </div>
              
              {/* Right: Navigation Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(pageIndex - 1)}
                  disabled={pageIndex <= 0 || isLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${
                    isDarkMode 
                      ? 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/10' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  ← Previous
                </button>
                
                {pageIndex + 1 < Math.ceil(totalRecords / pageSize) && (
                  <button
                    onClick={() => onPageChange(pageIndex + 1)}
                    disabled={isLoading}
                    className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 transition-all shadow-lg"
                  >
                    {isLoading ? '...' : 'Next Page →'}
                  </button>
                )}
                
                <button
                  onClick={() => onPageChange(pageIndex + 1)}
                  disabled={pageIndex + 1 >= Math.ceil(totalRecords / pageSize) || isLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30 ${
                    isDarkMode 
                      ? 'bg-white/5 text-white/80 hover:bg-white/10 border border-white/10' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
