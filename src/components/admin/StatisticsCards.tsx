'use client';

import React from 'react';
import {
  Building2,
  BarChart3,
  BookOpen,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign
} from 'lucide-react';

const StatisticsCards: React.FC = () => {
  const stats = [
    {
      name: 'Total Colleges',
      value: '2,442',
      change: '+12',
      changeType: 'increase',
      icon: Building2,
      color: 'blue',
      bgGradient: 'from-blue-500 to-blue-600',
      description: 'Medical & Dental'
    },
    {
      name: 'Cutoff Records',
      value: '16,284',
      change: '+156',
      changeType: 'increase',
      icon: BarChart3,
      color: 'purple',
      bgGradient: 'from-purple-500 to-purple-600',
      description: '2020-2024 data'
    },
    {
      name: 'Total Courses',
      value: '500',
      change: '+8',
      changeType: 'increase',
      icon: BookOpen,
      color: 'green',
      bgGradient: 'from-green-500 to-green-600',
      description: 'UG & PG programs'
    },
    {
      name: 'Active Users',
      value: '1,247',
      change: '+89',
      changeType: 'increase',
      icon: Users,
      color: 'orange',
      bgGradient: 'from-orange-500 to-orange-600',
      description: 'Last 30 days'
    },
    {
      name: 'Total Revenue',
      value: '₹2.4L',
      change: '+18%',
      changeType: 'increase',
      icon: DollarSign,
      color: 'emerald',
      bgGradient: 'from-emerald-500 to-emerald-600',
      description: 'This month'
    },
    {
      name: 'System Health',
      value: '99.8%',
      change: '+0.2%',
      changeType: 'increase',
      icon: Activity,
      color: 'cyan',
      bgGradient: 'from-cyan-500 to-cyan-600',
      description: 'Uptime'
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Statistics Overview
        </h2>
        <select className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
          <option>All time</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Background Gradient Blob */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.bgGradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}></div>

              {/* Content */}
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 bg-gradient-to-br ${stat.bgGradient} rounded-xl shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className={`flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                    stat.changeType === 'increase'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {stat.changeType === 'increase' ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {stat.change}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {stat.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatisticsCards;
