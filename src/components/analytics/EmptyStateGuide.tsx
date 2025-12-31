'use client';

import { FileSearch, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface EmptyStateGuideProps {
  onSearchExample: () => void;
}

export function EmptyStateGuide({ onSearchExample }: EmptyStateGuideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="max-w-md mx-auto py-12 px-6 text-center"
    >
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-ping opacity-20" />
        <div className="relative z-10 w-24 h-24 bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-100 dark:border-white/10 flex items-center justify-center">
            <FileSearch className="w-10 h-10 text-slate-400" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        Let's Find Your College
      </h3>
      <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
        We haven't found data for this specific rank yet. Try searching for a broader range or use our example to see how it works.
      </p>

      <div className="grid gap-3">
        <Button 
            onClick={onSearchExample}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 h-12 rounded-xl group"
        >
            <TrendingUp className="w-4 h-4 mr-2" /> 
            Try Rank 5000 Example
            <ArrowRight className="w-4 h-4 ml-auto opacity-70 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </motion.div>
  );
}
