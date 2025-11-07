'use client';

import { useState } from 'react';
import { useCachedCutoffs } from '@/hooks/useCachedCutoffs';

/**
 * Cached Cutoffs Page
 * 
 * Features:
 * - Multi-layer caching (Browser → CDN → KV → Worker)
 * - <5% Worker usage through aggressive caching
 * - Smart prefetching
 * - Progressive loading
 * - Request coalescing
 */
export default function CachedCutoffsPage() {
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedRound, setSelectedRound] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // Use cached cutoffs hook
  const {
    data,
    loading,
    error,
    cacheStats,
    loadData,
    batchLoad,
    refresh,
  } = useCachedCutoffs({
    stream: 'UG',
    year: selectedYear,
    autoPrefetch: true,
    progressiveLoad: false,
  });

  const handleFilterChange = (round?: number) => {
    setSelectedRound(round);
    loadData({ round });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Coalesce search requests
    loadData({
      filters: query ? {
        college_id: query,
      } : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Cached Cutoffs Page
          </h1>
          <p className="text-gray-600">
            Multi-layer caching architecture for minimal Worker usage
          </p>
        </div>

        {/* Cache Stats */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Cache Hits:</span>
                <span className="ml-2 text-green-600">{cacheStats.hits}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Cache Misses:</span>
                <span className="ml-2 text-red-600">{cacheStats.misses}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Cache Layer:</span>
                <span className="ml-2 text-blue-600">{cacheStats.layer || 'Unknown'}</span>
              </div>
            </div>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  loadData({ round: selectedRound });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={2024}>2024</option>
                <option value={2023}>2023</option>
                <option value={2022}>2022</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Round
              </label>
              <select
                value={selectedRound || ''}
                onChange={(e) => handleFilterChange(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Rounds</option>
                <option value="1">Round 1</option>
                <option value="2">Round 2</option>
                <option value="3">Round 3</option>
                <option value="4">Round 4</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by college..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error.message}</p>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && data.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      College
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opening Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Closing Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Seats
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.slice(0, 100).map((row: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.college_name || row.college_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.course_name || row.course_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.opening_rank || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.closing_rank || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.total_seats || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Data */}
        {!loading && !error && data.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

