'use client';

import React from 'react';
import { useEdgeData } from '@/hooks/useEdgeData';
import { useVectorSearch } from '@/hooks/useVectorSearch';
import { CutoffFilters } from '@/types/data';

export default function CutoffsPage() {
  const { cutoffs, loading, error } = useEdgeData({
    year: 2024,
    category_id: 'CAT001'
  });
  
  const { searchCutoffs } = useVectorSearch();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          NEET Cutoffs
        </h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {loading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading cutoff data...</span>
          </div>
        )}
        
        {!loading && !error && (
          <div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search cutoffs..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                onChange={(e) => {
                  // Handle search
                  console.log('Search query:', e.target.value);
                }}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cutoffs.map((cutoff) => (
                <div key={cutoff.id} className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-semibold">{cutoff.college_name}</h3>
                  <p className="text-gray-600">{cutoff.course_name}</p>
                  <p className="text-sm text-gray-500">Opening Rank: {cutoff.opening_rank}</p>
                  <p className="text-sm text-gray-500">Closing Rank: {cutoff.closing_rank}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
