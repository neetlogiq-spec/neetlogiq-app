/**
 * Example: Trends Page Implementation
 * Shows 10-year historical trends for colleges
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { dataStore, type CollegeTrend, type College } from '@/lib/data-store';

export default function TrendsExample() {
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('');
  const [trendData, setTrendData] = useState<CollegeTrend | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableColleges, setAvailableColleges] = useState<College[]>([]);

  // Load available colleges on mount
  useEffect(() => {
    const colleges = dataStore.getAllColleges().slice(0, 100); // Show first 100
    setAvailableColleges(colleges);

    if (colleges.length > 0) {
      setSelectedCollegeId(colleges[0].id);
    }
  }, []);

  // Load trend data when selection changes
  useEffect(() => {
    if (selectedCollegeId) {
      loadTrend();
    }
  }, [selectedCollegeId]);

  const loadTrend = async () => {
    setLoading(true);
    try {
      const data = await dataStore.loadCollegeTrend(selectedCollegeId);
      setTrendData(data);
    } catch (error) {
      console.error('Failed to load trend:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform data for visualization
  const chartData = useMemo(() => {
    if (!trendData) return [];

    const years = Object.keys(trendData.yearly_trends).sort();
    return years.map(year => {
      const yearData = trendData.yearly_trends[year];
      return {
        year,
        total_seats: yearData.total_seats,
        courses_offered: yearData.courses_offered,
        total_admissions: yearData.total_admissions,
        best_rank: yearData.best_rank,
        mbbs_closing: yearData.courses?.MBBS?.categories?.OPEN?.closing,
      };
    });
  }, [trendData]);

  // Calculate trend insights
  const insights = useMemo(() => {
    if (chartData.length < 2) return null;

    const latest = chartData[0];
    const oldest = chartData[chartData.length - 1];

    const seatGrowth = latest.total_seats - oldest.total_seats;
    const seatGrowthPercent = ((seatGrowth / oldest.total_seats) * 100).toFixed(1);

    // MBBS trend
    const mbbsData = chartData.filter(d => d.mbbs_closing).map(d => d.mbbs_closing);
    const mbbsAvg = mbbsData.length > 0
      ? Math.round(mbbsData.reduce((a, b) => a! + b!, 0)! / mbbsData.length)
      : null;

    return {
      seatGrowth,
      seatGrowthPercent,
      mbbsAvg,
      yearsOfData: chartData.length,
    };
  }, [chartData]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">College Trends Analysis</h1>

      {/* College Selector */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-semibold mb-2">
          Select College
        </label>
        <select
          value={selectedCollegeId}
          onChange={(e) => setSelectedCollegeId(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {availableColleges.map(college => (
            <option key={college.id} value={college.id}>
              {college.name} - {college.city}, {college.state}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading trend data...</p>
        </div>
      )}

      {/* Trend Data */}
      {!loading && trendData && (
        <div className="space-y-6">
          {/* College Info */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-2">{trendData.college_name}</h2>
            {insights && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <div className="text-3xl font-bold">{insights.yearsOfData}</div>
                  <div className="text-sm opacity-90">Years of Data</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {insights.seatGrowth > 0 ? '+' : ''}{insights.seatGrowth}
                  </div>
                  <div className="text-sm opacity-90">Seat Growth ({insights.seatGrowthPercent}%)</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{insights.mbbsAvg || 'N/A'}</div>
                  <div className="text-sm opacity-90">Avg MBBS Closing Rank</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{chartData[0].courses_offered}</div>
                  <div className="text-sm opacity-90">Courses Offered (Latest)</div>
                </div>
              </div>
            )}
          </div>

          {/* Simple Text-Based Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Year-by-Year Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Year</th>
                    <th className="px-4 py-3 text-right">Total Seats</th>
                    <th className="px-4 py-3 text-right">Courses</th>
                    <th className="px-4 py-3 text-right">Admissions</th>
                    <th className="px-4 py-3 text-right">Best Rank</th>
                    <th className="px-4 py-3 text-right">MBBS Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((data, index) => (
                    <tr
                      key={data.year}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-4 py-3 font-semibold">{data.year}</td>
                      <td className="px-4 py-3 text-right">{data.total_seats}</td>
                      <td className="px-4 py-3 text-right">{data.courses_offered}</td>
                      <td className="px-4 py-3 text-right">{data.total_admissions}</td>
                      <td className="px-4 py-3 text-right">
                        {data.best_rank || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        {data.mbbs_closing || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Course-wise Trends */}
          {chartData.length > 0 && chartData[0].year && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">
                Latest Year Breakdown ({chartData[0].year})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(trendData.yearly_trends[chartData[0].year].courses || {}).map(([courseId, courseData]: [string, any]) => {
                  const courseName = dataStore.getCourse(courseId)?.short_name || courseId;
                  return (
                    <div key={courseId} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{courseName}</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(courseData.categories || {}).map(([category, catData]: [string, any]) => (
                          <div key={category} className="flex justify-between">
                            <span className="text-gray-600">{category}:</span>
                            <span className="font-semibold">
                              {catData.opening} - {catData.closing}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visual Trend Indicator */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">MBBS Closing Rank Trend</h3>
            <div className="space-y-2">
              {chartData.filter(d => d.mbbs_closing).map((data, index, arr) => {
                const maxClosing = Math.max(...arr.map(d => d.mbbs_closing || 0));
                const widthPercent = ((data.mbbs_closing || 0) / maxClosing) * 100;

                return (
                  <div key={data.year} className="flex items-center gap-3">
                    <div className="w-16 text-sm font-semibold">{data.year}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div
                        className="bg-blue-600 h-6 rounded-full transition-all"
                        style={{ width: `${widthPercent}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                        {data.mbbs_closing}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !trendData && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No trend data available for this college</p>
        </div>
      )}
    </div>
  );
}
