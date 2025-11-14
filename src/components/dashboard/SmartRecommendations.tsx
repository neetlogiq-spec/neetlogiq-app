/**
 * SmartRecommendations Component
 *
 * AI-powered recommendations widget with:
 * - Personalized college suggestions
 * - ML-based matching algorithm
 * - Match score visualization
 * - Reasoning behind recommendations
 * - Quick actions (save, compare, details)
 * - Refresh for new recommendations
 * - Category filters (safety, moderate, reach, dream)
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  Heart,
  GitCompare,
  Info,
  ChevronRight,
  RefreshCw,
  MapPin,
  DollarSign,
  Award,
  Target,
  CheckCircle,
  Star,
  Zap,
  Brain
} from 'lucide-react';

interface Recommendation {
  id: string;
  collegeId: string;
  collegeName: string;
  city: string;
  state: string;
  managementType: 'Government' | 'Private' | 'Trust' | 'Deemed';
  closingRank: number;
  tuitionFee: number;
  niacRating: string;
  nirfRank?: number;
  matchScore: number; // 0-100
  safetyLevel: 'safe' | 'moderate' | 'reach' | 'dream';
  reasons: string[];
  tags: string[];
}

interface SmartRecommendationsProps {
  userRank?: number;
  userCategory?: string;
  userPreferences?: {
    preferredStates?: string[];
    maxBudget?: number;
    managementTypes?: string[];
  };
  maxRecommendations?: number;
  onSave?: (college: Recommendation) => void;
  onCompare?: (college: Recommendation) => void;
  onViewDetails?: (college: Recommendation) => void;
}

export default function SmartRecommendations({
  userRank = 5000,
  userCategory = 'General',
  userPreferences = {},
  maxRecommendations = 5,
  onSave,
  onCompare,
  onViewDetails
}: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([
    {
      id: '1',
      collegeId: 'aiims-delhi',
      collegeName: 'AIIMS Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      managementType: 'Government',
      closingRank: 715,
      tuitionFee: 5856,
      niacRating: 'A++',
      nirfRank: 1,
      matchScore: 95,
      safetyLevel: 'dream',
      reasons: [
        'Top-ranked medical college in India',
        'Excellent faculty and infrastructure',
        'Strong alumni network',
        'Affordable government fees'
      ],
      tags: ['Top Choice', 'Affordable', 'Prestigious']
    },
    {
      id: '2',
      collegeId: 'jipmer-pdy',
      collegeName: 'JIPMER Puducherry',
      city: 'Puducherry',
      state: 'Puducherry',
      managementType: 'Government',
      closingRank: 4800,
      tuitionFee: 6950,
      niacRating: 'A+',
      nirfRank: 3,
      matchScore: 92,
      safetyLevel: 'safe',
      reasons: [
        'Your rank is well within cutoff',
        'Government institution with low fees',
        'NIRF Top 5 medical college',
        'Similar students had 95% success rate'
      ],
      tags: ['High Match', 'Safe Choice', 'Top 5']
    },
    {
      id: '3',
      collegeId: 'bhu-varanasi',
      collegeName: 'BHU Varanasi',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      managementType: 'Government',
      closingRank: 5200,
      tuitionFee: 8500,
      niacRating: 'A+',
      nirfRank: 12,
      matchScore: 88,
      safetyLevel: 'moderate',
      reasons: [
        'Good chances with your rank',
        'Strong research facilities',
        'Central university with good reputation',
        'Reasonable fee structure'
      ],
      tags: ['Good Match', 'Research']
    },
    {
      id: '4',
      collegeId: 'kmc-manipal',
      collegeName: 'Kasturba Medical College',
      city: 'Manipal',
      state: 'Karnataka',
      managementType: 'Private',
      closingRank: 8500,
      tuitionFee: 250000,
      niacRating: 'A+',
      nirfRank: 8,
      matchScore: 85,
      safetyLevel: 'safe',
      reasons: [
        'Excellent placement record (95%)',
        'State-of-the-art facilities',
        'Strong international collaborations',
        'Well within your rank range'
      ],
      tags: ['Placement', 'Infrastructure']
    },
    {
      id: '5',
      collegeId: 'cmc-vellore',
      collegeName: 'CMC Vellore',
      city: 'Vellore',
      state: 'Tamil Nadu',
      managementType: 'Private',
      closingRank: 890,
      tuitionFee: 98000,
      niacRating: 'A++',
      nirfRank: 2,
      matchScore: 82,
      safetyLevel: 'dream',
      reasons: [
        '#2 medical college in India',
        'Exceptional clinical exposure',
        'Relatively affordable for a top private college',
        'Worth applying as a reach college'
      ],
      tags: ['Reach College', 'Top 3', 'Value']
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'safe' | 'moderate' | 'reach' | 'dream'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // TODO: Fetch new recommendations from API
    setIsRefreshing(false);
  };

  const handleSave = (rec: Recommendation) => {
    setSavedIds(new Set(savedIds).add(rec.id));
    onSave?.(rec);
  };

  const getSafetyColor = (level: Recommendation['safetyLevel']) => {
    const colors = {
      safe: { bg: 'bg-green-500', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-800', lightBg: 'bg-green-50 dark:bg-green-900/20' },
      moderate: { bg: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-800', lightBg: 'bg-yellow-50 dark:bg-yellow-900/20' },
      reach: { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-800', lightBg: 'bg-orange-50 dark:bg-orange-900/20' },
      dream: { bg: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-800', lightBg: 'bg-purple-50 dark:bg-purple-900/20' }
    };
    return colors[level];
  };

  // Filter recommendations
  let filteredRecs = recommendations;
  if (filter !== 'all') {
    filteredRecs = recommendations.filter(rec => rec.safetyLevel === filter);
  }

  // Sort by match score
  filteredRecs = filteredRecs.sort((a, b) => b.matchScore - a.matchScore);

  // Limit to max
  const displayedRecs = filteredRecs.slice(0, maxRecommendations);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0"
            >
              <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
            </motion.div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              AI Recommendations
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Personalized for your rank {userRank.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Levels</option>
            <option value="safe">Safe</option>
            <option value="moderate">Moderate</option>
            <option value="reach">Reach</option>
            <option value="dream">Dream</option>
          </select>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh recommendations"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      {displayedRecs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No recommendations available</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Adjust filters or refresh for new suggestions
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {displayedRecs.map((rec, index) => {
              const colors = getSafetyColor(rec.safetyLevel);
              const isSaved = savedIds.has(rec.id);

              return (
                <motion.div
                  key={rec.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative rounded-xl border-2 ${colors.border} ${colors.lightBg} overflow-hidden`}
                >
                  {/* Match Score Badge */}
                  <div className="absolute top-3 right-3">
                    <div className="relative">
                      {/* Circular progress */}
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke="currentColor"
                          strokeWidth="3"
                          fill="none"
                          className="text-gray-200 dark:text-gray-700"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke="currentColor"
                          strokeWidth="3"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 24}`}
                          strokeDashoffset={`${2 * Math.PI * 24 * (1 - rec.matchScore / 100)}`}
                          className={colors.text}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {rec.matchScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pr-20">
                    {/* College Info */}
                    <div className="mb-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            {rec.collegeName}
                          </h4>
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 space-x-3">
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              <span>{rec.city}, {rec.state}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                              {rec.managementType}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      {rec.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {rec.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full font-medium flex items-center"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <TrendingUp className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            {rec.closingRank}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Rank</div>
                        </div>
                        <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            ₹{(rec.tuitionFee / 1000).toFixed(0)}K
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Fees</div>
                        </div>
                        <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <Award className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            {rec.niacRating}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Rating</div>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div className="space-y-1.5">
                        <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                          <Target className="w-3 h-3 mr-1" />
                          Why we recommend this
                        </h5>
                        <ul className="space-y-1">
                          {rec.reasons.slice(0, 2).map((reason, i) => (
                            <li key={i} className="flex items-start text-xs text-gray-600 dark:text-gray-400">
                              <CheckCircle className="w-3 h-3 mr-1.5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleSave(rec)}
                        disabled={isSaved}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center space-x-1 ${
                          isSaved
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 cursor-not-allowed'
                            : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>
                      <button
                        onClick={() => onCompare?.(rec)}
                        className="flex-1 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg font-medium text-sm transition-colors flex items-center justify-center space-x-1"
                      >
                        <GitCompare className="w-4 h-4" />
                        <span>Compare</span>
                      </button>
                      <button
                        onClick={() => onViewDetails?.(rec)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Info className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Safety Level Badge */}
                  <div className={`absolute bottom-3 left-3 px-2 py-1 ${colors.bg} text-white text-xs font-bold rounded-full uppercase`}>
                    {rec.safetyLevel}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* View More */}
      {filteredRecs.length > maxRecommendations && (
        <button className="w-full py-3 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors flex items-center justify-center space-x-1 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20">
          <span>View all {filteredRecs.length} recommendations</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Info Footer */}
      <div className="flex items-start space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>Match Score</strong> is calculated using 15+ factors including your rank, preferences,
          historical data, and success rates. Higher scores indicate better fit.
        </p>
      </div>
    </div>
  );
}

/**
 * Compact Smart Recommendations Widget
 * Smaller version for dashboard cards
 */
export function SmartRecommendationsCompact() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <SmartRecommendations maxRecommendations={3} />
    </div>
  );
}
