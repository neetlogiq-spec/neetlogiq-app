/**
 * User Stream Change Manager (Admin)
 *
 * Allows admins to view and process stream change requests from users
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Mail, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StreamChangeRequest {
  id: string;
  user_id: string;
  user_email: string;
  current_stream: string;
  requested_stream: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function UserStreamChangeManager() {
  const [requests, setRequests] = useState<StreamChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<StreamChangeRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/admin/stream-changes?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading stream change requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: StreamChangeRequest) => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/admin/stream-changes/${request.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ adminNotes })
      });

      if (response.ok) {
        alert('Stream change approved successfully!');
        setSelectedRequest(null);
        setAdminNotes('');
        loadRequests();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: StreamChangeRequest) => {
    if (!adminNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/admin/stream-changes/${request.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ adminNotes })
      });

      if (response.ok) {
        alert('Stream change rejected successfully!');
        setSelectedRequest(null);
        setAdminNotes('');
        loadRequests();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  const getStreamLabel = (stream: string) => {
    const labels: Record<string, string> = {
      'UG': 'Undergraduate',
      'PG_MEDICAL': 'PG Medical',
      'PG_DENTAL': 'PG Dental'
    };
    return labels[stream] || stream;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Stream Change Requests</h2>
        <p className="mt-2 text-gray-600">
          Manage user requests to change their locked stream selection
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No {filter !== 'all' && filter} requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{request.user_email}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Requested {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {getStatusBadge(request.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-500">Current Stream:</span>
                  <div className="font-semibold text-gray-900">{getStreamLabel(request.current_stream)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Requested Stream:</span>
                  <div className="font-semibold text-blue-600">{getStreamLabel(request.requested_stream)}</div>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-sm text-gray-500">Reason:</span>
                <p className="mt-1 text-gray-900 bg-gray-50 p-3 rounded border border-gray-200">
                  {request.reason}
                </p>
              </div>

              {request.admin_notes && (
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Admin Notes:</span>
                  <p className="mt-1 text-gray-900 bg-blue-50 p-3 rounded border border-blue-200">
                    {request.admin_notes}
                  </p>
                </div>
              )}

              {request.status === 'pending' && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                  {selectedRequest?.id === request.id ? (
                    <div className="flex-1 space-y-3">
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes (optional for approval, required for rejection)..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          {processing ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          disabled={processing}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          {processing ? 'Processing...' : 'Reject'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequest(null);
                            setAdminNotes('');
                          }}
                          disabled={processing}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Process Request
                    </button>
                  )}
                </div>
              )}

              {request.processed_at && (
                <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
                  Processed on {new Date(request.processed_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
