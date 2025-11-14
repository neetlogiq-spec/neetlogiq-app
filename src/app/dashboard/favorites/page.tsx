'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, GraduationCap, BookOpen, Trash2, ExternalLink, Eye, Search, Filter } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { College, Course } from '@/types';
import userPreferences from '@/services/userPreferences';

export default function FavoritesPage() {
  const { isDarkMode } = useTheme();
  const [favoriteColleges, setFavoriteColleges] = useState<College[]>([]);
  const [favoriteCourses, setFavoriteCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'colleges' | 'courses'>('all');

  // Load favorite data
  useEffect(() => {
    const loadFavoriteData = async () => {
      setIsLoading(true);
      try {
        const preferences = userPreferences.getPreferences();
        const favoriteCollegeIds = preferences.favoriteColleges || [];
        const favoriteCourseIds = preferences.favoriteCourses || [];

        // Load college data
        if (favoriteCollegeIds.length > 0) {
          const collegePromises = favoriteCollegeIds.map(async (collegeId) => {
            try {
              const response = await fetch(`/api/colleges/${collegeId}`);
              if (response.ok) {
                const result = await response.json();
                return result.data; // Extract data from API response
              }
            } catch (error) {
              console.error(`Failed to load college ${collegeId}:`, error);
            }
            return null;
          });
          
          const colleges = (await Promise.all(collegePromises)).filter(Boolean);
          setFavoriteColleges(colleges);
        }

        // Load course data
        if (favoriteCourseIds.length > 0) {
          const coursePromises = favoriteCourseIds.map(async (courseId) => {
            try {
              const response = await fetch(`/api/courses/${courseId}`);
              if (response.ok) {
                const result = await response.json();
                return result.data; // Extract data from API response
              }
            } catch (error) {
              console.error(`Failed to load course ${courseId}:`, error);
            }
            return null;
          });
          
          const courses = (await Promise.all(coursePromises)).filter(Boolean);
          setFavoriteCourses(courses);
        }
      } catch (error) {
        console.error('Failed to load favorite data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavoriteData();
  }, []);

  const handleRemoveFavorite = (type: 'college' | 'course', itemId: string) => {
    userPreferences.removeFavorite(type, itemId);
    if (type === 'college') {
      setFavoriteColleges(prev => prev.filter(college => college.id !== itemId));
    } else {
      setFavoriteCourses(prev => prev.filter(course => course.id !== itemId));
    }
  };

  const handleViewItem = (type: 'college' | 'course', itemId: string) => {
    if (type === 'college') {
      // Navigate to colleges page with the specific college highlighted
      window.location.href = `/colleges?college=${itemId}`;
    } else {
      // Navigate to courses page with the specific course highlighted
      window.location.href = `/courses?course=${itemId}`;
    }
  };

  // Filter data based on search and type
  const filteredColleges = favoriteColleges.filter(college => 
    (filterType === 'all' || filterType === 'colleges') &&
    college.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCourses = favoriteCourses.filter(course => 
    (filterType === 'all' || filterType === 'courses') &&
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = filteredColleges.length + filteredCourses.length;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className={`fixed inset-0 z-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}></div>

      {/* Content */}
      <div className="relative z-20 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Heart className={`w-8 h-8 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                My Favorites
              </h1>
            </div>
            <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Manage your favorite colleges and courses
            </p>
          </motion.div>

          {/* Search and Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={`p-6 rounded-2xl border-2 mb-8 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search favorites..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-white/10 text-white placeholder-gray-400'
                        : 'bg-gray-50 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filterType === 'all'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({totalItems})
                </button>
                <button
                  onClick={() => setFilterType('colleges')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filterType === 'colleges'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 inline mr-2" />
                  Colleges ({filteredColleges.length})
                </button>
                <button
                  onClick={() => setFilterType('courses')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filterType === 'courses'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Courses ({filteredCourses.length})
                </button>
              </div>
            </div>
          </motion.div>

          {/* Loading State */}
          {isLoading && (
            <div className={`text-center py-12 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg">Loading your favorites...</p>
            </div>
          )}

          {/* Content */}
          {!isLoading && (
            <div className="space-y-8">
              {/* Favorite Colleges */}
              {filteredColleges.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <GraduationCap className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                    <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Favorite Colleges ({filteredColleges.length})
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredColleges.map((college, index) => (
                      <motion.div
                        key={college.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        className={`p-6 rounded-2xl border-2 transition-all shadow-lg hover:shadow-xl ${
                          isDarkMode 
                            ? 'bg-white/10 border-white/20 hover:bg-white/15' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-lg font-semibold mb-2 line-clamp-2 ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {college.name}
                            </h3>
                            <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                              {college.city}, {college.state}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                college.management_type === 'GOVERNMENT'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : college.management_type === 'PRIVATE'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                              }`}>
                                {college.management_type}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                college.type === 'MEDICAL'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : college.type === 'DENTAL'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                              }`}>
                                {college.type}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {college.course_count || 0} courses
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewItem('college', college.id)}
                              className={`p-2 rounded-lg hover:bg-blue-500/20 transition-colors ${
                                isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
                              }`}
                              title="View college"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveFavorite('college', college.id)}
                              className={`p-2 rounded-lg hover:bg-red-500/20 transition-colors ${
                                isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                              }`}
                              title="Remove from favorites"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Favorite Courses */}
              {filteredCourses.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <BookOpen className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
                    <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Favorite Courses ({filteredCourses.length})
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course, index) => (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        className={`p-6 rounded-2xl border-2 transition-all shadow-lg hover:shadow-xl ${
                          isDarkMode 
                            ? 'bg-white/10 border-white/20 hover:bg-white/15' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-lg font-semibold mb-2 line-clamp-2 ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {course.name}
                            </h3>
                            <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                              {course.stream} • {course.duration} years
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                course.stream === 'MEDICAL'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  : course.stream === 'DENTAL'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                              }`}>
                                {course.stream}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {course.total_seats || 0} seats
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewItem('course', course.id)}
                              className={`p-2 rounded-lg hover:bg-green-500/20 transition-colors ${
                                isDarkMode ? 'text-green-400 hover:text-green-300' : 'text-green-500 hover:text-green-600'
                              }`}
                              title="View course"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveFavorite('course', course.id)}
                              className={`p-2 rounded-lg hover:bg-red-500/20 transition-colors ${
                                isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                              }`}
                              title="Remove from favorites"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Empty State */}
              {!isLoading && totalItems === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className={`text-center py-16 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}
                >
                  <Heart className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
                  <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    No favorites yet
                  </h3>
                  <p className="text-lg mb-6">
                    {searchQuery ? 'No results found for your search.' : 'Start adding colleges and courses to your favorites!'}
                  </p>
                  {!searchQuery && (
                    <a
                      href="/colleges"
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      <GraduationCap className="w-5 h-5" />
                      Browse Colleges
                    </a>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
