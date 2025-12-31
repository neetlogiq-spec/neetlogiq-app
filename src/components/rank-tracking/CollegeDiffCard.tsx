'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Users, MapPin, Check, X, ArrowRight } from 'lucide-react';
import type { RankGroupCollege } from '@/services/rank-tracking-service';
import { Badge } from '@/components/ui/badge';

interface CollegeDiffCardProps {
  college: RankGroupCollege;
  status: 'new' | 'lost' | 'consistent';
  onClick?: () => void;
}

export default function CollegeDiffCard({ college, status, onClick }: CollegeDiffCardProps) {
  const statusConfig = {
    new: {
      icon: Check,
      bg: 'bg-green-50 dark:bg-green-500/10',
      border: 'border-green-100 dark:border-green-500/20',
      text: 'text-green-600 dark:text-green-400',
      hover: 'group-hover:text-green-700 dark:group-hover:text-green-300',
      indicator: 'bg-green-500',
      label: 'New Opportunity'
    },
    lost: {
      icon: X,
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-100 dark:border-red-500/20',
      text: 'text-red-600 dark:text-red-400',
      hover: 'group-hover:text-red-700 dark:group-hover:text-red-300',
      indicator: 'bg-red-500',
      label: 'No Longer Available'
    },
    consistent: {
      icon: ArrowRight,
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      border: 'border-blue-100 dark:border-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      hover: 'group-hover:text-blue-700 dark:group-hover:text-blue-300',
      indicator: 'bg-blue-500',
      label: 'Consistent'
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`relative group p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 ${config.bg} ${config.border} hover:bg-white dark:hover:bg-slate-800/80 cursor-default shadow-sm dark:shadow-none`}
    >
       <div className="flex justify-between items-start gap-3 mb-2">
          <div className="flex-1 min-w-0">
             <h4 className="font-semibold text-slate-900 dark:text-slate-200 text-sm line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-white transition-colors">
                {college.college_name}
             </h4>
             <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {college.course_name}
             </p>
          </div>
          <Icon className={`w-4 h-4 ${config.text}`} />
       </div>

       <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
             <GraduationCap className="w-3 h-3" />
             <span className="font-medium text-slate-700 dark:text-slate-300">
                {college.closing_rank.toLocaleString()}
             </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
             <Users className="w-3 h-3" />
             <span className="font-medium text-slate-700 dark:text-slate-300">
                {college.total_students}
             </span>
          </div>
       </div>

       {/* Status Pip */}
       <div className={`absolute top-4 left-0 w-0.5 h-8 rounded-r-full ${config.indicator}`} />
    </motion.div>
  );
}
