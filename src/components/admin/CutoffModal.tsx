'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, BarChart3, Building2, BookOpen, Calendar, TrendingUp } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';

interface Cutoff {
  id?: string;
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
}

interface College {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
}

interface CutoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cutoff: Cutoff) => void;
  cutoff?: Cutoff | null;
  mode: 'create' | 'edit';
}

const CutoffModal: React.FC<CutoffModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  cutoff,
  mode
}) => {
  const [formData, setFormData] = useState<Cutoff>({
    college_id: '',
    course_id: '',
    year: new Date().getFullYear(),
    round: 1,
    category: 'GENERAL',
    quota: 'All India',
    state: '',
    opening_rank: 0,
    closing_rank: 0,
    seats: undefined,
    seats_filled: undefined
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [colleges, setColleges] = useState<College[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch colleges and courses
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [collegesRes, coursesRes] = await Promise.all([
          fetch('/api/admin/colleges?limit=1000'),
          fetch('/api/admin/courses?limit=1000')
        ]);

        const collegesData = await collegesRes.json();
        const coursesData = await coursesRes.json();

        if (collegesData.success) {
          setColleges(collegesData.data);
        }

        if (coursesData.success) {
          setCourses(coursesData.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to load colleges and courses');
      } finally {
        setLoadingData(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (cutoff && mode === 'edit') {
      setFormData(cutoff);
    } else {
      setFormData({
        college_id: '',
        course_id: '',
        year: new Date().getFullYear(),
        round: 1,
        category: 'GENERAL',
        quota: 'All India',
        state: '',
        opening_rank: 0,
        closing_rank: 0,
        seats: undefined,
        seats_filled: undefined
      });
    }
    setErrors({});
  }, [cutoff, mode, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.college_id) {
      newErrors.college_id = 'College is required';
    }

    if (!formData.course_id) {
      newErrors.course_id = 'Course is required';
    }

    if (formData.opening_rank < 0) {
      newErrors.opening_rank = 'Opening rank must be positive';
    }

    if (formData.closing_rank < 0) {
      newErrors.closing_rank = 'Closing rank must be positive';
    }

    if (formData.opening_rank > formData.closing_rank) {
      newErrors.closing_rank = 'Closing rank must be greater than opening rank';
    }

    if (formData.seats !== undefined && formData.seats < 0) {
      newErrors.seats = 'Seats must be positive';
    }

    if (formData.seats_filled !== undefined && formData.seats_filled < 0) {
      newErrors.seats_filled = 'Seats filled must be positive';
    }

    if (formData.seats !== undefined && formData.seats_filled !== undefined && formData.seats_filled > formData.seats) {
      newErrors.seats_filled = 'Seats filled cannot exceed total seats';
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
        ? '/api/admin/cutoffs'
        : `/api/admin/cutoffs/${cutoff?.id}`;

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
            ? 'Cutoff record created successfully!'
            : 'Cutoff record updated successfully!'
        );
        onSuccess(data.data);
        onClose();
      } else {
        showError(data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving cutoff:', error);
      showError('Failed to save cutoff');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Cutoff, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
              <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mode === 'create' ? 'Add New Cutoff' : 'Edit Cutoff'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mode === 'create' ? 'Enter cutoff details' : 'Update cutoff information'}
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
            {loadingData ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* College & Course */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Building2 className="h-5 w-5" />
                    <span>College & Course</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        College <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.college_id}
                        onChange={(e) => handleChange('college_id', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                          errors.college_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        disabled={mode === 'edit'}
                      >
                        <option value="">Select College</option>
                        {colleges.map(college => (
                          <option key={college.id} value={college.id}>
                            {college.name}
                          </option>
                        ))}
                      </select>
                      {errors.college_id && (
                        <p className="text-red-500 text-sm mt-1">{errors.college_id}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Course <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.course_id}
                        onChange={(e) => handleChange('course_id', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                          errors.course_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        disabled={mode === 'edit'}
                      >
                        <option value="">Select Course</option>
                        {courses.map(course => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                      {errors.course_id && (
                        <p className="text-red-500 text-sm mt-1">{errors.course_id}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Exam Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Exam Details</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Year <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={(e) => handleChange('year', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        min="2000"
                        max={new Date().getFullYear() + 1}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Round <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.round}
                        onChange={(e) => handleChange('round', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={1}>Round 1</option>
                        <option value={2}>Round 2</option>
                        <option value={3}>Round 3</option>
                        <option value={4}>Round 4</option>
                        <option value={5}>Round 5</option>
                        <option value={6}>Mop-Up</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => handleChange('category', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="GENERAL">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                        <option value="EWS">EWS</option>
                        <option value="GENERAL-PH">General PH</option>
                        <option value="OBC-PH">OBC PH</option>
                        <option value="SC-PH">SC PH</option>
                        <option value="ST-PH">ST PH</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Quota <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.quota}
                        onChange={(e) => handleChange('quota', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="All India">All India</option>
                        <option value="State">State</option>
                        <option value="Deemed">Deemed</option>
                        <option value="Central Pool">Central Pool</option>
                        <option value="Management">Management</option>
                        <option value="NRI">NRI</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        State (for State quota)
                      </label>
                      <input
                        type="text"
                        value={formData.state || ''}
                        onChange={(e) => handleChange('state', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Delhi"
                      />
                    </div>
                  </div>
                </div>

                {/* Ranks & Seats */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Ranks & Seats</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Opening Rank <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.opening_rank}
                        onChange={(e) => handleChange('opening_rank', parseInt(e.target.value) || 0)}
                        className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                          errors.opening_rank ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        placeholder="1"
                        min="0"
                      />
                      {errors.opening_rank && (
                        <p className="text-red-500 text-sm mt-1">{errors.opening_rank}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Closing Rank <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.closing_rank}
                        onChange={(e) => handleChange('closing_rank', parseInt(e.target.value) || 0)}
                        className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                          errors.closing_rank ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        placeholder="100"
                        min="0"
                      />
                      {errors.closing_rank && (
                        <p className="text-red-500 text-sm mt-1">{errors.closing_rank}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Total Seats
                      </label>
                      <input
                        type="number"
                        value={formData.seats || ''}
                        onChange={(e) => handleChange('seats', parseInt(e.target.value) || undefined)}
                        className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                          errors.seats ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        placeholder="200"
                        min="0"
                      />
                      {errors.seats && (
                        <p className="text-red-500 text-sm mt-1">{errors.seats}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Seats Filled
                      </label>
                      <input
                        type="number"
                        value={formData.seats_filled || ''}
                        onChange={(e) => handleChange('seats_filled', parseInt(e.target.value) || undefined)}
                        className={`w-full px-4 py-3 border rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                          errors.seats_filled ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        placeholder="180"
                        min="0"
                      />
                      {errors.seats_filled && (
                        <p className="text-red-500 text-sm mt-1">{errors.seats_filled}</p>
                      )}
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
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>{mode === 'create' ? 'Create Cutoff' : 'Save Changes'}</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default CutoffModal;
