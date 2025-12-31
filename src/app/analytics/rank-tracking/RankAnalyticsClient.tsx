'use client';

/**
 * Rank Analytics Client Component - Redesigned
 *
 * Matches Cutoffs page UI pattern:
 * - Hero section with "Start Exploring" button
 * - Sticky search/filter bar
 * - Table-based results display
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Crown, Lock, Search, TrendingUp, Sparkles, ChevronDown, Calendar, Users, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import RankTrackingHero from '@/components/analytics/RankTrackingHero';
import RankJourneyTable from '@/components/analytics/RankJourneyTable';
import InteractiveJourneyTimeline from '@/components/analytics/InteractiveJourneyTimeline';
import UpgradeStatsDashboard from '@/components/analytics/UpgradeStatsDashboard';
import { RankJourney } from '@/services/rank-tracking-service';
import { ComparisonProvider } from '@/contexts/ComparisonContext';
import { ComparisonDrawer } from '@/components/rank-tracking/ComparisonDrawer';
import { ProbabilitySimulatorCard } from '@/components/rank-tracking/ProbabilitySimulatorCard';
import { Vortex } from '@/components/ui/vortex';
import { LightVortex } from '@/components/ui/light-vortex';

function RankAnalyticsContent() {
  const { user, isAdmin } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();

  // Hero/Content transition state
  const [showContent, setShowContent] = useState(false);
  
  // Search form state
  const [rankInput, setRankInput] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedCategory, setSelectedCategory] = useState('GM');
  const [selectedQuota, setSelectedQuota] = useState('STATE');

  // Journey data state
  const [journey, setJourney] = useState<RankJourney | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<{
    rank: number;
    year: number;
    category: string;
    quota: string;
    sourceId: string;
    levelId: string;
  } | null>(null);

  // Premium check
  const [isPremium, setIsPremium] = useState(false);
  
  useEffect(() => {
    const checkSubscription = async () => {
      if (isAdmin) {
        setIsPremium(true);
        return;
      }

      if (!user) {
        setIsPremium(false);
        return;
      }

      try {
        const { data } = await fetch(`/api/subscriptions/check?user_id=${user.uid}`).then(r => r.json());
        setIsPremium(
          data?.tier === 'premium' && 
          data?.status === 'active' && 
          new Date(data?.expires_at) > new Date()
        );
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsPremium(false);
      }
    };

    checkSubscription();
  }, [user, isAdmin]);

  const handleStartExploring = () => {
    setShowContent(true);
  };

  const handleSearch = async () => {
    const rank = parseInt(rankInput);
    if (!rank || isNaN(rank)) {
      setError('Please enter a valid rank number');
      return;
    }

    setIsLoading(true);
    setError(null);
    setJourney(null);
    
    const params = {
      rank,
      year: parseInt(selectedYear),
      category: selectedCategory,
      quota: selectedQuota,
      sourceId: 'KEA_PG',
      levelId: 'PG_MEDICAL'
    };
    setSearchParams(params);

    try {
      const response = await fetch(
        `/api/rank-tracking/${rank}?year=${params.year}&category=${encodeURIComponent(params.category)}&quota=${encodeURIComponent(params.quota)}&source_id=${params.sourceId}&level_id=${params.levelId}`
      );

      const data = await response.json();

      if (response.status === 404) {
        setError(`No data found for rank ${rank.toLocaleString()} with the selected filters.`);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch rank journey');
      }

      if (data.success && data.data) {
        setJourney(data.data);
      } else {
        setError('No journey data found for this rank combination');
      }
    } catch (err) {
      console.error('Error fetching rank journey:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rank journey.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Vortex Background */}
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={650}
          baseHue={160}
          rangeHue={60}
          baseSpeed={0.16}
          rangeSpeed={1.7}
          baseRadius={1}
          rangeRadius={2.6}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/35 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={450}
          baseHue={160}
          baseSpeed={0.12}
          rangeSpeed={1.5}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-linear-to-br from-emerald-50/30 via-cyan-50/20 to-blue-50/30 z-10"></div>
        </LightVortex>
      )}

      <AnimatePresence>
        {!showContent ? (
          <motion.div
            key="hero"
            className="fixed inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <RankTrackingHero 
              isDarkMode={isDarkMode}
              isVisible={true}
              onStartExploring={handleStartExploring}
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="fixed inset-0 z-20 overflow-y-auto pt-16"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-[calc(100vh-5rem)] relative overflow-auto transition-all duration-500 flex flex-col">
              
              {/* Sticky Search/Filter Bar */}
              <div className={`sticky top-0 z-30 px-4 sm:px-6 py-4 backdrop-blur-md ${isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="max-w-7xl mx-auto">
                  {/* Row 1: Rank Input, Year, Category */}
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    {/* Rank Input */}
                    <div className="relative flex-1 max-w-[180px]">
                      <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        placeholder="Enter Rank"
                        value={rankInput}
                        onChange={(e) => setRankInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                      />
                    </div>
                    
                    {/* Year Filter */}
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="2024">2024</option>
                      <option value="2023">2023</option>
                      <option value="2022">2022</option>
                    </select>
                    
                    {/* Category Filter */}
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="GM">General (GM)</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="GMP">GM PH</option>
                      <option value="MC">Minority</option>
                    </select>
                  </div>
                  
                  {/* Row 2: Quota, Search Button */}
                  <div className="flex items-center gap-3">
                    {/* Quota Filter */}
                    <select
                      value={selectedQuota}
                      onChange={(e) => setSelectedQuota(e.target.value)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="STATE">State Quota</option>
                      <option value="AIQ">All India Quota</option>
                      <option value="MANAGEMENT">Management</option>
                    </select>
                    
                    {/* Search Button */}
                    <motion.button
                      onClick={handleSearch}
                      disabled={isLoading || !rankInput}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        isLoading || !rankInput
                          ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                          : isDarkMode 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      whileHover={!isLoading && rankInput ? { scale: 1.02 } : {}}
                      whileTap={!isLoading && rankInput ? { scale: 0.98 } : {}}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Search Journey
                    </motion.button>
                    
                    {/* Results count badge */}
                    {journey && (
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {journey.allocations.length} rounds found
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Section */}
              <div className="flex-1 px-4 sm:px-6 py-6 overflow-hidden flex flex-col">
                <div className="max-w-7xl mx-auto w-full">
                  <AnimatePresence mode="wait">
                    {/* Error State */}
                    {error && !isLoading && (
                      <motion.div 
                        key="error"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="max-w-2xl mx-auto"
                      >
                        <div className={`p-8 rounded-3xl ${isDarkMode ? 'bg-slate-900/80' : 'bg-white/80'} border ${isDarkMode ? 'border-amber-900/50' : 'border-amber-200'} backdrop-blur-xl shadow-xl text-center`}>
                          <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${isDarkMode ? 'bg-amber-900/30' : 'bg-amber-100'} flex items-center justify-center`}>
                            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>No Data Found</h3>
                          <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-4`}>{error}</p>
                          <div className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            <p>💡 Try adjusting your search:</p>
                            <ul className="mt-2 space-y-1">
                              <li>• Different rank number</li>
                              <li>• Different category/quota</li>
                              <li>• Another year</li>
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Loading State */}
                    {isLoading && (
                      <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-16"
                      >
                        <div className="w-12 h-12 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600 dark:border-t-emerald-400 rounded-full animate-spin mb-4" />
                        <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Searching for rank journey...</p>
                      </motion.div>
                    )}

                    {/* Results */}
                    {journey && (
                      <motion.div 
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-6"
                      >
                        {/* Journey Table - Full Width */}
                        <div className={`p-6 rounded-3xl ${isDarkMode ? 'bg-slate-900/80' : 'bg-white/80'} border ${isDarkMode ? 'border-white/10' : 'border-slate-200'} backdrop-blur-xl shadow-xl`}>
                          <RankJourneyTable journey={journey} isPremium={isPremium} />
                        </div>

                        {/* Additional Stats Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Status Card */}
                          <div className={`p-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl relative overflow-hidden`}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                            <div className="relative z-10">
                              <p className="text-indigo-100 font-medium mb-1">Final Status</p>
                              <h2 className="text-3xl font-bold mb-2">
                                {journey.final_status?.replace(/_/g, ' ') || 'Not Allotted'}
                              </h2>
                              <div className="flex items-center gap-2 text-indigo-100 text-sm">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span>Round {journey.final_round} • {journey.total_upgrades} Upgrade{journey.total_upgrades !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Stats */}
                          <div className={`p-6 rounded-3xl ${isDarkMode ? 'bg-slate-900/80' : 'bg-white/80'} border ${isDarkMode ? 'border-white/10' : 'border-slate-200'} backdrop-blur-xl`}>
                            <h3 className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Journey Summary</h3>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Total Rounds</span>
                                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{journey.total_rounds_participated}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Upgrades</span>
                                <span className={`font-bold text-emerald-500`}>{journey.total_upgrades}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Final College</span>
                                <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-[180px]`}>
                                  {journey.allocations[journey.allocations.length - 1]?.college_name?.split(' ').slice(0, 3).join(' ') || '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Probability Simulator */}
                          <ProbabilitySimulatorCard 
                            currentRank={searchParams?.rank || 0} 
                            totalColleges={journey.allocations.length + 5}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Empty State */}
                    {!journey && !isLoading && !error && (
                      <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                      >
                        <div className={`w-20 h-20 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center mb-6`}>
                          <Search className={`w-10 h-10 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                        </div>
                        <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Search for a Rank
                        </h3>
                        <p className={`max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Enter a rank number above to see how that rank was allocated across all counselling rounds.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Comparison Drawer */}
      <ComparisonDrawer />
    </div>
  );
}

// Wrapper component that provides context
export default function RankAnalyticsClient() {
  return (
    <ComparisonProvider>
      <RankAnalyticsContent />
    </ComparisonProvider>
  );
}
