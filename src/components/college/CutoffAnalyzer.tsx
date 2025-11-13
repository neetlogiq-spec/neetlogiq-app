/**
 * CutoffAnalyzer Component
 *
 * Interactive cutoff analysis with:
 * - Year-wise comparison
 * - Category/quota switching
 * - Trend analysis with charts
 * - Safety meter visualization
 * - Rank comparison
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Filter,
  Download,
  BarChart3
} from 'lucide-react';

export interface CutoffData {
  year: number;
  category: string;
  quota: string;
  round: number;
  opening_rank: number;
  closing_rank: number;
  seats?: number;
}

interface CutoffAnalyzerProps {
  collegeId: string;
  collegeName: string;
  userRank?: number;
  userCategory?: string;
}

export default function CutoffAnalyzer({
  collegeId,
  collegeName,
  userRank,
  userCategory = 'General'
}: CutoffAnalyzerProps) {
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2023, 2022]);
  const [selectedCategory, setSelectedCategory] = useState(userCategory);
  const [selectedQuota, setSelectedQuota] = useState('AIQ');
  const [selectedRound, setSelectedRound] = useState('Final');
  const [cutoffData, setCutoffData] = useState<CutoffData[]>([]);
  const [loading, setLoading] = useState(true);

  const years = [2024, 2023, 2022, 2021, 2020, 2019];
  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
  const quotas = ['AIQ', 'State Quota', 'Management', 'NRI'];
  const rounds = ['Final', 'Round 1', 'Round 2', 'Round 3'];

  useEffect(() => {
    loadCutoffData();
  }, [collegeId, selectedCategory, selectedQuota, selectedRound]);

  const loadCutoffData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // Simulating API data
      const mockData: CutoffData[] = years.map(year => ({
        year,
        category: selectedCategory,
        quota: selectedQuota,
        round: 3,
        opening_rank: 700 + Math.random() * 50,
        closing_rank: 715 + Math.random() * 50,
        seats: 100
      }));

      setCutoffData(mockData);
    } catch (error) {
      console.error('Error loading cutoff data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (year: number) => {
    setSelectedYears(prev =>
      prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  const getSafetyStatus = (userRank: number, closingRank: number) => {
    const diff = closingRank - userRank;
    if (diff > 5000) return { label: 'Safe', color: 'green', icon: CheckCircle };
    if (diff > 2000) return { label: 'Moderate', color: 'yellow', icon: AlertTriangle };
    if (diff > 0) return { label: 'Reach', color: 'orange', icon: AlertCircle };
    return { label: 'Dream', color: 'red', icon: XCircle };
  };

  const calculateTrend = (data: CutoffData[]) => {
    if (data.length < 2) return null;
    const sorted = [...data].sort((a, b) => a.year - b.year);
    const oldest = sorted[0].closing_rank;
    const newest = sorted[sorted.length - 1].closing_rank;
    const change = newest - oldest;
    return {
      change,
      percentage: ((change / oldest) * 100).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  };

  const trend = calculateTrend(cutoffData.filter(d => selectedYears.includes(d.year)));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </h3>
          <button
            onClick={() => {/* Download data */}}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>

        {/* Year Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Select Years
          </label>
          <div className="flex flex-wrap gap-2">
            {years.map(year => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectedYears.includes(year)
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Category, Quota, Round Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Quota
            </label>
            <select
              value={selectedQuota}
              onChange={(e) => setSelectedQuota(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {quotas.map(quota => (
                <option key={quota} value={quota}>{quota}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Round
            </label>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {rounds.map(round => (
                <option key={round} value={round}>{round}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Trend Summary */}
      {trend && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border-2 ${
            trend.direction === 'down'
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
              : trend.direction === 'up'
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {trend.direction === 'down' ? (
                <TrendingDown className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : trend.direction === 'up' ? (
                <TrendingUp className="w-6 h-6 text-red-600 dark:text-red-400" />
              ) : (
                <Minus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
              <div>
                <div className="font-bold text-gray-900 dark:text-white">
                  Cutoff Trend: {trend.direction === 'down' ? '↓ Decreasing' : trend.direction === 'up' ? '↑ Increasing' : '→ Stable'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.abs(trend.change)} rank change over {selectedYears.length} years ({trend.percentage}%)
                </div>
              </div>
            </div>
            {trend.direction === 'down' && (
              <div className="text-sm font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                Improving Chances ✓
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Cutoff Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Opening Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Closing Rank
                </th>
                {userRank && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Your Status
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Seats
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading cutoff data...
                  </td>
                </tr>
              ) : cutoffData.filter(d => selectedYears.includes(d.year)).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No cutoff data available for selected filters
                  </td>
                </tr>
              ) : (
                cutoffData
                  .filter(d => selectedYears.includes(d.year))
                  .sort((a, b) => b.year - a.year)
                  .map((data) => {
                    const safety = userRank ? getSafetyStatus(userRank, data.closing_rank) : null;
                    const StatusIcon = safety?.icon;

                    return (
                      <motion.tr
                        key={data.year}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-gray-900 dark:text-white">{data.year}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {Math.round(data.opening_rank)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-gray-900 dark:text-white font-medium">
                              {Math.round(data.closing_rank)}
                            </span>
                            {userRank && (
                              <span className={`text-xs ${
                                userRank < data.closing_rank ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ({userRank < data.closing_rank ? '+' : ''}{Math.round(data.closing_rank - userRank)})
                              </span>
                            )}
                          </div>
                        </td>
                        {userRank && safety && StatusIcon && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <StatusIcon className={`w-5 h-5 text-${safety.color}-600`} />
                              <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${safety.color}-100 text-${safety.color}-800 dark:bg-${safety.color}-900/30 dark:text-${safety.color}-300`}>
                                {safety.label}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {data.seats || 'N/A'}
                        </td>
                      </motion.tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Cutoff Trend Visualization
        </h3>
        <CutoffChart data={cutoffData.filter(d => selectedYears.includes(d.year))} userRank={userRank} />
      </div>
    </div>
  );
}

// Simple cutoff chart visualization
function CutoffChart({ data, userRank }: { data: CutoffData[]; userRank?: number }) {
  const sorted = [...data].sort((a, b) => a.year - b.year);
  const maxRank = Math.max(...sorted.map(d => d.closing_rank), userRank || 0);
  const minRank = Math.min(...sorted.map(d => d.opening_rank));

  if (sorted.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data to display
      </div>
    );
  }

  return (
    <div className="relative h-64">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{Math.round(maxRank + 100)}</span>
        <span>{Math.round((maxRank + minRank) / 2)}</span>
        <span>{Math.round(minRank - 100)}</span>
      </div>

      {/* Chart area */}
      <div className="ml-16 h-full relative">
        {/* User rank line */}
        {userRank && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-blue-500 z-10"
            style={{
              bottom: `${((userRank - (minRank - 100)) / ((maxRank + 100) - (minRank - 100))) * 100}%`
            }}
          >
            <span className="absolute right-0 -top-3 text-xs font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 px-2 rounded">
              Your Rank
            </span>
          </div>
        )}

        {/* Data points */}
        <div className="h-full flex items-end justify-around px-4">
          {sorted.map((point, index) => {
            const height = ((point.closing_rank - (minRank - 100)) / ((maxRank + 100) - (minRank - 100))) * 100;
            const isBelow = userRank ? userRank < point.closing_rank : false;

            return (
              <div key={point.year} className="flex flex-col items-center flex-1 max-w-[80px]">
                {/* Bar */}
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isBelow
                      ? 'bg-green-500 dark:bg-green-600'
                      : 'bg-red-500 dark:bg-red-600'
                  }`}
                  style={{ height: `${height}%` }}
                >
                  {/* Closing rank label */}
                  <div className="text-xs font-mono text-white text-center p-1">
                    {Math.round(point.closing_rank)}
                  </div>
                </div>
                {/* Year label */}
                <div className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {point.year}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
