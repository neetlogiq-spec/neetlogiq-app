/**
 * Premium Context
 * Manages subscription state and feature access across the app
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { PRICING_PLANS, FeatureKey } from '@/config/premium';

interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'basic' | 'pro' | 'premium';
  status: 'active' | 'cancelled' | 'expired' | 'paused';
  start_date: string;
  end_date: string | null;
  razorpay_subscription_id: string | null;
  amount: number | null;
  billing_cycle: 'monthly' | 'yearly' | null;
}

interface FeatureUsage {
  feature_key: string;
  usage_count: number;
  last_reset_at: string;
}

interface PremiumContextType {
  subscription: Subscription | null;
  featureUsage: Record<string, FeatureUsage>;
  loading: boolean;
  isPremium: boolean;
  currentPlan: string;
  hasFeatureAccess: (featureKey: FeatureKey) => boolean;
  canUseFeature: (featureKey: FeatureKey) => Promise<boolean>;
  incrementFeatureUsage: (featureKey: FeatureKey) => Promise<void>;
  getFeatureLimit: (featureKey: FeatureKey) => number | 'unlimited';
  getFeatureUsage: (featureKey: FeatureKey) => number;
  refreshSubscription: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const PremiumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [featureUsage, setFeatureUsage] = useState<Record<string, FeatureUsage>>({});
  const [loading, setLoading] = useState(true);

  const currentPlan = subscription?.plan_type || 'free';
  const isPremium = subscription?.status === 'active' && subscription?.plan_type !== 'free';

  // Fetch subscription and feature usage
  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(null);
        setFeatureUsage({});
        setLoading(false);
        return;
      }

      // Fetch active subscription
      const { data: subscriptionData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subError);
      }

      setSubscription(subscriptionData || null);

      // Fetch feature usage
      const { data: usageData, error: usageError } = await supabase
        .from('user_feature_usage')
        .select('*')
        .eq('user_id', user.id);

      if (usageError) {
        console.error('Error fetching feature usage:', usageError);
      } else {
        const usageMap: Record<string, FeatureUsage> = {};
        usageData?.forEach((usage: any) => {
          usageMap[usage.feature_key] = usage;
        });
        setFeatureUsage(usageMap);
      }
    } catch (error) {
      console.error('Error in fetchSubscriptionData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();

    // Set up real-time subscription for changes
    const channel = supabase
      .channel('subscription_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions'
      }, () => {
        fetchSubscriptionData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const hasFeatureAccess = (featureKey: FeatureKey): boolean => {
    const plan = PRICING_PLANS[currentPlan];
    if (!plan) return false;

    switch (featureKey) {
      case 'trend_analysis':
        return plan.limits.trendAnalysis;
      case 'priority_support':
        return plan.limits.prioritySupport;
      case 'advanced_filters':
        return plan.limits.advancedFilters;
      case 'rank_predictor':
        return plan.limits.rankPredictor;
      default:
        return true;
    }
  };

  const getFeatureLimit = (featureKey: FeatureKey): number | 'unlimited' => {
    const plan = PRICING_PLANS[currentPlan];
    if (!plan) return 0;

    switch (featureKey) {
      case 'college_comparisons':
        return plan.limits.collegeComparisons;
      case 'smart_predictions':
        return plan.limits.smartPredictions;
      case 'counselling_documents':
        return plan.limits.counsellingDocuments;
      case 'export_data':
        return plan.limits.exportData;
      default:
        return 0;
    }
  };

  const getFeatureUsage = (featureKey: FeatureKey): number => {
    return featureUsage[featureKey]?.usage_count || 0;
  };

  const canUseFeature = async (featureKey: FeatureKey): Promise<boolean> => {
    const limit = getFeatureLimit(featureKey);
    if (limit === 'unlimited') return true;
    if (limit === 0) return false;

    const usage = getFeatureUsage(featureKey);
    return usage < limit;
  };

  const incrementFeatureUsage = async (featureKey: FeatureKey): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentUsage = featureUsage[featureKey];

      if (currentUsage) {
        // Update existing usage
        const { error } = await supabase
          .from('user_feature_usage')
          .update({ usage_count: currentUsage.usage_count + 1 })
          .eq('user_id', user.id)
          .eq('feature_key', featureKey);

        if (error) throw error;

        setFeatureUsage(prev => ({
          ...prev,
          [featureKey]: {
            ...currentUsage,
            usage_count: currentUsage.usage_count + 1
          }
        }));
      } else {
        // Create new usage record
        const { error } = await supabase
          .from('user_feature_usage')
          .insert({
            user_id: user.id,
            feature_key: featureKey,
            usage_count: 1
          });

        if (error) throw error;

        setFeatureUsage(prev => ({
          ...prev,
          [featureKey]: {
            feature_key: featureKey,
            usage_count: 1,
            last_reset_at: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error('Error incrementing feature usage:', error);
    }
  };

  const refreshSubscription = async (): Promise<void> => {
    await fetchSubscriptionData();
  };

  const value: PremiumContextType = {
    subscription,
    featureUsage,
    loading,
    isPremium,
    currentPlan,
    hasFeatureAccess,
    canUseFeature,
    incrementFeatureUsage,
    getFeatureLimit,
    getFeatureUsage,
    refreshSubscription
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = (): PremiumContextType => {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};
