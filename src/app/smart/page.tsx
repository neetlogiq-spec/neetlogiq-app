'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Brain, Zap, Target, TrendingUp, Award, MessageSquare } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePremium } from '@/contexts/PremiumContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import SmartChat from '@/components/smart/SmartChat';
import PremiumGate from '@/components/premium/PremiumGate';
import { FEATURE_KEYS } from '@/config/premium';

const SmartPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isDarkMode } = useTheme();
  const { canUseFeature, incrementFeatureUsage } = usePremium();

  // Hero/Content transition state
  const [showContent, setShowContent] = useState(false);

  // Handle "Start Exploring" button click
  const handleStartExploring = () => {
    setShowContent(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background based on theme */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={1000}
          baseHue={200}
          rangeHue={160}
          baseSpeed={0.25}
          rangeSpeed={2.2}
          baseRadius={1}
          rangeRadius={3.5}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/20 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={500}
          baseHue={220}
          baseSpeed={0.15}
          rangeSpeed={1.8}
          baseRadius={2}
          rangeRadius={4.5}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-purple-50/30 to-pink-50/40 z-10"></div>
        </LightVortex>
      )}

      {/* Section 1: Hero Section */}
      <AnimatePresence mode="wait">
        {!showContent && (
          <motion.div
            key="hero"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-10 flex items-center justify-center"
          >
            {/* Floating AI Icons */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[
                { icon: Brain, color: 'from-purple-500 to-pink-500', delay: 0, x: 15, y: 20 },
                { icon: Zap, color: 'from-yellow-500 to-orange-500', delay: 1, x: 75, y: 30 },
                { icon: Target, color: 'from-green-500 to-teal-500', delay: 2, x: 25, y: 70 },
                { icon: TrendingUp, color: 'from-blue-500 to-cyan-500', delay: 3, x: 85, y: 60 },
                { icon: Award, color: 'from-red-500 to-pink-500', delay: 4, x: 50, y: 15 }
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={index}
                    className={`absolute ${
                      isDarkMode
                        ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                        : 'bg-white/30 backdrop-blur-sm border border-gray-200/50'
                    } rounded-2xl p-4`}
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`
                    }}
                    initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                    animate={{
                      opacity: [0, 1, 0.8, 1],
                      scale: [0.5, 1, 1.1, 1],
                      rotate: [-180, 0, 10, 0]
                    }}
                    transition={{
                      duration: 3,
                      delay: item.delay,
                      repeat: Infinity,
                      repeatDelay: 5
                    }}
                  >
                    <div className={`bg-gradient-to-br ${item.color} p-3 rounded-xl`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <main className="flex items-center justify-center px-4 sm:px-8 py-8 md:py-12 w-full relative z-20">
              <div className="text-center max-w-4xl">
                {/* Primary Hook */}
                <motion.div
                  className={`text-3xl md:text-4xl mb-2 font-medium transition-colors duration-300 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  AI That Actually Understands You
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
                  Smart Predictor
                </motion.h1>

                {/* Secondary Hook */}
                <motion.p
                  className={`text-xl md:text-2xl mb-8 max-w-2xl mx-auto transition-colors duration-300 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent'
                  }`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  Ask in Plain English. Get Precise Predictions.
                </motion.p>

                {/* Stats Row */}
                <motion.div
                  className="flex justify-center gap-8 mb-8"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                >
                  {[
                    { value: '10K+', label: 'Colleges Analyzed' },
                    { value: '95%', label: 'Accuracy Rate' },
                    { value: '24/7', label: 'AI Available' }
                  ].map((stat, index) => (
                    <div key={index} className={`${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {stat.value}
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </motion.div>

                {/* Call to Action */}
                <motion.div
                  className="mt-8"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  <motion.button
                    onClick={handleStartExploring}
                    className={`group px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 mx-auto ${
                      isDarkMode
                        ? 'bg-white/20 text-white border border-white/30 shadow-lg hover:bg-white/30'
                        : 'bg-gray-900 text-white border border-gray-800 shadow-lg hover:bg-gray-800'
                    }`}
                    whileHover={{
                      scale: 1.05,
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                    }}
                    whileTap={{
                      scale: 0.95,
                      boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <Sparkles className="w-5 h-5" />
                    </motion.div>
                    Start Chatting with AI
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </motion.div>

              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 2: Content Section */}
      <AnimatePresence mode="wait">
        {showContent && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-20 overflow-y-auto bg-white dark:bg-gray-900 pt-16"
          >
            {/* Chat Interface */}
            <motion.section
              className="py-4 px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.2, delay: 0.35 }}
            >
              <div className="max-w-7xl mx-auto">
                <motion.div
                  className="text-center mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.4 }}
                >
                  <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'
                  }`}>
                    AI-Powered College Predictions
                  </h2>
                  <p className={`text-lg max-w-2xl mx-auto ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent'
                  }`}>
                    Chat naturally and get instant, probability-based college recommendations
                  </p>
                </motion.div>

                {/* Chat Container */}
                <motion.div
                  className={`backdrop-blur-md rounded-2xl border-2 overflow-hidden ${
                    isDarkMode
                      ? 'bg-white/10 border-white/20 shadow-2xl'
                      : 'bg-white/80 border-gray-200/60 shadow-2xl'
                  }`}
                  style={{ height: 'calc(100vh - 320px)', minHeight: '600px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.45 }}
                >
                  <PremiumGate featureKey={FEATURE_KEYS.SMART_PREDICTIONS}>
                    <SmartChat />
                  </PremiumGate>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                  className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.5 }}
                >
                  {[
                    {
                      icon: MessageSquare,
                      title: 'Natural Language',
                      description: 'Ask in plain English',
                      gradient: 'from-blue-500 to-cyan-500'
                    },
                    {
                      icon: Target,
                      title: 'Probability Based',
                      description: 'Safe/Moderate/Reach categories',
                      gradient: 'from-purple-500 to-pink-500'
                    },
                    {
                      icon: Brain,
                      title: 'Context Aware',
                      description: 'Remembers your preferences',
                      gradient: 'from-green-500 to-teal-500'
                    },
                    {
                      icon: Zap,
                      title: 'Instant Results',
                      description: 'Real-time predictions',
                      gradient: 'from-orange-500 to-red-500'
                    }
                  ].map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <motion.div
                        key={index}
                        className={`backdrop-blur-sm rounded-xl border p-6 transition-all duration-300 hover:scale-105 ${
                          isDarkMode
                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                            : 'bg-white/60 border-gray-200/60 hover:bg-white/80'
                        }`}
                        whileHover={{ y: -5 }}
                      >
                        <div className={`inline-flex p-3 bg-gradient-to-br ${feature.gradient} rounded-xl mb-4`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {feature.title}
                        </h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {feature.description}
                        </p>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Example Queries */}
                <motion.div
                  className={`mt-8 backdrop-blur-sm rounded-2xl p-6 border ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-800/50'
                      : 'bg-gradient-to-r from-blue-50/80 to-purple-50/80 border-blue-200/50'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.55 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Try these example queries:
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      'What are my chances with NEET rank 5000?',
                      'Show me colleges for OBC category with rank under 10000',
                      'List government colleges in Delhi under 5 lakh fees',
                      'Compare AIIMS Delhi vs Maulana Azad Medical College',
                      'Which colleges have cutoff less than 2000?',
                      'Best ROI colleges for NEET rank 15000'
                    ].map((query, index) => (
                      <motion.div
                        key={index}
                        className={`flex items-center space-x-2 text-sm p-3 rounded-lg ${
                          isDarkMode
                            ? 'bg-white/5 hover:bg-white/10'
                            : 'bg-white/60 hover:bg-white/80'
                        } transition-colors cursor-pointer`}
                        whileHover={{ x: 5 }}
                      >
                        <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>→</span>
                        <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{query}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.section>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartPage;
