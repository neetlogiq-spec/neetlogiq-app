'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Bell, BellOff, Trash2, Calendar } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { UserPreferences, WatchlistItem } from '@/types/user';
import { College, Course } from '@/types';
import userPreferences from '@/services/userPreferences';
import CollegeDetailsModal from '@/components/modals/CollegeDetailsModal';

interface WatchlistWidgetProps {
  preferences: UserPreferences | null;
}

export default function WatchlistWidget({ preferences }: WatchlistWidgetProps) {
  const { isDarkMode } = useTheme();
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistCollegesData, setWatchlistCollegesData] = useState<College[]>([]);
  const [watchlistCoursesData, setWatchlistCoursesData] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [selectedCollegeCourses, setSelectedCollegeCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Update watchlist items when preferences change
  useEffect(() => {
    setWatchlistItems(preferences?.watchlistCutoffs || []);
  }, [preferences]);

  // Load watchlist data
  useEffect(() => {
    const loadWatchlistData = async () => {
      setIsLoading(true);
      try {
        const watchlistItems = preferences?.watchlistCutoffs || [];
        
        // Separate colleges and courses
        const collegeItems = watchlistItems.filter(item => item.type === 'college');
        const courseItems = watchlistItems.filter(item => item.type === 'course');

        // Load college data
        if (collegeItems.length > 0) {
          const collegePromises = collegeItems.map(async (item) => {
            try {
              const response = await fetch(`/api/colleges/${item.itemId}`);
              if (response.ok) {
                const result = await response.json();
                return result.success && result.data ? result.data : null;
              }
            } catch (error) {
              console.error(`Error fetching college ${item.itemId}:`, error);
            }
            return null;
          });
          
          const collegeResults = await Promise.all(collegePromises);
          setWatchlistCollegesData(collegeResults.filter(Boolean));
        }

        // Load course data
        if (courseItems.length > 0) {
          const coursePromises = courseItems.map(async (item) => {
            try {
              const response = await fetch(`/api/courses/${item.itemId}`);
              if (response.ok) {
                const result = await response.json();
                return result.success && result.data ? result.data : null;
              }
            } catch (error) {
              console.error(`Error fetching course ${item.itemId}:`, error);
            }
            return null;
          });
          
          const courseResults = await Promise.all(coursePromises);
          setWatchlistCoursesData(courseResults.filter(Boolean));
        }
      } catch (error) {
        console.error('Error loading watchlist data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (preferences) {
      loadWatchlistData();
    }
  }, [preferences]);

  // Listen for updates from other components
  useEffect(() => {
    const handleFavoritesUpdate = () => {
      const updatedPreferences = userPreferences.getPreferences();
      setWatchlistItems(updatedPreferences.watchlistCutoffs || []);
    };

    window.addEventListener('favoritesUpdated', handleFavoritesUpdate);
    return () => window.removeEventListener('favoritesUpdated', handleFavoritesUpdate);
  }, []);

  const handleRemoveFromWatchlist = (collegeOrCourseId: string, type: 'college' | 'course') => {
    // Find the watchlist item by matching the itemId field
    const watchlistItem = watchlistItems.find(item => item.itemId === collegeOrCourseId && item.type === type);
    if (watchlistItem) {
      userPreferences.removeFromWatchlist(watchlistItem.id);
      // Update local state
      setWatchlistItems(prev => prev.filter(item => item.id !== watchlistItem.id));
      // Also update the data arrays
      if (type === 'college') {
        setWatchlistCollegesData(prev => prev.filter(college => college.id !== collegeOrCourseId));
      } else {
        setWatchlistCoursesData(prev => prev.filter(course => course.id !== collegeOrCourseId));
      }
    }
  };

  const handleToggleAlert = (collegeOrCourseId: string, type: 'college' | 'course', currentAlertEnabled: boolean) => {
    // Find the watchlist item by matching the itemId field
    const watchlistItem = watchlistItems.find(item => item.itemId === collegeOrCourseId && item.type === type);
    if (watchlistItem) {
      userPreferences.updateWatchlistAlert(watchlistItem.id, !currentAlertEnabled);
      // Update local state
      setWatchlistItems(prev => prev.map(item => 
        item.id === watchlistItem.id 
          ? { ...item, alertEnabled: !currentAlertEnabled }
          : item
      ));
    }
  };

  const handleViewItem = async (type: 'college' | 'course', itemId: string) => {
    if (type === 'college') {
      // Open college modal directly in dashboard
      setIsModalLoading(true);
      try {
        const response = await fetch(`/api/colleges/${itemId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setSelectedCollege(result.data);
            // Set courses from the API response
            setSelectedCollegeCourses(result.data.coursesOffered || []);
            setIsModalOpen(true);
          }
        }
      } catch (error) {
        console.error('Error fetching college details:', error);
      } finally {
        setIsModalLoading(false);
      }
    } else {
      // Navigate to courses page with the specific course highlighted
      window.location.href = `/courses?course=${itemId}`;
    }
  };

  return (
    <div
      className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${
        isDarkMode 
          ? 'bg-white/10 border-white/20 hover:bg-white/15 shadow-white/5' 
          : 'bg-white/80 border-gray-200/60 hover:bg-white shadow-gray-200/30'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Watchlist
        </h3>
        <Eye className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
      </div>
      
      <div className="space-y-3">
        {isLoading ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm">Loading watchlist...</p>
          </div>
        ) : watchlistCollegesData.length > 0 || watchlistCoursesData.length > 0 ? (
          <>
            {/* Colleges Section */}
            {watchlistCollegesData.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Colleges ({watchlistCollegesData.length})
                </h4>
                {watchlistCollegesData.slice(0, 3).map((college) => (
                  <div
                    key={college.id}
              className={`p-3 rounded-lg border ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {college.name}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                          {college.city ? `${college.city}, ` : ''}{college.state} • {college.type}
                  </div>
                        {college.course_count && (
                    <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                            {college.course_count} courses
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                          onClick={() => handleViewItem('college', college.id)}
                          disabled={isModalLoading}
                    className={`p-1 rounded transition-colors ${
                            isDarkMode 
                              ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20' 
                              : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title="View college details"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveFromWatchlist(college.id, 'college')}
                          className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                            isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                          }`}
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {watchlistCollegesData.length > 3 && (
                  <div className={`text-xs text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                    +{watchlistCollegesData.length - 3} more colleges
                  </div>
                )}
              </div>
            )}

            {/* Courses Section */}
            {watchlistCoursesData.length > 0 && (
              <div className="space-y-2">
                <h4 className={`text-sm font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Courses ({watchlistCoursesData.length})
                </h4>
                {watchlistCoursesData.slice(0, 3).map((course) => (
                  <div
                    key={course.id}
                    className={`p-3 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {course.name || course.course_name}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                          {course.stream || course.program} • {course.duration || 'N/A'}
                        </div>
                        {course.total_seats && (
                          <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                            {course.total_seats} seats
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => handleViewItem('course', course.id)}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode 
                              ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20' 
                              : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title="View course details"
                        >
                          <Eye className="w-3 h-3" />
                  </button>
                        <button
                          onClick={() => handleRemoveFromWatchlist(course.id, 'course')}
                          className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                            isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                          }`}
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                </div>
              </div>
            </div>
                ))}
                {watchlistCoursesData.length > 3 && (
                  <div className={`text-xs text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                    +{watchlistCoursesData.length - 3} more courses
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            <Eye className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
            <p className="text-sm">No items in watchlist</p>
            <p className="text-xs mt-1">Add colleges, courses, or cutoffs to track them!</p>
          </div>
        )}
      </div>

      {/* College Details Modal */}
      {isModalOpen && selectedCollege && (
        <CollegeDetailsModal
          college={selectedCollege}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCollege(null);
            setSelectedCollegeCourses([]);
          }}
          courses={selectedCollegeCourses}
        />
      )}
    </div>
  );
}
