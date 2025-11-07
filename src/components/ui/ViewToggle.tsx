'use client';

import React from 'react';
import { Grid, Table } from 'lucide-react';
import { motion } from 'framer-motion';

export type ViewType = 'card' | 'table';

interface ViewToggleProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isDarkMode?: boolean;
  className?: string;
}

const ViewToggle: React.FC<ViewToggleProps> = ({
  currentView,
  onViewChange,
  isDarkMode = false,
  className = ''
}) => {
  return (
    <div className={`inline-flex items-center p-1 rounded-lg ${
      isDarkMode 
        ? 'bg-white/10 border border-white/20' 
        : 'bg-gray-100 border border-gray-200'
    } ${className}`}>
      <motion.button
        onClick={() => onViewChange('card')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          currentView === 'card'
            ? isDarkMode
              ? 'bg-white/20 text-white shadow-lg'
              : 'bg-white text-gray-900 shadow-md'
            : isDarkMode
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Grid className="w-4 h-4" />
        <span className="hidden sm:inline">Card View</span>
      </motion.button>
      
      <motion.button
        onClick={() => onViewChange('table')}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          currentView === 'table'
            ? isDarkMode
              ? 'bg-white/20 text-white shadow-lg'
              : 'bg-white text-gray-900 shadow-md'
            : isDarkMode
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Table className="w-4 h-4" />
        <span className="hidden sm:inline">Table View</span>
      </motion.button>
    </div>
  );
};

export default ViewToggle;