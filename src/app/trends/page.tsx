'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Users, TrendingUp, Award, Zap, Sparkles, ArrowRight, Target } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/contexts/PremiumContext';
import PremiumGate from '@/components/premium/PremiumGate';
import { FEATURE_KEYS } from '@/config/premium';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import { useAvailableYears, useYearOptions } from '@/hooks/useAvailableYears';
import './trends.css';

const TrendsPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isDarkMode } = useTheme();
  const { isAuthenticated } = useAuth();
  
  // Hero/Content transition state
  const [showContent, setShowContent] = useState(false);
  
  // Handle "Start Exploring" button click
  const handleStartExploring = () => {
    setShowContent(true);
  };
  
  // Use dynamic year detection
  const { availableYears, yearData, latestYear, loading: yearsLoading } = useAvailableYears();
  const [selectedYear, setSelectedYear] = useState('');
  
  // Get available options for the selected year
  const { counsellingBodies, levels, rounds } = useYearOptions(selectedYear);
  
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [comparisonType, setComparisonType] = useState<'colleges' | 'years'>('colleges');
  const [selectedRounds, setSelectedRounds] = useState<number[]>([1, 2]);
  const [selectedQuota, setSelectedQuota] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCollegeA, setSelectedCollegeA] = useState<string>('');
  const [selectedCollegeB, setSelectedCollegeB] = useState<string>('');
  const [selectedYearA, setSelectedYearA] = useState<string>('');
  const [selectedYearB, setSelectedYearB] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedStateA, setSelectedStateA] = useState<string>('all');
  const [selectedStateB, setSelectedStateB] = useState<string>('all');
  const [selectionMethod, setSelectionMethod] = useState<'dropdown' | 'search'>('dropdown');
  const [searchTermA, setSearchTermA] = useState<string>('');
  const [searchTermB, setSearchTermB] = useState<string>('');
  const [showSuggestionsA, setShowSuggestionsA] = useState<boolean>(false);
  const [showSuggestionsB, setShowSuggestionsB] = useState<boolean>(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  // Set default year when available years are loaded
  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(latestYear);
    }
    
    if (availableYears.length > 0 && !selectedYearA) {
      setSelectedYearA(latestYear);
    }
    
    if (availableYears.length > 1 && !selectedYearB) {
      // Set second year to the next available year
      const secondYearIndex = availableYears.findIndex(year => year !== latestYear);
      if (secondYearIndex !== -1) {
        setSelectedYearB(availableYears[secondYearIndex]);
      }
    }
  }, [availableYears, latestYear, selectedYear, selectedYearA, selectedYearB]);

  // Set default rounds when available
  useEffect(() => {
    if (rounds.length > 0) {
      // Ensure selected rounds are available
      const validRounds = selectedRounds.filter(round => rounds.includes(round));
      if (validRounds.length === 0 && rounds.length > 0) {
        setSelectedRounds([rounds[0]]);
      } else if (validRounds.length !== selectedRounds.length) {
        setSelectedRounds(validRounds);
      }
    }
  }, [rounds, selectedRounds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Mock data
  const mockColleges = [
    { id: '1', name: 'AIIMS Delhi', state: 'Delhi' },
    { id: '2', name: 'JIPMER Puducherry', state: 'Puducherry' },
    { id: '3', name: 'KGMU Lucknow', state: 'Uttar Pradesh' },
    { id: '4', name: 'MAMC Delhi', state: 'Delhi' },
    { id: '5', name: 'Grant Medical College', state: 'Maharashtra' }
  ];

  const mockCourses = [
    { id: '1', name: 'MBBS' },
    { id: '2', name: 'MD Medicine' },
    { id: '3', name: 'MS Surgery' },
    { id: '4', name: 'BDS' },
    { id: '5', name: 'MDS Orthodontics' }
  ];

  const mockTrendData = {
    '1': { // AIIMS Delhi
      '1': { // MBBS
        '2024': {
          '1': { 'General': { 'AIQ': 50, 'State': 0 }, 'OBC': { 'AIQ': 27, 'State': 0 }, 'SC': { 'AIQ': 15, 'State': 0 }, 'ST': { 'AIQ': 8, 'State': 0 } },
          '2': { 'General': { 'AIQ': 52, 'State': 0 }, 'OBC': { 'AIQ': 28, 'State': 0 }, 'SC': { 'AIQ': 16, 'State': 0 }, 'ST': { 'AIQ': 9, 'State': 0 } },
          '3': { 'General': { 'AIQ': 55, 'State': 0 }, 'OBC': { 'AIQ': 30, 'State': 0 }, 'SC': { 'AIQ': 18, 'State': 0 }, 'ST': { 'AIQ': 10, 'State': 0 } },
          '4': { 'General': { 'AIQ': 58, 'State': 0 }, 'OBC': { 'AIQ': 32, 'State': 0 }, 'SC': { 'AIQ': 20, 'State': 0 }, 'ST': { 'AIQ': 12, 'State': 0 } },
          '5': { 'General': { 'AIQ': 60, 'State': 0 }, 'OBC': { 'AIQ': 35, 'State': 0 }, 'SC': { 'AIQ': 22, 'State': 0 }, 'ST': { 'AIQ': 15, 'State': 0 } }
        },
        '2023': {
          '1': { 'General': { 'AIQ': 48, 'State': 0 }, 'OBC': { 'AIQ': 25, 'State': 0 }, 'SC': { 'AIQ': 14, 'State': 0 }, 'ST': { 'AIQ': 7, 'State': 0 } },
          '2': { 'General': { 'AIQ': 50, 'State': 0 }, 'OBC': { 'AIQ': 26, 'State': 0 }, 'SC': { 'AIQ': 15, 'State': 0 }, 'ST': { 'AIQ': 8, 'State': 0 } },
          '3': { 'General': { 'AIQ': 53, 'State': 0 }, 'OBC': { 'AIQ': 28, 'State': 0 }, 'SC': { 'AIQ': 17, 'State': 0 }, 'ST': { 'AIQ': 9, 'State': 0 } },
          '4': { 'General': { 'AIQ': 56, 'State': 0 }, 'OBC': { 'AIQ': 30, 'State': 0 }, 'SC': { 'AIQ': 19, 'State': 0 }, 'ST': { 'AIQ': 11, 'State': 0 } },
          '5': { 'General': { 'AIQ': 58, 'State': 0 }, 'OBC': { 'AIQ': 33, 'State': 0 }, 'SC': { 'AIQ': 21, 'State': 0 }, 'ST': { 'AIQ': 14, 'State': 0 } }
        }
      }
    },
    '2': { // JIPMER Puducherry
      '1': { // MBBS
        '2024': {
          '1': { 'General': { 'AIQ': 150, 'State': 0 }, 'OBC': { 'AIQ': 81, 'State': 0 }, 'SC': { 'AIQ': 45, 'State': 0 }, 'ST': { 'AIQ': 24, 'State': 0 } },
          '2': { 'General': { 'AIQ': 155, 'State': 0 }, 'OBC': { 'AIQ': 84, 'State': 0 }, 'SC': { 'AIQ': 48, 'State': 0 }, 'ST': { 'AIQ': 27, 'State': 0 } },
          '3': { 'General': { 'AIQ': 160, 'State': 0 }, 'OBC': { 'AIQ': 87, 'State': 0 }, 'SC': { 'AIQ': 51, 'State': 0 }, 'ST': { 'AIQ': 30, 'State': 0 } },
          '4': { 'General': { 'AIQ': 165, 'State': 0 }, 'OBC': { 'AIQ': 90, 'State': 0 }, 'SC': { 'AIQ': 54, 'State': 0 }, 'ST': { 'AIQ': 33, 'State': 0 } },
          '5': { 'General': { 'AIQ': 170, 'State': 0 }, 'OBC': { 'AIQ': 93, 'State': 0 }, 'SC': { 'AIQ': 57, 'State': 0 }, 'ST': { 'AIQ': 36, 'State': 0 } }
        },
        '2023': {
          '1': { 'General': { 'AIQ': 145, 'State': 0 }, 'OBC': { 'AIQ': 78, 'State': 0 }, 'SC': { 'AIQ': 42, 'State': 0 }, 'ST': { 'AIQ': 21, 'State': 0 } },
          '2': { 'General': { 'AIQ': 150, 'State': 0 }, 'OBC': { 'AIQ': 81, 'State': 0 }, 'SC': { 'AIQ': 45, 'State': 0 }, 'ST': { 'AIQ': 24, 'State': 0 } },
          '3': { 'General': { 'AIQ': 155, 'State': 0 }, 'OBC': { 'AIQ': 84, 'State': 0 }, 'SC': { 'AIQ': 48, 'State': 0 }, 'ST': { 'AIQ': 27, 'State': 0 } },
          '4': { 'General': { 'AIQ': 160, 'State': 0 }, 'OBC': { 'AIQ': 87, 'State': 0 }, 'SC': { 'AIQ': 51, 'State': 0 }, 'ST': { 'AIQ': 30, 'State': 0 } },
          '5': { 'General': { 'AIQ': 165, 'State': 0 }, 'OBC': { 'AIQ': 90, 'State': 0 }, 'SC': { 'AIQ': 54, 'State': 0 }, 'ST': { 'AIQ': 33, 'State': 0 } }
        }
      }
    }
  };

  const quotaOptions = [
    { value: 'all', label: 'All Quotas' },
    { value: 'AIQ', label: 'AIQ' },
    { value: 'State', label: 'State' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'General', label: 'General' },
    { value: 'OBC', label: 'OBC' },
    { value: 'SC', label: 'SC' },
    { value: 'ST', label: 'ST' }
  ];

  // Get stream options based on available levels
  const getStreamOptions = () => {
    const options = [{ value: 'all', label: 'All Streams' }];
    
    if (levels.includes('UG')) {
      options.push({ value: 'medical', label: 'Medical' });
      options.push({ value: 'dental', label: 'Dental' });
    }
    
    if (levels.includes('PG')) {
      options.push({ value: 'medical', label: 'Medical PG' });
    }
    
    if (levels.includes('DEN')) {
      options.push({ value: 'dental', label: 'Dental PG' });
    }
    
    return options;
  };

  const stateOptions = [
    { value: 'all', label: 'All States' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'tamil-nadu', label: 'Tamil Nadu' },
    { value: 'kerala', label: 'Kerala' },
    { value: 'west-bengal', label: 'West Bengal' },
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'rajasthan', label: 'Rajasthan' },
    { value: 'uttar-pradesh', label: 'Uttar Pradesh' },
    { value: 'andhra-pradesh', label: 'Andhra Pradesh' },
    { value: 'telangana', label: 'Telangana' },
    { value: 'punjab', label: 'Punjab' },
    { value: 'haryana', label: 'Haryana' },
    { value: 'himachal-pradesh', label: 'Himachal Pradesh' },
    { value: 'jammu-kashmir', label: 'Jammu & Kashmir' },
    { value: 'uttarakhand', label: 'Uttarakhand' },
    { value: 'bihar', label: 'Bihar' },
    { value: 'jharkhand', label: 'Jharkhand' },
    { value: 'odisha', label: 'Odisha' },
    { value: 'chhattisgarh', label: 'Chhattisgarh' },
    { value: 'madhya-pradesh', label: 'Madhya Pradesh' },
    { value: 'assam', label: 'Assam' },
    { value: 'manipur', label: 'Manipur' },
    { value: 'meghalaya', label: 'Meghalaya' },
    { value: 'mizoram', label: 'Mizoram' },
    { value: 'nagaland', label: 'Nagaland' },
    { value: 'sikkim', label: 'Sikkim' },
    { value: 'tripura', label: 'Tripura' },
    { value: 'arunachal-pradesh', label: 'Arunachal Pradesh' },
    { value: 'goa', label: 'Goa' },
    { value: 'puducherry', label: 'Puducherry' },
    { value: 'andaman-nicobar', label: 'Andaman & Nicobar' },
    { value: 'chandigarh', label: 'Chandigarh' },
    { value: 'dadra-nagar-haveli', label: 'Dadra & Nagar Haveli' },
    { value: 'daman-diu', label: 'Daman & Diu' },
    { value: 'lakshadweep', label: 'Lakshadweep' }
  ];

  const addRound = () => {
    if (selectedRounds.length < 5 && rounds.length > selectedRounds.length) {
      const availableRounds = rounds.filter(round => !selectedRounds.includes(round));
      if (availableRounds.length > 0) {
        setSelectedRounds([...selectedRounds, availableRounds[0]]);
      }
    }
  };

  const removeRound = (round: number) => {
    if (selectedRounds.length > 2 && round > 2) {
      setSelectedRounds(selectedRounds.filter(r => r !== round));
    }
  };

  const resetFilters = () => {
    setSelectedCollege('');
    setSelectedCourse('');
    setSelectedYear(latestYear);
    setSelectedRounds(rounds.length > 0 ? [rounds[0]] : [1]);
    setSelectedQuota('all');
    setSelectedCategory('all');
    setSelectedCollegeA('');
    setSelectedCollegeB('');
    setSelectedYearA(latestYear);
    setSelectedYearB(availableYears.length > 1 ? availableYears[1] : latestYear);
    setSelectedStream('all');
    setSelectedState('all');
    setSelectedStateA('all');
    setSelectedStateB('all');
    setSearchTermA('');
    setSearchTermB('');
    setShowSuggestionsA(false);
    setShowSuggestionsB(false);
  };

  // Function to get filtered colleges based on state and stream
  const getFilteredColleges = (state: string, stream: string) => {
    return mockColleges.filter(college => {
      const stateMatch = state === 'all' || college.state.toLowerCase().replace(/\s+/g, '-') === state;
      const streamMatch = stream === 'all' || 
        (stream === 'medical' && (college.name.includes('Medical') || college.name.includes('AIIMS'))) ||
        (stream === 'dental' && college.name.includes('Dental')) ||
        (stream === 'ayush' && (college.name.includes('Ayurveda') || college.name.includes('Homeopathy')));
      return stateMatch && streamMatch;
    });
  };

  // Function to get search suggestions based on search term and stream
  const getSearchSuggestions = (searchTerm: string, stream: string) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    return mockColleges.filter(college => {
      const nameMatch = college.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       college.state.toLowerCase().includes(searchTerm.toLowerCase());
      const streamMatch = stream === 'all' || 
        (stream === 'medical' && (college.name.includes('Medical') || college.name.includes('AIIMS'))) ||
        (stream === 'dental' && college.name.includes('Dental')) ||
        (stream === 'ayush' && (college.name.includes('Ayurveda') || college.name.includes('Homeopathy')));
      return nameMatch && streamMatch;
    }).slice(0, 8); // Limit to 8 suggestions
  };

  // Function to handle college selection from search
  const handleCollegeSelect = (college: any, type: 'A' | 'B') => {
    if (type === 'A') {
      setSelectedCollegeA(college.id);
      setSearchTermA(college.name);
      setShowSuggestionsA(false);
    } else {
      setSelectedCollegeB(college.id);
      setSearchTermB(college.name);
      setShowSuggestionsB(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={600}
          baseHue={260}
          rangeHue={80}
          baseSpeed={0.15}
          rangeSpeed={1.8}
          baseRadius={1}
          rangeRadius={2.5}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/30 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={400}
          baseHue={260}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-indigo-50/20 to-pink-50/30 z-10"></div>
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
            {/* Floating Data Points */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[
                { rank: '9,532', trend: 'up', delay: 0 },
                { rank: '15,675', trend: 'down', delay: 1 },
                { rank: '2,847', trend: 'up', delay: 2 },
                { rank: '8,921', trend: 'stable', delay: 3 },
                { rank: '12,456', trend: 'up', delay: 4 }
              ].map((point, index) => (
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

            <main className="flex items-center justify-center px-4 sm:px-8 py-8 md:py-12 w-full relative z-20">
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
              Decode the Hidden Patterns in Cutoffs
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
              Trend Analysis
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
              The Data That Changes Everything
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
            {/* Premium Gate for Trend Analysis */}
            <PremiumGate featureKey={FEATURE_KEYS.TREND_ANALYSIS}>
              {/* Trend Visualization Section */}
              <div className="py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.2, delay: 0.3 }}
          >
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${
              isDarkMode 
                ? 'bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'
            }`}>
              Interactive Trend Analysis
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${
              isDarkMode 
                ? 'bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent' 
                : 'bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent'
            }`}>
              Explore cutoff patterns across colleges, courses, and years with our AI-powered visualization
            </p>
          </motion.div>

          {/* Unified Smart Filter Section */}
          <motion.div
            className={`backdrop-blur-md rounded-2xl p-6 mb-8 border-2 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/80 border-gray-200/60'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.2, delay: 0.35 }}
          >
            {/* Header with Comparison Type and Reset */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Trend Analysis
                </h3>
                <div className={`backdrop-blur-sm rounded-lg p-1 border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-100/50 border-gray-200'
                }`}>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setComparisonType('colleges')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                        comparisonType === 'colleges'
                          ? isDarkMode 
                            ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                            : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                          : isDarkMode 
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      Colleges
                    </button>
                    <button
                      onClick={() => setComparisonType('years')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                        comparisonType === 'years'
                          ? isDarkMode 
                            ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                            : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                          : isDarkMode 
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      Years
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={resetFilters}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30' 
                    : 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
                }`}
              >
                Reset All
              </button>
            </div>

            {/* Selection Method Toggle */}
            {comparisonType === 'colleges' && (
              <div className="flex items-center justify-center mb-6">
                <div className={`backdrop-blur-sm rounded-lg p-1 border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-100/50 border-gray-200'
                }`}>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSelectionMethod('dropdown')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                        selectionMethod === 'dropdown'
                          ? isDarkMode 
                            ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                            : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                          : isDarkMode 
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Dropdown
                    </button>
                    <button
                      onClick={() => setSelectionMethod('search')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                        selectionMethod === 'search'
                          ? isDarkMode 
                            ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                            : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                          : isDarkMode 
                            ? 'text-white/70 hover:text-white hover:bg-white/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Brilliant Smart Filter Layout */}
            <div className="space-y-6">
              {/* Global Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Year Filter - Dynamic */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Year
                  </label>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={yearsLoading}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                        : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    {yearsLoading ? (
                      <option>Loading years...</option>
                    ) : (
                      availableYears.map((year, index) => (
                        <option key={index} value={year}>{year}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Stream Filter - Dynamic */}
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
                    {getStreamOptions().map(stream => (
                      <option key={stream.value} value={stream.value}>{stream.label}</option>
                    ))}
                  </select>
                </div>

                {/* Course Filter */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Course
                  </label>
                  <select 
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                        : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    <option value="">Choose Course</option>
                    {mockCourses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>

                {/* Quota Filter */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                    Quota
                  </label>
                  <select 
                    value={selectedQuota}
                    onChange={(e) => setSelectedQuota(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                        : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    {quotaOptions.map(quota => (
                      <option key={quota.value} value={quota.value}>{quota.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* College Selection for Years Comparison */}
              {comparisonType === 'years' && (
                <div className={`backdrop-blur-sm rounded-xl p-4 border mb-6 ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50/50 border-gray-200'
                }`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    College Selection
                  </h4>
                  
                  {/* Selection Method Toggle */}
                  <div className="flex items-center justify-center mb-6">
                    <div className={`backdrop-blur-sm rounded-lg p-1 border ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-gray-100/50 border-gray-200'
                    }`}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectionMethod('dropdown')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                            selectionMethod === 'dropdown'
                              ? isDarkMode 
                                ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                                : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                              : isDarkMode 
                                ? 'text-white/70 hover:text-white hover:bg-white/10'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Dropdown
                        </button>
                        <button
                          onClick={() => setSelectionMethod('search')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                            selectionMethod === 'search'
                              ? isDarkMode 
                                ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                                : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                              : isDarkMode 
                                ? 'text-white/70 hover:text-white hover:bg-white/10'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Search
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {selectionMethod === 'dropdown' ? (
                      <>
                        {/* State Filter for College Selection */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            State
                          </label>
                          <select 
                            value={selectedStateA}
                            onChange={(e) => {
                              setSelectedStateA(e.target.value);
                              setSelectedCollegeA(''); // Reset college when state changes
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                              isDarkMode 
                                ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                            }`}
                          >
                            {stateOptions.map(state => (
                              <option key={state.value} value={state.value}>{state.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* College Selection */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            College
                          </label>
                          <select 
                            value={selectedCollegeA}
                            onChange={(e) => setSelectedCollegeA(e.target.value)}
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                              isDarkMode 
                                ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                            }`}
                          >
                            <option value="">Choose College</option>
                            {getFilteredColleges(selectedStateA, selectedStream).map(college => (
                              <option key={college.id} value={college.id}>{college.name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      /* Search-based College Selection */
                      <div className="relative">
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                          Search College
                        </label>
                        <input
                          type="text"
                          value={searchTermA}
                          onChange={(e) => {
                            setSearchTermA(e.target.value);
                            setShowSuggestionsA(e.target.value.length >= 2);
                            if (e.target.value.length < 2) {
                              setSelectedCollegeA('');
                            }
                          }}
                          onFocus={() => setShowSuggestionsA(searchTermA.length >= 2)}
                          onBlur={() => setTimeout(() => setShowSuggestionsA(false), 200)}
                          placeholder="Type college name or state..."
                          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                            isDarkMode 
                              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                          }`}
                        />
                        
                        {/* Search Suggestions */}
                        {showSuggestionsA && getSearchSuggestions(searchTermA, selectedStream).length > 0 && (
                          <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-y-auto ${
                            isDarkMode 
                              ? 'bg-white/95 backdrop-blur-sm border-white/20' 
                              : 'bg-white border-gray-200'
                          }`}>
                            {getSearchSuggestions(searchTermA, selectedStream).map(college => (
                              <button
                                key={college.id}
                                onClick={() => handleCollegeSelect(college, 'A')}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors duration-200 ${
                                  isDarkMode ? 'hover:bg-white/10 text-gray-900' : 'text-gray-700'
                                }`}
                              >
                                <div className="font-medium">{college.name}</div>
                                <div className="text-xs opacity-70">{college.state}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* College Selection with Individual State Filters */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* College A Section */}
                <div className={`backdrop-blur-sm rounded-xl p-4 border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50/50 border-gray-200'
                }`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {comparisonType === 'colleges' ? 'College A' : 'Year A'}
                  </h4>
                  
                  {comparisonType === 'colleges' ? (
                    <div className="space-y-4">
                      {selectionMethod === 'dropdown' ? (
                        <>
                          {/* State A Filter */}
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                              State
                            </label>
                            <select 
                              value={selectedStateA}
                              onChange={(e) => {
                                setSelectedStateA(e.target.value);
                                setSelectedCollegeA(''); // Reset college when state changes
                              }}
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                                isDarkMode 
                                  ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                  : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                              }`}
                            >
                              {stateOptions.map(state => (
                                <option key={state.value} value={state.value}>{state.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* College A Filter */}
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                              College
                            </label>
                            <select 
                              value={selectedCollegeA}
                              onChange={(e) => setSelectedCollegeA(e.target.value)}
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                                isDarkMode 
                                  ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                  : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                              }`}
                            >
                              <option value="">Choose College A</option>
                              {getFilteredColleges(selectedStateA, selectedStream).map(college => (
                                <option key={college.id} value={college.id}>{college.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        /* Search-based College A Selection */
                        <div className="relative">
                          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            Search College A
                          </label>
                          <input
                            type="text"
                            value={searchTermA}
                            onChange={(e) => {
                              setSearchTermA(e.target.value);
                              setShowSuggestionsA(e.target.value.length >= 2);
                              if (e.target.value.length < 2) {
                                setSelectedCollegeA('');
                              }
                            }}
                            onFocus={() => setShowSuggestionsA(searchTermA.length >= 2)}
                            onBlur={() => setTimeout(() => setShowSuggestionsA(false), 200)}
                            placeholder="Type college name or state..."
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                              isDarkMode 
                                ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                            }`}
                          />
                          
                          {/* Search Suggestions */}
                          {showSuggestionsA && getSearchSuggestions(searchTermA, selectedStream).length > 0 && (
                            <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-y-auto ${
                              isDarkMode 
                                ? 'bg-white/95 backdrop-blur-sm border-white/20' 
                                : 'bg-white border-gray-200'
                            }`}>
                              {getSearchSuggestions(searchTermA, selectedStream).map(college => (
                                <button
                                  key={college.id}
                                  onClick={() => handleCollegeSelect(college, 'A')}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors duration-200 ${
                                    isDarkMode ? 'hover:bg-white/10 text-gray-900' : 'text-gray-700'
                                  }`}
                                >
                                  <div className="font-medium">{college.name}</div>
                                  <div className="text-xs opacity-70">{college.state}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <select 
                      value={selectedYearA}
                      onChange={(e) => setSelectedYearA(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                        isDarkMode 
                          ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                          : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                      }`}
                    >
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* College B Section */}
                <div className={`backdrop-blur-sm rounded-xl p-4 border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50/50 border-gray-200'
                }`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {comparisonType === 'colleges' ? 'College B' : 'Year B'}
                  </h4>
                  
                  {comparisonType === 'colleges' ? (
                    <div className="space-y-4">
                      {selectionMethod === 'dropdown' ? (
                        <>
                          {/* State B Filter */}
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                              State
                            </label>
                            <select 
                              value={selectedStateB}
                              onChange={(e) => {
                                setSelectedStateB(e.target.value);
                                setSelectedCollegeB(''); // Reset college when state changes
                              }}
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                                isDarkMode 
                                  ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                  : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                              }`}
                            >
                              {stateOptions.map(state => (
                                <option key={state.value} value={state.value}>{state.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* College B Filter */}
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                              College
                            </label>
                            <select 
                              value={selectedCollegeB}
                              onChange={(e) => setSelectedCollegeB(e.target.value)}
                              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                                isDarkMode 
                                  ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                  : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                              }`}
                            >
                              <option value="">Choose College B</option>
                              {getFilteredColleges(selectedStateB, selectedStream).map(college => (
                                <option key={college.id} value={college.id}>{college.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        /* Search-based College B Selection */
                        <div className="relative">
                          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            Search College B
                          </label>
                          <input
                            type="text"
                            value={searchTermB}
                            onChange={(e) => {
                              setSearchTermB(e.target.value);
                              setShowSuggestionsB(e.target.value.length >= 2);
                              if (e.target.value.length < 2) {
                                setSelectedCollegeB('');
                              }
                            }}
                            onFocus={() => setShowSuggestionsB(searchTermB.length >= 2)}
                            onBlur={() => setTimeout(() => setShowSuggestionsB(false), 200)}
                            placeholder="Type college name or state..."
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                              isDarkMode 
                                ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                                : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                            }`}
                          />
                          
                          {/* Search Suggestions */}
                          {showSuggestionsB && getSearchSuggestions(searchTermB, selectedStream).length > 0 && (
                            <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-y-auto ${
                              isDarkMode 
                                ? 'bg-white/95 backdrop-blur-sm border-white/20' 
                                : 'bg-white border-gray-200'
                            }`}>
                              {getSearchSuggestions(searchTermB, selectedStream).map(college => (
                                <button
                                  key={college.id}
                                  onClick={() => handleCollegeSelect(college, 'B')}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors duration-200 ${
                                    isDarkMode ? 'hover:bg-white/10 text-gray-900' : 'text-gray-700'
                                  }`}
                                >
                                  <div className="font-medium">{college.name}</div>
                                  <div className="text-xs opacity-70">{college.state}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Years Comparison - Year B Selection */
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                        Year B
                      </label>
                      <select 
                        value={selectedYearB}
                        onChange={(e) => setSelectedYearB(e.target.value)}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
                          isDarkMode 
                            ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                            : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                        }`}
                      >
                        {availableYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Filter Row */}
            <div className="mt-4">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map(category => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      selectedCategory === category.value
                        ? isDarkMode 
                          ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                          : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                        : isDarkMode 
                          ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white border border-white/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side-by-Side Comparison Tables */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.2, delay: 0.5 }}
          >
            {/* Table A */}
            <div className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/80 border-gray-200/60'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {comparisonType === 'colleges' 
                    ? (selectedCollegeA ? mockColleges.find(c => c.id === selectedCollegeA)?.name || 'College A' : 'College A')
                    : `Year ${selectedYearA}`
                  }
                </h3>
                <div className="flex gap-2">
                  {selectedRounds.map(round => (
                    <span key={round} className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      Round {round}
                    </span>
                  ))}
                  {selectedRounds.length < 5 && rounds.length > selectedRounds.length && (
                    <button
                      onClick={addRound}
                      className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center hover:bg-white/10 transition-all duration-300 ${
                        isDarkMode ? 'border-white/40 text-white/60' : 'border-gray-400 text-gray-600'
                      }`}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b-2 ${isDarkMode ? 'border-white/20' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Category
                      </th>
                      {selectedRounds.map(round => (
                        <th key={round} className={`text-center py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          R{round}
                          {round > 2 && (
                            <button
                              onClick={() => removeRound(round)}
                              className="ml-1 text-red-500 hover:text-red-700 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryOptions.filter(cat => cat.value !== 'all').map(category => (
                      <tr key={category.value} className={`border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
                        <td className={`py-3 px-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category.label}
                        </td>
                        {selectedRounds.map(round => (
                          <td key={round} className={`text-center py-3 px-2 ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                            {comparisonType === 'colleges' 
                              ? (selectedQuota === 'all' ? 
                                  (selectedCollegeA === '1' ? '50-60' : selectedCollegeA === '2' ? '150-170' : 'N/A') :
                                  mockTrendData[selectedCollegeA]?.[selectedCourse]?.[selectedYearA]?.[round]?.[category.value]?.[selectedQuota] || 'N/A')
                              : (selectedQuota === 'all' ? 
                                  (selectedYearA === '2024' ? '50-60' : '48-58') :
                                  mockTrendData[selectedCollegeA]?.[selectedCourse]?.[selectedYearA]?.[round]?.[category.value]?.[selectedQuota] || 'N/A')
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table B */}
            <div className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/80 border-gray-200/60'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {comparisonType === 'colleges' 
                    ? (selectedCollegeB ? mockColleges.find(c => c.id === selectedCollegeB)?.name || 'College B' : 'College B')
                    : `Year ${selectedYearB}`
                  }
                </h3>
                <div className="flex gap-2">
                  {selectedRounds.map(round => (
                    <span key={round} className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      Round {round}
                    </span>
                  ))}
                  {selectedRounds.length < 5 && rounds.length > selectedRounds.length && (
                    <button
                      onClick={addRound}
                      className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center hover:bg-white/10 transition-all duration-300 ${
                        isDarkMode ? 'border-white/40 text-white/60' : 'border-gray-400 text-gray-600'
                      }`}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b-2 ${isDarkMode ? 'border-white/20' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Category
                      </th>
                      {selectedRounds.map(round => (
                        <th key={round} className={`text-center py-3 px-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          R{round}
                          {round > 2 && (
                            <button
                              onClick={() => removeRound(round)}
                              className="ml-1 text-red-500 hover:text-red-700 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryOptions.filter(cat => cat.value !== 'all').map(category => (
                      <tr key={category.value} className={`border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
                        <td className={`py-3 px-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {category.label}
                        </td>
                        {selectedRounds.map(round => (
                          <td key={round} className={`text-center py-3 px-2 ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>
                            {comparisonType === 'colleges' 
                              ? (selectedQuota === 'all' ? 
                                  (selectedCollegeB === '1' ? '50-60' : selectedCollegeB === '2' ? '150-170' : 'N/A') :
                                  comparisonType === 'colleges' 
                                    ? mockTrendData[selectedCollegeB]?.[selectedCourse]?.[selectedYearB]
                                    : mockTrendData[selectedCollegeA]?.[selectedCourse]?.[selectedYearB]?.[round]?.[category.value]?.[selectedQuota] || 'N/A')
                              : (selectedQuota === 'all' ? 
                                  (selectedYearB === '2024' ? '50-60' : '48-58') :
                                  comparisonType === 'colleges' 
                                    ? mockTrendData[selectedCollegeB]?.[selectedCourse]?.[selectedYearB]
                                    : mockTrendData[selectedCollegeA]?.[selectedCourse]?.[selectedYearB]?.[round]?.[category.value]?.[selectedQuota] || 'N/A')
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
            </PremiumGate>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrendsPage;
