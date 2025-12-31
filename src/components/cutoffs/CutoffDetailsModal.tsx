'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Users, Calendar, MapPin, GraduationCap, BarChart3 } from 'lucide-react';

interface CutoffDetails {
  id: string;
  college: string;
  course: string;
  category: string;
  year: string | number;
  openingRank?: number;
  closingRank?: number;
  totalSeats: number;
  trend?: 'up' | 'down' | 'stable';
  change?: string;
  description?: string;
  stream: string;
  state: string;
  management?: string;
  collegeType?: string;
  counsellingType?: string;
  counsellingBody?: string;
  round?: number;
  quota?: string;
}

interface CutoffDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cutoff: CutoffDetails | null;
  allCutoffs: CutoffDetails[];
  isDarkMode?: boolean;
}

const CutoffDetailsModal: React.FC<CutoffDetailsModalProps> = ({
  isOpen,
  onClose,
  cutoff,
  allCutoffs,
  isDarkMode = false
}) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Store original body styles
      const originalBodyStyle = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        overflow: document.body.style.overflow,
        height: document.body.style.height
      };
      
      // Apply scroll lock
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100%';
      
      return () => {
        // Restore original styles
        document.body.style.position = originalBodyStyle.position;
        document.body.style.top = originalBodyStyle.top;
        document.body.style.left = originalBodyStyle.left;
        document.body.style.right = originalBodyStyle.right;
        document.body.style.width = originalBodyStyle.width;
        document.body.style.overflow = originalBodyStyle.overflow;
        document.body.style.height = originalBodyStyle.height;
        
        // Use requestAnimationFrame to ensure proper timing
        requestAnimationFrame(() => {
          window.scrollTo({
            top: scrollY,
            left: 0,
            behavior: 'auto'
          });
        });
      };
    }
  }, [isOpen]);

  if (!cutoff) return null;

  // Filter all cutoffs for the same college
  const collegeCutoffs = allCutoffs.filter(c => c.college === cutoff.college);

  const getCategoryColor = (category: string) => {
    switch (category.toUpperCase()) {
      case 'GENERAL':
      case 'GEN':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'OBC':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'SC':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'ST':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'EWS':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
      case 'PWD':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
              isDarkMode 
                ? 'bg-gray-900 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}
          >
            {/* Header */}
            <div className={`p-6 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className={`text-2xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {cutoff.college}
                  </h2>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {cutoff.stream}
                      </span>
                      <GraduationCap className={`w-5 h-5 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                      <span className={`text-lg ${
                        isDarkMode ? 'text-white/80' : 'text-gray-600'
                      }`}>
                        {cutoff.course}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className={`w-4 h-4 ${
                        isDarkMode ? 'text-white/60' : 'text-gray-500'
                      }`} />
                      <span className={`text-sm ${
                        isDarkMode ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        {cutoff.state}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        isDarkMode ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {cutoff.management || cutoff.collegeType}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-800 text-white/70 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* All Cutoffs for this College */}
              <div>
                <h3 className={`text-xl font-semibold mb-4 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  All Cutoff Data
                </h3>
                
                <div className="space-y-3">
                  {collegeCutoffs.map((cutoffData, index) => {
                    return (
                      <motion.div
                        key={`${cutoffData.id}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 rounded-xl border transition-all ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {/* Single Line Layout */}
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg border ${
                          isDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                        }">
                          {/* Left Section: Counselling Type, Round, Category, Year */}
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              cutoffData.counsellingType === 'AIQ' 
                                ? (isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800')
                                : (isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800')
                            }`}>
                              {cutoffData.counsellingType || cutoffData.counsellingBody}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              isDarkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-800'
                            }`}>
                              ROUND {cutoffData.round}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              getCategoryColor(cutoffData.category)
                            }`}>
                              {cutoffData.category}
                            </span>
                            <div className="flex items-center space-x-1">
                              <Calendar className={`w-3 h-3 ${
                                isDarkMode ? 'text-white/60' : 'text-gray-500'
                              }`} />
                              <span className={`text-xs font-medium ${
                                isDarkMode ? 'text-white/80' : 'text-gray-600'
                              }`}>
                                {cutoffData.year}
                              </span>
                            </div>
                          </div>

                          {/* Right Section: Ranks */}
                          <div className="flex items-center space-x-6">
                            {/* Opening Rank */}
                            <div className="text-center">
                              <div className={`text-xl font-bold ${
                                isDarkMode ? 'text-green-400' : 'text-green-600'
                              }`}>
                                {cutoffData.openingRank}
                              </div>
                              <div className={`text-xs ${
                                isDarkMode ? 'text-white/60' : 'text-gray-500'
                              }`}>
                                Opening Rank
                              </div>
                            </div>
                            
                            {/* Closing Rank */}
                            <div className="text-center">
                              <div className={`text-xl font-bold ${
                                isDarkMode ? 'text-red-400' : 'text-red-600'
                              }`}>
                                {cutoffData.closingRank}
                              </div>
                              <div className={`text-xs ${
                                isDarkMode ? 'text-white/60' : 'text-gray-500'
                              }`}>
                                Closing Rank
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-6 border-t ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className={`w-5 h-5 ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <span className={`text-sm ${
                    isDarkMode ? 'text-white/80' : 'text-gray-600'
                  }`}>
                    {collegeCutoffs.length} cutoff records found
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className={`px-6 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 ${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CutoffDetailsModal;
