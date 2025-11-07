'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Trophy, Users, Clock, Zap, Sparkles, ArrowRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';
import CollegeSelector from '@/components/compare/CollegeSelector';
import ComparisonResults from '@/components/compare/ComparisonResults';
import ProgressIndicator from '@/components/compare/ProgressIndicator';
import AchievementToast from '@/components/compare/AchievementToast';
import './compare.css';

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  established: number;
  logo?: string;
  courses: number;
  medicalCourses: number;
  dentalCourses: number;
  avgCutoff: number;
  totalSeats: number;
  acceptanceRate: number;
}

const ComparePage: React.FC = () => {
  const [selectedColleges, setSelectedColleges] = useState<College[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectionMethod, setSelectionMethod] = useState<'dropdown' | 'search'>('dropdown');
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [selectedManagement, setSelectedManagement] = useState<string>('all');
  const { isDarkMode } = useTheme();
  
  // Hero/Content transition state
  const [showContent, setShowContent] = useState(false);
  
  // Handle "Start Exploring" button click
  const handleStartExploring = () => {
    setShowContent(true);
  };

  const maxColleges = 4;
  const currentStep = selectedColleges.length + 1;
  const totalSteps = maxColleges + 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Achievement system
  useEffect(() => {
    if (selectedColleges.length === 2) {
      setAchievements(prev => [...prev, 'First Comparison!']);
    } else if (selectedColleges.length === 4) {
      setAchievements(prev => [...prev, 'Maximum Comparison!']);
    }
  }, [selectedColleges.length]);

  const handleCollegeSelect = (college: College, index: number) => {
    setSelectedColleges(prev => {
      const newColleges = [...prev];
      newColleges[index] = college;
      return newColleges;
    });
  };

  const handleCollegeRemove = (index: number) => {
    setSelectedColleges(prev => prev.filter((_, i) => i !== index));
  };

  const handleCompare = () => {
    if (selectedColleges.length >= 2) {
      setShowResults(true);
    }
  };

  const handleReset = () => {
    setSelectedColleges([]);
    setShowResults(false);
  };

  const handleFindMatch = () => {
    // TODO: Implement AI-powered college recommendation flow
    // This should open a questionnaire/quiz modal
    alert('Find My Match feature coming soon! This will help you discover colleges based on your preferences.');
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-indigo-50/20 to-purple-50/30 z-10"></div>
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
            <main className="flex items-center justify-center px-4 sm:px-8 py-8 md:py-12 w-full">
          <div className="text-center max-w-4xl">
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
              Stop Guessing. Start Comparing.
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
              Compare Colleges
            </motion.h1>

            {/* Secondary Hook */}
            <motion.p
              className={`text-xl md:text-2xl mb-8 max-w-2xl mx-auto transition-colors duration-300 ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent'
              }`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Compare up to 4 colleges side-by-side and find your perfect match
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
                Start Exploring
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
            {/* College Selection Interface */}
            <motion.section 
          className="py-8 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.2, delay: 0.35 }}
        >
          <div className="max-w-6xl mx-auto">
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
                Select Colleges to Compare
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent' 
                  : 'bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent'
              }`}>
                Choose up to 4 colleges to get detailed comparison
              </p>
            </motion.div>

            {/* External Filters */}
            <motion.div
              className={`backdrop-blur-md rounded-2xl p-6 border-2 mb-8 ${
                isDarkMode 
                  ? 'bg-white/10 border-white/20 shadow-lg' 
                  : 'bg-white/80 border-gray-200/60 shadow-lg'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.2, delay: 0.45 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stream Filter */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Stream
                  </label>
                  <select 
                    value={selectedStream}
                    onChange={(e) => setSelectedStream(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                        : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    <option value="all">All Streams</option>
                    <option value="medical">Medical</option>
                    <option value="dental">Dental</option>
                    <option value="ayush">AYUSH</option>
                  </select>
                </div>

                {/* Management Filter */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Management
                  </label>
                  <select 
                    value={selectedManagement}
                    onChange={(e) => setSelectedManagement(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                        : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    <option value="all">All Management</option>
                    <option value="government">Government</option>
                    <option value="private">Private</option>
                    <option value="deemed">Deemed</option>
                  </select>
                </div>
              </div>
            </motion.div>

            {/* College Selectors Grid - Progressive Selection */}
            <motion.div
              className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
                isDarkMode 
                  ? 'bg-white/10 border-white/20' 
                  : 'bg-white/80 border-gray-200/60'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.2, delay: 0.45 }}
            >
              <div className="relative">
                {/* Add Button - Positioned above right side cards when 2+ colleges selected */}
                {selectedColleges.length >= 2 && selectedColleges.length < maxColleges && (
                  <motion.div
                    className="flex justify-end mb-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.button
                      onClick={() => {
                        // This will trigger the search modal
                        const event = new CustomEvent('openSearch', { detail: { index: selectedColleges.length } });
                        window.dispatchEvent(event);
                      }}
                      className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                        isDarkMode 
                          ? 'bg-white/20 text-white border border-white/30 shadow-sm hover:bg-white/30' 
                          : 'bg-gray-900 text-white border border-gray-800 shadow-sm hover:bg-gray-800'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Plus className="w-4 h-4" />
                      Add College {selectedColleges.length + 1}
                    </motion.button>
                  </motion.div>
                )}

                {/* College Cards Grid - Always show at least 2 empty cards initially */}
                <div className={`grid gap-6 ${
                  selectedColleges.length <= 2 
                    ? 'grid-cols-1 md:grid-cols-2' 
                    : selectedColleges.length === 3
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                }`}>
                  {/* Show selected colleges */}
                  {selectedColleges.map((college, index) => (
                    <CollegeSelector
                      key={index}
                      index={index}
                      selectedCollege={college}
                      onSelect={(newCollege) => handleCollegeSelect(newCollege, index)}
                      onRemove={() => handleCollegeRemove(index)}
                      isDarkMode={isDarkMode}
                      selectionMethod={selectionMethod}
                      selectedStream={selectedStream}
                      selectedManagement={selectedManagement}
                    />
                  ))}
                  
                  {/* Show empty cards if we have less than 2 total */}
                  {selectedColleges.length < 2 && Array.from({ length: 2 - selectedColleges.length }, (_, index) => (
                    <CollegeSelector
                      key={`empty-${selectedColleges.length + index}`}
                      index={selectedColleges.length + index}
                      selectedCollege={undefined}
                      onSelect={(college) => handleCollegeSelect(college, selectedColleges.length + index)}
                      onRemove={() => {}}
                      isDarkMode={isDarkMode}
                      selectionMethod={selectionMethod}
                      selectedStream={selectedStream}
                      selectedManagement={selectedManagement}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              className="flex justify-center gap-4 mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.2, delay: 0.5 }}
            >
              <button
                onClick={handleCompare}
                disabled={selectedColleges.length < 2}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                  selectedColleges.length >= 2
                    ? isDarkMode 
                      ? 'bg-white/20 text-white border border-white/30 shadow-sm hover:bg-white/30' 
                      : 'bg-gray-900 text-white border border-gray-800 shadow-sm hover:bg-gray-800'
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Compare {selectedColleges.length} College{selectedColleges.length !== 1 ? 's' : ''}
                </div>
              </button>
              
              {selectedColleges.length > 0 && (
                <button
                  onClick={handleReset}
                  className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30' 
                      : 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <X className="w-5 h-5" />
                    Reset
                  </div>
                </button>
              )}
            </motion.div>
          </div>
        </motion.section>

      {/* Comparison Results */}
      <AnimatePresence>
        {showResults && selectedColleges.length >= 2 && (
          <ComparisonResults
            colleges={selectedColleges}
            onReset={handleReset}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>

        {/* Achievement Toasts */}
        <AnimatePresence>
          {achievements.map((achievement, index) => (
            <AchievementToast
              key={index}
              achievement={achievement}
              onClose={() => setAchievements(prev => prev.filter((_, i) => i !== index))}
            />
          ))}
        </AnimatePresence>

            {/* Footer */}
            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ComparePage;
