'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, Bell, BellOff, Trash2, Search, Filter, Calendar, MapPin, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { WatchlistItem } from '@/types/user';
import { College, Course } from '@/types';
import userPreferences from '@/services/userPreferences';
import CollegeDetailsModal from '@/components/modals/CollegeDetailsModal';

export default function WatchlistPage() {
  const { isDarkMode } = useTheme();
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'college' | 'course' | 'cutoff'>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Load watchlist data
  useEffect(() => {
    const loadWatchlistData = () => {
      setIsLoading(true);
      try {
        const preferences = userPreferences.getPreferences();
        setWatchlistItems(preferences.watchlistCutoffs || []);
      } catch (error) {
        console.error('Failed to load watchlist data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWatchlistData();
  }, []);

  const handleRemoveFromWatchlist = (itemId: string) => {
    userPreferences.removeFromWatchlist(itemId);
    setWatchlistItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleToggleAlert = (itemId: string, currentAlertEnabled: boolean) => {
    userPreferences.updateWatchlistAlert(itemId, !currentAlertEnabled);
    setWatchlistItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, alertEnabled: !currentAlertEnabled }
        : item
    ));
  };

  const handleViewItem = async (item: WatchlistItem) => {
    if (item.type === 'college') {
      // Open college modal
      setIsModalLoading(true);
      setIsModalOpen(true);
      
      try {
        const response = await fetch(`/api/fresh/colleges/${item.itemId}`);
        if (response.ok) {
          const result = await response.json();
          setSelectedCollege(result.data);
        } else {
          console.error('Failed to load college details');
          setIsModalOpen(false);
        }
      } catch (error) {
        console.error('Error loading college details:', error);
        setIsModalOpen(false);
      } finally {
        setIsModalLoading(false);
      }
    } else if (item.type === 'course') {
      // Navigate to course page
      window.location.href = `/courses?course=${item.itemId}`;
    } else {
      // For cutoffs, navigate to cutoffs page
      window.location.href = `/cutoffs?cutoff=${item.itemId}`;
    }
  };

  // Filter data based on search and type
  const filteredItems = watchlistItems.filter(item => 
    (filterType === 'all' || item.type === filterType) &&
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'college':
        return '🏫';
      case 'course':
        return '📚';
      case 'cutoff':
        return '📊';
      default:
        return '📋';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'college':
        return isDarkMode ? 'text-blue-400' : 'text-blue-500';
      case 'course':
        return isDarkMode ? 'text-green-400' : 'text-green-500';
      case 'cutoff':
        return isDarkMode ? 'text-purple-400' : 'text-purple-500';
      default:
        return isDarkMode ? 'text-gray-400' : 'text-gray-500';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'college':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'course':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'cutoff':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

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
              <Eye className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                My Watchlist
              </h1>
            </div>
            <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Track colleges, courses, and cutoffs with alerts
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
                    placeholder="Search watchlist..."
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
                  All ({filteredItems.length})
                </button>
                <button
                  onClick={() => setFilterType('college')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filterType === 'college'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🏫 Colleges ({watchlistItems.filter(item => item.type === 'college').length})
                </button>
                <button
                  onClick={() => setFilterType('course')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filterType === 'course'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📚 Courses ({watchlistItems.filter(item => item.type === 'course').length})
                </button>
                <button
                  onClick={() => setFilterType('cutoff')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    filterType === 'cutoff'
                      ? isDarkMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : isDarkMode
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📊 Cutoffs ({watchlistItems.filter(item => item.type === 'cutoff').length})
                </button>
              </div>
            </div>
          </motion.div>

          {/* Loading State */}
          {isLoading && (
            <div className={`text-center py-12 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg">Loading your watchlist...</p>
            </div>
          )}

          {/* Content */}
          {!isLoading && (
            <div className="space-y-6">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className={`p-6 rounded-2xl border-2 transition-all shadow-lg hover:shadow-xl ${
                      isDarkMode 
                        ? 'bg-white/10 border-white/20 hover:bg-white/15' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{getTypeIcon(item.type)}</span>
                          <div>
                            <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {item.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeBadgeColor(item.type)}`}>
                                {item.type.toUpperCase()}
                              </span>
                              {item.category && (
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  isDarkMode ? 'bg-white/20 text-white/80' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {item.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {item.state && (
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {item.state}
                              </span>
                            </div>
                          )}
                          {item.year && (
                            <div className="flex items-center gap-2">
                              <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {item.year}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              Added {new Date(item.addedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {item.lastCutoff && (
                          <div className={`p-3 rounded-lg ${
                            isDarkMode ? 'bg-white/5' : 'bg-gray-50'
                          }`}>
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Last Cutoff: {item.lastCutoff}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleAlert(item.id, item.alertEnabled)}
                          className={`p-3 rounded-lg transition-colors ${
                            item.alertEnabled
                              ? isDarkMode 
                                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' 
                                : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : isDarkMode 
                                ? 'bg-white/10 text-white/40 hover:bg-white/20' 
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title={item.alertEnabled ? 'Disable alerts' : 'Enable alerts'}
                        >
                          {item.alertEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                        </button>
                        
                        <button
                          onClick={() => handleViewItem(item)}
                          className={`p-3 rounded-lg transition-colors ${
                            isDarkMode 
                              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          }`}
                          title="View item"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        
                        <button
                          onClick={() => handleRemoveFromWatchlist(item.id)}
                          className={`p-3 rounded-lg transition-colors ${
                            isDarkMode 
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`text-center py-16 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}
                >
                  <Eye className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
                  <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    No items in watchlist
                  </h3>
                  <p className="text-lg mb-6">
                    {searchQuery ? 'No results found for your search.' : 'Start adding colleges, courses, or cutoffs to track them!'}
                  </p>
                  {!searchQuery && (
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <a
                        href="/colleges"
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                          isDarkMode
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        🏫 Browse Colleges
                      </a>
                      <a
                        href="/courses"
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                          isDarkMode
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        📚 Browse Courses
                      </a>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* College Details Modal */}
      {isModalOpen && selectedCollege && (
        <CollegeDetailsModal
          college={selectedCollege}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCollege(null);
          }}
          isLoading={isModalLoading}
        />
      )}
    </div>
  );
}
