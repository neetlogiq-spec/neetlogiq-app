'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ui/theme-toggle';

const TestThemePage = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Theme Toggle Test</h1>
        
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Current Theme Status:</h2>
          <p className="text-lg">
            <strong>Dark Mode:</strong> {isDarkMode ? 'Enabled' : 'Disabled'}
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Theme Toggle Component:</h2>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-lg">
            <ThemeToggle />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Manual Toggle Button:</h2>
          <button
            onClick={toggleTheme}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Toggle Theme ({isDarkMode ? 'Light' : 'Dark'})
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Theme Test Content:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Light/Dark Card</h3>
              <p className="text-gray-600 dark:text-gray-300">
                This card should change colors based on the theme.
              </p>
            </div>
            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Colored Card</h3>
              <p className="text-blue-800 dark:text-blue-200">
                This card uses theme-aware colors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestThemePage;
