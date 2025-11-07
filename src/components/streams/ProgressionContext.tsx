'use client';

import React from 'react';
import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ProgressionContextProps {
  context: string;
  currentStream: string;
  className?: string;
}

const ProgressionContext: React.FC<ProgressionContextProps> = ({
  context,
  currentStream,
  className = ''
}) => {
  const { isDarkMode } = useTheme();

  const getStreamIcon = (stream: string) => {
    switch (stream) {
      case 'UG':
        return GraduationCap;
      case 'PG_MEDICAL':
      case 'PG_DENTAL':
        return BookOpen;
      default:
        return BookOpen;
    }
  };

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case 'UG':
        return {
          bg: isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50',
          border: isDarkMode ? 'border-blue-700' : 'border-blue-200',
          text: isDarkMode ? 'text-blue-300' : 'text-blue-700',
          icon: isDarkMode ? 'text-blue-400' : 'text-blue-600'
        };
      case 'PG_MEDICAL':
        return {
          bg: isDarkMode ? 'bg-green-900/20' : 'bg-green-50',
          border: isDarkMode ? 'border-green-700' : 'border-green-200',
          text: isDarkMode ? 'text-green-300' : 'text-green-700',
          icon: isDarkMode ? 'text-green-400' : 'text-green-600'
        };
      case 'PG_DENTAL':
        return {
          bg: isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50',
          border: isDarkMode ? 'border-purple-700' : 'border-purple-200',
          text: isDarkMode ? 'text-purple-300' : 'text-purple-700',
          icon: isDarkMode ? 'text-purple-400' : 'text-purple-600'
        };
      default:
        return {
          bg: isDarkMode ? 'bg-gray-900/20' : 'bg-gray-50',
          border: isDarkMode ? 'border-gray-700' : 'border-gray-200',
          text: isDarkMode ? 'text-gray-300' : 'text-gray-700',
          icon: isDarkMode ? 'text-gray-400' : 'text-gray-600'
        };
    }
  };

  const IconComponent = getStreamIcon(currentStream);
  const colors = getStreamColor(currentStream);

  return (
    <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${colors.bg} ${colors.border} border`}>
          <IconComponent className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div className="flex-1">
          <h3 className={`text-sm font-semibold mb-1 ${colors.text}`}>
            Your Educational Pathway
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {context}
          </p>
        </div>
        <ArrowRight className={`w-4 h-4 ${colors.icon} mt-1`} />
      </div>
    </div>
  );
};

export default ProgressionContext;
