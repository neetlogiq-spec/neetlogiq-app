'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CollegeCardSkeletonProps {
  index: number;
}

const CollegeCardSkeleton: React.FC<CollegeCardSkeletonProps> = ({ index }) => {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className="h-full flex flex-col rounded-2xl shadow-lg overflow-hidden backdrop-blur-md border-2 animate-pulse bg-green-50/40 border-green-200/60 shadow-green-200/30"
    >
      {/* Main Card Content */}
      <div className="p-4 sm:p-6 flex flex-col flex-1">
        {/* Header Skeleton */}
        <div className="mb-4">
          {/* Title Skeleton */}
          <div className="h-6 rounded-lg mb-3 bg-gray-200"></div>
          <div className="h-5 rounded-lg mb-3 bg-gray-200"></div>
          
          {/* College Type Badge Skeleton */}
          <div className="text-center mb-3">
            <div className="h-6 w-24 rounded-full mx-auto bg-gray-200"></div>
          </div>
        </div>

        {/* Key Info Grid Skeleton */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* State Skeleton */}
          <div className="p-3 rounded-lg bg-gray-100">
            <div className="flex items-center justify-center mb-1">
              <div className="w-4 h-4 rounded mr-2 bg-gray-200"></div>
              <div className="h-3 w-8 rounded bg-gray-200"></div>
            </div>
            <div className="h-4 rounded mx-auto w-16 bg-gray-200"></div>
          </div>

          {/* Management Skeleton */}
          <div className="p-3 rounded-lg bg-gray-100">
            <div className="flex items-center justify-center mb-1">
              <div className="w-4 h-4 rounded mr-2 bg-gray-200"></div>
              <div className="h-3 w-16 rounded bg-gray-200"></div>
            </div>
            <div className="h-4 rounded mx-auto w-20 bg-gray-200"></div>
          </div>
        </div>

        {/* Action Button Skeleton */}
        <div className="mt-auto">
          <div className="w-full h-10 rounded-lg bg-gray-200"></div>
        </div>
      </div>
    </motion.div>
  );
};

export default CollegeCardSkeleton;
