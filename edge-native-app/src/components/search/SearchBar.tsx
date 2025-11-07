'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  suggestions?: string[];
  showSuggestions?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search colleges, courses, cutoffs...",
  className = "",
  onSearch,
  suggestions = [],
  showSuggestions = true
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Filter suggestions based on query
  useEffect(() => {
    if (query && suggestions.length > 0) {
      const filtered = suggestions
        .filter(suggestion => 
          suggestion.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [query, suggestions]);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    
    try {
      if (onSearch) {
        await onSearch(searchQuery);
      } else {
        // Default behavior - navigate to search page
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      }
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const clearQuery = () => {
    setQuery('');
    setFilteredSuggestions([]);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow clicking on suggestions
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        
        {query && (
          <button
            onClick={clearQuery}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            >
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-3" />
                <span className="text-sm">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Popular Searches */}
      {isOpen && showSuggestions && query === '' && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            Popular Searches
          </div>
          {suggestions.slice(0, 5).map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            >
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-3" />
                <span className="text-sm">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
