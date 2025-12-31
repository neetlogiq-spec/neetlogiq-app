'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Search, BarChart, GitCompare, Heart, Brain, BookOpen, TrendingUp, GraduationCap, Smartphone, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

const MobileDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to NeetLogIQ
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sign in to access your personalized dashboard and coding assistant.
          </p>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      name: 'Search',
      href: '/search',
      icon: Search,
      color: 'blue',
      description: 'Find colleges & courses'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart,
      color: 'green',
      description: 'View insights & trends'
    },
    {
      name: 'Compare',
      href: '/comparison',
      icon: GitCompare,
      color: 'purple',
      description: 'Compare colleges'
    },
    {
      name: 'Favorites',
      href: '/favorites',
      icon: Heart,
      color: 'red',
      description: 'Saved items'
    },
    {
      name: 'Recommendations',
      href: '/recommendations',
      icon: Brain,
      color: 'orange',
      description: 'AI suggestions'
    }
  ];

  const dataSections = [
    {
      name: 'Colleges',
      href: '/colleges',
      icon: GraduationCap,
      count: '2,400+',
      color: 'pink'
    },
    {
      name: 'Courses',
      href: '/courses',
      icon: BookOpen,
      count: '16,830+',
      color: 'indigo'
    },
    {
      name: 'Cutoffs',
      href: '/cutoffs',
      icon: TrendingUp,
      count: '45,600+',
      color: 'teal'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
      purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
      red: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
      orange: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400',
      indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400',
      pink: 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400',
      teal: 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user.displayName || user.name || user.email?.split('@')[0] || 'User'}!
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your medical education journey
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {(user.displayName || user.name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.name}
                  href={action.href}
                  className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`p-3 rounded-lg mb-3 ${getColorClasses(action.color)}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                      {action.name}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {action.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Data Overview */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Overview
          </h2>
          <div className="space-y-3">
            {dataSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.name}
                  href={section.href}
                  className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${getColorClasses(section.color)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {section.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {section.count} available
                        </p>
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    AIIMS Delhi MBBS cutoff updated
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    2 hours ago
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    New medical college added
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    1 day ago
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    Course details updated
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    2 days ago
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;
