'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, Users, Building2, ChevronRight, Eye, GraduationCap, Heart, Bell, BellOff } from 'lucide-react';
import { College } from '@/types';
import userPreferences from '@/services/userPreferences';

interface CollegeListViewProps {
  colleges: College[];
  onOpenModal: (college: College) => void;
  isDarkMode?: boolean;
  isLoading?: boolean;
}

const CollegeListView: React.FC<CollegeListViewProps> = ({
  colleges,
  onOpenModal,
  isDarkMode = false,
  isLoading = false
}) => {
  const [favoriteStates, setFavoriteStates] = useState<Record<string, boolean>>({});
  const [watchlistStates, setWatchlistStates] = useState<Record<string, boolean>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Check favorite and watchlist states for all colleges
  useEffect(() => {
    const preferences = userPreferences.getPreferences();
    const favoriteStates: Record<string, boolean> = {};
    const watchlistStates: Record<string, boolean> = {};

    colleges.forEach(college => {
      favoriteStates[college.id] = userPreferences.isFavorite('college', college.id);
      watchlistStates[college.id] = preferences.watchlistCutoffs.some(item => item.itemId === college.id);
    });

    setFavoriteStates(favoriteStates);
    setWatchlistStates(watchlistStates);
  }, [colleges]);

  const handleToggleFavorite = async (collegeId: string, collegeName: string) => {
    setLoadingStates(prev => ({ ...prev, [collegeId]: true }));
    
    try {
      const isCurrentlyFavorite = favoriteStates[collegeId];
      if (isCurrentlyFavorite) {
        userPreferences.removeFavorite('college', collegeId);
        setFavoriteStates(prev => ({ ...prev, [collegeId]: false }));
      } else {
        userPreferences.addFavorite('college', collegeId, collegeName);
        setFavoriteStates(prev => ({ ...prev, [collegeId]: true }));
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [collegeId]: false }));
    }
  };

  const handleToggleWatchlist = async (college: College) => {
    setLoadingStates(prev => ({ ...prev, [college.id]: true }));
    
    try {
      const isCurrentlyWatching = watchlistStates[college.id];
      if (isCurrentlyWatching) {
        userPreferences.removeFromWatchlist(college.id);
        setWatchlistStates(prev => ({ ...prev, [college.id]: false }));
      } else {
        userPreferences.addToWatchlist({
          type: 'college',
          itemId: college.id,
          name: college.name,
          category: college.type || 'MEDICAL',
          state: college.state,
          alertEnabled: true
        });
        setWatchlistStates(prev => ({ ...prev, [college.id]: true }));
      }
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [college.id]: false }));
    }
  };
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className={`p-4 rounded-xl border animate-pulse ${
              isDarkMode 
                ? 'bg-white/5 border-white/10' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className={`h-5 rounded mb-2 ${
                  isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                }`}></div>
                <div className={`h-4 rounded mb-1 w-3/4 ${
                  isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                }`}></div>
                <div className={`h-3 rounded w-1/2 ${
                  isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                }`}></div>
              </div>
              <div className={`w-8 h-8 rounded ${
                isDarkMode ? 'bg-white/20' : 'bg-gray-200'
              }`}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (colleges.length === 0) {
    return (
      <div className={`text-center py-12 rounded-xl border ${
        isDarkMode 
          ? 'bg-white/5 border-white/10 text-white/70' 
          : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No colleges found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {colleges.map((college, index) => (
        <motion.div
          key={`college-list-${college.id}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`group cursor-pointer p-4 rounded-xl border transition-all duration-200 hover:shadow-lg ${
            isDarkMode
              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md'
          }`}
          onClick={() => onOpenModal(college)}
        >
          <div className="flex items-center justify-between">
            {/* College Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <h3 className={`font-semibold text-lg truncate pr-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                } group-hover:text-blue-600 transition-colors`}>
                  {college.name}
                </h3>
                
                {/* Rating */}
                {college.rating && (
                  <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-green-500 text-green-500" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      {college.rating}
                    </span>
                  </div>
                )}
              </div>

              {/* Location & Type */}
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  <MapPin className={`w-4 h-4 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`} />
                  <span className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                    {college.city}, {college.state}
                  </span>
                </div>
                
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  college.management_type === 'GOVERNMENT'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : college.management_type === 'PRIVATE'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                }`}>
                  {college.management_type}
                </span>
                
                {/* College Type (Stream) */}
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  college.type === 'MEDICAL'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : college.type === 'DENTAL'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                    : college.type === 'DNB'
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {college.type || 'MEDICAL'}
                </span>

                {/* Action Icons */}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(college.id, college.name);
                    }}
                    disabled={loadingStates[college.id]}
                    className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 ${
                      favoriteStates[college.id]
                        ? isDarkMode
                          ? 'text-red-400 bg-red-500/20'
                          : 'text-red-500 bg-red-100'
                        : isDarkMode
                          ? 'text-white/40 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-100'
                    }`}
                    title={favoriteStates[college.id] ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${favoriteStates[college.id] ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleWatchlist(college);
                    }}
                    disabled={loadingStates[college.id]}
                    className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 ${
                      watchlistStates[college.id]
                        ? isDarkMode
                          ? 'text-blue-400 bg-blue-500/20'
                          : 'text-blue-500 bg-blue-100'
                        : isDarkMode
                          ? 'text-white/40 hover:text-blue-400 hover:bg-blue-500/10'
                          : 'text-gray-400 hover:text-blue-500 hover:bg-blue-100'
                    }`}
                    title={watchlistStates[college.id] ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    {watchlistStates[college.id] ? (
                      <Bell className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Additional Info */}
              <div className="flex flex-wrap items-center gap-4">
                {college.fees && (
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    ₹{college.fees.toLocaleString()}/year
                  </span>
                )}
              </div>
            </div>

            {/* Course Count & Action Button */}
            <div className="flex items-center gap-3">
              {/* Course Count - Only show if there are courses */}
              {college.course_count && college.course_count > 0 && (
                <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${
                  isDarkMode
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-purple-50 text-purple-600'
                }`}>
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {college.course_count} courses
                  </span>
                </div>
              )}
              
              {/* View Button */}
              <motion.div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-white/10 text-white/80 group-hover:bg-white/20'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">View</span>
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default CollegeListView;