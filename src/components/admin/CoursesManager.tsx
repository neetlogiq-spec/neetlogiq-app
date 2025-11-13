'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, BookOpen, Award, Clock, Download } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { exportToCSV } from '@/lib/csv-utils';

interface Course {
  id: string;
  name: string;
  description?: string;
  duration_years?: number;
  degree_type: string;
}

const CoursesManager: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Course>({
    id: '',
    name: '',
    description: '',
    duration_years: 5,
    degree_type: 'MBBS'
  });

  // Fetch courses
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '1000',
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/admin/courses?${params}`);
      const data = await response.json();

      if (data.success) {
        setCourses(data.data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCourses();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  // Create/Update course
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.degree_type) {
      showError('Name and degree type are required');
      return;
    }

    try {
      const url = editing
        ? `/api/admin/courses/${editing}`
        : '/api/admin/courses';

      const method = editing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(editing ? 'Course updated successfully!' : 'Course created successfully!');
        setFormData({ id: '', name: '', description: '', duration_years: 5, degree_type: 'MBBS' });
        setEditing(null);
        fetchCourses();
      } else {
        showError(data.error || 'Operation failed');
      }
    } catch (error) {
      showError('Failed to save course');
      console.error('Error saving course:', error);
    }
  };

  // Edit course
  const handleEdit = (course: Course) => {
    setFormData(course);
    setEditing(course.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete course
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all associated cutoff records.`)) return;

    try {
      const response = await fetch(`/api/admin/courses/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setCourses(prev => prev.filter(c => c.id !== id));
        showSuccess('Course deleted successfully');
      } else {
        showError(data.error || 'Failed to delete');
      }
    } catch (error) {
      showError('Failed to delete course');
      console.error('Error deleting course:', error);
    }
  };

  // CSV Export
  const handleExport = () => {
    const exportData = courses.map(course => ({
      name: course.name,
      degree_type: course.degree_type,
      duration_years: course.duration_years || '',
      description: course.description || ''
    }));

    const filename = `courses-export-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(exportData, filename);
    showSuccess(`Exported ${courses.length} courses to CSV`);
  };

  const cancelEdit = () => {
    setFormData({ id: '', name: '', description: '', duration_years: 5, degree_type: 'MBBS' });
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {editing ? 'Edit Course' : 'Add New Course'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {editing ? 'Update course details' : 'Create a new course'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Bachelor of Medicine, Bachelor of Surgery"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Degree Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.degree_type}
                onChange={(e) => setFormData({ ...formData, degree_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="MBBS">MBBS</option>
                <option value="BDS">BDS</option>
                <option value="BAMS">BAMS</option>
                <option value="BHMS">BHMS</option>
                <option value="BUMS">BUMS</option>
                <option value="BVSc">BVSc</option>
                <option value="MD">MD</option>
                <option value="MS">MS</option>
                <option value="MDS">MDS</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration (Years)
              </label>
              <input
                type="number"
                value={formData.duration_years || ''}
                onChange={(e) => setFormData({ ...formData, duration_years: parseInt(e.target.value) || undefined })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="5"
                min="1"
                max="10"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the course..."
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4">
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center space-x-2"
            >
              <BookOpen className="h-4 w-4" />
              <span>{editing ? 'Update Course' : 'Add Course'}</span>
            </button>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Search & List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6 flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white transition-all"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all whitespace-nowrap"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Courses</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{courses.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 dark:text-green-400 text-sm font-medium">MBBS/BDS</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                  {courses.filter(c => ['MBBS', 'BDS'].includes(c.degree_type)).length}
                </p>
              </div>
              <Award className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">Postgraduate</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                  {courses.filter(c => ['MD', 'MS', 'MDS'].includes(c.degree_type)).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <BookOpen className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No courses found</p>
            <p className="text-sm">Add your first course using the form above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Course Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Degree Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {courses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {course.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {course.degree_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {course.duration_years ? `${course.duration_years} years` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {course.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(course)}
                        className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(course.id, course.name)}
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
        )}
      </div>
    </div>
  );
};

export default CoursesManager;
