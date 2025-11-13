'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Eye, 
  Bell, 
  Activity, 
  Star, 
  TrendingUp, 
  BookOpen, 
  GraduationCap,
  Settings,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import userPreferences from '@/services/userPreferences';
import { DashboardStats, UserPreferences } from '@/types/user';

// Dashboard widget components
import QuickStatsWidget from '@/components/dashboard/QuickStatsWidget';
import FavoritesWidget from '@/components/dashboard/FavoritesWidget';
import WatchlistWidget from '@/components/dashboard/WatchlistWidget';
import RecommendationsWidget from '@/components/dashboard/RecommendationsWidget';
import RecentActivityWidget from '@/components/dashboard/RecentActivityWidget';
import ProgressTracker from '@/components/dashboard/ProgressTracker';
import UrgentActions from '@/components/dashboard/UrgentActions';
import SmartRecommendations from '@/components/dashboard/SmartRecommendations';
import InteractiveVisualizations from '@/components/dashboard/InteractiveVisualizations';

export default function DashboardPage() {
  const { isDarkMode } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    // Load user preferences and stats
    const prefs = userPreferences.getPreferences();
    const dashStats = userPreferences.getDashboardStats();
    
    setPreferences(prefs);
    setStats(dashStats);
    
    // Load real statistics from unified database
    loadRealStats();
    
    setIsLoaded(true);
  }, []);

  const loadRealStats = async () => {
    try {
      // Load real statistics from our unified database
      const statsResponse = await fetch('/api/fresh/stats');
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        
        // Update stats with real data
        setStats(prevStats => ({
          ...prevStats,
          totalColleges: statsData.data.totalColleges || 2442,
          totalCourses: statsData.data.totalCourses || 204,
          totalSeatRecords: statsData.data.totalSeatRecords || 16284,
          totalDnbAggregations: statsData.data.totalDnbAggregations || 3809
        }));
      }
    } catch (error) {
      console.error('Failed to load real stats:', error);
    }
  };

  const enabledWidgets = preferences?.dashboardWidgets.filter(w => w.enabled).sort((a, b) => a.position - b.position) || [];

  const renderWidget = (widget: any) => {
    switch (widget.type) {
      case 'quick_stats':
        return <QuickStatsWidget key={widget.id} stats={stats} />;
      case 'favorites':
        return <FavoritesWidget key={widget.id} preferences={preferences} />;
      case 'watchlist':
        return <WatchlistWidget key={widget.id} preferences={preferences} />;
      case 'recommendations':
        return <RecommendationsWidget key={widget.id} />;
      case 'recent_activity':
        return <RecentActivityWidget key={widget.id} preferences={preferences} />;
      case 'progress_tracker':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <ProgressTracker key={widget.id} />
          </div>
        );
      case 'urgent_actions':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <UrgentActions key={widget.id} maxItems={5} />
          </div>
        );
      case 'smart_recommendations':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <SmartRecommendations key={widget.id} maxRecommendations={3} />
          </div>
        );
      case 'interactive_visualizations':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <InteractiveVisualizations key={widget.id} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Simple Background */}
      <div className={`fixed inset-0 z-0 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}></div>

      {/* Content */}
      <div className="relative z-20 min-h-screen">
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="text-center mb-8">
              <h1 className={`text-4xl md:text-5xl font-bold font-geist mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                My Dashboard
              </h1>
              <p className={`text-lg ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                Welcome back{user?.displayName ? `, ${user.displayName}` : ''}! Here&apos;s your personalized medical education hub.
              </p>
            </div>
            
            <div className="flex justify-end mb-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-3 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'bg-white/10 hover:bg-white/20 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title="Dashboard Settings"
              >
                <Settings className="w-6 h-6" />
              </motion.button>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: GraduationCap, label: 'Explore Colleges', href: '/colleges', color: 'bg-blue-500' },
                { icon: BookOpen, label: 'Browse Courses', href: '/courses', color: 'bg-green-500' },
                { icon: TrendingUp, label: 'View Cutoffs', href: '/cutoffs', color: 'bg-orange-500' },
                { icon: Plus, label: 'Add to Watchlist', href: '/watchlist', color: 'bg-purple-500' }
              ].map((action, index) => (
                <Link key={action.label} href={action.href}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.9 }}
                    transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
                        : 'bg-white/80 border-gray-200/60 hover:bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${action.color} text-white`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {action.label}
                      </span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Dashboard Widgets Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {enabledWidgets.map((widget, index) => (
              <motion.div
                key={widget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                className={`${
                  widget.size === 'large' ? 'lg:col-span-2' : 
                  widget.size === 'small' ? 'lg:col-span-1' : 'lg:col-span-1'
                }`}
              >
                {renderWidget(widget)}
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {enabledWidgets.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className={`text-center py-16 rounded-2xl border-2 border-dashed ${
                isDarkMode
                  ? 'border-white/20 bg-white/5'
                  : 'border-gray-300 bg-gray-50/50'
              }`}
            >
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isDarkMode ? 'bg-white/10' : 'bg-gray-200'
              }`}>
                <Settings className={`w-8 h-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Customize Your Dashboard
              </h3>
              <p className={`text-base mb-6 max-w-md mx-auto ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                Add widgets to personalize your dashboard and track what matters most to you.
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Add Widgets
              </button>
            </motion.div>
          )}

          {/* Enhanced Dashboard Features - Always Visible */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 space-y-8"
          >
            {/* Progress & Actions Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <UrgentActions maxItems={5} />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <SmartRecommendations maxRecommendations={3} />
              </div>
            </div>

            {/* Full Width Sections */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <ProgressTracker />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <InteractiveVisualizations />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}