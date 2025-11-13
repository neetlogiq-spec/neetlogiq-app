'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Building2, MapPin, Phone, Mail, ExternalLink, X, Save } from 'lucide-react';
import CollegeModal from './CollegeModal';
import { showSuccess, showError } from '@/lib/toast';

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  ownership: string;
  established_year?: number;
  website?: string;
  contact_email?: string;
  contact_phone?: string;
  total_seats?: number;
  nirf_rank?: number;
  accreditation?: string;
  address?: string;
}

interface EditingCell {
  rowId: string;
  field: string;
  value: any;
}

const CollegesManager: React.FC = () => {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Fetch colleges
  const fetchColleges = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && { type: typeFilter }),
        ...(stateFilter && { state: stateFilter })
      });

      const response = await fetch(`/api/admin/colleges?${params}`);
      const data = await response.json();

      if (data.success) {
        setColleges(data.data);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchColleges();
    }, 300);

    return () => clearTimeout(debounce);
  }, [pagination.page, searchTerm, typeFilter, stateFilter]);

  // Quick edit
  const handleCellEdit = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field, value: currentValue });
  };

  const handleCellSave = async (collegeId: string, field: string, newValue: any) => {
    try {
      const response = await fetch(`/api/admin/colleges/${collegeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue })
      });

      const data = await response.json();

      if (data.success) {
        setColleges(prev =>
          prev.map(c => (c.id === collegeId ? { ...c, [field]: newValue } : c))
        );
        setEditingCell(null);
        showSuccess('Updated successfully!');
      } else {
        showError(data.error || 'Failed to update');
      }
    } catch (error) {
      showError('Failed to update college');
      console.error('Error updating college:', error);
    }
  };

  // Delete college
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated cutoff records.`)) return;

    try {
      const response = await fetch(`/api/admin/colleges/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setColleges(prev => prev.filter(c => c.id !== id));
        showSuccess('College deleted successfully');
      } else {
        showError(data.error || 'Failed to delete');
      }
    } catch (error) {
      showError('Failed to delete college');
      console.error('Error deleting college:', error);
    }
  };

  // Modal handlers
  const handleModalSuccess = (college: College) => {
    if (modalMode === 'create') {
      setColleges(prev => [college, ...prev]);
    } else {
      setColleges(prev =>
        prev.map(c => (c.id === college.id ? college : c))
      );
    }
    fetchColleges(); // Refresh to get updated data
  };

  const openCreateModal = () => {
    setSelectedCollege(null);
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (college: College) => {
    setSelectedCollege(college);
    setModalMode('edit');
    setShowModal(true);
  };

  // Editable cell component
  const EditableCell: React.FC<{
    college: College;
    field: string;
    value: any;
    type?: 'text' | 'number';
  }> = ({ college, field, value, type = 'text' }) => {
    const isEditing = editingCell?.rowId === college.id && editingCell?.field === field;

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
                handleCellSave(college.id, field, editingCell.value);
              } else if (e.key === 'Escape') {
                setEditingCell(null);
              }
            }}
            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            autoFocus
          />
          <button
            onClick={() => handleCellSave(college.id, field, editingCell.value)}
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
        onClick={() => handleCellEdit(college.id, field, value)}
        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
      >
        {value ?? '-'}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search colleges by name, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="Medical">Medical</option>
              <option value="Dental">Dental</option>
            </select>

            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All States</option>
              <option value="Delhi">Delhi</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="West Bengal">West Bengal</option>
            </select>

            <button
              onClick={openCreateModal}
              className="flex items-center px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add College
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Colleges</p>
              <p className="text-3xl font-bold mt-2">{pagination.total.toLocaleString()}</p>
            </div>
            <Building2 className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Government</p>
              <p className="text-3xl font-bold mt-2">
                {colleges.filter(c => c.ownership === 'Government').length}
              </p>
            </div>
            <Building2 className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Private</p>
              <p className="text-3xl font-bold mt-2">
                {colleges.filter(c => c.ownership === 'Private').length}
              </p>
            </div>
            <Building2 className="h-12 w-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">States Covered</p>
              <p className="text-3xl font-bold mt-2">
                {new Set(colleges.map(c => c.state)).size}
              </p>
            </div>
            <MapPin className="h-12 w-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : colleges.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Building2 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No colleges found</p>
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
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Ownership
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Total Seats
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      NIRF Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Established
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {colleges.map((college) => (
                    <tr
                      key={college.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {college.name}
                            </div>
                            {college.website && (
                              <a
                                href={college.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                              >
                                <span>Website</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-900 dark:text-white">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <div>{college.city}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{college.state}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          college.type === 'Medical'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {college.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          college.ownership === 'Government'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {college.ownership}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <EditableCell
                          college={college}
                          field="total_seats"
                          value={college.total_seats}
                          type="number"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <EditableCell
                          college={college}
                          field="nirf_rank"
                          value={college.nirf_rank}
                          type="number"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {college.established_year || '-'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(college)}
                          className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(college.id, college.name)}
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
                  onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* College Modal */}
      <CollegeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleModalSuccess}
        college={selectedCollege}
        mode={modalMode}
      />
    </div>
  );
};

export default CollegesManager;
