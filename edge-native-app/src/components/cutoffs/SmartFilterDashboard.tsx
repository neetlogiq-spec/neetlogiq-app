'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  GraduationCap, 
  Award, 
  BarChart3, 
  Filter, 
  X, 
  RotateCcw,
  Save,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface FilterCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isDarkMode: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const FilterCard: React.FC<FilterCardProps> = ({ 
  title, 
  icon, 
  children, 
  isDarkMode, 
  isExpanded = true,
  onToggle 
}) => (
  <motion.div
    className={`glass-card rounded-xl p-4 transition-all duration-300 ${
      isDarkMode 
        ? 'bg-white/10 border-white/20' 
        : 'bg-white/80 border-gray-200/60'
    }`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div 
      className="flex items-center justify-between cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          isDarkMode ? 'bg-white/10' : 'bg-gray-100'
        }`}>
          {icon}
        </div>
        <h3 className={`font-semibold ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </h3>
      </div>
      {onToggle && (
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={`w-4 h-4 ${
            isDarkMode ? 'text-white/70' : 'text-gray-600'
          }`} />
        </motion.div>
      )}
    </div>
    
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

interface LocationFilterProps {
  isDarkMode: boolean;
  selectedState: string;
  onStateChange: (state: string) => void;
  selectedCounsellingBody: string;
  onCounsellingBodyChange: (body: string) => void;
  selectedCollegeType: string;
  onCollegeTypeChange: (type: string) => void;
}

const LocationFilter: React.FC<LocationFilterProps> = ({
  isDarkMode,
  selectedState,
  onStateChange,
  selectedCounsellingBody,
  onCounsellingBodyChange,
  selectedCollegeType,
  onCollegeTypeChange
}) => {
  const stateOptions = [
    { value: 'all', label: 'All States' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'tamil-nadu', label: 'Tamil Nadu' },
    { value: 'kerala', label: 'Kerala' },
    { value: 'west-bengal', label: 'West Bengal' },
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'rajasthan', label: 'Rajasthan' },
    { value: 'uttar-pradesh', label: 'Uttar Pradesh' }
  ];

  const counsellingBodyOptions = [
    { value: 'all', label: 'All Bodies' },
    { value: 'AIQ', label: 'AIQ' },
    { value: 'KEA', label: 'KEA' },
    { value: 'MCC', label: 'MCC' },
    { value: 'State', label: 'State' }
  ];

  const collegeTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'government', label: 'Government' },
    { value: 'private', label: 'Private' },
    { value: 'deemed', label: 'Deemed' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          State
        </label>
        <select
          value={selectedState}
          onChange={(e) => onStateChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {stateOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Counselling Body
        </label>
        <select
          value={selectedCounsellingBody}
          onChange={(e) => onCounsellingBodyChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {counsellingBodyOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          College Type
        </label>
        <select
          value={selectedCollegeType}
          onChange={(e) => onCollegeTypeChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {collegeTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

interface AcademicFilterProps {
  isDarkMode: boolean;
  selectedStream: string;
  onStreamChange: (stream: string) => void;
  selectedCourse: string;
  onCourseChange: (course: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
}

const AcademicFilter: React.FC<AcademicFilterProps> = ({
  isDarkMode,
  selectedStream,
  onStreamChange,
  selectedCourse,
  onCourseChange,
  selectedYear,
  onYearChange
}) => {
  const streamOptions = [
    { value: 'all', label: 'All Streams' },
    { value: 'medical', label: 'Medical' },
    { value: 'dental', label: 'Dental' },
    { value: 'ayush', label: 'AYUSH' }
  ];

  const courseOptions = [
    { value: 'all', label: 'All Courses' },
    { value: 'mbbs', label: 'MBBS' },
    { value: 'bds', label: 'BDS' },
    { value: 'md', label: 'MD' },
    { value: 'ms', label: 'MS' },
    { value: 'mds', label: 'MDS' }
  ];

  const yearOptions = [
    { value: '2024', label: '2024' },
    { value: '2023', label: '2023' },
    { value: '2022', label: '2022' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Stream
        </label>
        <select
          value={selectedStream}
          onChange={(e) => onStreamChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {streamOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Course
        </label>
        <select
          value={selectedCourse}
          onChange={(e) => onCourseChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {courseOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Year
        </label>
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {yearOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

interface QuotaCategoryFilterProps {
  isDarkMode: boolean;
  selectedQuota: string;
  onQuotaChange: (quota: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedRounds: number[];
  onRoundsChange: (rounds: number[]) => void;
}

const QuotaCategoryFilter: React.FC<QuotaCategoryFilterProps> = ({
  isDarkMode,
  selectedQuota,
  onQuotaChange,
  selectedCategory,
  onCategoryChange,
  selectedRounds,
  onRoundsChange
}) => {
  const quotaOptions = [
    { value: 'all', label: 'All Quotas' },
    { value: 'AIQ', label: 'AIQ' },
    { value: 'State', label: 'State' },
    { value: 'Management', label: 'Management' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'General', label: 'General' },
    { value: 'OBC', label: 'OBC' },
    { value: 'SC', label: 'SC' },
    { value: 'ST', label: 'ST' },
    { value: 'EWS', label: 'EWS' }
  ];

  const roundOptions = [1, 2, 3, 4, 5];

  const toggleRound = (round: number) => {
    if (selectedRounds.includes(round)) {
      onRoundsChange(selectedRounds.filter(r => r !== round));
    } else {
      onRoundsChange([...selectedRounds, round].sort());
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Quota
        </label>
        <select
          value={selectedQuota}
          onChange={(e) => onQuotaChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {quotaOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
            isDarkMode 
              ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
              : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
          }`}
        >
          {categoryOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Rounds
        </label>
        <div className="flex flex-wrap gap-2">
          {roundOptions.map(round => (
            <button
              key={round}
              onClick={() => toggleRound(round)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-300 ${
                selectedRounds.includes(round)
                  ? isDarkMode 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                  : isDarkMode 
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              R{round}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface RankRangeFilterProps {
  isDarkMode: boolean;
  minRank: number;
  maxRank: number;
  onRankRangeChange: (min: number, max: number) => void;
}

const RankRangeFilter: React.FC<RankRangeFilterProps> = ({
  isDarkMode,
  minRank,
  maxRank,
  onRankRangeChange
}) => {
  const handleMinChange = (value: number) => {
    onRankRangeChange(value, maxRank);
  };

  const handleMaxChange = (value: number) => {
    onRankRangeChange(minRank, value);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          isDarkMode ? 'text-white/80' : 'text-gray-700'
        }`}>
          Opening Rank Range
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={minRank}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
            }`}
            placeholder="Min rank"
          />
          <input
            type="number"
            value={maxRank}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/90 backdrop-blur-sm text-gray-900' 
                : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
            }`}
            placeholder="Max rank"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>
          {minRank.toLocaleString()}
        </span>
        <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>
          {maxRank.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  isDarkMode: boolean;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, onRemove, isDarkMode }) => (
  <motion.div
    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
      isDarkMode 
        ? 'bg-white/20 text-white border border-white/30' 
        : 'bg-gray-200 text-gray-800 border border-gray-300'
    }`}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ duration: 0.2 }}
  >
    <span>{label}</span>
    <button
      onClick={onRemove}
      className={`p-0.5 rounded-full hover:bg-white/20 transition-colors ${
        isDarkMode ? 'text-white/70' : 'text-gray-600'
      }`}
    >
      <X className="w-3 h-3" />
    </button>
  </motion.div>
);

interface SmartFilterDashboardProps {
  isDarkMode: boolean;
  // Location filters
  selectedState: string;
  onStateChange: (state: string) => void;
  selectedCounsellingBody: string;
  onCounsellingBodyChange: (body: string) => void;
  selectedCollegeType: string;
  onCollegeTypeChange: (type: string) => void;
  // Academic filters
  selectedStream: string;
  onStreamChange: (stream: string) => void;
  selectedCourse: string;
  onCourseChange: (course: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  // Quota & Category filters
  selectedQuota: string;
  onQuotaChange: (quota: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedRounds: number[];
  onRoundsChange: (rounds: number[]) => void;
  // Rank range filters
  minRank: number;
  maxRank: number;
  onRankRangeChange: (min: number, max: number) => void;
  // Actions
  onReset: () => void;
  onSavePreset: () => void;
  onLoadPreset: () => void;
}

const SmartFilterDashboard: React.FC<SmartFilterDashboardProps> = ({
  isDarkMode,
  selectedState,
  onStateChange,
  selectedCounsellingBody,
  onCounsellingBodyChange,
  selectedCollegeType,
  onCollegeTypeChange,
  selectedStream,
  onStreamChange,
  selectedCourse,
  onCourseChange,
  selectedYear,
  onYearChange,
  selectedQuota,
  onQuotaChange,
  selectedCategory,
  onCategoryChange,
  selectedRounds,
  onRoundsChange,
  minRank,
  maxRank,
  onRankRangeChange,
  onReset,
  onSavePreset,
  onLoadPreset
}) => {
  const [expandedCards, setExpandedCards] = useState({
    location: true,
    academic: true,
    quota: true,
    rank: true
  });

  const toggleCard = (card: keyof typeof expandedCards) => {
    setExpandedCards(prev => ({
      ...prev,
      [card]: !prev[card]
    }));
  };

  const activeFilters = [
    selectedState !== 'all' && { label: `State: ${selectedState}`, onRemove: () => onStateChange('all') },
    selectedCounsellingBody !== 'all' && { label: `Body: ${selectedCounsellingBody}`, onRemove: () => onCounsellingBodyChange('all') },
    selectedCollegeType !== 'all' && { label: `Type: ${selectedCollegeType}`, onRemove: () => onCollegeTypeChange('all') },
    selectedStream !== 'all' && { label: `Stream: ${selectedStream}`, onRemove: () => onStreamChange('all') },
    selectedCourse !== 'all' && { label: `Course: ${selectedCourse}`, onRemove: () => onCourseChange('all') },
    selectedYear !== '2024' && { label: `Year: ${selectedYear}`, onRemove: () => onYearChange('2024') },
    selectedQuota !== 'all' && { label: `Quota: ${selectedQuota}`, onRemove: () => onQuotaChange('all') },
    selectedCategory !== 'all' && { label: `Category: ${selectedCategory}`, onRemove: () => onCategoryChange('all') },
    selectedRounds.length > 0 && selectedRounds.length < 5 && { label: `Rounds: ${selectedRounds.join(', ')}`, onRemove: () => onRoundsChange([1, 2]) }
  ].filter(Boolean);

  return (
    <motion.div
      className={`backdrop-blur-md rounded-2xl p-6 border-2 ${
        isDarkMode 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white/80 border-gray-200/60'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isDarkMode ? 'bg-white/10' : 'bg-gray-100'
          }`}>
            <Filter className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
          </div>
          <h2 className={`text-xl font-bold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Smart Filters
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onSavePreset}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isDarkMode
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={onLoadPreset}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isDarkMode
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <Download className="w-4 h-4" />
            Load
          </button>
          <button
            onClick={onReset}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isDarkMode
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Filter Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <FilterCard
          title="Location"
          icon={<MapPin className="w-5 h-5" />}
          isDarkMode={isDarkMode}
          isExpanded={expandedCards.location}
          onToggle={() => toggleCard('location')}
        >
          <LocationFilter
            isDarkMode={isDarkMode}
            selectedState={selectedState}
            onStateChange={onStateChange}
            selectedCounsellingBody={selectedCounsellingBody}
            onCounsellingBodyChange={onCounsellingBodyChange}
            selectedCollegeType={selectedCollegeType}
            onCollegeTypeChange={onCollegeTypeChange}
          />
        </FilterCard>

        <FilterCard
          title="Academic"
          icon={<GraduationCap className="w-5 h-5" />}
          isDarkMode={isDarkMode}
          isExpanded={expandedCards.academic}
          onToggle={() => toggleCard('academic')}
        >
          <AcademicFilter
            isDarkMode={isDarkMode}
            selectedStream={selectedStream}
            onStreamChange={onStreamChange}
            selectedCourse={selectedCourse}
            onCourseChange={onCourseChange}
            selectedYear={selectedYear}
            onYearChange={onYearChange}
          />
        </FilterCard>

        <FilterCard
          title="Quota & Category"
          icon={<Award className="w-5 h-5" />}
          isDarkMode={isDarkMode}
          isExpanded={expandedCards.quota}
          onToggle={() => toggleCard('quota')}
        >
          <QuotaCategoryFilter
            isDarkMode={isDarkMode}
            selectedQuota={selectedQuota}
            onQuotaChange={onQuotaChange}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            selectedRounds={selectedRounds}
            onRoundsChange={onRoundsChange}
          />
        </FilterCard>

        <FilterCard
          title="Rank Range"
          icon={<BarChart3 className="w-5 h-5" />}
          isDarkMode={isDarkMode}
          isExpanded={expandedCards.rank}
          onToggle={() => toggleCard('rank')}
        >
          <RankRangeFilter
            isDarkMode={isDarkMode}
            minRank={minRank}
            maxRank={maxRank}
            onRankRangeChange={onRankRangeChange}
          />
        </FilterCard>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-sm font-medium ${
              isDarkMode ? 'text-white/80' : 'text-gray-700'
            }`}>
              Active Filters:
            </span>
            <span className={`text-sm ${
              isDarkMode ? 'text-white/60' : 'text-gray-500'
            }`}>
              {activeFilters.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {activeFilters.map((filter, index) => (
                <FilterChip
                  key={index}
                  label={filter!.label}
                  onRemove={filter!.onRemove}
                  isDarkMode={isDarkMode}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SmartFilterDashboard;
