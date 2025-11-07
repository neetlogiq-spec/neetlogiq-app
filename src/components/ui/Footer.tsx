'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const Footer: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <footer className={`relative z-20 py-4 px-4 ${
      isDarkMode 
        ? 'bg-transparent' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto text-center">
        <p className={`text-sm ${
          isDarkMode 
            ? 'text-white/50' 
            : 'text-gray-400'
        }`}>
          © 2025 NeetLogIQ. All rights reserved. Built with ❤️ for medical aspirants.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
