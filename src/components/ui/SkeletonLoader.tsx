'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
  animation = 'pulse'
}) => {
  const { isDarkMode } = useTheme();
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-none';
      case 'rounded':
        return 'rounded-lg';
      case 'text':
      default:
        return 'rounded';
    }
  };
  
  const getAnimationClasses = () => {
    switch (animation) {
      case 'pulse':
        return 'animate-pulse';
      case 'wave':
        return 'animate-shimmer';
      case 'none':
      default:
        return '';
    }
  };
  
  const baseClasses = `
    ${getVariantClasses()}
    ${getAnimationClasses()}
    ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}
    ${className}
  `;
  
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  
  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={baseClasses}
            style={{
              ...style,
              height: style?.height || '1rem',
              width: index === lines - 1 ? '60%' : '100%'
            }}
          />
        ))}
      </div>
    );
  }
  
  return <div className={baseClasses} style={style} />;
};

// Predefined skeleton components for common use cases
export const CollegeCardSkeleton: React.FC = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`backdrop-blur-md p-6 rounded-2xl border-2 ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
    }`}>
      <div className="flex items-center space-x-4 mb-4">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1">
          <Skeleton width="80%" height={24} className="mb-2" />
          <Skeleton width="60%" height={16} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton width="40%" height={16} />
        <Skeleton width="30%" height={16} />
        <Skeleton width="50%" height={16} />
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Skeleton width="100%" height={36} variant="rounded" />
      </div>
    </div>
  );
};

export const CourseCardSkeleton: React.FC = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`backdrop-blur-md p-6 rounded-2xl border-2 ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
    }`}>
      <div className="text-center mb-4">
        <Skeleton variant="circular" width={64} height={64} className="mx-auto mb-3" />
        <Skeleton width="70%" height={20} className="mx-auto mb-2" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton width="50%" height={16} className="mx-auto" />
        <Skeleton width="60%" height={16} className="mx-auto" />
      </div>
      <Skeleton width="100%" height={36} variant="rounded" />
    </div>
  );
};

export const CutoffCardSkeleton: React.FC = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`backdrop-blur-md p-4 rounded-xl border-2 ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
    }`}>
      <div className="text-center mb-4">
        <Skeleton width="80%" height={18} className="mx-auto mb-2" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton width="40%" height={14} className="mx-auto" />
        <Skeleton width="60%" height={14} className="mx-auto" />
        <Skeleton width="50%" height={14} className="mx-auto" />
      </div>
      <Skeleton width="100%" height={32} variant="rounded" />
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="text-left py-3 px-2">
                  <Skeleton width="80%" height={20} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-200 dark:border-gray-700">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="py-3 px-2">
                    <Skeleton width="70%" height={16} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3 p-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1">
            <Skeleton width="70%" height={16} className="mb-1" />
            <Skeleton width="50%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const StatsCardSkeleton: React.FC = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className={`backdrop-blur-md p-6 rounded-2xl border-2 ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton width={80} height={24} />
      </div>
      <Skeleton width="60%" height={16} className="mb-2" />
      <Skeleton width="40%" height={14} />
    </div>
  );
};

// Loading overlay component
export const LoadingOverlay: React.FC<{ 
  isLoading: boolean; 
  message?: string; 
  children: React.ReactNode;
}> = ({ isLoading, message = 'Loading...', children }) => {
  const { isDarkMode } = useTheme();
  
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-black/70' : 'bg-white/80'
        } backdrop-blur-sm z-10 rounded-lg`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
};

// Page skeleton for full page loading
export const PageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Skeleton width="40%" height={40} className="mb-4" />
          <Skeleton width="60%" height={24} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <CollegeCardSkeleton key={index} />
          ))}
        </div>
        
        <div className="flex justify-center">
          <Skeleton width={200} height={48} variant="rounded" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;

