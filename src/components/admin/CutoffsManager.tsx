'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Filter, X, Save, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface Course {
  id: string;
  name: string;
}

interface Cutoff {
  id: string;
  college_id: string;
  course_id: string;
  year: number;
  round: number;
  category: string;
  quota: string;
  state?: string;
  opening_rank: number;
  closing_rank: number;
  seats?: number;
  seats_filled?: number;
  colleges?: College;
  courses?: Course;
}

interface EditingCell {
  rowId: string;
  field: string;
  value: any;
}

const CutoffsManager: React.FC = () => {
  const [cutoffs, setCutoffs] = useState<Cutoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    year: '',
    category: '',
    collegeId: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedCutoff, setSelectedCutoff] = useState<Cutoff | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Fetch cutoffs
  const fetchCutoffs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.year && { year: filters.year }),
        ...(filters.category && { category: filters.category }),
        ...(filters.collegeId && { collegeId: filters.collegeId })
      });

      const response = await fetch(`/api/admin/cutoffs?${params}`);
      const data = await response.json();

      if (data.success) {
        setCutoffs(data.data);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching cutoffs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCutoffs();
  }, [pagination.page, filters]);

  // Quick edit - inline cell editing
  const handleCellEdit = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field, value: currentValue });
  };

  const handleCellSave = async (cutoffId: string, field: string, newValue: any) => {
    try {
      const response = await fetch(`/api/admin/cutoffs/${cutoffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue })
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setCutoffs(prev =>
          prev.map(c => (c.id === cutoffId ? { ...c, [field]: newValue } : c))
        );
        setEditingCell(null);

        // Show success notification
        showNotification('Updated successfully!', 'success');
      } else {
        showNotification(data.error || 'Failed to update', 'error');
      }
    } catch (error) {
      showNotification('Failed to update cutoff', 'error');
      console.error('Error updating cutoff:', error);
    }
  };

  // Delete cutoff
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cutoff record?')) return;

    try {
      const response = await fetch(`/api/admin/cutoffs/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setCutoffs(prev => prev.filter(c => c.id !== id));
        showNotification('Cutoff deleted successfully', 'success');
      } else {
        showNotification(data.error || 'Failed to delete', 'error');
      }
    } catch (error) {
      showNotification('Failed to delete cutoff', 'error');
      console.error('Error deleting cutoff:', error);
    }
  };

  // Simple notification (you can replace with toast library)
  const showNotification = (message: string, type: 'success' | 'error') => {
    // Placeholder - implement with react-hot-toast or similar
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  };

  // Filtered cutoffs based on search
  const filteredCutoffs = cutoffs.filter(cutoff => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cutoff.colleges?.name.toLowerCase().includes(search) ||
      cutoff.colleges?.city.toLowerCase().includes(search) ||
      cutoff.courses?.name.toLowerCase().includes(search) ||
      cutoff.category.toLowerCase().includes(search)
    );
  });

  // Editable cell component
  const EditableCell: React.FC<{
    cutoff: Cutoff;
    field: string;
    value: any;
    type?: 'text' | 'number';
  }> = ({ cutoff, field, value, type = 'text' }) => {
    const isEditing = editingCell?.rowId === cutoff.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center space-x-1">
          <input
            type={type}
            value={editingCell.value ?? ''}
            onChange={(e) =>
              setEditingCell({
                ...editingCell,
                value: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
              })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCellSave(cutoff.id, field, editingCell.value);
              } else if (e.key === 'Escape') {
                setEditingCell(null);
              }
            }}
            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            autoFocus
          />
          <button
            onClick={() => handleCellSave(cutoff.id, field, editingCell.value)}
            className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEditingCell(null)}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={() => handleCellEdit(cutoff.id, field, value)}
        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
      >
        {value ?? '-'}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by college, course, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-3 rounded-xl font-medium transition-all ${
                showFilters
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Cutoff
            </button>
            <button className="flex items-center px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year
                </label>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white"
                >
                  <option value="">All Years</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                  <option value="2021">2021</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  <option value="GENERAL">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>
              <div>
                <button
                  onClick={() => setFilters({ year: '', category: '', collegeId: '' })}
                  className="mt-7 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCutoffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Filter className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No cutoffs found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      College
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Seats
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Opening Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Closing Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Round
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCutoffs.map((cutoff) => (
                    <tr
                      key={cutoff.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {cutoff.colleges?.name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {cutoff.colleges?.city}, {cutoff.colleges?.state}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {cutoff.courses?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {cutoff.year}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {cutoff.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <EditableCell cutoff={cutoff} field="seats" value={cutoff.seats} type="number" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <EditableCell cutoff={cutoff} field="opening_rank" value={cutoff.opening_rank} type="number" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <EditableCell cutoff={cutoff} field="closing_rank" value={cutoff.closing_rank} type="number" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {cutoff.round}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedCutoff(cutoff);
                            setShowEditModal(true);
                          }}
                          className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cutoff.id)}
                          className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Edit2 className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Quick Edit Tip
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click on any <strong>Seats, Opening Rank, or Closing Rank</strong> cell to edit it inline.
              Press Enter to save or Escape to cancel. For detailed edits, use the Edit button.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CutoffsManager;
