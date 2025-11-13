/**
 * ComparisonMatrix Component
 *
 * Side-by-side college comparison tool with:
 * - Compare 3-5 colleges simultaneously
 * - Multi-dimensional comparison (cost, cutoff, facilities, etc.)
 * - Visual indicators for better/worse values
 * - Export comparison report
 * - Save and share comparisons
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  Plus,
  X,
  Download,
  Share2,
  Save,
  CheckCircle,
  XCircle,
  Minus,
  TrendingUp,
  TrendingDown,
  MapPin,
  DollarSign,
  Award,
  Building,
  Users,
  BookOpen,
  Home,
  Briefcase,
  Star,
  Search
} from 'lucide-react';

export interface CollegeComparison {
  id: string;
  name: string;
  state: string;
  city: string;
  managementType: 'Government' | 'Private' | 'Trust' | 'Deemed';

  // Cutoff Data
  openingRank: number;
  closingRank: number;
  lastYearClosingRank: number;

  // Fees
  tuitionFee: number;
  hostelFee: number;
  totalAnnualCost: number;

  // Facilities (0-5 rating)
  facilities: {
    hostel: number;
    library: number;
    labs: number;
    sports: number;
    cafeteria: number;
  };

  // Reputation
  niacRating: string; // A++, A+, A, B++, B+, B
  nirfRank?: number;

  // Placement
  placementRate: number; // percentage
  averagePackage: number; // in lakhs

  // Distance
  distanceFromHome?: number; // in km

  // Admission chance (calculated)
  admissionChance?: number; // percentage
}

interface ComparisonMatrixProps {
  userRank?: number;
  userCategory?: string;
  userLocation?: { state: string; city: string };
}

type ComparisonAspect =
  | 'overview'
  | 'cutoffs'
  | 'fees'
  | 'facilities'
  | 'reputation'
  | 'placement'
  | 'location';

export default function ComparisonMatrix({
  userRank = 5000,
  userCategory = 'General',
  userLocation
}: ComparisonMatrixProps) {
  const [colleges, setColleges] = useState<CollegeComparison[]>([]);
  const [activeAspect, setActiveAspect] = useState<ComparisonAspect>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Mock college database for search
  const availableColleges: CollegeComparison[] = [
    {
      id: '1',
      name: 'AIIMS Delhi',
      state: 'Delhi',
      city: 'New Delhi',
      managementType: 'Government',
      openingRank: 1,
      closingRank: 715,
      lastYearClosingRank: 705,
      tuitionFee: 5856,
      hostelFee: 1200,
      totalAnnualCost: 35000,
      facilities: { hostel: 5, library: 5, labs: 5, sports: 5, cafeteria: 5 },
      niacRating: 'A++',
      nirfRank: 1,
      placementRate: 100,
      averagePackage: 18.5,
      distanceFromHome: 250,
      admissionChance: userRank <= 715 ? 95 : userRank <= 1000 ? 60 : 20
    },
    {
      id: '2',
      name: 'CMC Vellore',
      state: 'Tamil Nadu',
      city: 'Vellore',
      managementType: 'Private',
      openingRank: 50,
      closingRank: 890,
      lastYearClosingRank: 920,
      tuitionFee: 98000,
      hostelFee: 45000,
      totalAnnualCost: 185000,
      facilities: { hostel: 5, library: 5, labs: 5, sports: 4, cafeteria: 5 },
      niacRating: 'A++',
      nirfRank: 2,
      placementRate: 98,
      averagePackage: 16.2,
      distanceFromHome: 1200,
      admissionChance: userRank <= 890 ? 92 : userRank <= 1200 ? 55 : 18
    },
    {
      id: '3',
      name: 'JIPMER Puducherry',
      state: 'Puducherry',
      city: 'Puducherry',
      managementType: 'Government',
      openingRank: 80,
      closingRank: 1150,
      lastYearClosingRank: 1180,
      tuitionFee: 6950,
      hostelFee: 1800,
      totalAnnualCost: 42000,
      facilities: { hostel: 4, library: 5, labs: 5, sports: 4, cafeteria: 4 },
      niacRating: 'A+',
      nirfRank: 3,
      placementRate: 100,
      averagePackage: 15.8,
      distanceFromHome: 850,
      admissionChance: userRank <= 1150 ? 88 : userRank <= 1500 ? 50 : 15
    },
    {
      id: '4',
      name: 'Kasturba Medical College',
      state: 'Karnataka',
      city: 'Manipal',
      managementType: 'Private',
      openingRank: 200,
      closingRank: 2500,
      lastYearClosingRank: 2450,
      tuitionFee: 250000,
      hostelFee: 80000,
      totalAnnualCost: 385000,
      facilities: { hostel: 5, library: 5, labs: 5, sports: 5, cafeteria: 5 },
      niacRating: 'A+',
      nirfRank: 8,
      placementRate: 95,
      averagePackage: 14.5,
      distanceFromHome: 600,
      admissionChance: userRank <= 2500 ? 85 : userRank <= 3000 ? 45 : 12
    },
    {
      id: '5',
      name: 'BHU Varanasi',
      state: 'Uttar Pradesh',
      city: 'Varanasi',
      managementType: 'Government',
      openingRank: 150,
      closingRank: 1800,
      lastYearClosingRank: 1850,
      tuitionFee: 8500,
      hostelFee: 2500,
      totalAnnualCost: 48000,
      facilities: { hostel: 4, library: 5, labs: 4, sports: 5, cafeteria: 4 },
      niacRating: 'A+',
      nirfRank: 12,
      placementRate: 98,
      averagePackage: 13.2,
      distanceFromHome: 450,
      admissionChance: userRank <= 1800 ? 90 : userRank <= 2200 ? 52 : 14
    }
  ];

  const addCollege = (college: CollegeComparison) => {
    if (colleges.length >= 5) {
      alert('Maximum 5 colleges can be compared at once');
      return;
    }
    if (colleges.find(c => c.id === college.id)) {
      alert('College already added');
      return;
    }
    setColleges([...colleges, college]);
    setShowSearch(false);
    setSearchQuery('');
  };

  const removeCollege = (collegeId: string) => {
    setColleges(colleges.filter(c => c.id !== collegeId));
  };

  const getBestValue = (key: keyof CollegeComparison, colleges: CollegeComparison[]) => {
    if (colleges.length === 0) return null;

    // For ranks and costs, lower is better
    if (['closingRank', 'openingRank', 'tuitionFee', 'hostelFee', 'totalAnnualCost', 'distanceFromHome'].includes(key)) {
      return Math.min(...colleges.map(c => c[key] as number));
    }

    // For others, higher is better
    if (['placementRate', 'averagePackage', 'admissionChance', 'nirfRank'].includes(key)) {
      if (key === 'nirfRank') {
        // For rank, lower is better but we need to handle undefined
        const ranks = colleges.map(c => c.nirfRank).filter(r => r !== undefined) as number[];
        return ranks.length > 0 ? Math.min(...ranks) : null;
      }
      return Math.max(...colleges.map(c => c[key] as number));
    }

    return null;
  };

  const isBasicValue = (value: any, bestValue: any, key: string) => {
    if (bestValue === null || value === null || value === undefined) return false;

    if (['closingRank', 'openingRank', 'tuitionFee', 'hostelFee', 'totalAnnualCost', 'distanceFromHome'].includes(key)) {
      return value === bestValue;
    }

    return value === bestValue;
  };

  const exportComparison = () => {
    // TODO: Implement PDF/CSV export
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'college-comparison.csv';
    a.click();
  };

  const generateCSV = () => {
    let csv = 'Parameter,' + colleges.map(c => c.name).join(',') + '\n';

    // Add data rows
    const rows = [
      ['Location', ...colleges.map(c => `${c.city}, ${c.state}`)],
      ['Management Type', ...colleges.map(c => c.managementType)],
      ['Closing Rank', ...colleges.map(c => c.closingRank.toString())],
      ['Tuition Fee (₹)', ...colleges.map(c => c.tuitionFee.toLocaleString('en-IN'))],
      ['Total Annual Cost (₹)', ...colleges.map(c => c.totalAnnualCost.toLocaleString('en-IN'))],
      ['NIRF Rank', ...colleges.map(c => c.nirfRank?.toString() || 'N/A')],
      ['Placement Rate (%)', ...colleges.map(c => c.placementRate.toString())],
      ['Average Package (₹L)', ...colleges.map(c => c.averagePackage.toString())],
      ['Admission Chance (%)', ...colleges.map(c => c.admissionChance?.toString() || 'N/A')]
    ];

    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    return csv;
  };

  const shareComparison = () => {
    // TODO: Implement share functionality
    alert('Share functionality coming soon!');
  };

  const saveComparison = () => {
    localStorage.setItem('saved_comparison', JSON.stringify(colleges));
    alert('Comparison saved!');
  };

  const filteredColleges = availableColleges.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const aspects = [
    { id: 'overview', label: 'Overview', icon: GitCompare },
    { id: 'cutoffs', label: 'Cutoffs', icon: TrendingUp },
    { id: 'fees', label: 'Fees', icon: DollarSign },
    { id: 'facilities', label: 'Facilities', icon: Building },
    { id: 'reputation', label: 'Reputation', icon: Award },
    { id: 'placement', label: 'Placement', icon: Briefcase },
    { id: 'location', label: 'Location', icon: MapPin }
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <GitCompare className="w-8 h-8 mr-3" />
            College Comparison Matrix
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Compare up to 5 colleges side-by-side
          </p>
        </div>

        {colleges.length > 0 && (
          <div className="flex items-center space-x-3">
            <button
              onClick={saveComparison}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={shareComparison}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
            <button
              onClick={exportComparison}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        )}
      </div>

      {/* Add College Section */}
      {colleges.length < 5 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex-1 px-6 py-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl text-blue-600 dark:text-blue-400 font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add College to Compare</span>
            </button>
          </div>

          {/* Search Panel */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-3"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search colleges by name, city, or state..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredColleges.map((college) => (
                    <button
                      key={college.id}
                      onClick={() => addCollege(college)}
                      disabled={colleges.find(c => c.id === college.id) !== undefined}
                      className="w-full p-4 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {college.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {college.city}, {college.state} • {college.managementType}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Rank: {college.closingRank}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            ₹{(college.totalAnnualCost / 1000).toFixed(0)}K/year
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {colleges.length === 0 && (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <GitCompare className="w-20 h-20 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Colleges Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add 2-5 colleges to start comparing them side-by-side
          </p>
        </div>
      )}

      {/* Comparison Table */}
      {colleges.length > 0 && (
        <div className="space-y-4">
          {/* Aspect Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2">
            <div className="grid grid-cols-7 gap-2">
              {aspects.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveAspect(id as ComparisonAspect)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                    activeAspect === id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comparison Grid */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white w-48">
                      Parameter
                    </th>
                    {colleges.map((college) => (
                      <th key={college.id} className="px-6 py-4 text-center min-w-64">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-gray-900 dark:text-white text-left">
                              {college.name}
                            </div>
                            <button
                              onClick={() => removeCollege(college.id)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 text-left">
                            {college.city}, {college.state}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {activeAspect === 'overview' && (
                    <>
                      <ComparisonRow
                        label="Management Type"
                        icon={Building}
                        values={colleges.map(c => c.managementType)}
                        bestValue={null}
                      />
                      <ComparisonRow
                        label="Your Admission Chance"
                        icon={Target}
                        values={colleges.map(c => `${c.admissionChance}%`)}
                        bestValue={getBestValue('admissionChance', colleges)}
                        suffix="%"
                        highlight={true}
                      />
                      <ComparisonRow
                        label="NIAC Rating"
                        icon={Star}
                        values={colleges.map(c => c.niacRating)}
                        bestValue={null}
                      />
                      <ComparisonRow
                        label="NIRF Rank"
                        icon={Award}
                        values={colleges.map(c => c.nirfRank?.toString() || 'N/A')}
                        bestValue={getBestValue('nirfRank', colleges)}
                        lowerIsBetter={true}
                      />
                    </>
                  )}

                  {activeAspect === 'cutoffs' && (
                    <>
                      <ComparisonRow
                        label="Opening Rank"
                        icon={TrendingUp}
                        values={colleges.map(c => c.openingRank.toLocaleString('en-IN'))}
                        bestValue={getBestValue('openingRank', colleges)}
                        lowerIsBetter={true}
                      />
                      <ComparisonRow
                        label="Closing Rank"
                        icon={TrendingDown}
                        values={colleges.map(c => c.closingRank.toLocaleString('en-IN'))}
                        bestValue={getBestValue('closingRank', colleges)}
                        lowerIsBetter={true}
                        highlight={true}
                      />
                      <ComparisonRow
                        label="Last Year Closing Rank"
                        icon={TrendingDown}
                        values={colleges.map(c => c.lastYearClosingRank.toLocaleString('en-IN'))}
                        bestValue={null}
                      />
                      <ComparisonRow
                        label="Rank Trend"
                        icon={TrendingUp}
                        values={colleges.map(c => {
                          const diff = c.closingRank - c.lastYearClosingRank;
                          return diff > 0 ? `↑ ${diff}` : diff < 0 ? `↓ ${Math.abs(diff)}` : 'Stable';
                        })}
                        bestValue={null}
                      />
                    </>
                  )}

                  {activeAspect === 'fees' && (
                    <>
                      <ComparisonRow
                        label="Tuition Fee (Annual)"
                        icon={DollarSign}
                        values={colleges.map(c => `₹${c.tuitionFee.toLocaleString('en-IN')}`)}
                        bestValue={getBestValue('tuitionFee', colleges)}
                        lowerIsBetter={true}
                      />
                      <ComparisonRow
                        label="Hostel Fee (Annual)"
                        icon={Home}
                        values={colleges.map(c => `₹${c.hostelFee.toLocaleString('en-IN')}`)}
                        bestValue={getBestValue('hostelFee', colleges)}
                        lowerIsBetter={true}
                      />
                      <ComparisonRow
                        label="Total Annual Cost"
                        icon={DollarSign}
                        values={colleges.map(c => `₹${c.totalAnnualCost.toLocaleString('en-IN')}`)}
                        bestValue={getBestValue('totalAnnualCost', colleges)}
                        lowerIsBetter={true}
                        highlight={true}
                      />
                      <ComparisonRow
                        label="5.5 Year Total Cost"
                        icon={DollarSign}
                        values={colleges.map(c => `₹${(c.totalAnnualCost * 5.5).toLocaleString('en-IN')}`)}
                        bestValue={null}
                      />
                    </>
                  )}

                  {activeAspect === 'facilities' && (
                    <>
                      {(['hostel', 'library', 'labs', 'sports', 'cafeteria'] as const).map((facility) => (
                        <ComparisonRow
                          key={facility}
                          label={facility.charAt(0).toUpperCase() + facility.slice(1)}
                          icon={Building}
                          values={colleges.map(c => (
                            <div className="flex items-center justify-center space-x-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < c.facilities[facility]
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300 dark:text-gray-600'
                                  }`}
                                />
                              ))}
                            </div>
                          ))}
                          bestValue={null}
                        />
                      ))}
                    </>
                  )}

                  {activeAspect === 'reputation' && (
                    <>
                      <ComparisonRow
                        label="NIAC Rating"
                        icon={Award}
                        values={colleges.map(c => c.niacRating)}
                        bestValue={null}
                        highlight={true}
                      />
                      <ComparisonRow
                        label="NIRF Rank"
                        icon={Award}
                        values={colleges.map(c => c.nirfRank?.toString() || 'Not Ranked')}
                        bestValue={getBestValue('nirfRank', colleges)}
                        lowerIsBetter={true}
                      />
                    </>
                  )}

                  {activeAspect === 'placement' && (
                    <>
                      <ComparisonRow
                        label="Placement Rate"
                        icon={Briefcase}
                        values={colleges.map(c => `${c.placementRate}%`)}
                        bestValue={getBestValue('placementRate', colleges)}
                        suffix="%"
                        highlight={true}
                      />
                      <ComparisonRow
                        label="Average Package"
                        icon={DollarSign}
                        values={colleges.map(c => `₹${c.averagePackage}L`)}
                        bestValue={getBestValue('averagePackage', colleges)}
                      />
                    </>
                  )}

                  {activeAspect === 'location' && (
                    <>
                      <ComparisonRow
                        label="City"
                        icon={MapPin}
                        values={colleges.map(c => c.city)}
                        bestValue={null}
                      />
                      <ComparisonRow
                        label="State"
                        icon={MapPin}
                        values={colleges.map(c => c.state)}
                        bestValue={null}
                      />
                      <ComparisonRow
                        label="Distance from Home"
                        icon={MapPin}
                        values={colleges.map(c => c.distanceFromHome ? `${c.distanceFromHome} km` : 'N/A')}
                        bestValue={getBestValue('distanceFromHome', colleges)}
                        lowerIsBetter={true}
                      />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Winner Recommendation */}
          {colleges.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800"
            >
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-blue-600" />
                AI Recommendation
              </h4>
              <p className="text-gray-700 dark:text-gray-300">
                Based on your rank ({userRank.toLocaleString('en-IN')}) and comparison data, we recommend{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {colleges.sort((a, b) => (b.admissionChance || 0) - (a.admissionChance || 0))[0]?.name}
                </span>{' '}
                as your best option with {colleges[0]?.admissionChance}% admission probability.
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper Component for Comparison Rows
function ComparisonRow({
  label,
  icon: Icon,
  values,
  bestValue,
  lowerIsBetter = false,
  highlight = false,
  suffix = ''
}: {
  label: string;
  icon: any;
  values: any[];
  bestValue?: any;
  lowerIsBetter?: boolean;
  highlight?: boolean;
  suffix?: string;
}) {
  return (
    <tr className={highlight ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Icon className="w-4 h-4 text-gray-500" />
          <span>{label}</span>
        </div>
      </td>
      {values.map((value, index) => {
        const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
        const isBest = bestValue !== null && bestValue !== undefined && numValue === bestValue;

        return (
          <td key={index} className="px-6 py-4 text-center">
            <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg ${
              isBest
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold'
                : 'text-gray-900 dark:text-white'
            }`}>
              {isBest && <CheckCircle className="w-4 h-4" />}
              <span>{React.isValidElement(value) ? value : value}</span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

// Import Target icon (was missing)
import { Target } from 'lucide-react';
