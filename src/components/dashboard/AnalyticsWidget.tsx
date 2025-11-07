'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Eye, 
  Clock, 
  Search, 
  Download,
  Calendar,
  Filter,
  ChevronDown,
  Info,
  RefreshCw
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataCache } from '@/hooks/useDataCache';

interface AnalyticsData {
  totalSearches: number;
  uniqueUsers: number;
  pageViews: number;
  avgSessionDuration: string;
  topPages: Array<{ page: string; views: number; percentage: number }>;
  topSearches: Array<{ query: string; count: number; percentage: number }>;
  userActivity: Array<{ date: string; activeUsers: number }>;
  deviceBreakdown: Array<{ device: string; count: number; percentage: number }>;
  performanceMetrics: {
    avgLoadTime: number;
    bounceRate: number;
    conversionRate: number;
  };
}

interface AnalyticsWidgetProps {
  className?: string;
}

const AnalyticsWidget: React.FC<AnalyticsWidgetProps> = ({ className = '' }) => {
  const { isDarkMode } = useTheme();
  const { getCachedData } = useDataCache<AnalyticsData>();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d'); // 7d, 30d, 90d
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const data = await getCachedData(
        `analytics_${dateRange}`,
        async () => {
          // In a real app, this would be an API call
          // For now, we'll use mock data
          return getMockAnalyticsData(dateRange);
        },
        { ttl: 5 * 60 * 1000 } // 5 minutes cache
      );
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  // Refresh analytics
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
  };
  
  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);
  
  // Mock analytics data generator
  const getMockAnalyticsData = (range: string): AnalyticsData => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const multiplier = days / 7;
    
    return {
      totalSearches: Math.floor(1234 * multiplier),
      uniqueUsers: Math.floor(567 * multiplier),
      pageViews: Math.floor(8901 * multiplier),
      avgSessionDuration: '3m 42s',
      topPages: [
        { page: '/colleges', views: Math.floor(2341 * multiplier), percentage: 26.3 },
        { page: '/cutoffs', views: Math.floor(1876 * multiplier), percentage: 21.1 },
        { page: '/courses', views: Math.floor(1543 * multiplier), percentage: 17.3 },
        { page: '/trends', views: Math.floor(1234 * multiplier), percentage: 13.9 },
        { page: '/compare', views: Math.floor(987 * multiplier), percentage: 11.1 }
      ],
      topSearches: [
        { query: 'AIIMS Delhi', count: Math.floor(234 * multiplier), percentage: 18.9 },
        { query: 'MBBS cutoff', count: Math.floor(187 * multiplier), percentage: 15.2 },
        { query: 'medical colleges', count: Math.floor(156 * multiplier), percentage: 12.6 },
        { query: 'NEET PG', count: Math.floor(134 * multiplier), percentage: 10.9 },
        { query: 'BDS colleges', count: Math.floor(98 * multiplier), percentage: 7.9 }
      ],
      userActivity: Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        activeUsers: Math.floor(Math.random() * 100 + 50)
      })).reverse(),
      deviceBreakdown: [
        { device: 'Desktop', count: Math.floor(4567 * multiplier), percentage: 65.2 },
        { device: 'Mobile', count: Math.floor(2134 * multiplier), percentage: 30.4 },
        { device: 'Tablet', count: Math.floor(321 * multiplier), percentage: 4.6 }
      ],
      performanceMetrics: {
        avgLoadTime: 1.2,
        bounceRate: 32.4,
        conversionRate: 8.7
      }
    };
  };
  
  if (isLoading && !analytics) {
    return (
      <div className={`backdrop-blur-md p-6 rounded-2xl border-2 ${className} ${
        isDarkMode 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white/80 border-gray-200/60'
      }`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`backdrop-blur-md p-6 rounded-2xl border-2 ${className} ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
      }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Analytics Dashboard
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-white/10 text-white hover:bg-white/20' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'Last 90 days'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
            
            {showDetails && (
              <div className={`absolute top-full right-0 mt-1 w-40 rounded-lg shadow-lg border z-10 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}>
                {['7d', '30d', '90d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setShowDetails(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 ${
                      dateRange === range 
                        ? isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : ''
                    }`}
                  >
                    {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-lg transition-colors ${
              refreshing 
                ? 'opacity-50 cursor-not-allowed' 
                : isDarkMode 
                  ? 'text-gray-400 hover:bg-white/10 hover:text-white' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <Search className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Searches</span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {analytics?.totalSearches.toLocaleString()}
          </div>
        </div>
        
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <Users className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Unique Users</span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {analytics?.uniqueUsers.toLocaleString()}
          </div>
        </div>
        
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <Eye className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Page Views</span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {analytics?.pageViews.toLocaleString()}
          </div>
        </div>
        
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <Clock className={`w-4 h-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Avg. Session</span>
          </div>
          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {analytics?.avgSessionDuration}
          </div>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div>
          <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Top Pages
          </h4>
          <div className="space-y-2">
            {analytics?.topPages.map((page, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                    index === 0 ? 'bg-blue-500 text-white' :
                    index === 1 ? 'bg-green-500 text-white' :
                    index === 2 ? 'bg-purple-500 text-white' :
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {page.page}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {page.views.toLocaleString()}
                  </span>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    ({page.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Searches */}
        <div>
          <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Top Searches
          </h4>
          <div className="space-y-2">
            {analytics?.topSearches.map((search, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                    index === 0 ? 'bg-blue-500 text-white' :
                    index === 1 ? 'bg-green-500 text-white' :
                    index === 2 ? 'bg-purple-500 text-white' :
                    isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {search.query}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {search.count.toLocaleString()}
                  </span>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    ({search.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Performance Metrics */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Performance Metrics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg Load Time</span>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.performanceMetrics.avgLoadTime}s
              </span>
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Bounce Rate</span>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.performanceMetrics.bounceRate}%
              </span>
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Conversion Rate</span>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {analytics?.performanceMetrics.conversionRate}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Export Button */}
      <div className="mt-6 flex justify-end">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isDarkMode 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>
    </div>
  );
};

export default AnalyticsWidget;

