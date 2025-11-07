'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Download, Share2, Star, TrendingUp, Users, Award } from 'lucide-react';
import ComparisonCard from './ComparisonCard';
import MatchScore from './MatchScore';

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

interface ComparisonResultsProps {
  colleges: College[];
  onReset: () => void;
  isDarkMode: boolean;
}

const ComparisonResults: React.FC<ComparisonResultsProps> = ({
  colleges,
  onReset,
  isDarkMode
}) => {
  const [matchScore, setMatchScore] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);

  // Calculate AI match score
  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => {
      // Mock calculation - replace with actual algorithm
      const score = Math.floor(Math.random() * 30) + 70; // 70-100
      setMatchScore(score);
      setIsCalculating(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [colleges]);

  const comparisonData = [
    {
      title: 'Basic Information',
      icon: '🏛️',
      data: [
        { label: 'Established', key: 'established', format: 'year' },
        { label: 'Type', key: 'type', format: 'text' },
        { label: 'Location', key: 'location', format: 'location' }
      ]
    },
    {
      title: 'Academic Programs',
      icon: '📚',
      data: [
        { label: 'Total Courses', key: 'courses', format: 'number' },
        { label: 'Medical Courses', key: 'medicalCourses', format: 'number' },
        { label: 'Dental Courses', key: 'dentalCourses', format: 'number' }
      ]
    },
    {
      title: 'Admission Statistics',
      icon: '📊',
      data: [
        { label: 'Average Cutoff', key: 'avgCutoff', format: 'rank' },
        { label: 'Total Seats', key: 'totalSeats', format: 'number' },
        { label: 'Acceptance Rate', key: 'acceptanceRate', format: 'percentage' }
      ]
    },
    {
      title: 'Reputation & Ranking',
      icon: '🏆',
      data: [
        { label: 'Overall Rating', key: 'rating', format: 'stars' },
        { label: 'Research Output', key: 'research', format: 'score' },
        { label: 'Faculty Quality', key: 'faculty', format: 'score' }
      ]
    }
  ];

  const formatValue = (value: any, format: string) => {
    switch (format) {
      case 'year':
        return value;
      case 'text':
        return value;
      case 'location':
        return `${value.city}, ${value.state}`;
      case 'number':
        return value.toLocaleString();
      case 'rank':
        return `#${value}`;
      case 'percentage':
        return `${Math.round(value * 100)}%`;
      case 'stars':
        return '⭐'.repeat(Math.floor(value || 4));
      case 'score':
        return `${value || 85}/100`;
      default:
        return value;
    }
  };

  const getValue = (college: College, key: string) => {
    switch (key) {
      case 'location':
        return college;
      case 'rating':
        return Math.random() * 2 + 3; // 3-5 stars
      case 'research':
        return Math.floor(Math.random() * 20) + 80; // 80-100
      case 'faculty':
        return Math.floor(Math.random() * 15) + 85; // 85-100
      default:
        return college[key as keyof College];
    }
  };

  return (
    <motion.div
      className="py-12 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h2 
            className={`text-3xl md:text-4xl font-bold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Side-by-Side Comparison
          </motion.h2>
          
          <motion.div 
            className="flex items-center justify-center gap-4 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <MatchScore 
              score={matchScore} 
              isCalculating={isCalculating}
              isDarkMode={isDarkMode}
            />
          </motion.div>

          {/* Action Buttons */}
          <motion.div 
            className="flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button
              onClick={onReset}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Compare Different Colleges
            </button>
            
            <button className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
              <Download className="w-4 h-4" />
              Download Report
            </button>
            
            <button className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              isDarkMode
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}>
              <Share2 className="w-4 h-4" />
              Share Comparison
            </button>
          </motion.div>
        </div>

        {/* Comparison Grid */}
        <div className="space-y-8">
          {comparisonData.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
            >
              <ComparisonCard
                title={section.title}
                icon={section.icon}
                colleges={colleges}
                data={section.data}
                formatValue={formatValue}
                getValue={getValue}
                isDarkMode={isDarkMode}
              />
            </motion.div>
          ))}
        </div>

        {/* Summary & Recommendations */}
        <motion.div
          className={`mt-12 p-8 rounded-2xl ${
            isDarkMode 
              ? 'bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30'
              : 'bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200'
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <h3 className={`text-2xl font-bold mb-6 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            AI Recommendations
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {colleges.map((college, index) => (
              <div
                key={college.id}
                className={`p-6 rounded-xl ${
                  isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'
                }`}
              >
                <h4 className={`text-lg font-semibold mb-3 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {college.name}
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                      Strong in {college.type} programs
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                      {college.totalSeats} total seats available
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                      Established in {college.established}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ComparisonResults;
