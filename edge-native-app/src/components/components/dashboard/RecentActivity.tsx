'use client';

import React from 'react';
import { Clock, Search, Eye, Heart, Share2, Bookmark } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'search' | 'view' | 'favorite' | 'share' | 'bookmark';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface RecentActivityProps {
  className?: string;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ className = '' }) => {
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'search',
      title: 'Searched for "AIIMS Delhi"',
      description: 'Found 15 colleges matching your criteria',
      timestamp: '2 minutes ago',
      icon: Search
    },
    {
      id: '2',
      type: 'view',
      title: 'Viewed MBBS Course Details',
      description: 'Maulana Azad Medical College - 5 year program',
      timestamp: '15 minutes ago',
      icon: Eye
    },
    {
      id: '3',
      type: 'favorite',
      title: 'Added to Favorites',
      description: 'All India Institute of Medical Sciences, New Delhi',
      timestamp: '1 hour ago',
      icon: Heart
    },
    {
      id: '4',
      type: 'bookmark',
      title: 'Bookmarked Cutoff Data',
      description: 'NEET 2024 Cutoffs - General Category',
      timestamp: '2 hours ago',
      icon: Bookmark
    },
    {
      id: '5',
      type: 'share',
      title: 'Shared College Information',
      description: 'King George Medical University, Lucknow',
      timestamp: '3 hours ago',
      icon: Share2
    }
  ];

  const getActivityIcon = (type: string) => {
    const iconMap = {
      search: Search,
      view: Eye,
      favorite: Heart,
      share: Share2,
      bookmark: Bookmark
    };
    return iconMap[type as keyof typeof iconMap] || Clock;
  };

  const getActivityColor = (type: string) => {
    const colorMap = {
      search: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
      view: 'text-green-600 bg-green-100 dark:bg-green-900/20',
      favorite: 'text-red-600 bg-red-100 dark:bg-red-900/20',
      share: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
      bookmark: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20'
    };
    return colorMap[type as keyof typeof colorMap] || 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Clock className="h-5 w-5 mr-2 text-blue-600" />
          Recent Activity
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Your recent searches and interactions
        </p>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {activities.map((activity) => {
            const IconComponent = getActivityIcon(activity.type);
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {activity.timestamp}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
            View All Activity
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;

