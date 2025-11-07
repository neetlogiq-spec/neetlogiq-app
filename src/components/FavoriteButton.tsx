'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import userPreferences from '@/services/userPreferences';

interface FavoriteButtonProps {
  type: 'college' | 'course';
  itemId: string;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function FavoriteButton({ type, itemId, name, className = '', size = 'md' }: FavoriteButtonProps) {
  const { isDarkMode } = useTheme();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsFavorite(userPreferences.isFavorite(type, itemId));
  }, [type, itemId]);

  const handleToggleFavorite = async () => {
    setIsLoading(true);
    
    try {
      if (isFavorite) {
        userPreferences.removeFavorite(type, itemId);
        setIsFavorite(false);
      } else {
        userPreferences.addFavorite(type, itemId, name);
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
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
      onClick={handleToggleFavorite}
      disabled={isLoading}
      className={`
        ${sizeClasses[size]} 
        rounded-full 
        transition-all 
        duration-200 
        flex 
        items-center 
        justify-center
        ${isFavorite 
          ? 'bg-red-500 hover:bg-red-600 text-white' 
          : isDarkMode 
            ? 'bg-white/10 hover:bg-white/20 text-white/60 hover:text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
        ${className}
      `}
      title={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
    >
      <Heart 
        className={`${iconSizes[size]} ${isFavorite ? 'fill-current' : ''}`} 
      />
    </button>
  );
}
