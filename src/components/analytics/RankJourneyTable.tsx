'use client';

/**
 * Rank Journey Table
 *
 * Displays rank journey in tabular format similar to Excel
 * Shows QUOTA, COLLEGE, STATE, COURSE, CATEGORY per round
 */

import { motion } from 'framer-motion';
import { TrendingUp, Check, ArrowRight, Building2 } from 'lucide-react';
import { RankJourney } from '@/services/rank-tracking-service';
import { Badge } from '@/components/ui/badge';

interface RankJourneyTableProps {
  journey: RankJourney | null;
  isPremium?: boolean;
}

export default function RankJourneyTable({ journey, isPremium = false }: RankJourneyTableProps) {
  if (!journey) {
    return (
      <div className="p-12 text-center bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-3xl">
        <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-400" />
        <p className="text-lg font-medium text-slate-500">Search for a rank to see the journey table</p>
      </div>
    );
  }

  const { allocations } = journey;
  const showBlur = !isPremium && allocations.length > 1;

  // Check if there was an upgrade between rounds
  const getUpgradeInfo = (index: number) => {
    if (index === 0) return null;
    const prev = allocations[index - 1];
    const curr = allocations[index];
    
    if (prev.college_name !== curr.college_name) {
      return { type: 'COLLEGE', from: prev.college_name, to: curr.college_name };
    }
    if (prev.course_name !== curr.course_name) {
      return { type: 'COURSE', from: prev.course_name, to: curr.course_name };
    }
    return null;
  };

  return (
    <div className="relative">
      <div className={showBlur ? 'filter blur-sm pointer-events-none select-none' : ''}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                Rank {journey.rank.toLocaleString()} Journey
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {journey.category} • {journey.quota} • {journey.year}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={journey.total_upgrades > 0 ? 'text-green-600 border-green-200 dark:border-green-800' : ''}>
            {journey.total_upgrades > 0 ? `${journey.total_upgrades} Upgrade${journey.total_upgrades > 1 ? 's' : ''}` : 'No Upgrades'}
          </Badge>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-100 dark:bg-slate-800/80 z-10 min-w-[80px]">
                  ROUND
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[80px]">
                  QUOTA
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[250px]">
                  COLLEGE/INSTITUTE
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[100px]">
                  STATE
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[200px]">
                  COURSE
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[100px]">
                  CATEGORY
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 min-w-[100px]">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc, index) => {
                const upgradeInfo = getUpgradeInfo(index);
                const isLast = index === allocations.length - 1;
                
                return (
                  <motion.tr
                    key={alloc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                      ${upgradeInfo ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-slate-900/50'}
                      ${isLast ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                      hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors
                    `}
                  >
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">R{alloc.round}</span>
                        {upgradeInfo && (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {alloc.quota || 'STATE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${upgradeInfo?.type === 'COLLEGE' ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                          {alloc.college_name || '-'}
                        </span>
                        {upgradeInfo?.type === 'COLLEGE' && (
                          <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                            UPGRADED
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {alloc.state || 'KARNATAKA'}
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`${upgradeInfo?.type === 'COURSE' ? 'text-green-700 dark:text-green-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                          {alloc.course_name || '-'}
                        </span>
                        {upgradeInfo?.type === 'COURSE' && (
                          <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                            UPGRADED
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {alloc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        alloc.allocation_status === 'FREEZE' 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : alloc.allocation_status === 'UPGRADED'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {alloc.allocation_status}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Upgrade Summary */}
        {journey.total_upgrades > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          >
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
              <TrendingUp className="w-5 h-5" />
              <span>Upgrade Summary</span>
            </div>
            <div className="mt-2 text-sm text-green-600 dark:text-green-300">
              This rank upgraded {journey.total_upgrades} time{journey.total_upgrades > 1 ? 's' : ''} during counselling. 
              Final college: <strong>{allocations[allocations.length - 1]?.college_name}</strong>
            </div>
          </motion.div>
        )}
      </div>

      {/* Premium Overlay */}
      {showBlur && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-slate-950/30 backdrop-blur-sm rounded-3xl">
          <div className="text-center p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-sm">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Premium Feature</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Unlock full journey table with all rounds and detailed upgrade analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
