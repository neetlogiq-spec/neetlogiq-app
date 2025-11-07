'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface UnmatchedCollege {
  id: string;
  stagingName: string;
  matchConfidence: number;
  matchMethod: string;
  distance: number;
  suggestedMatches: Array<{
    id: string;
    name: string;
    fullName?: string;
    state: string;
    city?: string;
    confidence: number;
    source: 'typesense' | 'fuzzy';
  }>;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'manual_match';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  finalMatchId?: string;
}

interface ReviewSummary {
  totalUnmatchedColleges: number;
  totalUnmatchedCourses: number;
  pendingReviews: number;
  completedReviews: number;
  reviewProgress: number;
}

export default function ManualReviewPage() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [colleges, setColleges] = useState<UnmatchedCollege[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState<UnmatchedCollege | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'high-confidence'>('all');

  useEffect(() => {
    loadReviewData();
  }, []);

  const loadReviewData = async () => {
    try {
      const response = await fetch('/api/manual-review');
      const data = await response.json();
      
      if (data.success) {
        setSummary(data.data.summary);
        setColleges(data.data.colleges);
      }
    } catch (error) {
      console.error('Failed to load review data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredColleges = colleges.filter(college => {
    if (filter === 'pending') return college.reviewStatus === 'pending';
    if (filter === 'high-confidence') return college.matchConfidence > 0.7;
    return true;
  });

  const approveMatch = (college: UnmatchedCollege, matchId: string) => {
    // TODO: Implement API call to approve match
    console.log('Approving match:', college.id, matchId);
  };

  const rejectMatch = (college: UnmatchedCollege) => {
    // TODO: Implement API call to reject match
    console.log('Rejecting match:', college.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading manual review data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manual Review</h1>
          <p className="text-gray-600">Review and approve unmatched colleges from AIQ data</p>
        </motion.div>

        {/* Summary Cards */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Unmatched</h3>
              <p className="text-2xl font-bold text-gray-900">{summary.totalUnmatchedColleges}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Pending Reviews</h3>
              <p className="text-2xl font-bold text-yellow-600">{summary.pendingReviews}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Completed</h3>
              <p className="text-2xl font-bold text-green-600">{summary.completedReviews}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Progress</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.reviewProgress.toFixed(1)}%</p>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All ({colleges.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pending ({colleges.filter(c => c.reviewStatus === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('high-confidence')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'high-confidence'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              High Confidence ({colleges.filter(c => c.matchConfidence > 0.7).length})
            </button>
          </div>
        </motion.div>

        {/* College List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {filteredColleges.map((college, index) => (
            <motion.div
              key={college.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedCollege(college)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {college.stagingName}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>Confidence: {(college.matchConfidence * 100).toFixed(1)}%</span>
                    <span>Method: {college.matchMethod}</span>
                    <span>Matches: {college.suggestedMatches.length}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {college.suggestedMatches.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMatch(college, college.suggestedMatches[0].id);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve Top Match
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      rejectMatch(college);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Selected College Modal */}
        {selectedCollege && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Review College Match</h2>
                  <button
                    onClick={() => setSelectedCollege(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Staging College:</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedCollege.stagingName}
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Matches:</h3>
                  <div className="space-y-4">
                    {selectedCollege.suggestedMatches.map((match, index) => (
                      <div key={match.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{match.name}</h4>
                            {match.fullName && (
                              <p className="text-sm text-gray-600">{match.fullName}</p>
                            )}
                            <p className="text-sm text-gray-500">
                              {match.state}{match.city && `, ${match.city}`}
                            </p>
                            <p className="text-sm text-gray-500">
                              Source: {match.source} | Confidence: {(match.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                          <button
                            onClick={() => approveMatch(selectedCollege, match.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => rejectMatch(selectedCollege)}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject All Matches
                  </button>
                  <button
                    onClick={() => setSelectedCollege(null)}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
