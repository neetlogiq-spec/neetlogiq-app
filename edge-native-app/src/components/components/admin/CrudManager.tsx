'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  Filter,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  MoreVertical
} from 'lucide-react';

interface CrudField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'date' | 'boolean' | 'file';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  validation?: (value: any) => string | null;
}

interface CrudAction {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  permission?: string;
  onClick: (item: any) => void;
}

interface CrudManagerProps {
  title: string;
  fields: CrudField[];
  data: any[];
  loading: boolean;
  searchFields: string[];
  actions?: CrudAction[];
  permissions: string[];
  onRefresh: () => void;
  onCreate?: (data: any) => Promise<void>;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onBulkAction?: (action: string, ids: string[]) => Promise<void>;
}

const CrudManager: React.FC<CrudManagerProps> = ({
  title,
  fields,
  data,
  loading,
  searchFields,
  actions = [],
  permissions,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onBulkAction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  // Initialize form data
  useEffect(() => {
    const initialData: any = {};
    fields.forEach(field => {
      initialData[field.key] = field.type === 'boolean' ? false : '';
    });
    setFormData(initialData);
  }, [fields]);

  // Filter and sort data
  const filteredData = React.useMemo(() => {
    const filtered = data.filter(item => {
      if (!searchTerm) return true;
      
      return searchFields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
      });
    });

    // Sort data
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, searchFields, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleInputChange = (field: CrudField, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field.key]: value
    }));

    // Clear error for this field
    if (formErrors[field.key]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field.key];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    fields.forEach(field => {
      const value = formData[field.key];
      
      // Required field validation
      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors[field.key] = `${field.label} is required`;
        return;
      }

      // Custom validation
      if (field.validation && value) {
        const error = field.validation(value);
        if (error) {
          errors[field.key] = error;
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      if (currentItem) {
        // Update
        if (onUpdate) {
          await onUpdate(currentItem.id, formData);
        }
        setShowEditModal(false);
      } else {
        // Create
        if (onCreate) {
          await onCreate(formData);
        }
        setShowCreateModal(false);
      }

      // Reset form
      const initialData: any = {};
      fields.forEach(field => {
        initialData[field.key] = field.type === 'boolean' ? false : '';
      });
      setFormData(initialData);
      setCurrentItem(null);
      
      // Refresh data
      onRefresh();
    } catch (error) {
      console.error('Error saving data:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: any) => {
    setCurrentItem(item);
    setFormData({ ...item });
    setShowEditModal(true);
  };

  const handleDelete = async (item: any) => {
    setDeleteItem(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (deleteItem && onDelete) {
      try {
        await onDelete(deleteItem.id);
        setShowDeleteConfirm(false);
        setDeleteItem(null);
        onRefresh();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleBulkSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedItems(prev => [...prev, id]);
    } else {
      setSelectedItems(prev => prev.filter(item => item !== id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedItems(filteredData.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const renderFormField = (field: CrudField) => {
    const value = formData[field.key] || '';
    const error = formErrors[field.key];

    const baseClassName = `w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
      error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
    }`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            placeholder={field.placeholder}
            className={baseClassName}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={baseClassName}
            required={field.required}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            className={baseClassName}
            required={field.required}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleInputChange(field, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200"
            />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {field.label}
            </span>
          </label>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            className={baseClassName}
            required={field.required}
          />
        );

      case 'file':
        return (
          <input
            type="file"
            onChange={(e) => handleInputChange(field, e.target.files?.[0])}
            className={baseClassName}
            required={field.required}
          />
        );

      default:
        return null;
    }
  };

  const renderCellValue = (item: any, field: CrudField) => {
    const value = item[field.key];
    
    switch (field.type) {
      case 'boolean':
        return value ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <X className="w-4 h-4 text-red-500" />
        );
      case 'date':
        return value ? new Date(value).toLocaleDateString() : '-';
      default:
        return value || '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <div className="flex items-center space-x-3">
          {permissions.includes('upload_data') && (
            <button
              onClick={() => console.log('Import data')}
              className="flex items-center px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </button>
          )}
          <button
            onClick={() => console.log('Export data')}
            className="flex items-center px-4 py-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          {onCreate && permissions.includes('edit_data') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search ${searchFields.join(', ')}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && onBulkAction && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                {selectedItems.length} items selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => onBulkAction('delete', selectedItems)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedItems([])}
                  className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {onBulkAction && (
                    <th className="px-6 py-3 w-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200"
                      />
                    </th>
                  )}
                  {fields.map(field => (
                    <th
                      key={field.key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort(field.key)}
                    >
                      <div className="flex items-center">
                        {field.label}
                        {sortField === field.key && (
                          <span className="ml-1">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  {(actions.length > 0 || onUpdate || onDelete) && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {onBulkAction && (
                      <td className="px-6 py-4 w-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={(e) => handleBulkSelect(item.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200"
                        />
                      </td>
                    )}
                    {fields.map(field => (
                      <td key={field.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {renderCellValue(item, field)}
                      </td>
                    ))}
                    {(actions.length > 0 || onUpdate || onDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Custom Actions */}
                          {actions.map(action => (
                            <button
                              key={action.key}
                              onClick={() => action.onClick(item)}
                              className={`text-${action.color}-600 hover:text-${action.color}-900 dark:text-${action.color}-400 dark:hover:text-${action.color}-300`}
                              title={action.label}
                            >
                              <action.icon className="w-4 h-4" />
                            </button>
                          ))}
                          
                          {/* Default Actions */}
                          {onUpdate && permissions.includes('edit_data') && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && permissions.includes('delete_data') && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={fields.length + (onBulkAction ? 1 : 0) + (actions.length > 0 || onUpdate || onDelete ? 1 : 0)} className="px-6 py-8 text-center">
                      <div className="text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'No matching results found' : 'No data available'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {currentItem ? 'Edit' : 'Create'} {title.slice(0, -1)}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setCurrentItem(null);
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {fields.map(field => (
                  <div key={field.key}>
                    {field.type !== 'boolean' && (
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                    )}
                    {renderFormField(field)}
                    {formErrors[field.key] && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {formErrors[field.key]}
                      </p>
                    )}
                  </div>
                ))}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setCurrentItem(null);
                      setFormErrors({});
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full"
            >
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Confirm Delete
                </h3>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this item? This action cannot be undone.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteItem(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CrudManager;