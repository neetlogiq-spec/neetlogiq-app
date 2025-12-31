'use client';

/**
 * Upgrade Statistics Dashboard
 *
 * Shows upgrade probability, trends, and patterns
 * Premium feature with AI insights
 */

import { motion } from 'framer-motion';
import { TrendingUp, Target, Zap, Users, BarChart3, Award, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProbabilityBadge } from '@/components/rank-tracking/ProbabilityBadge';
import { CountUp } from '@/components/ui/CountUp';
import { CompareButton } from '@/components/rank-tracking/CompareButton';

interface UpgradeStatsDashboardProps {
  rank: number;
  year: number;
  category: string;
  quota: string;
  sourceId: string;
  levelId: string;
  stats?: {
    upgradeProbability?: number;
    averageUpgrades?: number;
    similarRanks?: number;
    topColleges?: { name: string; percentage: number }[];
  };
  isPremium?: boolean;
  onUpgrade?: () => void;
}

export default function UpgradeStatsDashboard({
  rank,
  year,
  category,
  quota,
  sourceId,
  levelId,
  stats,
  isPremium = false,
  onUpgrade,
}: UpgradeStatsDashboardProps) {
  // Mock data for demo (replace with real API data)
  const mockStats = {
    upgradeProbability: 67,
    averageUpgrades: 1.8,
    similarRanks: 342,
    topColleges: [
      { name: 'AIIMS Delhi', percentage: 23 },
      { name: 'MAMC Delhi', percentage: 18 },
      { name: 'KEM Mumbai', percentage: 15 },
      { name: 'GMC Mumbai', percentage: 12 },
      { name: 'LHMC Delhi', percentage: 10 },
    ],
  };

  const displayStats = stats || mockStats;

  if (!isPremium) {
    return (
      <Card className="p-12 text-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-700">
        <Lock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Premium Analytics
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          Get AI-powered upgrade predictions, probability analysis, and personalized insights
        </p>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-all inline-flex items-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Unlock Premium Analytics
          </button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Insight Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-2 border-blue-200 dark:border-blue-700">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  AI-Powered Insight
                </h3>
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                  Beta
                </Badge>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                Based on <span className="font-semibold">{displayStats.similarRanks}</span> similar rank journeys,
                you have a <span className="font-bold text-blue-600 dark:text-blue-400">{displayStats.upgradeProbability}%</span> probability
                of upgrading in Round 2. Students like you typically upgrade <span className="font-semibold">{displayStats.averageUpgrades}</span> times
                during counselling.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upgrade Probability */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 hover:shadow-xl transition-all bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8 text-green-600 dark:text-green-400" />
              <ProbabilityBadge probability={displayStats.upgradeProbability || 0} showPercentage={false} />
            </div>
            <div className="text-4xl font-bold text-green-900 dark:text-green-100 mb-2">
              <CountUp end={displayStats.upgradeProbability || 0} suffix="%" />
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">
              Upgrade Probability
            </div>
            <div className="mt-4 h-2 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-500 to-green-600"
                initial={{ width: 0 }}
                animate={{ width: `${displayStats.upgradeProbability}%` }}
                transition={{ delay: 0.5, duration: 1 }}
              />
            </div>
          </Card>
        </motion.div>

        {/* Average Upgrades */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 hover:shadow-xl transition-all bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <Badge className="bg-blue-600 text-white">Trend</Badge>
            </div>
            <div className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-2">
              <CountUp end={displayStats.averageUpgrades || 0} decimals={1} />
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Average Upgrades
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Per rank in your category
            </div>
          </Card>
        </motion.div>

        {/* Similar Ranks */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6 hover:shadow-xl transition-all bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              <Badge className="bg-purple-600 text-white">Data</Badge>
            </div>
            <div className="text-4xl font-bold text-purple-900 dark:text-purple-100 mb-2">
               <CountUp end={displayStats.similarRanks || 0} />
            </div>
            <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">
              Similar Ranks Tracked
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              Historical data points
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Top Colleges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Top Colleges for Your Rank
            </h3>
          </div>
          <div className="space-y-4">
            {displayStats.topColleges.map((college, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
  // ... imports
import { CompareButton } from '@/components/rank-tracking/CompareButton';

// ... inside map
                  <div className="flex items-center gap-3">
                     <CompareButton item={{
                         id: college.name, // Using name as ID for demo, usually use UUID
                         collegeName: college.name,
                         programName: 'B.Tech',
                         rank: 0
                     }} />
                     <span className="font-medium text-gray-900 dark:text-gray-100">
                        {college.name}
                     </span>
                  </div>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                    <CountUp end={college.percentage} suffix="%" />
                  </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${college.percentage}%` }}
                      transition={{ delay: 0.8 + index * 0.1, duration: 0.6 }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Recommendation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <Card className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-700">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                Strategy Recommendation
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Based on your {rank.toLocaleString()} rank in {category} category, we recommend:
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    <strong>Participate in Round 2</strong> - High probability of upgrade
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    <strong>Target top 3 colleges</strong> - AIIMS Delhi, MAMC Delhi, KEM Mumbai
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 dark:text-purple-400 mt-0.5">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    <strong>Consider freeze in Round 3</strong> - Diminishing returns after this
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
