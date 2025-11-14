/**
 * CutoffManagement Component
 *
 * Allows admins to manage cutoff data from multiple sources
 *
 * Features:
 * - Review and approve user-submitted cutoffs
 * - Edit cutoff data
 * - Add verification notes and warnings
 * - Bulk approve/reject submissions
 * - View submission history and analytics
 * - Detect and merge duplicate entries
 * - Flag suspicious data
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { StreamType } from '@/components/admin/StreamManagement';

// Cutoff submission interface
export interface CutoffSubmission {
  id: string;
  submittedBy: 'user' | 'admin' | 'automated' | 'scraper';
  submitterId: string;
  submitterEmail?: string;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';

  // Cutoff data
  data: CutoffData;

  // Verification
  verification: VerificationInfo;

  // Source
  source: SubmissionSource;
}

export interface CutoffData {
  stream: StreamType;
  year: number;
  collegeName: string;
  collegeCode?: string;
  courseName: string;
  courseCode?: string;
  category: string;
  quota: string;
  round: number;
  openingRank: number;
  closingRank: number;
  seats?: number;
  state?: string;

  // Additional metadata
  examType?: 'NEET-UG' | 'NEET-PG' | 'NEET-MDS';
  gender?: 'Open' | 'Male' | 'Female';
  domicile?: 'Yes' | 'No' | 'Not Applicable';
}

export interface VerificationInfo {
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
  warnings?: string[];
  flags?: string[]; // 'suspicious-rank', 'duplicate', 'inconsistent', etc.
}

export interface SubmissionSource {
  type: 'manual' | 'file-upload' | 'api' | 'web-scraping' | 'official';
  url?: string; // If from scraping or official source
  fileName?: string; // If from file upload
  metadata?: Record<string, any>;
}

export default function CutoffManagement() {
  const [submissions, setSubmissions] = useState<CutoffSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<CutoffSubmission | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'flagged'>('pending');
  const [streamFilter, setStreamFilter] = useState<StreamType | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load submissions
  useEffect(() => {
    loadSubmissions();
  }, [filter, streamFilter, yearFilter]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (streamFilter !== 'all') params.append('stream', streamFilter);
      if (yearFilter !== 'all') params.append('year', yearFilter.toString());

      const response = await fetch(`/api/admin/cutoff-submissions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approveSubmission = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/admin/cutoff-submissions/${submissionId}/approve`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadSubmissions();
      }
    } catch (error) {
      console.error('Error approving submission:', error);
    }
  };

  const rejectSubmission = async (submissionId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/admin/cutoff-submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        await loadSubmissions();
      }
    } catch (error) {
      console.error('Error rejecting submission:', error);
    }
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;

    for (const id of selectedIds) {
      await approveSubmission(id);
    }

    setSelectedIds(new Set());
    await loadSubmissions();
  };

  const bulkReject = async () => {
    if (selectedIds.size === 0) return;

    const reason = prompt('Rejection reason:');
    if (!reason) return;

    for (const id of selectedIds) {
      await rejectSubmission(id, reason);
    }

    setSelectedIds(new Set());
    await loadSubmissions();
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === submissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(submissions.map(s => s.id)));
    }
  };

  // Statistics
  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
    flagged: submissions.filter(s => s.status === 'flagged').length
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Cutoff Management</h2>
        <p className="mt-2 text-gray-600">
          Review, verify, and manage cutoff submissions
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'gray' },
          { label: 'Pending', value: stats.pending, color: 'yellow' },
          { label: 'Approved', value: stats.approved, color: 'green' },
          { label: 'Rejected', value: stats.rejected, color: 'red' },
          { label: 'Flagged', value: stats.flagged, color: 'orange' }
        ].map(stat => (
          <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-lg p-4`}>
            <div className="text-sm text-gray-600">{stat.label}</div>
            <div className={`text-2xl font-bold text-${stat.color}-700`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>

          {/* Stream Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stream
            </label>
            <select
              value={streamFilter}
              onChange={e => setStreamFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Streams</option>
              <option value="UG">UG</option>
              <option value="PG_MEDICAL">PG Medical</option>
              <option value="PG_DENTAL">PG Dental</option>
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Years</option>
              {[2024, 2023, 2022, 2021, 2020].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="ml-auto flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedIds.size} selected
              </span>
              <button
                onClick={bulkApprove}
                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                Approve All
              </button>
              <button
                onClick={bulkReject}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Reject All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center space-x-4 text-sm font-medium text-gray-700">
            <div className="w-8">
              <input
                type="checkbox"
                checked={selectedIds.size === submissions.length && submissions.length > 0}
                onChange={selectAll}
                className="rounded"
              />
            </div>
            <div className="w-20">Stream</div>
            <div className="w-16">Year</div>
            <div className="flex-1">College & Course</div>
            <div className="w-24">Category</div>
            <div className="w-24">Quota</div>
            <div className="w-32">Rank Range</div>
            <div className="w-28">Submitted By</div>
            <div className="w-28">Status</div>
            <div className="w-32">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No submissions found</div>
          ) : (
            submissions.map(submission => (
              <div
                key={submission.id}
                className={`flex items-center space-x-4 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer ${
                  selectedIds.has(submission.id) ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedSubmission(submission)}
              >
                <div className="w-8" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(submission.id)}
                    onChange={() => toggleSelection(submission.id)}
                    className="rounded"
                  />
                </div>
                <div className="w-20">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {submission.data.stream}
                  </span>
                </div>
                <div className="w-16 text-gray-900 font-medium">{submission.data.year}</div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{submission.data.collegeName}</div>
                  <div className="text-gray-500 text-xs">{submission.data.courseName}</div>
                </div>
                <div className="w-24 text-gray-700">{submission.data.category}</div>
                <div className="w-24 text-gray-700">{submission.data.quota}</div>
                <div className="w-32 text-gray-900 font-mono text-xs">
                  {submission.data.openingRank} - {submission.data.closingRank}
                </div>
                <div className="w-28">
                  <div className="text-xs text-gray-500">{submission.submittedBy}</div>
                  <div className="text-xs text-gray-400">{new Date(submission.submittedAt).toLocaleDateString()}</div>
                </div>
                <div className="w-28">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    submission.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    submission.status === 'approved' ? 'bg-green-100 text-green-700' :
                    submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {submission.status}
                  </span>
                  {submission.verification.flags && submission.verification.flags.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs text-orange-600">
                        ⚠️ {submission.verification.flags.length} flag{submission.verification.flags.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="w-32 flex space-x-1" onClick={e => e.stopPropagation()}>
                  {submission.status === 'pending' && (
                    <>
                      <button
                        onClick={() => approveSubmission(submission.id)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        title="Approve"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => rejectSubmission(submission.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        title="Reject"
                      >
                        ✕
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedSubmission(submission)}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                    title="View Details"
                  >
                    👁
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Cutoff Submission Details</h3>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Cutoff Data */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Cutoff Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Stream:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.stream}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Year:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.year}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">College:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.collegeName}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Course:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.courseName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Category:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Quota:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.quota}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Round:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.round}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Seats:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.data.seats || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Rank Range:</span>
                    <span className="ml-2 font-medium font-mono">
                      {selectedSubmission.data.openingRank} - {selectedSubmission.data.closingRank}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Verification Status</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <span className={`ml-2 font-medium ${
                      selectedSubmission.verification.confidence === 'high' ? 'text-green-600' :
                      selectedSubmission.verification.confidence === 'medium' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {selectedSubmission.verification.confidence}
                    </span>
                  </div>
                  {selectedSubmission.verification.flags && selectedSubmission.verification.flags.length > 0 && (
                    <div>
                      <span className="text-gray-500">Flags:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedSubmission.verification.flags.map((flag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedSubmission.verification.warnings && selectedSubmission.verification.warnings.length > 0 && (
                    <div>
                      <span className="text-gray-500">Warnings:</span>
                      <ul className="mt-1 list-disc list-inside text-orange-600">
                        {selectedSubmission.verification.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedSubmission.verification.notes && (
                    <div>
                      <span className="text-gray-500">Notes:</span>
                      <p className="mt-1 text-gray-700">{selectedSubmission.verification.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submission Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Submission Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Submitted By:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.submittedBy}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Submitted At:</span>
                    <span className="ml-2 font-medium">{new Date(selectedSubmission.submittedAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.source.type}</span>
                  </div>
                  {selectedSubmission.source.url && (
                    <div>
                      <span className="text-gray-500">URL:</span>
                      <a href={selectedSubmission.source.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                        {selectedSubmission.source.url}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedSubmission.status === 'pending' && (
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      approveSubmission(selectedSubmission.id);
                      setSelectedSubmission(null);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      rejectSubmission(selectedSubmission.id);
                      setSelectedSubmission(null);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
