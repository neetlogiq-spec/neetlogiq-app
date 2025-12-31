/**
 * Premium Gate Component
 * Blocks access to premium features and shows upgrade modal
 */

'use client';

import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Check, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePremium } from '@/contexts/PremiumContext';
import { PRICING_PLANS, FeatureKey } from '@/config/premium';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PremiumGateProps {
  featureKey: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeButton?: boolean;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({
  featureKey,
  children,
  fallback,
  showUpgradeButton = true
}) => {
  const { isDarkMode } = useTheme();
  const { hasFeatureAccess, canUseFeature, currentPlan, getFeatureLimit, getFeatureUsage, loading: premiumLoading } = usePremium();
  const [showModal, setShowModal] = useState(false);
  const [canUse, setCanUse] = useState<boolean | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const checkAccess = async () => {
      const access = await canUseFeature(featureKey);
      setCanUse(access);
    };
    checkAccess();
  }, [featureKey, canUseFeature]);

  // Show loading state while premium context loads or while checking feature access
  if (premiumLoading || canUse === null) {
    return (
      <div className={`flex items-center justify-center p-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        <span className="ml-3 font-medium">Checking access...</span>
      </div>
    );
  }

  if (hasFeatureAccess(featureKey) && canUse) {
    return <>{children}</>;
  }

  const currentPlanObj = PRICING_PLANS[currentPlan] || PRICING_PLANS.free;
  const suggestedPlan = Object.values(PRICING_PLANS).find(
    plan => plan.id !== 'free' && plan.id !== currentPlan
  ) || PRICING_PLANS.premium;

  const handleUpgrade = () => {
    router.push('/pricing');
    setShowModal(false);
  };

  const LockedFeaturePlaceholder = () => (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center p-6 my-8">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 rounded-3xl" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full max-w-2xl backdrop-blur-md rounded-3xl border-2 p-8 md:p-12 shadow-2xl overflow-hidden text-center ${
          isDarkMode 
            ? 'bg-slate-900/60 border-white/20 shadow-purple-500/10' 
            : 'bg-white/80 border-gray-200/60 shadow-gray-200'
        }`}
      >
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl ${
          isDarkMode 
            ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
            : 'bg-gradient-to-br from-purple-600 to-pink-600'
        }`}>
          <Crown className="w-8 h-8 text-white" />
        </div>

        <h2 className={`text-3xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Premium Insight Feature
        </h2>
        <p className={`text-lg mb-8 max-w-sm mx-auto ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
          Detailed Trend Analysis is exclusive to our Premium members. Upgrade now to unlock historical data patterns.
        </p>

        {showUpgradeButton && (
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold transition-all flex items-center gap-2 mx-auto shadow-lg shadow-purple-500/20"
          >
            <Sparkles className="w-5 h-5" />
            Upgrade to Premium
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </motion.div>
    </div>
  );

  return (
    <>
      {fallback || <LockedFeaturePlaceholder />}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`max-w-2xl w-full rounded-2xl border-2 p-8 shadow-2xl overflow-hidden relative ${
                isDarkMode ? 'bg-slate-900 border-white/20' : 'bg-white border-gray-200'
              }`}
            >
              {/* Animated Glow */}
              <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-20">
                <Sparkles className={`w-24 h-24 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
              </div>

              <div className="flex items-start justify-between mb-8 relative z-10">
                <div>
                  <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Choose Your Plan
                  </h2>
                  <p className={isDarkMode ? 'text-slate-400' : 'text-gray-600'}>
                    Power up your NEET counselling journey
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className={`rounded-xl p-4 mb-8 border ${
                isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
<<<<<<< Updated upstream
              } border`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Current Plan: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {currentPlanObj.displayName}
                  </span>
                </p>
              </div>

              {/* Suggested Plan */}
              <div className="mb-6">
                <div className={`rounded-xl p-6 border-2 bg-gradient-to-br ${
                  isDarkMode ? 'from-purple-500/10 to-pink-500/10 border-purple-500/30' : 'from-purple-50 to-pink-50 border-purple-300'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {suggestedPlan.displayName}
                        </h3>
                        <span className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {suggestedPlan.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        ₹{suggestedPlan.price.monthly}
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        per month
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {suggestedPlan.features.slice(0, 6).map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleUpgrade}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-5 h-5" />
                    Upgrade to {suggestedPlan.displayName}
                  </button>
=======
              }`}>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Active Plan
                </div>
                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {currentPlanObj.displayName}
>>>>>>> Stashed changes
                </div>
              </div>

              <div className={`rounded-2xl p-6 border-2 mb-8 relative overflow-hidden transition-all ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-500'}`}>
                    <Zap className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-white'}`} />
                  </div>
                  <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {suggestedPlan.displayName}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {suggestedPlan.features.slice(0, 6).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0" />
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleUpgrade}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                >
                  Unlock All Features
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center">
                <Link
                  href="/pricing"
                  onClick={() => setShowModal(false)}
                  className={`text-sm font-semibold transition-all hover:underline ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Compare All Plans & Features
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PremiumGate;
