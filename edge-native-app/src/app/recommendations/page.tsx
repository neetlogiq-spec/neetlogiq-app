'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import dynamic from 'next/dynamic';

const RecommendationEngine = dynamic(() => import('@/components/recommendations/RecommendationEngine'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  ),
  ssr: false
});

const RecommendationsPage: React.FC = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <RecommendationEngine />
        </div>
      </div>
    </Layout>
  );
};

export default RecommendationsPage;
