'use client';

/**
 * Rank Group Analysis Client Component
 * 
 * Premium redesign matching the Rank Group Hero.
 * - Dark theme consistency
 * - Split-view comparison in glass panels
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremium } from '@/contexts/PremiumContext';
import RankGroupHero from '@/components/rank-tracking/RankGroupHero';
import ComparisonSplitView from '@/components/rank-tracking/ComparisonSplitView';
import AnalysisInsightsCard from '@/components/rank-tracking/AnalysisInsightsCard';
import type { YearWiseComparison, RoundWiseComparison, RankGroupFilters } from '@/services/rank-tracking-service';
import { Layers } from 'lucide-react';

type ComparisonMode = 'year' | 'round';

export default function RankGroupAnalysisClient() {
  const { isPremium } = usePremium();
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('year');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [yearComparison, setYearComparison] = useState<YearWiseComparison | null>(null);
  const [roundComparison, setRoundComparison] = useState<RoundWiseComparison | null>(null);

  const handleCompare = async (
    mode: ComparisonMode,
    filters: RankGroupFilters,
    params: { year1?: number; year2?: number; year?: number; round1?: number; round2?: number; round?: number }
  ) => {
    setIsLoading(true);
    setError(null);
    setComparisonMode(mode);

    try {
      if (mode === 'year') {
        const queryParams = new URLSearchParams({
          rank_start: filters.rank_start.toString(),
          rank_end: filters.rank_end.toString(),
          category: filters.category,
          quota: filters.quota,
          source_id: filters.source_id,
          level_id: filters.level_id,
          year1: params.year1!.toString(),
          year2: params.year2!.toString(),
          round: params.round!.toString(),
        });

        const response = await fetch(`/api/rank-tracking/compare-years?${queryParams}`);
        const result = await response.json();

        if (result.success) {
          setYearComparison(result.data);
          setRoundComparison(null);
        } else {
          setError(result.error || 'Failed to fetch year comparison');
        }
      } else {
        const queryParams = new URLSearchParams({
          rank_start: filters.rank_start.toString(),
          rank_end: filters.rank_end.toString(),
          category: filters.category,
          quota: filters.quota,
          source_id: filters.source_id,
          level_id: filters.level_id,
          year: params.year!.toString(),
          round1: params.round1!.toString(),
          round2: params.round2!.toString(),
        });

        const response = await fetch(`/api/rank-tracking/compare-rounds?${queryParams}`);
        const result = await response.json();

        if (result.success) {
          setRoundComparison(result.data);
          setYearComparison(null);
        } else {
          setError(result.error || 'Failed to fetch round comparison');
        }
      }
    } catch (err) {
      console.error('Error fetching comparison:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 transition-colors duration-300">
      {/* Hero Section */}
      <RankGroupHero
        onCompare={handleCompare}
        isLoading={isLoading}
        comparisonMode={comparisonMode}
        onModeChange={setComparisonMode}
      />

      {/* Main Content */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 py-12">
        <AnimatePresence mode="wait">
          
          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-700 dark:text-red-200 text-center">
                {error}
              </div>
            </motion.div>
          )}

          {/* Loading State - Custom Spinner */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-24"
            >
              <div className="flex flex-col items-center gap-4">
                 <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
                 </div>
                 <p className="text-indigo-600 dark:text-indigo-200 font-medium animate-pulse">Analyzing Data...</p>
              </div>
            </motion.div>
          )}

          {/* Results - Year-wise Comparison */}
          {!isLoading && yearComparison && (
            <motion.div
              key="year-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8 pb-20"
            >
              <AnalysisInsightsCard
                mode="year"
                analysis={yearComparison.analysis}
                isPremium={isPremium}
              />

              <div className="relative">
                 {/* Decorative Glow */}
                 <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] pointer-events-none rounded-full" />
                 
                 <ComparisonSplitView
                    mode="year"
                    left={{
                      label: `Year ${yearComparison.year1.year}`,
                      colleges: yearComparison.year1.colleges,
                      totalColleges: yearComparison.year1.total_colleges,
                      avgClosingRank: yearComparison.year1.avg_closing_rank,
                    }}
                    right={{
                      label: `Year ${yearComparison.year2.year}`,
                      colleges: yearComparison.year2.colleges,
                      totalColleges: yearComparison.year2.total_colleges,
                      avgClosingRank: yearComparison.year2.avg_closing_rank,
                    }}
                    isPremium={isPremium}
                  />
              </div>
            </motion.div>
          )}

          {/* Results - Round-wise Comparison */}
          {!isLoading && roundComparison && (
            <motion.div
              key="round-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8 pb-20"
            >
              <AnalysisInsightsCard
                mode="round"
                analysis={roundComparison.analysis}
                isPremium={isPremium}
              />

              <div className="relative">
                 <div className="absolute inset-0 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />
                 
                 <ComparisonSplitView
                    mode="round"
                    left={{
                      label: `Round ${roundComparison.round1.round}`,
                      colleges: roundComparison.round1.colleges,
                      totalColleges: roundComparison.round1.total_colleges,
                      avgClosingRank: roundComparison.round1.avg_closing_rank,
                    }}
                    right={{
                      label: `Round ${roundComparison.round2.round}`,
                      colleges: roundComparison.round2.colleges,
                      totalColleges: roundComparison.round2.total_colleges,
                      avgClosingRank: roundComparison.round2.avg_closing_rank,
                    }}
                    isPremium={isPremium}
                 />
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {!isLoading && !yearComparison && !roundComparison && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center py-20"
            >
               <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rotate-3 mb-6 shadow-xl shadow-indigo-500/10 dark:shadow-indigo-900/20">
                  <Layers className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
               </div>
               <h3 className="text-xl font-medium text-slate-700 dark:text-slate-200 mb-2">Ready for Analysis</h3>
               <p className="text-slate-500 max-w-sm mx-auto">
                 Configure your comparison parameters above to see the insights.
               </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
