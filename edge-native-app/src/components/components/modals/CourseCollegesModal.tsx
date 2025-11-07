'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Users, Building2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface College {
  id: string;
  name: string;
  fullName?: string;
  type?: string;
  state: string;
  address?: string;
  city?: string;
  pincode?: string;
  university?: string;
  management?: string;
  establishedYear?: number;
  website?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  sourceFile?: string;
  createdAt?: string;
  updatedAt?: string;
  dnbCode?: string;
  // Legacy fields for backward compatibility
  district?: string;
  management_type?: string;
  college_type?: string;
  total_seats?: number;
}

interface Course {
  id?: string;
  name?: string;
  type?: string;
  stream?: string;
  branch?: string;
  level?: string;
  duration?: string;
  degreeType?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Legacy fields for backward compatibility
  course_name?: string;
  total_seats?: number;
  total_colleges?: number;
  college_names?: string;
  colleges?: College[];
}

interface CourseCollegesModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  colleges?: College[];
}

const CourseCollegesModal: React.FC<CourseCollegesModalProps> = ({
  isOpen,
  onClose,
  course,
  colleges = []
}) => {
  const { isDarkMode } = useTheme();

  if (!isOpen || !course) return null;

  const getManagementBadgeColor = (management: string) => {
    switch (management?.toUpperCase()) {
      case 'GOVERNMENT':
        return isDarkMode 
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'PRIVATE':
        return isDarkMode 
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
          : 'bg-cyan-100 text-cyan-800 border border-cyan-300';
      case 'TRUST':
        return isDarkMode 
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : 'bg-violet-100 text-violet-800 border border-violet-300';
      case 'DEEMED':
        return isDarkMode 
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
          : 'bg-purple-100 text-purple-800 border border-purple-300';
      default:
        return isDarkMode 
          ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
          : 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  };

  // Use the colleges array directly from the course (already aggregated by backend)
  const aggregatedColleges = course.colleges || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 500, duration: 0.3 }}
          className={`relative w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl ${
            isDarkMode 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {course.name || course.course_name}
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Available in {aggregatedColleges.length} colleges
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors duration-150 ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-400' 
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {aggregatedColleges.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aggregatedColleges.map((college, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    className={`p-4 rounded-xl border-2 backdrop-blur-md shadow-md hover:shadow-lg transition-all duration-200 ${
                      isDarkMode 
                        ? 'bg-white/10 border-white/20 hover:bg-white/15' 
                        : 'bg-blue-50/40 border-blue-200/60 hover:bg-blue-50/60'
                    }`}
                  >
                    <div className="space-y-3">
                      <h3 className={`font-semibold text-sm line-clamp-2 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {college.fullName || college.name}
                      </h3>
                      
                      <div className={`flex items-center gap-2 text-xs ${
                        isDarkMode ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        <MapPin className="w-3 h-3" />
                        <span>{college.state}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getManagementBadgeColor(college.management || college.management_type || '')}`}>
                          {college.management || college.management_type || 'N/A'}
                        </span>
                        
                        <div className={`flex items-center gap-1 text-xs ${
                          isDarkMode ? 'text-white/70' : 'text-gray-600'
                        }`}>
                          <Users className="w-3 h-3" />
                          <span>{college.total_seats || 0} seats</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className={`w-16 h-16 mx-auto mb-4 ${
                  isDarkMode ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h3 className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  No Colleges Found
                </h3>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  No colleges are currently offering this course.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className={`px-6 py-2 rounded-lg font-medium transition-colors duration-150 ${
                  isDarkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CourseCollegesModal;

