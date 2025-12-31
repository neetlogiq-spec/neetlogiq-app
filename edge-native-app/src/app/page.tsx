'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, MapPin, TrendingUp, Shield, Zap, BookOpen, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Vortex } from '@/components/ui/vortex';
import { LightVortex } from '@/components/ui/light-vortex';
import Footer from '@/components/ui/Footer';

const HomePage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Simulate loading delay for the opening animation
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    { icon: GraduationCap, value: '2,400+', label: 'Colleges Covered', color: 'text-blue-500' },
    { icon: MapPin, value: '28', label: 'States Covered', color: 'text-green-500' },
    { icon: Shield, value: 'Growing', label: 'Database', color: 'text-purple-500' },
    { icon: TrendingUp, value: '24/7', label: 'Support Available', color: 'text-orange-500' }
  ];

  const features = [
    {
      icon: Shield,
      title: 'Expert Guidance',
      description: 'Get personalized counseling advice from medical education experts'
    },
    {
      icon: Zap,
      title: 'Real-time Data',
      description: 'Access latest cutoff trends and admission statistics'
    },
    {
      icon: GraduationCap,
      title: 'Smart Matching',
      description: 'AI-powered college recommendations based on your profile'
    }
  ];

  return (
    <div className="relative overflow-hidden transition-all duration-500">
      {/* Dynamic Background based on theme */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={800}
          baseHue={280}
          rangeHue={120}
          baseSpeed={0.2}
          rangeSpeed={2.0}
          baseRadius={1}
          rangeRadius={3}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          {/* Subtle overlay for text readability without blocking particles */}
          <div className="absolute inset-0 bg-black/20 z-10"></div>
        </Vortex>
      ) : (
          <LightVortex
          className="fixed inset-0 z-0"
          particleCount={400}
          baseHue={200}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={2.5}
          rangeRadius={4}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          {/* Light overlay for text readability */}
          <div className="absolute inset-0 bg-linear-to-br from-blue-50/30 via-indigo-50/20 to-purple-50/30 z-10"></div>
        </LightVortex>
      )}

      {/* Content */}
      <div className="relative z-20">
        {/* Main Content */}
        <main className="flex items-center justify-center px-4 sm:px-8 py-16 md:py-24 min-h-[80vh]">
          <div className="text-center max-w-4xl">
            {/* Welcome Message */}
              <motion.div
              className={`text-3xl md:text-4xl mb-2 font-medium transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' 
                  : 'bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Welcome {user?.givenName || user?.displayName || user?.email?.split('@')[0] || 'there'} to
            </motion.div>

            {/* Main Title */}
            <motion.h1
              className={`text-6xl md:text-8xl font-bold mb-4 transition-colors duration-300 ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.8 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              NeetLogIQ
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className={`text-xl md:text-2xl mb-16 max-w-2xl mx-auto transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' 
                  : 'bg-linear-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Your Gateway to Medical Education Excellence
            </motion.p>

            {/* Action Cards */}
            <motion.div
              className="max-w-5xl mx-auto mb-20"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/colleges" className="group">
                   <div className="bg-linear-to-br from-blue-800 to-purple-600 hover:from-blue-900 hover:to-purple-700 text-white px-6 py-4 rounded-xl text-center transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center">
                     <div className="flex items-center space-x-2">
                       <GraduationCap className="w-5 h-5" />
                       <h3 className="text-lg font-semibold whitespace-nowrap">Explore Colleges</h3>
                    </div>
                    </div>
                </Link>
                
                <Link href="/courses" className="group">
                   <div className="bg-linear-to-br from-green-400 to-green-700 hover:from-green-500 hover:to-green-800 text-white px-6 py-4 rounded-xl text-center transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center">
                     <div className="flex items-center space-x-2">
                       <BookOpen className="w-5 h-5" />
                       <h3 className="text-lg font-semibold whitespace-nowrap">Browse Courses</h3>
                    </div>
                    </div>
                </Link>
                
                <Link href="/cutoffs" className="group">
                   <div className="bg-linear-to-br from-orange-400 to-orange-700 hover:from-orange-500 hover:to-orange-800 text-white px-6 py-4 rounded-xl text-center transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center">
                     <div className="flex items-center space-x-2">
                       <BarChart3 className="w-5 h-5" />
                       <h3 className="text-lg font-semibold whitespace-nowrap">Check Cutoffs</h3>
                    </div>
                    </div>
                </Link>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className={`w-20 h-20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${
                    isDarkMode ? 'bg-white/10 shadow-xl border border-white/20' : 'bg-white/70 shadow-xl border border-white/60'
                  }`}>
                    <stat.icon className={`w-10 h-10 ${stat.color}`} />
                  </div>
                  <div className={`text-3xl font-bold mb-2 transition-colors duration-300 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {stat.value}
                  </div>
                  <div className={`text-base transition-colors duration-300 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Data Source Note */}
            <motion.p
              className={`text-sm text-center mb-8 transition-colors duration-300 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: isLoaded ? 1 : 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              📊 All data sourced from official government and institutional sources
            </motion.p>

            {/* Features */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`backdrop-blur-sm p-6 rounded-2xl border transition-all duration-300 ${
                    isDarkMode ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/80 border-white/50 shadow-lg'
                  }`}
                >
                  <div className={`w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    isDarkMode ? 'bg-blue-500/20' : 'bg-blue-500/20'
                  }`}>
                    <feature.icon className={`w-8 h-8 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-500'
                    }`} />
                  </div>
                  <h3 className={`text-xl font-semibold mb-3 transition-colors duration-300 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {feature.title}
                  </h3>
                  <p className={`text-sm leading-relaxed transition-colors duration-300 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </main>

      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;