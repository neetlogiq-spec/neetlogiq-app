/**
 * RankToCollegeMapper Component
 *
 * Input rank, get colleges:
 * - Safe colleges (50+)
 * - Moderate colleges (30+)
 * - Reach colleges (20+)
 * - Dream colleges (10+)
 * - Filter by state, management, budget
 * - Download personalized list
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Search,
  Filter,
  Download,
  MapPin,
  DollarSign,
  Building2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Star,
  TrendingUp
} from 'lucide-react';

interface CollegeMatch {
  id: string;
  name: string;
  state: string;
  city: string;
  managementType: string;
  closingRank: number;
  openingRank: number;
  seats: number;
  fees: number;
  safetyLevel: 'safe' | 'moderate' | 'reach' | 'dream';
  rankDifference: number;
  probability: number;
}

export default function RankToCollegeMapper() {
  const [userRank, setUserRank] = useState<number | ''>('');
  const [category, setCategory] = useState('General');
  const [quota, setQuota] = useState('AIQ');
  const [preferredStates, setPreferredStates] = useState<string[]>([]);
  const [managementFilter, setManagementFilter] = useState<string[]>(['Government', 'Private']);
  const [maxBudget, setMaxBudget] = useState<number>(500000);
  const [results, setResults] = useState<CollegeMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS'];
  const quotas = ['AIQ', 'State Quota', 'Management'];
  const states = ['Delhi', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Kerala', 'UP', 'MP', 'Rajasthan'];
  const managementTypes = ['Government', 'Private', 'Trust', 'Deemed'];

  const findColleges = async () => {
    if (!userRank) {
      alert('Please enter your rank');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock data generation
      const mockResults: CollegeMatch[] = [];
      const rankNum = Number(userRank);

      // Generate safe colleges
      for (let i = 0; i < 50; i++) {
        const closingRank = rankNum + 1000 + Math.random() * 3000;
        mockResults.push({
          id: `safe_${i}`,
          name: `Government Medical College ${i + 1}`,
          state: states[Math.floor(Math.random() * states.length)],
          city: `City ${i + 1}`,
          managementType: managementTypes[Math.floor(Math.random() * managementTypes.length)],
          closingRank: Math.round(closingRank),
          openingRank: Math.round(closingRank - 200),
          seats: 100 + Math.floor(Math.random() * 50),
          fees: 50000 + Math.floor(Math.random() * 200000),
          safetyLevel: 'safe',
          rankDifference: Math.round(closingRank - rankNum),
          probability: 85 + Math.random() * 10
        });
      }

      // Generate moderate colleges
      for (let i = 0; i < 30; i++) {
        const closingRank = rankNum + 200 + Math.random() * 800;
        mockResults.push({
          id: `moderate_${i}`,
          name: `Medical College ${i + 51}`,
          state: states[Math.floor(Math.random() * states.length)],
          city: `City ${i + 51}`,
          managementType: managementTypes[Math.floor(Math.random() * managementTypes.length)],
          closingRank: Math.round(closingRank),
          openingRank: Math.round(closingRank - 150),
          seats: 80 + Math.floor(Math.random() * 40),
          fees: 100000 + Math.floor(Math.random() * 250000),
          safetyLevel: 'moderate',
          rankDifference: Math.round(closingRank - rankNum),
          probability: 60 + Math.random() * 20
        });
      }

      // Generate reach colleges
      for (let i = 0; i < 20; i++) {
        const closingRank = rankNum - 200 + Math.random() * 400;
        mockResults.push({
          id: `reach_${i}`,
          name: `Premier Medical Institute ${i + 1}`,
          state: states[Math.floor(Math.random() * states.length)],
          city: `City ${i + 81}`,
          managementType: managementTypes[Math.floor(Math.random() * managementTypes.length)],
          closingRank: Math.round(closingRank),
          openingRank: Math.round(closingRank - 100),
          seats: 60 + Math.floor(Math.random() * 30),
          fees: 150000 + Math.floor(Math.random() * 300000),
          safetyLevel: 'reach',
          rankDifference: Math.round(closingRank - rankNum),
          probability: 30 + Math.random() * 25
        });
      }

      // Generate dream colleges
      for (let i = 0; i < 10; i++) {
        const closingRank = rankNum - 500 - Math.random() * 1000;
        mockResults.push({
          id: `dream_${i}`,
          name: `Top Tier Medical College ${i + 1}`,
          state: states[Math.floor(Math.random() * states.length)],
          city: `City ${i + 101}`,
          managementType: 'Government',
          closingRank: Math.round(closingRank),
          openingRank: Math.round(closingRank - 80),
          seats: 50 + Math.floor(Math.random() * 20),
          fees: 50000 + Math.floor(Math.random() * 100000),
          safetyLevel: 'dream',
          rankDifference: Math.round(closingRank - rankNum),
          probability: 5 + Math.random() * 20
        });
      }

      // Apply filters
      let filtered = mockResults;

      if (preferredStates.length > 0) {
        filtered = filtered.filter(c => preferredStates.includes(c.state));
      }

      if (managementFilter.length > 0) {
        filtered = filtered.filter(c => managementFilter.includes(c.managementType));
      }

      filtered = filtered.filter(c => c.fees <= maxBudget);

      setResults(filtered);
    } catch (error) {
      console.error('Error finding colleges:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleState = (state: string) => {
    setPreferredStates(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const toggleManagement = (type: string) => {
    setManagementFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const getSafetyIcon = (level: string) => {
    switch (level) {
      case 'safe': return CheckCircle;
      case 'moderate': return AlertCircle;
      case 'reach': return AlertTriangle;
      case 'dream': return XCircle;
      default: return Target;
    }
  };

  const getSafetyColor = (level: string) => {
    switch (level) {
      case 'safe': return 'green';
      case 'moderate': return 'yellow';
      case 'reach': return 'orange';
      case 'dream': return 'red';
      default: return 'gray';
    }
  };

  const groupedResults = {
    safe: results.filter(r => r.safetyLevel === 'safe'),
    moderate: results.filter(r => r.safetyLevel === 'moderate'),
    reach: results.filter(r => r.safetyLevel === 'reach'),
    dream: results.filter(r => r.safetyLevel === 'dream')
  };

  const downloadList = () => {
    const csv = ['College Name,State,City,Management,Closing Rank,Seats,Fees,Safety Level,Probability']
      .concat(results.map(r =>
        `${r.name},${r.state},${r.city},${r.managementType},${r.closingRank},${r.seats},${r.fees},${r.safetyLevel},${r.probability.toFixed(1)}%`
      ))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `college_list_rank_${userRank}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Target className="w-7 h-7 mr-3" />
          Rank to College Mapper
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Enter your rank to find colleges you can get into
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-6">
          {/* Rank Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your NEET Rank *
            </label>
            <input
              type="number"
              value={userRank}
              onChange={(e) => setUserRank(e.target.value ? Number(e.target.value) : '')}
              placeholder="Enter your NEET rank (e.g., 5000)"
              className="w-full px-4 py-3 text-lg font-mono bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category and Quota */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quota
              </label>
              <select
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                {quotas.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>

          {/* Preferred States */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred States (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {states.map(state => (
                <button
                  key={state}
                  onClick={() => toggleState(state)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    preferredStates.includes(state)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          {/* Management Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Management Type
            </label>
            <div className="flex flex-wrap gap-2">
              {managementTypes.map(type => (
                <button
                  key={type}
                  onClick={() => toggleManagement(type)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    managementFilter.includes(type)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maximum Annual Fee: ₹{maxBudget.toLocaleString('en-IN')}
            </label>
            <input
              type="range"
              min="50000"
              max="1000000"
              step="50000"
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>₹50K</span>
              <span>₹10L</span>
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={findColleges}
            disabled={!userRank || loading}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium text-lg transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
                <span>Finding Colleges...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Find My Colleges</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {searched && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Found {results.length} colleges for your rank
                </h3>
                {results.length > 0 && (
                  <button
                    onClick={downloadList}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download List</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{groupedResults.safe.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Safe</div>
                </div>
                <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600">{groupedResults.moderate.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Moderate</div>
                </div>
                <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{groupedResults.reach.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Reach</div>
                </div>
                <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">{groupedResults.dream.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Dream</div>
                </div>
              </div>
            </div>

            {/* College Lists by Category */}
            {(['safe', 'moderate', 'reach', 'dream'] as const).map(level => {
              const colleges = groupedResults[level];
              if (colleges.length === 0) return null;

              const Icon = getSafetyIcon(level);
              const color = getSafetyColor(level);

              return (
                <div key={level} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className={`text-lg font-bold text-${color}-600 mb-4 flex items-center capitalize`}>
                    <Icon className="w-5 h-5 mr-2" />
                    {level} Colleges ({colleges.length})
                  </h3>

                  <div className="space-y-3">
                    {colleges.slice(0, 10).map((college, index) => (
                      <motion.div
                        key={college.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {college.name}
                            </h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {college.city}, {college.state}
                              </div>
                              <div className="flex items-center">
                                <Building2 className="w-4 h-4 mr-1" />
                                {college.managementType}
                              </div>
                              <div className="flex items-center">
                                <DollarSign className="w-4 h-4 mr-1" />
                                ₹{(college.fees / 1000).toFixed(0)}K/yr
                              </div>
                            </div>
                          </div>

                          <div className="text-right ml-4">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Closing Rank</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                              {college.closingRank.toLocaleString()}
                            </div>
                            <div className={`text-sm font-medium text-${color}-600`}>
                              {college.probability.toFixed(0)}% chance
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {colleges.length > 10 && (
                      <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                        + {colleges.length - 10} more colleges (download full list)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {results.length === 0 && (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-gray-600 dark:text-gray-400">
                  No colleges found matching your criteria. Try adjusting your filters.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
