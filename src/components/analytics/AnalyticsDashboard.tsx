'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, MapPin, GraduationCap, BookOpen, Award, Clock } from 'lucide-react';
import { apiService } from '@/services/api';

interface AnalyticsData {
  totalColleges: number;
  totalCourses: number;
  totalCutoffs: number;
  stateDistribution: Array<{ state: string; count: number }>;
  streamDistribution: Array<{ stream: string; count: number }>;
  managementTypeDistribution: Array<{ type: string; count: number }>;
  recentActivity: Array<{ type: string; description: string; timestamp: string }>;
  topColleges: Array<{ name: string; city: string; state: string; score: number }>;
  cutoffTrends: Array<{ year: number; averageCutoff: number; totalSeats: number }>;
}

const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Simulate analytics data - in real app, this would come from API
      const mockData: AnalyticsData = {
        totalColleges: 2400,
        totalCourses: 16830,
        totalCutoffs: 45600,
        stateDistribution: [
          { state: 'Delhi', count: 45 },
          { state: 'Maharashtra', count: 38 },
          { state: 'Karnataka', count: 32 },
          { state: 'Tamil Nadu', count: 28 },
          { state: 'Gujarat', count: 25 },
          { state: 'Uttar Pradesh', count: 22 },
          { state: 'West Bengal', count: 18 },
          { state: 'Others', count: 35 }
        ],
        streamDistribution: [
          { stream: 'Medical', count: 65 },
          { stream: 'Dental', count: 25 },
          { stream: 'Ayurveda', count: 7 },
          { stream: 'Homeopathy', count: 3 }
        ],
        managementTypeDistribution: [
          { type: 'Government', count: 40 },
          { type: 'Private', count: 35 },
          { type: 'Deemed', count: 15 },
          { type: 'Central', count: 10 }
        ],
        recentActivity: [
          { type: 'cutoff_update', description: 'AIIMS Delhi MBBS cutoff updated for 2024', timestamp: '2 hours ago' },
          { type: 'new_college', description: 'New medical college added in Bangalore', timestamp: '1 day ago' },
          { type: 'course_update', description: 'BDS course details updated for 15 colleges', timestamp: '2 days ago' },
          { type: 'cutoff_update', description: 'NEET 2024 cutoffs published for 200+ colleges', timestamp: '3 days ago' }
        ],
        topColleges: [
          { name: 'AIIMS New Delhi', city: 'New Delhi', state: 'Delhi', score: 98.5 },
          { name: 'AIIMS Jodhpur', city: 'Jodhpur', state: 'Rajasthan', score: 97.2 },
          { name: 'AIIMS Bhopal', city: 'Bhopal', state: 'Madhya Pradesh', score: 96.8 },
          { name: 'Maulana Azad Medical College', city: 'New Delhi', state: 'Delhi', score: 95.5 },
          { name: 'Lady Hardinge Medical College', city: 'New Delhi', state: 'Delhi', score: 94.8 }
        ],
        cutoffTrends: [
          { year: 2020, averageCutoff: 650, totalSeats: 45000 },
          { year: 2021, averageCutoff: 655, totalSeats: 46000 },
          { year: 2022, averageCutoff: 660, totalSeats: 47000 },
          { year: 2023, averageCutoff: 665, totalSeats: 48000 },
          { year: 2024, averageCutoff: 670, totalSeats: 49000 }
        ]
      };
      
      setData(mockData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Colleges</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.totalColleges.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            +12% from last month
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Courses</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.totalCourses.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            +8% from last month
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cutoff Records</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.totalCutoffs.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            +15% from last month
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">2,847</p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            +23% from last month
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* State Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Colleges by State
          </h3>
          <div className="space-y-3">
            {data.stateDistribution.map((item, index) => (
              <div key={item.state} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.state}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(item.count / Math.max(...data.stateDistribution.map(s => s.count))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stream Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Award className="h-5 w-5 mr-2" />
            Courses by Stream
          </h3>
          <div className="space-y-3">
            {data.streamDistribution.map((item, index) => (
              <div key={item.stream} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.stream}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${item.count}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8">{item.count}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {data.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">{activity.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activity.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Colleges */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <GraduationCap className="h-5 w-5 mr-2" />
            Top Colleges
          </h3>
          <div className="space-y-3">
            {data.topColleges.map((college, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{college.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{college.city}, {college.state}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">{college.score}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cutoff Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Cutoff Trends
          </h3>
          <div className="space-y-3">
            {data.cutoffTrends.map((trend, index) => (
              <div key={trend.year} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{trend.year}</span>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{trend.averageCutoff}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Cutoff</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{trend.totalSeats.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Seats</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
