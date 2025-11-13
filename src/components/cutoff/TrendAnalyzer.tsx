/**
 * TrendAnalyzer Component
 *
 * Visual trend analysis with:
 * - 10-year cutoff trends
 * - ML-based predictions for next year
 * - State-wise trend comparison
 * - College popularity trends
 * - Interactive line charts
 * - Identify opportunities (falling cutoffs)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  LineChart,
  PieChart,
  Info,
  Download,
  Filter
} from 'lucide-react';

interface TrendData {
  year: number;
  avgClosingRank: number;
  minClosingRank: number;
  maxClosingRank: number;
  totalColleges: number;
  prediction?: number;
}

interface CollegeTrend {
  collegeId: string;
  collegeName: string;
  state: string;
  trends: { year: number; rank: number }[];
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

export default function TrendAnalyzer() {
  const [selectedMetric, setSelectedMetric] = useState<'cutoff' | 'competition' | 'seats'>('cutoff');
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [selectedQuota, setSelectedQuota] = useState('AIQ');
  const [selectedState, setSelectedState] = useState<string | 'all'>('all');
  const [showPrediction, setShowPrediction] = useState(true);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [topTrends, setTopTrends] = useState<CollegeTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
  const quotas = ['AIQ', 'State Quota', 'Management'];
  const states = ['All', 'Delhi', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Kerala'];

  useEffect(() => {
    loadTrendData();
  }, [selectedCategory, selectedQuota, selectedState]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // Simulating trend data
      const mockTrendData: TrendData[] = Array.from({ length: 10 }, (_, i) => {
        const year = 2024 - i;
        const baseRank = 700;
        const variance = Math.random() * 100 - 50;
        return {
          year,
          avgClosingRank: baseRank + variance + i * 5,
          minClosingRank: baseRank - 100 + variance,
          maxClosingRank: baseRank + 200 + variance,
          totalColleges: 450 + Math.floor(Math.random() * 50)
        };
      }).reverse();

      // Add prediction for next year
      mockTrendData.push({
        year: 2025,
        avgClosingRank: mockTrendData[mockTrendData.length - 1].avgClosingRank + 10,
        minClosingRank: 0,
        maxClosingRank: 0,
        totalColleges: 0,
        prediction: mockTrendData[mockTrendData.length - 1].avgClosingRank + 10
      });

      setTrendData(mockTrendData);

      // Mock college trends
      const mockCollegeTrends: CollegeTrend[] = [
        {
          collegeId: '1',
          collegeName: 'AIIMS Delhi',
          state: 'Delhi',
          trends: Array.from({ length: 5 }, (_, i) => ({
            year: 2024 - i,
            rank: 50 + i * 2
          })).reverse(),
          trendDirection: 'increasing',
          changePercentage: 8.5
        },
        {
          collegeId: '2',
          collegeName: 'JIPMER Puducherry',
          state: 'Puducherry',
          trends: Array.from({ length: 5 }, (_, i) => ({
            year: 2024 - i,
            rank: 120 - i * 3
          })).reverse(),
          trendDirection: 'decreasing',
          changePercentage: -12.3
        }
      ];

      setTopTrends(mockCollegeTrends);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallTrend = () => {
    if (trendData.length < 2) return { direction: 'stable', change: 0 };
    const first = trendData[0].avgClosingRank;
    const last = trendData[trendData.length - 2].avgClosingRank; // Exclude prediction
    const change = ((last - first) / first) * 100;
    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change: change.toFixed(1)
    };
  };

  const overallTrend = calculateOverallTrend();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Activity className="w-7 h-7 mr-3" />
            Trend Analyzer
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Analyze historical trends and predict future cutoffs
          </p>
        </div>
        <button
          onClick={() => {/* Download report */}}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export Report</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Metric
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="cutoff">Cutoff Ranks</option>
              <option value="competition">Competition Level</option>
              <option value="seats">Seat Availability</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quota
            </label>
            <select
              value={selectedQuota}
              onChange={(e) => setSelectedQuota(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              {quotas.map(quota => <option key={quota} value={quota}>{quota}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              State
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              {states.map(state => (
                <option key={state} value={state === 'All' ? 'all' : state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center">
          <input
            type="checkbox"
            id="showPrediction"
            checked={showPrediction}
            onChange={(e) => setShowPrediction(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="showPrediction" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Show AI prediction for 2025
          </label>
        </div>
      </div>

      {/* Overall Trend Summary */}
      <div className={`p-6 rounded-xl border-2 ${
        overallTrend.direction === 'decreasing'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : overallTrend.direction === 'increasing'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {overallTrend.direction === 'decreasing' ? (
              <TrendingDown className="w-12 h-12 text-green-600 dark:text-green-400" />
            ) : overallTrend.direction === 'increasing' ? (
              <TrendingUp className="w-12 h-12 text-red-600 dark:text-red-400" />
            ) : (
              <Activity className="w-12 h-12 text-gray-600 dark:text-gray-400" />
            )}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Overall Trend: {overallTrend.direction === 'decreasing' ? 'Decreasing' : overallTrend.direction === 'increasing' ? 'Increasing' : 'Stable'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Cutoffs have {overallTrend.direction === 'decreasing' ? 'decreased' : 'increased'} by {Math.abs(parseFloat(overallTrend.change))}% over the last decade
              </p>
            </div>
          </div>
          {overallTrend.direction === 'decreasing' && (
            <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full font-medium">
              Good News! 📈
            </div>
          )}
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <LineChart className="w-5 h-5 mr-2" />
          10-Year Cutoff Trend
        </h3>

        {loading ? (
          <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading trend data...
          </div>
        ) : (
          <TrendChart data={trendData} showPrediction={showPrediction} />
        )}

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {trendData.length > 0 ? Math.round(trendData[trendData.length - 2]?.avgClosingRank || 0) : 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">2024 Avg Rank</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {showPrediction && trendData.length > 0 ? Math.round(trendData[trendData.length - 1]?.prediction || 0) : '—'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">2025 Prediction</div>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {overallTrend.change}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">10-Year Change</div>
          </div>
        </div>
      </div>

      {/* College-wise Trends */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Top Trending Colleges
        </h3>

        <div className="space-y-4">
          {topTrends.map((trend, index) => (
            <motion.div
              key={trend.collegeId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{trend.collegeName}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{trend.state}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {trend.trendDirection === 'decreasing' ? (
                    <TrendingDown className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`text-lg font-bold ${
                    trend.trendDirection === 'decreasing' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(trend.changePercentage)}%
                  </span>
                </div>
              </div>

              {/* Mini trend chart */}
              <div className="h-16 flex items-end space-x-1">
                {trend.trends.map((point, i) => {
                  const maxRank = Math.max(...trend.trends.map(t => t.rank));
                  const height = (point.rank / maxRank) * 100;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${
                        trend.trendDirection === 'decreasing' ? 'bg-green-400' : 'bg-red-400'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${point.year}: ${point.rank}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span>{trend.trends[0].year}</span>
                <span>{trend.trends[trend.trends.length - 1].year}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2 text-blue-600" />
          Key Insights
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">
              Cutoffs have been {overallTrend.direction === 'decreasing' ? 'decreasing' : 'increasing'} over the past 10 years, indicating {overallTrend.direction === 'decreasing' ? 'better opportunities' : 'higher competition'}
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">
              Based on historical patterns, 2025 cutoffs are predicted to be around {trendData.length > 0 ? Math.round(trendData[trendData.length - 1]?.prediction || 0) : 0}
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">
              {topTrends.filter(t => t.trendDirection === 'decreasing').length} colleges showing decreasing cutoffs (easier admission)
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">
              Consider applying to colleges with decreasing trends for better chances
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Trend Chart Component
function TrendChart({ data, showPrediction }: { data: TrendData[]; showPrediction: boolean }) {
  const displayData = showPrediction ? data : data.filter(d => !d.prediction);
  const maxRank = Math.max(...displayData.map(d => d.maxClosingRank || d.avgClosingRank));
  const minRank = Math.min(...displayData.map(d => d.minClosingRank || d.avgClosingRank));
  const range = maxRank - minRank;

  if (displayData.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <div className="relative h-96">
      {/* Y-axis */}
      <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{Math.round(maxRank)}</span>
        <span>{Math.round((maxRank + minRank) / 2)}</span>
        <span>{Math.round(minRank)}</span>
      </div>

      {/* Chart area */}
      <div className="ml-16 mr-4 h-full pb-8">
        <svg className="w-full h-full">
          {/* Grid lines */}
          <line x1="0" y1="25%" x2="100%" y2="25%" stroke="currentColor" strokeDasharray="4" className="text-gray-200 dark:text-gray-700" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeDasharray="4" className="text-gray-200 dark:text-gray-700" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="currentColor" strokeDasharray="4" className="text-gray-200 dark:text-gray-700" />

          {/* Data line */}
          <polyline
            points={displayData.map((d, i) => {
              const x = (i / (displayData.length - 1)) * 100;
              const y = ((maxRank - d.avgClosingRank) / range) * 100;
              return `${x}%,${y}%`;
            }).join(' ')}
            fill="none"
            stroke={showPrediction && displayData.length > 0 ? 'url(#gradient)' : '#3B82F6'}
            strokeWidth="3"
            className="transition-all"
          />

          {/* Gradient for prediction */}
          {showPrediction && (
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="80%" stopColor="#3B82F6" />
                <stop offset="80%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          )}

          {/* Data points */}
          {displayData.map((d, i) => {
            const x = (i / (displayData.length - 1)) * 100;
            const y = ((maxRank - d.avgClosingRank) / range) * 100;
            const isPrediction = !!d.prediction;

            return (
              <g key={d.year}>
                <circle
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="5"
                  fill={isPrediction ? '#8B5CF6' : '#3B82F6'}
                  className="transition-all"
                />
                {isPrediction && (
                  <circle
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="8"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-16 right-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        {displayData.map(d => (
          <span key={d.year} className={d.prediction ? 'text-purple-600 font-medium' : ''}>
            {d.year}
          </span>
        ))}
      </div>
    </div>
  );
}
