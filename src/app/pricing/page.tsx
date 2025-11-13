'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, Zap, Sparkles, ArrowLeft, Star } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePremium } from '@/contexts/PremiumContext';
import { Vortex } from '@/components/ui/vortex';
import LightVortex from '@/components/ui/LightVortex';
import Footer from '@/components/ui/Footer';
import Link from 'next/link';
import { PRICING_PLANS } from '@/config/premium';

const PricingPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { currentPlan, loading: subscriptionLoading } = usePremium();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [showContent, setShowContent] = useState(false);

  const plans = Object.values(PRICING_PLANS);

  const handleSubscribe = async (planId: string, cycle: 'monthly' | 'yearly') => {
    if (planId === 'free') return;

    // TODO: Implement Razorpay checkout
    console.log('Subscribe to:', planId, cycle);
    // This will be implemented in the next step
  };

  const floatingIcons = [
    { Icon: Crown, color: 'from-yellow-500 to-orange-500', delay: 0 },
    { Icon: Zap, color: 'from-blue-500 to-cyan-500', delay: 0.2 },
    { Icon: Star, color: 'from-purple-500 to-pink-500', delay: 0.4 },
    { Icon: Sparkles, color: 'from-green-500 to-teal-500', delay: 0.6 }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {isDarkMode ? (
        <Vortex
          className="fixed inset-0 z-0"
          particleCount={700}
          baseHue={270}
          rangeHue={90}
          baseSpeed={0.15}
          rangeSpeed={1.8}
          baseRadius={1}
          rangeRadius={2.5}
          backgroundColor="#000000"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-black/30 z-10"></div>
        </Vortex>
      ) : (
        <LightVortex
          className="fixed inset-0 z-0"
          particleCount={350}
          baseHue={280}
          baseSpeed={0.1}
          rangeSpeed={1.3}
          baseRadius={1.5}
          rangeRadius={3}
          backgroundColor="#ffffff"
          containerClassName="fixed inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-indigo-50/30 z-10"></div>
        </LightVortex>
      )}

      <AnimatePresence mode="wait">
        {!showContent ? (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="relative z-20 min-h-screen flex items-center justify-center p-4"
          >
            <div className="max-w-6xl mx-auto text-center">
              <div className="relative mb-12">
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 flex gap-8">
                  {floatingIcons.map(({ Icon, color, delay }, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                      animate={{
                        opacity: [0, 1, 0.8, 1],
                        scale: [0.5, 1, 1.1, 1],
                        rotate: [-180, 0, 10, 0],
                        y: [0, -10, 0]
                      }}
                      transition={{
                        duration: 2,
                        delay: delay,
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    >
                      <div className={`bg-gradient-to-br ${color} p-3 rounded-xl shadow-2xl`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={`text-6xl md:text-8xl font-bold mb-6 mt-16 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-yellow-400 via-purple-400 to-pink-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-yellow-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'
                }`}
              >
                Choose Your Plan
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className={`text-xl md:text-2xl mb-12 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent'
                }`}
              >
                Unlock Premium Features for Better College Decisions
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-wrap justify-center gap-8 mb-12"
              >
                {[
                  { label: '10K+', sublabel: 'Active Users' },
                  { label: '50K+', sublabel: 'Predictions' },
                  { label: '4.8★', sublabel: 'Rating' }
                ].map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className={`text-4xl md:text-5xl font-bold mb-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {stat.label}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {stat.sublabel}
                    </div>
                  </div>
                ))}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                onClick={() => setShowContent(true)}
                className={`group relative px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-yellow-600 via-purple-600 to-pink-600 hover:from-yellow-500 hover:via-purple-500 hover:to-pink-500 text-white'
                    : 'bg-gradient-to-r from-yellow-500 via-purple-500 to-pink-500 hover:from-yellow-600 hover:via-purple-600 hover:to-pink-600 text-white'
                } shadow-2xl hover:shadow-purple-500/50 hover:scale-105`}
              >
                <span className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  View Pricing Plans
                  <Sparkles className="w-5 h-5" />
                </span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-20 min-h-screen bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
          >
            <div className="max-w-7xl mx-auto px-4 py-8">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <button
                  onClick={() => setShowContent(false)}
                  className={`inline-flex items-center gap-2 mb-4 text-sm ${
                    isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  } transition-colors`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Hero
                </button>

                <div className="text-center mb-8">
                  <h1 className={`text-4xl md:text-5xl font-bold mb-3 ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-yellow-600 to-purple-600 bg-clip-text text-transparent'
                  }`}>
                    Pricing Plans
                  </h1>
                  <p className={`text-lg mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Choose the perfect plan for your NEET counselling journey
                  </p>

                  {/* Billing Toggle */}
                  <div className={`inline-flex items-center gap-3 p-2 rounded-xl ${
                    isDarkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-200'
                  } border`}>
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        billingCycle === 'monthly'
                          ? isDarkMode
                            ? 'bg-white text-gray-900'
                            : 'bg-gray-900 text-white'
                          : isDarkMode
                            ? 'text-gray-400'
                            : 'text-gray-600'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`px-6 py-2 rounded-lg font-medium transition-all relative ${
                        billingCycle === 'yearly'
                          ? isDarkMode
                            ? 'bg-white text-gray-900'
                            : 'bg-gray-900 text-white'
                          : isDarkMode
                            ? 'text-gray-400'
                            : 'text-gray-600'
                      }`}
                    >
                      Yearly
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                        Save 17%
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {plans.map((plan, index) => {
                  const isCurrentPlan = plan.id === currentPlan;
                  const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
                  const monthlyPrice = billingCycle === 'yearly' ? Math.round(plan.price.yearly / 12) : price;

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className={`relative rounded-2xl border-2 p-6 ${
                        plan.popular
                          ? isDarkMode
                            ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500'
                            : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-500'
                          : isDarkMode
                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                            : 'bg-white border-gray-200 hover:shadow-xl'
                      } transition-all`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold rounded-full">
                          MOST POPULAR
                        </div>
                      )}

                      {isCurrentPlan && (
                        <div className="absolute -top-3 right-4 px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                          CURRENT PLAN
                        </div>
                      )}

                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                        <Crown className="w-6 h-6 text-white" />
                      </div>

                      <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {plan.displayName}
                      </h3>

                      <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {plan.description}
                      </p>

                      <div className="mb-6">
                        {plan.id === 'free' ? (
                          <div className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Free
                          </div>
                        ) : (
                          <>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              ₹{monthlyPrice}
                              <span className={`text-lg font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                /month
                              </span>
                            </div>
                            {billingCycle === 'yearly' && (
                              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Billed ₹{price} yearly
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => handleSubscribe(plan.id, billingCycle)}
                        disabled={isCurrentPlan || plan.id === 'free'}
                        className={`w-full py-3 rounded-xl font-semibold transition-all mb-6 ${
                          isCurrentPlan
                            ? isDarkMode
                              ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : plan.popular
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                              : isDarkMode
                                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                      >
                        {isCurrentPlan ? 'Current Plan' : plan.id === 'free' ? 'Get Started' : `Upgrade to ${plan.displayName}`}
                      </button>

                      <div className="space-y-3">
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* FAQ Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className={`rounded-2xl border-2 p-8 ${
                  isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                }`}
              >
                <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Frequently Asked Questions
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      q: 'Can I cancel anytime?',
                      a: 'Yes! You can cancel your subscription anytime from your account settings.'
                    },
                    {
                      q: 'What payment methods do you accept?',
                      a: 'We accept all major credit/debit cards, UPI, net banking, and wallets via Razorpay.'
                    },
                    {
                      q: 'Do you offer refunds?',
                      a: 'Yes, we offer a 7-day money-back guarantee if you\'re not satisfied.'
                    },
                    {
                      q: 'Can I upgrade or downgrade my plan?',
                      a: 'Yes, you can change your plan anytime. Changes take effect in the next billing cycle.'
                    }
                  ].map((faq, index) => (
                    <div key={index}>
                      <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {faq.q}
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {faq.a}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PricingPage;
