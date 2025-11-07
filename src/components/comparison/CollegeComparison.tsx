'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, BarChart3, MapPin, Users, Award, BookOpen, DollarSign, Star, CheckCircle } from 'lucide-react';
import { apiService } from '@/services/api';

interface College {
  id: number;
  name: string;
  city: string;
  state: string;
  stream: string;
  management_type: string;
  establishment_year: number;
  university: string;
  website: string;
  email: string;
  phone: string;
  accreditation: string;
  status: string;
  rating?: number;
  fees?: string;
  total_seats?: number;
  cutoff_rank?: number;
}

interface ComparisonItem {
  college: College;
  courses: any[];
  cutoffs: any[];
}

const CollegeComparison: React.FC = () => {
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [availableColleges, setAvailableColleges] = useState<College[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadColleges();
  }, []);

  const loadColleges = async () => {
    try {
      const response = await apiService.getColleges({ limit: 100 });
      if (response.success) {
        setAvailableColleges(response.data);
      }
    } catch (error) {
      console.error('Error loading colleges:', error);
    }
  };

  const addToComparison = (college: College) => {
    if (comparisonItems.length >= 4) {
      alert('Maximum 4 colleges can be compared at once');
      return;
    }

    if (comparisonItems.some(item => item.college.id === college.id)) {
      alert('College already added to comparison');
      return;
    }

    setComparisonItems([...comparisonItems, { college, courses: [], cutoffs: [] }]);
    setShowSearch(false);
    setSearchQuery('');
  };

  const removeFromComparison = (collegeId: number) => {
    setComparisonItems(comparisonItems.filter(item => item.college.id !== collegeId));
  };

  const filteredColleges = availableColleges.filter(college =>
    college.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    college.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    college.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ComparisonCard: React.FC<{ item: ComparisonItem; index: number }> = ({ item, index }) => {
    const { college } = item;
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
              {college.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {college.city}, {college.state}
            </p>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                {college.stream}
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
                {college.management_type}
              </span>
            </div>
          </div>
          <button
            onClick={() => removeFromComparison(college.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center text-sm">
            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Est. {college.establishment_year}</span>
          </div>
          
          <div className="flex items-center text-sm">
            <Award className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">{college.university}</span>
          </div>

          <div className="flex items-center text-sm">
            <CheckCircle className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">{college.accreditation}</span>
          </div>

          {college.rating && (
            <div className="flex items-center text-sm">
              <Star className="h-4 w-4 text-yellow-400 mr-2" />
              <span className="text-gray-600 dark:text-gray-400">{college.rating}/5</span>
            </div>
          )}
        </div>

        <button className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm">
          View Details
        </button>
      </div>
    );
  };

  const ComparisonTable: React.FC = () => {
    if (comparisonItems.length < 2) return null;

    const features = [
      { key: 'name', label: 'College Name', icon: Award },
      { key: 'location', label: 'Location', icon: MapPin },
      { key: 'stream', label: 'Stream', icon: BookOpen },
      { key: 'management_type', label: 'Management', icon: Users },
      { key: 'establishment_year', label: 'Established', icon: BarChart3 },
      { key: 'university', label: 'University', icon: Award },
      { key: 'accreditation', label: 'Accreditation', icon: CheckCircle },
    ];

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detailed Comparison</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Feature
                </th>
                {comparisonItems.map((item, index) => (
                  <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    College {index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {features.map((feature) => (
                <tr key={feature.key}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <feature.icon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {feature.label}
                      </span>
                    </div>
                  </td>
                  {comparisonItems.map((item, index) => (
                    <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {feature.key === 'location' 
                        ? `${item.college.city}, ${item.college.state}`
                        : item.college[feature.key as keyof College]
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">College Comparison</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Compare up to 4 colleges side by side
          </p>
        </div>
        <button
          onClick={() => setShowSearch(true)}
          disabled={comparisonItems.length >= 4}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add College
        </button>
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-96 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search Colleges</h3>
              <button
                onClick={() => setShowSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Search by name, city, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredColleges.slice(0, 10).map((college) => (
                <div
                  key={college.id}
                  onClick={() => addToComparison(college)}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                >
                  <h4 className="font-medium text-gray-900 dark:text-white">{college.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {college.city}, {college.state} • {college.stream} • {college.management_type}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Cards */}
      {comparisonItems.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No colleges selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Add colleges to start comparing them
          </p>
          <button
            onClick={() => setShowSearch(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add First College
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {comparisonItems.map((item, index) => (
              <ComparisonCard key={item.college.id} item={item} index={index} />
            ))}
          </div>

          {/* Detailed Comparison Table */}
          <ComparisonTable />
        </>
      )}
    </div>
  );
};

export default CollegeComparison;
