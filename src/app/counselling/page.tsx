'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, FileText, Calendar, Download, CheckCircle2, AlertCircle, BookOpen, GraduationCap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Link from 'next/link';

const CounsellingPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isDarkMode } = useTheme();
  const [showContent, setShowContent] = useState(false);

  const handleStartExploring = () => {
    setShowContent(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const counsellingBodies = [
    {
      id: 'mcc',
      name: 'MCC',
      fullName: 'Medical Counselling Committee',
      description: 'All India Quota counselling for NEET UG/PG',
      icon: GraduationCap,
      gradient: 'from-blue-600 via-blue-500 to-cyan-500',
      stats: { colleges: '547', seats: '91,415', rounds: '4' },
      features: ['Seat Matrix', 'Round Schedule', 'Document Checklist', 'Important Dates']
    },
    {
      id: 'kea',
      name: 'KEA',
      fullName: 'Karnataka Examinations Authority',
      description: 'State quota counselling for Karnataka',
      icon: BookOpen,
      gradient: 'from-purple-600 via-purple-500 to-pink-500',
      stats: { colleges: '68', seats: '10,845', rounds: '3' },
      features: ['Seat Matrix', 'Round Schedule', 'Document Checklist', 'Important Dates']
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={900}
          baseHue={150}
          rangeHue={180}
          baseSpeed={0.2}
          rangeSpeed={2.0}
          baseRadius={1}
          rangeRadius={3}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/20 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={450}
          baseHue={180}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={2}
          rangeRadius={4}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 via-blue-50/20 to-purple-50/30 z-10"></div>
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
            {/* Floating Documents */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[
                { icon: FileText, color: 'from-blue-500 to-cyan-500', delay: 0, x: 10, y: 15 },
                { icon: Calendar, color: 'from-green-500 to-teal-500', delay: 1, x: 80, y: 25 },
                { icon: CheckCircle2, color: 'from-purple-500 to-pink-500', delay: 2, x: 20, y: 75 },
                { icon: Download, color: 'from-orange-500 to-red-500', delay: 3, x: 88, y: 65 },
                { icon: AlertCircle, color: 'from-yellow-500 to-orange-500', delay: 4, x: 50, y: 10 }
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
                    initial={{ opacity: 0, y: 20, rotate: -15 }}
                    animate={{
                      opacity: [0, 1, 0.9, 1],
                      y: [20, 0, -5, 0],
                      rotate: [-15, 0, 5, 0]
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
                      ? 'bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  Your Complete Counselling Companion
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
                  Counselling Hub
                </motion.h1>

                {/* Secondary Hook */}
                <motion.p
                  className={`text-xl md:text-2xl mb-8 max-w-2xl mx-auto transition-colors duration-300 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                  }`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  Everything You Need in One Place
                </motion.p>

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
                    Explore Counselling
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
            <motion.section
              className="py-8 px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.2, delay: 0.35 }}
            >
              <div className="max-w-7xl mx-auto">
                <motion.div
                  className="text-center mb-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.4 }}
                >
                  <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'
                  }`}>
                    Select Your Counselling Body
                  </h2>
                  <p className={`text-lg max-w-2xl mx-auto ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent'
                  }`}>
                    Access documents, schedules, and important dates for your counselling
                  </p>
                </motion.div>

                {/* Counselling Body Cards */}
                <motion.div
                  className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.45 }}
                >
                  {counsellingBodies.map((body, index) => {
                    const Icon = body.icon;
                    return (
                      <Link key={body.id} href={`/counselling/${body.id}`}>
                        <motion.div
                          className={`backdrop-blur-md rounded-2xl border-2 p-8 cursor-pointer transition-all duration-300 ${
                            isDarkMode
                              ? 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40'
                              : 'bg-white/80 border-gray-200/60 hover:bg-white/100 hover:border-gray-300'
                          }`}
                          whileHover={{ scale: 1.02, y: -5 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-6">
                            <div>
                              <div className={`inline-flex p-4 bg-gradient-to-br ${body.gradient} rounded-2xl mb-4`}>
                                <Icon className="w-8 h-8 text-white" />
                              </div>
                              <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {body.name}
                              </h3>
                              <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {body.fullName}
                              </p>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                {body.description}
                              </p>
                            </div>
                            <ArrowRight className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            {Object.entries(body.stats).map(([key, value]) => (
                              <div key={key} className={`text-center p-3 rounded-xl ${
                                isDarkMode ? 'bg-white/5' : 'bg-gray-100/80'
                              }`}>
                                <div className={`text-2xl font-bold bg-gradient-to-r ${body.gradient} bg-clip-text text-transparent`}>
                                  {value}
                                </div>
                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {key.charAt(0).toUpperCase() + key.slice(1)}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Features */}
                          <div className="grid grid-cols-2 gap-2">
                            {body.features.map((feature, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                                  isDarkMode ? 'bg-white/5' : 'bg-gray-50'
                                }`}
                              >
                                <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                                <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </Link>
                    );
                  })}
                </motion.div>

                {/* Info Section */}
                <motion.div
                  className={`backdrop-blur-sm rounded-2xl p-8 border ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-800/50'
                      : 'bg-gradient-to-r from-blue-50/80 to-purple-50/80 border-blue-200/50'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                  transition={{ duration: 0.2, delay: 0.5 }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                        <AlertCircle className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      </div>
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Important Information
                      </h3>
                      <ul className={`space-y-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <li className="flex items-start gap-2">
                          <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>•</span>
                          <span>All documents are updated regularly from official sources</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>•</span>
                          <span>Download seat matrices, schedules, and checklists for offline access</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>•</span>
                          <span>Set reminders for important dates and deadlines</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>•</span>
                          <span>Always verify information from official websites before counselling</span>
                        </li>
                      </ul>
                    </div>
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

export default CounsellingPage;
