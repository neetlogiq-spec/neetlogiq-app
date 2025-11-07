'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { Search, CheckCircle, XCircle, AlertCircle, Download, Upload, Keyboard, Save } from 'lucide-react';
import { validationEngine, ValidationReport } from '@/lib/validation-rules';
import { useKeyboardShortcuts, createStagingReviewShortcuts, formatShortcut } from '@/hooks/useKeyboardShortcuts';
import { useStagingReviewSession } from '@/hooks/useSessionAutoSave';

interface StagingCollege {
  id: string;
  staging_college_name: string;
  unified_college_id: string | null;
  unified_college_name: string | null;
  match_confidence: number | null;
  match_method: string | null;
  distance: number | null;
  status: 'matched' | 'unmatched';
}

interface StagingCourse {
  id: string;
  staging_course_name: string;
  unified_course_id: string | null;
  unified_course_name: string | null;
  match_confidence: number | null;
  match_method: string | null;
  distance: number | null;
  status: 'matched' | 'unmatched';
}

interface StagingCutoff {
  id: string;
  college_id: string;
  course_id: string;
  year: number;
  round: number;
  quota: string;
  category: string;
  opening_rank: number;
  closing_rank: number;
  total_records: number;
  source_file: string;
}

interface StagingStats {
  totalColleges: number;
  matchedColleges: number;
  unmatchedColleges: number;
  totalCourses: number;
  matchedCourses: number;
  unmatchedCourses: number;
  totalCutoffs: number;
  mappedCutoffs: number;
  unmappedCutoffs: number;
}

