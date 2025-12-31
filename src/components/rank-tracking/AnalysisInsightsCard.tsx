'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CollegeDiffCard from './CollegeDiffCard';
import { TrendingUp, TrendingDown, ArrowRight, ChevronDown } from 'lucide-react';
import type { RankGroupCollege } from '@/services/rank-tracking-service';

interface AnalysisInsightsCardProps {
  mode: 'year' | 'round';
  analysis: {
    new_colleges?: RankGroupCollege[];
    lost_colleges?: RankGroupCollege[];
    consistent_colleges?: RankGroupCollege[];
    verdict?: 'easier' | 'harder' | 'similar';
    verdict_reason?: string;
    new_in_round2?: RankGroupCollege[];
    lost_in_round2?: RankGroupCollege[];
    consistent?: RankGroupCollege[];
    upgrade_opportunities?: number;
    degradation_count?: number;
  };
  isPremium: boolean;
}

export default function AnalysisInsightsCard({ mode, analysis, isPremium }: AnalysisInsightsCardProps) {
  const [expandedSection, setExpandedSection] = useState<'new' | 'lost' | 'consistent' | null>('new');

  const newColleges = mode === 'year' ? analysis.new_colleges : analysis.new_in_round2;
  const lostColleges = mode === 'year' ? analysis.lost_colleges : analysis.lost_in_round2;
  const consistentColleges = mode === 'year' ? analysis.consistent_colleges : analysis.consistent;

  const freeLimit = 5;
  const showNewCount = isPremium ? newColleges?.length ?? 0 : Math.min(newColleges?.length ?? 0, freeLimit);
  const showLostCount = isPremium ? lostColleges?.length ?? 0 : Math.min(lostColleges?.length ?? 0, freeLimit);

  const verdict = analysis.verdict || 'similar';

  const verdictConfig = {
    easier: {
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-500/10',
      border: 'border-green-200 dark:border-green-500/20',
      title: 'Positive Shift',
    },
    harder: {
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/20',
      title: 'Competition Increased',
    },
    similar: {
      icon: ArrowRight,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-500/10',
      border: 'border-yellow-200 dark:border-yellow-500/20',
      title: 'Stable Trends',
    },
  };

  const config = verdictConfig[verdict as keyof typeof verdictConfig] || verdictConfig.similar;
  const Icon = config.icon;

  const toggleSection = (section: 'new' | 'lost' | 'consistent') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Verdict Panel */}
      <div className={`p-6 rounded-2xl border backdrop-blur-xl transition-colors duration-300 ${config.bg} ${config.border}`}>
        <div className="flex items-start gap-5">
          <div className={`p-3 rounded-full bg-white dark:bg-slate-950/30 ${config.color} shadow-sm border border-white/20`}>
            <Icon className="w-8 h-8" />
          </div>
// ... imports
import { ProbabilityBadge } from '@/components/rank-tracking/ProbabilityBadge';

// ... inside component render
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className={`text-2xl font-bold text-slate-900 dark:text-white`}>
                {config.title}
              </h3>
              <ProbabilityBadge 
                probability={verdict === 'easier' ? 90 : verdict === 'similar' ? 60 : 30} 
                className="scale-90"
              />
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
              {analysis.verdict_reason}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <InsightStat 
            label={mode === 'year' ? 'New Opportunities' : 'New Additions'}
            count={newColleges?.length || 0}
            type="new"
            isActive={expandedSection === 'new'}
            onClick={() => toggleSection('new')}
         />
         <InsightStat 
            label={mode === 'year' ? 'Lost Options' : 'No Longer Available'}
            count={lostColleges?.length || 0}
            type="lost"
            isActive={expandedSection === 'lost'}
            onClick={() => toggleSection('lost')}
         />
         <InsightStat 
            label="Consistent Options"
            count={consistentColleges?.length || 0}
            type="consistent"
            isActive={expandedSection === 'consistent'}
            onClick={() => toggleSection('consistent')}
         />
      </div>

      {/* Detailed List */}
      <AnimatePresence mode="wait">
        {expandedSection && (
           <motion.div
              key={expandedSection}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
           >
              <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                 <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    {expandedSection === 'new' && <span className="w-2 h-2 rounded-full bg-green-500" />}
                    {expandedSection === 'lost' && <span className="w-2 h-2 rounded-full bg-red-500" />}
                    {expandedSection === 'consistent' && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    Detailed List
                 </h4>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {expandedSection === 'new' && newColleges?.slice(0, showNewCount).map((c, i) => (
                       <CollegeDiffCard key={i} college={c} status="new" />
                    ))}
                    {expandedSection === 'lost' && lostColleges?.slice(0, showLostCount).map((c, i) => (
                       <CollegeDiffCard key={i} college={c} status="lost" />
                    ))}
                    {expandedSection === 'consistent' && consistentColleges?.slice(0, 5).map((c, i) => (
                       <CollegeDiffCard key={i} college={c} status="consistent" />
                    ))}
                 </div>

                 {!isPremium && (expandedSection === 'new' || expandedSection === 'lost') && (
                    <div className="mt-4 text-center p-4 rounded-xl border border-dashed border-white/10 bg-white/5">
                       <p className="text-slate-400 text-sm mb-2">Unlock full list with Premium</p>
                       <button className="text-yellow-500 text-sm font-semibold hover:underline">Upgrade Now</button>
                    </div>
                 )}
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InsightStat({ label, count, type, isActive, onClick }: { label: string, count: number, type: 'new' | 'lost' | 'consistent', isActive: boolean, onClick: () => void }) {
   const colors = {
      new: 'green',
      lost: 'red',
      consistent: 'blue'
   };
   const color = colors[type];

   return (
      <button 
         onClick={onClick}
         className={`p-4 rounded-xl border text-left transition-all ${
            isActive 
            ? `bg-${color}-500/20 border-${color}-500/50` 
            : `bg-slate-900/50 border-white/5 hover:bg-slate-800`
         }`}
      >
         <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</div>
         <div className="flex items-end justify-between">
            <span className={`text-3xl font-bold text-white`}>{count}</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${isActive ? 'rotate-180 text-white' : 'text-slate-500'}`} />
         </div>
      </button>
   );
}
