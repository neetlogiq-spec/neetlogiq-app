'use client';

import React from 'react';
import { TrendingUp, Users, BookOpen, Award, Clock, Target } from 'lucide-react';

interface QuickStatsProps {
  className?: string;
}

const QuickStats: React.FC<QuickStatsProps> = ({ className = '' }) => {
  const stats = [
    {
      icon: BookOpen,
      title: 'Total Colleges',
      value: '2,400+',
      change: '+12%',
      changeType: 'positive' as const,
      description: 'Medical & Dental colleges across India',
      color: 'blue'
    },
    {
      icon: Users,
      title: 'Active Students',
      value: '50,000+',
      change: '+8%',
      changeType: 'positive' as const,
      description: 'Students using our platform',
      color: 'green'
    },
    {
      icon: Award,
      title: 'Success Rate',
      value: '94%',
      change: '+2%',
      changeType: 'positive' as const,
      description: 'Students who got admission',
      color: 'purple'
    },
    {
      icon: TrendingUp,
      title: 'Cutoff Trends',
      value: 'Updated',
      change: 'Daily',
      changeType: 'neutral' as const,
      description: 'Real-time cutoff data',
      color: 'orange'
    },
    {
      icon: Clock,
      title: 'Response Time',
      value: '< 2s',
      change: 'Fast',
      changeType: 'positive' as const,
      description: 'Average search response',
      color: 'indigo'
    },
    {
      icon: Target,
      title: 'Accuracy',
      value: '99.9%',
      change: 'High',
      changeType: 'positive' as const,
      description: 'Data accuracy rate',
      color: 'red'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      orange: 'from-orange-500 to-orange-600',
      indigo: 'from-indigo-500 to-indigo-600',
      red: 'from-red-500 to-red-600'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getChangeColor = (changeType: 'positive' | 'negative' | 'neutral') => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg bg-gradient-to-r ${getColorClasses(stat.color)}`}>
              <stat.icon className="h-6 w-6 text-white" />
            </div>
            <div className={`text-sm font-medium ${getChangeColor(stat.changeType)}`}>
              {stat.change}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {stat.title}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {stat.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuickStats;

