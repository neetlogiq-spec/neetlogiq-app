/**
 * Progressive Cutoffs Page
 *
 * Architecture:
 * 1. Static HTML with embedded JSON data (~1-2 MB gzipped)
 * 2. Client-side filtering (instant, 0 API calls)
 * 3. Worker API only for complex operations (trends, predictions)
 *
 * Benefits:
 * - First filter: 0ms (already on page!)
 * - Subsequent filters: <10ms (client-side)
 * - Complex queries: 100ms (Worker)
 * - Cost: $0 for 95% of operations
 * - Works offline after first load
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStream } from '@/contexts/StreamContext';
import { getTrends } from '@/lib/api-client'; // Worker for complex ops only

// This data is embedded at build time
import cutoffsData from '@/data/static/cutoffs-2024.json';

interface Cutoff {
  id: string;
  college_id: string;
  college_name: string;
  course: string;
  year: number;
  round: number;
  category: string;
  quota: string;
  opening_rank: number;
  closing_rank: number;
  stream: string;
}

interface Filters {
  stream: 'UG' | 'PG_MEDICAL' | 'PG_DENTAL';
  category: string;
  quota: string;
  maxRank: number;
  minRank: number;
  state?: string;
  search?: string;
}

export default function CutoffsPage() {
  const { selectedStream } = useStream();

  const [filters, setFilters] = useState<Filters>({
    stream: selectedStream || 'UG',
    category: 'General',
    quota: 'All India',
    maxRank: 10000,
    minRank: 1,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trends, setTrends] = useState(null);

  // CLIENT-SIDE FILTERING (instant!)
  const filteredCutoffs = useMemo(() => {
    console.time('Client-side filter');

    let results = cutoffsData as Cutoff[];

    // Apply filters
    results = results.filter(cutoff => {
      // Stream filter
      if (cutoff.stream !== filters.stream) return false;

      // Category filter
      if (filters.category !== 'All' && cutoff.category !== filters.category) {
        return false;
      }

      // Quota filter
      if (filters.quota !== 'All' && cutoff.quota !== filters.quota) {
        return false;
      }

      // Rank range filter
      if (cutoff.closing_rank > filters.maxRank ||
          cutoff.closing_rank < filters.minRank) {
        return false;
      }

      // Search filter (college name or course)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = cutoff.college_name.toLowerCase().includes(searchLower);
        const matchesCourse = cutoff.course.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCourse) return false;
      }

      return true;
    });

    // Sort by closing rank
    results.sort((a, b) => a.closing_rank - b.closing_rank);

    console.timeEnd('Client-side filter');
    console.log(`✅ Filtered ${results.length} from ${cutoffsData.length} (${((results.length/cutoffsData.length)*100).toFixed(1)}%)`);

    return results;
  }, [filters, cutoffsData]);

  // Client-side statistics (instant!)
  const stats = useMemo(() => {
    return {
      total: filteredCutoffs.length,
      lowestRank: Math.min(...filteredCutoffs.map(c => c.closing_rank)),
      highestRank: Math.max(...filteredCutoffs.map(c => c.closing_rank)),
      uniqueColleges: new Set(filteredCutoffs.map(c => c.college_id)).size,
      uniqueCourses: new Set(filteredCutoffs.map(c => c.course)).size,
    };
  }, [filteredCutoffs]);

  // WORKER API - Only for complex operations
  const loadTrends = async (collegeId: string) => {
    console.log('🌐 Calling Worker for trends (complex operation)');
    const trendsData = await getTrends({ collegeId, years: 5 });
    setTrends(trendsData);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">NEET Cutoffs</h1>

      {/* Performance Info */}
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800">
          ⚡ <strong>{cutoffsData.length.toLocaleString()}</strong> cutoffs loaded statically
          • Filtering happens instantly on your device
          • No API calls needed for filters!
        </p>
      </div>

      {/* Filter Panel */}
      <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={filters.category}
              onChange={e => setFilters({ ...filters, category: e.target.value })}
              className="w-full p-2 border rounded"
            >
              <option value="All">All Categories</option>
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
            </select>
          </div>

          {/* Quota */}
          <div>
            <label className="block text-sm font-medium mb-2">Quota</label>
            <select
              value={filters.quota}
              onChange={e => setFilters({ ...filters, quota: e.target.value })}
              className="w-full p-2 border rounded"
            >
              <option value="All">All Quotas</option>
              <option value="All India">All India</option>
              <option value="State">State Quota</option>
              <option value="Deemed">Deemed</option>
            </select>
          </div>

          {/* Max Rank */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Rank: {filters.maxRank.toLocaleString()}
            </label>
            <input
              type="range"
              min="1"
              max="50000"
              step="100"
              value={filters.maxRank}
              onChange={e => setFilters({ ...filters, maxRank: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Search College or Course</label>
          <input
            type="text"
            placeholder="Type to search..."
            value={filters.search || ''}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-4 text-blue-600 hover:text-blue-800 text-sm"
        >
          {showAdvanced ? '− Hide' : '+ Show'} Advanced Filters
        </button>
      </div>

      {/* Stats - Computed client-side */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Results" value={stats.total} />
        <StatCard label="Colleges" value={stats.uniqueColleges} />
        <StatCard label="Courses" value={stats.uniqueCourses} />
        <StatCard label="Lowest Rank" value={stats.lowestRank} />
        <StatCard label="Highest Rank" value={stats.highestRank} />
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  College
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Opening
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Closing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCutoffs.slice(0, 100).map(cutoff => (
                <tr key={cutoff.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{cutoff.college_name}</td>
                  <td className="px-6 py-4 text-sm">{cutoff.course}</td>
                  <td className="px-6 py-4 text-sm">{cutoff.category}</td>
                  <td className="px-6 py-4 text-sm">{cutoff.quota}</td>
                  <td className="px-6 py-4 text-sm">{cutoff.opening_rank.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-medium">{cutoff.closing_rank.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => loadTrends(cutoff.college_id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Trends
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCutoffs.length > 100 && (
          <div className="p-4 text-center text-sm text-gray-600 border-t">
            Showing first 100 of {filteredCutoffs.length} results
          </div>
        )}

        {filteredCutoffs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No cutoffs match your filters. Try adjusting the criteria.
          </div>
        )}
      </div>

      {/* Performance metrics */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Filtering {cutoffsData.length.toLocaleString()} entries locally
        • Zero API calls • Instant results
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="text-2xl font-bold text-blue-600">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
