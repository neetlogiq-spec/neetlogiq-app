'use client';

/**
 * Interactive Journey Timeline
 *
 * Beautiful animated timeline showing rank progression through rounds
 * Premium dark/glass design
 */

import { motion } from 'framer-motion';
import { Check, TrendingUp, ArrowRight, Building2, Award, Lock, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RankJourney } from '@/services/rank-tracking-service';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/CountUp';

interface InteractiveJourneyTimelineProps {
  journey: RankJourney | null;
  isPremium?: boolean;
  onUpgrade?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 100 }
  }
};

export default function InteractiveJourneyTimeline({
  journey,
  isPremium = false,
  onUpgrade,
}: InteractiveJourneyTimelineProps) {
  if (!journey) {
    return (
      <div className="p-12 text-center bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-3xl backdrop-blur-sm">
        <div className="text-slate-500">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Search for a rank to see the journey</p>
        </div>
      </div>
    );
  }

  const { allocations } = journey;
  const showBlur = !isPremium && allocations.length > 1;

  return (
    <div className="relative">
      <div className={showBlur ? 'filter blur-sm pointer-events-none select-none' : ''}>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Rank', value: journey.rank, color: 'blue' },
            { label: 'Upgrades', value: journey.total_upgrades, color: 'green' },
            { label: 'Rounds', value: journey.total_rounds_participated, color: 'purple' },
            { label: 'Final Round', value: journey.final_round, color: 'yellow' }
          ].map((stat, idx) => (
             <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-4 rounded-2xl bg-${stat.color}-100 dark:bg-${stat.color}-500/10 border border-${stat.color}-200 dark:border-${stat.color}-500/20`}
             >
                <div className={`text-sm text-${stat.color}-600 dark:text-${stat.color}-300 font-medium mb-1`}>{stat.label}</div>
                <div className={`text-2xl font-bold text-${stat.color}-900 dark:text-${stat.color}-100`}>
                    <CountUp end={stat.value} duration={1.5} />
                </div>
             </motion.div>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative space-y-8 pl-8 md:pl-0">
          {/* Vertical Line */}
          <div className="absolute left-8 md:left-[50%] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 md:-ml-[1px]" />

          {allocations.map((allocation, index) => {
            const isLast = index === allocations.length - 1;
            const isUpgrade = allocation.is_upgrade;
            const isEven = index % 2 === 0;

            return (
              <motion.div
                key={allocation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`relative flex items-center md:justify-between ${
                    !isEven ? 'md:flex-row-reverse' : ''
                }`}
              >
                 {/* Center Dot */}
                 <div className="absolute left-8 md:left-[50%] -translate-x-1/2 w-12 h-12 rounded-full border-4 border-slate-50 dark:border-slate-950 flex items-center justify-center z-10 bg-white dark:bg-slate-900 shadow-lg shadow-blue-500/20 dark:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                       isLast ? 'bg-gradient-to-br from-green-400 to-green-600' :
                       isUpgrade ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                       'bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-700 dark:to-slate-600'
                    }`}>
                       {isLast ? <Award className="w-4 h-4 text-white" /> :
                        isUpgrade ? <TrendingUp className="w-4 h-4 text-white" /> :
                        <Check className="w-4 h-4 text-slate-600 dark:text-white" />}
                    </div>
                    {/* Round Badge */}
                    <div className="absolute -top-2 -right-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                       R{allocation.round}
                    </div>
                 </div>

                 {/* Content Card */}
                 <div className={`ml-8 md:ml-0 md:w-[45%] p-6 rounded-3xl bg-slate-900/50 border border-white/10 hover:border-white/20 hover:bg-slate-900/80 transition-all group backdrop-blur-md`}>
                    <div className="flex justify-between items-start mb-4">
                       <Badge variant="outline" className={`
                          ${allocation.allocation_status === 'ALLOTTED' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                            allocation.allocation_status === 'UPGRADED' ? 'bg-green-500/10 text-green-300 border-green-500/20' :
                            'bg-slate-500/10 text-slate-300 border-slate-500/20'}
                       `}>
                          {allocation.allocation_status}
                       </Badge>
                       {isLast && (
                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                             Final Seat
                          </Badge>
                       )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">
                       <Building2 className="w-4 h-4 inline mr-2 text-slate-400" />
                       {allocation.college_name || 'College Not Specified'}
                    </h3>
                    <p className="text-slate-400 text-sm ml-6 mb-4">
                       {allocation.course_name || 'Course Not Specified'}
                    </p>

                    {isUpgrade && allocation.previous_college_name && (
                       <div className="mt-4 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                          <div className="text-xs text-green-400 font-medium mb-2 flex items-center gap-1">
                             <TrendingUp className="w-3 h-3" /> Upgraded From:
                          </div>
                          <div className="text-sm text-slate-300 line-through decoration-slate-600 decoration-2">
                             {allocation.previous_college_name}
                          </div>
                          <div className="flex items-center justify-center my-1 text-green-500">
                             <ArrowRight className="w-4 h-4 rotate-90" />
                          </div>
                          <div className="text-sm text-green-300 font-medium">
                             {allocation.college_name}
                          </div>
                       </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                       <span>{allocation.data_source?.replace(/_/g, ' ')}</span>
                       {allocation.verification_status === 'verified' && (
                          <span className="flex items-center gap-1 text-green-500/80">
                             <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                       )}
                    </div>
                 </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Premium Lock Overlay */}
      {showBlur && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-20">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="text-center p-8 rounded-3xl bg-slate-900 border border-yellow-500/30 max-w-sm mx-4 shadow-2xl shadow-yellow-900/20"
           >
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                 <Lock className="w-8 h-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Premium Timeline</h3>
              <p className="text-slate-400 mb-6 text-sm">
                 Unlock the full journey history, detailed upgrade analysis, and verified allocation data.
              </p>
              {onUpgrade && (
                 <Button onClick={onUpgrade} className="w-full bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold">
                    Unlock Now
                 </Button>
              )}
           </motion.div>
        </div>
      )}
    </div>
  );
}
