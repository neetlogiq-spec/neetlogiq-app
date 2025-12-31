'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  X, 
  RotateCcw,
  ChevronDown,
  MapPin,
  Building2,
  GraduationCap,
  Award,
  Hash
} from 'lucide-react';

// Filter option type
interface FilterOption {
  value: string;
  label: string;
}

// Elegant dropdown component
interface FilterDropdownProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  isDarkMode: boolean;
  width?: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  icon,
  value,
  options,
  onChange,
  isDarkMode,
  width = 'w-36'
}) => {
  const isActive = value !== 'all';
  
  return (
    <div className={`flex flex-col ${width}`}>
      <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
        isDarkMode ? 'text-white/50' : 'text-gray-400'
      }`}>
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
            isActive
              ? isDarkMode 
                ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-500/50' 
                : 'bg-blue-50 text-blue-700 border-2 border-blue-400'
              : isDarkMode 
                ? 'bg-white/5 text-white/90 border border-white/10 hover:border-white/20 hover:bg-white/10' 
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          {options.map(option => (
            <option key={option.value} value={option.value} className="bg-white text-gray-900">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-0 top-0 h-full flex items-center pr-2 pointer-events-none">
          {isActive ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange('all');
              }}
              className="p-0.5 rounded-full pointer-events-auto hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-red-500" />
            </button>
          ) : (
            <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
          )}
        </div>
      </div>
    </div>
  );
};

// Rank input component
interface RankInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder: string;
  isDarkMode: boolean;
}

const RankInput: React.FC<RankInputProps> = ({ value, onChange, placeholder, isDarkMode }) => (
  <input
    type="number"
    value={value || ''}
    placeholder={placeholder}
    onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    className={`w-20 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
      isDarkMode 
        ? 'bg-white/5 text-white/90 border border-white/10 placeholder-white/30' 
        : 'bg-white text-gray-700 border border-gray-200 shadow-sm placeholder-gray-400'
    }`}
  />
);

// Props interface
interface SmartFilterDashboardProps {
  isDarkMode: boolean;
  filterOptions: {
    states: FilterOption[];
    collegeTypes: FilterOption[];
    streams: FilterOption[];
    courses: FilterOption[];
    quotas: FilterOption[];
    categories: FilterOption[];
  };
  selectedState: string;
  onStateChange: (state: string) => void;
  selectedCollegeType: string;
  onCollegeTypeChange: (type: string) => void;
  selectedStream: string;
  onStreamChange: (stream: string) => void;
  selectedCourse: string;
  onCourseChange: (course: string) => void;
  selectedQuota: string;
  onQuotaChange: (quota: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  minRank: number;
  maxRank: number;
  onRankRangeChange: (min: number, max: number) => void;
  onReset: () => void;
  onSavePreset: () => void;
  onLoadPreset: () => void;
}

const SmartFilterDashboard: React.FC<SmartFilterDashboardProps> = ({
  isDarkMode,
  filterOptions,
  selectedState,
  onStateChange,
  selectedCollegeType,
  onCollegeTypeChange,
  selectedStream,
  onStreamChange,
  selectedCourse,
  onCourseChange,
  selectedQuota,
  onQuotaChange,
  selectedCategory,
  onCategoryChange,
  minRank,
  maxRank,
  onRankRangeChange,
  onReset
}) => {
  // Build options with 'All' prepended
  const stateOptions = [{ value: 'all', label: 'All States' }, ...filterOptions.states];
  const collegeTypeOptions = [{ value: 'all', label: 'All' }, ...filterOptions.collegeTypes];
  const streamOptions = [{ value: 'all', label: 'All' }, ...filterOptions.streams];
  const courseOptions = [{ value: 'all', label: 'All Courses' }, ...filterOptions.courses];
  const quotaOptions = [{ value: 'all', label: 'All Quotas' }, ...filterOptions.quotas];
  const categoryOptions = [{ value: 'all', label: 'All' }, ...filterOptions.categories];

  // Check if any filters are active
  const hasActiveFilters = 
    selectedState !== 'all' || 
    selectedCollegeType !== 'all' || 
    selectedCourse !== 'all' ||
    selectedQuota !== 'all' ||
    selectedCategory !== 'all';

  return (
    <motion.div
      className={`rounded-xl overflow-hidden ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-white/5' 
          : 'bg-gradient-to-r from-gray-50 to-white border border-gray-100 shadow-sm'
      }`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Single Row Filter Grid */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-4">
          {/* Location Group */}
          <div className="flex items-end gap-3">
            <FilterDropdown
              label="State"
              icon={<MapPin className="w-3 h-3" />}
              value={selectedState}
              options={stateOptions}
              onChange={onStateChange}
              isDarkMode={isDarkMode}
              width="w-40"
            />
            <FilterDropdown
              label="Management"
              icon={<Building2 className="w-3 h-3" />}
              value={selectedCollegeType}
              options={collegeTypeOptions}
              onChange={onCollegeTypeChange}
              isDarkMode={isDarkMode}
              width="w-32"
            />
          </div>

          {/* Divider */}
          <div className={`h-10 w-px ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

          {/* Academic Group */}
          <div className="flex items-end gap-3">
            <FilterDropdown
              label="Course"
              icon={<GraduationCap className="w-3 h-3" />}
              value={selectedCourse}
              options={courseOptions}
              onChange={onCourseChange}
              isDarkMode={isDarkMode}
              width="w-44"
            />
          </div>

          {/* Divider */}
          <div className={`h-10 w-px ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

          {/* Quota/Category Group */}
          <div className="flex items-end gap-3">
            <FilterDropdown
              label="Quota"
              icon={<Award className="w-3 h-3" />}
              value={selectedQuota}
              options={quotaOptions}
              onChange={onQuotaChange}
              isDarkMode={isDarkMode}
              width="w-32"
            />
            <FilterDropdown
              label="Category"
              value={selectedCategory}
              options={categoryOptions}
              onChange={onCategoryChange}
              isDarkMode={isDarkMode}
              width="w-28"
            />
          </div>

          {/* Divider */}
          <div className={`h-10 w-px ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

          {/* Rank Range Group */}
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                isDarkMode ? 'text-white/50' : 'text-gray-400'
              }`}>
                <Hash className="w-3 h-3" />
                Rank Range
              </label>
              <div className="flex items-center gap-1.5">
                <RankInput
                  value={minRank}
                  onChange={(val) => onRankRangeChange(val, maxRank)}
                  placeholder="Min"
                  isDarkMode={isDarkMode}
                />
                <span className={`text-xs ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>-</span>
                <RankInput
                  value={maxRank}
                  onChange={(val) => onRankRangeChange(minRank, val)}
                  placeholder="Max"
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-grow" />

          {/* Reset Button */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={onReset}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isDarkMode
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear All
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default SmartFilterDashboard;
