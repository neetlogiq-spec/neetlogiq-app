'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Building2, MapPin, Globe, Mail, Phone, Calendar, Award } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';

interface College {
  id?: string;
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

interface CollegeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (college: College) => void;
  college?: College | null;
  mode: 'create' | 'edit';
}

const CollegeModal: React.FC<CollegeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  college,
  mode
}) => {
  const [formData, setFormData] = useState<College>({
    name: '',
    city: '',
    state: '',
    type: 'Medical',
    ownership: 'Government',
    established_year: undefined,
    website: '',
    contact_email: '',
    contact_phone: '',
    total_seats: undefined,
    nirf_rank: undefined,
    accreditation: '',
    address: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (college && mode === 'edit') {
      setFormData(college);
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        city: '',
        state: '',
        type: 'Medical',
        ownership: 'Government',
        established_year: undefined,
        website: '',
        contact_email: '',
        contact_phone: '',
        total_seats: undefined,
        nirf_rank: undefined,
        accreditation: '',
        address: ''
      });
    }
    setErrors({});
  }, [college, mode, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'College name is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Invalid email format';
    }

    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'Website must start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      showError('Please fix the validation errors');
      return;
    }

    setLoading(true);

    try {
      const url = mode === 'create'
        ? '/api/admin/colleges'
        : `/api/admin/colleges/${college?.id}`;

      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(
          mode === 'create'
            ? 'College created successfully!'
            : 'College updated successfully!'
        );
        onSuccess(data.data);
        onClose();
      } else {
        showError(data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving college:', error);
      showError('Failed to save college');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof College, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mode === 'create' ? 'Add New College' : 'Edit College'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mode === 'create' ? 'Enter college details' : 'Update college information'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Basic Information</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    College Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    placeholder="e.g., All India Institute of Medical Sciences"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleChange('type', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Dental">Dental</option>
                    <option value="AYUSH">AYUSH</option>
                    <option value="Veterinary">Veterinary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ownership <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.ownership}
                    onChange={(e) => handleChange('ownership', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Government">Government</option>
                    <option value="Private">Private</option>
                    <option value="Deemed">Deemed University</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Location</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                      errors.city ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    placeholder="e.g., New Delhi"
                  />
                  {errors.city && (
                    <p className="text-red-500 text-sm mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                      errors.state ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    placeholder="e.g., Delhi"
                  />
                  {errors.state && (
                    <p className="text-red-500 text-sm mt-1">{errors.state}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address
                  </label>
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Full address"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Phone className="h-5 w-5" />
                <span>Contact Information</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Globe className="inline h-4 w-4 mr-1" />
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                      errors.website ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    placeholder="https://example.com"
                  />
                  {errors.website && (
                    <p className="text-red-500 text-sm mt-1">{errors.website}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => handleChange('contact_email', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                      errors.contact_email ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    placeholder="contact@example.com"
                  />
                  {errors.contact_email && (
                    <p className="text-red-500 text-sm mt-1">{errors.contact_email}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone || ''}
                    onChange={(e) => handleChange('contact_phone', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Award className="h-5 w-5" />
                <span>Additional Details</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Established Year
                  </label>
                  <input
                    type="number"
                    value={formData.established_year || ''}
                    onChange={(e) => handleChange('established_year', parseInt(e.target.value) || undefined)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="2000"
                    min="1800"
                    max={new Date().getFullYear()}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Total Seats
                  </label>
                  <input
                    type="number"
                    value={formData.total_seats || ''}
                    onChange={(e) => handleChange('total_seats', parseInt(e.target.value) || undefined)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="200"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    NIRF Rank
                  </label>
                  <input
                    type="number"
                    value={formData.nirf_rank || ''}
                    onChange={(e) => handleChange('nirf_rank', parseInt(e.target.value) || undefined)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="1"
                    min="1"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Accreditation
                  </label>
                  <input
                    type="text"
                    value={formData.accreditation || ''}
                    onChange={(e) => handleChange('accreditation', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., NAAC A++, NBA"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{mode === 'create' ? 'Create College' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CollegeModal;
