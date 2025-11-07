'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Users, Clock, GraduationCap, ChevronRight, Eye, MapPin } from 'lucide-react';
import { Course } from '@/types';

interface CourseListViewProps {
  courses: Course[];
  onViewColleges: (course: Course) => void;
  isDarkMode?: boolean;
  isLoading?: boolean;
}

const CourseListView: React.FC<CourseListViewProps> = ({
  courses,
  onViewColleges,
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

  if (courses.length === 0) {
    return (
      <div className={`text-center py-12 rounded-xl border ${
        isDarkMode 
          ? 'bg-white/5 border-white/10 text-white/70' 
          : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No courses found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search criteria</p>
      </div>
    );
  }

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case 'MEDICAL':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'DENTAL':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'DNB':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getBranchColor = (branch: string) => {
    switch (branch) {
      case 'UG':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'PG':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'DIPLOMA':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
      case 'SS':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-3">
      {courses.map((course, index) => (
        <motion.div
          key={`course-list-${course.course_name}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`group cursor-pointer p-4 rounded-xl border transition-all duration-200 hover:shadow-lg ${
            isDarkMode
              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md'
          }`}
          onClick={() => onViewColleges(course)}
        >
          <div className="flex items-center justify-between">
            {/* Course Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-3">
                <h3 className={`font-semibold text-lg truncate pr-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                } group-hover:text-blue-600 transition-colors`}>
                  {course.course_name}
                </h3>
              </div>

              {/* Stream & Branch Tags */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  getStreamColor(course.stream)
                }`}>
                  {course.stream}
                </span>
                
                {course.branch && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    getBranchColor(course.branch)
                  }`}>
                    {course.branch}
                  </span>
                )}
              </div>

              {/* Course Details */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {course.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className={`w-4 h-4 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`} />
                    <span className={`${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                      {course.duration}
                    </span>
                  </div>
                )}
                
                {course.total_seats && course.total_seats > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className={`w-4 h-4 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`} />
                    <span className={`${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                      {course.total_seats.toLocaleString()} seats
                    </span>
                  </div>
                )}

                {course.total_colleges && course.total_colleges > 0 && (
                  <div className="flex items-center gap-1">
                    <MapPin className={`w-4 h-4 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`} />
                    <span className={`${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                      {course.total_colleges} colleges
                    </span>
                  </div>
                )}
              </div>

              {/* College Names Preview (Mobile-First: Show on larger screens) */}
              {course.college_names && (
                <div className="mt-2 hidden sm:block">
                  <p className={`text-xs truncate ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                    Available at: {course.college_names}
                  </p>
                </div>
              )}
            </div>

            {/* Action Button */}
            <motion.div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ml-4 ${
                isDarkMode
                  ? 'bg-white/10 text-white/80 group-hover:bg-white/20'
                  : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">View Colleges</span>
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default CourseListView;