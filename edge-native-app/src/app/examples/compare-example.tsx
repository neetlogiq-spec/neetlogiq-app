/**
 * Example: Compare Page Implementation
 * Shows how to compare multiple colleges using pre-aggregated summaries
 */
'use client';

import { useState, useEffect } from 'react';
import { dataStore, type CollegeSummary, type College } from '@/lib/data-store';

export default function CompareExample() {
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<CollegeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableColleges, setAvailableColleges] = useState<College[]>([]);

  // Load available colleges on mount
  useEffect(() => {
    const colleges = dataStore.getAllColleges().slice(0, 50); // Show first 50 for demo
    setAvailableColleges(colleges);
  }, []);

  // Load comparison data when selection changes
  useEffect(() => {
    if (selectedColleges.length > 0) {
      loadComparison();
    } else {
      setSummaries([]);
    }
  }, [selectedColleges]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const data = await dataStore.loadMultipleSummaries(selectedColleges);

      // Enrich with course names
      const enriched = data.map(summary => ({
        ...summary,
        courses: summary.courses.map(c => ({
          ...c,
          courseName: dataStore.getCourse(c.course_id)?.name || c.course_id,
          courseShortName: dataStore.getCourse(c.course_id)?.short_name || c.course_id,
        }))
      }));

      setSummaries(enriched);
    } catch (error) {
      console.error('Failed to load comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollege = (collegeId: string) => {
    if (selectedColleges.includes(collegeId)) {
      setSelectedColleges(selectedColleges.filter(id => id !== collegeId));
    } else {
      if (selectedColleges.length < 4) {
        setSelectedColleges([...selectedColleges, collegeId]);
      } else {
        alert('Maximum 4 colleges can be compared');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Compare Colleges</h1>

      {/* College Selector */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Select Colleges to Compare (Max 4)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableColleges.map(college => (
            <button
              key={college.id}
              onClick={() => toggleCollege(college.id)}
              className={`p-3 text-left rounded border-2 transition-all ${
                selectedColleges.includes(college.id)
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="font-semibold text-sm">{college.short_name}</div>
              <div className="text-xs text-gray-600">
                {college.city}, {college.state}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Selected: {selectedColleges.length}/4 colleges
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading comparison...</p>
        </div>
      )}

      {/* Comparison Grid */}
      {!loading && summaries.length > 0 && (
        <div className={`grid grid-cols-1 ${summaries.length === 2 ? 'md:grid-cols-2' : summaries.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'} gap-6`}>
          {summaries.map(summary => (
            <div key={summary.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                <h3 className="font-bold text-lg mb-1">{summary.short_name}</h3>
                <p className="text-sm opacity-90">
                  {summary.city}, {summary.state}
                </p>
              </div>

              {/* Basic Info */}
              <div className="p-4 border-b">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold">{summary.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Management:</span>
                    <span className="font-semibold">{summary.management}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Established:</span>
                    <span className="font-semibold">{summary.established || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="p-4 bg-gray-50 border-b">
                <h4 className="font-semibold mb-3 text-sm">Statistics</h4>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white rounded p-2">
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.stats.total_seats || 0}
                    </div>
                    <div className="text-xs text-gray-600">Total Seats</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-2xl font-bold text-green-600">
                      {summary.stats.courses_offered || 0}
                    </div>
                    <div className="text-xs text-gray-600">Courses</div>
                  </div>
                  <div className="bg-white rounded p-2 col-span-2">
                    <div className="text-2xl font-bold text-purple-600">
                      {summary.highlights.best_overall_rank || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600">Best Rank</div>
                  </div>
                </div>
              </div>

              {/* Top Courses */}
              <div className="p-4">
                <h4 className="font-semibold mb-3 text-sm">Top Courses</h4>
                <div className="space-y-2">
                  {summary.courses.slice(0, 3).map((course: any) => (
                    <div key={course.course_id} className="text-sm">
                      <div className="font-medium">{course.courseShortName}</div>
                      <div className="text-xs text-gray-600 flex justify-between">
                        <span>Seats: {course.total_seats}</span>
                        {course.best_rank_ever && (
                          <span>Best Rank: {course.best_rank_ever}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MBBS Cutoff Trend (if available) */}
              {summary.cutoff_trends.MBBS && (
                <div className="p-4 bg-blue-50">
                  <h4 className="font-semibold mb-2 text-sm">MBBS Cutoff Trend</h4>
                  <div className="space-y-1 text-xs">
                    {Object.entries(summary.cutoff_trends.MBBS)
                      .slice(0, 3)
                      .map(([year, categories]: [string, any]) => (
                        <div key={year} className="flex justify-between">
                          <span>{year}:</span>
                          <span className="font-semibold">
                            {categories.OPEN?.closing || 'N/A'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && summaries.length === 0 && selectedColleges.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Select colleges from above to compare</p>
        </div>
      )}
    </div>
  );
}
