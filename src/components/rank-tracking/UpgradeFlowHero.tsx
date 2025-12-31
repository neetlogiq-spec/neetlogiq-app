/**
 * Upgrade Flow Hero Component
 *
 * Hero section with filters and search controls for upgrade flow analyzer
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, TrendingUp, Crown } from 'lucide-react';

interface UpgradeFlowHeroProps {
  onSearch: (filters: FilterParams) => void;
  isLoading: boolean;
  isPremium: boolean;
  onUpgrade?: () => void;
}

export interface FilterParams {
  year: number;
  sourceId: string;
  levelId: string;
  category: string;
  quota: string;
  fromRound: number;
  toRound: number;
  minFlowCount: number;
}

const CURRENT_YEAR = new Date().getFullYear();

const SOURCES = [
  { id: 'SRC_KEA', name: 'Karnataka (KEA)' },
  { id: 'SRC_AIQ', name: 'All India Quota (AIQ)' },
  { id: 'SRC_MCC', name: 'Medical Counselling Committee (MCC)' },
  { id: 'SRC_TN', name: 'Tamil Nadu' },
];

const LEVELS = [
  { id: 'LVL_UG', name: 'UG - MBBS' },
  { id: 'LVL_PG', name: 'PG - MD/MS' },
  { id: 'LVL_DEN', name: 'UG - BDS' },
  { id: 'LVL_PG_DEN', name: 'PG - Dental' },
];

const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];

export default function UpgradeFlowHero({ onSearch, isLoading, isPremium, onUpgrade }: UpgradeFlowHeroProps) {
  const [filters, setFilters] = useState<FilterParams>({
    year: 2024,
    sourceId: 'SRC_AIQ',
    levelId: 'LVL_PG',
    category: 'OPEN',
    quota: 'ALL INDIA',
    fromRound: 1,
    toRound: 2,
    minFlowCount: 5,
  });

  const [availableQuotas, setAvailableQuotas] = useState<string[]>(['ALL INDIA', 'DNB QUOTA']);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['OPEN', 'OBC', 'SC', 'ST', 'EWS']);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);


  // Fetch available quotas when partition changes
  useEffect(() => {
    const fetchQuotas = async () => {
      try {
        setIsFetchingOptions(true);
        const source = filters.sourceId.startsWith('SRC_') ? filters.sourceId.substring(4) : filters.sourceId;
        const level = filters.levelId.startsWith('LVL_') ? filters.levelId.substring(4) : filters.levelId;
        const partitionKey = `${source}-${level}-${filters.year}`;

        const response = await fetch(`/api/filter-options?partition_key=${partitionKey}`);
        const result = await response.json();

        if (result.success && result.data) {
          // Update Quotas
          if (result.data.quotas) {
            const quotas = [...result.data.quotas].sort();
            if (!quotas.includes('All')) quotas.unshift('All');
            setAvailableQuotas(quotas);
            
            if (filters.quota !== 'All' && !quotas.includes(filters.quota)) {
              setFilters(prev => ({ ...prev, quota: quotas[0] || 'All' }));
            }
          }

          // Update Categories
          if (result.data.categories) {
            const categories = [...result.data.categories].sort();
            if (!categories.includes('All')) categories.unshift('All');
            setAvailableCategories(categories);

            if (filters.category !== 'All' && !categories.includes(filters.category)) {
              setFilters(prev => ({ ...prev, category: categories[0] || 'All' }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch quotas:', error);
      } finally {
        setIsFetchingOptions(false);
      }
    };

    fetchQuotas();
  }, [filters.year, filters.sourceId, filters.levelId]);

  const handleSearch = () => {
    onSearch(filters);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(99, 102, 241) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            {isPremium && (
              <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 border-0">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-geist mb-3 text-gray-900 dark:text-white">
            College-Course Upgrade Flow Analyzer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Discover how students migrate between college+course combinations across counselling rounds.
            See upgrade patterns, stability metrics, and strategic insights.
          </p>
        </motion.div>

        {/* Filters Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 bg-white/70 dark:bg-white/10 border-gray-200/50 dark:border-white/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Filter Options</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  Year
                </label>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = CURRENT_YEAR - i;
                    return <option key={year} value={year} className="bg-slate-900">{year}</option>;
                  })}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  Counselling Source
                </label>
                <select
                  value={filters.sourceId}
                  onChange={(e) => setFilters({ ...filters, sourceId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                >
                  {SOURCES.map((source) => (
                    <option key={source.id} value={source.id} className="bg-slate-900">{source.name}</option>
                  ))}
                </select>
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  Level
                </label>
                <select
                  value={filters.levelId}
                  onChange={(e) => setFilters({ ...filters, levelId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                >
                  {LEVELS.map((level) => (
                    <option key={level.id} value={level.id} className="bg-slate-900">{level.name}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                  ))}
                </select>
              </div>

              {/* From Round */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  From Round
                </label>
                <select
                  value={filters.fromRound}
                  onChange={(e) => setFilters({ ...filters, fromRound: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                >
                  {[1, 2, 3, 4, 5].map((round) => (
                    <option key={round} value={round} className="bg-slate-900">Round {round}</option>
                  ))}
                </select>
              </div>

              {/* To Round */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  To Round
                </label>
                <select
                  value={filters.toRound}
                  onChange={(e) => setFilters({ ...filters, toRound: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                >
                  {[2, 3, 4, 5, 6].map((round) => (
                    <option key={round} value={round} disabled={round <= filters.fromRound} className="bg-slate-900">
                      Round {round}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quota */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2 flex justify-between">
                  Quota
                  {isFetchingOptions && <span className="text-[10px] text-blue-600 dark:text-blue-400 animate-pulse">updating...</span>}
                </label>
                <select
                  value={filters.quota}
                  onChange={(e) => setFilters({ ...filters, quota: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                >
                  {availableQuotas.map((q) => (
                    <option key={q} value={q} className="bg-slate-900">{q}</option>
                  ))}
                </select>
              </div>

              {/* Min Flow Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200/90 mb-2">
                  Min Students
                </label>
                <input
                  type="number"
                  value={filters.minFlowCount}
                  onChange={(e) => setFilters({ ...filters, minFlowCount: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/20 rounded-lg bg-white/50 dark:bg-white/10 text-gray-900 dark:text-white/90 hover:bg-gray-50 dark:hover:bg-white/15 focus:ring-2 focus:ring-blue-500 transition-colors backdrop-blur-sm shadow-sm"
                />
              </div>
            </div>

            {/* Search Button */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 text-base"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Analyze Upgrade Flow
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Premium CTA */}
        {!isPremium && onUpgrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 text-center"
          >
            <button
              onClick={onUpgrade}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mx-auto"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Premium for unlimited analysis & advanced features
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
