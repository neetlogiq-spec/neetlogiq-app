'use client';

import React from 'react';
import { Sparkles, GraduationCap, BookOpen } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function RecommendationsWidget() {
  const { isDarkMode } = useTheme();

  // Placeholder recommendations - will be replaced with AI-powered recommendations
  const mockRecommendations = [
    { type: 'college', name: 'AIIMS New Delhi', reason: 'Based on your preferences', score: 95 },
    { type: 'course', name: 'MBBS', reason: 'Popular choice in your area', score: 88 },
    { type: 'college', name: 'CMC Vellore', reason: 'High success rate', score: 92 }
  ];

  const getIcon = (type: string) => {
    return type === 'college' ? GraduationCap : BookOpen;
  };

  const getColor = (score: number) => {
    if (score >= 90) return isDarkMode ? 'text-green-400' : 'text-green-500';
    if (score >= 80) return isDarkMode ? 'text-blue-400' : 'text-blue-500';
    return isDarkMode ? 'text-orange-400' : 'text-orange-500';
  };

  return (
    <div
      className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${
        isDarkMode 
          ? 'bg-white/10 border-white/20 hover:bg-white/15 shadow-white/5' 
          : 'bg-white/80 border-gray-200/60 hover:bg-white shadow-gray-200/30'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          AI Recommendations
        </h3>
        <Sparkles className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
      </div>
      
      <div className="space-y-3">
        {mockRecommendations.map((rec, index) => {
          const IconComponent = getIcon(rec.type);
          const colorClass = getColor(rec.score);
          
          return (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-1 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                    <IconComponent className={`w-3 h-3 ${colorClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {rec.name}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'} mt-1`}>
                      {rec.reason}
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-semibold ${colorClass}`}>
                  {rec.score}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className={`mt-4 p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
          💡 Recommendations are based on your preferences and browsing history
        </div>
      </div>
    </div>
  );
}
