'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import FavoritesManager from '@/components/favorites/FavoritesManager';

const FavoritesPage: React.FC = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <FavoritesManager />
        </div>
      </div>
    </Layout>
  );
};

export default FavoritesPage;
