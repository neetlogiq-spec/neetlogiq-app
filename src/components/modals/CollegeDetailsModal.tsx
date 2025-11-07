'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Building2, 
  MapPin, 
  GraduationCap, 
  School,
  BookOpen
} from 'lucide-react';
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
  university_affiliation?: string;
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
  course_count?: number;
  // Legacy fields for backward compatibility
  district?: string;
  management_type?: string;
  college_type?: string;
  establishment_year?: string;
  status?: string;
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
  program?: string;
  total_seats?: number;
}

interface CollegeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  college: College | null;
  courses?: Course[];
  isLoading?: boolean;
}

const CollegeDetailsModal: React.FC<CollegeDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  college, 
  courses = [], 
  isLoading = false 
}) => {
  const { isDarkMode } = useTheme();

  if (!isOpen || !college) {
    return null;
  }

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
    <AnimatePresence mode="wait">
      {isOpen && (
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
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
              isDarkMode 
                ? 'bg-gray-800 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}
          >
            {/* Header */}
            <div className={`p-6 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                    isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                  }`}>
                    <Building2 className={`w-8 h-8 ${
                      isDarkMode ? 'text-green-400' : 'text-green-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h2 className={`text-2xl font-bold mb-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {college.fullName || college.name}
                    </h2>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className={`w-4 h-4 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {college.city ? `${college.city}, ` : ''}{college.state}
                      </span>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getManagementBadgeColor(college.management || college.management_type || '')}`}>
                        {college.management || college.management_type || 'N/A'}
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
                    </div>
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
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-6">
                {/* Key Statistics */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Courses */}
                  <div className={`p-6 rounded-xl ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center mb-3">
                      <GraduationCap className={`w-6 h-6 mr-3 ${
                        isDarkMode ? 'text-purple-400' : 'text-purple-600'
                      }`} />
                      <span className={`text-lg font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>Courses</span>
                    </div>
                    <p className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {college.course_count || courses.length || 'N/A'}
                    </p>
                  </div>

                  {/* Affiliated University */}
                  <div className={`p-6 rounded-xl ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center mb-3">
                      <School className={`w-6 h-6 mr-3 ${
                        isDarkMode ? 'text-green-400' : 'text-green-600'
                      }`} />
                      <span className={`text-lg font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>Affiliated University</span>
                    </div>
                    <p className={`text-sm font-bold leading-relaxed ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {college.university_affiliation || college.university || 'N/A'}
                    </p>
                  </div>
                </div>


                {/* Courses Section */}
                <div className={`p-6 rounded-xl ${
                  isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Available Courses
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {college.course_count || courses.length} courses
                    </div>
                  </div>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                      <span className={`ml-3 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Loading courses...
                      </span>
                    </div>
                  ) : courses && courses.length > 0 ? (
                    <div className="space-y-3">
                      {courses
                        .sort((a, b) => {
                          // Sort courses by type priority
                          const getCourseType = (course: Course) => {
                            const courseName = (course.course_name || course.name || '').toUpperCase();
                            
                            // MBBS/BDS - Undergraduate
                            if (courseName.includes('MBBS') || courseName === 'BDS') return 1;
                            
                            // MD/MS - Postgraduate
                            if (courseName.includes('MD') || courseName.includes('MS')) return 2;
                            
                            // MDS - Dental Postgraduate
                            if (courseName.includes('MDS')) return 2;
                            
                            // DNB - Diplomate of National Board
                            if (courseName.includes('DNB')) return 3;
                            
                            // Diploma courses
                            if (courseName.includes('DIPLOMA')) return 4;
                            
                            return 5;
                          };
                          
                          const typeA = getCourseType(a);
                          const typeB = getCourseType(b);
                          
                          if (typeA !== typeB) return typeA - typeB;
                          
                          const courseA = (a.name || a.course_name || '').toUpperCase();
                          const courseB = (b.name || b.course_name || '').toUpperCase();
                          return courseA.localeCompare(courseB);
                        })
                        .map((course, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.01, duration: 0.15 }}
                          className={`p-3 rounded-lg border backdrop-blur-md hover:shadow-md transition-all duration-150 ${
                            isDarkMode 
                              ? 'bg-green-50/10 border-green-200/20 hover:bg-green-50/20' 
                              : 'bg-green-50/40 border-green-200/60 hover:bg-green-50/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-6">
                            {/* Course Name */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm font-semibold ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                {course.name || course.course_name}
                              </h4>
                            </div>
                            
                            {/* Course Type */}
                            <div className="flex items-center justify-center min-w-[70px]">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isDarkMode 
                                  ? 'bg-blue-500/20 text-blue-300' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {course.branch || course.program || 'N/A'}
                              </span>
                            </div>
                            
                            {/* Seats */}
                            <div className="flex justify-end min-w-[70px]">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isDarkMode
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {course.total_seats || 0} seats
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <BookOpen className={`w-8 h-8 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                      </div>
                      <h4 className={`text-lg font-semibold mb-2 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        No Courses Available
                      </h4>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        No course information is available for this college at the moment.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-6 border-t ${
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
      )}
    </AnimatePresence>
  );
};

export default CollegeDetailsModal;

