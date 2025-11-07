'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Loader2, Zap, BookOpen, TrendingUp, Brain, Settings } from 'lucide-react';
import { HybridSearchEngine, createHybridSearchEngine, SearchableItem } from '@/lib/search/hybrid-search-engine';

interface HybridSearchBarProps {
  data: SearchableItem[];
  onResults: (results: SearchableItem[]) => void;
  placeholder?: string;
  className?: string;
}

export function HybridSearchBar({ 
  data, 
  onResults, 
  placeholder = "Search with FlexSearch + uFuzzy... (Try 'AJIMS', 'AIIMS', 'GMC')",
  className = ""
}: HybridSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchOptions, setSearchOptions] = useState({
    useFuzzy: true,
    useRegex: true,
    useAbbreviations: true,
    usePhonetic: true,
    fuzzyThreshold: 0.6
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Create hybrid search engine instance
  const searchEngine = useMemo(() => {
    const engine = createHybridSearchEngine();
    engine.addItems(data);
    return engine;
  }, [data]);

  // Debounced search with hybrid features
  useEffect(() => {
    if (!query.trim()) {
      onResults(data.slice(0, 20));
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    
    const timeoutId = setTimeout(() => {
      try {
        // Perform hybrid search
        const results = searchEngine.search(query, {
          type: 'all',
          limit: 50,
          useFuzzy: searchOptions.useFuzzy,
          useRegex: searchOptions.useRegex,
          useAbbreviations: searchOptions.useAbbreviations,
          usePhonetic: searchOptions.usePhonetic,
          fuzzyThreshold: searchOptions.fuzzyThreshold
        });
        
        onResults(results);
        
        // Get hybrid suggestions
        const searchSuggestions = searchEngine.getSuggestions(query, 8);
        setSuggestions(searchSuggestions);
        setShowSuggestions(searchSuggestions.length > 0);
        
      } catch (error) {
        console.error('Hybrid search error:', error);
        onResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200); // Fast debounce for better UX

    return () => clearTimeout(timeoutId);
  }, [query, searchEngine, searchOptions, data, onResults]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
  };

  const toggleSearchOption = (option: keyof typeof searchOptions) => {
    setSearchOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const updateFuzzyThreshold = (threshold: number) => {
    setSearchOptions(prev => ({
      ...prev,
      fuzzyThreshold: threshold
    }));
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="block w-full pl-10 pr-24 py-3 border border-gray-300 rounded-lg 
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     text-gray-900 placeholder-gray-500
                     transition-all duration-200"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
          {/* Search Options Toggle */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => toggleSearchOption('useFuzzy')}
              className={`p-1 rounded ${
                searchOptions.useFuzzy 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="uFuzzy fuzzy matching"
            >
              <Brain className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => toggleSearchOption('useAbbreviations')}
              className={`p-1 rounded ${
                searchOptions.useAbbreviations 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Abbreviation matching (AJIMS → A J Institute)"
            >
              <Zap className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => toggleSearchOption('useRegex')}
              className={`p-1 rounded ${
                searchOptions.useRegex 
                  ? 'bg-green-100 text-green-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="FlexSearch regex patterns"
            >
              <BookOpen className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => toggleSearchOption('usePhonetic')}
              className={`p-1 rounded ${
                searchOptions.usePhonetic 
                  ? 'bg-orange-100 text-orange-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Phonetic matching"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-1 rounded ${
                showAdvanced 
                  ? 'bg-gray-100 text-gray-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Advanced settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          
          {query && (
            <button
              onClick={clearSearch}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {showAdvanced && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg border">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fuzzy Threshold: {searchOptions.fuzzyThreshold}
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={searchOptions.fuzzyThreshold}
                onChange={(e) => updateFuzzyThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Strict (0.1)</span>
                <span>Loose (1.0)</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useFuzzy"
                  checked={searchOptions.useFuzzy}
                  onChange={() => toggleSearchOption('useFuzzy')}
                  className="rounded"
                />
                <label htmlFor="useFuzzy" className="text-sm text-gray-700">
                  uFuzzy Matching
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useAbbreviations"
                  checked={searchOptions.useAbbreviations}
                  onChange={() => toggleSearchOption('useAbbreviations')}
                  className="rounded"
                />
                <label htmlFor="useAbbreviations" className="text-sm text-gray-700">
                  Abbreviation Matching
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useRegex"
                  checked={searchOptions.useRegex}
                  onChange={() => toggleSearchOption('useRegex')}
                  className="rounded"
                />
                <label htmlFor="useRegex" className="text-sm text-gray-700">
                  Regex Patterns
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="usePhonetic"
                  checked={searchOptions.usePhonetic}
                  onChange={() => toggleSearchOption('usePhonetic')}
                  className="rounded"
                />
                <label htmlFor="usePhonetic" className="text-sm text-gray-700">
                  Phonetic Matching
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Options Indicator */}
      {query && (
        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
          <span>Active engines:</span>
          {searchOptions.useFuzzy && (
            <span className="flex items-center space-x-1">
              <Brain className="h-3 w-3" />
              <span>uFuzzy</span>
            </span>
          )}
          {searchOptions.useAbbreviations && (
            <span className="flex items-center space-x-1">
              <Zap className="h-3 w-3" />
              <span>Abbreviations</span>
            </span>
          )}
          {searchOptions.useRegex && (
            <span className="flex items-center space-x-1">
              <BookOpen className="h-3 w-3" />
              <span>FlexSearch</span>
            </span>
          )}
          {searchOptions.usePhonetic && (
            <span className="flex items-center space-x-1">
              <TrendingUp className="h-3 w-3" />
              <span>Phonetic</span>
            </span>
          )}
        </div>
      )}

      {/* Hybrid Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 
                        rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
            Hybrid Search Suggestions (FlexSearch + uFuzzy)
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 
                         focus:bg-gray-50 focus:outline-none
                         border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                <span className="text-gray-900 truncate">{suggestion}</span>
                {suggestion.length <= 10 && (
                  <span className="ml-auto text-xs text-purple-500 bg-purple-50 px-2 py-1 rounded">
                    Fuzzy
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search Examples */}
      {!query && (
        <div className="mt-3 text-xs text-gray-500">
          <div className="font-medium mb-1">Try these hybrid searches:</div>
          <div className="flex flex-wrap gap-2">
            <span className="bg-gray-100 px-2 py-1 rounded">AJIMS</span>
            <span className="bg-gray-100 px-2 py-1 rounded">AIIMS</span>
            <span className="bg-gray-100 px-2 py-1 rounded">GMC</span>
            <span className="bg-gray-100 px-2 py-1 rounded">CMC</span>
            <span className="bg-gray-100 px-2 py-1 rounded">JIPMER</span>
            <span className="bg-gray-100 px-2 py-1 rounded">typo test</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for using hybrid search in components
export function useHybridSearch(data: SearchableItem[]) {
  const [results, setResults] = useState(data.slice(0, 20));
  const [query, setQuery] = useState('');

  const searchEngine = useMemo(() => {
    const engine = createHybridSearchEngine();
    engine.addItems(data);
    return engine;
  }, [data]);

  const search = (
    searchQuery: string, 
    options: {
      type?: 'colleges' | 'courses' | 'cutoffs' | 'all';
      limit?: number;
      useFuzzy?: boolean;
      useRegex?: boolean;
      useAbbreviations?: boolean;
      usePhonetic?: boolean;
      fuzzyThreshold?: number;
    } = {},
    filters?: {
      state?: string[];
      management?: string[];
      course_type?: string[];
    }
  ) => {
    setQuery(searchQuery);
    
    if (!searchQuery.trim()) {
      setResults(data.slice(0, 20));
      return;
    }

    try {
      const searchResults = filters 
        ? searchEngine.searchWithFilters(searchQuery, filters, options)
        : searchEngine.search(searchQuery, options);
      
      setResults(searchResults);
    } catch (error) {
      console.error('Hybrid search error:', error);
      setResults([]);
    }
  };

  return {
    results,
    query,
    search,
    searchEngine
  };
}

