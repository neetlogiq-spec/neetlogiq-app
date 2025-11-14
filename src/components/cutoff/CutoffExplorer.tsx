/**
 * CutoffExplorer Component
 *
 * Interactive cutoff exploration table with:
 * - Multi-year side-by-side comparison
 * - Advanced filtering (category, quota, round, state)
 * - Sortable columns
 * - Export to Excel/PDF
 * - Rank highlighting
 * - College/course search
 * - Infinite scroll pagination
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Star,
  TrendingUp,
  Table as TableIcon
} from 'lucide-react';

export interface CutoffRecord {
  id: string;
  college_id: string;
  college_name: string;
  state: string;
  course_name: string;
  year: number;
  category: string;
  quota: string;
  round: number;
  opening_rank: number;
  closing_rank: number;
  seats: number;
  management_type: string;
}

type SortField = 'college_name' | 'closing_rank' | 'opening_rank' | 'seats' | 'year';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'comparison';

export default function CutoffExplorer() {
  const [cutoffs, setCutoffs] = useState<CutoffRecord[]>([]);
  const [filteredCutoffs, setFilteredCutoffs] = useState<CutoffRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYears, setSelectedYears] = useState<number[]>([2024]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['General']);
  const [selectedQuotas, setSelectedQuotas] = useState<string[]>(['AIQ']);
  const [selectedRounds, setSelectedRounds] = useState<number[]>([3]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('closing_rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showFilters, setShowFilters] = useState(true);

  const years = [2024, 2023, 2022, 2021, 2020, 2019];
  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
  const quotas = ['AIQ', 'State Quota', 'Management', 'NRI', 'DNB'];
  const rounds = [1, 2, 3, 4]; // Including stray as 4

  useEffect(() => {
    loadCutoffs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [cutoffs, searchQuery, selectedYears, selectedCategories, selectedQuotas, selectedRounds, selectedStates, sortField, sortOrder]);

  const loadCutoffs = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/cutoffs');
      // const data = await response.json();

      // Mock data for demonstration
      const mockCutoffs: CutoffRecord[] = Array.from({ length: 200 }, (_, i) => ({
        id: `cutoff_${i}`,
        college_id: `college_${i % 50}`,
        college_name: `College ${Math.floor(i / 4) + 1}`,
        state: ['Delhi', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Kerala'][i % 5],
        course_name: 'MBBS',
        year: 2024 - (i % 6),
        category: categories[i % categories.length],
        quota: quotas[i % quotas.length],
        round: (i % 3) + 1,
        opening_rank: 500 + i * 10,
        closing_rank: 700 + i * 10,
        seats: 100 + (i % 5) * 20,
        management_type: i % 3 === 0 ? 'Government' : 'Private'
      }));

      setCutoffs(mockCutoffs);
    } catch (error) {
      console.error('Error loading cutoffs:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...cutoffs];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.college_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.course_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Year filter
    if (selectedYears.length > 0) {
      filtered = filtered.filter(c => selectedYears.includes(c.year));
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(c => selectedCategories.includes(c.category));
    }

    // Quota filter
    if (selectedQuotas.length > 0) {
      filtered = filtered.filter(c => selectedQuotas.includes(c.quota));
    }

    // Round filter
    if (selectedRounds.length > 0) {
      filtered = filtered.filter(c => selectedRounds.includes(c.round));
    }

    // State filter
    if (selectedStates.length > 0) {
      filtered = filtered.filter(c => selectedStates.includes(c.state));
    }

    // Sorting
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    setFilteredCutoffs(filtered);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  const exportToCSV = () => {
    const headers = ['College', 'State', 'Year', 'Category', 'Quota', 'Round', 'Opening Rank', 'Closing Rank', 'Seats'];
    const rows = filteredCutoffs.map(c => [
      c.college_name,
      c.state,
      c.year,
      c.category,
      c.quota,
      c.round,
      c.opening_rank,
      c.closing_rank,
      c.seats
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cutoffs_${Date.now()}.csv`;
    a.click();
  };

  const paginatedCutoffs = filteredCutoffs.slice(0, page * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <TableIcon className="w-7 h-7 mr-3" />
            Cutoff Explorer
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Explore and compare cutoffs across years, categories, and quotas
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
          </button>

          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search colleges, courses, or states..."
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
        >
          {/* Year Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Years
            </label>
            <div className="flex flex-wrap gap-2">
              {years.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYears(prev =>
                    prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
                  )}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    selectedYears.includes(year)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Category, Quota, Round */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategories(prev =>
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategories.includes(cat)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quota
              </label>
              <div className="flex flex-wrap gap-2">
                {quotas.map(quota => (
                  <button
                    key={quota}
                    onClick={() => setSelectedQuotas(prev =>
                      prev.includes(quota) ? prev.filter(q => q !== quota) : [...prev, quota]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedQuotas.includes(quota)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {quota}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Round
              </label>
              <div className="flex flex-wrap gap-2">
                {rounds.map(round => (
                  <button
                    key={round}
                    onClick={() => setSelectedRounds(prev =>
                      prev.includes(round) ? prev.filter(r => r !== round) : [...prev, round]
                    )}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedRounds.includes(round)
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {round === 4 ? 'Stray' : `R${round}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Rank Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Rank (optional - for highlighting)
            </label>
            <input
              type="number"
              value={userRank || ''}
              onChange={(e) => setUserRank(e.target.value ? Number(e.target.value) : null)}
              placeholder="Enter your NEET rank"
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </motion.div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div>
          Showing <span className="font-medium text-gray-900 dark:text-white">{paginatedCutoffs.length}</span> of <span className="font-medium text-gray-900 dark:text-white">{filteredCutoffs.length}</span> results
        </div>
        {userRank && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Green = Your rank better than cutoff</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort('college_name')}
                    className="flex items-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>College</span>
                    {getSortIcon('college_name')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  State
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort('year')}
                    className="flex items-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Year</span>
                    {getSortIcon('year')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Round
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort('opening_rank')}
                    className="flex items-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Opening</span>
                    {getSortIcon('opening_rank')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort('closing_rank')}
                    className="flex items-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Closing</span>
                    {getSortIcon('closing_rank')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort('seats')}
                    className="flex items-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Seats</span>
                    {getSortIcon('seats')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading cutoffs...
                  </td>
                </tr>
              ) : paginatedCutoffs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No cutoffs found matching your filters
                  </td>
                </tr>
              ) : (
                paginatedCutoffs.map((cutoff, index) => {
                  const canGetIn = userRank && userRank < cutoff.closing_rank;

                  return (
                    <motion.tr
                      key={cutoff.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: (index % itemsPerPage) * 0.02 }}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        canGetIn ? 'bg-green-50 dark:bg-green-900/10' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {cutoff.college_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cutoff.course_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {cutoff.state}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                        {cutoff.year}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs font-medium">
                          {cutoff.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                          {cutoff.quota}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {cutoff.round === 4 ? 'Stray' : `R${cutoff.round}`}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-700 dark:text-gray-300">
                        {cutoff.opening_rank.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-900 dark:text-white font-medium">
                        {cutoff.closing_rank.toLocaleString()}
                        {userRank && (
                          <div className={`text-xs mt-1 ${
                            canGetIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {canGetIn ? `+${cutoff.closing_rank - userRank}` : `${cutoff.closing_rank - userRank}`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                        {cutoff.seats}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                            title="Add to Favorites"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      {paginatedCutoffs.length < filteredCutoffs.length && (
        <div className="text-center">
          <button
            onClick={() => setPage(page + 1)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Load More ({filteredCutoffs.length - paginatedCutoffs.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
