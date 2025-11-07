'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, GraduationCap, Award, Users } from 'lucide-react';

interface Cutoff {
  id: string;
  college: string;
  course: string;
  category: string;
  year: string;
  openingRank: number;
  closingRank: number;
  totalSeats: number;
  trend: 'up' | 'down' | 'stable';
  change: string;
  description: string;
}

interface CutoffCardProps {
  cutoff: Cutoff;
  index: number;
}

const CutoffCard: React.FC<CutoffCardProps> = ({ cutoff, index }) => {
  const getTrendIcon = () => {
    switch (cutoff.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (cutoff.trend) {
      case 'up':
        return 'text-red-600 dark:text-red-400';
      case 'down':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getCategoryColor = () => {
    switch (cutoff.category) {
      case 'General':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'OBC':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'SC':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'ST':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'EWS':
        return 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300';
      case 'PwD':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {cutoff.college}
            </h3>
            <div className="flex items-center space-x-2 mb-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600 dark:text-gray-300">{cutoff.course}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {cutoff.change}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor()}`}>
            {cutoff.category}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{cutoff.year}</span>
        </div>
      </div>

      {/* Rank Information */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {cutoff.openingRank}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Opening Rank</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
              {cutoff.closingRank}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Closing Rank</div>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 mb-4">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {cutoff.totalSeats} seats available
          </span>
        </div>

        {cutoff.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {cutoff.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <Award className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Rank Range: {cutoff.openingRank} - {cutoff.closingRank}
            </span>
          </div>
          <div className={`text-xs font-medium ${getTrendColor()}`}>
            {cutoff.trend === 'up' ? 'Increasing' : cutoff.trend === 'down' ? 'Decreasing' : 'Stable'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CutoffCard;
