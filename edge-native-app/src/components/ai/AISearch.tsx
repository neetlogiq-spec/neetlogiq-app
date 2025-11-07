'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, TrendingUp, Lightbulb, ArrowRight } from 'lucide-react';
import { autoRAGService } from '@/services/autorag';
import { SearchResult } from '@/types';

interface AISearchProps {
  onSearchResult: (result: SearchResult) => void;
  className?: string;
}

const AISearch: React.FC<AISearchProps> = ({ onSearchResult, className = '' }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  // Load AI insights on component mount
  useEffect(() => {
    loadAIInsights();
  }, []);

  const loadAIInsights = async () => {
    try {
      const insights = [
        '🔍 Try searching for "AIIMS Delhi MBBS" for specific college details',
        '📊 Ask about "NEET cutoffs 2024" to see latest admission trends',
        '🏥 Search "Government medical colleges" to find public institutions',
        '💡 Use "BDS courses in Mumbai" for location-specific results',
        '📈 Ask "Medical colleges with low cutoffs" for easier admission options'
      ];
      setAiInsights(insights);
    } catch (error) {
      console.error('Error loading AI insights:', error);
    }
  };

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const result = await autoRAGService.search({
        query: searchQuery,
        filters: {}
      });

      onSearchResult(result);
    } catch (error) {
      console.error('AI search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = async (value: string) => {
    setQuery(value);
    
    if (value.trim().length > 2) {
      try {
        const suggestions = await autoRAGService.getSuggestions(value);
        setSuggestions(suggestions);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error getting suggestions:', error);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const popularSearches = [
    'AIIMS Delhi MBBS cutoffs',
    'Government medical colleges',
    'NEET cutoffs 2024',
    'BDS courses in Mumbai',
    'Medical colleges in Bangalore',
    'MD courses in Chennai'
  ];

  return (
    <div className={`relative ${className}`}>
      {/* AI Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          ) : (
            <Sparkles className="h-5 w-5 text-blue-600" />
          )}
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Ask AI about medical colleges, courses, cutoffs..."
          className="w-full pl-12 pr-4 py-4 border-2 border-blue-200 dark:border-blue-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-lg"
        />
        
        <button
          onClick={() => handleSearch()}
          disabled={!query.trim() || isLoading}
          className="absolute inset-y-0 right-0 pr-4 flex items-center bg-blue-600 text-white px-6 py-2 rounded-r-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* AI Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
              AI Suggestions
            </div>
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-3 text-left text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-3" />
                <span className="text-sm">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* AI Insights */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
          <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
          AI Insights
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {aiInsights.map((insight, index) => (
            <div
              key={index}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200"
            >
              {insight}
            </div>
          ))}
        </div>
      </div>

      {/* Popular Searches */}
      <div className="mt-6">
        <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <TrendingUp className="h-4 w-4 mr-2 text-purple-500" />
          Popular Searches
        </div>
        <div className="flex flex-wrap gap-2">
          {popularSearches.map((search, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(search)}
              className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {search}
              <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          ))}
        </div>
      </div>

      {/* AI Features Highlight */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              AI-Powered Search
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Our AI understands context and provides intelligent search results. 
              Ask natural questions and get relevant answers about medical education.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISearch;
