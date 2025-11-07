'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  Award, 
  BarChart3, 
  Target,
  Sparkles,
  ArrowRight,
  Zap,
  Building2,
  GraduationCap
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface QuickStatsProps {
  isDarkMode: boolean;
}

const QuickStats: React.FC<QuickStatsProps> = ({ isDarkMode }) => {
  const [stats, setStats] = useState({
    colleges: 0,
    records: 0,
    streams: 0
  });

  useEffect(() => {
    const animateStats = () => {
      setStats({
        colleges: 2117,
        records: 16208,
        streams: 3
      });
    };

    const timer = setTimeout(animateStats, 1000);
    return () => clearTimeout(timer);
  }, []);

  const statItems = [
    {
      icon: <Building2 className="w-5 h-5" />,
      value: stats.colleges.toLocaleString(),
      label: 'Colleges',
      color: 'text-blue-500'
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      value: stats.records.toLocaleString(),
      label: 'Records',
      color: 'text-green-500'
    },
    {
      icon: <GraduationCap className="w-5 h-5" />,
      value: stats.streams,
      label: 'Streams',
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

interface FloatingDataPointsProps {
  isDarkMode: boolean;
}

const FloatingDataPoints: React.FC<FloatingDataPointsProps> = ({ isDarkMode }) => {
  const dataPoints = [
    { rank: '9,532', trend: 'up', delay: 0 },
    { rank: '15,675', trend: 'down', delay: 1 },
    { rank: '2,847', trend: 'up', delay: 2 },
    { rank: '8,921', trend: 'stable', delay: 3 },
    { rank: '12,456', trend: 'up', delay: 4 }
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
            left: `${10 + index * 20}%`,
            top: `${20 + (index % 3) * 30}%`
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
            repeatDelay: 2
          }}
        >
          <div className="flex items-center gap-2">
            <span>{point.rank}</span>
            <TrendingUp 
              className={`w-3 h-3 ${
                point.trend === 'up' ? 'text-green-500' : 
                point.trend === 'down' ? 'text-red-500' : 'text-gray-500'
              }`}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

interface CutoffsHeroSectionProps {
  isDarkMode: boolean;
  isVisible: boolean;
  onStartExploring?: () => void;
}

const CutoffsHeroSection: React.FC<CutoffsHeroSectionProps> = ({ 
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
      {/* Floating Data Points */}
      <FloatingDataPoints isDarkMode={isDarkMode} />
      
      {/* Hero Content */}
      <div className="text-center max-w-6xl mx-auto relative z-10">
        {/* Primary Hook */}
        <motion.div
          className={`text-3xl md:text-4xl mb-2 font-medium transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Discover Your Perfect College
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
          Cutoff Analysis
        </motion.h1>

        {/* Secondary Hook */}
        <motion.p
          className={`text-xl md:text-2xl mb-2 max-w-3xl mx-auto transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' 
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
          }`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Find the exact cutoff ranks for 2,117+ colleges across India
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

export default CutoffsHeroSection;
