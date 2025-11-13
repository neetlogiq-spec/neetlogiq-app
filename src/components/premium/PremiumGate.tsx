/**
 * Premium Gate Component
 * Blocks access to premium features and shows upgrade modal
 */

'use client';

import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Check, Sparkles, Zap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePremium } from '@/contexts/PremiumContext';
import { PRICING_PLANS, FeatureKey } from '@/config/premium';
import { useRouter } from 'next/navigation';

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
  const { hasFeatureAccess, canUseFeature, currentPlan, getFeatureLimit, getFeatureUsage } = usePremium();
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

  // Check if user has access to this feature
  const hasAccess = hasFeatureAccess(featureKey);
  const limit = getFeatureLimit(featureKey);
  const usage = getFeatureUsage(featureKey);

  if (canUse === null) {
    return null; // Loading
  }

  if (hasAccess && canUse) {
    return <>{children}</>;
  }

  const currentPlanObj = PRICING_PLANS[currentPlan];
  const suggestedPlan = Object.values(PRICING_PLANS).find(
    plan => plan.id !== 'free' && plan.id !== currentPlan
  ) || PRICING_PLANS.basic;

  const handleUpgrade = () => {
    router.push('/pricing');
    setShowModal(false);
  };

  return (
    <>
      {fallback || (
        <div className={`relative ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'} rounded-xl p-8 border-2 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl"></div>

          <div className="relative z-10 text-center">
            <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>

            <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Premium Feature
            </h3>

            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {!hasAccess
                ? 'Upgrade your plan to unlock this feature'
                : `You've reached your limit of ${limit} uses for this month`
              }
            </p>

            {typeof limit === 'number' && hasAccess && (
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Usage: {usage} / {limit}
                  </span>
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    {Math.round((usage / limit) * 100)}%
                  </span>
                </div>
                <div className={`h-2 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                    style={{ width: `${Math.min((usage / limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {showUpgradeButton && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowModal(true)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  View Plans
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`max-w-4xl w-full rounded-2xl ${
                isDarkMode ? 'bg-gray-900 border-white/20' : 'bg-white border-gray-200'
              } border-2 p-8 max-h-[90vh] overflow-y-auto`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Upgrade Your Plan
                  </h2>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Choose the perfect plan for your needs
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-2 rounded-lg ${
                    isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  } transition-colors`}
                >
                  <X className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>
              </div>

              {/* Current Plan Info */}
              <div className={`rounded-xl p-4 mb-6 ${
                isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
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
                </div>
              </div>

              {/* View All Plans */}
              <button
                onClick={handleUpgrade}
                className={`w-full py-3 rounded-xl border-2 font-semibold transition-all ${
                  isDarkMode
                    ? 'border-white/20 hover:bg-white/10 text-white'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-900'
                }`}
              >
                View All Plans
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PremiumGate;
