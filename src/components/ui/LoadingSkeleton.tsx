'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  count = 1,
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'text' ? '16px' : variant === 'circular' ? '40px' : '100px'),
  };

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  ));

  return count > 1 ? <div className="space-y-3">{skeletons}</div> : skeletons[0];
};

// Pre-built skeleton components for common use cases

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex space-x-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} width="100%" height="24px" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton key={colIndex} width="100%" height="40px" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center space-x-4 mb-4">
            <Skeleton variant="circular" width="60px" height="60px" />
            <div className="flex-1 space-y-2">
              <Skeleton width="70%" height="20px" />
              <Skeleton width="50%" height="16px" />
            </div>
          </div>
          <Skeleton count={3} height="12px" className="mb-2" />
          <div className="flex items-center justify-between mt-4">
            <Skeleton width="30%" height="32px" variant="rectangular" />
            <Skeleton width="30%" height="32px" variant="rectangular" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start space-x-4">
            <Skeleton variant="circular" width="48px" height="48px" />
            <div className="flex-1 space-y-2">
              <Skeleton width="60%" height="18px" />
              <Skeleton width="40%" height="14px" />
              <Skeleton width="80%" height="12px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton width="60%" height="16px" />
            <Skeleton variant="circular" width="40px" height="40px" />
          </div>
          <Skeleton width="40%" height="32px" />
          <Skeleton width="50%" height="12px" className="mt-2" />
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <Skeleton width="40%" height="24px" className="mb-6" />
      <div className="flex items-end justify-between h-64 space-x-2">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height={`${Math.random() * 60 + 40}%`}
            variant="rectangular"
          />
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
