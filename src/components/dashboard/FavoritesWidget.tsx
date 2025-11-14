'use client';

import React, { useState, useEffect } from 'react';
import { Heart, GraduationCap, BookOpen, Trash2, Eye } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { UserPreferences } from '@/types/user';
import { College, Course } from '@/types';
import userPreferences from '@/services/userPreferences';
import CollegeDetailsModal from '@/components/modals/CollegeDetailsModal';

interface FavoritesWidgetProps {
  preferences: UserPreferences | null;
}

export default function FavoritesWidget({ preferences }: FavoritesWidgetProps) {
  const { isDarkMode } = useTheme();
  const [favoriteCollegesData, setFavoriteCollegesData] = useState<College[]>([]);
  const [favoriteCoursesData, setFavoriteCoursesData] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [selectedCollegeCourses, setSelectedCollegeCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Load favorite colleges and courses data
  useEffect(() => {
    const loadFavoriteData = async () => {
      setIsLoading(true);
      try {
        const favoriteColleges = preferences?.favoriteColleges || [];
        const favoriteCourses = preferences?.favoriteCourses || [];

        // Load college data
        if (favoriteColleges.length > 0) {
          const collegePromises = favoriteColleges.map(async (collegeId) => {
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
          setFavoriteCollegesData(colleges);
        }

        // Load course data
        if (favoriteCourses.length > 0) {
          const coursePromises = favoriteCourses.map(async (courseId) => {
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
          setFavoriteCoursesData(courses);
        }
      } catch (error) {
        console.error('Failed to load favorite data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavoriteData();
  }, [preferences]);

  const handleRemoveFavorite = (type: 'college' | 'course', itemId: string) => {
    userPreferences.removeFavorite(type, itemId);
    // Update local state
    if (type === 'college') {
      setFavoriteCollegesData(prev => prev.filter(college => college.id !== itemId));
    } else {
      setFavoriteCoursesData(prev => prev.filter(course => course.id !== itemId));
    }
    // Trigger a refresh of the parent component
    window.dispatchEvent(new CustomEvent('favoritesUpdated'));
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
          Favorites
        </h3>
        <Heart className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
      </div>
      
      <div className="space-y-3">
        {/* Loading State */}
        {isLoading && (
          <div className={`text-center py-4 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm">Loading favorites...</p>
          </div>
        )}

        {/* Favorite Colleges */}
        {!isLoading && favoriteCollegesData.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <GraduationCap className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                Colleges ({favoriteCollegesData.length})
              </span>
            </div>
            <div className="space-y-2">
              {favoriteCollegesData.slice(0, 3).map((college) => (
                <div
                  key={college.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {college.name}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                      {college.city}, {college.state} • {college.type}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => handleViewItem('college', college.id)}
                      disabled={isModalLoading}
                      className={`p-1 rounded hover:bg-blue-500/20 transition-colors ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
                      } ${isModalLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="View college"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  <button
                      onClick={() => handleRemoveFavorite('college', college.id)}
                    className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                      isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                    }`}
                      title="Remove from favorites"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  </div>
                </div>
              ))}
              {favoriteCollegesData.length > 3 && (
                <div className={`text-xs text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  +{favoriteCollegesData.length - 3} more colleges
                </div>
              )}
            </div>
          </div>
        )}

        {/* Favorite Courses */}
        {!isLoading && favoriteCoursesData.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <BookOpen className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                Courses ({favoriteCoursesData.length})
              </span>
            </div>
            <div className="space-y-2">
              {favoriteCoursesData.slice(0, 3).map((course) => (
                <div
                  key={course.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {course.name}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                      {course.stream} • {course.duration} years
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => handleViewItem('course', course.id)}
                      className={`p-1 rounded hover:bg-green-500/20 transition-colors ${
                        isDarkMode ? 'text-green-400 hover:text-green-300' : 'text-green-500 hover:text-green-600'
                      }`}
                      title="View course"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  <button
                      onClick={() => handleRemoveFavorite('course', course.id)}
                    className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                      isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                    }`}
                      title="Remove from favorites"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  </div>
                </div>
              ))}
              {favoriteCoursesData.length > 3 && (
                <div className={`text-xs text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  +{favoriteCoursesData.length - 3} more courses
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && favoriteCollegesData.length === 0 && favoriteCoursesData.length === 0 && (
          <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            <Heart className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
            <p className="text-sm">No favorites yet</p>
            <p className="text-xs mt-1">Start adding colleges and courses to your favorites!</p>
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
