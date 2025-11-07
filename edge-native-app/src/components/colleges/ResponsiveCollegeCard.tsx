'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, GraduationCap, School, Heart, Eye, Bell, BellOff } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import userPreferences from '@/services/userPreferences';
import { College } from '@/types';

interface ResponsiveCollegeCardProps {
  college: College;
  index: number;
  courses?: any[];
  onOpenModal?: (college: College) => void;
}

const ResponsiveCollegeCard: React.FC<ResponsiveCollegeCardProps> = ({
  college,
  index,
  courses = [],
  onOpenModal
}) => {
  const { isDarkMode } = useTheme();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if college is in favorites or watchlist
  useEffect(() => {
    const preferences = userPreferences.getPreferences();
    setIsFavorite(userPreferences.isFavorite('college', college.id));
    setIsWatching(preferences.watchlistCutoffs.some(item => item.itemId === college.id));
  }, [college.id]);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    
    try {
      if (isFavorite) {
        userPreferences.removeFavorite('college', college.id);
        setIsFavorite(false);
      } else {
        userPreferences.addFavorite('college', college.id, college.name);
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    
    try {
      if (isWatching) {
        userPreferences.removeFromWatchlist(college.id);
        setIsWatching(false);
      } else {
        userPreferences.addToWatchlist({
          type: 'college',
          itemId: college.id,
          name: college.name,
          category: college.type || 'MEDICAL',
          state: college.state,
          alertEnabled: true
        });
        setIsWatching(true);
      }
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getManagementBadgeColor = (management: string) => {
    switch (management?.toUpperCase()) {
      case 'GOVERNMENT':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'PRIVATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'DEEMED':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'TRUST':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
      case 'AUTONOMOUS':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'SOCIETY':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
      case 'FOUNDATION':
        return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300';
      case 'COOPERATIVE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getCollegeTypeColor = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'MEDICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'DENTAL':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'DNB':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'AYUSH':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className={`backdrop-blur-md p-6 rounded-2xl border-2 transition-all duration-300 hover:shadow-xl cursor-pointer ${
        isDarkMode 
          ? 'bg-white/10 border-white/20 hover:bg-white/15 shadow-white/10' 
          : 'bg-white/80 border-gray-200/60 hover:bg-white shadow-gray-200/30'
      }`}
      onClick={() => onOpenModal?.(college)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
          }`}>
            <Building2 className={`w-6 h-6 ${
              isDarkMode ? 'text-green-400' : 'text-green-600'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold mb-1 line-clamp-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {college.name}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className={`w-4 h-4 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <span className={`text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {college.address && college.address !== 'Unknown, India' && college.address !== `${college.state}, India` ? 
                  `${college.address}${college.state ? `, ${college.state}` : ''}` : 
                  college.state || 'Unknown'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges and Action Icons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getManagementBadgeColor(college.management_type || '')}`}>
          {college.management_type || 'N/A'}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCollegeTypeColor(college.type || college.college_type || '')}`}>
          {college.type || college.college_type || 'N/A'}
        </span>
        {college.status && (
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            college.status === 'ACTIVE' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {college.status}
          </span>
        )}
        
        {/* Action Icons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleToggleFavorite}
            disabled={isLoading}
            className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
              isFavorite
                ? isDarkMode
                  ? 'text-red-400 bg-red-500/20'
                  : 'text-red-500 bg-red-100'
                : isDarkMode
                  ? 'text-white/40 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-gray-400 hover:text-red-500 hover:bg-red-100'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          
          <button
            onClick={handleToggleWatchlist}
            disabled={isLoading}
            className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
              isWatching
                ? isDarkMode
                  ? 'text-blue-400 bg-blue-500/20'
                  : 'text-blue-500 bg-blue-100'
                : isDarkMode
                  ? 'text-white/40 hover:text-blue-400 hover:bg-blue-500/10'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-100'
            }`}
            title={isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatching ? (
              <Bell className="w-4 h-4 fill-current" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Key Information */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className={`w-4 h-4 ${
              isDarkMode ? 'text-purple-400' : 'text-purple-600'
            }`} />
            <span className={`text-sm ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>Courses</span>
          </div>
          <span className={`text-sm font-medium ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {college.course_count || courses.length || 'N/A'}
          </span>
        </div>

        {college.university && college.university !== 'N/A' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <School className={`w-4 h-4 ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`} />
              <span className={`text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>University</span>
            </div>
            <span className={`text-sm font-medium truncate max-w-[150px] ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`} title={college.university}>
              {college.university}
            </span>
          </div>
        )}
      </div>

      {/* Main Action Button */}
      <button
        className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
          isDarkMode
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenModal?.(college);
        }}
      >
        View Details & Courses
      </button>
    </motion.div>
  );
};

export default ResponsiveCollegeCard;