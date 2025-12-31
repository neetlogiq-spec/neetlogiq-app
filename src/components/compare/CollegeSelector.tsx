'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, MapPin, GraduationCap } from 'lucide-react';

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  established: number;
  logo?: string;
  courses: number;
  medicalCourses: number;
  dentalCourses: number;
  avgCutoff: number;
  totalSeats: number;
  acceptanceRate: number;
  affiliatedUniversity?: string;
  management?: string;
  availableCourses?: { name: string; seats: number }[];
  popularity?: number;
  stream?: 'medical' | 'dental' | 'ayush';
}

interface CollegeSelectorProps {
  index: number;
  selectedCollege: College | undefined;
  onSelect: (college: College) => void;
  onRemove: () => void;
  isDarkMode: boolean;
  selectionMethod?: 'dropdown' | 'search';
  selectedStream?: string;
  selectedManagement?: string;
  stateOptions?: { value: string; label: string }[];
}

const CollegeSelector: React.FC<CollegeSelectorProps> = ({
  index,
  selectedCollege,
  onSelect,
  onRemove,
  isDarkMode,
  selectionMethod = 'search',
  selectedStream = 'all',
  selectedManagement = 'all',
  stateOptions: propStateOptions
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCourseForSeats, setSelectedCourseForSeats] = useState('');
  const [cutoffData, setCutoffData] = useState<any>(null);
  const [selectedState, setSelectedState] = useState<string>('all');
  const [localSelectionMethod, setLocalSelectionMethod] = useState<'dropdown' | 'search'>(selectionMethod);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local selection method with prop changes
  useEffect(() => {
    setLocalSelectionMethod(selectionMethod);
  }, [selectionMethod]);

  // Use prop state options if provided, otherwise use default fallback
  const stateOptions = propStateOptions && propStateOptions.length > 0 
    ? [{ value: 'all', label: 'All States' }, ...propStateOptions]
    : [{ value: 'all', label: 'All States' }];

  // State for dropdown colleges (fetched from API)
  const [dropdownColleges, setDropdownColleges] = useState<College[]>([]);
  const [isLoadingDropdown, setIsLoadingDropdown] = useState(false);

  // Fetch colleges for dropdown mode when filters change
  useEffect(() => {
    const fetchDropdownColleges = async () => {
      if (localSelectionMethod !== 'dropdown') return;
      
      setIsLoadingDropdown(true);
      try {
        const params = new URLSearchParams({
          limit: '50'
        });
        
        if (selectedState && selectedState !== 'all') {
          params.append('state', selectedState);
        }
        if (selectedStream && selectedStream !== 'all') {
          params.append('stream', selectedStream);
        }
        if (selectedManagement && selectedManagement !== 'all') {
          params.append('management', selectedManagement);
        }
        
        const response = await fetch(`/api/compare/colleges?${params}`);
        const data = await response.json();
        
        if (data.success && data.colleges) {
          setDropdownColleges(data.colleges);
        }
      } catch (error) {
        console.error('Error fetching dropdown colleges:', error);
      } finally {
        setIsLoadingDropdown(false);
      }
    };
    
    fetchDropdownColleges();
  }, [localSelectionMethod, selectedState, selectedStream, selectedManagement]);

  // Function to get filtered colleges for dropdown
  const getFilteredColleges = (state: string) => {
    return dropdownColleges.filter(college => {
      const stateMatch = state === 'all' || college.state?.toLowerCase().includes(state.toLowerCase().replace(/-/g, ' '));
      return stateMatch;
    });
  };

  // Function to get top 3 popular colleges based on filters
  const getPopularColleges = (state: string) => {
    const filteredColleges = getFilteredColleges(state);
    return filteredColleges
      .sort((a, b) => (b.totalSeats || 0) - (a.totalSeats || 0))
      .slice(0, 3);
  };

  // Mock data - replace with actual API call
  const mockColleges: College[] = [
    {
      id: '1',
      name: 'AIIMS Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      type: 'Medical',
      established: 1956,
      courses: 45,
      medicalCourses: 40,
      dentalCourses: 5,
      avgCutoff: 150,
      totalSeats: 1000,
      acceptanceRate: 0.8,
      affiliatedUniversity: 'AIIMS',
      management: 'Government',
      popularity: 95,
      stream: 'medical',
      availableCourses: [
        { name: 'MBBS', seats: 100 },
        { name: 'MD Medicine', seats: 20 },
        { name: 'MS Surgery', seats: 15 },
        { name: 'MD Pediatrics', seats: 10 },
        { name: 'MS Orthopedics', seats: 8 },
        { name: 'MD Radiology', seats: 5 }
      ]
    },
    {
      id: '2',
      name: 'JIPMER Puducherry',
      city: 'Puducherry',
      state: 'Puducherry',
      type: 'Medical',
      established: 1964,
      courses: 35,
      medicalCourses: 30,
      dentalCourses: 5,
      avgCutoff: 200,
      totalSeats: 800,
      acceptanceRate: 0.75,
      affiliatedUniversity: 'JIPMER',
      management: 'Government',
      popularity: 90,
      stream: 'medical',
      availableCourses: [
        { name: 'MBBS', seats: 80 },
        { name: 'MD Medicine', seats: 15 },
        { name: 'MS Surgery', seats: 12 },
        { name: 'MD Pediatrics', seats: 8 },
        { name: 'MS Orthopedics', seats: 6 }
      ]
    },
    {
      id: '3',
      name: 'Karnataka Medical College',
      city: 'Hubli',
      state: 'Karnataka',
      type: 'Medical',
      established: 1956,
      courses: 25,
      medicalCourses: 20,
      dentalCourses: 5,
      avgCutoff: 500,
      totalSeats: 600,
      acceptanceRate: 0.65,
      affiliatedUniversity: 'RGUHS',
      management: 'Government',
      popularity: 85,
      stream: 'medical',
      availableCourses: [
        { name: 'MBBS', seats: 60 },
        { name: 'BDS', seats: 40 },
        { name: 'MD Medicine', seats: 10 },
        { name: 'MS Surgery', seats: 8 },
        { name: 'MDS Orthodontics', seats: 5 }
      ]
    }
  ];

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Call real API
      const params = new URLSearchParams({
        search: term,
        limit: '20'
      });
      
      if (selectedStream && selectedStream !== 'all') {
        params.append('stream', selectedStream);
      }
      if (selectedManagement && selectedManagement !== 'all') {
        params.append('management', selectedManagement);
      }
      
      const response = await fetch(`/api/compare/colleges?${params}`);
      const data = await response.json();
      
      if (data.success && data.colleges) {
        setSuggestions(data.colleges);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching colleges:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (college: College) => {
    onSelect(college);
    setIsOpen(false);
    setSearchTerm('');
    setSuggestions([]);
  };

  const handleRemove = () => {
    onRemove();
    setSearchTerm('');
    setSuggestions([]);
  };

  // Mock cutoff data - replace with actual API call
  const mockCutoffData = {
    'MBBS-2024': { openingRank: 150, closingRank: 200, totalSeats: 100, category: 'General' },
    'MBBS-2023': { openingRank: 140, closingRank: 190, totalSeats: 100, category: 'General' },
    'BDS-2024': { openingRank: 500, closingRank: 600, totalSeats: 50, category: 'General' },
    'BDS-2023': { openingRank: 480, closingRank: 580, totalSeats: 50, category: 'General' },
    'MD-2024': { openingRank: 100, closingRank: 150, totalSeats: 20, category: 'General' },
    'MS-2024': { openingRank: 120, closingRank: 170, totalSeats: 15, category: 'General' }
  };

  const fetchCutoffData = (course: string, year: string) => {
    if (!course || !year) return;
    
    const key = `${course}-${year}`;
    const data = mockCutoffData[key as keyof typeof mockCutoffData];
    
    if (data) {
      setCutoffData(data);
    } else {
      setCutoffData(null);
    }
  };

  const handleCourseChange = (course: string) => {
    setSelectedCourse(course);
    fetchCutoffData(course, selectedYear);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    fetchCutoffData(selectedCourse, year);
  };

  const getSelectedCourseSeats = () => {
    if (!selectedCollege?.availableCourses || !selectedCourseForSeats) return null;
    
    if (selectedCourseForSeats === 'show-all') {
      return selectedCollege.availableCourses;
    }
    
    return selectedCollege.availableCourses.find(course => course.name === selectedCourseForSeats);
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Listen for custom search events
  useEffect(() => {
    const handleOpenSearch = (event: CustomEvent) => {
      if (event.detail?.index === index) {
        setIsOpen(true);
      }
    };

    window.addEventListener('openSearch', handleOpenSearch as EventListener);
    return () => {
      window.removeEventListener('openSearch', handleOpenSearch as EventListener);
    };
  }, [index]);

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <div className={`relative rounded-2xl p-6 transition-all duration-300 group ${
        selectedCollege
          ? isDarkMode
            ? 'bg-white/10 border-white/20 shadow-2xl backdrop-blur-md'
            : 'bg-white/80 border-gray-200/60 shadow-lg backdrop-blur-md'
          : isDarkMode
            ? 'bg-white/5 border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/10 backdrop-blur-sm'
            : 'bg-gray-50/50 border-2 border-dashed border-gray-200/50 hover:border-gray-400/70 hover:bg-gray-100/80 backdrop-blur-md'
      }`}>
        
        {selectedCollege ? (
          // Selected College Display with 3 Sections
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="space-y-4"
          >
            {/* Header with Remove Button */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                }`}>
                  <GraduationCap className={`w-6 h-6 ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-1 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedCollege.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className={`w-4 h-4 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span className={`${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {selectedCollege.city}, {selectedCollege.state}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleRemove}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isDarkMode 
                    ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' 
                    : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: College Information */}
            <div className={`p-3 rounded-xl ${
              isDarkMode ? 'bg-white/10 border border-white/20 backdrop-blur-md' : 'bg-white/60 border border-gray-200/50 backdrop-blur-sm'
            }`}>
              <h4 className={`text-sm font-semibold mb-2 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>
                College Information
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Type:</span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedCollege.type}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Affiliated University:</span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedCollege.affiliatedUniversity || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Management:</span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedCollege.management || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Courses and Seat Data */}
            <div className={`p-3 rounded-xl ${
              isDarkMode ? 'bg-white/10 border border-white/20 backdrop-blur-md' : 'bg-white/60 border border-gray-200/50 backdrop-blur-sm'
            }`}>
              <h4 className={`text-sm font-semibold mb-2 ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`}>
                Courses & Seats
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                  <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Total Courses:</span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedCollege.courses}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                  <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Medical Courses:</span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedCollege.medicalCourses}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                  <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Dental Courses:</span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedCollege.dentalCourses}</span>
                </div>
                
                {/* Course Selection Dropdown */}
                <div className="mt-3">
                  <select 
                    value={selectedCourseForSeats}
                    onChange={(e) => setSelectedCourseForSeats(e.target.value)}
                    className={`w-full p-2 rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-white/10 border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } border`}
                  >
                    <option value="">Select Course</option>
                    <option value="show-all">Show All</option>
                    {selectedCollege.availableCourses?.map((course, index) => (
                      <option key={index} value={course.name}>{course.name}</option>
                    ))}
                  </select>
                </div>

                {/* Course Seats Display */}
                {selectedCourseForSeats && (
                  <div className={`mt-2 p-2 rounded-lg ${
                    isDarkMode ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-50 border border-green-200'
                  }`}>
                    {selectedCourseForSeats === 'show-all' ? (
                      <div>
                        <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                          All Available Courses
                        </div>
                        <div className="space-y-1 text-xs">
                          {selectedCollege.availableCourses?.map((course, index) => (
                            <div key={index} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                              <span className={`${isDarkMode ? 'text-slate-300/90' : 'text-gray-600'}`}>{course.name}:</span>
                              <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {course.seats} <span className="text-[10px] font-normal opacity-80 uppercase">seats</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                          {selectedCourseForSeats} Seats
                        </div>
                        <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {getSelectedCourseSeats()?.seats || 0} seats available
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Cutoffs */}
            <div className={`p-3 rounded-xl border ${
              isDarkMode ? 'bg-white/10 border-white/20 backdrop-blur-md' : 'bg-white/60 border-gray-200/50 backdrop-blur-sm'
            }`}>
              <h4 className={`text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-purple-400' : 'text-purple-600'
              }`}>
                Cutoffs
              </h4>
              <div className="space-y-2">
                <select 
                  value={selectedCourse}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className={`w-full p-2 rounded-lg text-sm transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-white/10 border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border`}
                >
                  <option value="">Select Course</option>
                  <option value="MBBS">MBBS</option>
                  <option value="BDS">BDS</option>
                  <option value="MD">MD</option>
                  <option value="MS">MS</option>
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className={`w-full p-2 rounded-lg text-sm transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-white/10 border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border`}
                >
                  <option value="">Select Year</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
                
                {/* Cutoff Results */}
                {cutoffData ? (
                  <div className={`mt-3 p-2 rounded-lg ${
                    isDarkMode ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                      {selectedCourse} - {selectedYear} Cutoff Data
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center py-1">
                        <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Opening Rank:</span>
                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoffData.openingRank}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Closing Rank:</span>
                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoffData.closingRank}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Total Seats:</span>
                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoffData.totalSeats}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className={`${isDarkMode ? 'text-slate-200/90' : 'text-gray-600'}`}>Category:</span>
                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {cutoffData.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : selectedCourse && selectedYear ? (
                  <div className="text-xs text-center text-red-500 mt-2">
                    No cutoff data available for {selectedCourse} - {selectedYear}
                  </div>
                ) : (
                  <div className="text-xs text-center text-gray-500 mt-1">
                    Select course and year to view cutoff data
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          // Empty State
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${
              isDarkMode ? 'bg-blue-500/20 group-hover:bg-blue-500/30' : 'bg-blue-500/10 group-hover:bg-blue-500/20'
            }`}>
              <Search className={`w-8 h-8 transition-colors duration-300 ${
                isDarkMode ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-500 group-hover:text-blue-600'
              }`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${
                isDarkMode ? 'text-white group-hover:text-blue-200' : 'text-gray-900 group-hover:text-blue-700'
              } transition-colors duration-300`}>
                Choose College {index + 1}
              </h3>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-600'
              } transition-colors duration-300`}>
                Search and select a college to compare
              </p>
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 group-hover:scale-105 ${
                isDarkMode 
                  ? 'bg-white/20 text-white border border-white/30 shadow-sm hover:bg-white/30' 
                  : 'bg-gray-900 text-white border border-gray-800 shadow-sm hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {localSelectionMethod === 'search' ? (
                  <>
                    <Search className="w-4 h-4" />
                    Search Colleges
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Choose College
                  </>
                )}
              </div>
            </button>
          </motion.div>
        )}
      </div>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className={`relative w-full max-w-md max-h-[80vh] rounded-2xl ${
                isDarkMode ? 'bg-slate-950/95 border border-white/10' : 'bg-white/90 border border-gray-200/50 backdrop-blur-xl'
              } shadow-2xl`}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-lg font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Select College {index + 1}
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isDarkMode ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Selection Method Toggle */}
                <div className="flex items-center justify-center mb-6">
                  <div className={`backdrop-blur-sm rounded-lg p-1 border ${
                    isDarkMode 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-gray-100/50 border-gray-200'
                  }`}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLocalSelectionMethod('search')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                          localSelectionMethod === 'search'
                            ? isDarkMode 
                              ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                              : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                            : isDarkMode 
                              ? 'text-white/70 hover:text-white hover:bg-white/10'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      >
                        <Search className="w-4 h-4" />
                        Search
                      </button>
                      <button
                        onClick={() => setLocalSelectionMethod('dropdown')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                          localSelectionMethod === 'dropdown'
                            ? isDarkMode 
                              ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                              : 'bg-gray-900 text-white border border-gray-800 shadow-sm'
                            : isDarkMode 
                              ? 'text-white/70 hover:text-white hover:bg-white/10'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Dropdown
                      </button>
                    </div>
                  </div>
                </div>

                {localSelectionMethod === 'search' ? (
                  /* Search Method */
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 rounded-lg ${
                      isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                      <Search className={`w-5 h-5 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search colleges..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className={`flex-1 bg-transparent outline-none text-base font-medium ${
                        isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                ) : (
                  /* Dropdown Method */
                  <div className="space-y-4 mb-6">
                    {/* State Filter */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                        State
                      </label>
                      <select 
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all duration-300 ${
                          isDarkMode 
                            ? 'bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md' 
                            : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                        }`}
                      >
                        {stateOptions.map(state => (
                          <option key={state.value} value={state.value}>{state.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* College Filter */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                        College
                      </label>
                      <select 
                        onChange={(e) => {
                          const college = getFilteredColleges(selectedState).find(c => c.id === e.target.value);
                          if (college) handleSelect(college);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all duration-300 ${
                          isDarkMode 
                            ? 'bg-white/5 border border-white/10 text-white/90 hover:bg-white/10' 
                            : 'bg-white/95 backdrop-blur-sm text-gray-900 shadow-sm border border-gray-200'
                        }`}
                      >
                        <option value="">Choose College</option>
                        {getFilteredColleges(selectedState).map(college => (
                          <option key={college.id} value={college.id}>{college.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto">
                  {localSelectionMethod === 'search' ? (
                    /* Search Results */
                    <>
                      {isLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Searching colleges...
                          </p>
                        </div>
                      ) : suggestions.length > 0 ? (
                        <div className="space-y-2">
                          {suggestions.map((college) => (
                            <button
                              key={college.id}
                              onClick={() => handleSelect(college)}
                              className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                                isDarkMode
                                  ? 'hover:bg-white/10 hover:border hover:border-white/30'
                                  : 'hover:bg-gray-100/80 hover:border hover:border-gray-300/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isDarkMode ? 'bg-green-500/20 group-hover:bg-green-500/30' : 'bg-green-100 group-hover:bg-green-200'
                                } transition-colors duration-200`}>
                                  <GraduationCap className={`w-5 h-5 ${
                                    isDarkMode ? 'text-green-400 group-hover:text-green-300' : 'text-green-600 group-hover:text-green-700'
                                  } transition-colors duration-200`} />
                                </div>
                                <div className="flex-1">
                                  <div className={`font-semibold mb-1 transition-colors duration-200 ${
                                    isDarkMode ? 'text-white group-hover:text-blue-200' : 'text-gray-900 group-hover:text-blue-700'
                                  }`}>
                                    {college.name}
                                  </div>
                                  <div className={`text-sm transition-colors duration-200 ${
                                    isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-600'
                                  }`}>
                                    {college.city}, {college.state} • {college.type}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : searchTerm.length >= 2 ? (
                        <div className="text-center py-8">
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            No colleges found
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Start typing to search colleges
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Dropdown Results - Popular Colleges */
                    <>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                          Popular Colleges
                        </label>
                        <div className="space-y-2">
                          {getPopularColleges(selectedState).map((college, index) => (
                            <button
                              key={college.id}
                              onClick={() => handleSelect(college)}
                              className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                                isDarkMode
                                  ? 'hover:bg-white/10 hover:border hover:border-white/30'
                                  : 'hover:bg-gray-100/80 hover:border hover:border-gray-300/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isDarkMode ? 'bg-green-500/20 group-hover:bg-green-500/30' : 'bg-green-100 group-hover:bg-green-200'
                                } transition-colors duration-200`}>
                                  <span className={`text-xs font-bold ${
                                    isDarkMode ? 'text-green-400 group-hover:text-green-300' : 'text-green-600 group-hover:text-green-700'
                                  } transition-colors duration-200`}>
                                    {index + 1}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <div className={`font-medium text-sm transition-colors duration-200 ${
                                    isDarkMode ? 'text-white group-hover:text-blue-200' : 'text-gray-900 group-hover:text-blue-700'
                                  }`}>
                                    {college.name}
                                  </div>
                                  <div className={`text-xs transition-colors duration-200 ${
                                    isDarkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-600'
                                  }`}>
                                    {college.city}, {college.state} • {college.management}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                          {getPopularColleges(selectedState).length === 0 && (
                            <div className="text-center py-8">
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                No popular colleges found for selected filters
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CollegeSelector;
