'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Star, TrendingUp } from 'lucide-react';

interface MatchScoreProps {
  score: number;
  isCalculating: boolean;
  isDarkMode: boolean;
}

const MatchScore: React.FC<MatchScoreProps> = ({
  score,
  isCalculating,
  isDarkMode
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 80) return 'text-yellow-500';
    if (score >= 70) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent Match';
    if (score >= 80) return 'Great Match';
    if (score >= 70) return 'Good Match';
    return 'Fair Match';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <Star className="w-6 h-6" />;
    if (score >= 80) return <TrendingUp className="w-6 h-6" />;
    return <Zap className="w-6 h-6" />;
  };

  return (
    <motion.div
      className={`inline-flex items-center gap-4 px-8 py-4 rounded-2xl ${
        isDarkMode 
          ? 'bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30'
          : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
      } shadow-lg`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      {isCalculating ? (
        <>
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          <div>
            <div className={`text-lg font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Calculating Match Score...
            </div>
            <div className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Analyzing compatibility
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
            {score}%
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {getScoreIcon(score)}
              <span className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {getScoreLabel(score)}
              </span>
            </div>
            <div className={`text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              AI-Powered Compatibility Analysis
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default MatchScore;
