'use client';

/**
 * Rank Analytics Hero Section
 * 
 * Premium redesign featuring:
 * - Animated mesh gradients
 * - Glassmorphism container
 * - Floating inputs
 * - Apple-style motion
 */

import { useState } from 'react';
import { Search, TrendingUp, Zap, Crown, ArrowRight, Sparkles, GraduationCap, School, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';

// Utility class for styled native select
const selectClassName = "flex h-14 w-full items-center justify-between rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white ring-offset-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm";
const inlineSelectClassName = "h-9 bg-transparent border-none text-blue-600 dark:text-blue-300 hover:text-blue-500 dark:hover:text-blue-200 p-0 focus:ring-0 w-auto font-medium appearance-none cursor-pointer";

interface RankAnalyticsHeroProps {
  onSearch: (rank: number, year: number, category: string, quota: string, sourceId: string, levelId: string) => void;
  isLoading?: boolean;
  isPremium?: boolean;
  onUpgrade?: () => void;
}

export default function RankAnalyticsHero({
  onSearch,
  isLoading,
  isPremium = false,
  onUpgrade,
}: RankAnalyticsHeroProps) {
  const [rank, setRank] = useState<string>('');
  const [year, setYear] = useState<string>('2024');
  const [category, setCategory] = useState<string>('General');
  const [quota, setQuota] = useState<string>('All India');
  const [sourceId, setSourceId] = useState<string>('SRC_AIQ');
  const [levelId, setLevelId] = useState<string>('LVL_UG');

  const handleSearch = () => {
    const rankNum = parseInt(rank);
    if (!rank || isNaN(rankNum) || rankNum < 1) {
      return;
    }
    onSearch(rankNum, parseInt(year), category, quota, sourceId, levelId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-950 min-h-[600px] flex items-center justify-center transition-colors duration-300">
      {/* Animated Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/30 dark:bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-400/30 dark:bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-indigo-400/30 dark:bg-indigo-500/20 rounded-full blur-[100px] animate-pulse delay-2000" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] dark:opacity-20 bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-12"
        >
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-blue-100 dark:border-white/20 text-blue-700 dark:text-blue-200 text-sm font-medium mb-6 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
            <span>AI-Powered Rank Analytics</span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white tracking-tight mb-6">
            Your Rank, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-white dark:via-blue-100 dark:to-indigo-200">Your Future.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Discover your best medical college options with our advanced analytics engine. 
            Track trends, predict upgrades, and plan your counselling strategy.
          </p>
        </motion.div>

        {/* Glassmorphic Search Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-blue-900/5 dark:shadow-none ring-1 ring-black/5 dark:ring-white/10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Rank Input - Prominent */}
              <div className="md:col-span-4 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                  NEET Rank
                </label>
                <div className="relative group">
                  <Input
                    type="number"
                    placeholder="Enter Rank"
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="h-14 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 dark:focus:border-blue-500/50 focus:ring-blue-500/20 transition-all text-lg shadow-sm"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filters Group */}
              <div className="md:col-span-8 lg:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Year */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Year
                  </label>
                  <select 
                    value={year} 
                    onChange={(e) => setYear(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Category
                  </label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>

                {/* Quota */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Quota
                  </label>
                  <select 
                    value={quota} 
                    onChange={(e) => setQuota(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="All India">All India</option>
                    <option value="State">State</option>
                  </select>
                </div>

                {/* Submit Wrapper (on desktop spans 1 col) */}
                <div className="flex items-end">
                  <motion.div whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                    <Button 
                      size="lg" 
                      onClick={handleSearch}
                      disabled={isLoading || !rank}
                      className="w-full h-12 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 font-medium text-base transition-all duration-300"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5 mr-2" />
                          Analyze Rank
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Advanced Filters Row (Source/Level) */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <span className="shrink-0 flex items-center gap-2">
                    <School className="w-4 h-4" /> Source:
                  </span>
                  <select 
                    value={sourceId} 
                    onChange={(e) => setSourceId(e.target.value)}
                    className={inlineSelectClassName}
                  >
                    <option value="SRC_AIQ">All India Quota (MCC)</option>
                    <option value="SRC_KEA">Karnataka (KEA)</option>
                    <option value="SRC_MCC">MCC All India</option>
                  </select>
               </div>
               
               <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 md:justify-end">
                  <span className="shrink-0 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" /> Level:
                  </span>
                  <select 
                    value={levelId} 
                    onChange={(e) => setLevelId(e.target.value)}
                    className={inlineSelectClassName}
                  >
                    <option value="LVL_UG">Undergraduate Medical</option>
                    <option value="LVL_PG">Postgraduate Medical</option>
                  </select>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Features / Premium Teaser */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto px-4">
          {[
            { icon: TrendingUp, title: "Smart Trends", desc: "Visualize seat movement across all rounds." },
            { icon: Zap, title: "Upgrade Predictor", desc: "AI-calculated probability of seat upgrades." },
            { icon: Crown, title: "Premium Insights", desc: "Unlock 5+ years of historical data." }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (idx * 0.1) }}
              className="group p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 hover:border-white dark:hover:border-white/10 transition-all cursor-default shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
