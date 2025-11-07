'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Users, Shield, Briefcase, Plane, X, Info } from 'lucide-react';

interface QuotaCategoryFilterProps {
  selectedQuota: string;
  selectedCategory: string;
  onQuotaChange: (quota: string) => void;
  onCategoryChange: (category: string) => void;
  isDarkMode: boolean;
  className?: string;
}

interface QuotaOption {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface CategoryOption {
  id: string;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const QuotaCategoryFilter: React.FC<QuotaCategoryFilterProps> = ({
  selectedQuota,
  selectedCategory,
  onQuotaChange,
  onCategoryChange,
  isDarkMode,
  className = ''
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [quotaOptions, setQuotaOptions] = useState<QuotaOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  useEffect(() => {
    const quotas: QuotaOption[] = [
      {
        id: 'all',
        name: 'All',
        fullName: 'All Quotas',
        description: 'Show data from all quotas',
        icon: <Filter className="w-5 h-5" />,
        color: isDarkMode ? 'text-gray-400' : 'text-gray-600',
        bgColor: isDarkMode ? 'bg-gray-500/20' : 'bg-gray-100',
        borderColor: isDarkMode ? 'border-gray-500/30' : 'border-gray-200'
      },
      {
        id: 'AIQ',
        name: 'AIQ',
        fullName: 'All India Quota',
        description: '15% of seats in all government medical colleges',
        icon: <Users className="w-5 h-5" />,
        color: isDarkMode ? 'text-blue-400' : 'text-blue-600',
        bgColor: isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100',
        borderColor: isDarkMode ? 'border-blue-500/30' : 'border-blue-200'
      },
      {
        id: 'State',
        name: 'State',
        fullName: 'State Quota',
        description: '85% of seats in state government medical colleges',
        icon: <Shield className="w-5 h-5" />,
        color: isDarkMode ? 'text-green-400' : 'text-green-600',
        bgColor: isDarkMode ? 'bg-green-500/20' : 'bg-green-100',
        borderColor: isDarkMode ? 'border-green-500/30' : 'border-green-200'
      },
      {
        id: 'Management',
        name: 'Mgmt',
        fullName: 'Management/Paid Seat',
        description: 'Paid seats in private medical colleges',
        icon: <Briefcase className="w-5 h-5" />,
        color: isDarkMode ? 'text-purple-400' : 'text-purple-600',
        bgColor: isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100',
        borderColor: isDarkMode ? 'border-purple-500/30' : 'border-purple-200'
      },
      {
        id: 'NRI',
        name: 'NRI',
        fullName: 'Non-Resident Indian',
        description: 'Seats reserved for NRI students',
        icon: <Plane className="w-5 h-5" />,
        color: isDarkMode ? 'text-orange-400' : 'text-orange-600',
        bgColor: isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100',
        borderColor: isDarkMode ? 'border-orange-500/30' : 'border-orange-200'
      }
    ];

    const categories: CategoryOption[] = [
      {
        id: 'all',
        name: 'All Categories',
        description: 'Show data from all categories',
        color: isDarkMode ? 'text-gray-400' : 'text-gray-600',
        bgColor: isDarkMode ? 'bg-gray-500/20' : 'bg-gray-100',
        borderColor: isDarkMode ? 'border-gray-500/30' : 'border-gray-200'
      },
      {
        id: 'General',
        name: 'General',
        description: 'Open category for all students',
        color: isDarkMode ? 'text-blue-400' : 'text-blue-600',
        bgColor: isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100',
        borderColor: isDarkMode ? 'border-blue-500/30' : 'border-blue-200'
      },
      {
        id: 'OBC',
        name: 'OBC',
        description: 'Other Backward Classes',
        color: isDarkMode ? 'text-green-400' : 'text-green-600',
        bgColor: isDarkMode ? 'bg-green-500/20' : 'bg-green-100',
        borderColor: isDarkMode ? 'border-green-500/30' : 'border-green-200'
      },
      {
        id: 'SC',
        name: 'SC',
        description: 'Scheduled Castes',
        color: isDarkMode ? 'text-orange-400' : 'text-orange-600',
        bgColor: isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100',
        borderColor: isDarkMode ? 'border-orange-500/30' : 'border-orange-200'
      },
      {
        id: 'ST',
        name: 'ST',
        description: 'Scheduled Tribes',
        color: isDarkMode ? 'text-purple-400' : 'text-purple-600',
        bgColor: isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100',
        borderColor: isDarkMode ? 'border-purple-500/30' : 'border-purple-200'
      },
      {
        id: 'EWS',
        name: 'EWS',
        description: 'Economically Weaker Sections',
        color: isDarkMode ? 'text-pink-400' : 'text-pink-600',
        bgColor: isDarkMode ? 'bg-pink-500/20' : 'bg-pink-100',
        borderColor: isDarkMode ? 'border-pink-500/30' : 'border-pink-200'
      }
    ];

    setQuotaOptions(quotas);
    setCategoryOptions(categories);
  }, [isDarkMode]);

  const handleQuotaSelect = (quota: string) => {
    onQuotaChange(quota);
  };

  const handleCategorySelect = (category: string) => {
    onCategoryChange(category);
  };

  const clearFilters = () => {
    onQuotaChange('all');
    onCategoryChange('all');
  };

  const hasActiveFilters = selectedQuota !== 'all' || selectedCategory !== 'all';

  return (
    <div className={`backdrop-blur-md rounded-xl p-4 border-2 ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white/80 border-gray-200/60'} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className={`w-5 h-5 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Quota & Category
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Clear filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Info */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}
          >
            <div className="space-y-3">
              <div>
                <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                  About Quotas
                </h4>
                <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Quotas determine how seats are distributed among different groups of students.
                </p>
              </div>
              <div>
                <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                  About Categories
                </h4>
                <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Categories are based on social and economic criteria for reservation.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota Selection */}
      <div className="mb-4">
        <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
          Quota
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {quotaOptions.map((quota) => (
            <button
              key={quota.id}
              onClick={() => handleQuotaSelect(quota.id)}
              className={`p-2 rounded-lg border-2 transition-all ${
                selectedQuota === quota.id
                  ? `${quota.bgColor} ${quota.borderColor} ${quota.color}`
                  : isDarkMode
                  ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <div className={`p-1 rounded ${selectedQuota === quota.id ? quota.bgColor + ' ' + quota.borderColor + ' border' : isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                  {quota.icon}
                </div>
                <div className="text-center">
                  <div className={`text-xs font-medium ${selectedQuota === quota.id ? quota.color : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {quota.name}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Category Selection */}
      <div>
        <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
          Category
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {categoryOptions.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className={`p-2 rounded-lg border-2 transition-all ${
                selectedCategory === category.id
                  ? `${category.bgColor} ${category.borderColor} ${category.color}`
                  : isDarkMode
                  ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="text-center">
                <div className={`text-xs font-medium ${selectedCategory === category.id ? category.color : isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {category.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selection Summary */}
      <div className={`mt-4 pt-3 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between text-sm">
          <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
            Active Filters:
          </span>
          <div className="flex gap-2">
            {selectedQuota !== 'all' && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${quotaOptions.find(q => q.id === selectedQuota)?.bgColor} ${quotaOptions.find(q => q.id === selectedQuota)?.borderColor} border`}>
                {quotaOptions.find(q => q.id === selectedQuota)?.name}
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryOptions.find(c => c.id === selectedCategory)?.bgColor} ${categoryOptions.find(c => c.id === selectedCategory)?.borderColor} border`}>
                {categoryOptions.find(c => c.id === selectedCategory)?.name}
              </span>
            )}
            {!hasActiveFilters && (
              <span className={isDarkMode ? 'text-white/50' : 'text-gray-500'}>
                None
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaCategoryFilter;
