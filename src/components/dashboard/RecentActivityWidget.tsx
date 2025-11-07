'use client';

import React from 'react';
import { Activity, Eye, Heart, Search, Plus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { UserPreferences } from '@/types/user';

interface RecentActivityWidgetProps {
  preferences: UserPreferences | null;
}

export default function RecentActivityWidget({ preferences }: RecentActivityWidgetProps) {
  const { isDarkMode } = useTheme();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'view_college':
      case 'view_course':
        return Eye;
      case 'add_favorite':
        return Heart;
      case 'add_watchlist':
        return Plus;
      case 'search':
        return Search;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'view_college':
      case 'view_course':
        return isDarkMode ? 'text-blue-400' : 'text-blue-500';
      case 'add_favorite':
        return isDarkMode ? 'text-red-400' : 'text-red-500';
      case 'add_watchlist':
        return isDarkMode ? 'text-green-400' : 'text-green-500';
      case 'search':
        return isDarkMode ? 'text-purple-400' : 'text-purple-500';
      default:
        return isDarkMode ? 'text-white/60' : 'text-gray-500';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const recentActivities = preferences?.recentActivity || [];

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
          Recent Activity
        </h3>
        <Activity className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
      </div>
      
      <div className="space-y-3">
        {recentActivities.length > 0 ? (
          recentActivities.slice(0, 8).map((activity) => {
            const IconComponent = getActivityIcon(activity.type);
            const iconColor = getActivityColor(activity.type);
            
            return (
              <div
                key={activity.id}
                className={`flex items-start space-x-3 p-2 rounded-lg ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`p-1 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <IconComponent className={`w-3 h-3 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {activity.title}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                    {activity.description}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'} mt-1`}>
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            <Activity className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-1">Start exploring colleges and courses!</p>
          </div>
        )}

        {recentActivities.length > 8 && (
          <div className={`text-xs text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            +{recentActivities.length - 8} more activities
          </div>
        )}
      </div>
    </div>
  );
}
