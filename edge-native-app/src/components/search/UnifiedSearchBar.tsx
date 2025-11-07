'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { NeetLogIQSearch, createSearchEngine } from '@/lib/search/ufuzzy-search';

interface UnifiedSearchBarProps {
  data: any[];
  onResults: (results: any[]) => void;
  placeholder?: string;
  className?: string;
}

export function UnifiedSearchBar({ 
  data, 
  onResults, 
  placeholder = "Search colleges, courses, or cutoffs...",
  className = ""
}: UnifiedSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Create stable search engine instance using JSON.stringify for comparison
  const searchEngine = useMemo(() => {
    return createSearchEngine(data);
  }, [JSON.stringify(data)]);

  // Stable callback to prevent infinite loop
  const handleResults = useCallback((results: any[]) => {
    onResults(results);
  }, [onResults]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      // Don't call onResults to prevent infinite loop
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    
    const timeoutId = setTimeout(() => {
      try {
        // Perform search
        const results = searchEngine.search(query, 50);
        handleResults(results);
        
        // Get suggestions
        const searchSuggestions = searchEngine.getSuggestions(query, 5);
        setSuggestions(searchSuggestions);
        setShowSuggestions(searchSuggestions.length > 0);
        
      } catch (error) {
        console.error('Search error:', error);
        handleResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, searchEngine, handleResults]);

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

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg 
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     text-gray-900 placeholder-gray-500
                     transition-all duration-200"
        />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center
                       text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 
                        rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Search Results Count */}
      {query && (
        <div className="mt-2 text-sm text-gray-500">
          {isSearching ? (
            <span>Searching...</span>
          ) : (
            <span>Found results for "{query}"</span>
          )}
        </div>
      )}
    </div>
  );
}

// Hook for using search in components
export function useSearch(data: any[]) {
  const [results, setResults] = useState(data.slice(0, 20));
  const [query, setQuery] = useState('');

  const searchEngine = useMemo(() => {
    return createSearchEngine(data);
  }, [data]);

  const search = (searchQuery: string, filters?: any) => {
    setQuery(searchQuery);
    
    if (!searchQuery.trim()) {
      setResults(data.slice(0, 20));
      return;
    }

    try {
      const searchResults = filters 
        ? searchEngine.searchWithFilters(searchQuery, filters, 50)
        : searchEngine.search(searchQuery, 50);
      
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
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