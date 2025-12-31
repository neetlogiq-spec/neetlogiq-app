'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, Clock } from 'lucide-react';

interface Suggestion {
  id?: string;
  label: string;
  value: string;
  secondary?: string;
  name?: string;
}

interface UnifiedSearchBarProps {
  data?: any[];
  collegesData?: any[]; // Alias for data
  onResults: (results: any[]) => void;
  placeholder?: string;
  className?: string;
  enableFullDatabaseSearch?: boolean;
  type?: 'colleges' | 'courses' | 'cutoffs';
  contentType?: 'colleges' | 'courses' | 'cutoffs'; // Added for backward compatibility
  showSuggestions?: boolean;
  showAIInsight?: boolean;
  debounceMs?: number;
}

export function UnifiedSearchBar({
  data = [],
  collegesData,
  onResults,
  placeholder = "Search colleges, courses, or cutoffs...",
  className = "",
  enableFullDatabaseSearch = true,
  type = 'colleges',
  contentType,
  showSuggestions: initialShowSuggestions = true,
  showAIInsight = false,
  debounceMs = 400
}: UnifiedSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use effective type from either type or contentType prop
  const searchType = contentType || type;
  // Use data or collegesData alias
  const searchData = data.length > 0 ? data : (collegesData || []);

  // Dynamic configuration based on type
  const config = {
    historyKey: `${searchType}SearchHistory`,
    autocompleteUrl: searchType === 'colleges' ? '/api/colleges/autocomplete' : 
                     searchType === 'courses' ? '/api/courses/autocomplete' :
                     '/api/colleges/autocomplete', // Fallback for cutoffs
    searchUrl: searchType === 'colleges' ? '/api/colleges/search' : 
               searchType === 'courses' ? '/api/courses' :
               '/api/cutoffs',
    resultCountLabel: searchType === 'colleges' ? '🔍 Searching 2,117+ colleges' : 
                      searchType === 'courses' ? '🔍 Searching all courses' :
                      '🔍 Searching all cutoffs'
  };

  // Load search history from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem(config.historyKey);
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        console.error('Failed to load search history:', e);
      }
    }
  }, [config.historyKey]);

  // Save to search history
  const saveToHistory = (searchTerm: string) => {
    const updated = [
      searchTerm,
      ...searchHistory.filter(h => h !== searchTerm)
    ].slice(0, 10); // Keep last 10 searches

    setSearchHistory(updated);
    localStorage.setItem(config.historyKey, JSON.stringify(updated));
  };

  // Fetch autocomplete suggestions from API
  const fetchAutocompleteSuggestions = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${config.autocompleteUrl}?q=${encodeURIComponent(searchQuery)}&limit=5`
      );

      if (!response.ok) {
        throw new Error('Autocomplete failed');
      }

      const result = await response.json();

      if (result.success && result.suggestions) {
        setSuggestions(result.suggestions);
        setShowSuggestions(result.suggestions.length > 0);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setSuggestions([]);
    }
  };

  // Search full database via API
  const searchFullDatabase = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // For courses, we use the main courses API which already supports query
      const url = `${config.searchUrl}${config.searchUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(searchQuery)}&limit=100`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const result = await response.json();

      if (result.success) {
        // Special handling for courses API response structure which is { success, data, pagination }
        const data = result.data || result.results || [];
        onResults(data);
        saveToHistory(searchQuery);
      } else {
        console.error('Search error:', result.error);
        onResults([]);
      }
    } catch (error) {
      console.error('Search API error:', error);
      onResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Client-side search (fallback)
  const searchClientSide = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      onResults([]);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    const results = searchData.filter(item => {
      const searchableText = [
        item.name,
        item.course_name, // Added for courses
        item.college, // Added for cutoffs
        item.city,
        item.state,
        item.management_type,
        item.type,
        item.stream // Added for courses
      ].join(' ').toLowerCase();

      return searchableText.includes(queryLower);
    });

    onResults(results);
  };

  // Debounced search
  useEffect(() => {
    const autocompleteTimer = setTimeout(() => {
      if (query.trim()) {
        fetchAutocompleteSuggestions(query);
      }
    }, 150);

    const searchTimer = setTimeout(() => {
      if (!query.trim()) {
        setSuggestions([]);
        setShowSuggestions(false);
        onResults([]);
        return;
      }

      if (enableFullDatabaseSearch) {
        searchFullDatabase(query);
      } else {
        searchClientSide(query);
      }
    }, debounceMs);

    return () => {
      clearTimeout(autocompleteTimer);
      clearTimeout(searchTimer);
    };
  }, [query, debounceMs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion: Suggestion | string) => {
    // Use label for display in search bar, but value for the actual search
    const displayTerm = typeof suggestion === 'string' ? suggestion : (suggestion.label || suggestion.name || suggestion.value);
    const searchTerm = typeof suggestion === 'string' ? suggestion : (suggestion.label || suggestion.name || suggestion.value);
    setQuery(displayTerm);
    setShowSuggestions(false);

    if (enableFullDatabaseSearch) {
      searchFullDatabase(searchTerm);
    } else {
      searchClientSide(searchTerm);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onResults([]);
  };

  const handleFocus = () => {
    if (!query && searchHistory.length > 0) {
      setShowSuggestions(true);
    } else if (query && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on suggestions
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-gray-400 dark:text-gray-500 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     bg-white dark:bg-gray-800
                     text-gray-900 dark:text-white
                     placeholder-gray-500 dark:placeholder-gray-400
                     transition-all duration-200"
        />

        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center
                       text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
                       transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Suggestions & History */}
      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                        rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {/* Search History (when no query) */}
          {!query && searchHistory.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400
                              border-b border-gray-100 dark:border-gray-700">
                Recent Searches
              </div>
              {searchHistory.slice(0, 5).map((historyItem, index) => (
                <button
                  key={`history-${index}`}
                  onClick={() => handleSuggestionClick(historyItem)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700
                             focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none
                             border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-white truncate">{historyItem}</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Autocomplete Suggestions (when typing) */}
          {query && suggestions.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400
                              border-b border-gray-100 dark:border-gray-700">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700
                             focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none
                             border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center">
                    <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 dark:text-white truncate font-medium">
                        {suggestion.label}
                      </div>
                      {suggestion.secondary && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {suggestion.secondary}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Search Results Count */}
      {query && !showSuggestions && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {isSearching ? (
            <span>Searching entire database...</span>
          ) : (
            <span>
              {enableFullDatabaseSearch
                ? config.resultCountLabel
                : `Searching loaded ${searchType}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Export for backward compatibility
export default UnifiedSearchBar;
