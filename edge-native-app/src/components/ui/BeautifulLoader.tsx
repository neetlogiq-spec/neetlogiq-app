'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface BeautifulLoaderProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  text?: string;
  className?: string;
}

const BeautifulLoader: React.FC<BeautifulLoaderProps> = ({
  size = 'medium',
  showText = false,
  text = 'Loading...',
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Animated Spinner */}
      <div className="relative">
        {/* Outer Ring */}
        <motion.div
          className={`${sizeClasses[size]} rounded-full border-4 border-gray-200 dark:border-gray-700`}
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        
        {/* Inner Ring */}
        <motion.div
          className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-4 border-transparent border-t-blue-500`}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        
        {/* Center Dot */}
        <motion.div
          className={`absolute top-1/2 left-1/2 w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Loading Text */}
      {showText && (
        <motion.p
          className={`mt-4 font-medium text-gray-600 dark:text-gray-300 ${textSizeClasses[size]}`}
          animate={{
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export default BeautifulLoader;
