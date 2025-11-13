'use client';

import React, { useState } from 'react';
import { Check, X, Crown, Zap, Shield, Sparkles } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import { useAuth } from '@/contexts/AuthContext';
import RazorpayCheckout from './RazorpayCheckout';

const PricingPlans: React.FC = () => {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'counseling' | 'premium' | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleSelectPlan = (planId: 'counseling' | 'premium') => {
    if (!user) {
      alert('Please sign in to subscribe');
      return;
    }

    setSelectedPlan(planId);
    setShowCheckout(true);
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return Shield;
      case 'counseling':
        return Zap;
      case 'premium':
        return Crown;
      default:
        return Sparkles;
    }
  };

  const features = {
    free: [
      { text: 'Save up to 10 colleges', included: true },
      { text: '3 recommendations per day', included: true },
      { text: 'View cutoffs (last 3 years)', included: true },
      { text: 'Basic college search', included: true },
      { text: 'Real-time seat updates', included: false },
      { text: 'SMS alerts', included: false },
      { text: 'Hidden gems discovery', included: false },
      { text: 'Advanced analytics', included: false }
    ],
    counseling: [
      { text: 'Save unlimited colleges', included: true },
      { text: 'Unlimited recommendations', included: true },
      { text: 'View cutoffs (all years)', included: true },
      { text: 'Real-time seat tracker', included: true },
      { text: 'SMS + Email alerts', included: true },
      { text: 'Hidden gems discovery', included: true },
      { text: 'Advanced analytics dashboard', included: true },
      { text: 'Priority support', included: true }
    ],
    premium: [
      { text: 'Everything in Counseling Pass', included: true },
      { text: 'AI Study Buddy chatbot', included: true },
      { text: 'College visit planner', included: true },
      { text: 'Document manager with OCR', included: true },
      { text: 'Family sharing (3 members)', included: true },
      { text: 'Custom reports & exports', included: true },
      { text: '1-on-1 career counseling session', included: true },
      { text: 'Early access to new features', included: true }
    ]
  };

  return (
    <div className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Get the tools you need to make informed decisions about your medical career
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const Icon = getPlanIcon(plan.id);
            const planFeatures = features[plan.id as keyof typeof features];
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 transition-all ${
                  isPopular
                    ? 'border-blue-500 shadow-blue-500/20 scale-105'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon & Name */}
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-3 rounded-lg ${
                      plan.id === 'free' ? 'bg-gray-100 dark:bg-gray-700' :
                      plan.id === 'counseling' ? 'bg-blue-100 dark:bg-blue-900' :
                      'bg-purple-100 dark:bg-purple-900'
                    }`}>
                      <Icon className={`h-6 w-6 ${
                        plan.id === 'free' ? 'text-gray-600 dark:text-gray-400' :
                        plan.id === 'counseling' ? 'text-blue-600 dark:text-blue-400' :
                        'text-purple-600 dark:text-purple-400'
                      }`} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </h2>
                  </div>

                  {/* Badge */}
                  {plan.badge && (
                    <div className="mb-4">
                      <span className="inline-block bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-3 py-1 rounded-full text-xs font-medium">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        ₹{plan.price}
                      </span>
                      {plan.durationMonths > 0 && (
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          /{plan.durationMonths === 3 ? 'season' : 'year'}
                        </span>
                      )}
                    </div>
                    {plan.durationMonths > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {plan.durationMonths} months access
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {planFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${
                          feature.included
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {plan.id === 'free' ? (
                    <button
                      disabled
                      className="w-full py-3 px-6 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.id as 'counseling' | 'premium')}
                      className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                        isPopular
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                          : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                      }`}
                    >
                      {user ? 'Subscribe Now' : 'Sign In to Subscribe'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Signals */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                10,000+
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Students Helped
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                2,442
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Colleges Covered
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                95%
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Satisfaction Rate
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Frequently Asked Questions
          </h3>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: 'Can I upgrade or downgrade my plan?',
                a: 'Yes! You can upgrade at any time. The price difference will be prorated. Downgrades take effect at the end of your current billing period.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit/debit cards, UPI, net banking, and wallets through our secure payment partner Razorpay.'
              },
              {
                q: 'Is there a refund policy?',
                a: 'Yes, we offer a 7-day money-back guarantee. If you\'re not satisfied, contact us for a full refund.'
              },
              {
                q: 'How does family sharing work?',
                a: 'Premium plan holders can share their subscription with up to 3 family members. Each member gets their own profile and saved data.'
              }
            ].map((faq, index) => (
              <details
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
              >
                <summary className="font-semibold text-gray-900 dark:text-white cursor-pointer">
                  {faq.q}
                </summary>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Razorpay Checkout Modal */}
      {selectedPlan && showCheckout && (
        <RazorpayCheckout
          planId={selectedPlan}
          onClose={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
          }}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
            // Reload page to update subscription status
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default PricingPlans;
