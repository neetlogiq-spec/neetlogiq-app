'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Clock, 
  TrendingUp, 
  Filter, 
  ChevronDown, 
  Sparkles, 
  History,
  Settings,
  Zap,
  Brain,
  Target,
  ArrowRight
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataCache } from '@/hooks/useDataCache';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'trending' | 'ai' | 'recent';
  category?: string;
  count?: number;
  metadata?: Record<string, any>;
}

interface SearchFilter {
  category?: string;
  state?: string;
  collegeType?: string;
  courseType?: string;
  year?: string;
  minRank?: number;
  maxRank?: number;
  managementType?: string;
}

interface AdvancedSearchBarProps {
  placeholder?: string;
  onSearch: (query: string, filters: SearchFilter) => void;
  onFiltersChange?: (filters: SearchFilter) => void;
  className?: string;
  enableAI?: boolean;
  enableHistory?: boolean;
  enableTrending?: boolean;
  maxSuggestions?: number;
  debounceMs?: number;
}

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({
  placeholder = "Search colleges, courses, cutoffs...",
  onSearch,
  onFiltersChange,
  className = '',
  enableAI = true,
  enableHistory = true,
  enableTrending = true,
  maxSuggestions = 8,
  debounceMs = 300
}) => {
  const { isDarkMode } = useTheme();
  const { getCachedData } = useDataCache();
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<SearchFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchMode, setSearchMode] = useState<'basic' | 'advanced' | 'ai'>('basic');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  
  // Load search history and trending searches
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load search history
        if (enableHistory) {
          const history = await getCachedData(
            'search_history',
            async () => {
              const stored = localStorage.getItem('search_history');
              return stored ? JSON.parse(stored) : [];
            },
            { ttl: 24 * 60 * 60 * 1000 } // 24 hours
          );
          setSearchHistory(history);
        }
        
        // Load trending searches
        if (enableTrending) {
          const trending = await getCachedData(
            'trending_searches',
            async () => {
              const response = await fetch('/api/search/trending');
              if (!response.ok) throw new Error('Failed to fetch trending searches');
              const data = await response.json();
              return data.searches || [];
            },
            { ttl: 60 * 60 * 1000 } // 1 hour
          );
          setTrendingSearches(trending);
        }
      } catch (error) {
        console.error('Failed to load search data:', error);
      }
    };
    
    loadData();
  }, [enableHistory, enableTrending, getCachedData]);
  
  // Save search history
  const saveSearchHistory = useCallback((searchQuery: string) => {
    if (!enableHistory || !searchQuery.trim()) return;
    
    try {
      const updatedHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 20);
      setSearchHistory(updatedHistory);
      localStorage.setItem('search_history', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, [enableHistory, searchHistory]);
  
  // Generate AI suggestions
  const generateAISuggestions = useCallback(async (searchQuery: string): Promise<SearchSuggestion[]> => {
    if (!enableAI || searchQuery.length < 2) return [];
    
    try {
      const response = await fetch('/api/search/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 5 })
      });
      
      if (!response.ok) throw new Error('Failed to get AI suggestions');
      const data = await response.json();
      
      return data.suggestions.map((suggestion: any, index: number) => ({
        id: `ai_${index}`,
        text: suggestion.text,
        type: 'ai' as const,
        category: suggestion.category,
        metadata: suggestion.metadata
      }));
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
      return [];
    }
  }, [enableAI]);
  
  // Get suggestions based on query
  const getSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    
    const allSuggestions: SearchSuggestion[] = [];
    
    // Add history suggestions
    if (enableHistory) {
      const historySuggestions = searchHistory
        .filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 3)
        .map((text, index) => ({
          id: `history_${index}`,
          text,
          type: 'history' as const
        }));
      allSuggestions.push(...historySuggestions);
    }
    
    // Add trending suggestions
    if (enableTrending) {
      const trendingSuggestions = trendingSearches
        .filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 3)
        .map((text, index) => ({
          id: `trending_${index}`,
          text,
          type: 'trending' as const
        }));
      allSuggestions.push(...trendingSuggestions);
    }
    
    // Add AI suggestions
    if (enableAI) {
      const aiSuggestions = await generateAISuggestions(searchQuery);
      allSuggestions.push(...aiSuggestions);
    }
    
    setSuggestions(allSuggestions.slice(0, maxSuggestions));
  }, [searchQuery, searchHistory, trendingSearches, enableHistory, enableTrending, enableAI, generateAISuggestions, maxSuggestions]);
  
  // Debounced search
  const debouncedSearch = useCallback((searchQuery: string, searchFilters: SearchFilter) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        onSearch(searchQuery, searchFilters);
        saveSearchHistory(searchQuery);
        
        // Simulate search completion
        setTimeout(() => {
          setIsSearching(false);
        }, 500);
      }
    }, debounceMs);
  }, [onSearch, saveSearchHistory, debounceMs]);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Get suggestions
    getSuggestions(value);
    setShowSuggestions(true);
    
    // Debounced search
    debouncedSearch(value, filters);
  };
  
  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    debouncedSearch(suggestion.text, filters);
    inputRef.current?.focus();
  };
  
  // Handle search submit
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (query.trim()) {
      setShowSuggestions(false);
      debouncedSearch(query, filters);
    }
  };
  
  // Handle filter change
  const handleFilterChange = (newFilters: SearchFilter) => {
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
    debouncedSearch(query, newFilters);
  };
  
  // Clear search
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Get suggestion icon
  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'history':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'trending':
        return <TrendingUp className="w-4 h-4 text-orange-400" />;
      case 'ai':
        return <Brain className="w-4 h-4 text-purple-400" />;
      default:
        return <Search className="w-4 h-4 text-gray-400" />;
    }
  };
  
  return (
    <div className={`relative w-full ${className}`}>
      {/* Search Mode Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex rounded-lg p-1 ${
          isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          <button
            onClick={() => setSearchMode('basic')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === 'basic'
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : isDarkMode 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <Search className="w-4 h-4 mr-1" />
            Basic
          </button>
          
          <button
            onClick={() => setSearchMode('advanced')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              searchMode === 'advanced'
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : isDarkMode 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <Filter className="w-4 h-4 mr-1" />
            Advanced
          </button>
          
          {enableAI && (
            <button
              onClick={() => setSearchMode('ai')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                searchMode === 'ai'
                  ? isDarkMode 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-purple-500 text-white'
                  : isDarkMode 
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI
            </button>
          )}
        </div>
        
        {/* Settings */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode 
              ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
      
      {/* Search Input */}
      <div className="relative">
        <div className={`relative flex items-center ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        } border rounded-lg transition-all duration-200 ${
          showSuggestions ? 'rounded-b-none' : 'rounded-lg'
        }`}>
          {/* Search Icon */}
          <div className="absolute left-3 flex items-center pointer-events-none">
            {isSearching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            ) : (
              <>
                {searchMode === 'ai' ? (
                  <Brain className="w-5 h-5 text-purple-500" />
                ) : (
                  <Search className="w-5 h-5 text-gray-400" />
                )}
              </>
            )}
          </div>
          
          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder={placeholder}
            className={`w-full pl-12 pr-12 py-3 bg-transparent text-sm ${
              isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
            } focus:outline-none`}
          />
          
          {/* Clear Button */}
          {query && (
            <button
              onClick={handleClear}
              className={`absolute right-3 p-1 rounded transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`absolute top-full left-0 right-0 z-50 rounded-b-lg shadow-lg border overflow-hidden ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="max-h-64 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      index === 0 ? '' : 'border-t border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    {getSuggestionIcon(suggestion.type)}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {suggestion.text}
                      </div>
                      {suggestion.category && (
                        <div className={`text-xs ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {suggestion.category}
                        </div>
                      )}
                    </div>
                    {suggestion.type === 'ai' && (
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                      }`}>
                        AI
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Advanced Filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`mt-4 p-4 rounded-lg border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
          >
            <h4 className={`text-sm font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Advanced Filters
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Category Filter */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Category
                </label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange({ ...filters, category: e.target.value })}
                  className={`w-full px-3 py-2 rounded-md text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">All Categories</option>
                  <option value="colleges">Colleges</option>
                  <option value="courses">Courses</option>
                  <option value="cutoffs">Cutoffs</option>
                </select>
              </div>
              
              {/* State Filter */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  State
                </label>
                <select
                  value={filters.state || ''}
                  onChange={(e) => handleFilterChange({ ...filters, state: e.target.value })}
                  className={`w-full px-3 py-2 rounded-md text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">All States</option>
                  <option value="delhi">Delhi</option>
                  <option value="maharashtra">Maharashtra</option>
                  <option value="karnataka">Karnataka</option>
                  <option value="tamil-nadu">Tamil Nadu</option>
                </select>
              </div>
              
              {/* College Type Filter */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  College Type
                </label>
                <select
                  value={filters.collegeType || ''}
                  onChange={(e) => handleFilterChange({ ...filters, collegeType: e.target.value })}
                  className={`w-full px-3 py-2 rounded-md text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">All Types</option>
                  <option value="government">Government</option>
                  <option value="private">Private</option>
                  <option value="deemed">Deemed</option>
                </select>
              </div>
              
              {/* Year Filter */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Year
                </label>
                <select
                  value={filters.year || ''}
                  onChange={(e) => handleFilterChange({ ...filters, year: e.target.value })}
                  className={`w-full px-3 py-2 rounded-md text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode 
                      ? 'bg-gray-700 text-white border-gray-600' 
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">All Years</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
              </div>
              
              {/* Rank Range */}
              <div>
                <label className={`block text-xs font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Rank Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minRank || ''}
                    onChange={(e) => handleFilterChange({ ...filters, minRank: parseInt(e.target.value) || undefined })}
                    className={`w-full px-3 py-2 rounded-md text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDarkMode 
                        ? 'bg-gray-700 text-white border-gray-600' 
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxRank || ''}
                    onChange={(e) => handleFilterChange({ ...filters, maxRank: parseInt(e.target.value) || undefined })}
                    className={`w-full px-3 py-2 rounded-md text-sm border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDarkMode 
                        ? 'bg-gray-700 text-white border-gray-600' 
                        : 'bg-gray-100 text-gray-900 border-gray-300'
                    }`}
                  />
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setFilters({});
                  onFiltersChange?.({});
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
              >
                Clear Filters
              </button>
              
              <button
                onClick={() => setShowAdvanced(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Search Mode Indicator */}
      {searchMode === 'ai' && (
        <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg ${
          isDarkMode ? 'bg-purple-900/20 border-purple-800/30' : 'bg-purple-50 border-purple-200'
        }`}>
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className={`text-xs font-medium ${
            isDarkMode ? 'text-purple-400' : 'text-purple-700'
          }`}>
            AI-powered search is active
          </span>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchBar;
