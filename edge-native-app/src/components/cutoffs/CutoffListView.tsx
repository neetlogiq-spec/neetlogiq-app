'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, GraduationCap, BarChart3, ChevronRight, Eye, Calendar, Users, Award } from 'lucide-react';

interface Cutoff {
  id: string;
  college: string;
  course: string;
  category: string;
  year: string;
  openingRank: number;
  closingRank: number;
  totalSeats: number;
  trend: 'up' | 'down' | 'stable';
  change: string;
  description: string;
  stream: string;
  state: string;
  management: string;
}

interface CutoffListViewProps {
  cutoffs: Cutoff[];
  onOpenModal: (cutoff: Cutoff) => void;
  isDarkMode?: boolean;
  isLoading?: boolean;
}

const CutoffListView: React.FC<CutoffListViewProps> = ({
  cutoffs,
  onOpenModal,
  isDarkMode = false,
  isLoading = false
}) => {
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

  if (cutoffs.length === 0) {
    return (
      <div className={`text-center py-12 rounded-xl border ${
        isDarkMode 
          ? 'bg-white/5 border-white/10 text-white/70' 
          : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No cutoffs found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search criteria</p>
      </div>
    );
  }


  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  return (
    <div className="space-y-3">
      {cutoffs.map((cutoff, index) => (
        <motion.div
          key={`cutoff-list-${cutoff.id}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`group cursor-pointer p-3 rounded-lg border transition-all duration-200 hover:shadow-lg ${
            isDarkMode
              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md'
          }`}
          onClick={() => onOpenModal(cutoff)}
        >
          <div className="flex items-center justify-between">
            {/* Cutoff Info */}
            <div className="flex-1 min-w-0">
              {/* Line 1: College Name - Left Aligned */}
              <h3 className={`font-semibold text-base mb-1 text-left ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              } group-hover:text-blue-600 transition-colors`}>
                {cutoff.college}
              </h3>

              {/* Line 2: Address and State */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <MapPin className={`w-3 h-3 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`} />
                  <span className={`text-xs ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                    {cutoff.state}
                  </span>
                </div>
                
                {/* Action Button */}
                <motion.div
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 ${
                    isDarkMode
                      ? 'bg-white/10 text-white/80 group-hover:bg-white/20'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Eye className="w-3 h-3" />
                  <span className="text-xs font-medium hidden sm:inline">View</span>
                  <ChevronRight className="w-3 h-3" />
                </motion.div>
              </div>

              {/* Line 3: Stream, Course, Management */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'
                }`}>
                  {cutoff.stream}
                </span>
                
                <div className="flex items-center gap-1">
                  <GraduationCap className={`w-3 h-3 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                    {cutoff.course}
                  </span>
                </div>

                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  cutoff.management === 'Government'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : cutoff.management === 'Private'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                }`}>
                  {cutoff.management}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default CutoffListView;