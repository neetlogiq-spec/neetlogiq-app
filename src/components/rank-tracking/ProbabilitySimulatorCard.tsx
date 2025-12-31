'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ChartBar, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ProbabilitySimulatorCardProps {
  currentRank: number;
  totalColleges: number;
}

export function ProbabilitySimulatorCard({ currentRank, totalColleges }: ProbabilitySimulatorCardProps) {
  const [percentChange, setPercentChange] = useState(0);

  const simulatedRank = Math.round(currentRank * (1 + percentChange / 100));
  const rankDiff = simulatedRank - currentRank;
  
  // Dummy logic for demo sensation - in real app, this would recalculate against data
  // Assuming simpler access with better rank (lower rank number)
  const opportunityFactor = percentChange < 0 ? (Math.abs(percentChange) * 1.5) : -(percentChange * 0.8);
  const newCollegesCount = Math.max(0, Math.round(totalColleges * (1 + opportunityFactor / 100)));
  const extraColleges = newCollegesCount - totalColleges;

  const getSentimentColor = (val: number) => {
    if (val < 0) return "text-green-500"; // Lower rank is better
    if (val > 0) return "text-red-500";
    return "text-slate-500";
  };

  return (
    <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-blue-200 dark:border-blue-900 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
        <Zap className="w-32 h-32" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center">
               <ChartBar className="w-5 h-5" />
            </div>
            <div>
               <h3 className="font-bold text-slate-900 dark:text-gray-100 leading-tight">Probability Simulator</h3>
               <p className="text-xs text-slate-500">Assess simple "What If" scenarios</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setPercentChange(0)}
            disabled={percentChange === 0}
            className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Dynamic Display */}
        <div className="flex flex-col items-center justify-center py-6">
             <div className="text-sm text-slate-500 font-medium mb-1">Simulated Rank</div>
             <motion.div 
               key={simulatedRank}
               initial={{ scale: 1.2, color: '#3b82f6' }}
               animate={{ scale: 1, color: 'inherit' }}
               className="text-4xl font-black tabular-nums text-slate-900 dark:text-white"
             >
                {simulatedRank.toLocaleString()}
             </motion.div>
             
             <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${getSentimentColor(rankDiff)}`}>
                {rankDiff > 0 ? '+' : ''}{rankDiff.toLocaleString()} ({percentChange > 0 ? '+' : ''}{percentChange}%)
             </div>
        </div>

        {/* Interaction Area */}
        <div className="space-y-6">
            <Slider 
                value={[percentChange]} 
                min={-15} 
                max={15} 
                step={1} 
                onValueChange={(val) => setPercentChange(val[0])}
                className="py-4 cursor-grab active:cursor-grabbing"
            />
            <div className="flex justify-between text-xs text-slate-400 px-1 font-medium pb-4 border-b border-slate-200 dark:border-slate-800">
                <span>Better Rank</span>
                <span>Current</span>
                <span>Worse Rank</span>
            </div>
        </div>

        {/* Result Preview */}
        <AnimatePresence mode="wait">
            <motion.div 
                key={newCollegesCount}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-between text-sm"
            >
                <div>Estimated Options:</div>
                <div className="flex items-center gap-2">
                    <span className="font-bold">{newCollegesCount}</span>
                    {extraColleges !== 0 && (
                        <Badge variant={extraColleges > 0 ? 'default' : 'destructive'} className="h-5 px-1.5 text-[10px]">
                            {extraColleges > 0 ? `+${extraColleges} New` : `${extraColleges} Lost`}
                        </Badge>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}
