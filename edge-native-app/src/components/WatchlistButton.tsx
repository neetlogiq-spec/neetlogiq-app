'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import userPreferences from '@/services/userPreferences';

interface WatchlistButtonProps {
  type: 'college' | 'course' | 'cutoff';
  itemId: string;
  name: string;
  category?: string;
  state?: string;
  year?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function WatchlistButton({ 
  type, 
  itemId, 
  name, 
  category, 
  state, 
  year, 
  className = '', 
  size = 'md' 
}: WatchlistButtonProps) {
  const { isDarkMode } = useTheme();
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const preferences = userPreferences.getPreferences();
    const watchlistItem = preferences.watchlistCutoffs.find(item => item.itemId === itemId);
    setIsInWatchlist(!!watchlistItem);
  }, [itemId]);

  const handleToggleWatchlist = async () => {
    setIsLoading(true);
    
    try {
      if (isInWatchlist) {
        const preferences = userPreferences.getPreferences();
        const watchlistItem = preferences.watchlistCutoffs.find(item => item.itemId === itemId);
        if (watchlistItem) {
          userPreferences.removeFromWatchlist(watchlistItem.id);
        }
        setIsInWatchlist(false);
      } else {
        userPreferences.addToWatchlist({
          type,
          itemId,
          name,
          category,
          state,
          year,
          alertEnabled: true
        });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={handleToggleWatchlist}
      disabled={isLoading}
      className={`
        ${sizeClasses[size]} 
        rounded-full 
        transition-all 
        duration-200 
        flex 
        items-center 
        justify-center
        ${isInWatchlist 
          ? 'bg-blue-500 hover:bg-blue-600 text-white' 
          : isDarkMode 
            ? 'bg-white/10 hover:bg-white/20 text-white/60 hover:text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        ${className}
      `}
      title={isInWatchlist ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
    >
      {isInWatchlist ? (
        <Eye className={`${iconSizes[size]} fill-current`} />
      ) : (
        <EyeOff className={iconSizes[size]} />
      )}
    </button>
  );
}
