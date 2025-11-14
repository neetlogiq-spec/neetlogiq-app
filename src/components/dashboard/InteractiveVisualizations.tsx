/**
 * InteractiveVisualizations Component
 *
 * Dashboard widget with interactive charts and graphs:
 * - Cutoff trend charts
 * - Admission probability gauge
 * - Category distribution pie chart
 * - State-wise college distribution map
 * - Budget vs rank scatter plot
 * - Interactive tooltips
 * - Export chart functionality
 * - Responsive design
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Activity,
  Download,
  Maximize2,
  Info,
  Target,
  MapPin,
  DollarSign,
  Award,
  Users,
  Zap
} from 'lucide-react';

interface ChartData {
  label: string;
  value: number;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface InteractiveVisualizationsProps {
  userRank?: number;
  userCategory?: string;
}

export default function InteractiveVisualizations({
  userRank = 5000,
  userCategory = 'General'
}: InteractiveVisualizationsProps) {
  const [activeChart, setActiveChart] = useState<'trends' | 'distribution' | 'probability' | 'budget'>('trends');

  // Mock data for various charts
  const cutoffTrendData: ChartData[] = [
    { label: '2019', value: 750, trend: 'stable' },
    { label: '2020', value: 720, trend: 'down' },
    { label: '2021', value: 715, trend: 'down' },
    { label: '2022', value: 710, trend: 'down' },
    { label: '2023', value: 705, trend: 'down' },
    { label: '2024', value: 715, trend: 'up' }
  ];

  const categoryDistribution: ChartData[] = [
    { label: 'General', value: 40, color: '#3B82F6' },
    { label: 'OBC', value: 27, color: '#10B981' },
    { label: 'SC', value: 15, color: '#F59E0B' },
    { label: 'ST', value: 7.5, color: '#EF4444' },
    { label: 'EWS', value: 10, color: '#8B5CF6' },
    { label: 'PWD', value: 0.5, color: '#EC4899' }
  ];

  const stateDistribution: ChartData[] = [
    { label: 'Karnataka', value: 45 },
    { label: 'Maharashtra', value: 38 },
    { label: 'Tamil Nadu', value: 32 },
    { label: 'Delhi', value: 28 },
    { label: 'Uttar Pradesh', value: 25 },
    { label: 'Others', value: 82 }
  ];

  const budgetRanges: ChartData[] = [
    { label: '< ₹50K', value: 25, color: '#10B981' },
    { label: '₹50K-1L', value: 20, color: '#3B82F6' },
    { label: '₹1L-2L', value: 15, color: '#F59E0B' },
    { label: '₹2L-5L', value: 12, color: '#EF4444' },
    { label: '> ₹5L', value: 8, color: '#8B5CF6' }
  ];

  const admissionProbability = 87; // percentage

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Interactive Analytics
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Visual insights for better decision making
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {/* TODO: Export chart */}}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Export chart"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => {/* TODO: Fullscreen */}}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="grid grid-cols-4 gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
        <button
          onClick={() => setActiveChart('trends')}
          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
            activeChart === 'trends'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm">Trends</span>
        </button>
        <button
          onClick={() => setActiveChart('distribution')}
          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
            activeChart === 'distribution'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span className="text-sm">Distribution</span>
        </button>
        <button
          onClick={() => setActiveChart('probability')}
          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
            activeChart === 'probability'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Target className="w-4 h-4" />
          <span className="text-sm">Chances</span>
        </button>
        <button
          onClick={() => setActiveChart('budget')}
          className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
            activeChart === 'budget'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span className="text-sm">Budget</span>
        </button>
      </div>

      {/* Chart Display Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {/* Cutoff Trends Chart */}
        {activeChart === 'trends' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cutoff Trends (2019-2024)
              </h4>
              <div className="flex items-center space-x-2 text-sm">
                <TrendingDown className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400 font-medium">
                  -4.7% over 5 years
                </span>
              </div>
            </div>

            {/* Line Chart */}
            <div className="relative h-64">
              <svg width="100%" height="100%" className="overflow-visible">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={`${(i * 25)}%`}
                    x2="100%"
                    y2={`${(i * 25)}%`}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-gray-200 dark:text-gray-700"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Y-axis labels */}
                {[800, 750, 700, 650, 600].map((value, i) => (
                  <text
                    key={value}
                    x="0"
                    y={`${(i * 25) + 3}%`}
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                  >
                    {value}
                  </text>
                ))}

                {/* Line path */}
                <path
                  d={cutoffTrendData
                    .map((point, i) => {
                      const x = (i / (cutoffTrendData.length - 1)) * 100;
                      const y = ((800 - point.value) / 200) * 100; // Scale: 600-800
                      return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>

                {/* Data points */}
                {cutoffTrendData.map((point, i) => {
                  const x = (i / (cutoffTrendData.length - 1)) * 100;
                  const y = ((800 - point.value) / 200) * 100;
                  return (
                    <g key={i}>
                      <circle
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r="6"
                        fill="white"
                        stroke="#3B82F6"
                        strokeWidth="3"
                        className="hover:r-8 transition-all cursor-pointer"
                      />
                      {/* Label */}
                      <text
                        x={`${x}%`}
                        y="100%"
                        textAnchor="middle"
                        className="text-xs fill-gray-600 dark:fill-gray-400"
                      >
                        {point.label}
                      </text>
                    </g>
                  );
                })}

                {/* User rank indicator */}
                <line
                  x1="0"
                  y1={`${((800 - userRank) / 200) * 100}%`}
                  x2="100%"
                  y2={`${((800 - userRank) / 200) * 100}%`}
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x="100%"
                  y={`${((800 - userRank) / 200) * 100}%`}
                  textAnchor="end"
                  className="text-xs fill-red-600 dark:fill-red-400 font-medium"
                >
                  Your Rank: {userRank}
                </text>
              </svg>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {cutoffTrendData[cutoffTrendData.length - 1].value}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">2024 Cutoff</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.min(...cutoffTrendData.map(d => d.value))}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Lowest Ever</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {userRank < cutoffTrendData[cutoffTrendData.length - 1].value ? 'Safe' : 'Reach'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Your Status</div>
              </div>
            </div>
          </div>
        )}

        {/* Category Distribution Chart */}
        {activeChart === 'distribution' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Seat Distribution by Category
            </h4>

            <div className="flex items-center justify-center">
              {/* Donut Chart */}
              <div className="relative w-64 h-64">
                <svg width="100%" height="100%" viewBox="0 0 200 200">
                  {categoryDistribution.map((category, index) => {
                    const total = categoryDistribution.reduce((sum, cat) => sum + cat.value, 0);
                    const startAngle = categoryDistribution
                      .slice(0, index)
                      .reduce((sum, cat) => sum + (cat.value / total) * 360, 0);
                    const angle = (category.value / total) * 360;
                    const endAngle = startAngle + angle;

                    // Convert to radians
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);

                    // Calculate arc path
                    const outerRadius = 90;
                    const innerRadius = 50;
                    const x1 = 100 + outerRadius * Math.cos(startRad);
                    const y1 = 100 + outerRadius * Math.sin(startRad);
                    const x2 = 100 + outerRadius * Math.cos(endRad);
                    const y2 = 100 + outerRadius * Math.sin(endRad);
                    const x3 = 100 + innerRadius * Math.cos(endRad);
                    const y3 = 100 + innerRadius * Math.sin(endRad);
                    const x4 = 100 + innerRadius * Math.cos(startRad);
                    const y4 = 100 + innerRadius * Math.sin(startRad);

                    const largeArc = angle > 180 ? 1 : 0;

                    return (
                      <path
                        key={category.label}
                        d={`M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`}
                        fill={category.color}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    );
                  })}

                  {/* Center text */}
                  <text
                    x="100"
                    y="95"
                    textAnchor="middle"
                    className="text-2xl font-bold fill-gray-900 dark:fill-white"
                  >
                    100%
                  </text>
                  <text
                    x="100"
                    y="110"
                    textAnchor="middle"
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                  >
                    Total Seats
                  </text>
                </svg>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {categoryDistribution.map((category) => (
                <div key={category.label} className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.label}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {category.value}% of seats
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admission Probability Gauge */}
        {activeChart === 'probability' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Your Admission Probability
            </h4>

            <div className="flex items-center justify-center py-8">
              {/* Gauge Chart */}
              <div className="relative w-72 h-36">
                <svg width="100%" height="100%" viewBox="0 0 300 150">
                  {/* Background arc */}
                  <path
                    d="M 50 125 A 100 100 0 0 1 250 125"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="20"
                    className="text-gray-200 dark:text-gray-700"
                    strokeLinecap="round"
                  />

                  {/* Progress arc */}
                  <path
                    d="M 50 125 A 100 100 0 0 1 250 125"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeDasharray={`${(admissionProbability / 100) * 314} 314`}
                  />

                  {/* Gradient */}
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#EF4444" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>

                  {/* Center value */}
                  <text
                    x="150"
                    y="100"
                    textAnchor="middle"
                    className="text-5xl font-bold fill-gray-900 dark:fill-white"
                  >
                    {admissionProbability}%
                  </text>
                </svg>

                {/* Labels */}
                <div className="absolute bottom-0 left-0 text-xs text-gray-600 dark:text-gray-400">
                  0%
                </div>
                <div className="absolute bottom-0 right-0 text-xs text-gray-600 dark:text-gray-400">
                  100%
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-300">
                High chances of admission in saved colleges!
              </span>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  12
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Safe Colleges</div>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  8
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Moderate Colleges</div>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                  5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Reach Colleges</div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                  3
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Dream Colleges</div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Analysis */}
        {activeChart === 'budget' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Budget Distribution
            </h4>

            {/* Bar Chart */}
            <div className="space-y-3">
              {budgetRanges.map((range, index) => {
                const maxValue = Math.max(...budgetRanges.map(r => r.value));
                const percentage = (range.value / maxValue) * 100;

                return (
                  <div key={range.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {range.label}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {range.value} colleges
                      </span>
                    </div>
                    <div className="relative h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="absolute inset-y-0 left-0 rounded-lg"
                        style={{ backgroundColor: range.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insights */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" />
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  ₹1.5L
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Annual Cost</div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Award className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  25
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Affordable Options</div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="flex items-start space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Budget Tip:</strong> Consider government colleges for quality education at lower costs.
                You have 25 affordable options (&lt; ₹50K/year) within your rank range.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Interactive Visualizations Widget
 * Smaller version for dashboard cards
 */
export function InteractiveVisualizationsCompact() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <InteractiveVisualizations />
    </div>
  );
}