export default function StagingReviewPage() {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'colleges' | 'courses' | 'cutoffs' | 'stats'>('stats');
  const [searchQuery, setSearchQuery] = useState('');
  const [colleges, setColleges] = useState<StagingCollege[]>([]);
  const [courses, setCourses] = useState<StagingCourse[]>([]);
  const [cutoffs, setCutoffs] = useState<StagingCutoff[]>([]);
  const [stats, setStats] = useState<StagingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState<StagingCollege | null>(null);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [validationReports, setValidationReports] = useState<ValidationReport[]>([]);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Session auto-save
  const { restoreState } = useStagingReviewSession({
    activeTab,
    searchQuery,
    selectedItemId: selectedCollege?.id,
    selectedItemIndex
  });

  // Keyboard shortcuts
  const shortcuts = createStagingReviewShortcuts({
    onNextItem: () => {
      if (activeTab === 'colleges' && selectedItemIndex < filteredColleges.length - 1) {
        setSelectedItemIndex(prev => prev + 1);
      } else if (activeTab === 'courses' && selectedItemIndex < filteredCourses.length - 1) {
        setSelectedItemIndex(prev => prev + 1);
      }
    },
    onPreviousItem: () => {
      if (selectedItemIndex > 0) {
        setSelectedItemIndex(prev => prev - 1);
      }
    },
    onApprove: () => {
      const currentItem = activeTab === 'colleges'
        ? filteredColleges[selectedItemIndex]
        : filteredCourses[selectedItemIndex];
      if (currentItem?.id) {
        handleApproveMatch(currentItem.id, activeTab === 'colleges' ? 'college' : 'course');
      }
    },
    onReject: () => {
      const currentItem = activeTab === 'colleges'
        ? filteredColleges[selectedItemIndex]
        : filteredCourses[selectedItemIndex];
      if (currentItem?.id) {
        handleRejectMatch(currentItem.id, activeTab === 'colleges' ? 'college' : 'course');
      }
    },
    onSearch: () => searchInputRef.current?.focus(),
    onExport: exportToMarkdown,
    onRefresh: loadStagingData,
    onHelp: () => setShowKeyboardHelp(true),
    onTabColleges: () => setActiveTab('colleges'),
    onTabCourses: () => setActiveTab('courses'),
    onTabCutoffs: () => setActiveTab('cutoffs'),
    onTabStats: () => setActiveTab('stats')
  });

  useKeyboardShortcuts({ shortcuts, enabled: !showManualMatch });

  useEffect(() => {
    loadStagingData();

    // Restore previous session
    const restored = restoreState();
    if (restored) {
      if (restored.activeTab) setActiveTab(restored.activeTab as any);
      if (restored.searchQuery) setSearchQuery(restored.searchQuery);
      if (restored.selectedItemIndex) setSelectedItemIndex(restored.selectedItemIndex);
    }
  }, []);

  const loadStagingData = async () => {
    try {
      setLoading(true);
      
      // Load staging statistics
      const statsResponse = await fetch('/api/staging/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Load colleges
      const collegesResponse = await fetch('/api/staging/colleges');
      if (collegesResponse.ok) {
        const collegesData = await collegesResponse.json();
        setColleges(collegesData.data);
      }

      // Load courses
      const coursesResponse = await fetch('/api/staging/courses');
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        setCourses(coursesData.data);
      }

      // Load cutoffs
      const cutoffsResponse = await fetch('/api/staging/cutoffs');
      if (cutoffsResponse.ok) {
        const cutoffsData = await cutoffsResponse.json();
        setCutoffs(cutoffsData.data);
      }

      // Run validation after data loads
      runValidation();

    } catch (error) {
      console.error('Failed to load staging data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Run validation on data
  const runValidation = () => {
    const allReports: ValidationReport[] = [];

    // Validate colleges
    const collegeReports = validationEngine.validateBatch(colleges, 'college');
    allReports.push(...collegeReports);

    // Validate courses
    const courseReports = validationEngine.validateBatch(courses, 'course');
    allReports.push(...courseReports);

    // Validate cutoffs
    const cutoffReports = validationEngine.validateBatch(cutoffs, 'cutoff');
    allReports.push(...cutoffReports);

    setValidationReports(allReports);
    setLastSaved(new Date());
  };

  const handleApproveMatch = async (id: string, type: 'college' | 'course') => {
    try {
      const response = await fetch(`/api/staging/approve/${type}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true })
      });

      if (response.ok) {
        await loadStagingData(); // Reload data
      }
    } catch (error) {
      console.error('Failed to approve match:', error);
    }
  };

  const handleRejectMatch = async (id: string, type: 'college' | 'course') => {
    try {
      const response = await fetch(`/api/staging/reject/${type}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected: true })
      });

      if (response.ok) {
        await loadStagingData(); // Reload data
      }
    } catch (error) {
      console.error('Failed to reject match:', error);
    }
  };

  const handleManualMatch = async (stagingId: string, unifiedId: string, type: 'college' | 'course') => {
    try {
      const response = await fetch(`/api/staging/manual-match/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagingId, unifiedId })
      });

      if (response.ok) {
        await loadStagingData(); // Reload data
        setShowManualMatch(false);
      }
    } catch (error) {
      console.error('Failed to create manual match:', error);
    }
  };

  const exportToMarkdown = () => {
    const mdContent = generateMarkdownReport();
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staging-review-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateMarkdownReport = () => {
    const unmatchedColleges = colleges.filter(c => !c.unified_college_id);
    const unmatchedCourses = courses.filter(c => !c.unified_course_id);
    
    return `# Staging Database Review Report

## Summary Statistics
- **Total Colleges**: ${stats?.totalColleges || 0}
- **Matched Colleges**: ${stats?.matchedColleges || 0}
- **Unmatched Colleges**: ${stats?.unmatchedColleges || 0}
- **Total Courses**: ${stats?.totalCourses || 0}
- **Matched Courses**: ${stats?.matchedCourses || 0}
- **Unmatched Courses**: ${stats?.unmatchedCourses || 0}
- **Total Cutoffs**: ${stats?.totalCutoffs || 0}
- **Mapped Cutoffs**: ${stats?.mappedCutoffs || 0}
- **Unmapped Cutoffs**: ${stats?.unmappedCutoffs || 0}

## Unmatched Colleges (${unmatchedColleges.length})
${unmatchedColleges.map((college, index) => `${index + 1}. ${college.staging_college_name}`).join('\n')}

## Unmatched Courses (${unmatchedCourses.length})
${unmatchedCourses.map((course, index) => `${index + 1}. ${course.staging_course_name}`).join('\n')}

## All College Mappings
| Staging College | Unified College | Match Method | Confidence |
|----------------|----------------|--------------|------------|
${colleges.map(c => `| ${c.staging_college_name} | ${c.unified_college_name || 'N/A'} | ${c.match_method || 'N/A'} | ${c.match_confidence || 'N/A'} |`).join('\n')}

## All Course Mappings
| Staging Course | Unified Course | Match Method | Confidence |
|----------------|----------------|--------------|------------|
${courses.map(c => `| ${c.staging_course_name} | ${c.unified_course_name || 'N/A'} | ${c.match_method || 'N/A'} | ${c.match_confidence || 'N/A'} |`).join('\n')}
`;
  };

  const filteredColleges = colleges.filter(college =>
    college.staging_college_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (college.unified_college_name && college.unified_college_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCourses = courses.filter(course =>
    course.staging_course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (course.unified_course_name && course.unified_course_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Loading staging data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className={`text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Staging Database Review
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Review and approve college/course mappings before final import
          </p>
        </motion.div>

        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                College Mapping
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total:</span>
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{stats?.totalColleges || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Matched:</span>
                  <span className="text-green-500">{stats?.matchedColleges || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Unmatched:</span>
                  <span className="text-red-500">{stats?.unmatchedColleges || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${stats?.totalColleges ? (stats.matchedColleges / stats.totalColleges) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Course Mapping
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total:</span>
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{stats?.totalCourses || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Matched:</span>
                  <span className="text-green-500">{stats?.matchedCourses || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Unmatched:</span>
                  <span className="text-red-500">{stats?.unmatchedCourses || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${stats?.totalCourses ? (stats.matchedCourses / stats.totalCourses) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Cutoff Mapping
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total:</span>
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{stats?.totalCutoffs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Mapped:</span>
                  <span className="text-green-500">{stats?.mappedCutoffs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Unmapped:</span>
                  <span className="text-red-500">{stats?.unmappedCutoffs || 0}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${stats?.totalCutoffs ? (stats.mappedCutoffs / stats.totalCutoffs) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg`}
        >
          <div className="flex border-b border-gray-200">
            {[
              { id: 'stats', label: 'Statistics', icon: AlertCircle },
              { id: 'colleges', label: 'Colleges', icon: CheckCircle },
              { id: 'courses', label: 'Courses', icon: CheckCircle },
              { id: 'cutoffs', label: 'Cutoffs', icon: CheckCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? isDarkMode
                        ? 'border-blue-500 text-blue-400'
                        : 'border-blue-500 text-blue-600'
                      : isDarkMode
                      ? 'border-transparent text-gray-400 hover:text-gray-300'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search colleges, courses, or cutoffs... (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              }`}
            />
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex justify-between items-center"
        >
          <div className="flex items-center space-x-4">
            {/* Session indicator */}
            {lastSaved && (
              <div className={`flex items-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <Save className="w-4 h-4 mr-2" />
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
            )}

            {/* Validation summary */}
            {validationReports.length > 0 && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
                isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
              }`}>
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {validationReports.filter(r => r.severity === 'error').length} errors,
                  {validationReports.filter(r => r.severity === 'warning').length} warnings
                </span>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Shortcuts
            </button>
            <button
              onClick={exportToMarkdown}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg`}
        >
          {activeTab === 'stats' && (
            <div className="p-6">
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Mapping Statistics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    College Mapping Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total Colleges:</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{stats?.totalColleges || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Matched:</span>
                      <span className="text-green-500">{stats?.matchedColleges || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Unmatched:</span>
                      <span className="text-red-500">{stats?.unmatchedColleges || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Match Rate:</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {stats ? ((stats.matchedColleges / stats.totalColleges) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Course Mapping Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Total Courses:</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{stats?.totalCourses || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Matched:</span>
                      <span className="text-green-500">{stats?.matchedCourses || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Unmatched:</span>
                      <span className="text-red-500">{stats?.unmatchedCourses || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Match Rate:</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {stats ? ((stats.matchedCourses / stats.totalCourses) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'colleges' && (
            <div className="p-6">
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                College Mappings ({filteredColleges.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Status
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Staging College
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Unified College
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Method
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Confidence
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredColleges.map((college) => (
                      <tr key={college.id} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            college.status === 'matched' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {college.status === 'matched' ? '✅ Matched' : '❌ Unmatched'}
                          </span>
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {college.staging_college_name}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {college.unified_college_name || 'Not Matched'}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {college.match_method || 'N/A'}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {college.match_confidence ? `${(college.match_confidence * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            {college.unified_college_id ? (
                              <>
                                <button
                                  onClick={() => handleApproveMatch(college.id, 'college')}
                                  className="text-green-500 hover:text-green-700"
                                  title="Approve Match"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleRejectMatch(college.id, 'college')}
                                  className="text-red-500 hover:text-red-700"
                                  title="Reject Match"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedCollege(college);
                                  setShowManualMatch(true);
                                }}
                                className="text-blue-500 hover:text-blue-700"
                                title="Manual Match"
                              >
                                <Upload className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="p-6">
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Course Mappings ({filteredCourses.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Status
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Staging Course
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Unified Course
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Method
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Confidence
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course) => (
                      <tr key={course.id} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            course.status === 'matched' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {course.status === 'matched' ? '✅ Matched' : '❌ Unmatched'}
                          </span>
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {course.staging_course_name}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {course.unified_course_name || 'Not Matched'}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {course.match_method || 'N/A'}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {course.match_confidence ? `${(course.match_confidence * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            {course.unified_course_id ? (
                              <>
                                <button
                                  onClick={() => handleApproveMatch(course.id, 'course')}
                                  className="text-green-500 hover:text-green-700"
                                  title="Approve Match"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleRejectMatch(course.id, 'course')}
                                  className="text-red-500 hover:text-red-700"
                                  title="Reject Match"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedCollege(course as any);
                                  setShowManualMatch(true);
                                }}
                                className="text-blue-500 hover:text-blue-700"
                                title="Manual Match"
                              >
                                <Upload className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'cutoffs' && (
            <div className="p-6">
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Cutoff Mappings ({cutoffs.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        College
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Course
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Year
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Round
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Opening Rank
                      </th>
                      <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Closing Rank
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cutoffs.slice(0, 100).map((cutoff) => (
                      <tr key={cutoff.id} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoff.college_id}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoff.course_id}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoff.year}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoff.round}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoff.opening_rank}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoff.closing_rank}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cutoffs.length > 100 && (
                  <p className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Showing first 100 cutoffs. Total: {cutoffs.length}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Keyboard Shortcuts Help Modal */}
        {showKeyboardHelp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Keyboard Shortcuts
                </h2>
                <button
                  onClick={() => setShowKeyboardHelp(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <XCircle className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>
              </div>

              <div className="space-y-4">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className={`flex justify-between items-center py-3 px-4 rounded-lg ${
                      isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {shortcut.description}
                    </span>
                    <kbd className={`px-3 py-1 rounded font-mono text-sm ${
                      isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-white text-gray-900 border border-gray-300'
                    }`}>
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>

              <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  <strong>Tip:</strong> Press <kbd className="px-2 py-1 rounded bg-blue-200 text-blue-900 font-mono text-xs">Shift + ?</kbd> to open this help dialog anytime.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Validation Panel */}
        {validationReports.length > 0 && activeTab !== 'stats' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}
          >
            <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Validation Issues
            </h3>
            <div className="space-y-3">
              {validationReports
                .filter(report => {
                  // Filter by current tab
                  if (activeTab === 'colleges') {
                    return colleges.some(c => c.id === report.itemId);
                  } else if (activeTab === 'courses') {
                    return courses.some(c => c.id === report.itemId);
                  } else if (activeTab === 'cutoffs') {
                    return cutoffs.some(c => c.id === report.itemId);
                  }
                  return false;
                })
                .slice(0, 10)
                .map((report, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      report.severity === 'error'
                        ? isDarkMode
                          ? 'bg-red-900/20 border-red-500'
                          : 'bg-red-50 border-red-500'
                        : report.severity === 'warning'
                        ? isDarkMode
                          ? 'bg-yellow-900/20 border-yellow-500'
                          : 'bg-yellow-50 border-yellow-500'
                        : isDarkMode
                        ? 'bg-blue-900/20 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {report.ruleName}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        report.severity === 'error'
                          ? 'bg-red-500 text-white'
                          : report.severity === 'warning'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {report.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      <strong>{report.itemName}:</strong> {report.message}
                    </p>
                    {report.suggestions.length > 0 && (
                      <div className="mt-2">
                        <p className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Suggestions:
                        </p>
                        <ul className={`text-xs space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {report.suggestions.map((suggestion, i) => (
                            <li key={i}>• {suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {validationReports.length > 10 && (
              <p className={`text-sm mt-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Showing 10 of {validationReports.length} validation issues
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
