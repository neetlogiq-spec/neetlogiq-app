'use client';

/**
 * Rank Group Hero Section
 * 
 * Premium redesign featuring:
 * - Animated mesh gradients
 * - Glassmorphism container
 * - Smooth mode switching
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRightLeft, Calendar, Layers, Filter } from 'lucide-react';
import RankRangeSlider from './RankRangeSlider';
import type { RankGroupFilters } from '@/services/rank-tracking-service';

// Utility class for styled native select
const selectClassName = "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white ring-offset-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";

type ComparisonMode = 'year' | 'round';

interface RankGroupHeroProps {
  onCompare: (
    mode: ComparisonMode,
    filters: RankGroupFilters,
    params: { year1?: number; year2?: number; year?: number; round1?: number; round2?: number; round?: number }
  ) => void;
  isLoading: boolean;
  comparisonMode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);
const ROUNDS = [1, 2, 3, 4, 5, 6];

export default function RankGroupHero({
  onCompare,
  isLoading,
  comparisonMode,
  onModeChange,
}: RankGroupHeroProps) {
  // Filter state
  const [rankRange, setRankRange] = useState<[number, number]>([50000, 60000]);
  const [category, setCategory] = useState('OPEN');
  const [quota, setQuota] = useState('AI');
  const [sourceId, setSourceId] = useState('JEE_MAIN');
  const [levelId, setLevelId] = useState('BTECH');

  // Year-wise params
  const [year1, setYear1] = useState(CURRENT_YEAR - 2);
  const [year2, setYear2] = useState(CURRENT_YEAR - 1);
  const [roundForYear, setRoundForYear] = useState(1);

  // Round-wise params
  const [yearForRound, setYearForRound] = useState(CURRENT_YEAR - 1);
  const [round1, setRound1] = useState(1);
  const [round2, setRound2] = useState(2);

  const handleCompare = () => {
    const filters: RankGroupFilters = {
      rank_start: rankRange[0],
      rank_end: rankRange[1],
      category,
      quota,
      source_id: sourceId,
      level_id: levelId,
    };

    if (comparisonMode === 'year') {
      onCompare(comparisonMode, filters, {
        year1,
        year2,
        round: roundForYear,
      });
    } else {
      onCompare(comparisonMode, filters, {
        year: yearForRound,
        round1,
        round2,
      });
    }
  };

  const isValidRange = rankRange[1] - rankRange[0] >= 1000;
  const canCompare = isValidRange && !isLoading;

  return (
    <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-950 min-h-[500px] flex items-center justify-center transition-colors duration-300">
      {/* Animated Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-400/30 dark:bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/30 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
         <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] dark:opacity-20 bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8 }}
           className="text-center mb-12"
        >
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 text-sm font-medium mb-4">
              <Filter className="w-4 h-4" />
              <span>Comparative Analytics</span>
           </div>
           <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">
              Compare & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Contrast</span>
           </h1>
           <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Analyze rank trends across different years or counselling rounds to find your best options.
           </p>
        </motion.div>

        {/* Comparison Control Panel */}
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.5, delay: 0.2 }}
           className="bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl shadow-blue-900/5 dark:shadow-none ring-1 ring-black/5 dark:ring-white/10"
        >
          {/* Mode Switcher */}
          <div className="flex justify-center mb-10">
            <div className="bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl inline-flex relative">
               {/* Sliding Pill */}
               <motion.div 
                 className="absolute inset-y-1.5 rounded-lg bg-white dark:bg-slate-700 shadow-sm"
                 initial={false}
                 animate={{ 
                   x: comparisonMode === 'year' ? 0 : '100%',
                   width: '50%'
                 }}
                 transition={{ type: "spring", stiffness: 300, damping: 30 }}
               />
               <button 
                 onClick={() => onModeChange('year')}
                 className={`relative px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors z-10 flex items-center gap-2 ${comparisonMode === 'year' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 <ArrowRightLeft className="w-4 h-4" /> Year-wise Comparison
               </button>
               <button 
                 onClick={() => onModeChange('round')}
                 className={`relative px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors z-10 flex items-center gap-2 ${comparisonMode === 'round' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 <Layers className="w-4 h-4" /> Round-wise Comparison
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: Filters & Range */}
            <div className="lg:col-span-8 space-y-8">
               {/* Rank Range */}
               <div className="bg-white/50 dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-6 flex justify-between">
                    <span>Rank Range Selection</span>
                    <span className="text-blue-600 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-500/10 px-2 py-0.5 rounded">
                      {rankRange[0].toLocaleString()} - {rankRange[1].toLocaleString()}
                    </span>
                  </label>
                  <RankRangeSlider
                    min={1}
                    max={200000}
                    step={100}
                    value={rankRange}
                    onChange={(val) => setRankRange(val as [number, number])}
                  />
                  <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                     <Filter className="w-3 h-3" /> Select a range to see colleges where cutoffs fall within this bracket.
                  </p>
               </div>

               {/* Advanced Filters Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Category</label>
                    <select 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white ring-offset-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {['OPEN', 'OBC', 'SC', 'ST', 'EWS'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Quota */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Quota</label>
                    <select 
                      value={quota} 
                      onChange={(e) => setQuota(e.target.value)}
                      className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white ring-offset-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {['AI', 'HS', 'OS'].map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
               </div>
            </div>

            {/* Right Col: Parameters */}
            <div className="lg:col-span-4 bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/5 flex flex-col justify-between">
                <div className="space-y-6">
                   <h3 className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                     <Calendar className="w-4 h-4 text-blue-500" /> 
                     {comparisonMode === 'year' ? 'Select Years' : 'Select Rounds'}
                   </h3>
                   
                   {comparisonMode === 'year' ? (
                     <>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">Base Year</label>
                        <select 
                          value={year1.toString()} 
                          onChange={(e) => setYear1(parseInt(e.target.value))}
                          className={selectClassName}
                        >
                          {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">Comparison Year</label>
                        <select 
                          value={year2.toString()} 
                          onChange={(e) => setYear2(parseInt(e.target.value))}
                          className={selectClassName}
                        >
                          {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                        </select>
                      </div>
                     </>
                   ) : (
                     <>
                        <div className="space-y-2">
                          <label className="text-xs text-slate-500 dark:text-slate-400">Select Year</label>
                          <select 
                            value={yearForRound.toString()} 
                            onChange={(e) => setYearForRound(parseInt(e.target.value))}
                            className={selectClassName}
                          >
                            {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-2">
                             <label className="text-xs text-slate-500 dark:text-slate-400">Round A</label>
                             <select 
                               value={round1.toString()} 
                               onChange={(e) => setRound1(parseInt(e.target.value))}
                               className={selectClassName}
                             >
                               {ROUNDS.map(r => <option key={r} value={r.toString()}>{r}</option>)}
                             </select>
                           </div>
                           <div className="space-y-2">
                             <label className="text-xs text-slate-500 dark:text-slate-400">Round B</label>
                             <select 
                               value={round2.toString()} 
                               onChange={(e) => setRound2(parseInt(e.target.value))}
                               className={selectClassName}
                             >
                               {ROUNDS.map(r => <option key={r} value={r.toString()}>{r}</option>)}
                             </select>
                           </div>
                        </div>
                     </>
                   )}
                </div>

                <div className="mt-8">
                   <button
                     onClick={handleCompare}
                     disabled={!canCompare}
                     className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all text-sm md:text-base flex items-center justify-center gap-2"
                   >
                     {isLoading ? (
                       <span className="animate-pulse">Processing...</span>
                     ) : (
                       <>Generate Analysis <ArrowRightLeft className="w-4 h-4 group-hover:rotate-180 transition-transform" /></>
                     )}
                   </button>
                   {!isValidRange && (
                     <p className="text-center text-red-500 text-xs mt-2">Range must be at least 1000</p>
                   )}
                </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
