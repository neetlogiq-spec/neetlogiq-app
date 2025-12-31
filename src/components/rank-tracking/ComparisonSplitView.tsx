'use client';

import { motion } from 'framer-motion';
import { ArrowRightLeft, Users, GraduationCap, Lock, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RankGroupCollege } from '@/services/rank-tracking-service';

interface ComparisonSplitViewProps {
  mode: 'year' | 'round';
  left: {
    label: string;
    colleges: RankGroupCollege[];
    totalColleges: number;
    avgClosingRank: number;
  };
  right: {
    label: string;
    colleges: RankGroupCollege[];
    totalColleges: number;
    avgClosingRank: number;
  };
  isPremium: boolean;
}

export default function ComparisonSplitView({ mode, left, right, isPremium }: ComparisonSplitViewProps) {
  const freeLimit = 5;
  const leftShown = isPremium ? left.colleges : left.colleges.slice(0, freeLimit);
  const rightShown = isPremium ? right.colleges : right.colleges.slice(0, freeLimit);

  const getRankDiff = (rank1: number, rank2: number) => {
    const diff = rank2 - rank1;
    const isPositive = diff > 0; // Rank increased (technically worse, but numerically higher)
    // For ranks, usually lower is better. "Improvement" depends on context.
    // Let's just show numerical difference.
    return diff;
  };

  return (
    <div className="mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <ArrowRightLeft className="w-5 h-5 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white">
          Detailed Comparison
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        {/* Desktop Connector Line */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent -ml-px z-0" />

        {/* Left Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
           <PanelHeader label={left.label} count={left.totalColleges} avg={left.avgClosingRank} color="blue" />
           <div className="space-y-3 mt-4">
              {leftShown.map((college, idx) => (
                 <CollegeCard key={idx} college={college} index={idx} side="left" />
              ))}
              {!isPremium && left.colleges.length > freeLimit && (
                 <PremiumOverlay count={left.colleges.length - freeLimit} />
              )}
           </div>
        </motion.div>

        {/* Right Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
           <PanelHeader label={right.label} count={right.totalColleges} avg={right.avgClosingRank} color="indigo" />
           <div className="space-y-3 mt-4">
              {rightShown.map((college, idx) => (
                 <CollegeCard key={idx} college={college} index={idx} side="right" />
              ))}
              {!isPremium && right.colleges.length > freeLimit && (
                 <PremiumOverlay count={right.colleges.length - freeLimit} />
              )}
           </div>
        </motion.div>
      </div>
    </div>
  );
}

function PanelHeader({ label, count, avg, color }: { label: string, count: number, avg: number, color: 'blue' | 'indigo' }) {
   return (
      <div className={`
         p-5 rounded-2xl border backdrop-blur-xl mb-4
         ${color === 'blue' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}
      `}>
         <h4 className={`text-lg font-bold text-white mb-2`}>{label}</h4>
         <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
               <Users className="w-3.5 h-3.5 opacity-70" /> {count} Colleges
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span className="flex items-center gap-1.5">
               <Star className="w-3.5 h-3.5 opacity-70" /> Avg Rank: {avg.toLocaleString()}
            </span>
         </div>
      </div>
   );
}

function CollegeCard({ college, index, side }: { college: RankGroupCollege, index: number, side: 'left' | 'right' }) {
   return (
      <motion.div
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: index * 0.05 }}
         className="group p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 hover:border-blue-200 dark:hover:border-white/15 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-default shadow-sm dark:shadow-none"
      >
         <div className="flex justify-between items-start mb-2">
            <h5 className="font-semibold text-sm text-slate-900 dark:text-slate-200 line-clamp-1 flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
               {college.college_name}
            </h5>
            <Badge variant="secondary" className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[10px] ml-2 shrink-0 border-slate-200 dark:border-transparent">
               {college.closing_rank.toLocaleString()}
            </Badge>
         </div>
         <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
             <GraduationCap className="w-3 h-3" />
             <span className="line-clamp-1">{college.course_name}</span>
         </div>
         <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
               className="h-full bg-slate-400 dark:bg-slate-600 rounded-full group-hover:bg-blue-500 transition-colors"
               style={{ width: `${Math.min((college.total_students / 100) * 100, 100)}%` }} // Mock student density
            />
         </div>
      </motion.div>
   );
}

function PremiumOverlay({ count }: { count: number }) {
   return (
      <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center text-center">
         <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
         </div>
         <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-1">
            Unlock {count} more colleges
         </p>
         <button className="text-xs text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 font-semibold transition-colors">
            Upgrade to Premium &rarr;
         </button>
      </div>
   );
}
