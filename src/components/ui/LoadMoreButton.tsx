'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface LoadMoreButtonProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  className?: string;
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  onLoadMore,
  hasMore,
  isLoading,
  className = ''
}) => {
  const { isDarkMode } = useTheme();

  if (!hasMore) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className={`text-sm ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          You've reached the end of the list
        </p>
      </div>
    );
  }

  return (
    <div className={`flex justify-center py-8 ${className}`}>
      <motion.button
        onClick={onLoadMore}
        disabled={isLoading}
        className={`
          group relative px-8 py-4 rounded-xl font-semibold text-sm
          transition-all duration-300 ease-in-out
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isDarkMode 
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl' 
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl'
          }
          hover:scale-105 active:scale-95
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="flex items-center gap-3">
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading more colleges...</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform duration-300" />
              <span>Load More Colleges</span>
            </>
          )}
        </div>
        
        {/* Animated background */}
        <div className={`
          absolute inset-0 rounded-xl opacity-0 group-hover:opacity-20
          transition-opacity duration-300
          ${isDarkMode ? 'bg-white' : 'bg-white'}
        `} />
      </motion.button>
    </div>
  );
};

export default LoadMoreButton;

