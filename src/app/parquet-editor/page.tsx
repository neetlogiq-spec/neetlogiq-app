'use client';

import { useState, useEffect } from 'react';

interface UnmatchedCollege {
  college_name: string;
  state: string;
  frequency: number;
  category: string;
  priority: string;
  variations: string[];
  standard_name: string;
  notes: string;
  files_to_edit: string[];
  sample_data: {
    course: string;
    quota: string;
    category: string;
    round: string;
    year: number;
  }[];
}

interface UnmatchedCourse {
  course_name: string;
  frequency: number;
  sample_data: {
    college_name: string;
    state: string;
    quota: string;
    category: string;
  }[];
}

export default function ParquetEditor() {
  const [unmatchedColleges, setUnmatchedColleges] = useState<UnmatchedCollege[]>([]);
  const [unmatchedCourses, setUnmatchedCourses] = useState<UnmatchedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'colleges' | 'courses'>('colleges');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUnmatchedData();
  }, []);

  const fetchUnmatchedData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/parquet/counselling/unmatched');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUnmatchedColleges(data.colleges || []);
      setUnmatchedCourses(data.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const filteredColleges = unmatchedColleges.filter(college =>
    college.college_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    college.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = unmatchedCourses.filter(course =>
    course.course_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading unmatched data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 text-lg font-semibold mb-2">Error Loading Data</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchUnmatchedData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 Parquet Data Viewer - Unmatched Records
          </h1>
          <p className="text-gray-600">
            Review unmatched colleges and courses from counselling data import
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search colleges or courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('colleges')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'colleges'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🏥 Colleges ({filteredColleges.length})
              </button>
              <button
                onClick={() => setActiveTab('courses')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'courses'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🎓 Courses ({filteredCourses.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'colleges' ? (
          <div className="space-y-4">
            {filteredColleges.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No unmatched colleges found</p>
              </div>
            ) : (
              filteredColleges.map((college, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {index + 1}. {college.standard_name || college.college_name}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        college.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                        college.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {college.priority} PRIORITY
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {college.frequency} records
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm"><strong>State:</strong> {college.state}</p>
                        <p className="text-sm"><strong>Category:</strong> {college.category}</p>
                      </div>
                      <div>
                        <p className="text-sm"><strong>Files to Edit:</strong> {college.files_to_edit?.join(', ') || 'Seat data Excel files, Counselling Excel files'}</p>
                      </div>
                    </div>

                    {college.variations && college.variations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Variations to Fix:</p>
                        <div className="flex flex-wrap gap-2">
                          {college.variations.map((variation, vIndex) => (
                            <code key={vIndex} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs border">
                              {variation}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Standard Name:</p>
                      <code className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm border">
                        {college.standard_name || college.college_name}
                      </code>
                    </div>

                    {college.notes && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{college.notes}</p>
                      </div>
                    )}

                    {college.variations && college.variations.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm font-medium text-blue-800 mb-1">🔧 Search & Replace Action:</p>
                        <div className="text-xs text-blue-700 space-y-1">
                          <div><strong>Find:</strong> <code>{college.variations[0]}</code></div>
                          <div><strong>Replace:</strong> <code>{college.standard_name || college.college_name}</code></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                        📊 Sample Data ({college.sample_data?.length || 0} examples)
                        <span className="ml-1 group-open:rotate-90 transform transition-transform">▶</span>
                      </summary>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(college.sample_data || []).slice(0, 4).map((sample, sampleIndex) => (
                          <div key={sampleIndex} className="text-xs bg-gray-50 p-2 rounded">
                            <div><strong>Course:</strong> {sample.course}</div>
                            <div><strong>Quota:</strong> {sample.quota}</div>
                            <div><strong>Category:</strong> {sample.category}</div>
                            <div><strong>Round:</strong> {sample.round} ({sample.year})</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCourses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No unmatched courses found</p>
              </div>
            ) : (
              filteredCourses.map((course, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {course.course_name}
                      </h3>
                    </div>
                    <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                      {course.frequency} records
                    </span>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Data:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {course.sample_data.slice(0, 4).map((sample, sampleIndex) => (
                        <div key={sampleIndex} className="text-xs bg-gray-50 p-2 rounded">
                          <div><strong>College:</strong> {sample.college_name}</div>
                          <div><strong>State:</strong> {sample.state}</div>
                          <div><strong>Quota:</strong> {sample.quota}</div>
                          <div><strong>Category:</strong> {sample.category}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-800 font-semibold mb-2">💡 How to Fix These Issues:</h3>
          <div className="text-blue-700 text-sm space-y-1">
            <p>1. 📋 Use the Master Mapping File created for you</p>
            <p>2. 📝 Edit the Excel source files with Find & Replace</p>
            <p>3. 🔄 Re-import the data to see improvements</p>
            <p>4. 📊 Expected improvement: 72% → 85%+ match rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
