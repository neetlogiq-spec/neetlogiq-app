'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  BarChart3, 
  Sparkles,
  ArrowRight,
  Target,
  Calendar,
  Award
} from 'lucide-react';

interface QuickStatsProps {
  isDarkMode: boolean;
}

const QuickStats: React.FC<QuickStatsProps> = ({ isDarkMode }) => {
  const [stats, setStats] = useState({
    ranks: 0,
    rounds: 0,
    upgrades: 0
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats({
        ranks: 7105,
        rounds: 5,
        upgrades: 1338
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const statItems = [
    {
      icon: <Target className="w-5 h-5" />,
      value: stats.ranks.toLocaleString(),
      label: 'Tracked Ranks',
      color: 'text-blue-500'
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      value: stats.rounds,
      label: 'Rounds',
      color: 'text-green-500'
    },
    {
      icon: <Award className="w-5 h-5" />,
      value: stats.upgrades.toLocaleString(),
      label: 'Upgrades',
      color: 'text-purple-500'
    }
  ];

  return (
    <motion.div 
      className="flex justify-center gap-8 mt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6 }}
    >
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          className="flex items-center gap-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
        >
          <div className={`${item.color} ${isDarkMode ? 'text-opacity-80' : 'text-opacity-70'}`}>
            {item.icon}
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {item.value}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {item.label}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

interface FloatingRankPointsProps {
  isDarkMode: boolean;
}

const FloatingRankPoints: React.FC<FloatingRankPointsProps> = ({ isDarkMode }) => {
  const dataPoints = [
    { rank: '381', action: 'UPGRADED', delay: 0 },
    { rank: '223', action: 'FREEZE', delay: 1.5 },
    { rank: '1,500', action: 'ALLOTTED', delay: 3 },
    { rank: '492', action: 'UPGRADED', delay: 4.5 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dataPoints.map((point, index) => (
        <motion.div
          key={index}
          className={`absolute ${
            isDarkMode 
              ? 'bg-white/10 backdrop-blur-sm border border-white/20' 
              : 'bg-white/20 backdrop-blur-sm border border-gray-200'
          } rounded-lg px-3 py-2 text-sm font-medium ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}
          style={{
            left: `${15 + index * 22}%`,
            top: `${25 + (index % 2) * 35}%`
          }}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ 
            opacity: [0, 1, 0.8, 1],
            y: [20, 0, -10, 0],
            scale: [0.8, 1, 1.1, 1]
          }}
          transition={{
            duration: 3,
            delay: point.delay,
            repeat: Infinity,
            repeatDelay: 3
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono">#{point.rank}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              point.action === 'UPGRADED' 
                ? 'bg-green-500/20 text-green-400' 
                : point.action === 'FREEZE'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-500/20 text-slate-400'
            }`}>
              {point.action}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

interface RankTrackingHeroProps {
  isDarkMode: boolean;
  isVisible: boolean;
  onStartExploring?: () => void;
}

const RankTrackingHero: React.FC<RankTrackingHeroProps> = ({ 
  isDarkMode, 
  isVisible,
  onStartExploring
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.section
      className={`hero-section relative h-screen flex items-center justify-center px-4 sm:px-8 py-8 md:py-12 ${
        !isVisible ? 'opacity-0 pointer-events-none' : ''
      }`}
      initial={{ opacity: 1 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Floating Rank Points */}
      <FloatingRankPoints isDarkMode={isDarkMode} />
      
      {/* Hero Content */}
      <div className="text-center max-w-6xl mx-auto relative z-10">
        {/* Primary Hook */}
        <motion.div
          className={`text-3xl md:text-4xl mb-2 font-medium transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent' 
              : 'bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Track Your Rank Journey
        </motion.div>

        {/* Main Title */}
        <motion.h1
          className={`text-6xl md:text-8xl font-bold mb-2 transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.8 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Rank Tracking
        </motion.h1>

        {/* Secondary Hook */}
        <motion.p
          className={`text-xl md:text-2xl mb-2 max-w-3xl mx-auto transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
          }`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          See how any rank was allocated across all counselling rounds
        </motion.p>

        {/* Quick Stats */}
        <QuickStats isDarkMode={isDarkMode} />

        {/* Call to Action */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <motion.button
            onClick={onStartExploring}
            className={`group px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 mx-auto ${
              isDarkMode 
                ? 'bg-white/20 text-white border border-white/30 shadow-lg hover:bg-white/30' 
                : 'bg-gray-900 text-white border border-gray-800 shadow-lg hover:bg-gray-800'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="w-5 h-5" />
            Start Exploring
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <motion.div
            className={`w-6 h-10 border-2 rounded-full flex justify-center ${
              isDarkMode ? 'border-white/30' : 'border-gray-400'
            }`}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className={`w-1 h-3 rounded-full mt-2 ${
                isDarkMode ? 'bg-white/60' : 'bg-gray-600'
              }`}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default RankTrackingHero;
