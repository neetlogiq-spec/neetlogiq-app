'use client';

import React from 'react';
import { Heart, Eye, Bell, Activity } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardStats } from '@/types/user';

interface QuickStatsWidgetProps {
  stats: DashboardStats | null;
}

export default function QuickStatsWidget({ stats }: QuickStatsWidgetProps) {
  const { isDarkMode } = useTheme();

  const statItems = [
    { icon: Heart, label: 'Favorites', value: stats?.totalFavorites || 0, color: 'text-red-500' },
    { icon: Eye, label: 'Watchlist', value: stats?.totalWatchlist || 0, color: 'text-blue-500' },
    { icon: Bell, label: 'Notifications', value: stats?.unreadNotifications || 0, color: 'text-orange-500' },
    { icon: Activity, label: 'Activities', value: stats?.recentActivity || 0, color: 'text-green-500' }
  ];

  return (
    <div
      className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${
        isDarkMode 
          ? 'bg-white/10 border-white/20 hover:bg-white/15 shadow-white/5' 
          : 'bg-white/80 border-gray-200/60 hover:bg-white shadow-gray-200/30'
      }`}
    >
      <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Quick Stats
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {statItems.map((item, index) => (
          <div
            key={item.label}
            className={`p-3 rounded-xl transition-colors ${
              isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/10' : 'bg-white'}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {item.value}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                  {item.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
