import React, { useState, useEffect } from 'react';
import { MasterDataManager, PendingReview, ImportBatch, AuditTrail } from '../services/master-data-architecture';

interface AdminMasterDataProps {
  masterDataManager: MasterDataManager;
}

interface PasswordPromptProps {
  onAuthenticated: () => void;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real implementation, validate against secure hash
    const ADMIN_PASSWORD = 'neetlogiq_master_2024'; // This should be from env variables
    
    if (password === ADMIN_PASSWORD) {
      onAuthenticated();
    } else {
      setError('Invalid password. Access denied.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            🔐 Master Data Administration
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            This area is restricted to authorized administrators only
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Administrator Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}
          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              🔑 Access Master Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminMasterData: React.FC<AdminMasterDataProps> = ({ masterDataManager }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'batches' | 'master' | 'audit'>('pending');
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'pending':
          const reviews = await masterDataManager.getPendingReviews();
          setPendingReviews(reviews);
          break;
        case 'batches':
          const batches = await masterDataManager.getAllBatches();
          setImportBatches(batches);
          break;
        case 'audit':
          // Load audit trail for all entity types
          const audit = await masterDataManager.getAuditTrail('all');
          setAuditTrail(audit);
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: number, notes?: string) => {
    const success = await masterDataManager.approvePendingReview(reviewId, 'admin', notes);
    if (success) {
      loadData(); // Refresh the list
    }
  };

  const handleRejectReview = async (reviewId: number, notes?: string) => {
    const success = await masterDataManager.rejectPendingReview(reviewId, 'admin', notes);
    if (success) {
      loadData(); // Refresh the list
    }
  };

  if (!isAuthenticated) {
    return <PasswordPrompt onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="px-4 sm:px-6 lg:max-w-6xl lg:mx-auto lg:px-8">
          <div className="py-6 md:flex md:items-center md:justify-between lg:border-t lg:border-gray-200">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <div>
                  <div className="flex items-center">
                    <h1 className="ml-3 text-2xl font-bold leading-7 text-gray-900 sm:leading-9 sm:truncate">
                      🏗️ Master Data Administration
                    </h1>
                  </div>
                  <dl className="mt-6 flex flex-col sm:ml-3 sm:mt-1 sm:flex-row sm:flex-wrap">
                    <dt className="sr-only">Status</dt>
                    <dd className="flex items-center text-sm text-gray-500 font-medium capitalize sm:mr-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        🔐 Authenticated
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-10">
        <div className="max-w-3xl mx-auto sm:px-6 lg:max-w-7xl lg:px-8 lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="hidden lg:block lg:col-span-3 xl:col-span-2">
            <nav aria-label="Sidebar" className="sticky top-4 divide-y divide-gray-300">
              <div className="pb-8 space-y-1">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`w-full text-left group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'pending'
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  ⚠️ Pending Reviews ({pendingReviews.filter(r => r.status === 'PENDING').length})
                </button>
                <button
                  onClick={() => setActiveTab('batches')}
                  className={`w-full text-left group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'batches'
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📊 Import Batches
                </button>
                <button
                  onClick={() => setActiveTab('master')}
                  className={`w-full text-left group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'master'
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📝 Master Data
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full text-left group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === 'audit'
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📋 Audit Trail
                </button>
              </div>
            </nav>
          </div>

          <main className="lg:col-span-9 xl:col-span-10">
            <div className="px-4 sm:px-0">
              {activeTab === 'pending' && (
                <PendingReviewsTab
                  reviews={pendingReviews}
                  onApprove={handleApproveReview}
                  onReject={handleRejectReview}
                  loading={loading}
                />
              )}
              {activeTab === 'batches' && (
                <ImportBatchesTab batches={importBatches} loading={loading} />
              )}
              {activeTab === 'master' && (
                <MasterDataTab masterDataManager={masterDataManager} />
              )}
              {activeTab === 'audit' && (
                <AuditTrailTab auditTrail={auditTrail} loading={loading} />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

interface PendingReviewsTabProps {
  reviews: PendingReview[];
  onApprove: (id: number, notes?: string) => void;
  onReject: (id: number, notes?: string) => void;
  loading: boolean;
}

const PendingReviewsTab: React.FC<PendingReviewsTabProps> = ({ reviews, onApprove, onReject, loading }) => {
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'NEW_ENTRY': return '✨';
      case 'LOW_CONFIDENCE': return '🤔';
      case 'DUPLICATE': return '👥';
      case 'AMBIGUOUS': return '❓';
      default: return '📝';
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'STATE': return '🌍';
      case 'COLLEGE': return '🏫';
      case 'COURSE': return '📚';
      case 'CATEGORY': return '👤';
      case 'QUOTA': return '🎯';
      default: return '📄';
    }
  };

  return (
    <div>
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            ⚠️ Pending Reviews
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="mt-6">
          {reviews.filter(r => r.status === 'PENDING').length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pending reviews</h3>
              <p className="mt-1 text-sm text-gray-500">All items have been processed!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.filter(r => r.status === 'PENDING').map((review) => (
                <div key={review.id} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{getTypeIcon(review.type)}</span>
                        <div>
                          <h3 className="text-lg leading-6 font-medium text-gray-900">
                            {getEntityIcon(review.entity_type)} {review.type.replace('_', ' ')} - {review.entity_type}
                          </h3>
                          <p className="mt-1 max-w-2xl text-sm text-gray-500">
                            Created {review.created_at.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {review.confidence_score && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            review.confidence_score >= 0.8
                              ? 'bg-green-100 text-green-800'
                              : review.confidence_score >= 0.6
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {Math.round(review.confidence_score * 100)}% confidence
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900">Raw Data:</h4>
                      <pre className="mt-1 text-sm text-gray-500 bg-gray-50 p-3 rounded">
                        {JSON.stringify(review.raw_data, null, 2)}
                      </pre>
                    </div>

                    {review.potential_matches && review.potential_matches.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900">Potential Matches:</h4>
                        <div className="mt-2 space-y-2">
                          {review.potential_matches.map((match, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-blue-50 p-2 rounded">
                              <span className="text-sm">{match.name}</span>
                              <span className="text-sm text-blue-600 font-medium">
                                {Math.round(match.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <label htmlFor={`notes-${review.id}`} className="block text-sm font-medium text-gray-700">
                        Review Notes
                      </label>
                      <textarea
                        id={`notes-${review.id}`}
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Add notes about your decision..."
                        value={reviewNotes[review.id] || ''}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [review.id]: e.target.value }))}
                      />
                    </div>

                    <div className="mt-4 flex justify-end space-x-3">
                      <button
                        onClick={() => onReject(review.id, reviewNotes[review.id])}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        ❌ Reject
                      </button>
                      <button
                        onClick={() => onApprove(review.id, reviewNotes[review.id])}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        ✅ Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ImportBatchesTab: React.FC<{ batches: ImportBatch[]; loading: boolean }> = ({ batches, loading }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PROCESSING': return '⏳';
      case 'COMPLETED': return '✅';
      case 'FAILED': return '❌';
      default: return '📄';
    }
  };

  return (
    <div>
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            📊 Import Batches
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="mt-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul role="list" className="divide-y divide-gray-200">
              {batches.map((batch) => (
                <li key={batch.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xl mr-3">{getStatusIcon(batch.status)}</span>
                        <div>
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {batch.file_name || batch.id}
                          </p>
                          <p className="text-sm text-gray-500">
                            {batch.type} • Started {batch.started_at.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900">
                          {batch.processed_records}/{batch.total_records} processed
                        </p>
                        <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${batch.progress_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex space-x-4">
                        <p className="flex items-center text-sm text-gray-500">
                          ✅ {batch.successful_matches} matches
                        </p>
                        <p className="flex items-center text-sm text-gray-500">
                          ❌ {batch.validation_errors} errors
                        </p>
                        <p className="flex items-center text-sm text-gray-500">
                          ⚠️ {batch.pending_reviews} pending reviews
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const MasterDataTab: React.FC<{ masterDataManager: MasterDataManager }> = ({ masterDataManager }) => {
  return (
    <div>
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            📝 Master Data Management
          </h2>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-gray-500">Master data editing interface will be implemented here.</p>
        <p className="text-sm text-gray-400 mt-2">
          This will include CRUD operations for States, Colleges, Courses, Categories, and Quotas.
        </p>
      </div>
    </div>
  );
};

const AuditTrailTab: React.FC<{ auditTrail: AuditTrail[]; loading: boolean }> = ({ auditTrail, loading }) => {
  return (
    <div>
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            📋 Audit Trail
          </h2>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-gray-500">Audit trail viewing interface will be implemented here.</p>
        <p className="text-sm text-gray-400 mt-2">
          This will show all changes made to master data with timestamps, users, and confidence scores.
        </p>
      </div>
    </div>
  );
};

export default AdminMasterData;