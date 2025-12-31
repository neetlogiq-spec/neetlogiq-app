'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Building2, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  School,
  BookOpen
} from 'lucide-react';
import useScrollLock from '@/hooks/useScrollLock';

interface College {
  id: string;
  name: string;
  state: string;
  college_type: string;
  management_type: string;
  establishment_year?: number;
  university?: string;
  address?: string;
  pincode?: string;
  status?: string;
}

interface Course {
  name?: string;
  course_name?: string;
  program?: string;
  stream?: string;
  total_seats?: number;
}

interface CollegeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  college: College | null;
  courses: Course[];
  isLoading?: boolean;
}

const CollegeDetailsModal: React.FC<CollegeDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  college, 
  courses = [], 
  isLoading = false 
}) => {
  
  // Lock body scroll when modal is open
  useScrollLock(isOpen);

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
          className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white border border-gray-200 mx-2 sm:mx-4"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-blue-100">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2 text-gray-900">
                    {college.name}
                  </h2>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {college.state}{college.address ? `, ${college.address}` : ''}
                    </span>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getManagementBadgeColor(college.management_type)}`}>
                      {college.management_type || 'N/A'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCollegeTypeColor(college.college_type)}`}>
                      {college.college_type || 'N/A'}
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
                className="p-2 rounded-lg transition-colors duration-150 hover:bg-gray-100 text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="space-y-4 sm:space-y-6">
              {/* Full Width Layout */}
              <div className="space-y-6">
                {/* Key Statistics - Responsive layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Established - 1 column */}
                  <div className="p-4 sm:p-6 rounded-xl bg-gray-50">
                    <div className="flex items-center mb-3">
                      <Calendar className="w-6 h-6 mr-3 text-blue-600" />
                      <span className="text-lg font-semibold text-gray-900">Established</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {college.establishment_year || 'N/A'}
                    </p>
                  </div>

                  {/* Courses - 1 column */}
                  <div className="p-4 sm:p-6 rounded-xl bg-gray-50">
                    <div className="flex items-center mb-3">
                      <GraduationCap className="w-6 h-6 mr-3 text-blue-600" />
                      <span className="text-lg font-semibold text-gray-900">Courses</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {courses.length || 'N/A'}
                    </p>
                  </div>

                  {/* Affiliated University - 1 column (expanded) */}
                  <div className="p-4 sm:p-6 rounded-xl bg-gray-50">
                    <div className="flex items-center mb-3">
                      <School className="w-6 h-6 mr-3 text-green-600" />
                      <span className="text-lg font-semibold text-gray-900">Affiliated University</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed text-gray-900">
                      {college.university || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Detailed Information */}
                <div className="p-6 rounded-xl bg-gray-50">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">
                    College Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Full Address:</span>
                      <p className="text-sm text-gray-600">
                        {college.address || 'Address not available'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">Pincode:</span>
                      <p className="text-sm text-gray-600">
                        {college.pincode || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">Management Type:</span>
                      <p className="text-sm text-gray-600">
                        {college.management_type || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium text-gray-700">College Type:</span>
                      <p className="text-sm text-gray-600">
                        {college.college_type || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Courses Section */}
                <div className="p-6 rounded-xl bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Available Courses
                    </h3>
                    <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {courses.length} courses
                    </div>
                  </div>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                      <span className="ml-3 text-gray-600">
                        Loading courses...
                      </span>
                    </div>
                  ) : courses && courses.length > 0 ? (
                    <div className="space-y-3">
                      {courses
                        .sort((a, b) => {
                          // Get course type for priority sorting (same logic as display)
                          const getCourseType = (course: Course) => {
                            const courseName = (course.course_name || course.name || '').toUpperCase();
                            const program = (course.program || '').toUpperCase();
                            const stream = (course.stream || '').toUpperCase();
                            
                            // DIPLOMA courses (Postgraduate Diploma) - Check this FIRST for NBEMS-DIPLOMA
                            if (courseName.includes('DIPLOMA') || courseName.includes('DIPLOMA -')) return 4;
                            
                            // UG courses (MBBS, BDS)
                            if (courseName.includes('MBBS') || courseName === 'BDS') return 1;
                            
                            // MDS - Master of Dental Surgery (for dental postgraduate courses)
                            if (courseName.includes('MDS')) return 2;
                            
                            // MD - Doctor of Medicine (Postgraduate)
                            if (courseName.includes('MD -') || courseName.startsWith('MD ')) return 2;
                            
                            // MS - Master of Surgery (Postgraduate)
                            if (courseName.includes('MS -') || courseName.startsWith('MS ')) return 2;
                            
                            // NBEMS courses (National Board of Examinations in Medical Sciences) - DNB
                            if (courseName.includes('NBEMS')) return 3;
                            
                            // For dental courses (regardless of program level in API), check dental terms
                            if (stream === 'DENTAL' && (courseName.includes('DENTISTRY') || courseName.includes('DENTAL') || 
                                courseName.includes('ORTHODONTICS') || courseName.includes('PERIODONTOLOGY') ||
                                courseName.includes('PROSTHODONTICS') || courseName.includes('ENDODONTICS') ||
                                courseName.includes('ORAL') || courseName.includes('MAXILLOFACIAL') ||
                                courseName.includes('PAEDIATRIC') || courseName.includes('CONSERVATIVE'))) {
                              // Check seat count to determine if it's MDS or PG Diploma
                              const seats = parseInt(course.total_seats?.toString() || '0') || 0;
                              return seats > 3 ? 2 : 4; // MDS = 2, PG Diploma = 4
                            }
                            
                            // PG courses (Postgraduate)
                            if (courseName.includes('PG') || program === 'PG') return 2;
                            
                            // UG courses (Undergraduate)
                            if (program === 'UG') return 1;
                            
                            // Default fallback
                            return 5;
                          };
                          
                          const typeA = getCourseType(a);
                          const typeB = getCourseType(b);
                          
                          // Sort by priority first
                          if (typeA !== typeB) return typeA - typeB;
                          
                          // Within same category, sort alphabetically
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
                          className="p-3 rounded-lg border backdrop-blur-md hover:shadow-md transition-all duration-150 bg-green-50/40 border-green-200/60 hover:bg-green-50/60"
                        >
                          <div className="flex items-center justify-between gap-6">
                            {/* Course Name - More space for longer names */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {course.name || course.course_name}
                              </h4>
                            </div>
                            
                            {/* Course Type - Compact badge */}
                            <div className="flex items-center justify-center min-w-[70px]">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {(() => {
                                  const courseName = (course.course_name || course.name || '').toUpperCase();
                                  const program = (course.program || '').toUpperCase();
                                  const stream = (course.stream || '').toUpperCase();
                                  
                                  // Favor explicit program/course_type from API if available
                                  if (program && program !== 'N/A') {
                                    if (program.includes('DIPLOMA')) return 'DIPLOMA';
                                    if (program.includes('NBEMS')) return 'NBEMS';
                                    return program;
                                  }
                                  
                                  // Fallback to name-based classification
                                  if (courseName.includes('DIPLOMA') || courseName.includes('DIPLOMA -')) return 'DIPLOMA';
                                  if (courseName.includes('MBBS')) return 'MBBS';
                                  if (courseName === 'BDS') return 'BDS';
                                  
                                  // MDS - Master of Dental Surgery (for dental postgraduate courses)
                                  if (courseName.includes('MDS')) return 'MDS';
                                  
                                  // MD - Doctor of Medicine (Postgraduate)
                                  if (courseName.includes('MD -') || courseName.startsWith('MD ')) return 'MD';
                                  
                                  // MS - Master of Surgery (Postgraduate)
                                  if (courseName.includes('MS -') || courseName.startsWith('MS ')) return 'MS';
                                  
                                  // NBEMS courses (National Board of Examinations in Medical Sciences) - DNB
                                  if (courseName.includes('NBEMS')) return 'DNB';
                                  
                                  // For dental courses (regardless of program level in API), check dental terms
                                  if (stream === 'DENTAL' && (courseName.includes('DENTISTRY') || courseName.includes('DENTAL') || 
                                      courseName.includes('ORTHODONTICS') || courseName.includes('PERIODONTOLOGY') ||
                                      courseName.includes('PROSTHODONTICS') || courseName.includes('ENDODONTICS') ||
                                      courseName.includes('ORAL') || courseName.includes('MAXILLOFACIAL') ||
                                      courseName.includes('PAEDIATRIC') || courseName.includes('CONSERVATIVE'))) {
                                    // Check seat count to determine if it's MDS or PG Diploma
                                    const seats = parseInt(course.total_seats?.toString() || '0') || 0;
                                    return seats > 3 ? 'MDS' : 'PG Diploma';
                                  }
                                  
                                  // PG courses (Postgraduate)
                                  if (courseName.includes('PG') || program === 'PG') return 'PG';
                                  
                                  // UG courses (Undergraduate)
                                  if (program === 'UG') return 'UG';
                                  
                                  // Fallback to program level
                                  return program || 'N/A';
                                })()}
                                </span>
                            </div>
                            
                            {/* Seats - Compact badge */}
                            <div className="flex justify-end min-w-[70px]">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {course.total_seats || 0} seats
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-100">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2 text-gray-900">
                        No Courses Available
                      </h4>
                      <p className="text-sm text-gray-600">
                        No course information is available for this college at the moment.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-lg font-medium transition-colors duration-150 bg-gray-100 text-gray-900 hover:bg-gray-200"
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